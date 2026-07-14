# Buyer Role Improvement Blueprint
## Qotoof (قطوف) Marketplace — Integrated Product Team Reference

**Document Version:** 1.0  
**Date:** 2025  
**Role:** Buyer  
**Status:** Active Development  

---

## 1. Executive Summary

The Buyer role represents the primary consumer-facing experience in the Qotoof marketplace. This role covers the full purchasing journey: browsing, negotiation, checkout, order tracking, loyalty, and account management. The audit reveals a **predominantly well-implemented role** with targeted gaps in i18n coverage, data-fetching consistency, and a few hardcoded string violations.

---

## 2. Role Overview

### 2.1 Scope

| Domain | Files | Status |
|--------|-------|--------|
| Pages | 12 buyer pages + 5 shared pages | ✅ Implemented |
| Components | 5 buyer components | ✅ Implemented |
| Modules | Cart, Checkout (structured modules) | ✅ Well-structured |
| Services | `ordersService.ts` | ✅ TypeScript |
| Layout | DashboardLayout + ProtectedRoute | ✅ Active |
| Onboarding | BuyerOnboarding + NegotiationOnboarding | ⚠️ i18n gaps |

### 2.2 Buyer Routes (12 routes in AppRouter.jsx)

| Route | Page | i18n | Data Pattern |
|-------|------|------|--------------|
| `/buyer/dashboard` | Dashboard.jsx | ✅ | TanStack Query |
| `/buyer/orders` | Orders.jsx | ✅ | useEffect |
| `/buyer/orders/:id` | OrderDetail.jsx | ✅ | TanStack Query |
| `/buyer/cart` | Cart.jsx | ✅ | TanStack Query |
| `/buyer/checkout` | CheckoutSimplified.jsx | ✅ | TanStack Query |
| `/buyer/order-confirmation` | OrderConfirmation.jsx | ✅ | Custom hook |
| `/buyer/addresses` | Addresses.jsx | ✅ | TanStack Query |
| `/buyer/coupons` | Coupons.jsx | ✅ | TanStack Query |
| `/buyer/loyalty` | Loyalty.jsx | ✅ | TanStack Query |
| `/buyer/shopping-lists` | ShoppingLists.jsx | ✅ | TanStack Query |
| `/buyer/rfq` | RFQ.jsx | ❌ | useEffect |
| `/buyer/tracking` | Tracking.jsx | ❌ | TanStack Query |
| `/buyer/negotiate` | Negotiation.jsx | ✅ | useEffect |
| `/buyer/negotiate/create` | CreateNegotiation.jsx | ✅ | useEffect |
| `/buyer/settings` | Settings.jsx | ✅ | useEffect |
| `/buyer/security` | Security.jsx | ✅ | Custom hooks |
| `/buyer/profile` | Profile.jsx | ✅ | useEffect |

---

## 3. Unified Audit Findings

### 3.1 i18n Coverage — CRITICAL GAPS

#### Missing Arabic translation keys

**`buyer.rfq.*` namespace (RFQ.jsx):**
```json
"buyer": {
  "rfq": {
    "status": {
      "open": "مفتوح",
      "closed": "مغلق",
      "expired": "منتهي الصلاحية",
      "cancelled": "ملغى"
    },
    "offerStatus": {
      "pending": "قيد الانتظار",
      "accepted": "مقبول",
      "rejected": "مرفوض",
      "withdrawn": "مسحوب"
    },
    "deadline": "الموعد النهائي",
    "maxBudget": "الحد الأقصى للميزانية",
    "offers": "العروض",
    "viewOffers": "عرض العروض",
    "viewDetails": "عرض التفاصيل",
    "acceptOffer": "قبول العرض",
    "vendorFallback": "البائع"
  }
}
```

**`buyerTracking.*` namespace (Tracking.jsx):**
```json
"buyerTracking": {
  "title": "تتبع الطلبات",
  "empty": "لا توجد طلبات نشطة",
  "emptyMessage": "ليس لديك طلبات قيد التوصيل حالياً",
  "browse": "تصفح المنتجات",
  "active": "النشطة",
  "delivered": "المُسلّمة",
  "eta": {
    "pending": "قيد الانتظار",
    "accepted": "تم القبول",
    "preparing": "جارٍ التحضير",
    "driverAssigned": "تم تعيين سائق",
    "pickedUp": "تم الاستلام",
    "onTheWay": "في الطريق",
    "arrivingSoon": "يصل قريباً",
    "minutes": "دقيقة",
    "hours": "ساعة",
    "hoursMinutes": "{{h}} ساعة {{m}} دقيقة",
    "range": "{{min}}-{{max}} دقيقة"
  }
}
```

