// ============================================
// Shared Module — Public API
//
// This is the single entry point for the shared module.
// All other modules should import only from here:
//
//   import { Button, Modal, useModal, formatPrice } from '@/modules/shared'
//
// Deep imports into this module are blocked by ESLint's
// no-restricted-imports rule (eslint.config.js).
//
// Phase 1.1 — Re-export layer only.
// No files have been moved. This module re-exports
// existing stable components, hooks, and utilities.
// ============================================

export * from './ui'
export * from './hooks'
export * from './utils'
