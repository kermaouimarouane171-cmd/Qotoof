# Phase 3.4 — Notifications / Preferences / Support Preparation Report

**Phase:** 3.4 — Notifications / Preferences / Support Preparation before Phase 4  
**Date:** 2026-06-23  
**Status:** ✅ Completed  
**Approach:** Additive-first, behavior-preserving extraction and documentation

---

## 1. Confirmation: `.windsurfrules` Read and Followed

✅ `.windsurfrules` was read in full (614 lines, sections 0–45) and strictly followed throughout this phase.

Key rules respected:

- ✅ **Rule 1 (Minimal changes):** Only additive changes — 2 new files created, existing files modified with backward-compatible imports/re-exports. No files moved. No files deleted.
- ✅ **Rule 30 (Stop and ask):** No Supabase/RLS/Auth/Database/Payments/migrations touched.
- ✅ **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — not needed.
- ✅ **No business logic changes.** All functions retain identical behavior.
- ✅ **No Supabase queries changed.** All query functions are unchanged.
- ✅ **No routes changed.**
- ✅ **No circular dependencies** introduced (verified by `madge`).
- ✅ **No mass import rewriting.** All existing imports continue to work via backward-compatible re-exports.
- ✅ **Rule 24 (Documentation):** Only the required report file created. Existing docs updated, not duplicated.
- ✅ **Rule 21 (Build/Lint):** Commands run for verification after each change and at the end.

---

## 2. What Was Inspected

### Source Files Inspected (Read-Only Before Changes)

| File | Lines | Purpose |
|---|---|---|
| `src/services/notifications.js` | 669 | Core notification service — mixes delivery, preferences, formatting, events |
| `src/hooks/queries/useNotificationQueries.js` | 247 | React Query hooks — mixes notification hooks with support ticket hooks |
| `src/services/commissionNotifications.js` | 111 | Commission-specific notification triggers |
| `src/modules/notifications/api/index.js` | 47 | Notifications module API re-exports |
| `src/modules/notifications/hooks/index.js` | 23 | Notifications module hooks re-exports |
| `src/modules/notifications/domain/index.js` | 36 | Notifications module domain re-exports |
| `src/modules/notifications/utils/index.js` | 19 | Notifications module utils re-exports |
| `src/modules/notifications/index.js` | 86 | Notifications module public API entry point |
| `src/modules/users/api/index.js` | 23 | Users module API re-exports (includes preference helpers) |
| `src/hooks/queries/index.js` | 119 | Barrel export for all query hooks |

### Importers Identified

**Importers of preference helpers (`DEFAULT_NOTIFICATION_PREFERENCES`, `NOTIFICATION_CATEGORY_OPTIONS`, `NOTIFICATION_PREFERENCE_FIELDS`, `normalizeNotificationPreferences`):**
- `src/services/notifications.js` — defines and uses internally
- `src/components/notifications/NotificationLink.jsx` — imports from `@/services/notifications`
- `src/pages/Notifications.jsx` — imports from `@/services/notifications`
- `src/__tests__/services/notifications.test.js` — imports from `@/services/notifications`
- `src/modules/notifications/api/index.js` — re-exports from `@/services/notifications`
- `src/modules/notifications/domain/index.js` — re-exports from `@/services/notifications`
- `src/modules/notifications/index.js` — re-exports from `./api` and `./domain`
- `src/modules/users/api/index.js` — re-exports from `@/services/notifications`

**Importers of support ticket hooks (`useSupportTickets`, `useSupportTicket`, `useCreateTicket`, `useReplyToTicket`, `supportKeys`):**
- `src/hooks/queries/useNotificationQueries.js` — defines and exports
- `src/hooks/queries/index.js` — re-exports from `useNotificationQueries`

**Importers of `commissionNotifications`:**
- `src/services/commissionService.js` — imports and uses `commissionNotifications`
- `src/modules/notifications/api/index.js` — re-exports
- `src/modules/notifications/index.js` — re-exports from `./api`

---

## 3. What Was Changed

### H1 — Notification Preferences Extraction (✅ Fixed)

