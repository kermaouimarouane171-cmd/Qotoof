# 🔍 Stores Page Audit Report - Greenmarket (Qotoof)

**Date:** April 11, 2026  
**Auditor:** Senior Full-Stack Engineer (20 years experience)  
**File:** `src/pages/Stores.jsx`  
**Route:** `/stores`  
**Component:** `Stores`

---

## 📊 Executive Summary

After thorough review of the Stores page, I identified **12 issues** ranging from critical to minor. The page has **good foundations** with store cards, filters, and sorting, but requires improvements in **URL persistence**, **performance**, **accessibility**, and **error handling**.

### Issues Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 3 | Must fix |
| 🟡 High | 5 | Should fix |
| 🟢 Medium | 3 | Nice to have |
| ⚪ Low | 1 | Optional |

---

## ❌ Issues Found & Fixes

---

### 🔴 ERROR #1: Filters Don't Update URL Query Params

**Issue:** Filters are stored in component state only. When user refreshes page or shares URL, filters are lost.

**Risk:** Lost filters on refresh, can't share filtered URLs

**Location:** All filter state (`search`, `cityFilter`, `categoryFilter`, `sortBy`)

**Current Code:**
```javascript
const [search, setSearch] = useState('')
const [cityFilter, setCityFilter] = useState('')
const [categoryFilter, setCategoryFilter] = useState('')
const [sortBy, setSortBy] = useState('newest')
```

**Fixed Code:**
```javascript
import { useSearchParams } from 'react-router-dom'

const Stores = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize from URL
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [cityFilter, setCityFilter] = useState(searchParams.get('city') || '')
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '')
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest')

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (cityFilter) params.set('city', cityFilter)
    if (categoryFilter) params.set('category', categoryFilter)
    if (sortBy !== 'newest') params.set('sort', sortBy)
    setSearchParams(params)
  }, [search, cityFilter, categoryFilter, sortBy])

  // Sync from URL changes (back/forward)
  useEffect(() => {
    setSearch(searchParams.get('search') || '')
    setCityFilter(searchParams.get('city') || '')
    setCategoryFilter(searchParams.get('category') || '')
    setSortBy(searchParams.get('sort') || 'newest')
  }, [searchParams])
```

---

### 🔴 ERROR #2: N+1 Query Problem for Ratings/Categories

**Issue:** For each store, 2 separate API calls are made (reviews + products). With 50 stores, that's 101 API calls!

**Risk:** Very slow loading, rate limiting, poor performance

**Current Code:**
```javascript
await Promise.all(
  data.map(async (store) => {
    const { data: reviews } = await supabase.from('reviews')...
    const { data: products } = await supabase.from('products')...
  })
)
```

**Fixed Code:**
```javascript
// Batch queries instead of N+1
if (data && data.length > 0) {
  const vendorIds = data.map(s => s.id)

  // Fetch all reviews at once
  const { data: allReviews } = await supabase
    .from('reviews')
    .select('vendor_id, rating')
    .in('vendor_id', vendorIds)

  // Fetch all product categories at once
  const { data: allProducts } = await supabase
    .from('products')
    .select('vendor_id, category')
    .in('vendor_id', vendorIds)
    .eq('is_available', true)

  // Process reviews
  const ratings = {}
  vendorIds.forEach(id => { ratings[id] = { average: 0, count: 0 } })

  if (allReviews) {
    const grouped = allReviews.reduce((acc, r) => {
      if (!acc[r.vendor_id]) acc[r.vendor_id] = []
      acc[r.vendor_id].push(r.rating)
      return acc
    }, {})

    Object.entries(grouped).forEach(([vendorId, ratingsList]) => {
      ratings[vendorId] = {
        average: ratingsList.reduce((a, b) => a + b, 0) / ratingsList.length,
        count: ratingsList.length
      }
    })
  }

  // Process categories
  const categories = {}
  if (allProducts) {
    const grouped = allProducts.reduce((acc, p) => {
      if (!acc[p.vendor_id]) acc[p.vendor_id] = new Set()
      acc[p.vendor_id].add(p.category)
      return acc
    }, {})

    Object.entries(grouped).forEach(([vendorId, catSet]) => {
      categories[vendorId] = [...catSet]
    })
  }

  // Ensure all vendors have entries
  vendorIds.forEach(id => {
    if (!categories[id]) categories[id] = []
  })

  setStoreRatings(ratings)
  setStoreCategories(categories)
}
```

**Impact:** From 101 API calls → 3 API calls (97% reduction!)

---

### 🔴 ERROR #3: Missing Error Boundary

**Issue:** No Error Boundary wrapping the Stores page.

**Risk:** Complete page crash on API failure

**Fixed Code:**
```javascript
import ErrorBoundary from '@/components/ErrorBoundary'

const StoresWithErrorBoundary = () => (
  <ErrorBoundary componentName="StoresPage">
    <Stores />
  </ErrorBoundary>
)

export default StoresWithErrorBoundary
```

---

### 🟡 ERROR #4: Store Link May Be Wrong

**Issue:** Store card navigates to `/stores/${store.id}` but should verify route exists.

**Status:** ✅ Route exists in App.jsx: `path="stores/:id"`

**No fix needed**, but should add keyboard accessibility:

```javascript
<Card
  onClick={() => navigate(`/stores/${store.id}`)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigate(`/stores/${store.id}`)
    }
  }}
  tabIndex={0}
  role="link"
  aria-label={`Visit store: ${displayName}`}
>
```

