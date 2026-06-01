import { supabase } from '@/services/supabase'
import toast from 'react-hot-toast'
import { mfaService, sessionService, autoLogoutService } from '@/services/authServices'
import { auditLogger } from '@/services/auditLogger'
import { useCartStore } from '@/store/cartStore'
import { useFavoritesStore } from '@/store/favoritesStore'
import { generateDeviceFingerprint, secureStorage, clearSupabaseLocalStorage } from '@/utils/encryption'
import { clearPendingAuthRedirect } from '@/utils/authRedirects'
import { logger } from '../utils/logger.js'

export const sessionInitialState = {
  mfaRequired: false,
  mfaPending: false,
  passwordRecoveryMode: false,
  deviceFingerprint: null,
  autoLogoutWarning: false,
  securityInitialized: false,
}

let autoLogoutWarningTimerId = null

const _redirectToLogin = (path = '/login') => {
  // Use window.location.href to ensure full app reload and session clear
  setTimeout(() => {
    if (typeof window !== 'undefined' && /jsdom/i.test(window.navigator?.userAgent || '')) {
      return
    }

    try {
      if (typeof window?.location?.assign === 'function') {
        window.location.assign(path)
      } else {
        window.location.href = path
      }
    } catch (error) {
      logger.warn('Login redirect skipped in non-browser test environment', error)
    }
  }, 100)
}

const _redirectAfterAutoLogout = (set) => {
  set({
    user: null,
    session: null,
    profile: null,
    loading: false,
    profileLoading: false,
    profileError: false,
    isSigningIn: false,
    autoLogoutWarning: false
  })

  // Clear secure storage (sessionStorage)
  secureStorage.clear()

  // Clear Supabase auth tokens from localStorage
  clearSupabaseLocalStorage()

  toast.success('You have been logged out due to inactivity')
  _redirectToLogin('/login?reason=inactivity')
}

