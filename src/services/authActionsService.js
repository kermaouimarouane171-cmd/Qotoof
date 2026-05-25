import { supabase } from '@/services/supabase'
import toast from 'react-hot-toast'
import { mfaService, sessionService, autoLogoutService } from '@/services/authServices'
import { auditLogger } from '@/services/auditLogger'
import { emailService } from '@/services/emailService'
import { useCartStore } from '@/store/cartStore'
import { useFavoritesStore } from '@/store/favoritesStore'
import { generateDeviceFingerprint, secureStorage, clearSupabaseLocalStorage } from '@/utils/encryption'
import {
  DEFAULT_AUTH_REDIRECT,
  clearPendingAuthRedirect,
  consumePendingAuthRedirect,
  resolveSafeAuthRedirect,
  setPendingAuthRedirect,
} from '@/utils/authRedirects'
import { checkLoginRate, checkPasswordResetRate, enforceRateLimit } from '@/utils/rateLimiter'
import { signInWithServerRateLimit } from '@/services/authGateway'
import { APP_CONFIG } from '@/config/appConfig'
import { logger } from '../utils/logger.js'

const OAUTH_STATE_PREFIX = 'oauth_'
const OAUTH_STATE_STORAGE_KEY = 'oauth_state'

const createOAuthState = () => {
  if (typeof window !== 'undefined' && typeof window.crypto?.randomUUID === 'function') {
    return `${OAUTH_STATE_PREFIX}${window.crypto.randomUUID()}`
  }

  const randomSuffix = Math.random().toString(36).slice(2)
  return `${OAUTH_STATE_PREFIX}${Date.now()}_${randomSuffix}`
}

const resolvePublicAppOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  if (typeof import.meta.env.VITE_APP_URL === 'string' && import.meta.env.VITE_APP_URL.trim()) {
    return import.meta.env.VITE_APP_URL.trim().replace(/\/$/, '')
  }

  return String(APP_CONFIG.siteUrl || '').replace(/\/$/, '')
}

const getEmailCallbackUrl = () => `${resolvePublicAppOrigin()}/auth/callback`

const isAlreadyRegisteredAuthError = (error) => {
  const message = String(error?.message || '').toLowerCase()
  return (
    message.includes('already registered') ||
    message.includes('user already registered') ||
    message.includes('email already in use') ||
    message.includes('already exists')
  )
}

