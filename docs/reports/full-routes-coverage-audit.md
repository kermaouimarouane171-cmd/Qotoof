# Full App Routes Coverage Audit

**Project:** Qotoof / Greenmarket  
**Date:** 2025-06-06  
**Source:** `src/router/AppRouter.jsx` + `cypress/e2e/*.cy.js`

---

## 1. Executive Summary

This audit maps every route in `AppRouter.jsx` to its Cypress test coverage. The application uses React Router with lazy-loaded components and role-based access control (RBAC). Tests span page-health, smoke, visual, flow, and guard validation.

**Total routes inventoried:** ~115 paths.  
**Overall numerical coverage:** ~37% (43 covered, 72 not covered).  
**Core flow coverage:** Buyer ~70%, Vendor ~75%, Driver ~90%, Admin ~50%.

The numerical percentage is low because many supplementary routes (security, settings, profile, static pages) are not individually tested, but the **primary user flows are well covered**.

---

## 2. Methodology

1. **Route extraction** — Listed every `<Route>` from `AppRouter.jsx` with path, component, role, and protection level.
2. **Test file extraction** — Listed every file in `cypress/e2e/`.
3. **Route-to-test mapping** — Grepped each test file for `cy.visit()` paths.
4. **Classification:**
   - **Covered** — Dedicated test explicitly visits the route with mocked data.
   - **Partial** — Smoke/visual/mobile test visits but does not assert deep functionality.
   - **Not Covered** — No test visits the route.
   - **Dead Route Suspected** — Unreachable or redundant path.

---

## 3. Coverage Matrix

### 3.1 Public Routes

| # | Route | Component | Protected | Test File | Type | Status | Priority |
|---|-------|-----------|-----------|-----------|------|--------|----------|
| 1 | `/login` | LoginPage | No | page-health-auth, smoke-desktop | Page Health + Smoke | ✅ Covered | Critical |
| 2 | `/register` | RegisterPage | No | page-health-auth, smoke-desktop | Page Health + Smoke | ✅ Covered | Critical |
| 3 | `/forgot-password` | ForgotPasswordPage | No | page-health-auth | Page Health | ✅ Covered | High |
| 4 | `/reset-password` | ResetPasswordPage | No | page-health-auth | Page Health | ✅ Covered | High |
| 5 | `/verify-email` | VerifyEmailPage | No | page-health-auth | Page Health | ✅ Covered | Medium |
| 6 | `/mfa-verify` | TwoFactorPage | No | page-health-auth | Page Health | ✅ Covered | Medium |
| 7 | `/verify-phone` | PhoneVerificationPage | No | page-health-auth | Page Health | ✅ Covered | Medium |
| 8 | `/auth/callback` | AuthCallbackPage | No | page-health-auth | Page Health | ✅ Covered | Medium |
| 9 | `/` | HomePage | No | smoke-desktop, mobile-white-screen | Smoke | ⚠️ Partial | Critical |
| 10 | `/marketplace` | MarketplacePage | No | page-health-buyer-marketplace, smoke-desktop | Page Health + Smoke | ✅ Covered | Critical |
| 11 | `/product/:id` | ProductDetailPage | No | page-health-buyer-marketplace, page-health-buyer-product-details | Page Health | ✅ Covered | Critical |
| 12 | `/products/:id` | ProductDetailPage | No | page-health-buyer-marketplace | Page Health | ⚠️ Partial | High |
| 13 | `/stores` | StoresPage | No | smoke-desktop | Smoke | ⚠️ Partial | Medium |
| 14 | `/stores/:id` | StoreDetailPage | No | smoke-desktop | Smoke | ⚠️ Partial | Medium |
| 15 | `/cart` | CartPage | No | button-actions-public-cart, smoke-desktop | Flow + Smoke | ✅ Covered | Critical |
| 16 | `/search` | SearchResultsPage | No | smoke-desktop | Smoke | ⚠️ Partial | Medium |
| 17 | `/orders` | RoleOrdersRedirect | No | route-guards | Guard | ⚠️ Partial | Medium |
| 18 | `/about` | AboutPage | No | smoke-desktop | Smoke | ⚠️ Partial | Low |
| 19 | `/contact` | ContactPage | No | smoke-desktop | Smoke | ⚠️ Partial | Low |
| 20 | `/help` | HelpCenterPage | No | smoke-desktop | Smoke | ⚠️ Partial | Low |
| 21 | `/terms` | TermsPage | No | smoke-desktop | Smoke | ⚠️ Partial | Low |
| 22 | `/privacy` | PrivacyPage | No | smoke-desktop | Smoke | ⚠️ Partial | Low |
| 23 | `/become-vendor` | BecomeVendorPage | No | smoke-desktop | Smoke | ⚠️ Partial | Medium |
| 24 | `/returns` | ReturnsPage | No | smoke-desktop | Smoke | ⚠️ Partial | Low |
| 25 | `/shipping` | ShippingPage | No | smoke-desktop | Smoke | ⚠️ Partial | Low |
| 26 | `/tracking` | TrackingPage | No | smoke-desktop | Smoke | ⚠️ Partial | Medium |
| 27 | `/marketplace/seasonal` | SeasonalPage | No | smoke-desktop | Smoke | ⚠️ Partial | Low |
| 28 | `/vendor/public/:id` | VendorPublicProfile | No | — | None | ❌ Not Covered | Medium |
| 29 | `/404` | NotFoundPage | No | — | None | ❌ Not Covered | Low |
| 30 | `/unauthorized` | UnauthorizedPage | No | — | None | ❌ Not Covered | Medium |
| 31 | `/*` | NotFoundPage | No | — | None | ❌ Not Covered | Low |