export function createSessionActions(set, get) {
  return {
    // ============================================
    // ENHANCED INITIALIZATION WITH SECURITY
    // ============================================
    initialize: async () => {
      if (get().initialized) return

      set({ loading: true, profileError: false })

      // Safety timeout: ensure loading is always resolved within 10 seconds
      const loadingTimeout = setTimeout(() => {
        if (get().loading) {
          logger.warn('Auth initialization timed out, forcing loading: false')
          set({ loading: false, profileLoading: false, securityInitialized: true, initialized: true })
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

        if (!session) {
          set({
            user: null,
            session: null,
            profile: null,
            loading: false,
            profileLoading: false,
            profileError: false,
            securityInitialized: true,
            initialized: true,
          })
          return
        }

        // Verify session is still valid before fetching profile
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          logger.warn('Session expired during initialization, clearing auth state')
          set({
            user: null,
            session: null,
            profile: null,
            loading: false,
            profileLoading: false,
            profileError: false,
            securityInitialized: true,
            initialized: true,
          })
          secureStorage.clear()
          clearSupabaseLocalStorage()
          return
        }

        const profile = await get().fetchProfile(user.id)

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
            profile: profile || null,
            loading: false,
            mfaRequired: true,
            mfaPending: true,
            securityInitialized: true,
            initialized: true,
          })
          return // Don't complete login until MFA verified
        }

        // Start auto logout monitoring
        get().startAutoLogout()

        set({
          user,
          session,
          profile: profile || null,
          loading: false,
          mfaRequired: false,
          mfaPending: false,
          securityInitialized: true,
          initialized: true,
        })

        // Log successful initialization only when profile is available
        if (profile) {
          await auditLogger.logAuthAction('AUTH_INITIALIZED', user.id, {
            deviceFingerprint,
            role: profile.role,
          })
        }
      } catch (error) {
        logger.error('Auth initialization error:', error)
        set({
          user: null,
          session: null,
          profile: null,
          loading: false,
          profileLoading: false,
          securityInitialized: true,
          initialized: true,
        })
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

      const authListener = supabase.auth.onAuthStateChange(async (event, session) => {
        const now = Date.now()

        // Skip duplicate events within 100ms window
        if (event === lastEvent && (now - lastEventTime) < 100) {
          return
        }

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
              if (existingState.isSigningIn) {
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

              set({ user, session, loading: false })

              // Generate device fingerprint (non-blocking)
              generateDeviceFingerprint().then(fp => set({ deviceFingerprint: fp })).catch(() => {})

              let profile = existingState.profile
              if (existingState.initialized && !profile) {
                profile = await get().fetchProfile(user.id)
              }

              const mfaSettings = mfaService?.getSettings ? await mfaService.getSettings() : null

              if (mfaSettings?.is_enabled) {
                set({ 
                  user, 
                  session, 
                  profile: profile || null,
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
                profile: profile || null,
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
            if (autoLogoutWarningTimerId) {
              clearTimeout(autoLogoutWarningTimerId)
              autoLogoutWarningTimerId = null
            }
            auditLogger.clearQueue()

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
              if (autoLogoutWarningTimerId) {
                clearTimeout(autoLogoutWarningTimerId)
                autoLogoutWarningTimerId = null
              }
              set({
                user: session.user,
                session,
                loading: false,
                profileLoading: false,
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
              profileLoading: false,
              profileError: false,
              isSigningIn: false,
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
      return () => {
        const maybeSubscription = authListener?.data?.subscription
        if (typeof maybeSubscription?.unsubscribe === 'function') {
          maybeSubscription.unsubscribe()
          return
        }

        if (typeof authListener?.unsubscribe === 'function') {
          authListener.unsubscribe()
        }
      }
    },

    // ============================================
    // FETCH USER PROFILE
    // ============================================
    fetchProfile: async (userId) => {
      if (!userId) {
        set({ profile: null, profileLoading: false, profileError: true })
        return null
      }

      set({ profileLoading: true, profileError: false })

      try {
        const profileQuery = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)

        const { data, error } = profileQuery?.maybeSingle
          ? await profileQuery.maybeSingle()
          : await profileQuery.single()

        if (error) {
          throw error
        }

        if (!data) {
          set({ profile: null, profileError: true })
          return null
        }

        let resolvedProfile = data

        if (resolvedProfile.role === 'buyer') {
          try {
            const { data: authUserData } = await supabase.auth.getUser()
            const pendingReferralCode = authUserData?.user?.id === userId
              ? authUserData.user.user_metadata?.referral_code_used
              : null

            if (pendingReferralCode && !resolvedProfile.referred_by) {
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
                resolvedProfile = refreshedProfile
              }
            }
          } catch (referralError) {
            logger.warn('Automatic referral attachment skipped:', referralError)
          }
        }

        set({ profile: resolvedProfile, profileError: false })
        return resolvedProfile
      } catch (error) {
        logger.error('Error fetching profile:', error)
        set({ profile: null, profileError: true })
        return null
      } finally {
        set({ profileLoading: false })
      }
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
    getRedirectPath: (role, profile = get().profile) => {
      if (role === 'buyer' && profile && profile.onboarding_completed === false) {
        return '/onboarding/buyer'
      }

      const paths = {
        admin: '/admin/dashboard',
        vendor: '/vendor/dashboard',
        buyer: '/buyer/dashboard',
        driver: '/driver/dashboard',
      }
      return paths[role] || '/marketplace'
    },

    // ============================================
    // START AUTO LOGOUT
    // ============================================
    startAutoLogout: () => {
      autoLogoutService.start(
        // Warning callback
        (remainingMs) => {
          if (autoLogoutWarningTimerId) {
            clearTimeout(autoLogoutWarningTimerId)
          }

          autoLogoutWarningTimerId = setTimeout(() => {
            set({ autoLogoutWarning: true })
            const remainingMinutes = Math.ceil(remainingMs / 60000)
            toast(`You will be logged out in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} due to inactivity`, {
              icon: '⚠️',
              duration: 10000
            })
          }, 0)
        },
        // Logout callback
        () => {
          if (autoLogoutWarningTimerId) {
            clearTimeout(autoLogoutWarningTimerId)
            autoLogoutWarningTimerId = null
          }
          _redirectAfterAutoLogout(set)
        }
      )
    },

    // ============================================
    // STOP AUTO LOGOUT
    // ============================================
    stopAutoLogout: () => {
      autoLogoutService.stop()
      if (autoLogoutWarningTimerId) {
        clearTimeout(autoLogoutWarningTimerId)
        autoLogoutWarningTimerId = null
      }
      set({ autoLogoutWarning: false })
    },
  }
}
