# Phase 4.1 — Coupons Module Foundation Report

**Phase:** 4.1 — Coupons Module Foundation  
**Date:** 2026-06-23  
**Status:** ✅ Completed  
**Approach:** Additive-first, behavior-preserving re-export layer

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:

- ✅ **Rule 1 (Minimal changes):** Only additive changes — 9 new files created (8 sub-layers + README). No files moved. No files deleted. No existing imports changed.
- ✅ **Rule 30 (Stop and ask):** No Supabase/RLS/Auth/Database/Payments/migrations touched.
- ✅ **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — not needed.
- ✅ **No business logic changes.** All coupon functions retain identical behavior.
- ✅ **No Supabase queries changed.** All query functions are unchanged.
- ✅ **No routes changed.**
- ✅ **No circular dependencies** introduced (verified by `madge`).
- ✅ **No mass import rewriting.** All existing imports continue to work.
- ✅ **Rule 24 (Documentation):** Only the required report file created. Existing docs updated, not duplicated.
- ✅ **Rule 21 (Build/Lint):** Commands run for verification after creation and at the end.

---

## 2. Current Coupons Architecture Summary

### Source File

| File | Lines | Purpose |
|---|---|---|
| `src/services/coupons.js` | 534 | Core coupon service — API, normalization, validation, discount calculation, realtime |

### Architecture

```
src/services/coupons.js
├── normalizeCoupon(coupon)                    — field normalization with defaults
├── isCouponCurrentlyActive(coupon, now)       — active/expired check
├── calculateCouponDiscountAmount({coupon, subtotal}) — single coupon discount
├── calculateBulkDiscountBreakdown({coupons, items, now}) — vendor-level bulk discounts
├── couponsApi
│   ├── Buyer: getAvailableCoupons, validateCoupon, redeemCoupon, getUserRedemptions
│   ├── Vendor: getVendorCoupons, getBulkDiscountCandidates, createCoupon, updateCoupon, deactivateCoupon, getCouponStats
│   └── Admin: getAllCoupons
├── subscribeToVendorCouponRedemptions(vendorId, callback) — realtime subscription
└── isAssignedToUser(coupon, userId)           — internal helper (not exported)
```

### Importers

| File | What It Imports | Import Path |
|---|---|---|
| `src/modules/checkout/api/index.js` | `couponsApi`, `normalizeCoupon`, `isCouponCurrentlyActive`, `calculateCouponDiscountAmount`, `calculateBulkDiscountBreakdown` | `@/services/coupons` |
| `src/modules/checkout/index.js` | Re-exports from `./api` | — |
| `src/pages/CheckoutSimplified.jsx` | `couponsApi` | `@/services/coupons` |
| `src/pages/buyer/Coupons.jsx` | `couponsApi` | `@/services/coupons` |
| `src/pages/vendor/Coupons.jsx` | Uses Supabase directly (not `couponsApi`) | `@/services/supabase` |
| `src/__tests__/services/coupons.test.js` | Test imports | `@/services/coupons` |
| `src/components/checkout/OrderSummary.jsx` | Coupon data via props (no direct import) | — |
| `src/components/checkout/CheckoutSummary.jsx` | Coupon data via props (no direct import) | — |

### Supabase Tables

- `coupons` — coupon records (code, discount_type, discount_value, vendor_id, applies_to, etc.)
- `coupon_redemptions` — redemption tracking (coupon_id, user_id, order_id, discount_amount, etc.)
- Both tables are defined in `src/types/database.ts` and database migrations

### Key Observations

1. **No coupon-specific hooks exist** — coupon data fetching is done via direct `couponsApi` calls in pages
2. **No coupon-specific UI components exist** — coupon UI is embedded in checkout components and page-level components
3. **Vendor Coupons page bypasses `couponsApi`** — `src/pages/vendor/Coupons.jsx` (588 lines) uses Supabase directly for CRUD operations
4. **Checkout module re-exports coupon functions** — `src/modules/checkout/api/index.js` re-exports 5 coupon functions from `@/services/coupons`
5. **`coupons.js` is a well-structured service** — clear separation between buyer/vendor/admin operations, uses `withRetry`, optimized queries

---

## 3. What Coupon Files Were Created

