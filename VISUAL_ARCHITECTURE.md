# 🏗️ معمارية Marketplace - الهيكل البصري

## 📊 دفق البيانات (Data Flow)

```
┌─────────────┐
│  Browser   │
│  (User)    │
└──────┬──────┘
       │
       │ HTTP Request
       ↓
┌──────────────────────────┐
│  App.jsx (Router)        │
│  + ErrorBoundary         │
│  + QueryClientProvider   │
└──────┬───────────────────┘
       │
       ├─────────────────────────┬──────────────────┐
       │                         │                  │
       ↓                         ↓                  ↓
    /login              /marketplace           /vendor
       │                         │                  │
       ↓                         ↓                  ↓
┌──────────────────┐    ┌──────────────────┐   ┌──────────────────┐
│ ProtectedRoute   │    │ ProtectedRoute   │   │ ProtectedRoute   │
│ (Public)         │    │ (Buyer)          │   │ (Vendor)         │
│ Layout: -        │    │ Layout: Main     │   │ Layout: Vendor   │
└──────┬───────────┘    └──────┬───────────┘   └──────┬───────────┘
       │                       │                       │
       ↓                       ↓                       ↓
    LoginPage         MarketplaceLayout      VendorDashboard
       │                       │                       │
       │ authMiddleware        │ authMiddleware        │ authMiddleware
       │ (Public)              │ (BUYER)               │ (VENDOR)
       ↓                       ↓                       ↓
    ✅ Allow             ✅ Allow (if BUYER)  ✅ Allow (if VENDOR)
    ❌ Deny              ❌ Redirect           ❌ Redirect
```

---

## 🔐 نظام الحماية (RBAC Flow)

```
Request → axiosInstance
    │
    ├─ Request Interceptor
    │  └─ إضافة Header
    │     Authorization: Bearer <token>
    │
    ↓
Server Response
    │
    └─ Response Interceptor
       │
       ├─ 2xx (Success)
       │  └─ رجّع البيانات
       │
       ├─ 401 (Unauthorized)
       │  ├─ تحقق: هل Token قديم؟
       │  │
       │  ├─ نعم:
       │  │  ├─ جدّد Token
       │  │  ├─ أعد محاولة الطلب
       │  │  └─ رجّع البيانات
       │  │
       │  └─ لا:
       │     └─ عيّد لـ /login
       │
       ├─ 403 (Forbidden)
       │  └─ عيّد لـ /unauthorized
       │
       └─ 5xx (Server Error)
          └─ أعد محاولة (retry)
```

---

## 📦 معمارية الـ Component

```
App.jsx
├─ ErrorBoundary
│  └─ عند حدوث خطأ = ErrorFallback
│
└─ QueryClientProvider
   │
   └─ Routes
      │
      ├─ Public Routes
      │  ├─ /login
      │  ├─ /register
      │  └─ /
      │
      ├─ Protected Routes (BUYER)
      │  └─ /marketplace
      │     ├─ authMiddleware (وجود Token؟)
      │     ├─ authMiddleware (BUYER Role؟)
      │     ├─ ProtectedRoute (MainLayout)
      │     └─ Outlet (SafePages)
      │
      ├─ Protected Routes (VENDOR)
      │  └─ /vendor
      │     ├─ authMiddleware (وجود Token؟)
      │     ├─ authMiddleware (VENDOR Role؟)
      │     ├─ ProtectedRoute (VendorLayout)
      │     └─ Outlet (SafePages)
      │
      ├─ Protected Routes (ADMIN)
      │  └─ /admin
      │     ├─ authMiddleware (وجود Token؟)
      │     ├─ authMiddleware (ADMIN Role؟)
      │     ├─ ProtectedRoute (AdminLayout)
      │     └─ Outlet (SafePages)
      │
      └─ Protected Routes (DRIVER)
         └─ /driver
            ├─ authMiddleware (وجود Token؟)
            ├─ authMiddleware (DRIVER Role؟)
            ├─ ProtectedRoute (DriverLayout)
            └─ Outlet (SafePages)
```

---

## 🎯 مسار الطلب (Request Lifecycle)

```
User Action
    │
    ↓
useQuery Hook
    │
    ├─ Check Cache
    │  ├─ Fresh? → Return cached data
    │  └─ Stale? → Fetch from server
    │
    ↓
useQuery: fetching = true
    │
    ↓
axiosInstance.get()
    │
    ├─ Request Interceptor:
    │  └─ Add: Authorization: Bearer <token>
    │
    ↓
HTTP Request
    │
    ↓
Server (API)
    │
    ↓
Response (200, 401, 403, 500)
    │
    ├─ 200 (Success)
    │  ├─ Response Interceptor: return data
    │  ├─ useQuery: data = response.data
    │  ├─ useQuery: isLoading = false
    │  └─ Component: render with data
    │
    ├─ 401 (Token Expired)
    │  ├─ Response Interceptor: refresh token
    │  ├─ Response Interceptor: retry request
    │  ├─ (back to 200 or 403)
    │
    ├─ 403 (Access Denied)
    │  ├─ Response Interceptor: redirect to /unauthorized
    │  ├─ App: navigate('/unauthorized')
    │  └─ Component: show error page
    │
    └─ 5xx (Server Error)
       ├─ Response Interceptor: retry (max 2 times)
       ├─ useQuery: error = error object
       ├─ useQuery: isLoading = false
       └─ Component: render with error
```