#### Hardcoded strings NOT using t()

| File | Location | Hardcoded Value | Language |
|------|----------|-----------------|----------|
| `BuyerOnboarding.jsx` | Lines 6-36 | All BUYER_SLIDES content | Arabic |
| `OnboardingFlow.jsx` | Lines 228, 240, 243 | Button labels | Arabic |
| `Settings.jsx` | Line 228 | "DELETE" confirmation word | English |
| `NegotiationOnboarding.jsx` | Lines 15, 22, 29, 36 | Slide fallback strings | English |

### 3.2 Color Token Inconsistencies

| Status | Count | Files |
|--------|-------|-------|
| ✅ `green-*` / `emerald-*` (correct) | 84 matches | 9 files |
| ❌ `primary-*` (inconsistent) | 11 matches | 2 files |

**Files requiring color token fix:**
- `src/pages/buyer/Dashboard.jsx` — 5 occurrences of `primary-*`
- `src/pages/buyer/CreateNegotiation.jsx` — 6 occurrences of `primary-*`

**Required replacement:** `primary-50 → green-50`, `primary-500 → green-500`, `primary-600 → green-600`, `primary-700 → green-700`

### 3.3 Data Fetching Pattern Inconsistency

| Pattern | Count | Files |
|---------|-------|-------|
| TanStack Query (modern) | 6 | Addresses, Coupons, Loyalty, ShoppingLists, Tracking, Dashboard |
| useEffect + useState (legacy) | 6 | Orders, Settings, RFQ, Negotiation, CreateNegotiation, Security (custom hooks) |

**Migration priority:** Orders.jsx > RFQ.jsx > Negotiation.jsx > CreateNegotiation.jsx > Settings.jsx

### 3.4 Accessibility Issues

| File | Line | Issue | Severity |
|------|------|-------|----------|
| `OrderFilters.jsx` | 43 | `aria-label="Clear search"` hardcoded English | Medium |
| `ShoppingLists.jsx` | 168 | `autoFocus` with eslint-disable | Low |
| `BuyerOnboarding.jsx` | 42 | `role="buyer"` non-standard ARIA role | Low |

### 3.5 Performance Issues

| File | Issue | Impact |
|------|-------|--------|
| `Orders.jsx` | 6 useEffect hooks, potential re-renders | Medium |
| `ShoppingLists.jsx` | Double Supabase query fallback if relation missing | Low |
| `Security.jsx` | Multiple custom hooks may over-fetch | Low |

---

## 4. Development Objectives

1. **Complete i18n coverage** — Add all missing Arabic keys for RFQ and Tracking pages
2. **Fix hardcoded strings** — Externalize all buyer onboarding and settings strings
3. **Standardize color tokens** — Replace `primary-*` with `green-*` in 2 files
4. **Migrate legacy data fetching** — Convert 5 useEffect files to TanStack Query
5. **Fix account deletion UX** — Localize the "DELETE" confirmation text
6. **Accessibility fixes** — Fix aria-label hardcoding

---

## 5. Development Phases

### Phase 1 — Critical i18n Fixes (Sprint 1)
**Duration:** 1 sprint | **Risk:** Low | **Impact:** High

- [ ] Add `buyer.rfq.*` keys to `ar.json`, `en.json`, `fr.json`
- [ ] Add `buyerTracking.*` keys to `ar.json`, `en.json`, `fr.json`
- [ ] Localize all strings in `BuyerOnboarding.jsx`
- [ ] Localize button labels in `OnboardingFlow.jsx`
- [ ] Localize "DELETE" confirmation in `Settings.jsx`

**Files touched:** `src/i18n/locales/ar.json`, `en.json`, `fr.json`, `src/pages/onboarding/BuyerOnboarding.jsx`, `src/components/onboarding/OnboardingFlow.jsx`, `src/pages/buyer/Settings.jsx`

