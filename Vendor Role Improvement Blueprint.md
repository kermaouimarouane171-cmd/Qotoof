---
# Vendor Role Improvement Blueprint
## Qotoof (قطوف) Marketplace — Integrated Product Team Reference

**Document Version:** 1.0  
**Date:** 2025  
**Role:** Vendor (بائع)  
**Status:** Active Development  

---

## 1. Executive Summary

The Vendor role is the most complex role in the Qotoof marketplace. It covers the full seller lifecycle: onboarding, digital contract signing, product management, order fulfillment, driver partnerships, analytics, commissions, and store settings. The audit reveals a **functionally complete role** with critical gaps in TanStack Query adoption (0% — all pages use legacy patterns), significant hardcoded Arabic strings across setup flows, and missing i18n keys for several sub-sections.

---

## 2. Role Overview

### 2.1 Scope

| Domain | Files | Status |
|--------|-------|--------|
| Pages | 17 vendor pages | ✅ Implemented |
| Components | 8 vendor components | ⚠️ Hardcoded strings |
| Onboarding | VendorOnboarding.jsx + DigitalContract.jsx | ⚠️ No i18n |
| Setup Flows | LocationSetup, DeliveryOptionSetup, DriverPreferenceSetup | ⚠️ Hardcoded strings |
| Layout | ProtectedRoute.jsx (VendorLayout) | ✅ Active |

### 2.2 Vendor Routes

| Route | Page | i18n | Data Pattern |
|-------|------|------|--------------|
| `/vendor/dashboard` | Dashboard.jsx | ⚠️ Partial | useEffect |
| `/vendor/products` | Products.jsx | ⚠️ Partial | useEffect |
| `/vendor/orders` | Orders.jsx | ⚠️ Partial | useEffect |
| `/vendor/analytics` | Analytics.jsx | ✅ | useEffect |
| `/vendor/profile` | Profile.jsx | ❌ Missing keys | useEffect |
| `/vendor/settings` | Settings.jsx | ❌ Missing keys | useEffect |
| `/vendor/security` | Security.jsx | ❌ Missing keys | useEffect |
| `/vendor/reviews` | Reviews.jsx | ❌ Missing keys | useEffect |
| `/vendor/returns` | Returns.jsx | ✅ | useEffect |
| `/vendor/coupons` | Coupons.jsx | ✅ | useEffect |
| `/vendor/negotiate` | Negotiation.jsx | ❌ Missing keys | useEffect |
| `/vendor/find-driver` | FindDriver.jsx | ✅ | useEffect |
| `/vendor/digital-contract` | DigitalContract.jsx | ❌ Hardcoded | useEffect |
| `/vendor/location-setup` | LocationSetup.jsx | ❌ Hardcoded | useEffect |
| `/vendor/delivery-option` | DeliveryOptionSetup.jsx | ❌ Hardcoded | useEffect |
| `/vendor/driver-preference` | DriverPreferenceSetup.jsx | ❌ Hardcoded | useEffect |
| `/vendor/onboarding` | VendorOnboarding.jsx | ❌ Hardcoded | Static |

---

## 3. Unified Audit Findings

### 3.1 i18n Coverage — CRITICAL GAPS

#### Missing i18n namespaces in ar.json

| Namespace | Page(s) Affected | Severity |
|-----------|-----------------|----------|
| `vendor.dashboard` | Dashboard.jsx | High |
| `vendor.products` | Products.jsx | High |
| `vendor.profile` | Profile.jsx | High |
| `vendor.settings` | Settings.jsx | High |
| `vendor.security` | Security.jsx | Medium |
| `vendor.reviews` | Reviews.jsx | High (hardcoded Arabic fallback) |
| `vendor.negotiation` | Negotiation.jsx | Medium |
| `vendor.findDriver` | FindDriver.jsx | Medium |
| `vendor.digitalContract` | DigitalContract.jsx | High |
| `vendor.deliveryOptionSetup` | DeliveryOptionSetup.jsx | High |
| `vendor.driverPreferenceSetup` | DriverPreferenceSetup.jsx | High |
| `onboarding.vendor` | VendorOnboarding.jsx | High |

