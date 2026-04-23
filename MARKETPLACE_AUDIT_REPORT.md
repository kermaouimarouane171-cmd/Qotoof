# 🔍 Marketplace Page Audit Report - Greenmarket (Qotoof)

**Date:** April 11, 2026  
**Auditor:** Senior Full-Stack Engineer (20 years experience)  
**File:** `src/pages/Marketplace.jsx`  
**Route:** `/marketplace`  
**Component:** `MarketplacePage`

---

## 📊 Executive Summary

After thorough review of the Marketplace page, I identified **14 issues** ranging from critical to minor. The page has **good foundations** with URL-based filters, pagination, and proper Supabase queries, but requires improvements in **filter persistence**, **sort implementation**, **accessibility**, and **error handling consistency**.

### Issues Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 4 | Must fix |
| 🟡 High | 5 | Should fix |
| 🟢 Medium | 3 | Nice to have |
| ⚪ Low | 2 | Optional |

---

## ❌ Issues Found & Fixes

---

### 🔴 ERROR #1: Filters Don't Reload on URL Change (Browser Back/Forward)

**Issue:** Filters are only initialized from URL on mount. If user navigates back/forward or manually changes URL, the filters state won't update.

**Risk:** Broken browser navigation, filters out of sync with URL

**Location:** `Marketplace.jsx` - filter initialization

**Current Code:**
```javascript
const [filters, setFilters] = useState({
  search: searchParams.get('search') || '',
  category: searchParams.get('category') || 'all',
  region: searchParams.get('region') || 'all',
  minPrice: searchParams.get('minPrice') || '',
  maxPrice: searchParams.get('maxPrice') || '',
  sortBy: searchParams.get('sortBy') || 'newest',
})
```

**Fixed Code:**
```javascript
// Initialize from URL
const getInitialFilters = () => ({
  search: searchParams.get('search') || '',
  category: searchParams.get('category') || 'all',
  region: searchParams.get('region') || 'all',
  minPrice: searchParams.get('minPrice') || '',
  maxPrice: searchParams.get('maxPrice') || '',
  sortBy: searchParams.get('sortBy') || 'newest',
})

const [filters, setFilters] = useState(getInitialFilters)

// Sync filters when URL changes (back/forward navigation)
useEffect(() => {
  const newFilters = getInitialFilters()
  setFilters(newFilters)
  setCurrentPage(parseInt(searchParams.get('page') || '1'))
}, [searchParams])
```

---

### 🔴 ERROR #2: Sort By Filter Not Implemented

**Issue:** `sortBy` is stored in state and URL but never applied to the Supabase query.

**Risk:** Sort dropdown does nothing, confusing UX

**Location:** `loadProducts()` function

**Current Code:**
```javascript
query = query.order('created_at', { ascending: false })
```

**Fixed Code:**
```javascript
// Apply sorting
switch (filters.sortBy) {
  case 'priceLow':
    query = query.order('price_per_unit', { ascending: true })
    break
  case 'priceHigh':
    query = query.order('price_per_unit', { ascending: false })
    break
  case 'name':
    query = query.order('name', { ascending: true })
    break
  case 'newest':
  default:
    query = query.order('created_at', { ascending: false })
    break
}
```

---

### 🔴 ERROR #3: loadProducts Called Directly Instead of Through useEffect

**Issue:** `updateFilters` calls `loadProducts()` directly, bypassing the useEffect dependency pattern. This creates inconsistency and potential race conditions.

**Risk:** Race conditions, stale closures, inconsistent state

**Location:** `updateFilters` and `clearFilters` functions

**Current Code:**
```javascript
const updateFilters = (newFilters) => {
  const updated = { ...filters, ...newFilters }
  setFilters(updated)
  setCurrentPage(1)
  // ... update URL ...
  loadProducts() // ❌ Direct call
}
```

**Fixed Code:**
```javascript
// Remove direct loadProducts() calls from updateFilters
const updateFilters = (newFilters) => {
  const updated = { ...filters, ...newFilters }
  setFilters(updated)
  setCurrentPage(1)

  const params = new URLSearchParams()
  if (updated.search) params.set('search', updated.search)
  if (updated.category !== 'all') params.set('category', updated.category)
  if (updated.region !== 'all') params.set('region', updated.region)
  if (updated.minPrice) params.set('minPrice', updated.minPrice)
  if (updated.maxPrice) params.set('maxPrice', updated.maxPrice)
  if (updated.sortBy !== 'newest') params.set('sortBy', updated.sortBy)
  // page param will be set by currentPage state change
  setSearchParams(params)
  // loadProducts will be called by useEffect when filters/page change
}

// Add useEffect for filters
useEffect(() => {
  loadProducts()
}, [currentPage, filters])
```

---

### 🔴 ERROR #4: Missing Error Boundary

**Issue:** No Error Boundary wrapping the Marketplace page.

**Risk:** Complete page crash on API failure

