# REFACTOR EXECUTION PLAN
**Greenmarket — Production-Safe Incremental Modernization**
**Version:** 1.0.0 | **Date:** 2026-05-18 | **Status:** PLANNING ONLY — NO CODE MODIFIED

---

## ⚠️ MANDATORY READ BEFORE ANY CHANGE

> **This document is a read-only planning artifact.**
> No file may be modified, deleted, or renamed until all sections of this plan have been reviewed and signed off.
> Every phase gate requires passing tests before proceeding to the next phase.

---

## TABLE OF CONTENTS

1. [Executive Architecture Snapshot](#1-executive-architecture-snapshot)
2. [Dependency Graph](#2-dependency-graph)
3. [Flow Maps](#3-flow-maps)
4. [Hidden Coupling & Circular Dependency Report](#4-hidden-coupling--circular-dependency-report)
5. [Safety Rules](#5-safety-rules)
6. [Safe Delete Report](#6-safe-delete-report)
7. [Shared Abstraction Candidates](#7-shared-abstraction-candidates)
8. [Refactor Plan — Phased Execution](#8-refactor-plan--phased-execution)
9. [Regression Risk Matrix](#9-regression-risk-matrix)
10. [Test Coverage Plan](#10-test-coverage-plan)
11. [Migration Diff Overview](#11-migration-diff-overview)
12. [Architectural Decision Records (ADRs)](#12-architectural-decision-records-adrs)
13. [Rollback Strategy](#13-rollback-strategy)

---

## 1. Executive Architecture Snapshot

### 1.1 Current Architecture — Snapshot

```
greenmarket/src/
├── App.jsx                    ← God router: 500+ lines, 60+ lazy imports, 5 useEffects
├── store/
│   ├── authStore.js           ← God Store: 1,228 lines — auth + MFA + sessions + onboarding + security
│   ├── cartStore.js
│   ├── favoritesStore.js
│   └── languageStore.js
├── services/                  ← 70+ files, mixed responsibilities
│   ├── api.js                 ← 771 lines, imports authStore (circular risk)
│   ├── authServices.js        ← 523 lines (MFA, sessions, auto-logout)
│   ├── authGateway.js         ← Rate-limited sign-in only
│   ├── auth/api.js            ← 12,524 bytes — full auth CRUD (UNUSED in routes)
│   ├── axiosInstance.js       ← Axios client (REST/Express backend)
│   ├── supabase.js            ← Supabase client (primary DB)
│   ├── paymentGateway.js      ← 500 lines class-based
│   ├── paymentService.js      ← 314 lines functional wrapper
│   ├── paymentRecords.js      ← Records CRUD
│   ├── cmiPayment.js          ← Legacy stubs (all throw errors)
│   ├── deliveries.js          ← 793 lines (ordersApi + deliveriesApi)
│   ├── driverMatching.js      ← Geographic matching (class)
│   ├── deliveryMatchingService.js ← Matching + cargo options
│   ├── analytics.js           ← Self-hosted analytics
│   ├── googleAnalytics.js     ← GA4 class
│   ├── vendorAnalytics.js     ← Vendor-specific analytics
│   └── ...50+ more files
├── pages/                     ← 105 JSX files — ALL use manual useState/useEffect data fetching
│   ├── vendor/                ← 18 pages (Security, Settings, Dashboard duplicated with buyer/driver)
│   ├── buyer/                 ← 9 pages
│   ├── driver/                ← 13 pages
│   ├── admin/                 ← 22 pages
│   └── auth/                  ← 7 pages
├── features/                  ← PARTIALLY DEAD — mixed state
│   ├── auth/components/       ← TwoFactor.jsx IS used in routes; Login.jsx is a SHADOW (not routed)
│   ├── vendor/components/     ← Stubs (e.g. VendorOrders = "<div>صفحة طلبات البائع</div>")
│   ├── admin/components/      ← AdminOrders.jsx has real implementation (fetch via /api/admin/orders)
│   ├── driver/                ← Has hooks/ and pages/ with real logic
│   └── marketplace/components/← Checkout.jsx (811 lines), ProductDetail.jsx (737 lines) — NOT routed
├── components/
│   ├── ui/                    ← 37 files — shared UI primitives (Button, Card, Modal, etc.)
│   ├── auth/                  ← MFASetup, SessionManager, PhoneVerification, ProtectedRoute
│   ├── vendor/                ← 7 files
│   ├── driver/                ← 4 files
│   ├── checkout/              ← PaymentTypeSelector, OrderSummary
│   └── ...
├── hooks/
│   ├── useFetch.js            ← Custom fetch hook (stale-time cache)
│   ├── useDarkMode.js
│   └── queries/               ← React Query hooks (useAuthQueries, useCartPaymentQueries, etc.)
│       └── mutations/         ← useChatMutations only
├── utils/
│   ├── validators.js          ← Zod schemas (auth, product, order)
│   ├── validationSchemas.js   ← DUPLICATE Zod schemas (login, register, product)
│   ├── cinValidation.js       ← Moroccan CIN validation
│   ├── errorHandler.js        ← ApiError class + normalizeError
│   └── ...18 more files
├── api/                       ← Express.js backend (Node) — driver routes only
│   ├── routes/driver.routes.js
│   ├── controllers/driver.controller.js
│   └── services/driver.service.js
└── constants/
    ├── apiEndpoints.js
    ├── payment.js
    ├── roles.js
    ├── statuses.js
    └── ...
```

**Key Metrics:**
| Metric | Value |
|---|---|
| Total JS/JSX files | 435 |
| Total pages | 105 JSX |
| God files (>1000 lines) | 8 |
| Services | 70+ |
| Validation files | 3 (validators.js, validationSchemas.js, cinValidation.js) |
| Auth service files | 4 (authStore, authServices, authGateway, auth/api.js) |
| Payment service files | 4 (paymentGateway, paymentService, paymentRecords, cmiPayment) |
| Driver matching files | 2 (driverMatching.js, deliveryMatchingService.js) |
| Dead features/ stubs | ~35 files confirmed |
| Direct supabase calls in pages/ | 25+ files |
| Pages with manual fetch pattern | ~100% of pages |

---

## 2. Dependency Graph

### 2.1 Core Dependency Tree (Critical Paths)

```
App.jsx
├── authStore.js ←────────────────────────── CORE: everything depends here
│   ├── authServices.js
│   │   ├── supabase.js
│   │   ├── auditLogger.jsx
│   │   ├── encryption.js
│   │   ├── rateLimiter.js
│   │   ├── emailService.js
│   │   └── withRetry.js
│   ├── authGateway.js
│   │   └── supabase.js
│   ├── auditLogger.jsx
│   ├── emailService.js
│   ├── cartStore.js ───────── ⚠️ cross-store dependency
│   ├── favoritesStore.js ───── ⚠️ cross-store dependency
│   ├── encryption.js
│   ├── rateLimiter.js
│   └── authRedirects.js
│
├── services/api.js
│   ├── supabase.js
│   ├── authAdminOps.js
│   ├── authStore.js ←────────── ⚠️ SERVICE imports STORE (tight coupling)
│   ├── productImages.js
│   ├── withRetry.js
│   └── sanitization.jsx
│
├── pages/CheckoutSimplified.jsx ←────────── God Page: 1,757 lines
│   ├── cartStore.js
│   ├── authStore.js
│   ├── supabase.js (direct) ←── ⚠️ UI → DB coupling
│   ├── coupons.js
│   ├── deliveryScheduleService.js
│   ├── deliveryMatchingService.js
│   ├── platformSettings.js
│   ├── storeTypeService.js
│   ├── trustScoreService.js
│   ├── minimumOrderService.js
│   ├── checkoutService.js
│   ├── paymentService.js
│   └── emailService.js
│
├── pages/OrderDetail.jsx ←────────────────── God Page: 2,166 lines
│   ├── supabase.js (direct)
│   ├── deliveries.js
│   ├── ordersApi
│   ├── paymentGateway.js
│   └── STATUS_CONFIG (local) ←── ⚠️ duplicated in 5 places
│
└── ProtectedRoute.jsx
    └── authStore.js
```

### 2.2 Store Dependency Map

```
authStore.js ──imports──► cartStore.js     (for cart clear on logout)
authStore.js ──imports──► favoritesStore.js (for favorites clear on logout)
cartStore.js ──imports──► supabase.js
cartStore.js ──imports──► cartQuantity.js
favoritesStore.js ──imports──► supabase.js
```

> **Note:** No circular store deps detected. The cross-store imports are one-directional (authStore → child stores), which is acceptable but could be refactored to use events.

### 2.3 Service Dependency Graph

```
supabase.js               ← Singleton leaf node, imported by 50+ files
logger.js                 ← Singleton leaf node
withRetry.js              ← Utility leaf node
encryption.js             ← Utility leaf node

authServices.js ──► supabase, auditLogger, encryption, rateLimiter, emailService, withRetry
authGateway.js  ──► supabase
authAdminOps.js ──► supabase
api.js          ──► supabase, authAdminOps, authStore ⚠️, productImages, withRetry
deliveries.js   ──► supabase, notifications, legalCameraService, withRetry
checkoutService.js ──► supabase (only 65 lines)
paymentGateway.js ──► supabase, paymentRecords, withRetry, config
paymentService.js ──► supabase, paymentGateway, paymentRecords, withRetry
chatService.jsx ──► authStore ⚠️, supabase
```

---

## 3. Flow Maps

### 3.1 Auth Flow

```
User visits protected route
         │
         ▼
  ProtectedRoute.jsx
  useAuthStore() ──► authStore.initialize()
         │                   │
         │          supabase.auth.getSession()
         │          setupAuthListener()
         │          checkOnboardingNeeded()
         │
         ▼
  [loading = true] ──► LoadingFallback
         │
         ▼
  [user exists?]
    NO ──► Navigate('/login')
   YES ──► [role check] ──► [allowedRoles includes role?]
              NO ──► Navigate('/unauthorized')
             YES ──► Render children

Sign-In Flow:
  pages/auth/Login.jsx
  ├── useAuthStore().signIn()
  │     ├── checkLoginRate()          (rateLimiter.js)
  │     ├── signInWithServerRateLimit() (authGateway.js → Edge Function)
  │     ├── supabase.auth.getUser()
  │     ├── fetchProfile()            (supabase.from('profiles'))
  │     ├── checkMFARequired()
  │     ├── auditLogger.log()
  │     └── navigate(role-based path)
  └── [MFA required] ──► navigate('/mfa-verify') ──► TwoFactor.jsx (features/auth)

MFA Flow (vendor/buyer Security pages):
  Security.jsx ──► authStore.getMFASettings()
                ──► mfaService.enable/disable() (authServices.js)
                ──► useAuditLogs() (auditLogger.jsx)
                ──► PhoneVerification (authServices.js → supabase)
```

### 3.2 Checkout Flow

```
pages/Cart.jsx
  ├── cartStore (Zustand persisted)
  └── Navigate('/checkout')
         │
         ▼
pages/CheckoutSimplified.jsx (1,757 lines)
  ├── cartStore.items ──────────────────────── State read
  ├── authStore.user/profile ───────────────── Auth guard
  ├── supabase.from('profiles') (direct) ─────── ⚠️ UI→DB
  ├── deliveryMatchingService.getAvailableDrivers()
  ├── deliveryScheduleService.buildSnapshot()
  ├── platformSettings.get()
  ├── minimumOrderService.evaluate()
  ├── trustScoreService.get()
  ├── coupons.calculate()
  ├── checkoutService.createCheckoutOrder() ──── Only 65 lines
  ├── paymentService (PayPal/bank/COD)
  └── emailService.sendOrderConfirmation()
         │
         ▼
pages/OrderConfirmation.jsx
  └── supabase.from('orders') (direct)
         │
         ▼
pages/buyer/Orders.jsx (1,420 lines)
  └── ordersApi / deliveriesApi / reviewService / invoiceService / loyaltyApi
```

### 3.3 Order Flow (Vendor Side)

```
pages/vendor/Orders.jsx
  ├── supabase.from('orders') (direct, complex SELECT)
  ├── ordersApi.subscribeToVendorOrders() ──► realtimeService
  ├── deliveriesApi
  ├── Modal (assign driver)
  └── ChatComponent (inline)
```

### 3.4 Security Flow

```
[vendor|buyer|driver]/Security.jsx
  ├── authStore.getMFASettings()
  ├── authStore.getActiveSessions()
  ├── authStore.revokeAllOtherSessions()
  ├── authStore.updatePassword()
  ├── mfaService (authServices.js)
  ├── useAuditLogs (auditLogger.jsx)
  ├── validatePasswordStrength() ──── ⚠️ defined locally in each Security.jsx
  ├── MFASetup component
  ├── SessionManager component
  └── PhoneVerificationDialog
```

### 3.5 Settings Flow

```
pages/vendor/Settings.jsx
  ├── supabase.from('profiles') (direct)
  ├── storeTypeService
  ├── cancellationService (DEFAULT_VENDOR_CANCELLATION_POLICY)
  ├── refundPolicyService (DEFAULT_REFUND_POLICY)
  ├── storeEmergencyService
  └── auditLogger

pages/buyer/Settings.jsx
  ├── supabase.from('user_settings') (direct)
  └── deleteAccount() from authStore

pages/driver/Settings.jsx
  ├── supabase.from('profiles') (direct)
  ├── DeliveryPreferences component
  ├── DeliveryPaymentPolicy component
  └── auditLogger
```

### 3.6 Driver Matching Flow

```
pages/vendor/FindDriver.jsx
  └── deliveryMatchingService.getAvailableDrivers() ──► supabase.rpc('find_nearby_drivers')

pages/CheckoutSimplified.jsx
  └── deliveryMatchingService.getAvailableDrivers()

services/driverMatching.js (class DriverMatchingService)
  └── supabase + regions data + 3-tier search logic

services/deliveryMatchingService.js
  └── supabase.rpc('find_nearby_drivers') + cargo/payment options
  └── calculateDistance() from shippingCalculator.js

⚠️ OVERLAP: Both services search for drivers. driverMatching.js has full
geographic fallback logic; deliveryMatchingService.js uses DB RPC + options.
```

---

## 4. Hidden Coupling & Circular Dependency Report

### 4.1 Confirmed Circular Dependencies

| Severity | Chain | Risk |
|---|---|---|
| 🔴 HIGH | `services/api.js → store/authStore.js` | Service imports store. If authStore imports api.js (e.g., profile fetch), creates circular module loading. Currently authStore does NOT import api.js directly — safe for now, but fragile. |
| 🟠 MEDIUM | `services/chatService.jsx → store/authStore.js` | Service imports store for user context. Should receive userId as parameter instead. |
| 🟡 LOW | `store/authStore.js → store/cartStore.js → store/favoritesStore.js` | Cross-store deps are one-directional. Safe but creates test complexity. |

### 4.2 Shared Mutable State Risks

| Location | Risk | Impact |
|---|---|---|
| `authStore.js` — `_signingInProgress` flag | Race condition if sign-in is called from multiple components simultaneously | Auth loops |
| `cartStore` — Zustand persisted | Cart persists across sessions — stale vendor data possible after vendor changes product availability | Incorrect checkout state |
| `STATUS_CONFIG` — defined in 5+ files | Each file has slightly different color/label values | UI inconsistency |
| `paymentGateway.bankDetailsCache` (Map) | In-memory cache, shared across all requests in same session | Stale bank data |

### 4.3 Implicit Prop Dependencies (Undocumented)

| Component | Hidden Dependency | Risk |
|---|---|---|
| `OrderDetail.jsx` | Receives `order` with nested `deliveries[].driver` — shape varies by query | Render crash if shape changes |
| `PaymentTypeSelector.jsx` | Expects `totalAmount` as number; no PropTypes | Silent NaN bugs |
| `ProtectedRoute.jsx` | Reads `profile.role` from authStore — if profile null, no guard | Auth bypass window |
| `DeliveryRequestCard.jsx` | Expects `delivery.order.buyer.phone` — 3-level nesting | Undefined chain crash |

### 4.4 Duplicated Supabase Response Shapes

Multiple files independently define `SELECT` strings for the same tables with different fields:

| Table | Defined In | Fields Differ? |
|---|---|---|
| `orders` | `buyer/Orders.jsx`, `vendor/Orders.jsx`, `admin/Orders.jsx`, `OrderDetail.jsx` | YES — different joins |
| `products` | `api.js` (PRODUCT_LIST_SELECT), `buyer/Dashboard.jsx` (DASHBOARD_PRODUCT_SELECT), `Marketplace.jsx` | YES — different image handling |
| `profiles` | `vendor/Settings.jsx`, `buyer/Settings.jsx`, `driver/Settings.jsx`, `api.js` | YES |
| `deliveries` | `deliveries.js`, `vendor/Orders.jsx`, `driver/Dashboard.jsx` | YES |

### 4.5 Side Effects in Unexpected Places

| Location | Side Effect | Risk |
|---|---|---|
| `App.jsx` — useEffect #1 | Calls `authStore.initialize()` AND `setupAuthListener()` | Double-initialization if StrictMode runs twice |
| `App.jsx` — useEffect #3 | Listens to `auth:sessionExpired` window event | Stale closure on navigate |
| `authStore.initialize()` | Sets 10-second timeout via `setTimeout` | Memory leak if component unmounts before timeout |
| `chatService.jsx` | Imports `authStore` at module level | Causes authStore to initialize on import |
| `deliveries.js` | `withRetry` wraps functions at module evaluation time | Retry config baked into service, not configurable per call |

### 4.6 Dynamic Import / Lazy Load Risk

All `features/` components are **NOT imported in `App.jsx`** except:
- `features/auth/components/TwoFactor.jsx` → IS routed at `/mfa-verify`
- `features/auth/components/Login.jsx` → NOT routed (shadow implementation)

All `features/*/components/` and `features/marketplace/components/` files (Checkout.jsx, ProductDetail.jsx, etc.) are **dead code** — confirmed by `App.jsx` grep showing zero dynamic imports from those paths.

---

## 5. Safety Rules

### 5.1 Non-Negotiable Hard Rules

```
RULE-001: Never modify more than 1 domain in a single PR.
           Domains: auth | checkout | orders | vendor | buyer | driver | admin | shared-ui

RULE-002: Never delete a file without:
           (a) verifying zero imports (static + dynamic),
           (b) verifying zero test references,
           (c) having a passing test suite snapshot.

RULE-003: Preserve all public route contracts.
           Routes defined in App.jsx must remain identical post-refactor.
           Any route change requires explicit migration strategy.

RULE-004: Preserve Supabase table/column schema compatibility.
           No refactor may change DB query field names or table references
           without a corresponding migration script and schema review.

RULE-005: Preserve Zustand store API compatibility.
           All properties/methods on useAuthStore, useCartStore, useFavoritesStore
           must remain callable with same signatures post-refactor.
           External callers (pages, components) must not break.

RULE-006: Never merge validation logic from different domains.
           validators.js (API/backend) and validationSchemas.js (forms/UI) serve
           different purposes and SHOULD remain separate even though they overlap.
           Merge only identical schemas after proving semantic equivalence.

RULE-007: Never remove a service file until all its exports are confirmed
           replaced and all callers are updated in the same PR.

RULE-008: Never introduce a new shared abstraction that has fewer than
           3 confirmed real call sites at the time of creation.

RULE-009: The features/ directory must be cleaned before any new feature is
           added to it. No new code in features/ until dead stubs are removed.

RULE-010: All refactor PRs must include a regression test run (jest + cypress auth).
```

### 5.2 Interface Preservation Contracts

#### authStore Public API (must not change)
```js
useAuthStore() → {
  user, profile, session, loading,
  signIn(email, password, captchaToken),
  signUp(data),
  signOut(),
  updatePassword(oldPassword, newPassword),
  getMFASettings(),
  getActiveSessions(),
  revokeAllOtherSessions(),
  initialize(),
  setupAuthListener(),
  deleteAccount(),
}
```

#### Route Contracts (must not change)
```
/login, /register, /forgot-password, /reset-password, /verify-email
/mfa-verify → features/auth/components/TwoFactor.jsx
/verify-phone → components/auth/PhoneVerification.jsx
/onboarding/buyer|vendor|driver
/product/:id, /products/:id → same component
/stores/:id, /orders/:id, /orders/:id/tracking
/vendor/*, /admin/*, /driver/*, /buyer/*
```

#### Supabase Schema Contracts (must not change table/column names)
```
profiles: id, role, first_name, last_name, store_name, phone, is_verified,
          mfa_enabled, onboarding_completed, phone_verified, vendor_id
orders: id, order_number, vendor_id, buyer_id, status, total, created_at
deliveries: id, order_id, driver_id, status, current_latitude, current_longitude
products: id, vendor_id, name, price_per_unit, approval_status, is_available
```

---

## 6. Safe Delete Report

### 6.1 Confirmed Dead Files — Features/ Stubs

The following files contain placeholder implementations (`<div>stub</div>` or fetch from `/api/` routes that don't exist in production):

| File | Content | Static Imports | Dynamic Imports | Route Usage | Test Usage | Safe to Delete? |
|---|---|---|---|---|---|---|
| `features/vendor/components/Orders.jsx` | `<div>صفحة طلبات البائع</div>` | 0 | 0 | ❌ Not in App.jsx | ❌ None | ✅ YES |
| `features/vendor/components/Profile.jsx` | Stub | 0 | 0 | ❌ | ❌ | ✅ YES |
| `features/vendor/components/Products.jsx` | Stub | 0 | 0 | ❌ | ❌ | ✅ YES |
| `features/vendor/components/Analytics.jsx` | Stub | 0 | 0 | ❌ | ❌ | ✅ YES |
| `features/admin/components/Orders.jsx` | Real impl but fetches `/api/admin/orders` (no backend route) | 0 | 0 | ❌ | ❌ | ✅ YES |
| `features/admin/components/Analytics.jsx` | Stub | 0 | 0 | ❌ | ❌ | ✅ YES |
| `features/admin/components/Users.jsx` | Stub | 0 | 0 | ❌ | ❌ | ✅ YES |
| `features/admin/components/Products.jsx` | Stub | 0 | 0 | ❌ | ❌ | ✅ YES |
| `features/admin/components/Settings.jsx` | Stub | 0 | 0 | ❌ | ❌ | ✅ YES |
| `features/admin/components/AdminDriverManagement.jsx` | Stub | 0 | 0 | ❌ | ❌ | ✅ YES |
| `features/driver/components/Active.jsx` | May overlap pages/driver/Active.jsx | VERIFY | VERIFY | ❌ | ❌ | ⚠️ VERIFY FIRST |
| `features/driver/components/Dashboard.jsx` | May overlap | VERIFY | VERIFY | ❌ | ❌ | ⚠️ VERIFY FIRST |
| `features/driver/components/Earnings.jsx` | Overlap | VERIFY | VERIFY | ❌ | ❌ | ⚠️ VERIFY FIRST |
| `features/driver/components/History.jsx` | Overlap | VERIFY | VERIFY | ❌ | ❌ | ⚠️ VERIFY FIRST |
| `features/driver/components/Profile.jsx` | Overlap | VERIFY | VERIFY | ❌ | ❌ | ⚠️ VERIFY FIRST |
| `features/driver/pages/DriverHome.jsx` | May be entry point | VERIFY | VERIFY | ❌ | ❌ | ⚠️ VERIFY FIRST |
| `features/marketplace/components/Checkout.jsx` | 811 lines real impl | 0 | 0 | ❌ App uses CheckoutSimplified | ❌ | ✅ YES (after confirming no indirect usage) |
| `features/marketplace/components/ProductDetail.jsx` | 737 lines real impl | 0 | 0 | ❌ App uses pages/ProductDetail | ❌ | ✅ YES |
| `features/marketplace/components/ProductCard.jsx` | 228 lines | VERIFY | VERIFY | ❌ | ❌ | ⚠️ VERIFY — used by other marketplace components? |
| `features/auth/components/Login.jsx` | Real impl (min 6 chars, not 8) | 0 | 0 | ❌ Not routed | ❌ | ✅ YES |
| `features/auth/components/Register.jsx` | Shadow | VERIFY | VERIFY | ❌ | ❌ | ⚠️ VERIFY |
| `services/cmiPayment.js` | All functions throw errors | Used by paymentGateway.js | — | N/A | ❌ | ⚠️ KEEP — legacy refund logic may be needed |

### 6.2 Files Requiring Pre-Delete Verification Steps

Before deleting any `features/driver/` file:
1. `grep -r "features/driver" src/` — find all imports
2. `grep -r "DriverProfile\|DriverEarnings\|DriverActive\|DriverHistory" src/` — check component name usage
3. Confirm App.jsx imports from `pages/driver/` only
4. Run full Jest suite before and after deletion

---

## 7. Shared Abstraction Candidates

### 7.1 CANDIDATE: `useSecurityPage` Hook

**Why it SHOULD exist:**
- Identical logic in `vendor/Security.jsx`, `buyer/Security.jsx`, `driver/Security.jsx`:
  - `loadSecurityData()` — getMFASettings + getActiveSessions (exact same 10 lines)
  - `handleDisableMFA()` — identical pattern across 3 files
  - `handleRevokeAllSessions()` — identical
  - `validatePasswordStrength()` — 15-line function, duplicated with minor i18n key differences
- 3 confirmed call sites ✅

**Why it should NOT exist prematurely:**
- Vendor Security has `trustScoreService` and `mfaEnforcementState` (location.state) not in buyer/driver
- Merging too aggressively creates a complex conditional hook

**Proposed abstraction:**
```
src/hooks/useSecurity.js
  exports: useSecurityData(), usePasswordChange(), usePasswordStrength()
  — shared pure logic only
  — role-specific logic stays in each Security.jsx
```

**Coupling Impact:** Low — replaces 3 duplicate implementations
**Regression Risk:** Low — pure function extraction
**Over-engineering Risk:** LOW if scope is kept minimal

---

### 7.2 CANDIDATE: `ORDER_STATUS_CONFIG` Shared Constant

**Why it SHOULD exist:**
- `STATUS_CONFIG` is defined in: `buyer/Orders.jsx`, `admin/Orders.jsx`, `OrderDetail.jsx`, `Tracking.jsx`, `vendor/Dashboard.jsx` — 5 locations
- Minor inconsistencies in color values already exist between files
- 5+ confirmed call sites ✅

**Why it should NOT exist as a single config:**
- `admin/Orders.jsx` uses i18n (`getSTATUS_CONFIG(t)`) while others use static strings
- Forcing a single config means either all use i18n (breaking buyer UX) or none do (breaking admin UX)

**Proposed abstraction:**
```
src/constants/orderStatuses.js
  exports:
    ORDER_STATUSES — canonical status key list
    ORDER_STATUS_COLORS — color/bg/text per status (no labels)
    getOrderStatusLabel(status, t) — i18n-aware label resolver
  
  Each page computes its own display config using:
    const config = { ...ORDER_STATUS_COLORS[status], label: getOrderStatusLabel(status, t) }
```

**Coupling Impact:** Medium — touches 5 files
**Regression Risk:** Low if done as additive (add constant, migrate files one by one)
**Over-engineering Risk:** LOW — solving a real inconsistency

---

### 7.3 CANDIDATE: Unified `usePageData` / Replace manual fetch with React Query

**Why it SHOULD exist:**
- 100% of pages use `useState(true)` + `useEffect(() => { setLoading(true); try { ... } finally { setLoading(false) } })` pattern
- React Query is already installed (`@tanstack/react-query`) and queryClient is configured
- `hooks/queries/` already has React Query hooks (useAuthQueries, etc.) but are not used in pages

**Why it should NOT be a "usePageData" wrapper:**
- Generic wrappers hide query-specific cache configuration needs
- React Query already IS the abstraction — adding another layer is over-engineering

**Proposed abstraction:**
```
Migrate pages gradually to use React Query directly:
  useQuery({ queryKey: ['orders', userId], queryFn: fetchOrders })
  
  No new wrapper. Use React Query as-is.
```

**Coupling Impact:** High per-page, but each migration is independent
**Regression Risk:** Medium — React Query has different loading/error semantics
**Over-engineering Risk:** HIGH if a generic wrapper is created

---

### 7.4 CANDIDATE: Merge `validators.js` + `validationSchemas.js`

**Why it SHOULD exist:**
- Both files define Zod schemas for login, register, product
- Two sources of truth for password rules

**Why it should NOT be merged immediately:**
- `validators.js` is used by `src/api/` (Express backend) — different runtime context
- `validationSchemas.js` is used by React forms (client-side, different error message format)
- Merging requires verifying all call sites for both files first

**Proposed abstraction:**
```
Keep both files separate.
Extract shared primitives to: src/utils/validationPrimitives.js
  exports: emailSchema, passwordSchema, phoneSchema, uuidSchema
  
  Both validators.js and validationSchemas.js import from primitives.
  This eliminates duplicate schema definitions without merging different-purpose files.
```

**Coupling Impact:** Low — additive change
**Regression Risk:** Low — pure Zod schema refactoring
**Over-engineering Risk:** LOW

---

### 7.5 CANDIDATE: Merge `driverMatching.js` + `deliveryMatchingService.js`

**Why it SHOULD exist:**
- Both services find available drivers
- `driverMatching.js` has geographic fallback logic (3-tier Moroccan regions)
- `deliveryMatchingService.js` calls `supabase.rpc('find_nearby_drivers')` + options

**Why it should NOT be merged yet:**
- `driverMatching.js` is a class, `deliveryMatchingService.js` is functional — refactoring patterns differ
- The geographic fallback in `driverMatching.js` may be needed when RPC fails
- Two different callers: CheckoutSimplified uses `deliveryMatchingService`, FindDriver may use either

**Proposed abstraction:**
```
Phase 3 action:
  1. Audit which callers use which service
  2. Make deliveryMatchingService the single entry point
  3. Move geographic fallback logic from driverMatching into deliveryMatchingService
  4. Delete driverMatching.js after migration
```

**Coupling Impact:** Medium
**Regression Risk:** Medium — driver assignment is critical path
**Over-engineering Risk:** LOW — genuine duplication

---

### 7.6 CANDIDATE: `supabase` calls abstraction (Repository pattern)

**Why it SHOULD exist:**
- 25+ pages directly call `supabase.from()` — violates separation of concerns
- Supabase SELECT shapes are duplicated across pages

**Why it should NOT be done all at once:**
- Extracting all Supabase calls is a 50+ file change
- Risk of introducing regressions in production
- Not all cases justify a repository — some queries are truly page-specific

**Proposed abstraction:**
```
Incremental service extraction per domain:
  src/services/ordersService.js    ← extract from vendor/Orders, buyer/Orders, admin/Orders
  src/services/profilesService.js  ← extract from Settings pages
  
  Do NOT create a generic repository wrapper.
  Move SELECT strings to service files, pages call service functions.
```

**Coupling Impact:** High
**Regression Risk:** High if rushed
**Over-engineering Risk:** MEDIUM if repository abstraction is too generic

---

## 8. Refactor Plan — Phased Execution

### PHASE 0: Setup & Safety Net (Pre-requisite)
**Risk:** None | **Can be done anytime**

| Task | Files | Estimated Change |
|---|---|---|
| Add `madge` or `dependency-cruiser` to devDeps | package.json | +2 lines |
| Run and save current circular dep report | CI config | +1 script |
| Add `jest --coverage` to CI | jest.config.js | +3 lines |
| Document current test coverage baseline | — | metrics only |
| Create git tag `before-refactor-v1` | — | git tag only |

---

### PHASE 1: Dead Code Removal (Low Risk)
**Estimated duration:** 1 week | **Risk:** LOW | **No behavior change**

| Step | Action | Files Deleted | Files Modified | Regression Risk |
|---|---|---|---|---|
| 1.1 | Delete confirmed stub files in `features/vendor/components/` | 4 files | 0 | None — not imported |
| 1.2 | Delete stub files in `features/admin/components/` | 5 files | 0 | None |
| 1.3 | Delete `features/auth/components/Login.jsx` (shadow, not routed) | 1 file | 0 | Low — verify no indirect usage |
| 1.4 | Delete `features/marketplace/components/Checkout.jsx` | 1 file | 0 | None — not in routes |
| 1.5 | Delete `features/marketplace/components/ProductDetail.jsx` | 1 file | 0 | None — not in routes |
| 1.6 | Verify and delete `features/driver/` if confirmed unused | 8 files | 0 | Medium — must verify |
| 1.7 | Delete `features/marketplace/components/ProductCard.jsx` if unused | 1 file | 0 | Verify first |

**Gates before proceeding to Phase 2:**
- [ ] All Jest tests pass
- [ ] No broken imports (run `vite build` — will fail on missing imports)
- [ ] Cypress auth tests pass

---

### PHASE 2: Constants & Validation Consolidation (Low-Medium Risk)
**Estimated duration:** 1 week | **Risk:** LOW-MEDIUM**

| Step | Action | Files Added | Files Modified | Regression Risk |
|---|---|---|---|---|
| 2.1 | Create `src/constants/orderStatuses.js` with `ORDER_STATUS_COLORS` | +1 | 0 | None (additive) |
| 2.2 | Migrate `buyer/Orders.jsx` to use shared colors | 0 | 1 | Low — visual only |
| 2.3 | Migrate `vendor/Dashboard.jsx` STATUS_CONFIG | 0 | 1 | Low |
| 2.4 | Migrate `OrderDetail.jsx` STATUS_CONFIG | 0 | 1 | Low |
| 2.5 | Migrate `Tracking.jsx` STATUS_CONFIG | 0 | 1 | Low |
| 2.6 | Migrate `admin/Orders.jsx` (i18n-aware) | 0 | 1 | Low |
| 2.7 | Create `src/utils/validationPrimitives.js` | +1 | 0 | None (additive) |
| 2.8 | Update `validators.js` to import from primitives | 0 | 1 | Low |
| 2.9 | Update `validationSchemas.js` to import from primitives | 0 | 1 | Low |

**Gates before proceeding to Phase 3:**
- [ ] Jest validation tests pass (validationSchemas.test.js, validators.quantity.test.js)
- [ ] Visual regression check on order status badges (manual or screenshot test)

---

### PHASE 3: Security Page Deduplication (Medium Risk)
**Estimated duration:** 1-2 weeks | **Risk:** MEDIUM — touches auth flow**

| Step | Action | Files Added | Files Modified | Regression Risk |
|---|---|---|---|---|
| 3.1 | Create `src/hooks/useSecurity.js` with `useSecurityData()` | +1 | 0 | None (additive) |
| 3.2 | Create `usePasswordStrength()` in same hook | 0 | +hook | None |
| 3.3 | Migrate `buyer/Security.jsx` to use hook | 0 | 1 | Medium — test MFA flow |
| 3.4 | Migrate `driver/Security.jsx` to use hook | 0 | 1 | Medium |
| 3.5 | Migrate `vendor/Security.jsx` to use hook | 0 | 1 | High — has extra trustScore logic |

**Gates:**
- [ ] Manual test: MFA enable/disable on all 3 roles
- [ ] Manual test: Password change on buyer + vendor
- [ ] Audit log entries still created

---

### PHASE 4: Service Layer Cleanup (Medium Risk)
**Estimated duration:** 2 weeks | **Risk:** MEDIUM**

| Step | Action | Details | Regression Risk |
|---|---|---|---|
| 4.1 | Break `services/api.js` import of `authStore` | Pass userId as parameter instead of importing store | Medium |
| 4.2 | Break `chatService.jsx` import of `authStore` | Pass userId/token via function parameter | Low |
| 4.3 | Merge `driverMatching.js` into `deliveryMatchingService.js` | Audit callers first | Medium |
| 4.4 | Extract `src/services/ordersService.js` | Move repeated `supabase.from('orders')` calls from vendor/Orders and buyer/Orders | High |
| 4.5 | Extract `src/services/profilesService.js` | Move repeated `supabase.from('profiles')` calls from Settings pages | Medium |

**Gates:**
- [ ] Driver assignment E2E test passes
- [ ] Order list renders correctly for all roles
- [ ] Settings save correctly for all roles

---

### PHASE 5: God File Decomposition (High Risk)
**Estimated duration:** 3-4 weeks | **Risk:** HIGH**

| File | Strategy | Substeps |
|---|---|---|
| `authStore.js` (1,228 lines) | Split into: `authStore.js` (core), `mfaStore.js` or move MFA to `authServices.js`, `sessionStore.js` | 5+ steps |
| `OrderDetail.jsx` (2,166 lines) | Extract: `OrderTimeline`, `OrderPaymentSection`, `OrderDeliveryMap` as separate components | 4+ steps |
| `CheckoutSimplified.jsx` (1,757 lines) | Extract: `DriverSelectionStep`, `AddressStep`, `PaymentStep`, `CheckoutSummary` | 5+ steps |
| `buyer/Orders.jsx` (1,420 lines) | Extract: `OrderCard`, `OrderFilters`, `ReviewModal`, `InvoiceDownload` | 4+ steps |
| `vendor/Dashboard.jsx` (1,463 lines) | Extract: `RecentOrdersWidget`, `RevenueChart`, `PendingOrdersPanel` | 4+ steps |

**Gates:**
- [ ] Full Cypress E2E suite for checkout flow
- [ ] Full Cypress E2E suite for order lifecycle
- [ ] Auth regression tests

---

### PHASE 6: Data Fetching Modernization (High Risk, Optional)
**Estimated duration:** 4+ weeks | **Risk:** HIGH — changes all data patterns**

> ⚠️ **This phase is optional and should only begin after Phases 1-5 are complete and stable.**

| Step | Action | Notes |
|---|---|---|
| 6.1 | Migrate `buyer/Orders.jsx` to React Query | Proof of concept |
| 6.2 | Migrate `vendor/Orders.jsx` to React Query | |
| 6.3 | Migrate `vendor/Dashboard.jsx` to React Query | |
| 6.4 | Gradually migrate remaining pages | One page at a time |

---

## 9. Regression Risk Matrix

| Refactor | Likelihood of Regression | Severity if Regressed | Mitigation |
|---|---|---|---|
| Delete dead stubs | Very Low | None | Build verify + grep |
| STATUS_CONFIG constant | Low | Visual only | Screenshot test |
| Validation primitives | Low | Auth forms break | Validation unit tests |
| `useSecurityPage` hook | Medium | MFA broken, auth bypass risk | Manual MFA test per role |
| Break `api.js → authStore` coupling | Medium | Admin API calls fail | Integration test |
| Delete `driverMatching.js` | Medium | Driver assignment broken | Checkout E2E test |
| Extract `ordersService.js` | High | Orders don't load | Buyer + vendor order tests |
| Split `authStore` | Very High | Complete auth breakdown | Staged rollout, feature flag |
| Decompose `CheckoutSimplified.jsx` | High | Checkout broken, payments fail | Full checkout E2E |
| Decompose `OrderDetail.jsx` | Medium | Order detail broken | Order lifecycle test |
| React Query migration | High | Loading states, caching bugs | Per-page migration + canary |

---

## 10. Test Coverage Plan

### 10.1 Current Coverage Assessment

| Area | Jest Tests | Cypress E2E | Coverage Level |
|---|---|---|---|
| Auth (login/register/MFA) | `authFlow.test.js`, `authStore.test.js`, `Login.test.js`, `Register.test.js` | `auth.cy.js` | MEDIUM |
| Checkout / Payment | `Checkout.test.js`, `checkoutFlow.test.js` | `marketplace.cy.js` | LOW |
| Orders (buyer/vendor) | Partial in `productManagement.test.js` | `buyer.cy.js`, `vendor.cy.js` | LOW |
| Security (MFA/password) | None | None | CRITICAL GAP |
| Settings (all roles) | None | None | GAP |
| Driver flows | `driver.cy.js` | PARTIAL | LOW |
| Validation utils | `validators.quantity.test.js`, `validationSchemas.test.js` | None | MEDIUM |
| Utility functions | `withRetry`, `sanitization`, `currency`, `rateLimiter` | None | GOOD |

### 10.2 Unit Tests Needed Before Phase 3

```
src/__tests__/hooks/useSecurity.test.js
  ✓ useSecurityData loads MFA settings
  ✓ useSecurityData loads session count
  ✓ useSecurityData handles error gracefully
  ✓ usePasswordStrength validates length
  ✓ usePasswordStrength validates uppercase
  ✓ usePasswordStrength validates special character
  ✓ handleDisableMFA calls mfaService.disable()
  ✓ handleRevokeAllSessions calls revokeAllOtherSessions()
```

### 10.3 Unit Tests Needed Before Phase 4

```
src/__tests__/services/ordersService.test.js
  ✓ fetchVendorOrders returns correct shape
  ✓ fetchBuyerOrders returns correct shape
  ✓ fetchAdminOrders with pagination
  ✓ fetchVendorOrders handles empty result
  ✓ subscribeToVendorOrders calls realtime channel

src/__tests__/services/deliveryMatchingService.test.js
  ✓ getAvailableDrivers calls RPC with correct params
  ✓ falls back gracefully when RPC fails
  ✓ returns empty array when no drivers found
```

### 10.4 Integration Tests Needed Before Phase 5

```
src/__tests__/integration/securityFlow.test.js
  ✓ enable MFA → scan QR → verify TOTP
  ✓ disable MFA → requires password confirmation
  ✓ change password → validates strength → updates
  ✓ phone verification flow

src/__tests__/integration/checkoutFlow.test.js (enhance existing)
  ✓ cart → checkout → driver selection → payment → confirmation
  ✓ minimum order enforcement
  ✓ coupon application
  ✓ delivery scheduling
```

### 10.5 E2E Critical Paths

```
cypress/e2e/auth.cy.js (enhance)
  ✓ login → redirect to role dashboard
  ✓ login → MFA flow
  ✓ session expiry → redirect to login
  ✓ password reset flow

cypress/e2e/checkout.cy.js (new)
  ✓ add to cart → checkout → confirm order
  ✓ PayPal payment flow (mocked)
  ✓ bank transfer flow

cypress/e2e/security.cy.js (new)
  ✓ buyer: change password
  ✓ buyer: enable MFA
  ✓ vendor: security page loads
  ✓ driver: security page loads
```

### 10.6 Auth Regression Tests (Must pass after every phase)

```
✓ sign in with valid credentials → succeeds
✓ sign in with invalid credentials → error shown
✓ sign in rate limit → after 5 failures, locked
✓ protected route without auth → redirect to login
✓ protected route with wrong role → redirect to unauthorized
✓ MFA required → redirect to /mfa-verify
✓ phone verification pending → redirect to /verify-phone
✓ onboarding incomplete → redirect to onboarding
✓ sign out → cart cleared, favorites cleared, redirect to home
```

### 10.7 Checkout/Payment Regression Tests (Must pass after Phase 5)

```
✓ checkout with COD payment → order created
✓ checkout with bank transfer → order created + notification sent
✓ checkout with PayPal → payment intent created
✓ minimum order not met → error shown, cannot proceed
✓ no available drivers → NoDriverAvailable shown
✓ coupon applied → discount calculated correctly
```

---

## 11. Migration Diff Overview

### 11.1 Current Architecture (Snapshot)

```
ARCHITECTURE-CURRENT:
  Data Flow:        Pages → Direct Supabase calls (no service abstraction in 25+ pages)
  State:            Zustand (auth + cart + favorites + language) + local useState per page
  Auth:             authStore (1228L god store) + authServices + authGateway (3 files for 1 concern)
  Validation:       3 separate Zod files with overlapping schemas
  Dead Code:        ~35 files in features/ confirmed unused
  Status Configs:   5 local copies of STATUS_CONFIG (inconsistent)
  Security Pages:   3 near-identical Security.jsx pages (150+ duplicate lines each)
  Data Fetching:    Manual useState/useEffect/setLoading (100% of pages) — React Query installed but unused in pages
  God Files:        8 files over 1,000 lines
  Services:         70+ service files, 4 payment files, 4 auth files, 2 driver matching files
  Analytics:        3 analytics files (analytics.js, googleAnalytics.js, vendorAnalytics.js)
```

### 11.2 Proposed Architecture (Target)

```
ARCHITECTURE-TARGET:
  Data Flow:        Pages → Service functions → Supabase (25+ page violations fixed)
  State:            Zustand (same stores, same API) + React Query for server state
  Auth:             authStore (trimmed, ~600L) + authServices (no change) + authGateway (no change)
  Validation:       validationPrimitives.js (shared) ← validators.js + validationSchemas.js (both kept)
  Dead Code:        features/ cleaned (35 files deleted)
  Status Configs:   constants/orderStatuses.js (1 shared source of truth)
  Security Pages:   hooks/useSecurity.js (shared logic) + 3 slim Security.jsx (role-specific)
  Data Fetching:    React Query for server state (gradual migration, Phase 6)
  God Files:        Decomposed into <400L components/pages
  Services:         Consolidated: ordersService, profilesService, single driverMatchingService
  Analytics:        utils/analytics.js wraps googleAnalytics (already done) — no change needed
```

### 11.3 Estimated Deletions/Additions Per Phase

| Phase | Files Added | Files Deleted | Files Modified | Net LoC Change |
|---|---|---|---|---|
| 0 (setup) | 0 | 0 | 2 | +10 |
| 1 (dead code) | 0 | ~35 | 0 | -8,000 est. |
| 2 (constants) | 2 | 0 | 7 | -200 (dedup) |
| 3 (security hook) | 1 | 0 | 3 | -300 (dedup) |
| 4 (service layer) | 2 | 1 | 8 | -100 net |
| 5 (god files) | 12 | 0 | 5 | 0 net (split) |
| 6 (react query) | 0 | 0 | 50+ | -500 (less boilerplate) |
| **TOTAL** | **~17** | **~36** | **~75** | **~-9,100 LoC** |

---

## 12. Architectural Decision Records (ADRs)

### ADR-001: Do NOT merge `validators.js` and `validationSchemas.js` into one file

**Context:** Both files define Zod schemas. `validators.js` is used by the Express backend (`src/api/`). `validationSchemas.js` is used by React forms.

**Decision:** Keep both files separate. Extract shared primitives to `validationPrimitives.js`.

**Rationale:** The backend and frontend have different validation contexts (error message format, runtime environment). Merging would create runtime issues (browser vs Node) and merge different error message formats.

**Consequences:** Minor duplication of import line. Avoids backend/frontend runtime coupling.

---

### ADR-002: Do NOT abstract React Query into a generic `usePageData` wrapper

**Context:** All pages use manual fetch. React Query is installed and has hooks in `src/hooks/queries/`.

**Decision:** Migrate pages directly to `useQuery()`/`useMutation()` without creating a wrapper hook.

**Rationale:** Generic data wrappers hide cache configuration, retry logic, and stale-time settings that need to be per-query. React Query is already the abstraction layer.

**Consequences:** More explicit query config per page. More verbose but more maintainable.

---

### ADR-003: Do NOT split authStore's public API during Phase 3-4

**Context:** `authStore.js` is 1,228 lines and is a god store.

**Decision:** Internal refactoring of authStore (Phase 5) must preserve the complete public API (`signIn`, `signOut`, `updatePassword`, `getMFASettings`, etc.) unchanged.

**Rationale:** 50+ components depend on `useAuthStore()`. Any API change is a 50-file change with high regression risk.

**Consequences:** Internal cleanup only in Phase 5. API shape locked until complete test coverage exists.

---

### ADR-004: Preserve `features/auth/components/TwoFactor.jsx`

**Context:** All other `features/*/` files are dead code. TwoFactor.jsx IS routed at `/mfa-verify`.

**Decision:** Do NOT delete TwoFactor.jsx. Consider moving to `pages/auth/` in Phase 5 for consistency.

**Rationale:** It's actively used. Deleting it breaks MFA login flow.

**Consequences:** `features/auth/` remains with one live file after dead code cleanup. Minor inconsistency.

---

### ADR-005: `cmiPayment.js` — Keep as tombstone file

**Context:** All `cmiPayment.js` functions throw errors. CMI is a legacy payment provider.

**Decision:** Keep `cmiPayment.js` with its tombstone stubs. Do NOT delete yet.

**Rationale:** It is imported by `paymentGateway.js` for historical refund lookups. Deleting it would require updating paymentGateway.js, which handles live payment logic.

**Consequences:** One 30-line file remains in codebase. Low cost, safe maintenance.

---

### ADR-006: Use additive migration strategy for STATUS_CONFIG

**Context:** STATUS_CONFIG is duplicated in 5 files.

**Decision:** Add `constants/orderStatuses.js` first (additive). Migrate files one by one. Never remove old STATUS_CONFIG until the migrating file's tests pass.

**Rationale:** Parallel existence of old and new allows incremental validation without a big-bang change.

**Consequences:** Temporary duplication during migration (acceptable, bounded in time).

---

## 13. Rollback Strategy

### 13.1 Per-Phase Rollback

Each phase must begin with a dedicated git branch:
```
git checkout -b refactor/phase-1-dead-code-removal
git checkout -b refactor/phase-2-constants
git checkout -b refactor/phase-3-security-hook
...
```

Rolling back a phase = `git revert` the phase PR (not reset — to preserve history).

### 13.2 Feature Flag Strategy (Phase 5+)

For high-risk Phase 5 changes (god file decomposition):
1. Keep the original file as `OrderDetail.legacy.jsx`
2. Add a simple flag: `const USE_NEW_ORDER_DETAIL = import.meta.env.VITE_NEW_ORDER_DETAIL === 'true'`
3. Route to new or legacy based on flag
4. After 2 weeks in production without issues, remove legacy file

### 13.3 Database Rollback

No database schema changes are planned in any phase. All refactoring is frontend/service-layer only. Supabase queries may change their SELECT fields, but the underlying schema is preserved.

### 13.4 Emergency Production Rollback

If a phase is deployed to production and causes issues:
1. Immediate: Revert Vercel/hosting deployment to previous commit
2. Supabase: No DB changes — no DB rollback needed
3. Communication: Document the regression in this file under a "Known Issues" section
4. Post-mortem: Add regression test before re-attempting

---

## Phase Gate Checklist (Copy per Phase)

```markdown
## Phase [N] Gate Checklist

Pre-conditions:
- [ ] Previous phase gate passed
- [ ] git tag `before-phase-[N]` created
- [ ] Baseline test run recorded

During:
- [ ] One domain modified per PR
- [ ] `vite build` passes (no broken imports)
- [ ] Jest tests pass: `npm test`

Post-conditions:
- [ ] All Jest tests pass
- [ ] Cypress auth.cy.js passes
- [ ] Cypress checkout flow passes (Phase 5+)
- [ ] Manual smoke test: login, browse, checkout, logout
- [ ] No new console errors in browser
- [ ] Build bundle size not increased by >5%
```

---

*End of REFACTOR_EXECUTION_PLAN.md*
*Status: PLANNING ONLY — awaiting review before any execution*