| File | Lines | Purpose |
|---|---|---|
| `src/modules/coupons/index.js` | 57 | Public API entry point — re-exports from api, domain, utils |
| `src/modules/coupons/api/index.js` | 15 | API layer — re-exports `couponsApi`, `subscribeToVendorCouponRedemptions` |
| `src/modules/coupons/data/index.js` | 6 | Data layer placeholder |
| `src/modules/coupons/domain/index.js` | 16 | Domain layer — re-exports `normalizeCoupon`, `isCouponCurrentlyActive`, `calculateCouponDiscountAmount`, `calculateBulkDiscountBreakdown` |
| `src/modules/coupons/ui/index.js` | 14 | UI layer placeholder — documents why coupon pages are not re-exported yet |
| `src/modules/coupons/hooks/index.js` | 10 | Hooks layer placeholder — no coupon-specific hooks exist yet |
| `src/modules/coupons/stores/index.js` | 6 | Stores layer placeholder — no dedicated coupon store |
| `src/modules/coupons/utils/index.js` | 14 | Utils layer — re-exports domain helpers (aliased) |
| `src/modules/coupons/README.md` | 248 | Module documentation — responsibility, boundaries, public API, relationships, migration candidates |

**Total: 9 files created, ~386 lines**

---

## 4. What Files Were Moved

**None.** No files were moved. This is a re-export/wrapper layer only.

---

## 5. What Files Were Only Re-exported/Wrapped

| Source File | Re-exported From | What Is Re-exported |
|---|---|---|
| `src/services/coupons.js` | `src/modules/coupons/api/index.js` | `couponsApi`, `subscribeToVendorCouponRedemptions`, `couponsApiDefault` |
| `src/services/coupons.js` | `src/modules/coupons/domain/index.js` | `normalizeCoupon`, `isCouponCurrentlyActive`, `calculateCouponDiscountAmount`, `calculateBulkDiscountBreakdown` |
| `src/services/coupons.js` | `src/modules/coupons/utils/index.js` | Same as domain (aliased with `utils` prefix) |

---

## 6. Public API Exposed by `src/modules/coupons`

```js
import {
  // API
  couponsApi,
  subscribeToVendorCouponRedemptions,
  couponsApiDefault,

  // Domain
  normalizeCoupon,
  isCouponCurrentlyActive,
  calculateCouponDiscountAmount,
  calculateBulkDiscountBreakdown,

  // Utils (aliased)
  utilsNormalizeCoupon,
  utilsIsCouponCurrentlyActive,
  utilsCalculateCouponDiscountAmount,
  utilsCalculateBulkDiscountBreakdown,
} from '@/modules/coupons'
```

### `couponsApi` Methods Available

**Buyer-facing:**
- `getAvailableCoupons(userId, filters)` — get active coupons available to a buyer
- `validateCoupon(couponCode, userId, orderAmount)` — validate a coupon code
- `redeemCoupon(couponCode, userId, orderId, orderAmount)` — validate and redeem
- `getUserRedemptions(userId)` — get user's redemption history

**Vendor-facing:**
- `getVendorCoupons(vendorId)` — get vendor's coupons
- `getBulkDiscountCandidates(vendorIds)` — get active bulk discount coupons
- `createCoupon(coupon)` — create a new coupon
- `updateCoupon(couponId, updates)` — update a coupon
- `deactivateCoupon(couponId)` — soft-delete a coupon
- `getCouponStats(couponId)` — get coupon usage statistics

**Admin-facing:**
- `getAllCoupons(filters)` — get all coupons across all vendors

---

## 7. What Coupon Files Were Intentionally Not Moved and Why

| File | Reason |
|---|---|
| `src/services/coupons.js` (534 lines) | Core service file — must not move until all consumers are migrated to import from `@/modules/coupons`. Moving now would break existing imports from `@/services/coupons`. |
| `src/pages/buyer/Coupons.jsx` | Buyer coupon list page — uses `couponsApi` but is tightly coupled to buyer page context (routing, auth, UI layout). Migration candidate for Phase 4.2+. |
| `src/pages/vendor/Coupons.jsx` (588 lines) | Vendor coupon management page — uses Supabase directly (not `couponsApi`), tightly coupled to vendor context. High risk. Migration candidate for Phase 4.3+. |
| `src/components/checkout/OrderSummary.jsx` | Checkout component — displays coupon discounts but receives data via props. Not a coupons module concern. |
| `src/components/checkout/CheckoutSummary.jsx` | Checkout component — displays coupon discounts but receives data via props. Not a coupons module concern. |
| `src/__tests__/services/coupons.test.js` | Test file — tests `coupons.js` directly. Should remain with the source until the source is moved. |