### Phase 2 — Color Token Standardization (Sprint 1)
**Duration:** 0.5 sprint | **Risk:** Low | **Impact:** Medium

- [ ] Replace `primary-*` with `green-*` in `src/pages/buyer/Dashboard.jsx`
- [ ] Replace `primary-*` with `green-*` in `src/pages/buyer/CreateNegotiation.jsx`

**Token mapping:**
```
bg-primary-50  → bg-green-50
bg-primary-600 → bg-green-600
bg-primary-700 → bg-green-700
text-primary-500 → text-green-500
text-primary-600 → text-green-600
text-primary-700 → text-green-700
focus:ring-primary-500 → focus:ring-green-500
```

### Phase 3 — Data Fetching Migration (Sprint 2)
**Duration:** 1.5 sprints | **Risk:** Medium | **Impact:** High

Migrate legacy `useEffect + useState` data fetching to TanStack Query.

**Migration order:**
1. `src/pages/buyer/RFQ.jsx` (573 lines, coupled to missing i18n)
2. `src/pages/buyer/Negotiation.jsx` (348 lines)
3. `src/pages/buyer/CreateNegotiation.jsx` (271 lines)
4. `src/pages/buyer/Orders.jsx` (807 lines — largest, most complex)
5. `src/pages/buyer/Settings.jsx` (704 lines)

**Pattern to follow:**
```jsx
// Before
const [data, setData] = useState([])
const [loading, setLoading] = useState(false)
useEffect(() => { fetchData() }, [])

// After
const { data, isLoading, error } = useQuery({
  queryKey: ['buyer-rfqs', userId],
  queryFn: () => rfqService.getUserRFQs(userId),
})
```

### Phase 4 — Accessibility & UX Polish (Sprint 3)
**Duration:** 0.5 sprint | **Risk:** Low | **Impact:** Medium

- [ ] Localize `aria-label` in `OrderFilters.jsx` (line 43)
- [ ] Review `autoFocus` usage in `ShoppingLists.jsx`
- [ ] Review non-standard ARIA role in `BuyerOnboarding.jsx`
- [ ] Add focus management to `NegotiationOnboarding.jsx` dialog

### Phase 5 — Architecture Cleanup (Sprint 3)
**Duration:** 0.5 sprint | **Risk:** Low | **Impact:** Low

- [ ] Remove or document wrapper components (`OrderCard.jsx`, `ReviewModal.jsx`)
- [ ] Standardize i18n namespace format (flat `buyerOrders.*` vs nested `buyer.orders.*`)
- [ ] Clarify buyer dashboard route — document why `/buyer/dashboard` exists
- [ ] Combine Orders.jsx useEffect hooks to reduce re-renders

---

## 6. Task Breakdown (Backlog)

### P0 — Critical (must fix before next release)

| ID | Task | File | Effort |
|----|------|------|--------|
| B-001 | Add `buyer.rfq.*` keys to all locale files | ar.json, en.json, fr.json | S |
| B-002 | Add `buyerTracking.*` keys to all locale files | ar.json, en.json, fr.json | S |
| B-003 | Localize BuyerOnboarding.jsx slide content | BuyerOnboarding.jsx | S |
| B-004 | Localize OnboardingFlow.jsx button labels | OnboardingFlow.jsx | XS |
| B-005 | Localize Settings.jsx "DELETE" confirmation | Settings.jsx | XS |

### P1 — High (fix in next sprint)

| ID | Task | File | Effort |
|----|------|------|--------|
| B-006 | Replace `primary-*` with `green-*` in Dashboard.jsx | Dashboard.jsx | XS |
| B-007 | Replace `primary-*` with `green-*` in CreateNegotiation.jsx | CreateNegotiation.jsx | XS |
| B-008 | Migrate RFQ.jsx to TanStack Query | RFQ.jsx | M |
| B-009 | Migrate Negotiation.jsx to TanStack Query | Negotiation.jsx | M |
| B-010 | Migrate CreateNegotiation.jsx to TanStack Query | CreateNegotiation.jsx | S |

### P2 — Medium (planned)

