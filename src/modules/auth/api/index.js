// ============================================
// Auth Module — API Public API
// Re-exports auth service functions and gateway.
// No files were moved — this is a re-export layer.
// ============================================

// Auth actions (signIn, signOut, signUp, verifyMFA, resetPassword, etc.)
export { createAuthActions } from '@/services/authActionsService'

// Auth services (MFA, sessions, auto-logout)
export { mfaService, sessionService, autoLogoutService } from '@/services/authServices'
export { default as authServices } from '@/services/authServices'

// Auth gateway (server-side rate-limited login)
export { signInWithServerRateLimit } from '@/services/authGateway'

// Auth admin operations
export { default as authAdminOps } from '@/services/authAdminOps'
