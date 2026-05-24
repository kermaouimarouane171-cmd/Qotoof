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
    window.location.href = path
  }, 100)
}

const _redirectAfterAutoLogout = (set) => {
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
  _redirectToLogin('/login?reason=inactivity')
}

export function createSessionActions(set, get) {
  return {
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
                _redirectToLogin('/login?expired=true')
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
              _redirectToLogin('/login?expired=true')
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
          _redirectToLogin('/login?expired=true')
        }
        return null
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
