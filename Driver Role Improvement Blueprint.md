# Driver Role Improvement Blueprint
## Qotoof (قطوف) Marketplace — Integrated Product Team Reference

**Document Version:** 1.0  
**Date:** 2025  
**Role:** Driver (سائق)  
**Status:** Active Development  

---

## 1. Executive Summary

The Driver role is the most technically sophisticated role in the Qotoof marketplace. It features real-time GPS tracking, Supabase real-time subscriptions, legal camera capture, and delivery lifecycle management. The audit reveals a **functionally complete and production-ready role** with targeted gaps in i18n coverage (hardcoded strings in 4 components), deprecated Express API dead code that can be safely removed, and inconsistent import/data-fetching patterns across pages.

**Key finding:** The driver Express API (`driver.routes.js`, `driver.controller.js`, `driver.service.js`) is fully deprecated with Supabase replacements in place — these 3 files should be deleted.

---

## 2. Role Overview

### 2.1 Scope

| Domain | Files | Status |
|--------|-------|--------|
| Pages | 15 driver pages + 1 onboarding | ✅ Implemented |
| Components | 4 driver components | ⚠️ Hardcoded strings |
| Map Component | LiveDriverMap.jsx | ⚠️ Hardcoded title |
| Real-time | realtimeService + Supabase channels | ✅ Active |
| GPS | driverLocationService + navigator.geolocation | ✅ Active |
| Layout | ProtectedRoute.jsx (DriverLayout) | ✅ Active |
| Deprecated | 3 Express API files | 🗑️ Safe to delete |

### 2.2 Driver Routes

| Route | Page | i18n Keys | Data Pattern |
|-------|------|-----------|--------------|
| `/driver/dashboard` | Dashboard.jsx | ❌ `driver.dashboard.*` missing | useEffect |
| `/driver/active` | Active.jsx | ❌ `driver.active.*` missing | useEffect + realtime |
| `/driver/available` | Available.jsx | ✅ | Service layer |
| `/driver/delivery/:id/tracking` | DeliveryTracking.jsx | ✅ | Service layer |
| `/driver/delivery/:id/pickup` | DeliveryPickup.jsx | ✅ | Service layer |
| `/driver/delivery/:id/complete` | DeliveryComplete.jsx | ✅ | Service layer |
| `/driver/delivery/:id/summary` | DeliverySummary.jsx | ❌ `driver.summary.*` missing | Service layer |
| `/driver/earnings` | Earnings.jsx | ✅ | Direct Supabase |
| `/driver/history` | History.jsx | ❌ `driver.history.*` missing | Direct Supabase |
| `/driver/performance` | Performance.jsx | ❌ `driver.performance.*` missing | Direct Supabase |
| `/driver/profile` | Profile.jsx | ✅ | Direct Supabase |
| `/driver/security` | Security.jsx | ✅ | Security hooks |
| `/driver/settings` | Settings.jsx | ✅ | Module services |
| `/driver/find-vendor` | FindVendor.jsx | ✅ | Service layer |
| `/driver/wallet` | Wallet.jsx | ❌ `driver.wallet.*` missing | Direct Supabase |
| `/driver/vendor-preference` | VendorPreferenceSetup.jsx | ❌ `driver.vendorPrefs.*` missing | Direct Supabase |
| `/driver/onboarding` | DriverOnboarding.jsx | ❌ Hardcoded Arabic | Static |

---

## 3. Unified Audit Findings

### 3.1 i18n Coverage

#### Well-covered namespaces (present in ar.json)
- ✅ `layout.driver.*` — Navigation links (lines 4501-4520)
- ✅ `driver.available.*` — Available deliveries (lines 3560-3578)
- ✅ `driver.earnings.*` — Earnings page (lines 3580-3595)
- ✅ `driver.profile.*` — Profile page (lines 3597-3615)
- ✅ `driver.security.*` — Security page (lines 3617-3657)
- ✅ `driver.pricing.*` — Pricing settings (lines 3659-3693)
- ✅ `driver.deliveryPickup.*` — Pickup confirmation (lines 3695-3707)
- ✅ `driver.deliveryComplete.*` — Delivery completion (lines 3709-3724)
- ✅ `driver.tracking.*` — GPS tracking (lines 3726-3728)
- ✅ `becomeDriver.*` — Driver registration (lines 4278-4315)

#### Missing namespaces (NOT in ar.json)

