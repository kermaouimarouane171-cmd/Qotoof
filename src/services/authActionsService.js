import { supabase } from '@/services/supabase'
import toast from 'react-hot-toast'
import { sessionService, autoLogoutService } from '@/modules/auth'
import { auditLogger } from '@/services/auditLogger'
import { emailService } from '@/services/emailService'
import { useCartStore } from '@/modules/cart'
import { useFavoritesStore } from '@/modules/cart'
import { generateDeviceFingerprint, secureStorage, clearSupabaseLocalStorage } from '@/utils/encryption'
import {
  DEFAULT_AUTH_REDIRECT,
  clearPendingAuthRedirect,
  consumePendingAuthRedirect,
  resolveSafeAuthRedirect,
  setPendingAuthRedirect,
} from '@/utils/authRedirects'
import { checkLoginRate, checkPasswordResetRate, checkSignupRate, enforceRateLimit, rateLimiter } from '@/utils/rateLimiter'
import { signInWithServerRateLimit } from '@/services/authGateway'
import { APP_CONFIG } from '@/config/appConfig'
import { logger } from '../utils/logger.js'
import { requireUser, unauthenticatedResponse } from '@/utils/authHelpers'

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
  // Prefer VITE_APP_URL for email-based redirect links (password reset, etc.)
  // because the link must be publicly accessible (opened from an email client,
  // possibly on a different device or after the dev server has stopped).
  if (typeof import.meta.env.VITE_APP_URL === 'string' && import.meta.env.VITE_APP_URL.trim()) {
    return import.meta.env.VITE_APP_URL.trim().replace(/\/$/, '')
  }

  // Fall back to window.location.origin for same-session redirects
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return String(APP_CONFIG.siteUrl || '').replace(/\/$/, '')
}

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
      const signInTimeout = setTimeout(() => {
        if (get().isSigningIn) {
          logger.warn('Sign-in timed out after 15s, forcing loading: false')
          set({ loading: false, isSigningIn: false })
        }
      }, 15000)

      try {
        set({ loading: true, isSigningIn: true, profileError: false })
        const _safeRedirect = setPendingAuthRedirect(preferredRedirect)

        // Check rate limit
        enforceRateLimit(checkLoginRate, email)

        const { user, session } = await signInWithServerRateLimit({
          email,
          password,
          captchaToken,
        })

        if (!user || !session) {
          // SECURITY: Failed login is logged server-side by the secure-login Edge Function.
          // Never expose specific error details to the client.
          throw new Error('Invalid login credentials')
        }

        // Run profile fetch in parallel to save time
        const profile = await get().fetchProfile(user.id)

        const deviceFingerprint = await generateDeviceFingerprint()
        set({ deviceFingerprint })

        // Check if MFA is required using Supabase AAL
        let mfaRequired = false
        try {
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
          if (aalData && aalData.currentLevel !== aalData.nextLevel) {
            mfaRequired = true
          }
        } catch (aalErr) {
          logger.warn('AAL check failed during signIn:', aalErr?.message || aalErr)
        }

        if (mfaRequired) {
          set({
            user,
            session,
            profile,
            loading: false,
            isSigningIn: false,
            mfaRequired: true,
            mfaPending: true,
            passwordRecoveryMode: false,
          })

          auditLogger.logAuthAction('MFA_REQUIRED', user.id).catch(() => {})

          clearTimeout(signInTimeout)
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
          isSigningIn: false,
          mfaRequired: false,
          mfaPending: false,
          passwordRecoveryMode: false,
        })

        // Clear previous failed login attempts for this email
        rateLimiter.reset(email, 'login')

        // Register session only if profile exists (active_sessions has FK to profiles)
        if (profile && sessionService?.registerSession) {
          await sessionService.registerSession()
        } else if (!profile) {
          logger.warn('Skipping session registration in signIn — profile creation failed')
        }

        // Sync locally saved guest favorites to the server after login
        if (user?.id) {
          try {
            await useFavoritesStore.getState().syncFavoritesToServer(user.id)
          } catch (syncError) {
            logger.error('Failed to sync guest favorites after login:', syncError)
          }
        }

        // Start auto logout (non-blocking)
        get().startAutoLogout()

        // Successful login is logged server-side by the secure-login Edge Function.

        const redirect = consumePendingAuthRedirect(
          get().getRedirectPath(profile?.role)
        )

        toast.success('Welcome back!')
        clearTimeout(signInTimeout)
        return { success: true, redirect }
      } catch (error) {
        clearTimeout(signInTimeout)
        set({ loading: false, isSigningIn: false })

        if (!preferredRedirect) {
          clearPendingAuthRedirect()
        }

        // SECURITY: Show generic error message to prevent user enumeration
        const genericError = 'Invalid email or password. Please try again.'
        const isRateLimited = error?.name === 'RateLimitError' ||
          error?.status === 429 ||
          error?.message?.toLowerCase?.().includes('too many') ||
          error?.message?.toLowerCase?.().includes('rate limit')

        const displayError = isRateLimited ? error.message : genericError

        if (isRateLimited) {
          toast.error(error.message) // Rate limit message is OK to show
        } else {
          toast.error(genericError)
        }

        return { success: false, error: displayError }
      }
    },

    // ============================================
    // VERIFY MFA CODE (Supabase MFA API)
    // ============================================
    verifyMFA: async (code) => {
      try {
        const { user } = get()
        if (!user) return unauthenticatedResponse()

        // List TOTP factors to find the one to verify
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
        if (factorsError) throw factorsError

        const totpFactors = factorsData?.totp || []
        if (totpFactors.length === 0) {
          return { success: false, error: 'No TOTP factors found' }
        }

        const factor = totpFactors[0]
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code,
        })

        if (verifyError) {
          return { success: false, error: verifyError.message || 'Invalid code' }
        }

        // Register session only if profile exists (active_sessions has FK to profiles)
        const currentProfile = get().profile
        if (currentProfile && sessionService?.registerSession) {
          await sessionService.registerSession()
        } else if (!currentProfile) {
          logger.warn('Skipping session registration in verifyMFA — profile missing')
        }

        // MFA verified - complete login (session is now aal2)
        set({
          mfaRequired: false,
          mfaPending: false,
          passwordRecoveryMode: false,
        })

        // Start auto logout
        get().startAutoLogout()

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
        // Stop auto logout
        autoLogoutService.stop()

        // Mark only the current tracked browser session as inactive.
        if (sessionService?.revokeCurrentSession) {
          await sessionService.revokeCurrentSession()
        }

        // SIGNED_OUT is logged server-side by the sign-out Edge Function.
        // Falls back to direct signOut if the Edge Function call fails.
        try {
          await supabase.functions.invoke('sign-out', {})
        } catch (edgeFnErr) {
          logger.error('sign-out Edge Function call failed, falling back to direct signOut:', edgeFnErr)
        }

        const { error } = await supabase.auth.signOut()
        if (error) throw error

        set({
          user: null,
          session: null,
          profile: null,
          loading: false,
          profileLoading: false,
          profileError: false,
          isSigningIn: false,
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
    // SIGN UP (OTP-based email verification)
    // ============================================
    signUp: async (email, password, userData, captchaToken = null) => {
      try {
        set({ loading: true, isSigningIn: true, profileError: false })
        const normalizedEmail = String(email || '').trim().toLowerCase()

        enforceRateLimit(checkSignupRate, normalizedEmail)

        const signUpOptions = {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            role: userData.role,
            phone: userData.phone || null,
            cin: userData.cin || null,
            referral_code_used: userData.referralCode || null,
          },
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

          // Add vendor-specific fields
          // store_type is intentionally omitted; the DB trigger apply_vendor_store_defaults
          // defaults new vendors to 'small' and derives the correct delivery_option.
          if (userData.role === 'vendor') {
            profileData.store_name = userData.storeName || null
            profileData.city = userData.city || null
          }

          // Add buyer-specific fields
          if (userData.role === 'buyer') {
            profileData.address = userData.deliveryAddress || null
            profileData.city = userData.city || null
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
              isSigningIn: false,
              mfaRequired: false,
              mfaPending: false,
              passwordRecoveryMode: false,
            })

            // Register session only if profile exists (active_sessions has FK to profiles)
            if (profile && sessionService?.registerSession) {
              await sessionService.registerSession()
            } else if (!profile) {
              logger.warn('Skipping session registration in signUp — profile creation failed')
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
          set({ loading: false, isSigningIn: false })
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

        set({ loading: false, isSigningIn: false })
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
        set({ loading: false, isSigningIn: false })

        if (isAlreadyRegisteredAuthError(error)) {
          const normalizedEmail = String(email || '').trim().toLowerCase()

          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: normalizedEmail,
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
          redirectTo: `${resolvePublicAppOrigin()}/reset-password`
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
    updatePassword: async (newPassword, currentPassword = null) => {
      try {
        const isRecoveryMode = get().passwordRecoveryMode
        const payload = { password: newPassword }

        // In recovery mode (forgot password flow), currentPassword is not required
        // because the user already proved identity via the email reset link.
        if (!isRecoveryMode) {
          if (!currentPassword) {
            throw new Error('Current password is required')
          }
          payload.currentPassword = currentPassword
        }

        // PASSWORD_UPDATED is logged server-side by the change-password Edge Function.
        const { data, error } = await supabase.functions.invoke('change-password', {
          body: { ...payload, recoveryMode: isRecoveryMode },
        })

        if (error) throw error
        if (!data?.success) {
          throw new Error(data?.error || 'Failed to update password')
        }

        // SECURITY: Revoke all other sessions after password change
        try {
          if (sessionService?.revokeAllOtherSessions) {
            await sessionService.revokeAllOtherSessions()
          }
        } catch (sessionErr) {
          logger.error('Failed to revoke sessions after password change:', sessionErr)
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
        requireUser(user)

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
        requireUser(user)

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
        requireUser(user)

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
      try {
        const { data: factorsData, error } = await supabase.auth.mfa.listFactors()
        if (error) throw error
        const totpFactors = factorsData?.totp || []
        if (totpFactors.length === 0) return null
        return {
          is_enabled: true,
          method: 'totp',
          factors: totpFactors,
        }
      } catch (err) {
        logger.error('getMFASettings error:', err)
        return null
      }
    },

    getActiveSessions: async () => {
      if (!sessionService?.getActiveSessions) return []
      return await sessionService.getActiveSessions()
    },

    disableMFA: async () => {
      try {
        const { data: factorsData, error: listError } = await supabase.auth.mfa.listFactors()
        if (listError) throw listError

        const totpFactors = factorsData?.totp || []
        if (totpFactors.length === 0) {
          return { success: false, error: 'No MFA factors found' }
        }

        for (const factor of totpFactors) {
          const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
          if (unenrollError) throw unenrollError
        }

        return { success: true }
      } catch (err) {
        logger.error('Disable MFA error:', err)
        return { success: false, error: err.message }
      }
    },

    enableMFA: async () => {
      return { success: true }
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
        requireUser(user)

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
          profileLoading: false,
          profileError: false,
          isSigningIn: false,
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