---

## 8. Whether Any Imports Were Changed

**No existing imports were changed.**

All existing import paths continue to work:
- `import { couponsApi, ... } from '@/services/coupons'` — still works (source file unchanged)
- `import { couponsApi, ... } from '@/modules/checkout'` — still works (checkout re-export unchanged)
- `import { couponsApi, ... } from '@/modules/checkout/api'` — still works

**New import path available (but not required):**
- `import { couponsApi, normalizeCoupon, ... } from '@/modules/coupons'` — new public API

---

## 9. Behavior Preservation

| Check | Status | Details |
|---|---|---|
| Coupon validation behavior unchanged | ✅ | `couponsApi.validateCoupon` — identical logic, same Supabase queries, same error messages |
| Coupon normalization behavior unchanged | ✅ | `normalizeCoupon` — identical field defaults and type coercion |
| Coupon active/expired behavior unchanged | ✅ | `isCouponCurrentlyActive` — identical date range check logic |
| Discount calculation behavior unchanged | ✅ | `calculateCouponDiscountAmount` and `calculateBulkDiscountBreakdown` — identical formulas, same `toAmount` rounding |
| Checkout coupon behavior unchanged | ✅ | `CheckoutSimplified.jsx` still imports from `@/services/coupons` — no changes |
| Payment totals behavior unchanged | ✅ | No payment files touched — coupon discount is calculated by checkout and passed to payment |
| Routes unchanged | ✅ | No route files touched |
| Supabase queries unchanged | ✅ | No queries modified — same tables, same filters, same RPC calls |
| Database/RLS unchanged | ✅ | No migrations or schema files touched |

---

## 10. Documentation Updates

### Documents Updated

| Document | Changes |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Added Phase 4.1 completion note after Phase 3.4 note; updated status line to include Phase 4.1 |
| `ARCHITECTURE_GUIDE.md` | Added Phase 4.1 completion status to progress section |
| `DEVELOPER_GUIDE.md` | Added `src/modules/coupons/` to project structure tree with all sub-layers |
| `src/modules/coupons/README.md` | Created — 248 lines documenting module responsibility, boundaries, public API, relationships, migration candidates, safety notes |

### Documents Checked But Not Changed

| Document | Reason |
|---|---|
| `.windsurfrules` | Rules unchanged — still accurate |
| `SYSTEM_DESIGN.md` | System design unchanged — no architectural changes |
| `package.json` | No new scripts or dependencies |
| `eslint.config.js` | No rule changes |
| `src/modules/checkout/README.md` | No changes needed — checkout still re-exports coupon functions for backward compatibility. Documented in coupons README as future migration candidate. |
| `src/modules/payments/README.md` | No changes needed — coupons does not interact with payments internals |
| `src/modules/orders/README.md` | No changes needed — coupons does not interact with orders internals |
| `src/modules/cart/README.md` | No changes needed — coupons does not interact with cart internals |
| `src/modules/notifications/README.md` | No changes needed |
| `src/modules/users/README.md` | No changes needed |
| `src/modules/shared/README.md` | No changes needed |
| `src/modules/app/README.md` | No changes needed |
| `docs/architecture/phase-3-final-gate-report.md` | Historical record |
| `docs/architecture/phase-3-4-notifications-preparation-report.md` | Historical record |
| `docs/architecture/phase-3-1-checkout-module-report.md` | Historical record |

### Outdated Documents Found

None. All documentation has been updated to reflect Phase 4.1 changes.

### Documentation Still Needing Future Updates

| Document | Update Needed | Target Phase |
|---|---|---|
| `src/modules/checkout/README.md` | Remove coupon re-exports from public API when consumers migrate to `@/modules/coupons` | Phase 4.2+ |
| `src/modules/checkout/api/index.js` | Remove coupon re-exports when consumers migrate | Phase 4.2+ |
| `src/modules/coupons/README.md` | Update UI section when coupon pages are moved | Phase 4.2+ |
| `src/modules/coupons/README.md` | Update hooks section when coupon hooks are created | Phase 4.2+ |
| `src/modules/coupons/README.md` | Update migration candidates table as items are completed | Ongoing |