| Namespace | Page | Severity |
|-----------|------|----------|
| `driver.dashboard.*` | Dashboard.jsx | High |
| `driver.active.*` | Active.jsx | High |
| `driver.history.*` | History.jsx | Medium |
| `driver.performance.*` | Performance.jsx | Medium |
| `driver.wallet.*` | Wallet.jsx | Medium |
| `driver.vendorPrefs.*` | VendorPreferenceSetup.jsx | Low |
| `driver.summary.*` | DeliverySummary.jsx | Medium |

#### Hardcoded strings NOT using t()

**DeliveryPaymentPolicy.jsx** (component in Settings page):
```jsx
// Lines 17-18
"سياسة تحصيل رسم التوصيل"   // Policy section title
// Lines 30-31
"نقداً عند التسليم"            // Cash on delivery option
// Lines 44-46
"تحويل بنكي للسائق"           // Bank transfer option
// Lines 58-59
"ملاحظات قانونية للمشتري"      // Legal notes for buyer
```

**DeliveryPreferences.jsx** (component in Settings page):
```jsx
// Line 18
"تفضيلات التوصيل القانونية"   // Section title
// Line 23
"أدنى مسافة أقبلها (كم)"      // Min distance label
// Line 34
"أقصى مسافة أقبلها (كم)"      // Max distance label
// Line 46
"أحجام الحمولة المقبولة"       // Cargo sizes label
```

**DriverAvailabilityToggle.jsx** (component used in Dashboard):
```jsx
// Line 24
"🟢 You are now available for deliveries!"  // English toast
// Line 26
"🔴 You are now offline"                     // English toast
// Line 55
"Available for Deliveries"                   // English label
// Line 59
"Currently Offline"                          // English label
// Line ~60
"Failed to update status"                    // English error
```

**LiveDriverMap.jsx** (map component):
```jsx
// Line 21 — default prop
title = 'الموقع الحي للسائق'   // Arabic default prop
```

**Additional isolated hardcoded strings:**
```jsx
// DeliveryComplete.jsx line 50
toast.error('يجب توثيق مرحلة ما قبل التسليم بالكاميرا القانونية أولاً.')

// Profile.jsx line 61
toast.error('أدخل رقم الهاتف الجديد للتحقق منه أولاً')
```

**Dashboard.jsx line 111 — English fallback:**
```jsx
t('driver.dashboard.newDeliveryRequest', '🆕 New delivery request available!')
// If key missing → English fallback shown to Arabic users
```

### 3.2 Color Token Inconsistencies

| Status | Location | Issue |
|--------|----------|-------|
| ✅ Consistent | All driver pages | Use `green-*`/`emerald-*` correctly |
| ❌ Inconsistent | `ProtectedRoute.jsx` line 1073 | `bg-blue-600` for driver panel icon |
| ⚠️ Semantic | `DeliveryComplete.jsx` lines 95-96 | `red-*` for destination pin (may be intentional) |

**Fix required:** Change `bg-blue-600` → `bg-green-600` in DriverLayout panel icon (ProtectedRoute.jsx line 1073).

### 3.3 Data Fetching Patterns

| Pattern | Pages | Assessment |
|---------|-------|------------|
| Service layer (`deliveriesApi`, etc.) | Dashboard, Active, Available, Tracking, Pickup, Complete, Summary, FindVendor | ✅ Best pattern |
| Direct Supabase queries | Earnings, History, Performance, Profile, Wallet, VendorPreferenceSetup | ⚠️ No service abstraction |
| Module services | Settings, Security | ✅ Good abstraction |
| Static (no fetching) | DriverOnboarding | ✅ Appropriate |

**No TanStack Query usage found in driver pages.** All async pages use plain `useEffect + useState`.

**Recommendation:** Migrate `Earnings.jsx`, `History.jsx`, `Performance.jsx`, `Wallet.jsx` from direct Supabase to service layer first, then wrap with TanStack Query.

### 3.4 Import Path Inconsistency

| File | Import Path Used | Standard Path |
|------|-----------------|---------------|
| `Settings.jsx` | `@/modules/auth` | `@/store/authStore` |
| `Settings.jsx` | `@/modules/users` | Direct service import |
| All other driver pages | `@/store/authStore` | ✅ Standard |

**Fix:** Update `Settings.jsx` to use `@/store/authStore` for consistency.

### 3.5 Deprecated Express API (Safe to Delete)

Three files are fully deprecated and have zero active references from the frontend:

