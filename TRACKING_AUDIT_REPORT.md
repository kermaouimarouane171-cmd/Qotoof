# 🔍 General Tracking Page (/tracking) Security & Functionality Audit Report

**Date:** April 11, 2026  
**Auditor:** Senior Full-Stack Engineer (20 years experience)  
**File:** `src/pages/Tracking.jsx`  
**Route:** `/tracking`  
**Component:** `Tracking`

---

## 📊 Executive Summary

After thorough security and functionality review of the General Tracking page, I identified **8 issues** including **severe data exposure vulnerabilities**, **phone number lookup bypass**, and **excessive data retrieval**. The page has **excellent foundations** with input validation, rate limiting, XSS/SQL injection protection, and sanitization. However, critical security improvements are needed for data exposure.

### Issues Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical (Security) | 3 | Must fix immediately |
| 🟡 High (Functionality) | 3 | Should fix |
| 🟢 Medium (UX) | 1 | Nice to have |
| ⚪ Low (Privacy) | 1 | Optional |

---

## ❌ Issues Found & Fixes

---

### 🔴 CRITICAL #1: Sensitive Data Exposure in Query Results

**Issue:** The API query returns full order data including all items with product details, vendor info, and financial data. This is excessive for a public tracking page.

**Risk:** **SEVERE** — Anyone with an order number can see full order details including all items, prices, and vendor information.

**Current Code (EXPOSES TOO MUCH):**
```javascript
let query = supabase
  .from('orders')
  .select(`
    id,
    order_number,
    status,
    total,
    buyer_total,
    created_at,
    completed_at,
    shipping_city,
    items:order_items(
      id,
      quantity,
      unit_price,
      product:products(id, name, image_url)
    ),
    vendor:profiles!orders_vendor_id_fkey(store_name)
  `)
```

**Fixed Code (MINIMAL DATA):**
```javascript
let query = supabase
  .from('orders')
  .select(`
    id,
    order_number,
    status,
    buyer_total,
    created_at,
    shipping_city,
    item_count:order_items(count)
  `)
```

**Impact:** ✅ Only shows essential tracking info (status, city, date, item count)

---

### 🔴 CRITICAL #2: Phone Number Lookup Allows Tracking Anyone's Orders

**Issue:** When searching by phone, the page finds the user profile by phone, then returns ALL orders for that profile. Anyone with someone else's phone number can track their orders.

**Risk:** **SEVERE** — Privacy violation. Anyone can track any order by knowing the phone number.

**Current Code (VULNERABLE):**
```javascript
if (validatedPhone && !validatedOrder) {
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', validatedPhone)
    .maybeSingle()

  if (profileData) {
    buyerId = profileData.id
  }
  // ... then queries all orders for this buyerId
}
```

**Fixed Code (REQUIRE BOTH ORDER NUMBER + PHONE):**
```javascript
// Phone search requires BOTH order number AND phone for verification
if (validatedPhone && !validatedOrder) {
  setErrors((prev) => ({
    ...prev,
    general: t('orderTracking.errors.phoneAlone', 'Please enter both order number and phone number for security.'),
  }))
  setSearching(false)
  return
}

// If both provided, verify they match
if (validatedPhone && validatedOrder) {
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', validatedPhone)
    .maybeSingle()

  if (profileData) {
    buyerId = profileData.id
  }

  // Query requires BOTH order number AND buyer_id match
  query = query
    .eq('order_number', validatedOrder)
    .eq('buyer_id', buyerId)
}
```

**Alternative (MORE SECURE):** Only allow phone search if user is logged in:
```javascript
if (validatedPhone && !validatedOrder) {
  const { data: { user } } = await supabase.auth.getSession()
  if (!user) {
    setErrors((prev) => ({
      ...prev,
      general: t('orderTracking.errors.loginRequired', 'Please login or enter order number to track.'),
    }))
    return
  }
  // ... proceed with phone search for logged-in user
}
```

**Impact:** ✅ Prevents unauthorized order tracking via phone number

---

### 🔴 CRITICAL #3: No Error Boundary

**Issue:** No Error Boundary wrapping the Tracking page.

**Fixed Code:**
```javascript
import ErrorBoundary from '@/components/ErrorBoundary'

const TrackingWithErrorBoundary = () => (
  <ErrorBoundary componentName="TrackingPage">
    <Tracking />
  </ErrorBoundary>
)

export default TrackingWithErrorBoundary
```

---

### 🟡 HIGH #4: Query Returns Full Product Details in Items

