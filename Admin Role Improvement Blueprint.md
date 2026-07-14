# Admin Role Improvement Blueprint
## Qotoof (قطوف) Marketplace — Integrated Product Team Reference

**Document Version:** 1.0  
**Date:** 2025  
**Role:** Admin  
**Status:** Active Development  

---

## 1. Executive Summary

The Admin role is the most comprehensive backend management surface in the Qotoof marketplace. It covers user management, vendor/driver approvals, financial operations (commissions, payouts), content moderation, analytics, security, and system health monitoring. The audit reveals an **18-page fully implemented core** with 4 partially implemented or stub pages, **zero TanStack Query adoption** across all 22 pages, 4 missing i18n namespaces, and 2 missing database tables that cause runtime errors.

**Critical finding:** `DisputeManagement.jsx` and `FraudReports.jsx` reference database tables (`payment_disputes`, `fraud_reports`) that are confirmed missing — these pages will fail at runtime.

---

## 2. Role Overview

### 2.1 Scope

| Domain | Files | Status |
|--------|-------|--------|
| Core management pages | 18 | ✅ Fully implemented |
| Partial/stub pages | 4 | ⚠️ Needs completion |
| Components | 3 (VerificationPanel, ExportButtons, ReportPreview) | ⚠️ Hardcoded strings |
| Layout | ProtectedRoute.jsx (AdminLayout) | ✅ Active |
| Navigation links | 21 sidebar links | ✅ Complete |
| Missing DB tables | `fraud_reports`, `payment_disputes` | ❌ Runtime errors |

### 2.2 Admin Routes (21 pages)

| Route | Page | Implementation | i18n |
|-------|------|---------------|------|
| `/admin/dashboard` | Dashboard.jsx | ✅ Full | ✅ |
| `/admin/users` | Users.jsx | ✅ Full | ✅ |
| `/admin/vendors` | Vendors.jsx | ✅ Full | ✅ |
| `/admin/drivers` | Drivers.jsx | ✅ Full | ✅ |
| `/admin/products` | Products.jsx | ✅ Full | ✅ |
| `/admin/orders` | Orders.jsx | ✅ Full | ✅ |
| `/admin/analytics` | Analytics.jsx | ✅ Full | ✅ |
| `/admin/reports` | Reports.jsx | ✅ Full | ✅ |
| `/admin/commissions` | Commissions.jsx | ✅ Full | ✅ |
| `/admin/commission-management` | CommissionManagement.jsx | ✅ Full | ✅ |
| `/admin/payouts` | Payouts.jsx | ✅ Full | ✅ |
| `/admin/reviews` | Reviews.jsx | ✅ Full | ✅ |
| `/admin/moderation` | Moderation.jsx | ✅ Full | ✅ |
| `/admin/security` | Security.jsx | ✅ Full | ✅ |
| `/admin/settings` | Settings.jsx | ✅ Full | ✅ |
| `/admin/settings-audit` | SettingsAuditLog.jsx | ✅ Full | ✅ |
| `/admin/driver-verification` | DriverVerification.jsx | ✅ Full | ✅ |
| `/admin/system-health` | CircuitBreakers.jsx | ✅ Full | ✅ |
| `/admin/verification` | Verification.jsx | ⚠️ Stub | ❌ |
| `/admin/disputes` | DisputeManagement.jsx | ❌ Missing DB table | ❌ |
| `/admin/fraud-reports` | FraudReports.jsx | ❌ Missing DB table | ❌ |
| `/admin/support-tickets` | SupportTickets.jsx | ⚠️ Partial | ❌ |

### 2.3 AdminLayout Navigation

**Sidebar links (21 items):**
```
Dashboard → Users → Vendors → Drivers → Products → Orders
Analytics → Reports → Moderation → Fraud Reports → Commissions
Commission Management → Payment Disputes → Payouts → Reviews
Support Tickets → Security → Settings → Driver Verification
Settings Audit Log → System Health
```

**Mobile tabs (4 items):** Dashboard, Users, Products, Settings

**Panel icon:** ShieldCheckIcon with `bg-indigo-600` (inconsistent — should be `bg-primary-600`)

---

## 3. Unified Audit Findings

### 3.1 Missing Database Tables — RUNTIME ERRORS

