// ============================================
// Auth Module — UI Public API
// Re-exports auth-related UI components.
// No files were moved — this is a re-export layer.
// ============================================

// ProtectedRoute and role-based layouts
export {
  ProtectedRoute,
  MainLayout,
  AdminLayout,
  VendorLayout,
  DriverLayout,
} from '@/components/ProtectedRoute'

// Auth-specific UI components
export { default as MFASetup } from '@/components/auth/MFASetup'
export { default as MFAVerify } from '@/components/auth/MFAVerify'
export { default as PhoneVerification } from '@/components/auth/PhoneVerification'
export { default as SessionManager } from '@/components/auth/SessionManager'

// TwoFactor (from features/auth)
export { default as TwoFactor } from '@/features/auth/components/TwoFactor'

// Auth layout
export { default as AuthLayout } from '@/layouts/AuthLayout'
