# 🔍 Orders Page Audit Report - Greenmarket (Qotoof)

**Date:** April 11, 2026  
**Auditor:** Senior Full-Stack Engineer (20 years experience)  
**File:** `src/pages/Orders.jsx`  
**Route:** `/orders`  
**Component:** `Orders`

---

## 📊 Executive Summary

After thorough review of the Orders page, I identified **11 issues** ranging from critical to minor. The page has **good foundations** with proper Supabase queries, status filtering, and order display, but requires critical improvements in **authentication protection**, **URL query params for filters**, **status color consistency**, and **accessibility**.

### Issues Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 3 | Must fix |
| 🟡 High | 4 | Should fix |
| 🟢 Medium | 3 | Nice to have |
| ⚪ Low | 1 | Optional |

---

## ❌ Issues Found & Fixes

---

### 🔴 ERROR #1: Page Not Protected — Shows Guest Content to Unauthenticated Users

**Issue:** When user is not logged in, the page shows a tracking form instead of redirecting to login. This is a security/UX issue — the `/orders` route should be protected.

**Risk:** Unauthenticated users see limited functionality instead of being prompted to login

**Location:** Main component logic

**Current Code:**
```javascript
useEffect(() => {
  if (user) {
    loadOrders()
  } else {
    setLoading(false)
  }
}, [user])

// Later in render:
if (user) {
  // Show orders
}

// For guests, show tracking form
return (
  <div className="max-w-2xl mx-auto...">
    {/* Tracking form */}
  </div>
)
```

**Fixed Code:**
```javascript
import { useNavigate } from 'react-router-dom'

const Orders = () => {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login', { 
        state: { from: '/orders', message: 'Please login to view your orders' }
      })
      return
    }
    loadOrders()
  }, [user])

  // Show loading while checking auth
  if (!user) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Rest of component...
```

---

### 🔴 ERROR #2: Filter Doesn't Update URL Query Params

**Issue:** Status filter is stored in component state only. When user refreshes page or shares URL, filter is lost.

**Risk:** Lost filters on refresh, can't share filtered URLs

**Current Code:**
```javascript
const [filter, setFilter] = useState('all')
```

**Fixed Code:**
```javascript
import { useSearchParams } from 'react-router-dom'

const Orders = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState(searchParams.get('status') || 'all')

  // Update URL when filter changes
  useEffect(() => {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('status', filter)
    setSearchParams(params)
  }, [filter])

  // Sync from URL changes (back/forward)
  useEffect(() => {
    setFilter(searchParams.get('status') || 'all')
  }, [searchParams])
```

---

### 🔴 ERROR #3: Status Colors Inconsistent with Badge Classes

**Issue:** Some statuses use wrong badge colors. For example, `confirmed` uses `badge-primary` (blue) but should use a distinct color. `preparing` uses `badge-secondary` (gray) which is confusing.

**Current STATUS_CONFIG:**
```javascript
const STATUS_CONFIG = {
  pending: { label: 'Order Placed', color: 'badge-warning', icon: ShoppingBagIcon }, // ✅ Yellow
  confirmed: { label: 'Confirmed', color: 'badge-primary', icon: CheckCircleIcon }, // ✅ Blue
  preparing: { label: 'Preparing', color: 'badge-secondary', icon: ClockIcon }, // ❌ Gray (should be purple/indigo)
  shipped: { label: 'On the Way', color: 'badge-primary', icon: TruckIcon }, // ✅ Blue
  on_the_way: { label: 'On the Way', color: 'badge-primary', icon: TruckIcon }, // ✅ Blue
  delivered: { label: 'Delivered', color: 'badge-success', icon: CheckCircleIcon }, // ✅ Green
  cancelled: { label: 'Cancelled', color: 'badge-danger', icon: XMarkIcon }, // ✅ Red
  vendor_accepted: { label: 'Accepted', color: 'badge-primary', icon: CheckCircleIcon }, // ✅ Blue
  vendor_rejected: { label: 'Rejected', color: 'badge-danger', icon: XMarkIcon }, // ✅ Red
  driver_assigned: { label: 'Driver Assigned', color: 'badge-secondary', icon: TruckIcon }, // ❌ Gray
  driver_accepted: { label: 'Driver Accepted', color: 'badge-secondary', icon: CheckCircleIcon }, // ❌ Gray
  driver_picked_up: { label: 'Picked Up', color: 'badge-primary', icon: TruckIcon }, // ✅ Blue
  awaiting_driver: { label: 'Awaiting Driver', color: 'badge-warning', icon: ClockIcon }, // ✅ Yellow
}
```