| File | Status | Supabase Replacement |
|------|--------|---------------------|
| `src/api/routes/driver.routes.js` | 🗑️ All routes marked `@deprecated RETIRE` | `deliveriesApi.*` |
| `src/api/controllers/driver.controller.js` | 🗑️ Unused | `deliveriesApi.*` |
| `src/api/services/driver.service.js` | 🗑️ Uses PostgreSQL `db.query()` directly | `supabase.*` |

**Route migration map:**
```
GET  /api/driver/metrics              → deliveriesApi.getDriverDeliveries() + client calculation
GET  /api/driver/deliveries           → deliveriesApi.getDriverDeliveries()
GET  /api/driver/deliveries/available → deliveryMatchingService.getMatchingDeliveriesForDriver()
POST /api/driver/deliveries/:id/accept → deliveriesApi.acceptDelivery()
PATCH /api/driver/deliveries/:id      → deliveriesApi.updateStatus()
GET  /api/driver/stats                → client-side calculation from Supabase data
```

### 3.6 Layout Duplication

Two layout systems exist for driver navigation:

| System | File | Status |
|--------|------|--------|
| `DriverLayout` | `ProtectedRoute.jsx` (DriverLayout section) | ✅ Active |
| `driverNavItems` | `DashboardLayout.jsx` lines 64-71 | ⚠️ Legacy |

**Recommendation:** Remove `DashboardLayout.jsx` driver nav items and route through `DriverLayout` exclusively.

### 3.7 GPS & Real-time Features (Strong Implementation)

The driver real-time stack is well-implemented:

| Feature | Implementation | Configuration |
|---------|---------------|---------------|
| GPS tracking | `navigator.geolocation.watchPosition` | 10s interval |
| Accuracy thresholds | Client-side check | Good: 50m, Poor: 200m |
| Retry logic | Manual `retryCount` parameter | 3 attempts, 2s delay |
| Realtime subscriptions | `supabase.channel()` | Per-driver filter |
| Location service | `driverLocationService.broadcastDriverLocation()` | Structured payload |
| Live map | `driverLocationService.getCurrentTrackedLocation()` | 45s stale threshold |

**Minor security concern:** GPS location sent every 10 seconds with no server-side rate limiting observed.

---

## 4. Development Objectives

1. **Add missing i18n namespaces** — 7 namespaces missing from ar.json
2. **Fix hardcoded strings** — 4 components + 2 isolated page strings
3. **Remove deprecated Express API** — 3 dead files safe to delete
4. **Fix import path inconsistency** — Settings.jsx
5. **Fix color inconsistency** — DriverLayout panel icon
6. **Migrate Earnings/History/Performance/Wallet** — service layer → TanStack Query
7. **Consider layout consolidation** — remove DashboardLayout.jsx driver nav

---

## 5. Development Phases

### Phase 1 — Critical i18n Fixes (Sprint 1)
**Duration:** 1 sprint | **Risk:** Low | **Impact:** High

- [ ] Add `driver.dashboard.*` keys to all locale files
- [ ] Add `driver.active.*` keys to all locale files
- [ ] Add `driver.history.*` keys to all locale files
- [ ] Add `driver.performance.*` keys to all locale files
- [ ] Add `driver.wallet.*` keys to all locale files
- [ ] Add `driver.summary.*` keys to all locale files
- [ ] Add `driver.vendorPrefs.*` keys to all locale files
- [ ] Localize `DriverAvailabilityToggle.jsx` (3 strings — English)
- [ ] Localize `DeliveryPaymentPolicy.jsx` (4 strings — Arabic)
- [ ] Localize `DeliveryPreferences.jsx` (4 strings — Arabic)
- [ ] Add `LiveDriverMap.jsx` title as i18n key
- [ ] Fix `DeliveryComplete.jsx` line 50 toast
- [ ] Fix `Profile.jsx` line 61 toast

### Phase 2 — Code Cleanup (Sprint 1)
**Duration:** 0.5 sprint | **Risk:** Low | **Impact:** Medium

- [ ] Delete `src/api/routes/driver.routes.js`
- [ ] Delete `src/api/controllers/driver.controller.js`
- [ ] Delete `src/api/services/driver.service.js`
- [ ] Update `DEPRECATION_PLAN.md` to document removal
- [ ] Fix `Settings.jsx` import paths (`@/modules/auth` → `@/store/authStore`)
- [ ] Fix `bg-blue-600` → `bg-green-600` in DriverLayout (ProtectedRoute.jsx line 1073)

