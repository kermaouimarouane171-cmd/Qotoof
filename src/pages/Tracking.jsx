import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { USER_ROLES } from '@/constants/roles'
import { TruckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import AuthGate from '@/components/auth/AuthGate'
import ErrorBoundary from '@/components/ErrorBoundary'

const ROLE_DASHBOARD = {
  [USER_ROLES.VENDOR]: '/vendor/dashboard',
  [USER_ROLES.DRIVER]: '/driver/dashboard',
  [USER_ROLES.ADMIN]: '/admin/dashboard',
}

const Tracking = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user           = useAuthStore((s) => s.user)
  const profile        = useAuthStore((s) => s.profile)
  const loading        = useAuthStore((s) => s.loading)
  const profileLoading = useAuthStore((s) => s.profileLoading)
  const profileError   = useAuthStore((s) => s.profileError)

  const isBuyer = profile?.role === USER_ROLES.BUYER
  const isGuest = !user
  const role = profile?.role
  const authLoading = loading || (user && profileLoading)

  useEffect(() => {
    if (isGuest || authLoading || profileError) return
    if (isBuyer) {
      navigate('/buyer/orders', { replace: true })
    } else if (role && ROLE_DASHBOARD[role]) {
      navigate(ROLE_DASHBOARD[role], { replace: true })
    }
  }, [isGuest, isBuyer, role, navigate, authLoading, profileError])

  if (authLoading) {
    return (
      <div className="min-h-full bg-gradient-to-b from-green-50 via-white to-gray-50 dark:bg-gradient-to-b dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" dir="auto">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
        </div>
      </div>
    )
  }

  if (user && profileError) {
    const handleRetry = () => {
      useAuthStore.getState().refreshProfile?.().catch(() => {})
      window.location.reload()
    }
    return (
      <div className="min-h-full bg-gradient-to-b from-green-50 via-white to-gray-50 dark:bg-gradient-to-b dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" dir="auto">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {t('auth.profileError.title', 'Profile could not be loaded')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('auth.profileError.description', 'Your account was created but we could not load your profile. This may be a temporary issue. Please try again or log out and log back in.')}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700"
              onClick={handleRetry}
            >
              {t('auth.timeout.retry', 'Retry')}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
              onClick={() => useAuthStore.getState().signOut()}
            >
              {t('auth.logout', 'Log out')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isGuest) {
    return (
      <AuthGate
        variant="fullscreen"
        icon={TruckIcon}
        title={t('orderTracking.guest.title', 'Track Your Orders')}
        message={t('orderTracking.guest.message', 'Sign in to view your orders and track delivery status in real time')}
        from="/tracking"
        loginTo="/login"
        registerTo="/register"
        showRegister
      />
    )
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-green-50 via-white to-gray-50 dark:bg-gradient-to-b dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" dir="auto">
      <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
      </div>
    </div>
  )
}

const TrackingWithErrorBoundary = () => (
  <ErrorBoundary componentName="TrackingPage">
    <Tracking />
  </ErrorBoundary>
)

export default TrackingWithErrorBoundary