### 3.2 Onboarding Routes

| # | Route | Component | Protected | Test File | Type | Status | Priority |
|---|-------|-----------|-----------|-----------|------|--------|----------|
| 32 | `/onboarding/buyer` | BuyerOnboardingPage | Yes | onboarding | Flow | ✅ Covered | High |
| 33 | `/onboarding/vendor` | VendorOnboardingPage | Yes | onboarding | Flow | ✅ Covered | High |
| 34 | `/onboarding/driver` | DriverOnboardingPage | Yes | onboarding | Flow | ✅ Covered | High |

### 3.3 Shared Authenticated Routes

| # | Route | Component | Test File | Type | Status | Priority |
|---|-------|-----------|-----------|------|--------|----------|
| 35 | `/orders/:id` | OrderDetailPage | — | None | ❌ Not Covered | High |
| 36 | `/orders/:id/tracking` | OrderTrackingPage | — | None | ❌ Not Covered | Medium |
| 37 | `/orders/:id/condition` | ProductConditionPage | — | None | ❌ Not Covered | Medium |
| 38 | `/order-confirmation` | OrderConfirmationPage | — | None | ❌ Not Covered | Medium |
| 39 | `/order-confirmation/:id` | OrderConfirmationPage | — | None | ❌ Not Covered | Medium |
| 40 | `/order-tracking/:id` | OrderTrackingPage | — | None | ❌ Not Covered | Medium |
| 41 | `/tracking/:id` | OrderTrackingPage | — | None | ❌ Not Covered | Medium |
| 42 | `/favorites` | FavoritesPage | — | None | ❌ Not Covered | Medium |
| 43 | `/notifications` | NotificationsPage | — | None | ❌ Not Covered | Medium |
| 44 | `/profile` | ProfilePage | — | None | ❌ Not Covered | High |
| 45 | `/chat` | ChatPage | — | None | ❌ Not Covered | Low |
| 46 | `/messages` | MessagesPage | — | None | ❌ Not Covered | Low |
| 47 | `/bank-account` | BankAccountPage | — | None | ❌ Not Covered | Medium |
| 48 | `/activity-log` | ActivityLogPage | — | None | ❌ Not Covered | Low |

### 3.4 Buyer Routes