#### Already present in ar.json ✅
- `vendor.schedules`
- `vendor.locationSetup`
- `vendor.returns`
- `vendor.wallet`
- `vendor.rfqs`
- `vendor.orders`
- `vendor.coupons`

#### Hardcoded strings NOT using t() — File-by-File

**Dashboard.jsx:**
```js
// Lines 84-86 — English fallbacks in _getDayLabel
'Today'
'Yesterday'
toLocaleDateString('fr-MA', ...) // locale hardcoded
```

**Orders.jsx:**
```js
// Line 74 — Real-time toast
`🛒 New order received: ${payload.new.order_number || 'Order'}!`
```

**Profile.jsx:**
```js
// Lines 34-38 — Tab labels
'Store Info', 'Location', 'Hours', 'Security', 'Preferences'
```

**Reviews.jsx:**
```js
// Lines 62, 78 — Error toasts (hardcoded Arabic)
toast.error('تعذر تحميل التقييمات')
toast.error('تعذر تحديد حساب البائع الحالي')
```

**DigitalContract.jsx:**
```js
// Lines 40-67 — Full contract summary items (hardcoded Arabic)
CONTRACT_SUMMARY_ITEMS
// Lines 70-80 — Full contract legal text (hardcoded Arabic)
buildFullContractText
```

**LocationSetup.jsx:**
```js
// Line 61
toast.error('يرجى اختيار موقع داخل حدود المغرب')
```

**DeliveryOptionSetup.jsx:**
```js
// Lines 40, 51, 75
toast.error('تعذر تحميل إعدادات التوصيل')
toast.error('يرجى اختيار خيار التوصيل أولاً')
toast.success('تم حفظ الخيار. أكمل الآن ربط السائق قبل قبول الطلبات الجديدة.')
```

**DriverPreferenceSetup.jsx:**
```js
// Line 56
toast.error('يرجى اختيار ما إذا كنت تريد سائقاً مفضلاً أم لا')
```

**VendorOnboarding.jsx:**
```js
// Lines 4-50 — All 4 slide content blocks (hardcoded Arabic)
VENDOR_SLIDES
// Lines 56-60
roleLabel="تهيئة البائع"
completeLabel="وقّع العقد وابدأ →"
```

**Components with hardcoded Arabic:**
- `ProductForm.jsx` — Lines 43, 50, 54 (toast error messages)
- `InventoryManager.jsx` — Lines 16-19 (FILTERS array), line 45 (toast error)
- `CancellationPolicy.jsx` — Lines 14-17 (FEE_TYPE_OPTIONS), lines 26/30/37/53/56 (labels)
- `RefundPolicySettings.jsx` — Lines 5-8 (SHIPPING_OPTIONS), lines 22/25/30/41 (labels)
- `PaymentPolicySettings.jsx` — Lines 12-34 (PAYMENT_OPTIONS — all descriptions)

### 3.2 Color Token Inconsistencies

**Vendor pages consistently use `green-*`** — no `primary-*` tokens found. This is the correct brand pattern.

**Minor inconsistency:** `PaymentPolicySettings.jsx` uses `emerald-*`, `amber-*`, `rose-*` per-policy, which is intentional semantic coloring (good).

**Assessment:** Vendor color tokens are consistent — no action required.

### 3.3 Data Fetching — 0% TanStack Query Adoption

This is the most critical technical debt in the vendor role. **ALL 17 vendor pages** use plain `useState + useEffect` instead of TanStack Query.

| Impact | Description |
|--------|-------------|
| No caching | Every navigation re-fetches all data |
| No deduplication | Multiple components may request the same data |
| Manual loading states | Each page manages its own isLoading/isError state |
| Inconsistency | Buyer/admin pages are partially migrated; vendor is 0% |

**ESLint suppressions for useEffect dependency issues:**
- `Profile.jsx` line 81 — `react-hooks/exhaustive-deps` suppressed
- `Settings.jsx` lines 75-79 — `react-hooks/exhaustive-deps` suppressed

### 3.4 Locale Hardcoding