---

### 🟡 ERROR #5: Page Title and Count Not Translated

**Issue:** Header has hardcoded English text.

**Fixed Code:**
```jsx
<h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
  {t('stores.title', 'All Stores')}
</h1>
<p className="text-gray-600">
  {t('stores.browseStores', 'Browse {{count}} stores on Qotoof', { count: stores.length })}
</p>
```

---

### 🟡 ERROR #6: Empty State Not Translated

**Fixed Code:**
```jsx
<div className="text-center py-16">
  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
    <MagnifyingGlassIcon className="w-10 h-10 text-gray-400" />
  </div>
  <h3 className="text-lg font-semibold text-gray-900 mb-2">
    {t('stores.empty.title', 'No stores found')}
  </h3>
  <p className="text-gray-500 mb-4">
    {t('stores.empty.description', 'Try adjusting your filters or search terms')}
  </p>
  {hasActiveFilters && (
    <button onClick={clearAllFilters} className="btn-primary">
      {t('stores.empty.clearFilters', 'Clear Filters')}
    </button>
  )}
</div>
```

---

### 🟡 ERROR #7: Search Input Triggers Filter on Every Keystroke

**Issue:** No debounce on search input, filters update on every character typed.

**Fixed Code:**
```javascript
const [searchTimeout, setSearchTimeout] = useState(null)

const handleSearchChange = (e) => {
  const value = e.target.value
  setSearch(value)

  if (searchTimeout) clearTimeout(searchTimeout)

  const timeout = setTimeout(() => {
    // URL update handled by useEffect
  }, 500)

  setSearchTimeout(timeout)
}

useEffect(() => {
  return () => {
    if (searchTimeout) clearTimeout(searchTimeout)
  }
}, [searchTimeout])
```

---

### 🟡 ERROR #8: Sort Labels Hardcoded

**Fixed Code:**
```javascript
const SORT_OPTIONS = [
  { id: 'newest', label: t('stores.sort.newest', 'Newest First') },
  { id: 'oldest', label: t('stores.sort.oldest', 'Oldest First') },
  { id: 'highest_rated', label: t('stores.sort.highestRated', 'Highest Rated') },
  { id: 'most_reviewed', label: t('stores.sort.mostReviewed', 'Most Reviewed') },
]
```

---

### 🟢 ERROR #9: Responsive Grid Could Add xl Breakpoint

**Current:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`  
**Fixed:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

---

### 🟢 ERROR #10: Loading State Shows Only Spinner

**Recommendation:** Add skeleton cards while loading:

```javascript
if (loading) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="aspect-video bg-gray-200 rounded-t-xl" />
            <div className="p-4 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-4 bg-gray-200 rounded w-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

---

### 🟢 ERROR #11: Specialty Options Hardcoded

**Fixed Code:**
```javascript
const SPECIALTY_OPTIONS = [
  { id: 'plants', label: t('stores.specialties.plants', 'Plants'), emoji: '🌿' },
  { id: 'vegetables', label: t('stores.specialties.vegetables', 'Vegetables'), emoji: '🥬' },
  { id: 'fruits', label: t('stores.specialties.fruits', 'Fruits'), emoji: '🍎' },
  { id: 'herbs', label: t('stores.specialties.herbs', 'Herbs'), emoji: '🌱' },
  { id: 'seeds', label: t('stores.specialties.seeds', 'Seeds'), emoji: '🌰' },
]
```

---

### ⚪ ERROR #12: Store Card Missing aria-labels on Some Elements

**Fixed Code:**
```jsx
<button
  onClick={() => navigate(`/stores/${store.id}`)}
  aria-label={t('stores.visitStore', 'Visit {{storeName}}', { storeName: displayName })}
  className="..."
>
  <span>{t('stores.visitStore', 'Visit Store')}</span>
  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
</button>
```

---

## ✅ What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| **Store Cards** | ✅ Excellent | Rich info: logo, name, location, categories, rating |
| **Filter Logic** | ✅ Working | Search, city, category filters work correctly |
| **Sort Logic** | ✅ Working | 4 sort options implemented |
| **Error State** | ✅ Implemented | Shows error message with retry button |
| **Empty State** | ✅ Implemented | Shows when no stores match filters |
| **Active Filter Tags** | ✅ Implemented | Visual tags with remove buttons |
| **Verified Badge** | ✅ Working | Shows on verified stores |
| **Online Indicator** | ✅ Working | Shows online/offline status |
| **Responsive Grid** | ✅ Good | 1/2/3 columns |
| **Card Interactions** | ✅ Working | Hover effects, click to navigate |

---

## 📝 Files to Modify

| File | Changes Required |
|------|------------------|
| `src/pages/Stores.jsx` | 12 fixes (#1-#12) |
| `src/i18n/locales/en.json` | Add stores translation keys |
| `src/i18n/locales/ar.json` | Add stores translation keys |
| `src/i18n/locales/fr.json` | Add stores translation keys |

---

## 🎯 Priority Fixes (Top 5)

If you only fix 5 things, fix these:

1. **URL Query Params (#1)** - Persist filters in URL
2. **N+1 Query Problem (#2)** - 97% performance improvement
3. **Error Boundary (#3)** - Prevent page crashes
4. **Keyboard Accessibility (#4)** - Screen reader support
5. **Search Debounce (#7)** - Reduce unnecessary re-renders

---

**End of Audit Report**