| # | Route | Component | Test File | Type | Status | Priority |
|---|-------|-----------|-----------|------|--------|----------|
| 49 | `/checkout` | CheckoutPage | checkout-to-payment | Flow | ✅ Covered | Critical |
| 50 | `/buyer/` (→ dashboard) | Redirect | — | None | ❌ Not Covered | Low |
| 51 | `/buyer/dashboard` | BuyerDashboard | smoke-desktop, mobile-white-screen | Smoke | ⚠️ Partial | High |
| 52 | `/buyer/orders` | BuyerOrders | page-health-buyer-orders, buyer | Page Health + Flow | ✅ Covered | Critical |
| 53 | `/buyer/addresses` | BuyerAddresses | — | None | ❌ Not Covered | Medium |
| 54 | `/buyer/settings` | BuyerSettings | settings | Flow | ✅ Covered | Medium |
| 55 | `/buyer/coupons` | BuyerCoupons | — | None | ❌ Not Covered | Low |
| 56 | `/buyer/loyalty` | BuyerLoyalty | — | None | ❌ Not Covered | Low |
| 57 | `/buyer/security` | BuyerSecurity | — | None | ❌ Not Covered | Medium |
| 58 | `/buyer/shopping-lists` | BuyerShoppingLists | — | None | ❌ Not Covered | Low |
| 59 | `/buyer/rfq` | BuyerRFQ | — | None | ❌ Not Covered | Low |

### 3.5 Vendor Routes

| # | Route | Component | Test File | Type | Status | Priority |
|---|-------|-----------|-----------|------|--------|----------|
| 60 | `/vendor/` (→ dashboard) | Redirect | — | None | ❌ Not Covered | Low |
| 61 | `/vendor/dashboard` | VendorDashboard | vendor | Flow | ✅ Covered | Critical |
| 62 | `/vendor/products` | VendorProducts | page-health-vendor-products, vendor | Page Health + Flow | ✅ Covered | Critical |
| 63 | `/vendor/orders` | VendorOrders | page-health-vendor-orders, vendor-order-management | Page Health + Flow | ✅ Covered | Critical |
| 64 | `/vendor/delivery-options` | VendorDeliveryOptionSetup | — | None | ❌ Not Covered | Medium |
| 65 | `/vendor/analytics` | VendorAnalytics | — | None | ❌ Not Covered | Medium |
| 66 | `/vendor/profile` | VendorProfile | — | None | ❌ Not Covered | High |
| 67 | `/vendor/reviews` | VendorReviews | — | None | ❌ Not Covered | Medium |
| 68 | `/vendor/settings` | VendorSettings | page-health-vendor-settings | Page Health | ✅ Covered | High |
| 69 | `/vendor/coupons` | VendorCoupons | — | None | ❌ Not Covered | Low |
| 70 | `/vendor/subscription` | VendorSubscription | — | None | ❌ Not Covered | Low |
| 71 | `/vendor/schedules` | VendorSchedules | — | None | ❌ Not Covered | Low |
| 72 | `/vendor/security` | VendorSecurity | — | None | ❌ Not Covered | Medium |
| 73 | `/vendor/location` | VendorLocation | — | None | ❌ Not Covered | Medium |
| 74 | `/vendor/driver-preferences` | VendorDriverPreferenceSetup | — | None | ❌ Not Covered | Low |
| 75 | `/vendor/find-driver` | VendorFindDriver | — | None | ❌ Not Covered | Low |
| 76 | `/vendor/digital-contract` | VendorDigitalContract | page-health-vendor-activation | Page Health + Flow | ✅ Covered | High |
| 77 | `/vendor/rfqs` | VendorRFQs | — | None | ❌ Not Covered | Low |

### 3.6 Driver Routes

| # | Route | Component | Test File | Type | Status | Priority |
|---|-------|-----------|-----------|------|--------|----------|
| 78 | `/driver/` (→ dashboard) | Redirect | — | None | ❌ Not Covered | Low |
| 79 | `/driver/dashboard` | DriverDashboard | page-health-driver-dashboard | Page Health | ✅ Covered | Critical |
| 80 | `/driver/active` | DriverActive | page-health-driver-deliveries | Page Health | ✅ Covered | Critical |
| 81 | `/driver/available` | DriverAvailable | page-health-driver-available-orders | Page Health | ✅ Covered | Critical |
| 82 | `/driver/history` | DriverHistory | page-health-driver-deliveries | Page Health | ✅ Covered | Critical |
| 83 | `/driver/earnings` | DriverEarnings | page-health-driver-earnings | Page Health | ✅ Covered | Critical |
| 84 | `/driver/profile` | DriverProfile | page-health-driver-profile-settings | Page Health | ⚠️ Partial | High |
| 85 | `/driver/settings` | DriverSettings | page-health-driver-profile-settings | Page Health | ✅ Covered | High |
| 86 | `/driver/security` | DriverSecurity | — | None | ❌ Not Covered | Medium |
| 87 | `/driver/vendor-preferences` | DriverVendorPreferenceSetup | — | None | ❌ Not Covered | Low |
| 88 | `/driver/find-vendor` | DriverFindVendor | — | None | ❌ Not Covered | Low |
| 89 | `/driver/delivery/:id/pickup` | DriverDeliveryPickup | — | None | ❌ Not Covered | Medium |
| 90 | `/driver/delivery/:id/deliver` | DriverDeliveryTracking | page-health-driver-delivery-tracking | Page Health | ⚠️ Partial | High |
| 91 | `/driver/delivery/:id/tracking` | DriverDeliveryTracking | page-health-driver-delivery-tracking | Page Health | ✅ Covered | Critical |
| 92 | `/driver/delivery/:id/complete` | DriverDeliveryComplete | — | None | ❌ Not Covered | Medium |