**Problem:** `notifications.js` (669 lines) mixed notification delivery/read/realtime behavior with user-owned notification preference management.

**Solution:** Created `src/services/notificationPreferences.js` with all preference-specific code extracted from `notifications.js`.

**What moved to `notificationPreferences.js`:**
- `DEFAULT_NOTIFICATION_PREFERENCES` — preference defaults constant
- `NOTIFICATION_CATEGORY_OPTIONS` — category options for preference UI
- `NOTIFICATION_PREFERENCE_FIELDS` — preference fields for preference UI
- `NOTIFICATION_CATEGORY_ALIASES` — category alias mapping (shared canonical source)
- `NOTIFICATION_PREFERENCE_BY_CATEGORY` — category → preference key mapping
- `NOTIFICATION_PREFERENCES_EVENT` — event name constant
- `sanitizeTimeValue` — time helper (used only by `normalizeNotificationPreferences`)
- `toMinutes` — time helper (used only by `isWithinQuietHours`)
- `normalizeNotificationCategory` — category normalization (shared, but canonical source is now here)
- `getNotificationPreferenceKey` — preference key resolver
- `normalizeNotificationPreferences` — preference normalization
- `isWithinQuietHours` — quiet hours check
- `shouldMuteNotificationPreview` — preview mute check
- `dispatchNotificationPreferencesUpdated` — preference event dispatcher

**What stayed in `notifications.js`:**
- `notificationsApi` (all methods including `getPreferences` and `savePreferences` — they use imported `normalizeNotificationPreferences` and `dispatchNotificationPreferencesUpdated`)
- `normalizeNotification` — notification formatting
- `isNotificationRead` — read status check
- `resolveNotificationLink` — link resolver
- `resolveNotificationActionLabel` — action label resolver
- `buildNotificationInsertPayload` — payload builder
- `dispatchNotificationBadgeUpdate` — badge event dispatcher
- `notificationEvents` — event constants object
- `createOrderNotification` — order notification templates
- `createProductApprovalNotification` — product approval notification
- `NOTIFICATION_BADGE_EVENT` — badge event constant

**Backward compatibility:**
- `notifications.js` imports all extracted code from `notificationPreferences.js` and re-exports it
- All existing imports from `@/services/notifications` continue to work unchanged
- No circular dependency: `notificationPreferences.js` does not import from `notifications.js`

**Module re-export updates:**
- `src/modules/users/api/index.js` — now re-exports preference constants from `@/services/notificationPreferences` (canonical source), and `notificationsApi` from `@/services/notifications`
- `src/modules/notifications/api/index.js` — now re-exports preference constants from `@/services/notificationPreferences`
- `src/modules/notifications/domain/index.js` — now re-exports preference constants from `@/services/notificationPreferences`

### H2 — Support Ticket Hooks Split (✅ Fixed)

**Problem:** `useNotificationQueries.js` (247 lines) mixed notification hooks with support ticket hooks (`useSupportTickets`, `useSupportTicket`, `useCreateTicket`, `useReplyToTicket`, `supportKeys`).

**Solution:** Created `src/hooks/queries/useSupportTicketQueries.js` with all support ticket hooks extracted from `useNotificationQueries.js`.

**What moved to `useSupportTicketQueries.js`:**
- `supportKeys` — query key factory
- `useSupportTickets` — list support tickets
- `useSupportTicket` — get single support ticket
- `useCreateTicket` — create support ticket mutation
- `useReplyToTicket` — reply to support ticket mutation

**Backward compatibility:**
- `useNotificationQueries.js` re-exports all support ticket hooks from `useSupportTicketQueries.js`
- `src/hooks/queries/index.js` barrel export updated to import support hooks from `useSupportTicketQueries.js` directly
- All existing imports from `@/hooks/queries/useNotificationQueries` and `@/hooks/queries` continue to work unchanged

**Notifications module:**
- `src/modules/notifications/hooks/index.js` was NOT changed — it already does NOT re-export support ticket hooks (this was correct in Phase 3.3)

### H3 — Commission Notifications Documentation (✅ Documented)