---

## 11. Command Results

| Command | Result | Details |
|---|---|---|
| `npm run lint` | ✅ Exit code 0 | `eslint . --max-warnings 1500` — no errors |
| `npm run type-check` | ✅ Exit code 0 | `tsc --noEmit` — no type errors |
| `npm run build` | ✅ Exit code 0 | `vite build` — built successfully (1m 59s), PWA generated |
| `npm run check:circular` | ✅ Exit code 0 | `madge --circular --extensions js,jsx,ts,tsx src/` — 648 files, 0 circular dependencies |

### madge File Count Progression

| Phase | Files Tracked | Circular Deps |
|---|---|---|
| Phase 3 Final Gate | 638 | 0 |
| After Phase 3.4 | 640 | 0 |
| After Phase 4.1 | 648 | 0 |

---

## 12. Whether It Is Safe to Continue to Phase 4.2 Reviews Module

### ✅ Yes — It is safe to continue to Phase 4.2 (reviews module)

**Justification:**

1. **All 4 verification commands pass** (lint, type-check, build, check:circular)
2. **0 circular dependencies** across 648 files
3. **No behavior changes** — all coupon functions retain identical logic
4. **No existing imports broken** — all backward-compatible re-exports in place
5. **No Supabase queries changed** — all database interactions unchanged
6. **No files moved** — only new files created
7. **Coupons module is a clean re-export layer** — no coupling with other modules

---

## 13. Whether Any Coupon/Checkout Preparation Step Is Recommended Before Reviews

### No preparation step is required before Phase 4.2

The coupons module is a clean re-export layer with no high-priority risks. The migration candidates (MC1–MC5) documented in the README are all low-to-medium risk and can be addressed in future phases without blocking reviews module creation.

**However, the following items should be tracked for future phases:**

| # | Item | Risk | Recommended Phase |
|---|---|---|---|
| MC1 | Move `src/services/coupons.js` to `src/modules/coupons/api/` | Medium — 534 lines, used by checkout and pages | Phase 4.2+ |
| MC2 | Move `src/pages/buyer/Coupons.jsx` to coupons module UI | Medium — uses `couponsApi`, relatively decoupled | Phase 4.2+ |
| MC3 | Move `src/pages/vendor/Coupons.jsx` to coupons module UI | High — uses Supabase directly, 588 lines | Phase 4.3+ |
| MC4 | Create coupon hooks (`useCoupons`, `useVendorCoupons`, `useCouponValidation`) | Low — create new | Phase 4.2+ |
| MC5 | Remove coupon re-exports from checkout module | Low — requires updating all consumers | Phase 4.2+ |

---

## 14. Files That Must Not Be Moved Yet

| File | Reason |
|---|---|
| `src/services/coupons.js` (534 lines) | Core service — must not move until all consumers migrate to `@/modules/coupons` |
| `src/pages/buyer/Coupons.jsx` | Buyer coupon page — tightly coupled to buyer context |
| `src/pages/vendor/Coupons.jsx` (588 lines) | Vendor coupon page — uses Supabase directly, high risk |
| `src/pages/CheckoutSimplified.jsx` (1696 lines) | Very large checkout page — must not move until checkout flow is stable |
| `src/services/checkoutService.js` | Creates orders from cart — must not move until event contracts are designed |
| `src/components/checkout/OrderSummary.jsx` | Checkout component — not a coupons concern |
| `src/components/checkout/CheckoutSummary.jsx` | Checkout component — not a coupons concern |

---

## 15. Conclusion

Phase 4.1 coupons module foundation is complete. `src/modules/coupons/` has been created as a clean re-export layer with 9 files (8 sub-layers + README). The module exposes the full `couponsApi`, domain helpers (`normalizeCoupon`, `isCouponCurrentlyActive`, `calculateCouponDiscountAmount`, `calculateBulkDiscountBreakdown`), and realtime subscription (`subscribeToVendorCouponRedemptions`) through a clean public API.

All four verification commands pass (lint, type-check, build, check:circular) with 0 circular dependencies across 648 files. No behavior changes, no file moves, no import breaks, no Supabase query changes.

**It is safe to continue to Phase 4.2 (reviews module foundation).** No coupon/checkout preparation step is required before reviews.
