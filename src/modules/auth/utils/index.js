// ============================================
// Auth Module — Utils Public API
// Re-exports auth-related utility functions.
// No files were moved — this is a re-export layer.
// ============================================

// Auth redirect utilities
export {
  DEFAULT_AUTH_REDIRECT,
  setPendingAuthRedirect,
  getPendingAuthRedirect,
  consumePendingAuthRedirect,
  clearPendingAuthRedirect,
  resolveSafeAuthRedirect,
} from '@/utils/authRedirects'