| ID | Task | File | Effort |
|----|------|------|--------|
| B-011 | Migrate Orders.jsx to TanStack Query | Orders.jsx | L |
| B-012 | Migrate Settings.jsx to TanStack Query | Settings.jsx | M |
| B-013 | Localize aria-label in OrderFilters.jsx | OrderFilters.jsx | XS |
| B-014 | Fix NegotiationOnboarding fallback strings | NegotiationOnboarding.jsx | S |

### P3 — Low (tech debt)

| ID | Task | File | Effort |
|----|------|------|--------|
| B-015 | Remove/document OrderCard.jsx wrapper | OrderCard.jsx | XS |
| B-016 | Remove/document ReviewModal.jsx wrapper | ReviewModal.jsx | XS |
| B-017 | Standardize i18n key namespace format | All buyer pages | M |
| B-018 | Clarify/document buyer dashboard route | AppRouter.jsx | XS |

---

## 7. File Inventory

### Pages (`src/pages/buyer/`)

| File | Lines | i18n | Color | Data Pattern | P0 Issues |
|------|-------|------|-------|--------------|-----------|
| Dashboard.jsx | 209 | ✅ | ❌ primary-* | TanStack Query | B-006 |
| Orders.jsx | 807 | ✅ | ✅ | useEffect | B-011 |
| Addresses.jsx | 489 | ✅ | ✅ | TanStack Query | — |
| Settings.jsx | 704 | ✅ | ✅ | useEffect | B-005 |
| Security.jsx | 626 | ✅ | ✅ | Custom hooks | — |
| Coupons.jsx | 220 | ✅ | ✅ | TanStack Query | — |
| Loyalty.jsx | 402 | ✅ | ✅ | TanStack Query | — |
| ShoppingLists.jsx | 250 | ✅ | ✅ | TanStack Query | — |
| RFQ.jsx | 573 | ❌ | ✅ | useEffect | B-001, B-008 |
| Tracking.jsx | 234 | ❌ | ✅ | TanStack Query | B-002 |
| Negotiation.jsx | 348 | ✅ | ✅ | useEffect | B-009 |
| CreateNegotiation.jsx | 271 | ✅ | ❌ primary-* | useEffect | B-007, B-010 |

### Shared Pages (buyer journey)

| File | Location | Notes |
|------|----------|-------|
| Cart.jsx | `src/pages/` | TanStack Query, ✅ i18n |
| CheckoutSimplified.jsx | `src/pages/` | TanStack Query, ✅ i18n |
| OrderDetail.jsx | `src/pages/` | TanStack Query, ✅ i18n |
| OrderConfirmation.jsx | `src/pages/` | Custom hook, ✅ i18n |
| Profile.jsx | `src/pages/` | useEffect, ✅ i18n |

### Components (`src/components/buyer/`)

| File | Lines | Notes |
|------|-------|-------|
| OrderCard.jsx | 31 | Thin wrapper — consider removing |
| OrderFilters.jsx | 96 | Aria-label needs i18n (B-013) |
| ReviewModal.jsx | 11 | Thin wrapper — consider removing |
| OnboardingFlow.jsx | 253 | Hardcoded labels (B-004) |
| NegotiationOnboarding.jsx | 273 | Fallback English strings (B-014) |

### Onboarding (`src/pages/onboarding/`)

| File | Lines | Notes |
|------|-------|-------|
| BuyerOnboarding.jsx | ~50 | All content hardcoded Arabic (B-003) |

---

## 8. Dependency Analysis

### External Dependencies (verified in package.json)

| Dependency | Used For | Version Policy |
|------------|----------|----------------|
| `@tanstack/react-query` | Data fetching (partial adoption) | ✅ Installed |
| `@supabase/supabase-js` | Database queries | ✅ Installed |
| `react-i18next` | Internationalization | ✅ Installed |
| `@paypal/react-paypal-js` | Payment in Negotiation | ✅ Installed |

### Internal Module Dependencies

```
Cart page → src/modules/cart/
Checkout page → src/modules/checkout/
Orders service → src/services/ordersService.ts
Security → src/hooks/useSecurityData, usePasswordChange
```

---