**Fixed Code:**
```javascript
const STATUS_CONFIG = {
  pending: { label: 'Order Placed', color: 'badge-warning', icon: ClockIcon }, // 🟡 Yellow
  confirmed: { label: 'Confirmed', color: 'badge-info', icon: CheckCircleIcon }, // 🔵 Blue
  preparing: { label: 'Preparing', color: 'badge-indigo', icon: ClockIcon }, // 🟣 Purple/Indigo
  shipped: { label: 'On the Way', color: 'badge-info', icon: TruckIcon }, // 🔵 Blue
  on_the_way: { label: 'On the Way', color: 'badge-info', icon: TruckIcon }, // 🔵 Blue
  delivered: { label: 'Delivered', color: 'badge-success', icon: CheckCircleIcon }, // 🟢 Green
  cancelled: { label: 'Cancelled', color: 'badge-danger', icon: XMarkIcon }, // 🔴 Red
  vendor_accepted: { label: 'Accepted', color: 'badge-info', icon: CheckCircleIcon }, // 🔵 Blue
  vendor_rejected: { label: 'Rejected', color: 'badge-danger', icon: XMarkIcon }, // 🔴 Red
  driver_assigned: { label: 'Driver Assigned', color: 'badge-indigo', icon: TruckIcon }, // 🟣 Purple
  driver_accepted: { label: 'Driver Accepted', color: 'badge-indigo', icon: CheckCircleIcon }, // 🟣 Purple
  driver_picked_up: { label: 'Picked Up', color: 'badge-info', icon: TruckIcon }, // 🔵 Blue
  awaiting_driver: { label: 'Awaiting Driver', color: 'badge-warning', icon: ClockIcon }, // 🟡 Yellow
}
```

**Note:** You may need to add `badge-indigo` and `badge-info` classes to your CSS:
```css
.badge-info { @apply bg-blue-100 text-blue-800; }
.badge-indigo { @apply bg-indigo-100 text-indigo-800; }
.badge-warning { @apply bg-yellow-100 text-yellow-800; }
.badge-success { @apply bg-green-100 text-green-800; }
.badge-danger { @apply bg-red-100 text-red-800; }
.badge-secondary { @apply bg-gray-100 text-gray-800; }
```

---

### 🟡 ERROR #4: Order Link Goes to /orders/:id/tracking Not /orders/:id

**Issue:** Order cards navigate to `/orders/${order.id}/tracking` instead of `/orders/${order.id}` (order detail page).

**Risk:** Users skip the order detail page and go straight to tracking

**Current Code:**
```javascript
onClick={() => navigate(`/orders/${order.id}/tracking`)}
```

**Fixed Code:**
```javascript
onClick={() => navigate(`/orders/${order.id}`)}
```

**Also update the "Track" button:**
```javascript
<div className="flex items-center gap-2 text-green-600 font-medium text-sm flex-shrink-0">
  <EyeIcon className="w-4 h-4" />
  View Details
  <ArrowRightIcon className="w-4 h-4" />
</div>
```

---

### 🟡 ERROR #5: Double Filtering (State + Manual Filter)

**Issue:** Orders are filtered twice — once by Supabase query (`query.eq('status', filter)`) and once in JavaScript (`filteredOrders`).

**Current Code:**
```javascript
// Supabase filter
if (filter !== 'all') {
  query = query.eq('status', filter)
}

// Then JavaScript filter again
const filteredOrders = filter === 'all'
  ? orders
  : orders.filter(o => o.status === filter)
```

**Fixed Code:**
```javascript
// Remove the JavaScript filter, use only Supabase filter
// The orders state already contains filtered data

{loading ? (
  <LoadingSpinner />
) : orders.length > 0 ? (
  <div className="space-y-4">
    {orders.map((order) => (
      // ... order cards
    ))}
  </div>
) : (
  // Empty state
)}
```

---

### 🟡 ERROR #6: Page Title and Content Not Translated

**Issue:** Header and empty state have hardcoded English text.