### Phase 3 — Service Layer Consolidation (Sprint 2)
**Duration:** 1 sprint | **Risk:** Medium | **Impact:** High

Move direct Supabase queries into service layer:
- [ ] Create `driverService.getEarnings()` (extract from Earnings.jsx)
- [ ] Create `driverService.getHistory()` (extract from History.jsx)
- [ ] Create `driverService.getPerformance()` (extract from Performance.jsx)
- [ ] Create `driverService.getWallet()` (extract from Wallet.jsx)
- [ ] Update pages to use new service functions

**Location options:** `src/services/driverService.ts` or `src/modules/delivery/api/`

### Phase 4 — TanStack Query Migration (Sprint 2-3)
**Duration:** 1 sprint | **Risk:** Medium | **Impact:** High

After Phase 3 (service layer), wrap with TanStack Query:
1. `Dashboard.jsx` — delivery stats + active delivery
2. `Active.jsx` — active deliveries (keep realtime subscription)
3. `Available.jsx` — matching deliveries
4. `Earnings.jsx` — earnings data
5. `History.jsx` — delivery history
6. `Performance.jsx` — performance metrics
7. `Wallet.jsx` — payout data

### Phase 5 — Security Hardening (Sprint 3)
**Duration:** 0.5 sprint | **Risk:** Low | **Impact:** Medium

- [ ] Add server-side rate limiting for GPS location updates
- [ ] Review RLS policies for direct Supabase queries in Earnings/History/Performance/Wallet
- [ ] Add user confirmation UI for low-accuracy GPS (<200m accuracy)
- [ ] Consider server-side metric calculation for acceptance rate / on-time percentage

### Phase 6 — Layout Consolidation (Sprint 3)
**Duration:** 0.5 sprint | **Risk:** Medium | **Impact:** Low

- [ ] Audit DashboardLayout.jsx to confirm no active driver references
- [ ] Remove driver nav items from DashboardLayout.jsx
- [ ] Update any remaining references to use DriverLayout
- [ ] Consider removing DashboardLayout.jsx entirely if fully replaced

---

## 6. Task Breakdown (Backlog)

### P0 — Critical

| ID | Task | File | Effort |
|----|------|------|--------|
| D-001 | Add `driver.dashboard.*` keys | ar.json, en.json, fr.json | M |
| D-002 | Add `driver.active.*` keys | ar.json, en.json, fr.json | S |
| D-003 | Add `driver.history.*`, `driver.performance.*`, `driver.wallet.*`, `driver.summary.*` keys | ar.json, en.json, fr.json | M |
| D-004 | Localize DriverAvailabilityToggle.jsx (3 English strings) | DriverAvailabilityToggle.jsx + locale | S |
| D-005 | Localize DeliveryPaymentPolicy.jsx (4 Arabic strings) | DeliveryPaymentPolicy.jsx + locale | S |
| D-006 | Localize DeliveryPreferences.jsx (4 Arabic strings) | DeliveryPreferences.jsx + locale | S |
| D-007 | Fix DeliveryComplete.jsx toast (line 50) | DeliveryComplete.jsx | XS |
| D-008 | Fix Profile.jsx toast (line 61) | Profile.jsx | XS |

### P1 — High

| ID | Task | File | Effort |
|----|------|------|--------|
| D-009 | Delete 3 deprecated Express API files | driver.routes.js, driver.controller.js, driver.service.js | XS |
| D-010 | Fix Settings.jsx import paths | Settings.jsx | XS |
| D-011 | Fix DriverLayout panel icon color | ProtectedRoute.jsx line 1073 | XS |
| D-012 | Add `driver.vendorPrefs.*` and `driver.summary.*` keys | ar.json, en.json, fr.json | S |
| D-013 | Add LiveDriverMap title i18n key | LiveDriverMap.jsx + locale | XS |

### P2 — Medium

| ID | Task | File | Effort |
|----|------|------|--------|
| D-014 | Create driverService.ts with getEarnings, getHistory, getPerformance, getWallet | src/services/ | M |
| D-015 | Migrate Earnings.jsx to use driverService + TanStack Query | Earnings.jsx | M |
| D-016 | Migrate History.jsx to use driverService + TanStack Query | History.jsx | M |
| D-017 | Migrate Performance.jsx to use driverService + TanStack Query | Performance.jsx | M |
| D-018 | Migrate Wallet.jsx to use driverService + TanStack Query | Wallet.jsx | M |
| D-019 | Migrate Dashboard.jsx to TanStack Query | Dashboard.jsx | M |
| D-020 | Migrate Active.jsx to TanStack Query (keep realtime) | Active.jsx | M |