**Fixed Code:**
```javascript
import ErrorBoundary from '@/components/ErrorBoundary'

// Wrap export
const MarketplaceWithErrorBoundary = () => (
  <ErrorBoundary componentName="MarketplacePage">
    <MarketplacePage />
  </ErrorBoundary>
)

export default MarketplaceWithErrorBoundary
```

---

### 🟡 ERROR #5: No aria-labels for Accessibility

**Issue:** Missing aria-labels on search input, filter buttons, pagination, and category tabs.

**Risk:** Poor accessibility for screen readers

**Locations:** Multiple elements

**Fixes:**
```jsx
// Search input
<input
  type="text"
  placeholder="Search products..."
  aria-label={t('marketplace.searchLabel', 'Search products')}
  aria-describedby="search-help"
  id="search-input"
  // ...
/>
<span id="search-help" className="sr-only">
  Type to search for products by name or description
</span>

// Category tabs
<button
  aria-pressed={filters.category === cat.id}
  aria-label={`Filter by ${cat.label}`}
  // ...
>

// Mobile filters button
<button
  aria-label={t('marketplace.openFilters', 'Open filters')}
  aria-expanded={filtersOpen}
  // ...
>

// Pagination
<nav aria-label={t('marketplace.pagination', 'Product pagination')}>
  <button aria-label="Previous page">...</button>
  <button aria-label={`Page ${pageNum}`} aria-current={currentPage === pageNum ? 'page' : undefined}>...</button>
  <button aria-label="Next page">...</button>
</nav>
```

---

### 🟡 ERROR #6: Categories Hardcoded (Not Using i18n)

**Issue:** Category labels are hardcoded English strings instead of using translation keys.

**Current Code:**
```javascript
const categories = [
  { id: 'all', label: 'All Categories' },
  { id: 'plants', label: 'Plants & Trees' },
  // ...
]
```

**Fixed Code:**
```javascript
const categories = [
  { id: 'all', label: t('marketplace.categories.all', 'All Categories') },
  { id: 'plants', label: t('marketplace.categories.plants', 'Plants & Trees') },
  { id: 'vegetables', label: t('marketplace.categories.vegetables', 'Vegetables') },
  { id: 'fruits', label: t('marketplace.categories.fruits', 'Fruits') },
  { id: 'herbs', label: t('marketplace.categories.herbs', 'Herbs & Spices') },
  { id: 'seeds', label: t('marketplace.categories.seeds', 'Seeds & Bulbs') },
]
```

---

### 🟡 ERROR #7: Page Title and Subtitle Not Translated

**Issue:** Header section has hardcoded English text.

**Current Code:**
```jsx
<h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
  Marketplace
</h1>
<p className="text-gray-600">Find wholesale plants, vegetables, and fruits</p>
```

**Fixed Code:**
```jsx
<h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
  {t('marketplace.title', 'Marketplace')}
</h1>
<p className="text-gray-600">{t('marketplace.subtitle', 'Find wholesale plants, vegetables, and fruits')}</p>
```

---

### 🟡 ERROR #8: Empty State Not Translated

**Issue:** Empty state has hardcoded English text.

**Fixed Code:**
```jsx
<div className="text-center py-16">
  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
    <MagnifyingGlassIcon className="w-12 h-12 text-gray-400" />
  </div>
  <h3 className="text-lg font-semibold text-gray-900 mb-2">
    {t('marketplace.empty.title', 'No products found')}
  </h3>
  <p className="text-gray-500 mb-4">
    {t('marketplace.empty.description', 'Try adjusting your filters or search terms')}
  </p>
  <button onClick={clearFilters} className="btn-primary">
    {t('marketplace.empty.clearFilters', 'Clear Filters')}
  </button>
</div>
```

---

### 🟡 ERROR #9: Mobile Filters Panel Missing Accessibility Attributes

**Issue:** Mobile filters panel is a modal but lacks `role="dialog"`, `aria-modal`, and focus trap.

**Fixed Code:**
```jsx
{filtersOpen && (
  <div 
    className="lg:hidden fixed inset-0 z-40"
    role="dialog"
    aria-modal="true"
    aria-label={t('marketplace.filtersPanel', 'Filter options')}
  >
    <div className="absolute inset-0 bg-black/50" onClick={() => setFiltersOpen(false)} />
    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold" id="filters-title">
          {t('marketplace.filters', 'Filters')}
        </h3>
        <button 
          onClick={() => setFiltersOpen(false)}
          aria-label={t('common.close', 'Close')}
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>
      {/* ... */}
    </div>
  </div>
)}
```

---

### 🟢 ERROR #10: Responsive Grid Could Be Better Optimized

**Issue:** Grid uses `lg:grid-cols-3` but on very wide screens (1440px+), 3 columns leaves too much whitespace. Also missing xl breakpoint.

**Current Code:**
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
```

**Fixed Code:**
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
```

---

