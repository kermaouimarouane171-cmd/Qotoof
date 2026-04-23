# 🔍 Vendor Dashboard (/vendor/dashboard) Audit Report

**Date:** April 11, 2026  
**Auditor:** Senior Full-Stack Engineer (20 years experience)  
**File:** `src/pages/vendor/Dashboard.jsx`  
**Route:** `/vendor/dashboard`  
**Component:** `VendorDashboard`

---

## 📊 Executive Summary

After thorough review of the Vendor Dashboard, I identified **10 issues** including **Chart.js gradient crash risk**, **hardcoded low stock threshold**, **no Error Boundary**, and **chart not updating on language change**. The page has **good foundations** with all queries properly scoped to `vendor_id`, real-time updates, comprehensive stats, and stock alerts. However, several improvements are needed for production readiness.

### Issues Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical (Security/Stability) | 2 | Must fix immediately |
| 🟡 High (Functionality) | 4 | Should fix |
| 🟢 Medium (UX) | 3 | Nice to have |
| ⚪ Low (Cosmetic) | 1 | Optional |

---

## ❌ Issues Found & Fixes

---

### 🔴 CRITICAL #1: Chart.js Gradient Function Can Crash

**Issue:** The `backgroundColor` gradient function accesses `context.chart.ctx` which can be `undefined` during initial render or SSR, causing a crash.

**Risk:** **SEVERE** — Dashboard crashes if chart fails to render.

**Current Code:**
```javascript
backgroundColor: (context) => {
  const ctx = context.chart.ctx // ❌ Can be undefined!
  const gradient = ctx.createLinearGradient(0, 0, 0, 250)
  gradient.addColorStop(0, 'rgba(22, 163, 74, 0.15)')
  gradient.addColorStop(1, 'rgba(22, 163, 74, 0)')
  return gradient
},
```

**Fixed Code:**
```javascript
backgroundColor: (context) => {
  const ctx = context.chart?.ctx
  if (!ctx) return 'rgba(22, 163, 74, 0.1)' // Fallback solid color

  const gradient = ctx.createLinearGradient(0, 0, 0, 250)
  gradient.addColorStop(0, 'rgba(22, 163, 74, 0.15)')
  gradient.addColorStop(1, 'rgba(22, 163, 74, 0)')
  return gradient
},
```

**Impact:** ✅ Chart won't crash on initial render

---

### 🔴 CRITICAL #2: No Error Boundary

**Issue:** No Error Boundary wrapping the Vendor Dashboard. If Chart.js or any component crashes, the entire page shows a blank screen.

**Fixed Code:**
```jsx
import ErrorBoundary from '@/components/ErrorBoundary'

const VendorDashboardWithErrorBoundary = () => (
  <ErrorBoundary componentName="VendorDashboard">
    <VendorDashboard />
  </ErrorBoundary>
)

export default VendorDashboardWithErrorBoundary
```

**Impact:** ✅ Prevents complete page crash on errors

---

### 🟡 HIGH #3: Low Stock Threshold is Hardcoded (Not Configurable)

**Issue:** Low stock threshold is hardcoded to 5 units. Vendors cannot customize this threshold.

**Risk:** **HIGH** — Different products have different stock needs. A vendor selling bulk items may want threshold of 50, while one selling expensive items may want 2.

**Current Code:**
```javascript
// ---- 2. Low stock products (< 5 units) ----
const { data: lowStock } = await supabase
  .from('products')
  .select('id, name, available_quantity, image_url, category')
  .eq('vendor_id', profile.id)
  .eq('is_available', true)
  .lte('available_quantity', 5) // ❌ Hardcoded!
  .gt('available_quantity', 0)
```

**Fixed Code:**
```javascript
// Get vendor's low stock threshold from profile (default 10)
const lowStockThreshold = profile?.low_stock_threshold || 10

// ---- 2. Low stock products (< threshold units) ----
const { data: lowStock } = await supabase
  .from('products')
  .select('id, name, available_quantity, image_url, category')
  .eq('vendor_id', profile.id)
  .eq('is_available', true)
  .lte('available_quantity', lowStockThreshold)
  .gt('available_quantity', 0)
  .order('available_quantity', { ascending: true })
  .limit(10)
```