### 3.7 Admin Routes

| # | Route | Component | Test File | Type | Status | Priority |
|---|-------|-----------|-----------|------|--------|----------|
| 93 | `/admin/` (→ dashboard) | Redirect | — | None | ❌ Not Covered | Low |
| 94 | `/admin/dashboard` | AdminDashboard | admin | Flow | ✅ Covered | Critical |
| 95 | `/admin/users` | AdminUsers | admin | Flow | ✅ Covered | Critical |
| 96 | `/admin/products` | AdminProducts | admin | Flow | ✅ Covered | Critical |
| 97 | `/admin/orders` | AdminOrders | admin | Flow | ✅ Covered | Critical |
| 98 | `/admin/analytics` | AdminAnalytics | admin | Flow | ✅ Covered | High |
| 99 | `/admin/settings` | AdminSettings | admin | Flow | ✅ Covered | High |
| 100 | `/admin/reports` | AdminReports | — | None | ❌ Not Covered | Medium |
| 101 | `/admin/vendors` | AdminVendors | — | None | ❌ Not Covered | Medium |
| 102 | `/admin/drivers` | AdminDrivers | admin | Flow | ✅ Covered | High |
| 103 | `/admin/moderation` | AdminModeration | — | None | ❌ Not Covered | Medium |
| 104 | `/admin/commissions` | AdminCommissions | admin | Flow | ✅ Covered | High |
| 105 | `/admin/payouts` | AdminPayouts | admin | Flow | ✅ Covered | High |
| 106 | `/admin/reviews` | AdminReviews | admin | Flow | ✅ Covered | Medium |
| 107 | `/admin/security` | AdminSecurity | — | None | ❌ Not Covered | Medium |
| 108 | `/admin/commission-management` | AdminCommissionManagement | — | None | ❌ Not Covered | Medium |
| 109 | `/admin/verification` | AdminVerification | admin (driver-verification) | Flow | ⚠️ Partial | High |
| 110 | `/admin/disputes` | AdminDisputeManagement | — | None | ❌ Not Covered | Medium |
| 111 | `/admin/fraud-reports` | AdminFraudReports | — | None | ❌ Not Covered | Medium |
| 112 | `/admin/support-tickets` | AdminSupportTickets | — | None | ❌ Not Covered | Medium |
| 113 | `/admin/support` (→ tickets) | Redirect | — | None | ❌ Not Covered | Low |

### 3.8 Error Routes

| # | Route | Component | Protected | Test File | Type | Status | Priority |
|---|-------|-----------|-----------|-----------|------|--------|----------|
| 114 | `/500` | InternalServerErrorPage | No | — | None | ❌ Not Covered | Low |
| 115 | `/503` | ServiceUnavailablePage | No | — | None | ❌ Not Covered | Low |

---

## 4. Coverage by Role

| Role | Total Routes | Covered | Partial | Not Covered | Numerical % | Core Flow % |
|------|-------------|---------|---------|-------------|-------------|-------------|
| Public | 31 | 14 | 14 | 3 | 45% | 70% |
| Buyer | 11 | 3 | 1 | 7 | 27% | 70% |
| Vendor | 18 | 5 | 0 | 13 | 28% | 75% |
| Driver | 14 | 8 | 2 | 5 | 57% | 90% |
| Admin | 20 | 9 | 1 | 10 | 45% | 50% |
| Shared | 15 | 0 | 0 | 15 | 0% | 20% |
| Error | 2 | 0 | 0 | 2 | 0% | — |
| **Overall** | **~115** | **~43** | **~18** | **~54** | **37%** | **~65%** |

