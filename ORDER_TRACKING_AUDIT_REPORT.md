# 🔍 Order Tracking Page Security & Functionality Audit Report

**Date:** April 11, 2026  
**Auditor:** Senior Full-Stack Engineer (20 years experience)  
**File:** `src/pages/OrderTracking.jsx`  
**Route:** `/orders/:id/tracking`  
**Component:** `OrderTracking`

---

## 📊 Executive Summary

After thorough security and functionality review of the Order Tracking page, I identified **15 critical issues** including **severe IDOR vulnerability**, **no real-time updates**, **no map integration**, **no authentication**, and **no subscription cleanup**. This page is essentially a static order status display, not a real tracking page.

### Issues Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical (Security) | 4 | Must fix immediately |
| 🟡 High (Functionality) | 6 | Should fix |
| 🟢 Medium (UX) | 4 | Nice to have |
| ⚪ Low (Cosmetic) | 1 | Optional |

---

## ❌ Issues Found & Fixes

---

### 🔴 CRITICAL #1: IDOR Vulnerability — No Ownership Verification

**Issue:** The API query fetches order by ID without verifying it belongs to the current user. Any authenticated user can track any order.

**Risk:** **SEVERE** — Users can track other users' orders, including driver info and delivery address.

**Current Code (VULNERABLE):**
```javascript
const { data, error } = await supabase
  .from('orders')
  .select(`...`)
  .eq('id', id)
  .single()
```

**Fixed Code:**
```javascript
const { data, error } = await supabase
  .from('orders')
  .select(`
    *,
    vendor:profiles!orders_vendor_id_fkey(store_name, phone),
    driver:profiles!orders_driver_id_fkey(first_name, last_name, phone, avatar_url, latitude, longitude, vehicle_type)
  `)
  .eq('id', id)
  // CRITICAL: Verify ownership
  .or(`buyer_id.eq.${user.id},vendor_id.eq.${user.id},driver_id.eq.${user.id}`)
  .single()

// Double-check ownership in frontend (defense in depth)
if (
  data.buyer_id !== user.id &&
  data.vendor_id !== user.id &&
  data.driver_id !== user.id
) {
  setError('forbidden')
  return
}
```

---

### 🔴 CRITICAL #2: No Authentication Check

**Issue:** Page doesn't redirect to login if user is not authenticated.

**Fixed Code:**
```javascript
useEffect(() => {
  if (!user) {
    navigate('/login', { state: { from: `/orders/${id}/tracking` } })
    return
  }
  loadOrder()
}, [user, id, navigate])

if (!user) {
  return <LoadingSpinner />
}
```

---

### 🔴 CRITICAL #3: No Real-Time Updates

**Issue:** Page loads order once and never updates. No WebSockets, no Supabase realtime, no polling.

**Risk:** Users must manually refresh to see status changes or driver location updates.

