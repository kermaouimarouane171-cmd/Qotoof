// ============================================
// Users Module — Stores Public API
// Re-exports user/profile-related Zustand stores if any exist.
// No files were moved — this is a re-export layer.
// ============================================

// Currently, profile state is managed inside authStore (authSessionStore.js).
// There is no separate user store. When a dedicated user store is created
// in a future phase, it will be re-exported from here.

// The auth store's profile-related actions are available via:
//   import { useAuthStore } from '@/modules/auth'
//   const { profile, fetchProfile, refreshProfile, updateProfile } = useAuthStore()
