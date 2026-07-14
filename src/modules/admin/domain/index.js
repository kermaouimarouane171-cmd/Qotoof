/**
 * Admin Module — Domain Layer (re-export)
 *
 * Placeholder: admin is a composition/control surface, not a domain owner.
 * Admin does not own business logic — it composes screens from other modules.
 *
 * Admin domain concepts (owned by other modules):
 *   - User roles & permissions: owned by auth module (USER_ROLES in src/constants/roles.js)
 *   - User profiles: owned by users module
 *   - Product moderation: owned by catalog module (admin composes moderation UI)
 *   - Order lifecycle: owned by orders module (admin views/manages via UI)
 *   - Payment behavior: owned by payments module (admin views payment status)
 *   - Commission calculations: owned by commissions module (admin manages via UI)
 *   - Delivery lifecycle: owned by delivery module (admin views/manages drivers)
 *   - Analytics/KPIs: owned by analytics module (admin composes dashboard widgets)
 *   - Notifications: owned by notifications module (admin views support tickets)
 *
 * Admin-specific domain concepts:
 *   - Platform settings (commission rate, platform fee, etc.) — managed via platformSettings service
 *   - Fraud reports — managed via fraudReportService
 *   - Disputes — managed via disputeService
 *   - Circuit breaker monitoring — admin-only monitoring page
 *   - IP blocking/security — admin-only security page
 *   - Settings audit log — admin-only audit trail
 *
 * These are re-exported from the api layer. No domain-specific exports here yet.
 */