---

## 🏛️ Feature Architecture

```
Feature (e.g., marketplace)
│
├─ /routes/
│  └─ Marketplace-specific routes
│
├─ /services/
│  ├─ api.js (API calls with axiosInstance)
│  └─ businessLogic.js (business rules)
│
├─ /components/
│  ├─ Home.jsx
│  ├─ Marketplace.jsx
│  ├─ ProductDetail.jsx
│  └─ Cart.jsx
│
├─ /hooks/
│  ├─ useProducts.js (useQuery)
│  ├─ useCart.js (useMutation)
│  └─ useFilters.js (local state)
│
└─ /types/
   └─ index.d.ts (TypeScript types)
```

---

## 🔄 State Management Strategy

```
┌──────────────────────────────────────────────────────────┐
│            Application State Layers                       │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Server State (React Query / TanStack Query)         │ │
│  │  - Products from API                                 │ │
│  │  - Orders from API                                   │ │
│  │  - User details (if fetched)                         │ │
│  │  - Auto refresh on staleTime                         │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Local State (zustand or localStorage)               │ │
│  │  - Current user (after login)                        │ │
│  │  - JWT Token                                         │ │
│  │  - User preferences                                  │ │
│  │  - UI state (drawer open/closed, etc)               │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Component State (useState)                          │ │
│  │  - Form values                                       │ │
│  │  - UI interactions                                   │ │
│  │  - Temporary data                                    │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 🎭 Layouts

```
1. MainLayout (Public/Buyer)
┌─────────────────────────┐
│      Header             │
├─────────────────────────┤
│                         │
│      Content            │
│      (Outlet)           │
│                         │
├─────────────────────────┤
│      Footer             │
└─────────────────────────┘

2. AdminLayout
┌─────────────────────────────┐
│        Header               │
├────────────┬────────────────┤
│            │                │
│  Sidebar   │    Content     │
│  (Nav)     │    (Outlet)    │
│            │                │
└────────────┴────────────────┘

3. VendorLayout
┌─────────────────────────────┐
│      Header (Store Name)    │
├────────────┬────────────────┤
│            │                │
│  Sidebar   │    Content     │
│  (Links)   │    (Outlet)    │
│            │                │
└────────────┴────────────────┘

4. DriverLayout
┌─────────────────────────┐
│    Header               │
├─────────────────────────┤
│                         │
│    Content              │
│    (Outlet)             │
│                         │
├─────────────────────────┤
│    Footer               │
└─────────────────────────┘
```

---

## 🔗 Dependencies Flow

```
App.jsx
  │
  ├─ ErrorBoundary
  │  └─ react-error-boundary
  │
  ├─ QueryClientProvider
  │  └─ @tanstack/react-query
  │
  ├─ Routes (react-router-dom)
  │  │
  │  ├─ ProtectedRoute
  │  │  └─ authMiddleware
  │  │     └─ axiosInstance
  │  │        └─ axios
  │  │
  │  └─ Features
  │     └─ Hooks
  │        └─ Services
  │           └─ axiosInstance
  │              └─ axios
  │
  └─ Features
     └─ Components
```

---

## 📈 Performance Optimization

```
Initial Load:
  1. Parse HTML
  2. Load chunk.js (small due to code splitting)
  3. Load App.jsx
  4. ErrorBoundary wraps everything
  5. QueryClientProvider initializes
  6. Routes render

Route Navigation:
  1. User navigates to /vendor
  2. React Router: pending navigation
  3. ProtectedRoute checks: authorized?
  4. No? Redirect to /login
  5. Yes? Load VendorLayout + Dashboard
  6. Code splitting: only vendor code loaded
  7. useQuery: check cache
  8. Cache fresh? Display immediately
  9. Cache stale? Fetch in background

Error Handling:
  1. Component error → ErrorBoundary catches → ErrorFallback displayed
  2. API error → Response Interceptor handles → Retry or Redirect
  3. 401 → Refresh token → Retry request or /login
  4. 403 → /unauthorized
```

---

## ✅ Checklist

- [x] Feature-based Architecture
- [x] RBAC with JWT
- [x] Interceptors for token refresh
- [x] Error Boundary for safety
- [x] React Query for state management
- [x] Route-level code splitting
- [x] Suspense fallbacks
- [x] Multiple Layouts per role
- [x] Middleware for auth checks
- [x] Public/Protected routes