Two admin pages reference confirmed-missing database tables:

#### `payment_disputes` table
- **Page:** `DisputeManagement.jsx` (line 65: `disputeService.getDisputes()`)
- **Status:** Confirmed missing (documented in `.windsurfrules`)
- **Runtime behavior:** Page will fail on load with Supabase error
- **Sidebar link:** Shows in navigation as "Payment Disputes"

#### `fraud_reports` table
- **Page:** `FraudReports.jsx` (imports `fraudReportService`)
- **Status:** Confirmed missing (documented in `.windsurfrules`)
- **Runtime behavior:** Page will fail on load with Supabase error
- **Sidebar link:** Shows in navigation as "Fraud Reports"

#### `driver_verification_documents` table
- **Pages:** `Drivers.jsx` (lines 62-75), `DriverVerification.jsx` (lines 40-54)
- **Status:** Suspected missing — Drivers.jsx has graceful degradation:
  ```js
  if (error.code === '42P01' || error.message.includes('does not exist')) {
    logger.warn('driver_verification_documents table not found, skipping pending count')
  }
  ```
- **Runtime behavior:** Degrades gracefully (pending count shown as 0)

### 3.2 i18n Coverage

#### Present in ar.json (17 namespaces) ✅
All core admin pages have complete translation coverage:
- `admin.dashboard`, `admin.users`, `admin.vendors`, `admin.analytics`
- `admin.orders`, `admin.drivers`, `admin.driverVerification`
- `admin.reviews`, `admin.settingsAuditLog`, `admin.circuitBreakers`
- `admin.commissions`, `admin.moderation`, `admin.payouts`
- `admin.products`, `admin.security`, `admin.settings`
- `admin.commissionManagement`

#### Missing from ar.json (4 namespaces) ❌

| Namespace | Page | Status |
|-----------|------|--------|
| `admin.disputes` | DisputeManagement.jsx | ❌ Missing (page also has missing DB) |
| `admin.fraudReports` | FraudReports.jsx | ❌ Missing (page also has missing DB) |
| `admin.supportTickets` | SupportTickets.jsx | ❌ Missing |
| `admin.verification` | Verification.jsx | ❌ Missing (stub page) |

#### Hardcoded strings NOT using t() — Components

**VerificationPanel.jsx** (admin + shared):
```jsx
// Line 26
toast.error('تعذر تحميل طلبات التحقق')   // Hardcoded Arabic
// Line 53
toast.error('فشل تحديث حالة التحقق')      // Hardcoded Arabic
// Line 55
toast.success('تمت الموافقة بنجاح')        // Hardcoded Arabic
toast.success('تم الرفض بنجاح')           // Hardcoded Arabic
// Note: imports useTranslation but never calls t()
```

**ExportButtons.jsx** (Reports page component):
```jsx
// Lines 40-42 — button labels
"CSV"
"Excel"
"PDF"
// Note: imports useTranslation but doesn't call t()
```

**ReportPreview.jsx** (Reports page component):
```jsx
// Lines 6-36 — all column labels hardcoded Arabic
// No useTranslation usage
```

#### Hardcoded strings — Pages

**Orders.jsx:**
```js
// Line 7 — commented import
// import { createOrderPaymentRecord } from '@/modules/payments'
```

**AdminLayout (ProtectedRoute.jsx):**
```jsx
// Lines 872-894 — adminLinks labels all hardcoded English
{ label: 'Dashboard' }, { label: 'Users' }, { label: 'Vendors' }, ...
// Note: 21 links, all hardcoded English
```

### 3.3 Color Token Inconsistencies

| Location | Token Used | Expected Token | Status |
|----------|-----------|----------------|--------|
| `ProtectedRoute.jsx` (AdminLayout) line 409 | `bg-primary-600` | `bg-primary-600` | ✅ |
| `ProtectedRoute.jsx` (AdminLayout) line 420 | `bg-primary-500/700` | `bg-primary-*` | ✅ |
| `ProtectedRoute.jsx` line 910 (panel icon) | `bg-indigo-600` | `bg-primary-600` | ❌ |
| `Reports.jsx` line 86, 91 | `bg-green-500`, `border-green-500` | Acceptable for success state | ✅ |
| `Orders.jsx` lines 51, 54 | `bg-emerald-100`, `text-emerald-700` | Acceptable for success state | ✅ |
| `CommissionManagement.jsx` line 33 | `bg-green-100`, `text-green-700` | Acceptable for success state | ✅ |