**Fixed Code:**
```jsx
<h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
  {t('orders.title', 'My Orders')}
</h1>
<p className="text-gray-600">
  {t('orders.subtitle', 'Track and manage your orders')}
</p>

{/* Status filters */}
{statusFilters.map(f => (
  <button key={f.id} onClick={() => setFilter(f.id)}>
    {t(`orders.filters.${f.id}`, f.label)}
  </button>
))}

{/* Empty state */}
<h3 className="text-lg font-semibold text-gray-900 mb-2">
  {t('orders.empty.title', 'No orders yet')}
</h3>
<p className="text-gray-500 mb-6">
  {t('orders.empty.description', 'Start shopping to see your orders here')}
</p>
<Link to="/marketplace" className="btn-primary inline-flex items-center gap-2">
  <ShoppingBagIcon className="w-5 h-5" />
  {t('orders.empty.browseProducts', 'Browse Products')}
</Link>
```

---

### 🟡 ERROR #7: Missing Error Boundary

**Issue:** No Error Boundary wrapping the Orders page.

**Fixed Code:**
```javascript
import ErrorBoundary from '@/components/ErrorBoundary'

const OrdersWithErrorBoundary = () => (
  <ErrorBoundary componentName="OrdersPage">
    <Orders />
  </ErrorBoundary>
)

export default OrdersWithErrorBoundary
```

---

### 🟢 ERROR #8: Order Card Missing Keyboard Accessibility

**Issue:** Order cards are clickable but don't respond to keyboard navigation.

**Fixed Code:**
```jsx
<Card
  onClick={() => navigate(`/orders/${order.id}`)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(`/orders/${order.id}`)
    }
  }}
  tabIndex={0}
  role="link"
  aria-label={`Order ${order.order_number}, ${status.label}, ${formatPrice(order.total || order.buyer_total || 0)}`}
>
```

---

### 🟢 ERROR #9: Status Filter Buttons Missing aria-pressed

**Fixed Code:**
```jsx
<button
  onClick={() => setFilter(f.id)}
  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
    filter === f.id
      ? 'bg-green-500 text-white'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  }`}
  role="tab"
  aria-selected={filter === f.id}
  aria-pressed={filter === f.id}
>
  {f.label}
</button>
```

---

### 🟢 ERROR #10: Date Format Not Localized

**Issue:** Date is hardcoded to `en-US` locale.

**Fixed Code:**
```javascript
const { i18n } = useTranslation()

// In JSX:
{new Date(order.created_at).toLocaleDateString(i18n.language || 'en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})}
```

---

### ⚪ ERROR #11: No Loading State on Filter Change

**Issue:** When user changes filter, there's no visual feedback while Supabase query runs.

**Recommendation:** Add a subtle loading indicator or skeleton when filter changes:
```javascript
const [filterLoading, setFilterLoading] = useState(false)

const loadOrders = async () => {
  setFilterLoading(true)
  // ... existing code
  finally {
    setLoading(false)
    setFilterLoading(false)
  }
}

// In JSX, show mini spinner near filter buttons when filterLoading
```

---

## ✅ What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| **Supabase Query** | ✅ Correct | Filters by `buyer_id` from session |
| **Status Config** | ✅ Comprehensive | 13 status types covered |
| **Order Display** | ✅ Rich Info | Order number, status, date, vendor, total, items |
| **Product Preview** | ✅ Working | Shows first 3 items with images |
| **Empty State** | ✅ Implemented | Shows when no orders |
| **Tracking Form** | ✅ Working | For guest users |
| **Error Handling** | ✅ Implemented | Catches and logs errors |

---

## 📝 Files to Modify

| File | Changes Required |
|------|------------------|
| `src/pages/Orders.jsx` | 11 fixes (#1-#11) |
| `src/i18n/locales/en.json` | Add orders translation keys |
| `src/i18n/locales/ar.json` | Add orders translation keys |
| `src/i18n/locales/fr.json` | Add orders translation keys |
| `src/index.css` or tailwind config | Add badge-indigo, badge-info classes |

---

## 🎯 Priority Fixes (Top 5)

If you only fix 5 things, fix these:

1. **Authentication Protection (#1)** - Redirect to login
2. **URL Query Params (#2)** - Persist filters in URL
3. **Status Colors (#3)** - Consistent badge colors
4. **Order Link (#4)** - Navigate to /orders/:id not tracking
5. **Double Filtering (#5)** - Remove redundant JS filter

---

**End of Audit Report**