**Problem:** `commissionNotifications.js` is re-exported from the notifications module but is primarily a commission concern.

**Solution:** Documented the migration plan in `src/modules/notifications/README.md` without moving the file.

**Documentation added:**
- `commissionNotifications.js` is temporarily re-exported from notifications for backward compatibility
- Long-term owner should be future `src/modules/commissions`
- Notifications should own notification delivery/storage/display, not commission business rules
- Migration plan with 4 steps (Phase 4: create commissions module and re-export from there; Phase 5: move file if appropriate)

---

## 4. Files Created

| File | Lines | Purpose |
|---|---|---|
| `src/services/notificationPreferences.js` | 152 | Notification preference constants and helpers (extracted from `notifications.js`) |
| `src/hooks/queries/useSupportTicketQueries.js` | 107 | Support ticket React Query hooks (extracted from `useNotificationQueries.js`) |

---

## 5. Files Modified

| File | Changes |
|---|---|
| `src/services/notifications.js` | Replaced locally-defined preference code with imports from `notificationPreferences.js`; re-exports for backward compatibility |
| `src/hooks/queries/useNotificationQueries.js` | Removed support ticket hook definitions; added re-exports from `useSupportTicketQueries.js` |
| `src/hooks/queries/index.js` | Updated barrel export to source support hooks from `useSupportTicketQueries.js` |
| `src/modules/users/api/index.js` | Updated to re-export preference constants from `notificationPreferences.js` |
| `src/modules/notifications/api/index.js` | Updated to re-export preference constants from `notificationPreferences.js` |
| `src/modules/notifications/domain/index.js` | Updated to re-export preference constants from `notificationPreferences.js` |
| `src/modules/notifications/README.md` | Updated with Phase 3.4 changes (H1, H2, H3 documentation) |
| `src/modules/users/README.md` | Updated to note preference helpers extraction |
| `MODULAR_DEVELOPMENT_PLAN.md` | Added Phase 3.4 completion note; updated status line |
| `ARCHITECTURE_GUIDE.md` | Added Phase 3.4 completion status |
| `DEVELOPER_GUIDE.md` | Updated notifications module description with Phase 3.4 notes |

---

## 6. Imports Changed

**No existing imports were changed.** All existing import paths continue to work:

- `import { ... } from '@/services/notifications'` — still works (re-exports from `notificationPreferences.js`)
- `import { ... } from '@/hooks/queries/useNotificationQueries'` — still works (re-exports from `useSupportTicketQueries.js`)
- `import { ... } from '@/hooks/queries'` — still works (barrel export updated)

**New import paths available (but not required):**
- `import { ... } from '@/services/notificationPreferences'` — canonical source for preference helpers
- `import { ... } from '@/hooks/queries/useSupportTicketQueries'` — canonical source for support ticket hooks

---

## 7. Behavior Preservation

| Check | Status | Details |
|---|---|---|
| Notification behavior preserved | ✅ | `notificationsApi` methods unchanged — same Supabase queries, same `withRetry` wrappers, same return values |
| Notification preference behavior preserved | ✅ | `normalizeNotificationPreferences`, `isWithinQuietHours`, `shouldMuteNotificationPreview` — identical logic, just moved to new file |
| `notificationsApi.getPreferences` behavior preserved | ✅ | Still in `notifications.js`, uses imported `normalizeNotificationPreferences` — same Supabase query on `notification_preferences` table |
| `notificationsApi.savePreferences` behavior preserved | ✅ | Still in `notifications.js`, uses imported `normalizeNotificationPreferences` and `dispatchNotificationPreferencesUpdated` — same Supabase upsert on `notification_preferences` table |
| Support ticket behavior preserved | ✅ | `useSupportTickets`, `useSupportTicket`, `useCreateTicket`, `useReplyToTicket` — identical logic, just moved to new file |
| Commission notification behavior preserved | ✅ | `commissionNotifications.js` not moved, not modified — only documented |
| Realtime behavior preserved | ✅ | `realtime.js` not touched |
| Supabase queries unchanged | ✅ | No queries modified — same tables, same filters, same RPC calls |
| Routes unchanged | ✅ | No route files touched |