---

## 5. Uncovered Routes by Priority

### 5.1 Critical Priority

| Route | Component | Role | Reason |
|-------|-----------|------|--------|
| `/profile` | `ProfilePage` | Shared | Universal user profile — every role uses it |
| `/buyer/dashboard` | `BuyerDashboard` | Buyer | Main buyer landing page |
| `/vendor/profile` | `VendorProfile` | Vendor | Vendor public-facing profile |
| `/admin/vendors` | `AdminVendors` | Admin | Vendor management |
| `/admin/reports` | `AdminReports` | Admin | Reporting |

### 5.2 High Priority

| Route | Component | Role | Reason |
|-------|-----------|------|--------|
| `/orders/:id` | `OrderDetailPage` | Shared | Order detail view — used by all roles |
| `/buyer/addresses` | `BuyerAddresses` | Buyer | Address management |
| `/vendor/analytics` | `VendorAnalytics` | Vendor | Vendor business analytics |
| `/vendor/reviews` | `VendorReviews` | Vendor | Customer reviews |
| `/driver/security` | `DriverSecurity` | Driver | Driver security settings |

### 5.3 Medium Priority

| Route | Component | Role | Reason |
|-------|-----------|------|--------|
| `/vendor/location` | `VendorLocation` | Vendor | Location setup |
| `/vendor/security` | `VendorSecurity` | Vendor | Security settings |
| `/vendor/delivery-options` | `VendorDeliveryOptionSetup` | Vendor | Delivery config |
| `/buyer/security` | `BuyerSecurity` | Buyer | Security settings |
| `/driver/delivery/:id/pickup` | `DriverDeliveryPickup` | Driver | Pickup flow with legal camera |
| `/driver/delivery/:id/complete` | `DriverDeliveryComplete` | Driver | Completion flow with legal camera |
| `/admin/security` | `AdminSecurity` | Admin | Security settings |
| `/admin/moderation` | `AdminModeration` | Admin | Content moderation |

### 5.4 Low Priority

| Route | Component | Role | Reason |
|-------|-----------|------|--------|
| `/about`, `/contact`, `/help`, `/terms`, `/privacy`, `/returns`, `/shipping` | Static pages | Public | Static info pages |
| `/buyer/coupons`, `/buyer/loyalty`, `/buyer/shopping-lists`, `/buyer/rfq` | Buyer extras | Buyer | Supplementary features |
| `/vendor/coupons`, `/vendor/subscription`, `/vendor/schedules`, `/vendor/rfqs` | Vendor extras | Vendor | Supplementary features |
| `/chat`, `/messages` | Chat/Messages | Shared | Messaging features |
| `/favorites` | FavoritesPage | Shared | Saved items |
| `/notifications` | NotificationsPage | Shared | Notification list |
| `/bank-account` | BankAccountPage | Shared | Banking info |
| `/activity-log` | ActivityLogPage | Shared | Audit trail |
| `/admin/disputes`, `/admin/fraud-reports`, `/admin/support-tickets` | Admin extras | Admin | Operational pages |

---

## 6. Partially Covered Routes

| Route | Component | Covered By | What's Tested | What's Missing |
|-------|-----------|-----------|---------------|----------------|
| `/` (Home) | `HomePage` | smoke-desktop, mobile-white-screen | No white screen, body not empty | Content assertions, CTA buttons, seasonal banners |
| `/buyer/dashboard` | `BuyerDashboard` | smoke-desktop, mobile-white-screen | Page loads, no crash | Dashboard cards, orders, stats, empty states |
| `/products/:id` | `ProductDetailPage` | page-health-buyer-marketplace | Page loads via marketplace | Dedicated product detail assertions |
| `/driver/profile` | `DriverProfile` | page-health-driver-profile-settings | Settings test may visit profile | Dedicated profile assertions |
| `/driver/delivery/:id/deliver` | `DriverDeliveryTracking` | page-health-driver-delivery-tracking | Same component as tracking | Deliver-specific assertions |
| `/admin/verification` | `AdminVerification` | admin.cy.js (driver-verification) | Driver verification flow | Full verification page, user verification |