### 🟢 ERROR #11: Search Input Triggers API Call on Every Keystroke

**Issue:** `updateFilters({ search: e.target.value })` triggers API call on every character typed. Should debounce.

**Fixed Code:**
```javascript
import { useCallback } from 'react'

// Debounced search
const [searchTimeout, setSearchTimeout] = useState(null)

const handleSearchChange = useCallback((e) => {
  const value = e.target.value
  setFilters(prev => ({ ...prev, search: value }))

  // Clear previous timeout
  if (searchTimeout) clearTimeout(searchTimeout)

  // Set new timeout
  const timeout = setTimeout(() => {
    // Update URL and trigger reload
    const params = new URLSearchParams(searchParams)
    if (value) params.set('search', value)
    else params.delete('search')
    params.delete('page') // Reset to page 1
    setSearchParams(params)
    setCurrentPage(1)
  }, 500) // 500ms debounce

  setSearchTimeout(timeout)
}, [searchParams, setSearchParams])

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (searchTimeout) clearTimeout(searchTimeout)
  }
}, [searchTimeout])
```

---

### 🟢 ERROR #12: "Showing X of Y products" Text Not Translated

**Fixed Code:**
```jsx
<p className="text-sm text-gray-500 mb-4">
  {t('marketplace.showingResults', 'Showing {{current}} of {{total}} products', {
    current: products.length,
    total: totalCount
  })}
</p>
```

---

### ⚪ ERROR #13: No Loading State on Filter Controls During API Call

**Recommendation:** Add visual feedback on filters when loading:
```jsx
<select disabled={loading} className="input disabled:opacity-50">
```

---

### ⚪ ERROR #14: Cart Badge Uses items.length Instead of Total Quantity

**Issue:** Cart badge shows number of distinct items (3 products) not total quantity (10 kg + 5 boxes = 15 units).

**Current behavior:** `getItemCount()` returns `items.length` (distinct products)
**Alternative:** Could use `getTotalQuantity()` for total units

**This is a design decision, not a bug.** Current implementation is standard for e-commerce.

---

## ✅ What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| **URL-based Filters** | ✅ Good | Filters persist in URL, shareable links work |
| **Pagination** | ✅ Implemented | Proper range queries, page buttons with smart window |
| **Supabase Query** | ✅ Optimized | Using count, proper joins, filters |
| **Cart Integration** | ✅ Working | ProductCard uses addItem with validation |
| **Cart Badge** | ✅ Correct | Updates via Zustand store, persists in localStorage |
| **Loading Skeletons** | ✅ Implemented | 6 skeleton cards while loading |
| **Error States** | ✅ Handled | Toast notifications, empty state |
| **Mobile Filters** | ✅ Implemented | Bottom sheet pattern |
| **Region Loading** | ✅ Smart | Pre-loads all regions, not computed from current page |

---

## 📋 Cart & Navigation Verification

### ✅ Cart Store (cartStore.js)

| Method | Status | Notes |
|--------|--------|-------|
| `addItem` | ✅ Working | Validates availability, min qty, stock |
| `removeItem` | ✅ Working | Removes from array |
| `updateQuantity` | ✅ Working | Validates against limits |
| `getItemCount` | ✅ Working | Returns `items.length` (distinct items) |
| `getTotalQuantity` | ✅ Available | Returns sum of all quantities |
| `persist` | ✅ Working | Zustand persist middleware, localStorage |

### ✅ Cart Badge in Navbar (MainLayout.jsx)

```javascript
const { getItemCount } = useCartStore()
const cartCount = getItemCount() // Returns items.length

// In JSX:
{cartCount > 0 && (
  <span className="absolute -top-0.5 -right-0.5 ...">
    {cartCount}
  </span>
)}
```

**Status:** ✅ Working correctly. Badge shows distinct item count.

### ✅ ProductCard Add to Cart

```javascript
const handleQuickAdd = (e) => {
  e.preventDefault()
  e.stopPropagation()
  addItem(product, product.min_order_quantity)
}
```

**Status:** ✅ Working correctly. Adds with min order quantity, shows toast.

---

## 📝 Files to Modify

| File | Changes Required |
|------|------------------|
| `src/pages/Marketplace.jsx` | 12 fixes (#1-#12) |
| `src/i18n/locales/en.json` | Add marketplace translation keys |
| `src/i18n/locales/ar.json` | Add marketplace translation keys |
| `src/i18n/locales/fr.json` | Add marketplace translation keys |

---

## 🎯 Priority Fixes (Top 5)

If you only fix 5 things, fix these:

1. **Filter URL Sync (#1)** - Fix browser navigation
2. **Sort Implementation (#2)** - Make sort dropdown work
3. **useEffect Pattern (#3)** - Consistent data loading
4. **Error Boundary (#4)** - Prevent page crashes
5. **Accessibility (#5, #9)** - Screen reader support

---

**End of Audit Report**