| File | Location | Issue |
|------|----------|-------|
| `Dashboard.jsx` | Line 86 | `toLocaleDateString('fr-MA', ...)` — ignores i18n language |
| `CommissionDashboard.jsx` | Line 13 | `getLocale` maps language to hardcoded locale string |
| `Returns.jsx` | Lines 33-34 | `getLocale` maps language to hardcoded locale string |

**Fix:** Use `const { i18n } = useTranslation()` and `i18n.language` to determine locale dynamically.

### 3.5 Onboarding Flow Analysis

The vendor onboarding follows this required sequence:
1. `/vendor/onboarding` — 4 slides (hardcoded Arabic)
2. `/vendor/digital-contract` — Legal contract signing (hardcoded Arabic)
3. `/vendor/location-setup` — Map-based location setup
4. `/vendor/delivery-option` — Delivery method selection
5. `/vendor/driver-preference` — Driver linking
6. → Access to full vendor dashboard

**Issue:** Steps 1-5 all have hardcoded Arabic content. English/French users cannot use the vendor onboarding flow.

### 3.6 Digital Contract Concerns

The `DigitalContract.jsx` file contains:
- Full contract legal text in hardcoded Arabic
- Commission terms, payment timeline, and legal obligations
- **This is a legal/compliance risk:** contracts must be available in all supported languages

---

## 4. Development Objectives

1. **Add missing i18n namespaces** — 11 namespaces need to be added to ar.json
2. **Externalize hardcoded strings** — 15+ files with hardcoded Arabic/English
3. **Migrate to TanStack Query** — 17 pages, prioritized by frequency of use
4. **Fix locale hardcoding** — Use i18n.language instead of hardcoded 'fr-MA'
5. **Translate digital contract** — Legal compliance for multi-language support
6. **Fix onboarding i18n** — All setup slides must be translatable

---

## 5. Development Phases

### Phase 1 — Critical i18n & Hardcoded Strings (Sprint 1)
**Duration:** 1.5 sprints | **Risk:** Low | **Impact:** High

- [ ] Add `vendor.dashboard` keys to all locale files
- [ ] Add `vendor.products` keys to all locale files
- [ ] Add `vendor.profile` keys (including tab labels: storeInfo, location, hours, security, preferences)
- [ ] Add `vendor.settings` keys to all locale files
- [ ] Add `vendor.reviews` keys + replace hardcoded toasts in Reviews.jsx
- [ ] Add `vendor.negotiation` keys to all locale files
- [ ] Add `vendor.digitalContract` keys + externalize CONTRACT_SUMMARY_ITEMS
- [ ] Add `vendor.deliveryOptionSetup` keys + fix all hardcoded toasts
- [ ] Add `vendor.driverPreferenceSetup` keys + fix hardcoded toast
- [ ] Add `onboarding.vendor` keys + localize VendorOnboarding.jsx slides
- [ ] Fix Orders.jsx real-time toast (hardcoded English)
- [ ] Fix Dashboard.jsx _getDayLabel (hardcoded English)

**Components:**
- [ ] Localize `ProductForm.jsx` toast errors
- [ ] Localize `InventoryManager.jsx` FILTERS array + toast error
- [ ] Localize `CancellationPolicy.jsx` all labels
- [ ] Localize `RefundPolicySettings.jsx` all labels
- [ ] Localize `PaymentPolicySettings.jsx` PAYMENT_OPTIONS descriptions

### Phase 2 — Locale & Date Fix (Sprint 1)
**Duration:** 0.5 sprint | **Risk:** Low | **Impact:** Medium

- [ ] Fix `Dashboard.jsx` — use `i18n.language` instead of hardcoded `'fr-MA'`
- [ ] Fix `CommissionDashboard.jsx` — dynamic locale from i18n
- [ ] Fix `Returns.jsx` — dynamic locale from i18n

### Phase 3 — TanStack Query Migration (Sprints 2-3)
**Duration:** 3 sprints | **Risk:** Medium | **Impact:** High

Migrate all vendor pages to TanStack Query. Priority order:

**Tier 1 (high traffic):**
1. `Dashboard.jsx` — Entry point, most visited
2. `Orders.jsx` — Most critical business flow
3. `Products.jsx` — Most used by vendors daily