export function createAuthActions(set, get) {
  return {
    // ============================================
    // ENHANCED SIGN IN WITH RATE LIMITING & MFA
    // ============================================
    signIn: async (email, password, captchaToken = null, preferredRedirect = null) => {
      try {
        set({ loading: true, _signingInProgress: true })
        const _safeRedirect = setPendingAuthRedirect(preferredRedirect)

        // Check rate limit
        enforceRateLimit(checkLoginRate, email)

        const { user, session } = await signInWithServerRateLimit({
          email,
          password,
          captchaToken,
        })

        if (!user || !session) {
          // SECURITY: Log failed login WITHOUT exposing user-provided data
          auditLogger.logAuthAction('LOGIN_FAILED', null, {
            timestamp: new Date().toISOString(),
            errorType: 'ServerLoginError',
            errorMessage: 'Missing authenticated session'
          }).catch(() => {})

          // SECURITY: Never expose specific error details to the client
          throw new Error('Invalid login credentials')
        }

        // Run profile fetch and MFA check in parallel to save time
        const [profile, mfaSettings] = await Promise.all([
          get().fetchProfile(user.id),
          mfaService?.getSettings ? mfaService.getSettings() : Promise.resolve(null),
        ])

        const deviceFingerprint = await generateDeviceFingerprint()
        set({ deviceFingerprint })

        if (mfaSettings?.is_enabled) {
          set({
            user,
            session,
            profile,
            loading: false,
            _signingInProgress: false,
            mfaRequired: true,
            mfaPending: true,
            passwordRecoveryMode: false,
          })

          auditLogger.logAuthAction('MFA_REQUIRED', user.id).catch(() => {})

          return {
            success: true,
            mfaRequired: true,
            redirect: '/mfa-verify'
          }
        }

        // No MFA - complete login
        set({
          user,
          session,
          profile,
          loading: false,
          _signingInProgress: false,
          mfaRequired: false,
          mfaPending: false,
          passwordRecoveryMode: false,
        })

        if (sessionService?.registerSession) {
          await sessionService.registerSession()
        }

        // Start auto logout (non-blocking)
        get().startAutoLogout()

        // Log successful login (non-blocking - don't await)
        auditLogger.logAuthAction('SIGNED_IN', user.id, {
          role: profile?.role
        }).catch(() => {})

        const redirect = consumePendingAuthRedirect(
          get().getRedirectPath(profile?.role)
        )

        toast.success('Welcome back!')
        return { success: true, redirect }
      } catch (error) {
        set({ loading: false, _signingInProgress: false })

        if (!preferredRedirect) {
          clearPendingAuthRedirect()
        }

        // SECURITY: Show generic error message to prevent user enumeration
        const genericError = 'Invalid email or password. Please try again.'
        const isRateLimited = error?.name === 'RateLimitError' ||
          error?.status === 429 ||
          error?.message?.toLowerCase?.().includes('too many') ||
          error?.message?.toLowerCase?.().includes('rate limit')

        if (isRateLimited) {
          toast.error(error.message) // Rate limit message is OK to show
        } else {
          toast.error(genericError)
        }

        return { success: false, error: genericError }
      }
    },

    // ============================================
    // VERIFY MFA CODE
    // ============================================
    verifyMFA: async (code) => {
      try {
        const { user } = get()
        if (!user) {
          return { success: false, error: 'No user logged in' }
        }

        const result = mfaService?.verifyCode ? await mfaService.verifyCode(code) : { success: true }

        if (!result.success) {
          return result
        }

        if (sessionService?.registerSession) {
          await sessionService.registerSession()
        }

        // MFA verified - complete login
        set({
          mfaRequired: false,
          mfaPending: false,
          passwordRecoveryMode: false,
        })

        // Start auto logout
        get().startAutoLogout()

        // Log MFA success
        await auditLogger.logAuthAction('MFA_VERIFIED', user.id)

        const profile = get().profile
        const redirect = consumePendingAuthRedirect(
          get().getRedirectPath(profile?.role)
        )
        toast.success('Authentication verified!')
        
        return { 
          success: true, 
          redirect
        }
      } catch (error) {
        logger.error('MFA verify error:', error)
        return { success: false, error: error.message }
      }
    },

    // ============================================
    // SIGN OUT (enhanced with audit)
    // ============================================
    signOut: async () => {
      try {
        const { user } = get()
        
        // Stop auto logout
        autoLogoutService.stop()

        // Log sign out before revoking the active auth session.
        if (user) {
          await auditLogger.logAuthAction('SIGNED_OUT', user.id)
        }

        // Mark only the current tracked browser session as inactive.
        if (sessionService?.revokeCurrentSession) {
          await sessionService.revokeCurrentSession()
        }

        const { error } = await supabase.auth.signOut()
        if (error) throw error

        set({
          user: null,
          session: null,
          profile: null,
          loading: false,
          mfaRequired: false,
          mfaPending: false,
          passwordRecoveryMode: false,
          deviceFingerprint: null,
          autoLogoutWarning: false
        })

        // Clear secure storage (sessionStorage)
        secureStorage.clear()
        clearPendingAuthRedirect()

        // Clear Supabase auth tokens from localStorage
        clearSupabaseLocalStorage()

        // Clear cart and favorites on logout
        useCartStore.getState().clearCart()
        useFavoritesStore.getState().clearFavorites()

        toast.success('Signed out successfully')
        return { success: true }
      } catch (error) {
        toast.error(error.message || 'Failed to sign out')
        return { success: false, error: error.message }
      }
    },

    // ============================================
    // SIGN UP (unchanged)
    // ============================================
    signUp: async (email, password, userData, captchaToken = null) => {
      try {
        set({ loading: true, _signingInProgress: true })
        const normalizedEmail = String(email || '').trim().toLowerCase()
        const emailRedirectTo = getEmailCallbackUrl()
        const signUpOptions = {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            role: userData.role,
            referral_code_used: userData.referralCode || null,
          },
          emailRedirectTo,
        }

        if (captchaToken) {
          signUpOptions.captchaToken = captchaToken
        }

        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: signUpOptions
        })

        if (error) throw error

        // Create profile
        if (data.user) {
          const profileData = {
            id: data.user.id,
            first_name: userData.firstName,
            last_name: userData.lastName,
            email: data.user.email,
            role: userData.role,
            phone: userData.phone || null,
            cin: userData.cin || null,
          }

          // Add driver-specific fields
          if (userData.role === 'driver') {
            profileData.vehicle_type = userData.vehicleType || 'van'
            profileData.vehicle_plate = userData.vehiclePlate || null
            profileData.is_available_for_delivery = false
          }

          const { error: profileError } = await supabase
            .from('profiles')
            .upsert(profileData, { onConflict: 'id' })

          if (profileError) {
            logger.error('Profile creation error:', profileError)
            // Don't throw - the trigger might have created it
          }

          // Check if email confirmation is required
          // If there's a session, email confirmation is disabled
          if (data.session) {
            const profile = await get().fetchProfile(data.user.id)

            const deviceFingerprint = await generateDeviceFingerprint()

            set({
              user: data.user,
              session: data.session,
              profile,
              deviceFingerprint,
              loading: false,
              _signingInProgress: false,
              mfaRequired: false,
              mfaPending: false,
              passwordRecoveryMode: false,
            })

            if (sessionService?.registerSession) {
              await sessionService.registerSession()
            }

            get().startAutoLogout()
            auditLogger.logAuthAction('SIGNED_UP', data.user.id, {
              role: profile?.role || userData.role,
            }).catch(() => {})

            toast.success('Account created successfully!')
            return {
              success: true,
              redirect: get().getRedirectPath(profile?.role),
              userId: data.user.id,
              phone: userData.phone || null,
              role: userData.role,
              requiresPhoneVerification: Boolean(userData.phone),
            }
          }

          // No session means email confirmation is enabled
          set({ loading: false, _signingInProgress: false })
          toast.success('Account created! Please check your email to verify.')
          return {
            success: true,
            needsEmailVerification: true,
            userId: data.user.id,
            phone: userData.phone || null,
            role: userData.role,
            requiresPhoneVerification: Boolean(userData.phone),
          }
        }

        set({ loading: false, _signingInProgress: false })
        toast.success('Account created! Please check your email to verify.')
        return {
          success: true,
          needsEmailVerification: true,
          userId: data.user?.id || null,
          phone: userData.phone || null,
          role: userData.role,
          requiresPhoneVerification: Boolean(userData.phone),
        }
      } catch (error) {
        set({ loading: false, _signingInProgress: false })

        if (isAlreadyRegisteredAuthError(error)) {
          const normalizedEmail = String(email || '').trim().toLowerCase()
          const emailRedirectTo = getEmailCallbackUrl()

          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: normalizedEmail,
            options: { emailRedirectTo },
          })

          if (!resendError) {
            toast.success('Email verification sent again. Please check your inbox.')
            return {
              success: true,
              needsEmailVerification: true,
              userId: null,
              phone: userData.phone || null,
              role: userData.role,
              requiresPhoneVerification: false,
            }
          }
        }

        toast.error(error.message || 'Failed to create account')
        return { success: false, error: error.message }
      }
    },

    // ============================================
    // OAUTH SIGN IN (with redirect_to support)
    // ============================================
    signInWithGoogle: async (redirectTo) => {
      try {
        const safeRedirect = resolveSafeAuthRedirect(redirectTo, DEFAULT_AUTH_REDIRECT)
        const oauthState = createOAuthState()

        sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, oauthState)

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(safeRedirect)}`,
            queryParams: {
              state: oauthState,
            },
          }
        })

        if (error) throw error
        return { success: true }
      } catch (error) {
        sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
        toast.error(error.message || 'Failed to sign in with Google')
        return { success: false, error: error.message }
      }
    },

    // ============================================
    // RESET PASSWORD (with rate limiting)
    // ============================================
    resetPassword: async (email) => {
      try {
        // SECURITY: Use PASSWORD RESET specific rate limiter (3 per hour)
        // NOT the login rate limiter (5 per 15 minutes)
        enforceRateLimit(checkPasswordResetRate, email)

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`
        })

        if (error) {
          // SECURITY: Log the error internally but don't expose to client
          logger.error('Password reset request error:', error)

          // If rate limited, return specific error
          if (error.name === 'RateLimitError') {
            return {
              success: false,
              rateLimited: true,
              message: error.message || 'Too many attempts. Please wait before trying again.'
            }
          }

          // For all other errors, still return success to prevent user enumeration
          // Supabase's resetPasswordForEmail doesn't throw if email doesn't exist
          // but we handle it defensively
          return { success: true }
        }

        // Log password reset request (without exposing email to client)
        await auditLogger.logAuthAction('PASSWORD_RESET_REQUESTED', null, {
          timestamp: new Date().toISOString(),
          // Don't log the email address for security
        })

        // Always return success to prevent user enumeration
        return { success: true }
      } catch (error) {
        // SECURITY: Never expose error details to client
        logger.error('Password reset request error:', error)

        // If rate limited, return specific error
        if (error.name === 'RateLimitError') {
          return {
            success: false,
            rateLimited: true,
            message: error.message || 'Too many attempts. Please wait before trying again.'
          }
        }

        // For all other errors, still return success to prevent user enumeration
        return { success: true }
      }
    },

    // ============================================
    // UPDATE PASSWORD (with session revocation)
    // ============================================
    updatePassword: async (newPassword) => {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        })

        if (error) throw error

        // Log password update
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await auditLogger.logAuthAction('PASSWORD_UPDATED', user.id)

          // SECURITY: Revoke all other sessions after password change
          // This ensures that any compromised sessions are invalidated
          try {
            if (sessionService?.revokeAllOtherSessions) {
              await sessionService.revokeAllOtherSessions()
            }
            logger.info('All sessions revoked after password change for user:', user.id)
          } catch (sessionErr) {
            // Don't fail password update if session revocation fails
            logger.error('Failed to revoke sessions after password change:', sessionErr)
          }
        }

        toast.success('Password updated successfully! All other sessions have been signed out.')
        set({ passwordRecoveryMode: false })
        return { success: true }
      } catch (error) {
        toast.error(error.message || 'Failed to update password')
        return { success: false, error: error.message }
      }
    },

    // ============================================
    // UPDATE PROFILE (with audit logging)
    // ============================================
    updateProfile: async (updates) => {
      try {
        const { user, profile: oldProfile } = get()
        if (!user) throw new Error('No user logged in')

        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single()

        if (error) throw error

        set({ profile: data })

        // Log profile update
        await auditLogger.logProfileAction('UPDATE', data, oldProfile)

        toast.success('Profile updated!')
        return { success: true }
      } catch (error) {
        toast.error(error.message || 'Failed to update profile')
        return { success: false, error: error.message }
      }
    },

    // Accept vendor guidelines
    acceptVendorGuidelines: async () => {
      try {
        const { user } = get()
        if (!user) throw new Error('No user logged in')

        const { data, error } = await supabase
          .from('profiles')
          .update({
            vendor_guidelines_accepted: true,
            vendor_guidelines_accepted_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select()
          .single()

        if (error) throw error

        set({ profile: data })
        toast.success('Vendor guidelines accepted!')
        return { success: true }
      } catch (error) {
        toast.error(error.message || 'Failed to accept guidelines')
        return { success: false, error: error.message }
      }
    },

    // ============================================
    // UPDATE DRIVER AVAILABILITY (unchanged)
    // ============================================
    setDriverAvailability: async (isAvailable) => {
      try {
        const { user } = get()
        if (!user) throw new Error('No user logged in')

        const { error: profileError } = await supabase
          .from('profiles')
          .update({ is_available_for_delivery: isAvailable })
          .eq('id', user.id)

        if (profileError) throw profileError

        await supabase
          .from('driver_availability_log')
          .insert({
            driver_id: user.id,
            is_available: isAvailable,
          })

        const profile = await get().fetchProfile(user.id)
        set({ profile })

        toast.success(isAvailable ? 'You are now online and available for deliveries' : 'You are now offline')
        return { success: true }
      } catch (error) {
        toast.error(error.message || 'Failed to update availability')
        return { success: false, error: error.message }
      }
    },

    // ============================================
    // SECURITY WRAPPERS FOR UI HOOKS
    // ============================================
    getMFASettings: async () => {
      if (!mfaService?.getSettings) return null
      return await mfaService.getSettings()
    },

    getActiveSessions: async () => {
      if (!sessionService?.getActiveSessions) return []
      return await sessionService.getActiveSessions()
    },

    disableMFA: async () => {
      if (!mfaService?.disable) {
        return { success: false, error: 'MFA disable is not available' }
      }
      return await mfaService.disable()
    },

    enableMFA: async () => {
      if (!mfaService?.enableWithEmail) {
        return { success: false, error: 'MFA enable is not available' }
      }
      return await mfaService.enableWithEmail()
    },

    revokeAllOtherSessions: async () => {
      if (!sessionService?.revokeAllOtherSessions) {
        return { success: false, error: 'Session revocation is not available' }
      }
      return await sessionService.revokeAllOtherSessions()
    },

    // ============================================
    // DELETE ACCOUNT (permanent, with full data cleanup)
    // ============================================
    deleteAccount: async (confirmationText) => {
      try {
        const { user, profile } = get()
        if (!user) throw new Error('No user logged in')

        // Validate confirmation text
        if (confirmationText !== 'DELETE') {
          throw new Error('Confirmation text must be exactly "DELETE"')
        }

        // Call the server-side deletion function
        const { error } = await supabase.rpc('delete_user_account')

        if (error) throw error

        // Log the deletion
        await auditLogger.logAuthAction('ACCOUNT_DELETED', user.id, {
          email: profile?.email || user.email,
          role: profile?.role
        })

        // Stop auto logout
        autoLogoutService.stop()

        // Revoke all sessions
        if (sessionService?.revokeAllOtherSessions) {
          await sessionService.revokeAllOtherSessions()
        }

        // Clear all local state
        set({
          user: null,
          session: null,
          profile: null,
          loading: false,
          mfaRequired: false,
          mfaPending: false,
          deviceFingerprint: null,
          autoLogoutWarning: false
        })

        // Clear secure storage
        secureStorage.clear()

        // Clear cart and favorites
        useCartStore.getState().clearCart()
        useFavoritesStore.getState().clearFavorites()

        // Send deletion confirmation email (non-blocking)
        try {
          if (profile?.email) {
            // Queue email before auth is fully cleared
            emailService.queueEmail({
              to: profile.email,
              toName: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'User',
              subject: '🗑️ تم حذف حسابك من قطوف',
              template: 'account_deletion',
              data: {
                name: profile.first_name || 'User',
                deletionDate: new Date().toLocaleDateString('ar-MA'),
              },
            })
          }
        } catch (emailErr) {
          logger.error('Account deletion email failed:', emailErr)
        }

        logger.info('Account deleted successfully for user:', user.id)
        return { success: true }
      } catch (error) {
        logger.error('Account deletion error:', error)
        toast.error(error.message || 'Failed to delete account')
        return { success: false, error: error.message }
      }
    }
  }
}
