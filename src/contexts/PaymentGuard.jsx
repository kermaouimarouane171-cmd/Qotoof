import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { USER_ROLES } from '@/constants/roles'
import {
  getPayPalSetupBlockMessage,
  getPayPalSetupRoute,
  isPayPalSetupComplete,
  PAYPAL_REQUIRED_ROLES,
} from '@/modules/payments'

const isBypassPath = (pathname, role) => {
  if (!pathname) return false
  if (pathname === '/login' || pathname === '/verify-phone') return true
  if (pathname.startsWith('/onboarding')) return true

  if (role === USER_ROLES.VENDOR) {
    return pathname === '/vendor/settings' || pathname === '/vendor/digital-contract'
  }

  if (role === USER_ROLES.DRIVER) {
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