**Fix required:** Change `bg-indigo-600` → `bg-primary-600` in AdminLayout panel icon (line 910).

### 3.4 Data Fetching — 0% TanStack Query Adoption

Like the Vendor role, **ALL 22 admin pages** use plain `useState + useEffect`/`useCallback`. No admin page uses TanStack Query.

| Pattern | Count |
|---------|-------|
| `useEffect + useState` | 16 pages |
| `useCallback + useState` | 4 pages |
| `useState` only (no fetching) | 2 pages |
| **TanStack Query** | **0 pages** |

**Consequence:** No data caching, no request deduplication, no automatic background refetching. The admin dashboard particularly suffers — every navigation re-fetches all stats.

### 3.5 RBAC / Security Observations

| Page | Explicit Role Check | Assessment |
|------|--------------------|-|
| `Dashboard.jsx` | Comment explains ProtectedRoute handles it | ✅ Documented |
| `Users.jsx` | `const isAdmin = authProfile?.role === 'admin'` (line 54) | ✅ Defense in depth |
| `Products.jsx` | `const isAdmin = authProfile?.role === 'admin'` (line 32) | ✅ Defense in depth |
| All others (18 pages) | Relies solely on ProtectedRoute | ⚠️ No defense in depth |

**Assessment:** Relying on ProtectedRoute is acceptable if ProtectedRoute is correctly implemented. However, explicit role checks on sensitive pages (Users, Vendors, Commissions, Security) provide better defense in depth.

### 3.6 Duplicate Code Patterns

The following logic is repeated across multiple admin pages without abstraction:

| Pattern | Appears In |
|---------|-----------|
| Pagination (`page`, `totalPages`, `PAGE_SIZE`) | Users, Vendors, Drivers, Products, Reviews, Moderation, Orders |
| Search filter (`searchTerm`, `debouncedSearch`) | Users, Vendors, Drivers, Products, Reviews |
| Status filter dropdown | Users, Vendors, Drivers, Orders, Products |
| Confirmation modal | Users, Vendors, Orders, Reviews |
| Export buttons | Analytics, Reports, Commissions |

**Recommendation:** Create shared admin hooks: `useAdminPagination()`, `useAdminSearch()`, `useAdminFilters()`.

### 3.7 Special Pages Analysis

#### CircuitBreakers.jsx (`/admin/system-health`)
Monitors 6 services: Database, Storage, Auth, Realtime, Notifications, Orders.
Each service has a health check method. **Fully implemented.**

#### SettingsAuditLog.jsx
Tracks all platform settings changes with pagination. Displays: setting key, previous/new value, admin ID, IP address, user agent. **Fully implemented.**

#### Verification.jsx
Stub — entire page is:
```jsx
const AdminVerification = () => {
  return <VerificationPanel />
}
```
No title, no breadcrumb, no standalone logic. Either expand or remove.

---

## 4. Development Objectives

1. **Create missing database tables** — `payment_disputes`, `fraud_reports` (migration required)
2. **Fix runtime errors** — Dispute and FraudReports pages crash without DB tables
3. **Add missing i18n namespaces** — 4 namespaces for stub/partial pages
4. **Fix hardcoded strings** — VerificationPanel, ExportButtons, ReportPreview, AdminLayout links
5. **Standardize RBAC** — Add explicit role checks to sensitive pages
6. **Migrate to TanStack Query** — 22 pages, high priority for dashboard and frequently visited pages
7. **Extract shared patterns** — Pagination, search, filter hooks
8. **Fix color inconsistency** — AdminLayout panel icon color

---

## 5. Development Phases

### Phase 1 — Critical Runtime Fixes (Sprint 1)
**Duration:** 1 sprint | **Risk:** Medium | **Impact:** Critical

- [ ] Create Supabase migration for `payment_disputes` table
- [ ] Create Supabase migration for `fraud_reports` table
- [ ] Confirm `driver_verification_documents` table exists or create migration
- [ ] Add `admin.disputes.*` i18n keys to all locale files
- [ ] Add `admin.fraudReports.*` i18n keys to all locale files
- [ ] Add `admin.supportTickets.*` i18n keys to all locale files
- [ ] Test DisputeManagement.jsx and FraudReports.jsx after table creation

