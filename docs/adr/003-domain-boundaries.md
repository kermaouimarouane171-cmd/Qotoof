# ADR 003 — Domain Boundaries

**Date:** 2025-05-19  
**Status:** Accepted  
**Deciders:** Engineering team

---

## Context

The `src/services/` folder grew organically and mixed unrelated concerns in
single files (`api.js` contains products, orders, reviews, vendors, analytics).
This made it hard to reason about what a page component depended on.

As the codebase scales toward separate buyer, vendor, driver, and admin
surfaces, clear ownership boundaries reduce accidental coupling.

## Decision

Introduce a `src/domains/` layer as a **thin re-export façade** over existing
services. Each domain owns a slice of business capability.

### Domains

| Domain | Responsibility | Primary service |
|--------|---------------|-----------------|
| `ordering` | Create, cancel, update orders; query order list and detail | `src/services/api.js` → ordersApi; `useOrderView` hook |
| `delivery` | Accept/reject/update deliveries; driver assignment | `src/services/deliveries.js` → deliveriesApi |
| `payments` | Confirm payment, upload receipt, check status | `src/services/paymentService.js` |
| `catalog` | Create/update/delete products; list/search products | `src/services/api.js` → productsApi |
| `identity` | Sign in/out, phone OTP, fetch profile | `src/store/authStore.js`; `phoneOtpService.js`; `profilesService.js` |

### Boundary rules

1. A page component imports from `@/domains/<name>` — not from `@/services/*` directly.
2. Domain files do **not** contain React hooks (exception: `ordering/queries.js`
   re-exports `useOrderView` as a convenience since it belongs to the ordering
   domain's read model).
3. Cross-domain calls are allowed in page components (e.g. OrderDetail uses
   both `ordering` and `payments`) but must not be hidden inside a domain module.
4. This layer is a **façade** — it does not duplicate logic. If the underlying
   service changes, only one file in `src/domains/` needs updating.

### What this is NOT

- Not DDD aggregates (no in-memory domain models).
- Not a service layer with business logic (logic stays in services/Edge Functions).
- Not a replacement for Zustand stores (identity store remains in authStore).

## Consequences

**Positive:**
- `grep -r "from '@/services/api'"` will show violations at a glance.
- New developers have a map of what each domain owns.
- Easier to split into micro-frontends later if needed.

**Negative / risks:**
- Adds one indirection layer. Mitigation: façade files are ≤ 30 lines each.
- Requires discipline to keep the boundary. Mitigation: ESLint import rule
  can enforce "no direct service imports in pages/" if desired.

## Migration path

Existing pages still import from `src/services/` directly. The domain layer
is additive — pages can be migrated incrementally. New pages should import
from `src/domains/` only.