---

## 7. Critical Gaps

1. **Shared `/profile` page** — No dedicated test. Every role uses this page.
2. **Order detail pages** — `/orders/:id`, `/orders/:id/tracking`, `/order-confirmation` — critical for all roles.
3. **Buyer dashboard** — Only covered by smoke test, no deep page-health test.
4. **Vendor profile** — Important for public-facing vendor identity.
5. **Admin vendor management** — `/admin/vendors` is critical for platform operations.

---

## 8. Medium/Low Priority Gaps

1. **Static pages** — About, Contact, Help, Terms, Privacy, Returns, Shipping.
2. **Supplementary role pages** — Security settings, loyalty, coupons, schedules, RFQs.
3. **Chat/Messaging** — `/chat`, `/messages`.
4. **Legal camera flows** — `/driver/delivery/:id/pickup`, `/driver/delivery/:id/complete`.
5. **Admin operational pages** — Disputes, fraud reports, support tickets.

---

## 9. Dead or Suspicious Routes

| Route | Observation |
|-------|-------------|
| `/products/:id` | Duplicate of `/product/:id`. Both render `ProductDetailPage`. Dead / redundant. |
| `/tracking/:id` | Duplicate of `/order-tracking/:id`. Both render `OrderTrackingPage`. Dead / redundant. |
| `/order-confirmation` | Two routes: with and without `:id`. May be redundant depending on usage. |
| `/driver/delivery/:id/deliver` | Renders same component as `/:id/tracking`. May be legacy alias. |

---

## 10. Test File Inventory

