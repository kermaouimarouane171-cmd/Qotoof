// ============================================
// App Layer — Public API
//
// This is the single entry point for the app composition layer.
// Future modules and pages should import from here:
//
//   import { App, AppRouter, AppProviders } from '@/app'
//
// Phase 1.2 — Re-export layer only.
// No files have been moved. This module re-exports
// existing App, AppRouter, and provides a providers wrapper.
// ============================================

export { default as App } from './App'
export { AppRouter } from './AppRouter'
export { AppProviders, default as AppProvidersDefault } from './providers'