**Suggested `payment_disputes` schema:**
```sql
CREATE TABLE payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  raised_by UUID REFERENCES profiles(id),
  against UUID REFERENCES profiles(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  resolution TEXT,
  resolved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Suggested `fraud_reports` schema:**
```sql
CREATE TABLE fraud_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES profiles(id),
  reported_entity_id UUID,
  entity_type TEXT CHECK (entity_type IN ('user', 'vendor', 'order', 'product')),
  reason TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'confirmed', 'dismissed')),
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Phase 2 — i18n & Hardcoded Strings (Sprint 1)
**Duration:** 0.5 sprint | **Risk:** Low | **Impact:** Medium

- [ ] Fix `VerificationPanel.jsx` — use `t()` for all 4 toast messages
- [ ] Fix `ExportButtons.jsx` — use `t()` for CSV/Excel/PDF labels (or keep as-is if format names are intentionally not translated)
- [ ] Fix `ReportPreview.jsx` — use `t()` for column labels
- [ ] Add `admin.verification.*` i18n keys
- [ ] Localize AdminLayout sidebar link labels (21 links — use existing `layout.admin.*` pattern if available)
- [ ] Fix `bg-indigo-600` → `bg-primary-600` in AdminLayout panel icon

### Phase 3 — RBAC Hardening (Sprint 2)
**Duration:** 0.5 sprint | **Risk:** Low | **Impact:** High (security)

Add explicit admin role checks to highest-risk pages:
- [ ] `Vendors.jsx` — add `isAdmin` check before data load
- [ ] `Orders.jsx` — add `isAdmin` check before data load
- [ ] `Commissions.jsx` — add `isAdmin` check before data load
- [ ] `CommissionManagement.jsx` — add `isAdmin` check before data load
- [ ] `Payouts.jsx` — add `isAdmin` check before data load
- [ ] `Security.jsx` — add `isAdmin` check before data load
- [ ] `Settings.jsx` — add `isAdmin` check before data load

**Pattern to follow (from Users.jsx):**
```jsx
const { profile: authProfile } = useAuthStore()
const isAdmin = authProfile?.role === 'admin'

useEffect(() => {
  if (!isAdmin) return
  loadData()
}, [isAdmin])
```

### Phase 4 — Shared Hooks Extraction (Sprint 2)
**Duration:** 1 sprint | **Risk:** Low | **Impact:** Medium (code quality)

Extract repeated patterns into shared admin hooks:

```tsx
// src/hooks/admin/useAdminPagination.ts
export function useAdminPagination(pageSize = 20) {
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const totalPages = Math.ceil(total / pageSize)
  return { page, setPage, total, setTotal, totalPages, pageSize }
}

// src/hooks/admin/useAdminSearch.ts
export function useAdminSearch(delay = 300) {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounce(searchTerm, delay)
  return { searchTerm, setSearchTerm, debouncedSearch }
}

// src/hooks/admin/useAdminFilters.ts
export function useAdminFilters<T>(defaultFilter: T) {
  const [filter, setFilter] = useState<T>(defaultFilter)
  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  return { filter, setFilter, sortField, setSortField, sortDir, setSortDir }
}
```

- [ ] Create `src/hooks/admin/useAdminPagination.ts`
- [ ] Create `src/hooks/admin/useAdminSearch.ts`
- [ ] Create `src/hooks/admin/useAdminFilters.ts`
- [ ] Migrate Users.jsx, Vendors.jsx, Drivers.jsx to shared hooks
- [ ] Migrate Products.jsx, Reviews.jsx, Moderation.jsx, Orders.jsx

### Phase 5 — TanStack Query Migration (Sprints 3-4)
**Duration:** 2 sprints | **Risk:** Medium | **Impact:** High

Priority order based on page frequency:

**Tier 1 (most visited):**
1. `Dashboard.jsx` — Platform-wide stats
2. `Users.jsx` — Most common admin task
3. `Vendors.jsx` — Approval workflow
4. `Orders.jsx` — High frequency