## 9. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Missing RFQ i18n breaks Arabic UX | High | High | Sprint 1 P0 |
| Missing Tracking i18n shows hardcoded Arabic for EN users | High | Medium | Sprint 1 P0 |
| Orders.jsx migration (807 lines) causes regression | Medium | High | Full test coverage before migration |
| "DELETE" confirmation in English blocks Arabic users | Medium | High | Sprint 1 P0 |
| TanStack Query migration introduces caching bugs | Low | Medium | Gradual migration, test each file |

---

## 10. Testing Strategy

### Unit Tests Required
- [ ] `RFQ.jsx` — status labels render with i18n keys
- [ ] `Tracking.jsx` — ETA computation with i18n
- [ ] `Settings.jsx` — account deletion flow (localized confirmation)
- [ ] `Negotiation.jsx` — counter-offer flow, PayPal integration

### Integration Tests Required
- [ ] Full checkout flow: Cart → Checkout → OrderConfirmation
- [ ] RFQ flow: Create → View Offers → Accept
- [ ] Buyer settings: notification toggles, data export, account deletion

### Existing Tests
- `src/__tests__/pages/FavoritesDataFlow.test.jsx` — Favorites data flow
- `src/__tests__/pages/Home.dataSource.test.jsx` — Home page data source

---

## 11. Definition of Done

For each task to be marked complete:
- [ ] Code change implemented and reviewed
- [ ] i18n keys added to ar.json, en.json, fr.json
- [ ] No hardcoded strings in UI components
- [ ] Color tokens use `green-*`/`emerald-*` (not `primary-*`)
- [ ] Data fetching uses TanStack Query pattern
- [ ] No new console.log added
- [ ] Existing tests pass

---

## 12. Execution Order (Sprints)

### Sprint 1 — Foundation (P0 + P1 quick wins)
| # | Task | Est. |
|---|------|------|
| 1 | B-001: Add `buyer.rfq.*` to locale files | 2h |
| 2 | B-002: Add `buyerTracking.*` to locale files | 2h |
| 3 | B-003: Localize BuyerOnboarding.jsx | 1h |
| 4 | B-004: Localize OnboardingFlow.jsx buttons | 30m |
| 5 | B-005: Localize Settings.jsx DELETE confirmation | 30m |
| 6 | B-006: Fix color tokens in Dashboard.jsx | 30m |
| 7 | B-007: Fix color tokens in CreateNegotiation.jsx | 30m |

### Sprint 2 — Data Migration (P1 TanStack Query)
| # | Task | Est. |
|---|------|------|
| 1 | B-008: Migrate RFQ.jsx | 4h |
| 2 | B-009: Migrate Negotiation.jsx | 3h |
| 3 | B-010: Migrate CreateNegotiation.jsx | 2h |
| 4 | B-011: Migrate Orders.jsx | 6h |
| 5 | B-012: Migrate Settings.jsx | 4h |

### Sprint 3 — Polish (P2 + P3)
| # | Task | Est. |
|---|------|------|
| 1 | B-013: Localize aria-labels | 30m |
| 2 | B-014: Fix NegotiationOnboarding fallbacks | 1h |
| 3 | B-015, B-016: Review wrapper components | 1h |
| 4 | B-017: Standardize i18n namespaces | 3h |

---

## 13. Future Enhancements (Post-Blueprint)

1. **RFQ improvements** — Add RFQ creation UI (currently only view/accept)
2. **Tracking map** — Add visual map for real-time delivery tracking
3. **Buyer analytics** — Purchase history analytics and spending insights
4. **Wishlist sharing** — Share shopping lists with others
5. **Review system** — Allow buyers to edit/delete their reviews
6. **Address verification** — Validate addresses against Morocco postal data
7. **Order dispute** — Buyer-initiated dispute flow within order detail

---

## 14. Module Architecture Notes

### Cart Module (`src/modules/cart/`)
Well-structured with clean API boundary:
```
src/modules/cart/
  api/          — Supabase data access
  domain/       — Business logic
  hooks/        — React hooks
  stores/       — Zustand store
  utils/        — Helpers
  ui/           — Components
  index.ts      — Public API
```

### Checkout Module (`src/modules/checkout/`)
Same well-structured pattern as cart module. Both modules are production-ready.

---

*Blueprint generated by Qotoof Integrated Product Team — Based on full codebase audit.*
