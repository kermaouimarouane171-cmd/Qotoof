// ============================================
// Users Module — Data Public API
// Re-exports data access helpers for profiles and public_profiles.
// No files were moved — this is a re-export layer.
// ============================================

// Public profile queries from api.js (vendor public profile reads)
// These are the functions that query the public_profiles view.
// Note: api.js is a large file with many concerns; only the
// profile-related parts are documented here as migration candidates.
// We do not re-export from api.js yet because it mixes concerns
// (vendors, products, reviews, etc.) and should be split first.

// Profile data access is currently handled by:
// - profilesService.ts (re-exported via api/)
// - authSessionStore.js fetchProfile (re-exported via auth module stores/)
// - Direct supabase queries in pages (Profile.jsx, buyer/Settings.jsx, etc.)

// This directory is a placeholder for future data layer extraction.