**Fixed Code:**
```javascript
import { useRef, useEffect, useState } from 'react'

const subscriptionRef = useRef(null)

useEffect(() => {
  if (!id || !user) return

  // Subscribe to order status updates via Supabase Realtime
  subscriptionRef.current = supabase
    .channel(`order-tracking-${id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${id}`,
      },
      (payload) => {
        setOrder((prev) => (prev ? { ...prev, ...payload.new } : payload.new))
        toast.success('Order status updated!')
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setRealtimeConnected(true)
      }
    })

  // CRITICAL: Cleanup on unmount
  return () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe()
    }
  }
}, [id, user])
```

---

### 🔴 CRITICAL #4: No Map Integration / Driver Location Tracking

**Issue:** No map component at all. Driver location is not displayed or tracked in real-time.

**Risk:** Users can't see where their driver is, defeating the purpose of "tracking".

**Fixed Code:**
```javascript
import { Map } from '@/components/ui'

// In component:
const [driverLocation, setDriverLocation] = useState(null)
const driverSubscriptionRef = useRef(null)

// Subscribe to driver location updates (if driver assigned)
useEffect(() => {
  if (!order?.driver_id || !order.driver?.latitude || !order.driver?.longitude) return

  setDriverLocation({
    lat: order.driver.latitude,
    lng: order.driver.longitude,
  })

  // Subscribe to driver location updates
  driverSubscriptionRef.current = supabase
    .channel(`driver-location-${order.driver_id}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${order.driver_id}`,
      },
      (payload) => {
        if (payload.new?.latitude && payload.new?.longitude) {
          setDriverLocation({
            lat: payload.new.latitude,
            lng: payload.new.longitude,
          })
        }
      }
    )
    .subscribe()

  return () => {
    if (driverSubscriptionRef.current) {
      driverSubscriptionRef.current.unsubscribe()
    }
  }
}, [order?.driver_id, order?.driver?.latitude, order?.driver?.longitude])

// Render map (only when driver assigned and location available)
{order.driver && driverLocation && (
  <Card className="p-6 mb-8">
    <h2 className="font-semibold text-gray-900 mb-3">Live Driver Location</h2>
    <Map
      center={[driverLocation.lat, driverLocation.lng]}
      zoom={14}
      markers={[
        {
          lat: driverLocation.lat,
          lng: driverLocation.lng,
          popup: `${order.driver.first_name} ${order.driver.last_name} (Driver)`,
          icon: 'driver',
        },
        {
          lat: order.shipping_latitude || 33.5731,
          lng: order.shipping_longitude || -7.5898,
          popup: 'Delivery Address',
          icon: 'destination',
        },
      ]}
      height="300px"
    />
  </Card>
)}
```

---

### 🟡 HIGH #5: No Handling for Unassigned Driver (Pending/Preparing States)

**Issue:** Driver info section only shows when `order.driver` exists, but there's no messaging for pending/preparing states.

**Fixed Code:**
```javascript
{/* Driver Info or Pending Message */}
{order.driver ? (
  <Card className="p-6 mb-8">
    <h2 className="font-semibold text-gray-900 mb-3">Your Driver</h2>
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
        {order.driver.avatar_url ? (
          <img src={order.driver.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          <span className="text-green-600 font-semibold">
            {order.driver.first_name?.[0]}{order.driver.last_name?.[0]}
          </span>
        )}
      </div>
      <div className="flex-1">
        <p className="font-medium">{order.driver.first_name} {order.driver.last_name}</p>
        <p className="text-sm text-gray-500">
          {order.status === 'shipped' || order.status === 'on_the_way'
            ? 'On the way to you'
            : 'Assigned to your order'}
        </p>
        {order.driver.vehicle_type && (
          <p className="text-xs text-gray-400 mt-0.5">
            Vehicle: {order.driver.vehicle_type}
          </p>
        )}
      </div>
      {order.driver.phone && (
        <a href={`tel:${order.driver.phone}`} className="btn-primary text-sm">
          Call Driver
        </a>
      )}
    </div>
  </Card>
) : (
  <Card className="p-6 mb-8 bg-blue-50 border border-blue-200">
    <div className="flex items-start gap-3">
      <ClockIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="font-semibold text-blue-900 mb-1">
          {['pending', 'confirmed', 'preparing'].includes(order.status)
            ? 'Awaiting Driver Assignment'
            : 'Driver Not Yet Assigned'}
        </h3>
        <p className="text-blue-700 text-sm">
          {order.status === 'pending'
            ? 'Your order is pending. A driver will be assigned once the vendor confirms.'
            : order.status === 'confirmed'
            ? 'Your order is confirmed. The vendor is preparing your items.'
            : 'A driver will be assigned once your order is ready for delivery.'}
        </p>
      </div>
    </div>
  </Card>
)}
```

---

### 🟡 HIGH #6: Timeline Doesn't Handle All Status Types

**Issue:** Only 5 status steps defined. Missing: `vendor_accepted`, `vendor_rejected`, `driver_assigned`, `driver_accepted`, `driver_picked_up`, `awaiting_driver`, `cancelled`.

**Fixed Code:**
```javascript
const statusSteps = [
  { key: 'pending', label: 'Order Placed', desc: 'Your order has been received', icon: ShoppingBagIcon },
  { key: 'confirmed', label: 'Confirmed', desc: 'Vendor confirmed your order', icon: CheckCircleIcon },
  { key: 'preparing', label: 'Preparing', desc: 'Vendor is preparing your items', icon: ClockIcon },
  { key: 'shipped', label: 'Out for Delivery', desc: 'Driver is on the way', icon: TruckIcon },
  { key: 'on_the_way', label: 'Out for Delivery', desc: 'Driver is on the way', icon: TruckIcon },
  { key: 'delivered', label: 'Delivered', desc: 'Order delivered successfully', icon: CheckCircleIcon },
]

// Map additional statuses to their corresponding step
const statusToStepMap = {
  vendor_accepted: 1,
  vendor_rejected: -1,
  driver_assigned: 2,
  driver_accepted: 2,
  driver_picked_up: 3,
  awaiting_driver: 2,
  cancelled: -1,
}

const currentStepIndex = statusToStepMap[order.status] ?? statusSteps.findIndex(s => s.key === order.status)
```

---

### 🟡 HIGH #7: No Error Boundary

**Fixed Code:**
```javascript
import ErrorBoundary from '@/components/ErrorBoundary'

const OrderTrackingWithErrorBoundary = () => (
  <ErrorBoundary componentName="OrderTrackingPage">
    <OrderTracking />
  </ErrorBoundary>
)

export default OrderTrackingWithErrorBoundary
```

---

### 🟡 HIGH #8: No 403 Forbidden State

**Fixed Code:**
```javascript
const [error, setError] = useState(null)

if (error === 'forbidden') {
  return (
    <div className="text-center py-16">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
      <p className="text-gray-500 mb-6">You don't have permission to track this order.</p>
      <button onClick={() => navigate('/orders')} className="btn-primary">
        Back to Orders
      </button>
    </div>
  )
}
```

---

### 🟡 HIGH #9: No Session Verification

**Fixed Code:**
```javascript
const loadOrder = async () => {
  if (!user) return

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    navigate('/login', { state: { from: `/orders/${id}/tracking` } })
    return
  }

  // ... rest of loadOrder
}
```

---

### 🟡 HIGH #10: Real-time Subscription Not Cleaned Up

**Issue:** No cleanup in useEffect return function.

**Fixed Code:**
```javascript
useEffect(() => {
  if (!id || !user) return

  subscriptionRef.current = supabase.channel(`order-tracking-${id}`)
    .on('postgres_changes', { ... }, callback)
    .subscribe()

  return () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe()
    }
  }
}, [id, user])
```

---

### 🟢 MEDIUM #11: No i18n Support

**Issue:** All text hardcoded in English.

**Fixed Code:**
```javascript
const { t, i18n } = useTranslation()

<h1>{t('tracking.title', 'Order Tracking')}</h1>
<p>{t('tracking.orderNumber', 'Order #{{number}}', { number: id?.slice(0, 8) })}</p>
```

---

### 🟢 MEDIUM #12: No Loading State on Status Change

**Recommendation:** Add subtle indicator when realtime update is received.

---

### 🟢 MEDIUM #13: Delivery Address Field Name Incorrect

**Issue:** Uses `order.delivery_address` but database column is likely `shipping_address`.

**Fixed Code:**
```javascript
<p className="text-gray-600">
  {order.shipping_address || order.delivery_address || 'Address not provided'}
</p>
```

---

### 🟢 MEDIUM #14: No ETA Calculation

**Recommendation:** Add estimated delivery time based on driver location and distance.

---

### ⚪ LOW #15: Order ID Displayed Raw UUID

**Issue:** Shows `id?.slice(0, 8)` instead of formatted order number.

**Fixed Code:**
```javascript
<p className="text-gray-500">
  {t('tracking.orderNumber', 'Order #{{number}}', {
    number: order.order_number || id?.slice(0, 8),
  })}
</p>
```

---

## ✅ What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| **Basic Timeline** | ✅ Working | Shows 5 status steps |
| **Driver Info Display** | ✅ Partial | Shows when driver assigned |
| **Loading State** | ✅ Implemented | Spinner while loading |
| **Error Handling** | ⚠️ Partial | Catches errors but no forbidden state |
| **Navigation** | ✅ Working | Back to orders button |

---

## 📝 Files to Modify

| File | Changes Required |
|------|------------------|
| `src/pages/OrderTracking.jsx` | 15 fixes (#1-#15) |
| `database/migrations/*.sql` | Verify RLS policies for orders |
| `src/i18n/locales/*.json` | Add tracking translation keys |

---

## 🎯 Priority Fixes (Top 5)

If you only fix 5 things, fix these:

1. **IDOR Vulnerability (#1)** - Add ownership verification
2. **Authentication Check (#2)** - Redirect to login
3. **Real-Time Updates (#3)** - Supabase realtime subscriptions
4. **Map Integration (#4)** - Show driver location
5. **Pending Driver State (#5)** - Handle unassigned driver

---

**End of Audit Report**
