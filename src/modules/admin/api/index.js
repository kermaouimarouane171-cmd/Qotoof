/**
 * Admin Module — API Layer (re-export)
 *
 * Re-exports admin-related services from existing source files.
 * No behavior changes. No permission changes. No role-check changes.
 * All exports are additive re-exports from existing source files.
 */

// ── platformSettings from src/services/platformSettings.js ───────────────
// Admin platform settings: getSettings, updateSettings, invalidateSettingsCache,
// getSettingsAuditLog, subscribeToSettingsChanges
export { platformSettings } from '@/services/platformSettings'
export { default as platformSettingsDefault } from '@/services/platformSettings'
export {
  getSettings,
  updateSettings,
  invalidateSettingsCache,
  getSettingsAuditLog,
  subscribeToSettingsChanges,
} from '@/services/platformSettings'

// ── fraudReportService from src/services/fraudReportService.js ───────────
// Admin fraud report management: createFraudReport, listFraudReportsForAdmin,
// getFraudReportById, updateFraudReport, submitFraudReport
export { default as fraudReportService } from '@/services/fraudReportService'
export {
  FRAUD_REPORT_TYPES,
  FRAUD_STATUS_OPTIONS,
  FRAUD_PRIORITY_OPTIONS,
  getFraudEvidenceLinks,
  createFraudReport,
  listFraudReportsForAdmin,
  getFraudReportById,
  updateFraudReport,
  submitFraudReport,
} from '@/services/fraudReportService'

// ── disputeService from src/services/disputeService.js ───────────────────
// Admin dispute management: createDispute, openDispute, resolveDispute,
// releaseBuyerDataToVendor, applyDisputePenalty
export { default as disputeService } from '@/services/disputeService'
export {
  openDispute,
  releaseBuyerDataToVendor,
  applyDisputePenalty,
} from '@/services/disputeService'