**Tier 2 (medium traffic):**
4. `Analytics.jsx`
5. `Reviews.jsx`
6. `Returns.jsx`
7. `Coupons.jsx`

**Tier 3 (setup/config pages):**
8. `Profile.jsx`
9. `Settings.jsx`
10. `Security.jsx`
11. `Negotiation.jsx`
12. `FindDriver.jsx`

**Tier 4 (onboarding/setup — one-time flows):**
13. `DigitalContract.jsx`
14. `LocationSetup.jsx`
15. `DeliveryOptionSetup.jsx`
16. `DriverPreferenceSetup.jsx`
17. `InventoryManager.jsx`, `CommissionDashboard.jsx`

### Phase 4 — ESLint & Dependency Fixes (Sprint 3)
**Duration:** 0.5 sprint | **Risk:** Low | **Impact:** Low

- [ ] Fix `Profile.jsx` line 81 — resolve `exhaustive-deps` without suppression
- [ ] Fix `Settings.jsx` lines 75-79 — resolve `exhaustive-deps` without suppression
- [ ] Fix `VendorOnboarding.jsx` line 55 — resolve `jsx-a11y/aria-role` warning

---

## 6. Task Breakdown (Backlog)

### P0 — Critical

| ID | Task | File | Effort |
|----|------|------|--------|
| V-001 | Add `vendor.dashboard` keys + fix Dashboard.jsx | Dashboard.jsx + locale files | M |
| V-002 | Add `vendor.profile` keys + fix Profile.jsx tab labels | Profile.jsx + locale files | M |
| V-003 | Add `vendor.reviews` keys + fix Reviews.jsx toasts | Reviews.jsx + locale files | S |
| V-004 | Add `vendor.digitalContract` + externalize contract text | DigitalContract.jsx + locale files | L |
| V-005 | Add `vendor.deliveryOptionSetup` + fix toasts | DeliveryOptionSetup.jsx + locale files | S |
| V-006 | Add `vendor.driverPreferenceSetup` + fix toast | DriverPreferenceSetup.jsx + locale files | S |
| V-007 | Add `onboarding.vendor` + localize VendorOnboarding.jsx | VendorOnboarding.jsx + locale files | M |
| V-008 | Fix Orders.jsx real-time notification (hardcoded English) | Orders.jsx | XS |
| V-009 | Localize PaymentPolicySettings.jsx PAYMENT_OPTIONS | PaymentPolicySettings.jsx + locale files | S |
| V-010 | Localize CancellationPolicy.jsx all labels | CancellationPolicy.jsx + locale files | S |
| V-011 | Localize RefundPolicySettings.jsx all labels | RefundPolicySettings.jsx + locale files | S |

### P1 — High

| ID | Task | File | Effort |
|----|------|------|--------|
| V-012 | Add `vendor.products` keys | Products.jsx + locale files | M |
| V-013 | Add `vendor.settings` keys | Settings.jsx + locale files | M |
| V-014 | Add `vendor.security` keys | Security.jsx + locale files | S |
| V-015 | Add `vendor.negotiation` keys | Negotiation.jsx + locale files | S |
| V-016 | Add `vendor.findDriver` keys | FindDriver.jsx + locale files | S |
| V-017 | Localize ProductForm.jsx toast errors | ProductForm.jsx + locale files | XS |
| V-018 | Localize InventoryManager.jsx FILTERS + toast | InventoryManager.jsx + locale files | S |
| V-019 | Fix locale hardcoding in Dashboard.jsx + CommissionDashboard.jsx | 2 files | XS |

### P2 — Medium (TanStack Query migration)

| ID | Task | File | Effort |
|----|------|------|--------|
| V-020 | Migrate Dashboard.jsx to TanStack Query | Dashboard.jsx | M |
| V-021 | Migrate Orders.jsx to TanStack Query | Orders.jsx | L |
| V-022 | Migrate Products.jsx to TanStack Query | Products.jsx | L |
| V-023 | Migrate Analytics.jsx to TanStack Query | Analytics.jsx | M |
| V-024 | Migrate Reviews.jsx to TanStack Query | Reviews.jsx | M |
| V-025 | Migrate Returns.jsx to TanStack Query | Returns.jsx | M |
| V-026 | Migrate Coupons.jsx to TanStack Query | Coupons.jsx | M |