**Issue:** `product:products(id, name, image_url)` returns full product info. For public tracking, only item count is needed.

**Fixed Code:**
```javascript
// Instead of full items query, just get count
const { data, error, count } = await supabase
  .from('orders')
  .select(`
    id,
    order_number,
    status,
    buyer_total,
    created_at,
    shipping_city
  `, { count: 'exact', head: false })
  .eq('order_number', validatedOrder)
  .single()

// Get item count separately (minimal data)
const { count: itemCount } = await supabase
  .from('order_items')
  .select('*', { count: 'exact', head: true })
  .eq('order_id', data.id)
```

---

### 🟡 HIGH #5: No Rate Limiting on Phone Lookup

**Issue:** Rate limiting is applied but phone lookup (`profiles` query) happens before rate limit check in some code paths.

**Current Code:**
```javascript
// Rate limiting check happens AFTER phone lookup
let buyerId = null
if (validatedPhone && !validatedOrder) {
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', validatedPhone)  // ← This runs before rate limit
    .maybeSingle()
```

**Fixed Code:**
```javascript
// Rate limiting check FIRST
const deviceFingerprint = generateDeviceFingerprint()
const rateResult = checkOrderTrackingRate(deviceFingerprint)

if (!rateResult.allowed) {
  const retryMinutes = Math.ceil(rateResult.retryAfter / 60000)
  setErrors((prev) => ({
    ...prev,
    general: t('orderTracking.errors.rateLimited', 'Too many attempts. Please wait {{minutes}} minutes.', {
      minutes: retryMinutes,
    }),
  }))
  return
}

// THEN phone lookup
if (validatedPhone && validatedOrder) {
  // ... proceed
}
```

---

### 🟡 HIGH #6: Search History Stores Phone Numbers in Plain Text

**Issue:** Phone numbers are stored in localStorage without encryption. On shared devices, anyone can see recently tracked phone numbers.

**Fixed Code:**
```javascript
import { encryptData, decryptData } from '@/utils/encryption'

const saveToHistory = (entry) => {
  try {
    const history = getSearchHistory()
    // Mask phone number before storing
    const maskedEntry = {
      ...entry,
      phone: entry.phone ? maskPhone(entry.phone) : null,
      timestamp: Date.now(),
    }
    // ... rest of save logic
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed))
  } catch (err) {
    logger.warn('Failed to save search history:', err)
  }
}

const maskPhone = (phone) => {
  if (!phone || phone.length < 6) return phone
  return phone.slice(0, 3) + '***' + phone.slice(-2)
}
```

---

### 🟢 MEDIUM #7: No Loading State on "View Full Tracking" Button

**Issue:** When user clicks "View Full Tracking", there's no visual feedback while navigating.

**Recommendation:** Add loading state or use React Router's navigation state.

---

### ⚪ LOW #8: localStorage Privacy Concern

**Issue:** Search history in localStorage persists across sessions. On shared devices, previous users' tracking history is visible.

**Recommendation:** Add a "Private Mode" toggle that disables history saving.

---

## ✅ What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| **Input Validation** | ✅ Excellent | Zod schema validation |
| **XSS Protection** | ✅ Working | `detectXSS()` check |
| **SQL Injection Protection** | ✅ Working | `detectSQLInjection()` check |
| **Rate Limiting** | ✅ Implemented | `checkOrderTrackingRate()` |
| **Sanitization** | ✅ Working | `sanitizeText()`, `sanitizePhone()` |
| **Debounced Validation** | ✅ Working | 400ms debounce |
| **i18n Support** | ✅ Complete | All text translated |
| **Accessibility** | ✅ Good | aria-labels, roles, alerts |
| **Search History** | ✅ Working | With clear option |
| **Error States** | ✅ Complete | Found, not found, error |

---

## 📝 Files to Modify

| File | Changes Required |
|------|------------------|
| `src/pages/Tracking.jsx` | 8 fixes (#1-#8) |
| `src/utils/encryption.js` | Add `maskPhone()` function |
| `database/migrations/*.sql` | Verify RLS policies for public order lookup |

---

## 🎯 Priority Fixes (Top 5)

If you only fix 5 things, fix these:

1. **Data Exposure (#1)** - Minimize returned data
2. **Phone Lookup Bypass (#2)** - Require both order number + phone
3. **Error Boundary (#3)** - Prevent page crashes
4. **Rate Limit Order (#5)** - Check rate limit before any API calls
5. **Phone Masking (#6)** - Mask phone numbers in history

---

**End of Audit Report**