---

## 8. Documentation Updates

### Documents Updated

| Document | Changes |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Added Phase 3.4 completion note after Phase 3.3 note; updated status line to include Phase 3.4 |
| `ARCHITECTURE_GUIDE.md` | Added Phase 3.4 completion status to progress section |
| `DEVELOPER_GUIDE.md` | Updated notifications module description with Phase 3.4 notes (preference extraction, support hooks extraction) |
| `src/modules/notifications/README.md` | Updated: preference ownership section (H1), support tickets section (H2), commission notifications section (H3 with migration plan) |
| `src/modules/users/README.md` | Updated notification preferences line to note extraction to `notificationPreferences.js` |

### Documents Checked But Not Changed

| Document | Reason |
|---|---|
| `.windsurfrules` | Rules unchanged — still accurate |
| `SYSTEM_DESIGN.md` | System design unchanged — no architectural changes |
| `package.json` | No new scripts or dependencies |
| `eslint.config.js` | No rule changes |
| `src/modules/checkout/README.md` | No Phase 3.4 changes to checkout |
| `src/modules/payments/README.md` | No Phase 3.4 changes to payments |
| `src/modules/orders/README.md` | No Phase 3.4 changes to orders |
| `src/modules/cart/README.md` | No Phase 3.4 changes to cart |
| `src/modules/delivery/README.md` | No Phase 3.4 changes to delivery |
| `src/modules/catalog/README.md` | No Phase 3.4 changes to catalog |
| `src/modules/marketplace/README.md` | No Phase 3.4 changes to marketplace |
| `src/modules/shared/README.md` | No Phase 3.4 changes to shared |
| `src/modules/app/README.md` | No Phase 3.4 changes to app |
| `src/modules/auth/README.md` | No Phase 3.4 changes to auth |
| `docs/architecture/phase-3-final-gate-report.md` | Historical record — no changes needed |
| `docs/architecture/phase-3-1-checkout-module-report.md` | Historical record |
| `docs/architecture/phase-3-2-payments-module-report.md` | Historical record |
| `docs/architecture/phase-3-3-notifications-module-report.md` | Historical record |

### Outdated Documents Found

None. All documentation has been updated to reflect Phase 3.4 changes.

### Documentation Still Needing Future Updates

| Document | Update Needed | Target Phase |
|---|---|---|
| `src/modules/notifications/README.md` | Remove `commissionNotifications` re-export when commissions module is created | Phase 4 (commissions module) |
| `src/modules/notifications/api/index.js` | Remove `commissionNotifications` re-export when commissions module is created | Phase 4 (commissions module) |
| `src/modules/notifications/index.js` | Remove `commissionNotifications` from public API when commissions module is created | Phase 4 (commissions module) |
| `src/modules/users/README.md` | Update when `notificationsApi.getPreferences` and `savePreferences` are moved to users module | Phase 4+ |
| `ARCHITECTURE_GUIDE.md` | Add Phase 4+ TODOs for coupons, reviews, chat, commissions, analytics, admin modules | Phase 4 start |

---

## 9. Command Results

| Command | Result | Details |
|---|---|---|
| `npm run lint` | ✅ Exit code 0 | `eslint . --max-warnings 1500` — no errors |
| `npm run type-check` | ✅ Exit code 0 | `tsc --noEmit` — no type errors |
| `npm run build` | ✅ Exit code 0 | `vite build` — built successfully (1m 54s), PWA generated |
| `npm run check:circular` | ✅ Exit code 0 | `madge --circular --extensions js,jsx,ts,tsx src/` — 640 files, 0 circular dependencies |

### madge File Count Progression

| Phase | Files Tracked | Circular Deps |
|---|---|---|
| Phase 3 Final Gate | 638 | 0 |
| After Phase 3.4 | 640 | 0 |

---

## 10. Whether It Is Safe to Start Phase 4.1 Coupons Module Foundation

### ✅ Yes — It is safe to start Phase 4.1

**Justification:**