**Tier 2 (financial):**
5. `Commissions.jsx`
6. `CommissionManagement.jsx`
7. `Payouts.jsx`

**Tier 3 (moderation/content):**
8. `Moderation.jsx`
9. `Reviews.jsx`
10. `Products.jsx`
11. `Drivers.jsx`

**Tier 4 (specialized):**
12. `Analytics.jsx`
13. `Reports.jsx`
14. `Security.jsx`
15. `Settings.jsx`
16. `DriverVerification.jsx`
17. `DisputeManagement.jsx`, `FraudReports.jsx` (after DB tables created)
18. `SupportTickets.jsx`
19. `SettingsAuditLog.jsx`
20. `CircuitBreakers.jsx`

### Phase 6 — Verification.jsx Completion (Sprint 4)
**Duration:** 0.5 sprint | **Risk:** Low | **Impact:** Low

- [ ] Expand `Verification.jsx` beyond stub — add title, breadcrumb, filtering
- [ ] Document what VerificationPanel covers vs standalone verification page
- [ ] Add `admin.verification.*` i18n keys (covers both)
- [ ] Or: remove Verification.jsx and add VerificationPanel to Vendors.jsx directly

---

## 6. Task Breakdown (Backlog)

### P0 — Critical (runtime errors)

| ID | Task | File | Effort |
|----|------|------|--------|
| A-001 | Create Supabase migration for `payment_disputes` | DB migration | M |
| A-002 | Create Supabase migration for `fraud_reports` | DB migration | M |
| A-003 | Confirm/create `driver_verification_documents` migration | DB migration | S |
| A-004 | Test DisputeManagement.jsx after A-001 | DisputeManagement.jsx | S |
| A-005 | Test FraudReports.jsx after A-002 | FraudReports.jsx | S |
| A-006 | Add `admin.disputes.*` i18n keys | locale files | M |
| A-007 | Add `admin.fraudReports.*` i18n keys | locale files | M |

### P1 — High

| ID | Task | File | Effort |
|----|------|------|--------|
| A-008 | Add `admin.supportTickets.*` i18n keys | locale files | S |
| A-009 | Fix VerificationPanel.jsx — use t() | VerificationPanel.jsx + locale | S |
| A-010 | Fix ExportButtons.jsx — use t() | ExportButtons.jsx + locale | XS |
| A-011 | Fix ReportPreview.jsx — use t() for column labels | ReportPreview.jsx + locale | S |
| A-012 | Fix AdminLayout panel icon: indigo → primary | ProtectedRoute.jsx line 910 | XS |
| A-013 | Add explicit isAdmin check to Vendors, Orders, Commissions, Payouts, Security, Settings | 6 files | M |

### P2 — Medium

| ID | Task | File | Effort |
|----|------|------|--------|
| A-014 | Create useAdminPagination hook | src/hooks/admin/ | S |
| A-015 | Create useAdminSearch hook | src/hooks/admin/ | S |
| A-016 | Create useAdminFilters hook | src/hooks/admin/ | S |
| A-017 | Migrate Users.jsx to shared hooks + TanStack Query | Users.jsx | M |
| A-018 | Migrate Vendors.jsx to shared hooks + TanStack Query | Vendors.jsx | M |
| A-019 | Migrate Dashboard.jsx to TanStack Query | Dashboard.jsx | M |
| A-020 | Migrate Orders.jsx to TanStack Query | Orders.jsx | M |
| A-021 | Add `admin.verification.*` i18n keys | locale files | S |

### P3 — Low

| ID | Task | File | Effort |
|----|------|------|--------|
| A-022 | Migrate Commissions.jsx, CommissionManagement.jsx, Payouts.jsx | 3 files | L |
| A-023 | Migrate Moderation.jsx, Reviews.jsx, Products.jsx, Drivers.jsx | 4 files | XL |
| A-024 | Migrate Analytics.jsx, Reports.jsx, Security.jsx, Settings.jsx | 4 files | L |
| A-025 | Migrate DriverVerification.jsx, CircuitBreakers.jsx, SettingsAuditLog.jsx | 3 files | M |
| A-026 | Expand or remove Verification.jsx stub | Verification.jsx | M |
| A-027 | Localize AdminLayout sidebar labels | ProtectedRoute.jsx | M |