### P3 — Low

| ID | Task | File | Effort |
|----|------|------|--------|
| V-027 | Migrate Profile.jsx, Settings.jsx, Security.jsx | 3 files | L |
| V-028 | Migrate Negotiation.jsx, FindDriver.jsx | 2 files | M |
| V-029 | Migrate setup flows (Location, Delivery, Driver) | 3 files | M |
| V-030 | Fix ESLint suppressions in Profile.jsx, Settings.jsx | 2 files | S |

---

## 7. File Inventory

### Pages (`src/pages/vendor/`)

| File | Lines | i18n | Color | Data Pattern | Priority Issues |
|------|-------|------|-------|--------------|-----------------|
| Dashboard.jsx | ~400 | ⚠️ | ✅ | useEffect | V-001, V-019, V-020 |
| Products.jsx | ~600 | ⚠️ | ✅ | useEffect | V-012, V-022 |
| Orders.jsx | ~500 | ⚠️ | ✅ | useEffect | V-008, V-021 |
| Analytics.jsx | ~400 | ✅ | ✅ | useEffect | V-023 |
| Profile.jsx | ~500 | ❌ | ✅ | useEffect | V-002, V-027 |
| Settings.jsx | ~400 | ❌ | ✅ | useEffect | V-013, V-027 |
| Security.jsx | ~400 | ❌ | ✅ | useEffect (custom hooks) | V-014, V-027 |
| Reviews.jsx | ~300 | ❌ | ✅ | useEffect | V-003, V-024 |
| Returns.jsx | ~400 | ✅ | ✅ | useEffect | V-025 |
| Coupons.jsx | ~400 | ✅ | ✅ | useEffect | V-026 |
| Negotiation.jsx | ~400 | ❌ | ✅ | useEffect | V-015, V-028 |
| FindDriver.jsx | ~400 | ✅ | ✅ | useEffect | V-028 |
| DigitalContract.jsx | ~400 | ❌ | ✅ | useEffect | V-004 |
| LocationSetup.jsx | ~400 | ⚠️ | ✅ | useEffect | V-005 |
| DeliveryOptionSetup.jsx | ~300 | ❌ | ✅ | useEffect | V-005, V-029 |
| DriverPreferenceSetup.jsx | ~200 | ❌ | ✅ | useEffect | V-006, V-029 |
| VendorOnboarding.jsx | 65 | ❌ | ✅ | Static | V-007 |

### Components (`src/components/vendor/`)

| File | Lines | i18n | Notes |
|------|-------|------|-------|
| ProductForm.jsx | ~400 | ⚠️ | Hardcoded toast errors (V-017) |
| InventoryManager.jsx | ~200 | ❌ | Hardcoded FILTERS + toast (V-018) |
| CommissionDashboard.jsx | ~200 | ✅ | Locale hardcoding (V-019) |
| PendingOrdersPanel.jsx | ~100 | ✅ | Clean |
| RecentOrdersWidget.jsx | ~100 | ✅ | Clean |
| CancellationPolicy.jsx | ~150 | ❌ | All labels hardcoded (V-010) |
| RefundPolicySettings.jsx | ~150 | ❌ | All labels hardcoded (V-011) |
| PaymentPolicySettings.jsx | ~150 | ❌ | PAYMENT_OPTIONS hardcoded (V-009) |

---

## 8. Dependency Analysis

### External Dependencies

| Dependency | Used For |
|------------|----------|
| `@tanstack/react-query` | NOT yet used in vendor (critical gap) |
| `@supabase/supabase-js` | All data access |
| `react-i18next` | i18n (partially adopted) |
| `chart.js` | Analytics charts |
| `mammoth` | DOCX bulk upload parsing |
| `leaflet` | Map in LocationSetup |

### Internal Module Dependencies

```
Settings.jsx → cancellationService, refundPolicyService, profilesService
DigitalContract.jsx → APP_CONFIG.commissionRate, MOROCCAN_BANKS, hasValidPayPalEmail
Security.jsx → useSecurityData, usePasswordStrength, useSecurityActions, trustScoreService
```

---