### P3 — Low

| ID | Task | File | Effort |
|----|------|------|--------|
| D-021 | Add server-side rate limiting for GPS updates | Server config | M |
| D-022 | Review/consolidate DashboardLayout.jsx driver nav | DashboardLayout.jsx | S |
| D-023 | Add low-accuracy GPS confirmation UI | DeliveryTracking.jsx | M |
| D-024 | Move acceptance rate / on-time % to server-side RPC | Supabase + Dashboard.jsx | L |

---

## 7. File Inventory

### Pages (`src/pages/driver/`)

| File | Lines | i18n | Color | Data Pattern | Priority Issues |
|------|-------|------|-------|--------------|-----------------|
| Dashboard.jsx | ~400 | ❌ | ✅ | useEffect + realtime | D-001, D-019 |
| Active.jsx | ~300 | ❌ | ✅ | useEffect + realtime | D-002, D-020 |
| Available.jsx | ~300 | ✅ | ✅ | Service layer | — |
| DeliveryTracking.jsx | ~400 | ✅ | ✅ | Service layer + GPS | D-023 |
| DeliveryPickup.jsx | ~300 | ✅ | ✅ | Service layer | — |
| DeliveryComplete.jsx | ~300 | ✅ | ✅ | Service layer | D-007 |
| DeliverySummary.jsx | ~200 | ❌ | ✅ | Service layer | D-012 |
| Earnings.jsx | ~400 | ✅ | ✅ | Direct Supabase | D-014, D-015 |
| History.jsx | ~300 | ❌ | ✅ | Direct Supabase | D-003, D-016 |
| Performance.jsx | ~400 | ❌ | ✅ | Direct Supabase | D-003, D-017 |
| Profile.jsx | ~300 | ✅ | ✅ | Direct Supabase | D-008 |
| Security.jsx | ~300 | ✅ | ✅ | Security hooks | — |
| Settings.jsx | ~300 | ✅ | ✅ | Module services | D-010 |
| FindVendor.jsx | ~300 | ✅ | ✅ | Service layer | — |
| Wallet.jsx | ~300 | ❌ | ✅ | Direct Supabase | D-003, D-018 |
| VendorPreferenceSetup.jsx | ~200 | ❌ | ✅ | Direct Supabase | D-012 |

### Onboarding (`src/pages/onboarding/`)

| File | Lines | Notes |
|------|-------|-------|
| DriverOnboarding.jsx | 54 | Hardcoded Arabic slides (acceptable for marketing) |

### Components (`src/components/driver/`)

| File | Lines | i18n | Priority Issues |
|------|-------|------|-----------------|
| DriverVerification.jsx | ~200 | ✅ | — |
| DeliveryPaymentPolicy.jsx | ~100 | ❌ | D-005 |
| DeliveryPreferences.jsx | ~100 | ❌ | D-006 |
| DriverAvailabilityToggle.jsx | ~100 | ❌ English | D-004 |

### Map Component (`src/components/maps/`)

| File | Lines | Notes |
|------|-------|-------|
| LiveDriverMap.jsx | ~200 | Hardcoded Arabic title default prop (D-013) |

### Deprecated Files (Delete)

| File | Status |
|------|--------|
| `src/api/routes/driver.routes.js` | 🗑️ D-009 |
| `src/api/controllers/driver.controller.js` | 🗑️ D-009 |
| `src/api/services/driver.service.js` | 🗑️ D-009 |

---

## 8. Dependency Analysis

### External Dependencies

| Dependency | Used For |
|------------|----------|
| `@supabase/supabase-js` | All data access |
| `react-i18next` | i18n |
| `recharts` | Earnings analytics charts |
| `leaflet` | Map display |
| `navigator.geolocation` | Browser GPS API |

### Internal Service Dependencies

```
Dashboard.jsx      → deliveriesApi, realtimeService
Available.jsx      → deliveryMatchingService
DeliveryTracking   → deliveriesApi, driverLocationService
DeliveryPickup     → deliveriesApi, legalCameraService
DeliveryComplete   → deliveriesApi, legalCameraService
FindVendor         → partnershipService
Security           → useSecurityData, useSecurityActions, useAuditLogs
Settings           → profilesService (@/modules/users)
```