---

## 7. File Inventory

### Pages (`src/pages/admin/`)

| File | Implementation | i18n | Color | Data Pattern | Priority Issues |
|------|---------------|------|-------|--------------|-----------------|
| Dashboard.jsx | ✅ Full | ✅ | ✅ | useEffect | A-019 |
| Users.jsx | ✅ Full | ✅ | ✅ | useEffect | A-013, A-017 |
| Vendors.jsx | ✅ Full | ✅ | ✅ | useEffect | A-013, A-018 |
| Drivers.jsx | ✅ Full | ✅ | ✅ | useEffect | — |
| Orders.jsx | ✅ Full | ✅ | ✅ | useEffect | A-013, A-020 |
| Products.jsx | ✅ Full | ✅ | ✅ | useEffect | — |
| Analytics.jsx | ✅ Full | ✅ | ✅ | useEffect | A-024 |
| Reports.jsx | ✅ Full | ✅ | ✅ | useState | A-024 |
| Commissions.jsx | ✅ Full | ✅ | ✅ | useEffect | A-022 |
| CommissionManagement.jsx | ✅ Full | ✅ | ✅ | useEffect | A-013, A-022 |
| Payouts.jsx | ✅ Full | ✅ | ✅ | useCallback | A-013, A-022 |
| Reviews.jsx | ✅ Full | ✅ | ✅ | useCallback | A-023 |
| Moderation.jsx | ✅ Full | ✅ | ✅ | useEffect | A-023 |
| Security.jsx | ✅ Full | ✅ | ✅ | useEffect | A-013 |
| Settings.jsx | ✅ Full | ✅ | ✅ | useCallback | A-013 |
| SettingsAuditLog.jsx | ✅ Full | ✅ | ✅ | useCallback | A-025 |
| DriverVerification.jsx | ✅ Full | ✅ | ✅ | useEffect | A-025 |
| CircuitBreakers.jsx | ✅ Full | ✅ | ✅ | useEffect | A-025 |
| Verification.jsx | ⚠️ Stub | ❌ | ✅ | None | A-021, A-026 |
| DisputeManagement.jsx | ❌ Missing DB | ❌ | ✅ | useEffect | A-001, A-004, A-006 |
| FraudReports.jsx | ❌ Missing DB | ❌ | ✅ | useEffect | A-002, A-005, A-007 |
| SupportTickets.jsx | ⚠️ Partial | ❌ | ✅ | useCallback | A-008 |

### Components (`src/components/admin/`, `src/components/Reports/`)

| File | Lines | i18n Issue | Priority |
|------|-------|-----------|----------|
| VerificationPanel.jsx | ~200 | Imports useTranslation but never uses t() | A-009 |
| ExportButtons.jsx | ~100 | Imports useTranslation but doesn't call t() | A-010 |
| ReportPreview.jsx | ~100 | No useTranslation, all labels hardcoded Arabic | A-011 |

---

## 8. Dependency Analysis

### External Dependencies

| Dependency | Used For |
|------------|----------|
| `@tanstack/react-query` | NOT yet used (critical gap) |
| `@supabase/supabase-js` | All data access |
| `react-i18next` | i18n (partial adoption in components) |
| `chart.js` | Analytics and commission charts |
| `@headlessui/react` | Modal/dialog components |

### Internal Module Dependencies

```
Security.jsx    → useSecurityData, usePasswordStrength, useSecurityActions
Reports.jsx     → ExportButtons, ReportPreview
Verification.jsx → VerificationPanel
Orders.jsx      → (commented) @/modules/payments
CircuitBreakers → supabase, authService, storageService, realtimeService
```

---

## 9. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `DisputeManagement` crashes (missing table) | Certain | High | A-001 immediately |
| `FraudReports` crashes (missing table) | Certain | High | A-002 immediately |
| DB migration breaks existing schema | Low | High | Test in staging first |
| TanStack migration for 22 pages causes regression | Medium | High | Incremental, page by page |
| Vendors.jsx lacks explicit admin check | Medium | Medium | A-013 before next release |
| ExportButtons CSV/Excel/PDF labels — are they already accepted multi-lingual? | Low | Low | Verify with stakeholders |

---

## 10. Testing Strategy