## 9. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Digital contract not in English/French = legal risk | High | Critical | V-004 first priority |
| 17-page TanStack migration causes regression | Medium | High | Incremental per-page migration with tests |
| ESLint suppressed deps in Profile.jsx mask real bug | Medium | Medium | Fix deps properly, don't suppress |
| Orders.jsx real-time English toast for Arabic users | High | Medium | V-008 quick fix in Sprint 1 |
| Profile tab labels in English for Arabic users | High | High | V-002 Sprint 1 |

---

## 10. Testing Strategy

### Unit Tests Required
- [ ] VendorOnboarding — slides render with i18n keys
- [ ] DigitalContract — contract text renders in correct language
- [ ] PaymentPolicySettings — COD activation warning with trust score check
- [ ] Orders.jsx — real-time subscription handler

### Integration Tests Required
- [ ] Full vendor onboarding flow (4 steps)
- [ ] Product creation with image upload
- [ ] Order acceptance → driver assignment flow
- [ ] Commission payment flow

---

## 11. Definition of Done

For each task to be marked complete:
- [ ] Code change implemented and reviewed
- [ ] i18n keys added to ar.json, en.json, fr.json
- [ ] No hardcoded Arabic or English strings in JSX
- [ ] Color tokens use `green-*`/`emerald-*` (already consistent)
- [ ] toast messages use `t()` with fallback
- [ ] No new ESLint suppressions added
- [ ] Existing tests pass

---

## 12. Execution Order (Sprints)

### Sprint 1 — i18n & Hardcoded Strings
| # | Task | Est. |
|---|------|------|
| 1 | V-008: Fix Orders.jsx real-time toast | 30m |
| 2 | V-001: vendor.dashboard keys + Dashboard fixes | 2h |
| 3 | V-002: vendor.profile keys + Profile tab labels | 2h |
| 4 | V-003: vendor.reviews keys + Reviews toasts | 1h |
| 5 | V-005: vendor.deliveryOptionSetup + toasts | 1h |
| 6 | V-006: vendor.driverPreferenceSetup + toast | 30m |
| 7 | V-009: PaymentPolicySettings i18n | 1h |
| 8 | V-010: CancellationPolicy i18n | 1h |
| 9 | V-011: RefundPolicySettings i18n | 1h |
| 10 | V-017: ProductForm toast errors | 30m |
| 11 | V-018: InventoryManager FILTERS + toast | 1h |
| 12 | V-019: Fix locale hardcoding (3 files) | 1h |

### Sprint 2 — Digital Contract + Remaining i18n
| # | Task | Est. |
|---|------|------|
| 1 | V-004: vendor.digitalContract + full externalization | 6h |
| 2 | V-007: onboarding.vendor + VendorOnboarding slides | 3h |
| 3 | V-012 to V-016: Remaining namespace keys | 4h |

### Sprint 3 — TanStack Query Tier 1
| # | Task | Est. |
|---|------|------|
| 1 | V-020: Migrate Dashboard.jsx | 3h |
| 2 | V-021: Migrate Orders.jsx | 5h |
| 3 | V-022: Migrate Products.jsx | 5h |

### Sprint 4 — TanStack Query Tier 2-3
| # | Task | Est. |
|---|------|------|
| 1 | V-023 to V-026: Analytics, Reviews, Returns, Coupons | 12h |
| 2 | V-027 to V-029: Config pages + setup flows | 10h |
| 3 | V-030: Fix ESLint suppressions | 2h |

---

## 13. Future Enhancements (Post-Blueprint)

1. **Vendor analytics v2** — Cohort analysis, customer retention, repeat purchase rate
2. **Bulk product operations** — Bulk price update, bulk category change
3. **Store themes** — Customizable store appearance
4. **Vendor notifications** — Push notifications for new orders
5. **Inventory alerts** — Automatic low-stock alerts with configurable thresholds
6. **Driver rating system** — Vendor rates drivers after delivery
7. **Store hours enforcement** — Automatically reject orders outside operating hours
8. **Multi-language store** — Vendors can add product descriptions in multiple languages

---

*Blueprint generated by Qotoof Integrated Product Team — Based on full codebase audit.*