1. **All 4 verification commands pass** (lint, type-check, build, check:circular)
2. **0 circular dependencies** across 640 files
3. **H1 resolved** — preference helpers extracted to `notificationPreferences.js` with full backward compatibility
4. **H2 resolved** — support ticket hooks extracted to `useSupportTicketQueries.js` with full backward compatibility
5. **H3 documented** — `commissionNotifications.js` migration plan documented in notifications README
6. **No behavior changes** — all functions retain identical logic
7. **No existing imports broken** — all backward-compatible re-exports in place
8. **No Supabase queries changed** — all database interactions unchanged
9. **No files moved** — only new files created and existing files updated with imports/re-exports

---

## 11. Remaining Risks Before Coupons

| # | Risk | Impact | Recommendation |
|---|---|---|---|
| R1 | `coupons.js` is re-exported from checkout module, not a standalone coupons module | No coupons module exists yet. `couponsApi` is re-exported from `src/modules/checkout/api/index.js`. | Phase 4.1: Create `src/modules/coupons/` and re-export from there. Update checkout module to import from coupons module. |
| R2 | `notificationsApi.getPreferences` and `savePreferences` remain in `notifications.js` | These are preference methods on the `notificationsApi` object. They work correctly but are misplaced. | Phase 4+: Move to a users-module API or a standalone `notificationPreferencesApi`. |

---

## 12. Remaining Risks Before Commissions

| # | Risk | Impact | Recommendation |
|---|---|---|---|
| R3 | `commissionNotifications.js` is re-exported from notifications module | Creates coupling between notifications and commissions. | Phase 4: Create `src/modules/commissions/` and re-export `commissionNotifications` from there. Remove re-export from notifications module. |
| R4 | `commissionService.js` (696 lines) is a large, complex service | Tightly coupled with payments, notifications, and vendor profiles. | Phase 4: Create commissions module as re-export layer first. Do NOT move `commissionService.js` until commissions module is stable. |
| R5 | `commissionService.js` imports `commissionNotifications` and `notificationsApi` | Commission logic triggers notifications directly. | Document as coupling. Future: use event system instead of direct imports. |

---

## 13. Files That Must Not Be Moved Yet

| File | Reason |
|---|---|
| `src/services/notifications.js` | Still owns `notificationsApi` with all delivery and preference methods. Must not move until `notificationsApi` is split into delivery API and preference API. |
| `src/pages/Notifications.jsx` (838 lines) | Large notifications page with preferences UI. Must not move until preferences are fully extracted. |
| `src/services/realtime.js` (385 lines) | Shared realtime service for orders, notifications, products, deliveries. Must not move. |
| `src/services/commissionNotifications.js` | Must not move until commissions module is created in Phase 4. |
| `src/services/commissionService.js` (696 lines) | Must not move until commissions module is created in Phase 4. |
| `src/pages/CheckoutSimplified.jsx` (1696 lines) | Very large, high-risk checkout page. Must not move until checkout flow is stable. |
| `src/services/checkoutService.js` | Creates orders directly from cart. Must not move until event contracts are designed. |
| `src/services/paymentService.js` | Protected payment area. Must not move until payments module is stable. |
| `src/services/paymentGateway.js` | Payment provider abstraction. Must not move until payments module is stable. |

---

## 14. Conclusion

Phase 3.4 preparation is complete. Three high-priority risks identified in the Phase 3 Final Gate Report have been addressed:

- **H1 (✅ Fixed):** Notification preference constants and helpers extracted from `notifications.js` to `src/services/notificationPreferences.js` with full backward compatibility.
- **H2 (✅ Fixed):** Support ticket hooks extracted from `useNotificationQueries.js` to `src/hooks/queries/useSupportTicketQueries.js` with full backward compatibility.
- **H3 (✅ Documented):** `commissionNotifications.js` migration plan documented in notifications README with clear 4-step migration path for Phase 4.

All four verification commands pass (lint, type-check, build, check:circular) with 0 circular dependencies across 640 files. No behavior changes, no file moves, no import breaks.

**It is safe to start Phase 4.1 (coupons module foundation).**