---

## 9. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DriverAvailabilityToggle shows English to Arabic users | High | High | D-004 Sprint 1 |
| Missing `driver.dashboard.*` keys cause English fallback | High | High | D-001 Sprint 1 |
| GPS spoofing without server rate limiting | Low | Medium | D-021 Phase 5 |
| Deleting deprecated files breaks undiscovered reference | Low | Medium | Search all imports before deletion |
| TanStack Query migration breaks realtime subscription in Active.jsx | Medium | Medium | Keep channel subscription, wrap initial fetch only |

---

## 10. Testing Strategy

### Unit Tests Required
- [ ] `DriverAvailabilityToggle` — toggle renders correct i18n labels
- [ ] `DeliveryTracking` — GPS tracking start/stop lifecycle
- [ ] `DeliveryTracking` — retry logic on location send failure
- [ ] `Dashboard` — realtime subscription handler for new delivery requests

### Integration Tests Required
- [ ] Full delivery flow: Accept → Pickup → Track → Complete
- [ ] Available deliveries matching (distance + cargo type filters)
- [ ] Driver earnings calculation

### Before Deleting Deprecated Files
- [ ] Run `grep -r "driver.routes\|driver.controller\|driver.service" src/` to confirm zero references
- [ ] Confirm Express server doesn't register driver routes

---

## 11. Definition of Done

For each task to be marked complete:
- [ ] Code change implemented and reviewed
- [ ] i18n keys added to ar.json, en.json, fr.json
- [ ] No hardcoded English or Arabic strings in components
- [ ] Color tokens use `green-*`/`emerald-*` (not `blue-*` for theme elements)
- [ ] No new ESLint suppressions added
- [ ] Deprecated files removed after confirming zero references
- [ ] Existing tests pass

---

## 12. Execution Order (Sprints)

### Sprint 1 — i18n + Cleanup
| # | Task | Est. |
|---|------|------|
| 1 | D-004: Localize DriverAvailabilityToggle.jsx | 1h |
| 2 | D-005: Localize DeliveryPaymentPolicy.jsx | 1h |
| 3 | D-006: Localize DeliveryPreferences.jsx | 1h |
| 4 | D-007: Fix DeliveryComplete toast | 15m |
| 5 | D-008: Fix Profile toast | 15m |
| 6 | D-001: Add driver.dashboard.* keys | 2h |
| 7 | D-002: Add driver.active.* keys | 1h |
| 8 | D-003: Add history, performance, wallet, summary keys | 2h |
| 9 | D-012, D-013: Add vendorPrefs, summary, map title | 1h |
| 10 | D-009: Delete 3 deprecated Express API files | 30m |
| 11 | D-010: Fix Settings.jsx imports | 15m |
| 12 | D-011: Fix DriverLayout panel icon color | 10m |

### Sprint 2 — Service Layer + TanStack Query
| # | Task | Est. |
|---|------|------|
| 1 | D-014: Create driverService.ts | 3h |
| 2 | D-015 to D-018: Migrate 4 direct-Supabase pages | 8h |
| 3 | D-019: Migrate Dashboard.jsx | 3h |
| 4 | D-020: Migrate Active.jsx (keep realtime) | 3h |

### Sprint 3 — Security + Layout
| # | Task | Est. |
|---|------|------|
| 1 | D-021: GPS rate limiting | 3h |
| 2 | D-022: DashboardLayout.jsx consolidation | 1h |
| 3 | D-023: Low-accuracy GPS UI | 2h |
| 4 | D-024: Server-side metrics (Supabase RPC) | 4h |

---

## 13. Future Enhancements (Post-Blueprint)

1. **Driver earnings breakdown** — Per-delivery fee breakdown with distance calculation
2. **Route optimization** — Suggest optimal pickup/delivery routes using mapping API
3. **Driver tiers** — Bronze/Silver/Gold driver classification based on performance
4. **In-app chat** — Driver-vendor and driver-buyer communication channel
5. **Shift scheduling** — Allow vendors to request drivers for specific time slots
6. **Multi-stop deliveries** — Handle multiple pickup/dropoff in a single trip
7. **Driver insurance integration** — Link with Moroccan insurance verification services
8. **Earnings prediction** — ML-based earnings forecast based on time/location patterns

---

*Blueprint generated by Qotoof Integrated Product Team — Based on full codebase audit.*
