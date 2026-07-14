import { supabase } from '@/services/supabase'
import toast from 'react-hot-toast'
import { sessionService, autoLogoutService } from '@/modules/auth'
import { auditLogger } from '@/services/auditLogger'
import { useCartStore } from '@/modules/cart'
import { useFavoritesStore } from '@/modules/cart'
import { generateDeviceFingerprint, secureStorage, clearSupabaseLocalStorage } from '@/utils/encryption'
import { clearPendingAuthRedirect } from '@/utils/authRedirects'
import { logger } from '../utils/logger.js'
import queryClient from '@/services/queryClient'
import { USER_ROLES } from '@/constants/roles'

export const sessionInitialState = {
  mfaRequired: false,
  mfaPending: false,
  passwordRecoveryMode: false,
  deviceFingerprint: null,
  autoLogoutWarning: false,
  securityInitialized: false,
}

let autoLogoutWarningTimerId = null
const _inFlightReferralAttachments = new Set()

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

        // Register session only if profile exists (active_sessions has FK to profiles)
        if (profile && sessionService?.registerSession) {
          await sessionService.registerSession()
        } else if (!profile) {
          logger.warn('Skipping session registration — profile creation failed')
        }

        // Check if MFA is required using Supabase AAL
        let mfaRequired = false
        try {
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
          if (aalData && aalData.currentLevel !== aalData.nextLevel) {
            mfaRequired = true
          }
        } catch (aalErr) {
          logger.warn('AAL check failed during init:', aalErr?.message || aalErr)
        }

        if (mfaRequired) {
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
      let lastSessionUserId = null
      let hasHandledInitialSession = false

      const authListener = supabase.auth.onAuthStateChange(async (event, session) => {
        const now = Date.now()
        const sessionUserId = session?.user?.id ?? null

        // Skip duplicate events: same event type + same user within 2000ms window
        if (
          event === lastEvent &&
          sessionUserId === lastSessionUserId &&
          (now - lastEventTime) < 2000
        ) {
          logger.debug('Skipping duplicate auth event:', event, 'within dedup window')
          return
        }

        if (event === 'INITIAL_SESSION' && hasHandledInitialSession) {
          return
        }

        lastEvent = event
        lastEventTime = now
        lastSessionUserId = sessionUserId

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
              // If initialize() is still running, skip — it will set all state
              // and avoid concurrent supabase.auth.getUser() lock contention.
              if (!existingState.initialized && existingState.loading) {
                break
              }
              if (existingState.user && existingState.user.id === session.user?.id && (existingState.profile || existingState.profileError)) {
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

              // Check AAL to determine if MFA is required
              let mfaRequired = false
              try {
                const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
                if (aalData && aalData.currentLevel !== aalData.nextLevel) {
                  mfaRequired = true
                }
              } catch (aalErr) {
                logger.warn('AAL check failed in SIGNED_IN:', aalErr?.message || aalErr)
              }

              if (mfaRequired) {
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
            // Clear TanStack Query cache to prevent stale user-specific data
            // (orders, profile, notifications, etc.) from leaking to the next user
            queryClient.clear()
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
              // SECURITY: Check if the recovery link is expired
              // Supabase sets recovery_sent_at on the user object; if it's older
              // than 1 hour, the link may be stale and should be rejected.
              const recoverySentAt = session.user?.recovery_sent_at
                ? new Date(session.user.recovery_sent_at).getTime()
                : null
              const RECOVERY_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour

              if (recoverySentAt && (Date.now() - recoverySentAt) > RECOVERY_MAX_AGE_MS) {
                logger.warn('Password recovery link expired — ignoring PASSWORD_RECOVERY event')
                set({ passwordRecoveryMode: false, loading: false })
                break
              }

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
            // Clear TanStack Query cache (same reason as SIGNED_OUT)
            queryClient.clear()

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
    // FETCH USER PROFILE (with self-heal via ensure_profile RPC)
    // ============================================
    fetchProfile: async (userId) => {
      if (!userId) {
        set({ profile: null, profileLoading: false, profileError: true })
        return null
      }

      set({ profileLoading: true, profileError: false })

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

      // ── Step 1: Try to SELECT the profile ──────────────────────────────
      // Use maybeSingle() to avoid throwing when the row doesn't exist.
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

        if (data) {
          const resolvedProfile = data
          set({ profile: resolvedProfile, profileError: false, profileLoading: false })

          if (resolvedProfile.role === USER_ROLES.BUYER) {
            get()._attachBuyerReferralAsync(userId, resolvedProfile)
          }

          return resolvedProfile
        }
      } catch (error) {
        logger.error('Profile SELECT failed:', error)
        // Continue to self-heal below
      }

      // ── Step 2: Profile row is missing — try self-heal via RPC ─────────
      // Only try the RPC once (not 3 times). If it fails, move to direct INSERT.
      logger.info('Profile not found, attempting self-heal via ensure_profile RPC')

      const { data: rpcData, error: rpcError } = await supabase
        .rpc('ensure_profile')

      if (!rpcError && rpcData) {
        const healedProfile = rpcData
        set({ profile: healedProfile, profileError: false, profileLoading: false })

        if (healedProfile.role === USER_ROLES.BUYER) {
          get()._attachBuyerReferralAsync(userId, healedProfile)
        }

        return healedProfile
      }

      // ── Step 3: RPC failed — try direct INSERT as fallback ─────────────
      // This works if the RLS policy "profiles_insert_authenticated_self" exists.
      logger.warn('ensure_profile RPC failed, trying direct INSERT fallback. RPC error:', rpcError)

      try {
        const { data: authData } = await supabase.auth.getUser()
        const userMeta = authData?.user?.user_metadata || {}
        const { data: insertedProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: authData?.user?.email || '',
            first_name: userMeta.first_name || '',
            last_name: userMeta.last_name || '',
            phone: userMeta.phone || '',
            role: userMeta.role || 'buyer',
            onboarding_completed: false,
          })
          .select('*')
          .single()

        if (!insertError && insertedProfile) {
          set({ profile: insertedProfile, profileError: false, profileLoading: false })
          return insertedProfile
        }

        logger.error('Direct INSERT fallback also failed:', insertError)
      } catch (insertCatchError) {
        logger.error('Direct INSERT fallback threw:', insertCatchError)
      }

      // ── Step 4: All self-heal attempts failed ───────────────────────────
      // Set profileError so ProtectedRoute shows ProfileErrorFallback
      // instead of an infinite loading spinner.
      logger.error('All profile creation attempts failed — setting profileError')
      set({ profile: null, profileError: true, profileLoading: false })
      return null
    },

    _attachBuyerReferralAsync: async (userId, currentProfile) => {
      if (_inFlightReferralAttachments.has(userId)) return
      _inFlightReferralAttachments.add(userId)
      try {
        const { data: authUserData } = await supabase.auth.getUser()
        const pendingReferralCode = authUserData?.user?.id === userId
          ? authUserData.user.user_metadata?.referral_code_used
          : null

        if (pendingReferralCode && !currentProfile.referred_by) {
          const { default: loyaltyApi } = await import('@/modules/loyalty')
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
            set({ profile: refreshedProfile, profileError: false })
          }
        }
      } catch (referralError) {
        logger.warn('Automatic referral attachment skipped:', referralError)
      } finally {
        _inFlightReferralAttachments.delete(userId)
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
      if (role === USER_ROLES.BUYER && profile && profile.onboarding_completed === false) {
        return '/onboarding/buyer'
      }

      const paths = {
        admin: '/admin/dashboard',
        vendor: '/vendor/dashboard',
        buyer: '/marketplace',
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
