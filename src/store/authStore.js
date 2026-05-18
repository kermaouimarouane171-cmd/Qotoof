import { create } from 'zustand'
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

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  session: null,
  loading: true,
  _signingInProgress: false, // prevents auth listener from duplicating work during manual sign-in/sign-up
  
  // Enhanced security state
  mfaRequired: false,
  mfaPending: false,
  passwordRecoveryMode: false,
  deviceFingerprint: null,
  autoLogoutWarning: false,
  securityInitialized: false,

  // ============================================
  // ENHANCED INITIALIZATION WITH SECURITY
  // ============================================
  initialize: async () => {
    // Safety timeout: ensure loading is always resolved within 10 seconds
    const loadingTimeout = setTimeout(() => {
      if (get().loading) {
        logger.warn('Auth initialization timed out, forcing loading: false')
        set({ loading: false, securityInitialized: true })
      }
    }, 10000)

    try {
      let session = null
      try {
        const { data } = await supabase.auth.getSession()
        session = data?.session
      } catch (lockError) {
        // Ignore lock acquisition timeouts - another request has the lock
        if (lockError.message?.includes('Lock') || lockError.message?.includes('was released')) {
          logger.debug('Lock conflict during init, continuing without session')
          session = null
        } else {
          throw lockError
        }
      }

      if (session) {
        // Verify session is still valid before fetching profile
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          logger.warn('Session expired during initialization, clearing auth state')
          set({ user: null, session: null, profile: null, loading: false })
          secureStorage.clear()
          clearSupabaseLocalStorage()
          return
        }

        const profile = await get().fetchProfile(user.id)

        // Only set state if profile fetch succeeded
        if (profile) {
          // Generate device fingerprint
          const deviceFingerprint = await generateDeviceFingerprint()
          set({ deviceFingerprint })

          // Register session (with safety check)
          if (sessionService?.registerSession) {
            await sessionService.registerSession()
          }

          // Check if MFA is required
          let mfaSettings = null
          if (mfaService?.getSettings) {
            mfaSettings = await mfaService.getSettings()
          }
          if (mfaSettings?.is_enabled) {
            set({ 
              user,
              session,
              profile,
              loading: false,
              mfaRequired: true,
              mfaPending: true,
              securityInitialized: true
            })
            return // Don't complete login until MFA verified
          }

          // Start auto logout monitoring
          get().startAutoLogout()

          set({
            user,
            session,
            profile,
            loading: false,
            mfaRequired: false,
            mfaPending: false,
            securityInitialized: true
          })

          // Log successful initialization
          await auditLogger.logAuthAction('AUTH_INITIALIZED', user.id, {
            deviceFingerprint,
            role: profile.role
          })
        } else {
          // Profile fetch failed, user needs to re-login
          logger.warn('Profile fetch failed during initialization')
          set({ user: null, session: null, profile: null, loading: false })
        }
      } else {
        set({ loading: false, securityInitialized: true })
      }
    } catch (error) {
      logger.error('Auth initialization error:', error)
      set({ user: null, session: null, profile: null, loading: false, securityInitialized: true })
    } finally {
      clearTimeout(loadingTimeout)
    }
  },

  // ============================================
  // ENHANCED AUTH STATE CHANGE LISTENER
  // ============================================
  setupAuthListener: () => {
    let lastEvent = null
    let lastEventTime = 0
    let hasHandledInitialSession = false

    const { unsubscribe } = supabase.auth.onAuthStateChange(async (event, session) => {
      const now = Date.now()

      // Skip duplicate events within 100ms window
      if (event === lastEvent && (now - lastEventTime) < 100) {
        return
      }

      // Skip INITIAL_SESSION if already handled during initialization
      if (event === 'INITIAL_SESSION' && hasHandledInitialSession) {
        return
      }

      lastEvent = event
      lastEventTime = now

      // Mark INITIAL_SESSION as handled
      if (event === 'INITIAL_SESSION') {
        hasHandledInitialSession = true
      }

      logger.log('Auth event:', event)

      switch (event) {
        case 'SIGNED_IN':
          if (session) {
            // If signIn()/signUp() is currently in progress, skip — they handle everything.
            // Also skip if user + profile are already loaded (e.g. after initialize()).
            const existingState = get()
            if (existingState._signingInProgress) {
              break
            }
            if (existingState.user && existingState.user.id === session.user?.id && existingState.profile) {
              // Already handled by signIn() — just refresh device fingerprint silently
              generateDeviceFingerprint().then(fp => set({ deviceFingerprint: fp })).catch(() => {})
              break
            }

            // Guard against invalid session
            if (!session.user) {
              logger.warn('SIGNED_IN event but session has no user')
              break
            }

            const user = session.user

            // Generate device fingerprint (non-blocking)
            generateDeviceFingerprint().then(fp => set({ deviceFingerprint: fp })).catch(() => {})

            // Fetch profile and MFA in parallel
            const [profile, mfaSettings] = await Promise.all([
              get().fetchProfile(user.id),
              mfaService?.getSettings ? mfaService.getSettings() : Promise.resolve(null),
            ])

            if (!profile) break

            if (mfaSettings?.is_enabled) {
              set({ 
                user, 
                session, 
                profile, 
                loading: false,
                mfaRequired: true,
                mfaPending: true,
                passwordRecoveryMode: false,
              })
              break
            }

            // Start auto logout
            get().startAutoLogout()

            set({ 
              user, 
              session, 
              profile, 
              loading: false,
              mfaRequired: false,
              mfaPending: false,
              passwordRecoveryMode: false,
            })
          }
          break

        case 'SIGNED_OUT':
          // Stop auto logout
          autoLogoutService.stop()
          auditLogger.clearQueue()

          set({
            user: null,
            session: null,
            profile: null,
            loading: false,
            mfaRequired: false,
            mfaPending: false,
            passwordRecoveryMode: false,
            deviceFingerprint: null
          })

          // Clear secure storage (sessionStorage)
          secureStorage.clear()
          clearPendingAuthRedirect()

          // Clear Supabase auth tokens from localStorage
          clearSupabaseLocalStorage()

          // Clear persisted cart/favorites to prevent cross-user data leak
          useCartStore.setState({ items: [], lastValidated: null, checkoutVendorId: null })
          useFavoritesStore.setState({ favorites: [], favoriteIds: new Set(), userId: null, error: null })
          break

        case 'TOKEN_REFRESHED':
          if (session) {
            set({ session })
            // Update session activity
            if (sessionService?.updateSessionActivity) {
              await sessionService.updateSessionActivity()
            }
          }
          break

        case 'USER_UPDATED':
          if (session) {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const profile = await get().fetchProfile(user.id)
              if (profile) {
                set({ user, session, profile })
              }
            }
          }
          break

        case 'INITIAL_SESSION':
          // Already handled by initialize(), just mark as handled
          break

        case 'PASSWORD_RECOVERY':
          if (session?.user) {
            autoLogoutService.stop()
            set({
              user: session.user,
              session,
              loading: false,
              mfaRequired: false,
              mfaPending: false,
              passwordRecoveryMode: true,
            })
          }
          break

        case 'TOKEN_REFRESH_FAILED':
          // Could not refresh token — session is expired/invalid
          logger.warn('Token refresh failed — clearing auth state')
          set({
            user: null,
            session: null,
            profile: null,
            loading: false,
            passwordRecoveryMode: false,
          })
          clearPendingAuthRedirect()

          // Clear persisted cart/favorites to prevent cross-user data leak
          useCartStore.setState({ items: [], lastValidated: null, checkoutVendorId: null })
          useFavoritesStore.setState({ favorites: [], favoriteIds: new Set(), userId: null, error: null })

          // Navigate to login without a full page reload — React Router handles it
          window.dispatchEvent(new CustomEvent('auth:sessionExpired'))
          break
      }
    })

    // Store unsubscribe function for cleanup
    return unsubscribe
  },

  // ============================================
  // FETCH USER PROFILE (enhanced with JWT handling)
  // ============================================
  fetchProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // Handle JWT expiration specifically (catches all JWT error variants)
        if (error.message?.includes('JWT') || error.message?.includes('jwt') || error.message?.includes('bad_jwt') || error.code === 'PGRST303') {
          logger.warn('Profile fetch failed due to JWT error, triggering session refresh')
          // Try to refresh the session
          try {
            const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError || !session) {
              // Session refresh failed, clear auth state and redirect to login
              logger.warn('Session refresh failed, redirecting to login')
              set({ user: null, session: null, profile: null, loading: false })
              secureStorage.clear()
              clearSupabaseLocalStorage()
              get()._redirectToLogin('/login?expired=true')
              return null
            }
            // Retry fetching profile with new session
            const { data: retryData, error: retryError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single()

            if (retryError) {
              logger.error('Profile fetch failed after session refresh:', retryError)
              throw retryError
            }
            return retryData
          } catch (refreshError) {
            logger.error('Session refresh failed during profile fetch:', refreshError)
            set({ user: null, session: null, profile: null, loading: false })
            secureStorage.clear()
            clearSupabaseLocalStorage()
            get()._redirectToLogin('/login?expired=true')
            return null
          }
        }
        throw error
      }

      if (data && data.role === 'buyer') {
        try {
          const { data: authUserData } = await supabase.auth.getUser()
          const pendingReferralCode = authUserData?.user?.id === userId
            ? authUserData.user.user_metadata?.referral_code_used
            : null

          if (pendingReferralCode && !data.referred_by) {
            const { default: loyaltyApi } = await import('@/services/loyalty')
            await loyaltyApi.attachReferralCode({
              userId,
              referralCode: pendingReferralCode,
            })

            const { data: refreshedProfile, error: refreshedProfileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single()

            if (!refreshedProfileError && refreshedProfile) {
              return refreshedProfile
            }
          }
        } catch (referralError) {
          logger.warn('Automatic referral attachment skipped:', referralError)
        }
      }

      return data
    } catch (error) {
      logger.error('Error fetching profile:', error)
      // If it's a JWT error, redirect to login
      if (error.message?.includes('JWT') || error.message?.includes('jwt') || error.message?.includes('bad_jwt') || error.code === 'PGRST303') {
        logger.warn('Redirecting to login due to JWT expiration')
        set({ user: null, session: null, profile: null, loading: false })
        get()._redirectToLogin('/login?expired=true')
      }
      return null
    }
  },

  // ============================================
  // REDIRECT TO LOGIN (unified helper)
  // ============================================
  _redirectToLogin: (path = '/login') => {
    // Use window.location.href to ensure full app reload and session clear
    setTimeout(() => {
      window.location.href = path
    }, 100)
  },

  // ============================================
  // REDIRECT AFTER AUTO LOGOUT (inactivity)
  // ============================================
  _redirectAfterAutoLogout: () => {
    set({
      user: null,
      session: null,
      profile: null,
      loading: false,
      autoLogoutWarning: false
    })

    // Clear secure storage (sessionStorage)
    secureStorage.clear()

    // Clear Supabase auth tokens from localStorage
    clearSupabaseLocalStorage()

    toast.success('You have been logged out due to inactivity')
    get()._redirectToLogin('/login?reason=inactivity')
  },

  // ============================================
  // REFRESH PROFILE (fetch latest from server)
  // ============================================
  refreshProfile: async () => {
    try {
      const { user } = get()
      if (!user) {
        logger.warn('refreshProfile called but no user is logged in')
        return null
      }

      const profile = await get().fetchProfile(user.id)

      if (profile) {
        set({ profile })
        logger.debug('Profile refreshed successfully')
        return profile
      }

      logger.warn('refreshProfile returned null — profile may not exist')
      return null
    } catch (error) {
      logger.error('refreshProfile error:', error)
      return null
    }
  },

  // ============================================
  // GET REDIRECT PATH (unchanged)
  // ============================================
  getRedirectPath: (role) => {
    const paths = {
      admin: '/admin/dashboard',
      vendor: '/vendor/dashboard',
      buyer: '/buyer/orders',
      driver: '/driver/dashboard',
    }
    return paths[role] || '/marketplace'
  },

  // ============================================
  // ENHANCED SIGN IN WITH RATE LIMITING & MFA
  // ============================================
  signIn: async (email, password, captchaToken = null, preferredRedirect = null) => {
    try {
      set({ loading: true, _signingInProgress: true })
      const safeRedirect = setPendingAuthRedirect(preferredRedirect)

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
  // START AUTO LOGOUT
  // ============================================
  startAutoLogout: () => {
    autoLogoutService.start(
      // Warning callback
      (remainingMs) => {
        set({ autoLogoutWarning: true })
        const remainingMinutes = Math.ceil(remainingMs / 60000)
        toast(`You will be logged out in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} due to inactivity`, {
          icon: '⚠️',
          duration: 10000
        })
      },
      // Logout callback
      () => {
        get()._redirectAfterAutoLogout()
      }
    )
  },

  // ============================================
  // STOP AUTO LOGOUT
  // ============================================
  stopAutoLogout: () => {
    autoLogoutService.stop()
    set({ autoLogoutWarning: false })
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
      const signUpOptions = {
        data: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          role: userData.role,
          referral_code_used: userData.referralCode || null,
        }
      }

      if (captchaToken) {
        signUpOptions.captchaToken = captchaToken
      }

      const { data, error } = await supabase.auth.signUp({
        email,
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
          .insert(profileData)

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
}))