### Before Sprint 1 Deployment
- [ ] Verify DisputeManagement.jsx renders after DB migration
- [ ] Verify FraudReports.jsx renders after DB migration
- [ ] Confirm existing admin pages unaffected by new migrations

### Unit Tests Required
- [ ] `CircuitBreakers.jsx` — health check methods return expected values
- [ ] `SettingsAuditLog.jsx` — pagination renders correct page data
- [ ] `VerificationPanel.jsx` — approve/reject actions fire correct Supabase update

### Integration Tests Required
- [ ] Vendor approval workflow: pending → approve → active
- [ ] Commission payment flow: mark paid → audit log entry
- [ ] User suspension: suspend → restricted access confirmed
- [ ] Report export: CSV/Excel/PDF download triggers

---

## 11. Definition of Done

For each task to be marked complete:
- [ ] Code change implemented and reviewed
- [ ] DB migrations tested in staging before production
- [ ] i18n keys added to ar.json, en.json, fr.json
- [ ] No hardcoded strings in JSX or toast messages
- [ ] Color tokens use `primary-*` (admin theme) or `green-*`/`emerald-*` for success states
- [ ] Explicit `isAdmin` check added to high-risk pages
- [ ] Existing tests pass

---

## 12. Execution Order (Sprints)

### Sprint 1 — Critical Fixes
| # | Task | Est. |
|---|------|------|
| 1 | A-001: Create `payment_disputes` migration | 2h |
| 2 | A-002: Create `fraud_reports` migration | 2h |
| 3 | A-003: Confirm `driver_verification_documents` | 1h |
| 4 | A-004, A-005: Test pages after migration | 1h |
| 5 | A-006: admin.disputes.* keys | 2h |
| 6 | A-007: admin.fraudReports.* keys | 2h |
| 7 | A-008: admin.supportTickets.* keys | 1h |
| 8 | A-009: Fix VerificationPanel.jsx | 1h |
| 9 | A-010: Fix ExportButtons.jsx | 30m |
| 10 | A-011: Fix ReportPreview.jsx | 1h |
| 11 | A-012: Fix AdminLayout icon color | 10m |
| 12 | A-013: Add isAdmin checks to 6 pages | 1.5h |

### Sprint 2 — Shared Hooks + RBAC
| # | Task | Est. |
|---|------|------|
| 1 | A-014 to A-016: Create 3 shared admin hooks | 3h |
| 2 | A-017 to A-020: Migrate 4 pages (Users, Vendors, Dashboard, Orders) | 12h |
| 3 | A-021: admin.verification.* keys | 1h |

### Sprint 3 — TanStack Query Tier 2-3
| # | Task | Est. |
|---|------|------|
| 1 | A-022: Commissions, CommissionManagement, Payouts | 9h |
| 2 | A-023: Moderation, Reviews, Products, Drivers | 12h |

### Sprint 4 — TanStack Query Tier 4 + Cleanup
| # | Task | Est. |
|---|------|------|
| 1 | A-024: Analytics, Reports, Security, Settings | 12h |
| 2 | A-025: DriverVerification, CircuitBreakers, SettingsAuditLog | 6h |
| 3 | A-026: Verification.jsx expansion or removal | 3h |
| 4 | A-027: Localize AdminLayout sidebar labels | 2h |

---

## 13. Future Enhancements (Post-Blueprint)

1. **Admin notifications** — Real-time alerts for new vendor applications, high-value disputes, fraud reports
2. **Advanced analytics** — Cohort analysis, vendor performance benchmarking, buyer lifetime value
3. **Bulk operations** — Bulk approve/reject vendors, bulk product moderation
4. **Admin activity log** — Who changed what, when (extends SettingsAuditLog to all actions)
5. **Commission rules engine** — Dynamic commission rates by vendor category or tier
6. **Automated fraud detection** — Flag suspicious patterns automatically
7. **SLA tracking** — Track dispute resolution time, support ticket response time
8. **Role-based admin sub-roles** — Finance admin, moderation admin, support admin (reduces attack surface)
9. **Scheduled reports** — Auto-generate and email reports at configurable intervals
10. **A/B testing dashboard** — Admin can manage feature flags and experiments

---

*Blueprint generated by Qotoof Integrated Product Team — Based on full codebase audit.*