**Also add threshold configuration in vendor settings:**
```jsx
// In vendor settings page:
<div>
  <label className="input-label">Low Stock Alert Threshold</label>
  <input
    type="number"
    value={profile?.low_stock_threshold || 10}
    onChange={(e) => updateProfile({ low_stock_threshold: parseInt(e.target.value) })}
    min="1"
    max="1000"
    className="input"
  />
  <p className="text-xs text-gray-500 mt-1">
    Get alerted when product stock falls below this number
  </p>
</div>
```

**Impact:** ✅ Vendors can customize their low stock threshold

---

### 🟡 HIGH #4: Chart Doesn't Update on Language Change

**Issue:** Chart labels use `i18n.language` but the chart data is only loaded once. When user changes language, chart labels remain in the old language.

**Current Code:**
```javascript
const chartLabels = Object.keys(dailyTotals).map((key) => {
  const d = new Date(key)
  return d.toLocaleDateString(i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'fr' ? 'fr-MA' : 'en-US', {
    weekday: 'short',
  })
})
```

**Fixed Code:**
```javascript
// Add i18n.language to loadDashboardData dependencies
const loadDashboardData = useCallback(async () => {
  // ... existing code
}, [profile?.id, t, i18n.language]) // ✅ Already included!

// But chart labels need to be regenerated when language changes
// Add a useEffect to regenerate chart labels when language changes
useEffect(() => {
  if (salesChartData.labels.length > 0) {
    // Regenerate labels with new language
    const now = new Date()
    const newLabels = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      newLabels.push(d.toLocaleDateString(i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'fr' ? 'fr-MA' : 'en-US', {
        weekday: 'short',
      }))
    }
    setSalesChartData(prev => ({
      ...prev,
      labels: newLabels,
    }))
  }
}, [i18n.language])
```

**Impact:** ✅ Chart labels update when language changes

---

### 🟡 HIGH #5: Realtime Subscription May Cause Memory Leak

**Issue:** The realtime subscription depends on `loadDashboardData` which changes when `i18n.language` changes. This causes the subscription to be recreated on every language change, potentially causing memory leaks.

**Current Code:**
```javascript
useEffect(() => {
  if (!profile?.id) return

  realtimeSubRef.current = realtimeService.subscribeToVendorOrders(
    profile.id,
    async (payload) => {
      // ...
      await loadDashboardData()
    }
  )

  return () => {
    if (realtimeSubRef.current) {
      if (typeof realtimeSubRef.current === 'function') {
        realtimeSubRef.current()
      } else if (typeof realtimeSubRef.current.unsubscribe === 'function') {
        realtimeSubRef.current.unsubscribe()
      }
      realtimeSubRef.current = null
    }
  }
}, [profile?.id, loadDashboardData, t]) // ❌ loadDashboardData changes on language change!
```

**Fixed Code:**
```javascript
// Use a ref to always have the latest loadDashboardData
const loadDashboardDataRef = useRef(loadDashboardData)
useEffect(() => {
  loadDashboardDataRef.current = loadDashboardData
}, [loadDashboardData])

useEffect(() => {
  if (!profile?.id) return

  realtimeSubRef.current = realtimeService.subscribeToVendorOrders(
    profile.id,
    async (payload) => {
      logger.info('Realtime order update:', payload)

      if (payload.eventType === 'INSERT' || payload.new?.status === 'pending') {
        setNewOrderNotification({
          id: payload.new?.id,
          orderNumber: payload.new?.order_number,
          total: payload.new?.total,
          time: new Date().toISOString(),
        })
        toast.success(t('vendor.dashboard.notifications.newOrder', 'New order received!'), {
          icon: '🛒',
          duration: 5000,
        })
      }

      // Use ref to avoid stale closure
      await loadDashboardDataRef.current()
    }
  )

  return () => {
    if (realtimeSubRef.current) {
      if (typeof realtimeSubRef.current === 'function') {
        realtimeSubRef.current()
      } else if (typeof realtimeSubRef.current.unsubscribe === 'function') {
        realtimeSubRef.current.unsubscribe()
      }
      realtimeSubRef.current = null
    }
  }
}, [profile?.id, t]) // ✅ Removed loadDashboardData from dependencies
```