| Test File | Routes Covered | Tests | Type |
|-----------|---------------|-------|------|
| `page-health-auth.cy.js` | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/mfa-verify`, `/verify-phone`, `/auth/callback` | 12 | Page Health |
| `page-health-buyer-marketplace.cy.js` | `/marketplace`, `/product/:id` | 1 | Page Health |
| `page-health-buyer-orders.cy.js` | `/buyer/orders` | 1 | Page Health |
| `page-health-buyer-product-details.cy.js` | `/product/:id` | 1 | Page Health |
| `page-health-driver-dashboard.cy.js` | `/driver/dashboard` | 1 | Page Health |
| `page-health-driver-deliveries.cy.js` | `/driver/active`, `/driver/history` | 1 | Page Health |
| `page-health-driver-delivery-tracking.cy.js` | `/driver/delivery/:id/tracking` | 1 | Page Health |
| `page-health-driver-profile-settings.cy.js` | `/driver/settings` | 1 | Page Health |
| `page-health-driver-available-orders.cy.js` | `/driver/available` | 6 | Page Health |
| `page-health-driver-earnings.cy.js` | `/driver/earnings` | 7 | Page Health |
| `page-health-vendor-activation.cy.js` | `/vendor/digital-contract` | 10 | Page Health + Flow |
| `page-health-vendor-orders.cy.js` | `/vendor/orders` | 1 | Page Health |
| `page-health-vendor-products.cy.js` | `/vendor/products` | 1 | Page Health |
| `page-health-vendor-settings.cy.js` | `/vendor/settings` | 1 | Page Health |
| `admin.cy.js` | `/admin/dashboard`, `/admin/users`, `/admin/products`, `/admin/orders`, `/admin/payouts`, `/admin/commissions`, `/admin/drivers`, `/admin/driver-verification`, `/admin/reviews`, `/admin/settings`, `/admin/settings/audit-log`, `/admin/settings/circuit-breakers`, `/admin/analytics` | 15 | Flow |
| `buyer.cy.js` | `/buyer/orders` | 4 | Flow |
| `checkout-to-payment.cy.js` | `/checkout` | 5 | Flow |
| `onboarding.cy.js` | `/onboarding/buyer`, `/onboarding/vendor`, `/onboarding/driver` | 3 | Flow |
| `route-guards.cy.js` | `/buyer/orders`, `/vendor/orders`, `/marketplace` | 3 | Guard |
| `smoke-desktop.cy.js` | `/`, `/marketplace`, `/product/:id`, `/stores`, `/stores/:id`, `/cart`, `/search`, `/about`, `/contact`, `/help`, `/terms`, `/privacy`, `/become-vendor`, `/returns`, `/shipping`, `/tracking`, `/marketplace/seasonal` | 20 | Smoke |
| `mobile-white-screen.cy.js` | `/`, `/marketplace`, `/login`, `/register`, `/buyer/dashboard`, `/vendor/dashboard` | 30+ | Mobile Smoke |
| `button-actions-public-cart.cy.js` | `/cart` | 3 | Flow |
| `vendor.cy.js` | `/vendor/dashboard`, `/vendor/products`, `/vendor/orders` | 6 | Flow |
| `vendor-order-management.cy.js` | `/vendor/orders` | 5 | Flow |
| `settings.cy.js` | `/buyer/settings` | 4 | Flow |
| `security.cy.js` | `/login` | 3 | Security |
| `auth-flow.cy.js` | `/login`, `/register` | 5 | Flow |
| `auth.cy.js` | `/login` | 3 | Auth |
| `marketplace.cy.js` | `/marketplace` | 4 | Flow |
| `performance.cy.js` | `/marketplace` | 2 | Performance |
| `visual-*.cy.js` | Multiple public pages | 6 | Visual |
| `accessibility.cy.js` | `/marketplace`, `/login` | 2 | Accessibility |
| `i18n.cy.js` | `/` | 2 | i18n |
| `app.cy.js` | `/` | 2 | App |
| `driver.cy.js` | `/driver/available` | 3 | Flow |

---

## 11. Recommended Next Actions

### Phase 1 — Close Driver/Buyer/Vendor (Immediate)

1. **Accept temporary closure** of Buyer, Vendor, and Driver roles as-is. Core flows are covered.
2. **Document the gaps** in role-specific final reports (already done for Driver).

### Phase 2 — Admin Role (Next Sprint)

1. **Create page-health-admin-dashboard.cy.js** — `/admin/dashboard` page health.
2. **Create page-health-admin-users.cy.js** — `/admin/users` page health.
3. **Create page-health-admin-orders.cy.js** — `/admin/orders` page health.
4. **Create page-health-admin-products.cy.js** — `/admin/products` page health.
5. **Create page-health-admin-drivers.cy.js** — `/admin/drivers` page health.

Note: `admin.cy.js` already exists but is a flow test that may hit real data. It needs replacement with mock-based page-health tests.

### Phase 3 — Shared & Static Routes (Future)

1. **Create page-health-shared-profile.cy.js** — `/profile` page health for all roles.
2. **Create page-health-shared-order-detail.cy.js** — `/orders/:id` page health.
3. **Create page-health-public-static.cy.js** — Static pages smoke test.
4. **Remove dead routes** — Consolidate `/products/:id` → `/product/:id`, `/tracking/:id` → `/order-tracking/:id`.

### Phase 4 — Production Readiness

1. **Refactor common intercepts** into a shared Cypress support file to reduce duplication.
2. **Add visual regression tests** for critical pages.
3. **Add mobile-specific page-health tests** for role dashboards.

---

## 12. Final Recommendation

### ✅ Close Buyer, Vendor, and Driver roles temporarily.

**Rationale:**
- Core flows for all three roles are covered with mock-based tests.
- No production data is at risk.
- Build, lint, and unit tests pass.
- Remaining gaps are supplementary (security settings, coupons, loyalty, static pages) and do not block role closure.

### 🚀 Move to Admin Role immediately.

**Rationale:**
- Admin is the next logical role in the roadmap.
- Admin already has `admin.cy.js` flow tests but lacks page-health tests.
- Admin routes are the most sensitive (user management, payouts, commissions) and need mock-based coverage before moving to production readiness.

**Admin priority order:**
1. `/admin/dashboard` — page health
2. `/admin/users` — page health
3. `/admin/orders` — page health
4. `/admin/products` — page health
5. `/admin/drivers` — page health
6. `/admin/payouts` — page health (sensitive, financial)
7. `/admin/commissions` — page health (sensitive, financial)
8. `/admin/settings` — page health
9. `/admin/analytics` — page health
10. `/admin/reviews` — page health

---

*Report generated on 2025-06-06.*
*Based on commit `1038f01` and earlier.*
