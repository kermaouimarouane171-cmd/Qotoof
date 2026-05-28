import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  getPayPalSetupBlockMessage,
  getPayPalSetupRoute,
  isPayPalSetupComplete,
  PAYPAL_REQUIRED_ROLES,
} from '@/utils/paypalEligibility'

const isBypassPath = (pathname, role) => {
  if (!pathname) return false
  if (pathname === '/login' || pathname === '/verify-phone') return true
  if (pathname.startsWith('/onboarding')) return true

  if (role === 'vendor') {
    return pathname === '/vendor/settings' || pathname === '/vendor/digital-contract'
  }

  if (role === 'driver') {
    return pathname === '/driver/settings'
  }

  return false
}

export const usePaymentGuard = () => {
  const location = useLocation()
  const profile = useAuthStore((state) => state.profile)

  return useMemo(() => {
    const role = profile?.role
    if (!role || !PAYPAL_REQUIRED_ROLES.has(role)) {
      return { shouldRedirect: false, redirectTo: null, message: null }
    }

    if (isBypassPath(location.pathname, role)) {
      return { shouldRedirect: false, redirectTo: null, message: null }
    }

    if (isPayPalSetupComplete(profile)) {
      return { shouldRedirect: false, redirectTo: null, message: null }
    }

    return {
      shouldRedirect: true,
      redirectTo: getPayPalSetupRoute(role),
      message: getPayPalSetupBlockMessage(),
    }
  }, [location.pathname, profile])
}