**Impact:** ✅ No memory leaks on language change

---

### 🟡 HIGH #6: No Empty State for Sales Chart

**Issue:** When there's no sales data, the chart shows a plain gray box with text. Could be more informative.

**Recommendation:** Add a more engaging empty state:
```jsx
{salesChartData.labels.length > 0 ? (
  <Line data={salesChartData} options={chartOptions} />
) : (
  <div className="flex flex-col items-center justify-center h-full bg-gray-50 rounded-xl">
    <CurrencyDollarIcon className="w-12 h-12 text-gray-300 mb-3" />
    <p className="text-sm text-gray-400 font-medium">
      {t('vendor.dashboard.charts.noData', 'No sales data yet for this period')}
    </p>
    <p className="text-xs text-gray-400 mt-1">
      Sales will appear here once you start receiving orders
    </p>
  </div>
)}
```

---

### 🟢 MEDIUM #7: No Export Dashboard Data

**Recommendation:** Add button to export dashboard data as CSV/PDF:
```jsx
<button
  onClick={handleExportDashboard}
  className="btn-outline text-sm"
>
  📥 Export Report
</button>
```

---

### 🟢 MEDIUM #8: No Date Range Selector for Chart

**Issue:** Chart always shows last 7 days. No option to view 30 days, 3 months, etc.

**Recommendation:** Add date range selector:
```jsx
const [chartRange, setChartRange] = useState(7) // 7, 14, 30 days

// In query:
const rangeStart = new Date(now.getTime() - chartRange * 24 * 60 * 60 * 1000).toISOString()
```

---

### 🟢 MEDIUM #9: No Loading State for Individual Sections

**Issue:** When realtime updates trigger a reload, the entire dashboard shows a loading spinner.

**Recommendation:** Use optimistic updates for individual sections instead of full reload.

---

### ⚪ LOW #10: No Keyboard Shortcuts

**Recommendation:** Add keyboard shortcuts for quick actions:
```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    // Alt+A: Accept first pending order
    if (e.altKey && e.key === 'a' && pendingOrders.length > 0) {
      e.preventDefault()
      handleAcceptOrder(pendingOrders[0].id)
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [pendingOrders])
```

---

## ✅ What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| **Vendor ID Scoping** | ✅ Working | ALL queries use `.eq('vendor_id', profile.id)` |
| **Real-time Updates** | ✅ Working | Supabase Realtime subscription |
| **Stock Alerts** | ✅ Working | Low stock and out of stock alerts |
| **Sales Chart** | ✅ Working | 7-day sales trend with Chart.js |
| **Order Actions** | ✅ Working | Accept/reject with confirmation |
| **Responsive Design** | ✅ Working | Desktop table + mobile cards |
| **i18n Support** | ✅ Working | All text translated |
| **Time Remaining** | ✅ Working | 1-hour deadline with urgency indicators |
| **Trend Indicators** | ✅ Working | Daily/monthly comparisons |

---

## 📝 Files to Modify

| File | Changes Required |
|------|------------------|
| `src/pages/vendor/Dashboard.jsx` | 8 fixes (#1, #2, #3, #4, #5, #6, #8, #10) |

---

## 🎯 Priority Fixes (Top 5)

If you only fix 5 things, fix these:

1. **Chart.js Gradient Crash (#1)** - Prevent dashboard crash
2. **Error Boundary (#2)** - Prevent page crash on errors
3. **Configurable Stock Threshold (#3)** - Vendor customization
4. **Chart Language Update (#4)** - Labels update on language change
5. **Realtime Memory Leak (#5)** - Prevent memory leaks

---

**End of Audit Report**
