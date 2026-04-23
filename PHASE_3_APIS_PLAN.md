# 🔌 PHASE 3: APIs INTEGRATION
## Qotoof - B2B Wholesale Marketplace

**Status:** Pending Phase 2 Completion  
**Estimated Duration:** 7-10 days  
**API Endpoints Required:** 50+

---

## 📋 API ARCHITECTURE

### Base URL Structure
```
Frontend: http://localhost:5173
Backend: http://localhost:3000/api (or use Supabase directly)
Supabase: https://[PROJECT_ID].supabase.co/rest/v1
```

### Response Format (Standard)
```javascript
// Success Response
{
  success: true,
  data: { /* actual data */ },
  message: "Operation successful"
}

// Error Response
{
  success: false,
  error: {
    code: "INVALID_INPUT",
    message: "Validation failed",
    details: { field: "email", issue: "already exists" }
  }
}

// Paginated Response
{
  success: true,
  data: [ /* items */ ],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    pages: 8
  }
}
```

---

## 🔐 AUTHENTICATION APIs

### 1. User Registration
```javascript
POST /api/auth/register
{
  email: "user@example.com",
  password: "StrongPass123!",
  firstName: "Ahmed",
  lastName: "Fassi",
  role: "buyer", // "buyer", "vendor", "driver"
  phone: "+212612345678"
}
```

**Response:**
```javascript
{
  success: true,
  data: {
    id: "uuid",
    email: "user@example.com",
    role: "buyer",
    token: "jwt_token",
    expiresIn: 3600
  }
}
```

---

### 2. User Login
```javascript
POST /api/auth/login
{
  email: "user@example.com",
  password: "StrongPass123!"
}
```

---

### 3. Refresh Token
```javascript
POST /api/auth/refresh-token
{
  refreshToken: "refresh_token_jwt"
}
```

---

### 4. Forgot Password
```javascript
POST /api/auth/forgot-password
{
  email: "user@example.com"
}
```

---

### 5. Reset Password
```javascript
POST /api/auth/reset-password
{
  token: "reset_token",
  newPassword: "NewPass123!"
}
```

---

### 6. Verify Email
```javascript
POST /api/auth/verify-email
{
  token: "verification_token"
}
```

---

### 7. Setup MFA
```javascript
POST /api/auth/mfa/setup
{
  // Returns QR code
}
```

**Response:**
```javascript
{
  secret: "encrypted_secret",
  qrCode: "data:image/png;...",
  backupCodes: ["code1", "code2", ...]
}
```

---

### 8. Verify MFA
```javascript
POST /api/auth/mfa/verify
{
  token: "6_digit_token",
  backupCode?: "backup_code"
}
```

---

## 🛍️ PRODUCT APIs

### 1. Get All Products
```javascript
GET /api/products?page=1&limit=20&category=vegetables&search=tomato&sort=price_asc

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20, max: 100)
- category: string
- subcategory: string
- minPrice: number
- maxPrice: number
- minRating: number
- search: string
- sortBy: "price_asc" | "price_desc" | "rating" | "newest"
- inStock: boolean
- vendorId: string
```

**Response:**
```javascript
{
  success: true,
  data: [
    {
      id: "uuid",
      name: "Fresh Tomatoes",
      description: "...",
      category: "vegetables",
      price_per_unit: 2.50,
      unit_type: "kg",
      min_order_quantity: 50,
      available_quantity: 5000,
      vendor: { id, name, rating },
      images: ["url1", "url2"],
      rating: 4.5,
      reviews_count: 123,
      is_available: true
    }
  ],
  pagination: { page: 1, limit: 20, total: 500, pages: 25 }
}
```

---

### 2. Get Product by ID
```javascript
GET /api/products/:id
```

**Response:**
```javascript
{
  success: true,
  data: {
    id: "uuid",
    name: "Fresh Tomatoes",
    description: "Premium tomatoes...",
    category: "vegetables",
    subcategory: "fresh-veg",
    price_per_unit: 2.50,
    unit_type: "kg",
    min_order_quantity: 50,
    available_quantity: 5000,
    vendor: {
      id: "uuid",
      name: "Fresh Farm Agadir",
      rating: 4.8,
      reviews: 256,
      location: "Agadir"
    },
    images: ["url1", "url2"],
    rating: 4.5,
    reviews: [{ author, rating, comment, date }],
    created_at: "2026-04-01T10:00:00Z"
  }
}
```

---

### 3. Create Product (Vendor Only)
```javascript
POST /api/products
{
  name: "Fresh Tomatoes",
  description: "Premium tomatoes",
  category: "vegetables",
  subcategory: "fresh-veg",
  price_per_unit: 2.50,
  unit_type: "kg",
  min_order_quantity: 50,
  available_quantity: 5000,
  images: ["url1", "url2"]
}
```

**Requires:** Authorization + Vendor Role

---

### 4. Update Product (Vendor Owner)
```javascript
PUT /api/products/:id
{
  name: "Fresh Organic Tomatoes",
  description: "Updated description",
  price_per_unit: 2.75,
  available_quantity: 4500
}
```

---

### 5. Delete Product (Vendor Owner)
```javascript
DELETE /api/products/:id
```

---

## 🛒 CART APIs

### 1. Get Cart
```javascript
GET /api/cart
```

**Response:**
```javascript
{
  success: true,
  data: {
    id: "uuid",
    items: [
      {
        id: "uuid",
        product_id: "uuid",
        product: { id, name, price_per_unit, unit_type },
        quantity: 100,
        subtotal: 250.00,
        added_at: "2026-04-16T10:00:00Z"
      }
    ],
    subtotal: 500.00,
    discount: 0,
    total: 500.00,
    discounts_applied: []
  }
}
```

---

### 2. Add to Cart
```javascript
POST /api/cart/items
{
  product_id: "uuid",
  quantity: 100
}
```

---

### 3. Update Cart Item
```javascript
PUT /api/cart/items/:itemId
{
  quantity: 150
}
```

---

### 4. Remove from Cart
```javascript
DELETE /api/cart/items/:itemId
```

---

### 5. Apply Coupon
```javascript
POST /api/cart/coupon
{
  code: "SAVE10"
}
```

---

## 📦 ORDER APIs

### 1. Create Order
```javascript
POST /api/orders
{
  shipping_address: {
    street: "123 Main St",
    city: "Casablanca",
    postal_code: "20000",
    country: "Morocco"
  },
  items: [
    { product_id: "uuid", quantity: 100 }
  ],
  payment_method: "stripe", // "stripe", "cmi", "cod"
  coupon_code?: "SAVE10"
}
```

**Response:**
```javascript
{
  success: true,
  data: {
    id: "uuid",
    order_number: "ORD-2026-001234",
    status: "pending",
    buyer_id: "uuid",
    items: [{ product, quantity, price }],
    subtotal: 500.00,
    discount: 50.00,
    shipping: 20.00,
    total: 470.00,
    payment_status: "pending",
    payment_method: "stripe",
    delivery_status: "unassigned",
    created_at: "2026-04-16T10:00:00Z"
  }
}
```

---

### 2. Get Orders
```javascript
GET /api/orders?page=1&limit=20&status=pending&sort=created_at_desc

Query Parameters:
- page: number
- limit: number
- status: "pending" | "vendor_accepted" | "driver_assigned" | "delivered" | "cancelled"
- sort: "created_at_desc" | "created_at_asc"
```

---

### 3. Get Order by ID
```javascript
GET /api/orders/:id
```

---

### 4. Update Order Status (Vendor/Admin)
```javascript
PUT /api/orders/:id/status
{
  status: "vendor_accepted" // or "vendor_rejected"
}
```

---

### 5. Get Order Tracking
```javascript
GET /api/orders/:id/tracking
```

**Response:**
```javascript
{
  success: true,
  data: {
    order_id: "uuid",
    status: "on_the_way",
    delivery: {
      id: "uuid",
      driver: {
        id: "uuid",
        name: "Omar Saidi",
        phone: "+212612345678",
        vehicle: "Van",
        plate: "AB-123-CD",
        rating: 4.8
      },
      location: { latitude: 33.5731, longitude: -7.5898 },
      eta: "2026-04-16T14:30:00Z",
      estimated_arrival: "30 mins",
      status_history: [
        { status: "picked_up", timestamp: "...", location: {...} },
        { status: "on_the_way", timestamp: "...", location: {...} }
      ]
    },
    timeline: [
      { status: "pending", time: "..." },
      { status: "vendor_accepted", time: "..." },
      { status: "driver_assigned", time: "..." }
    ]
  }
}
```

---

## 💳 PAYMENT APIs

### 1. Create Stripe Intent
```javascript
POST /api/payments/stripe/intent
{
  order_id: "uuid",
  amount: 50000, // in cents
  currency: "MAD"
}
```

**Response:**
```javascript
{
  success: true,
  data: {
    client_secret: "pi_xxxxx_secret_yyyyy",
    publishable_key: "pk_test_xxxxx"
  }
}
```

---

### 2. Process CMI Payment
```javascript
POST /api/payments/cmi/process
{
  order_id: "uuid",
  amount: 500.00,
  merchant_id: "YOUR_MERCHANT_ID"
}
```

---

### 3. Process COD Order
```javascript
POST /api/payments/cod
{
  order_id: "uuid"
}
```

---

### 4. Get Payment Status
```javascript
GET /api/payments/:paymentId/status
```

---

### 5. Request Refund
```javascript
POST /api/payments/:paymentId/refund
{
  reason: "Customer requested",
  refund_amount: 500.00 // partial refund
}
```

---

## 🚗 DRIVER APIs

### 1. Get Available Orders
```javascript
GET /api/drivers/orders/available?limit=10&radius=10
```

**Response:**
```javascript
{
  success: true,
  data: [
    {
      id: "uuid",
      order_number: "ORD-2026-001234",
      pickup_location: { address, city, latitude, longitude },
      delivery_location: { address, city, latitude, longitude },
      items_count: 5,
      estimated_weight: 250,
      estimated_time: "2 hours",
      payment: "COD",
      updated_at: "..."
    }
  ]
}
```

---

### 2. Accept Delivery
```javascript
POST /api/drivers/deliveries/:deliveryId/accept
```

---

### 3. Update Driver Location
```javascript
POST /api/drivers/location
{
  latitude: 33.5731,
  longitude: -7.5898,
  accuracy: 10
}
```

---

### 4. Mark as Picked Up
```javascript
PATCH /api/drivers/deliveries/:deliveryId/pickup
{
  photo_url: "url_to_photo"
}
```

---

### 5. Complete Delivery
```javascript
PATCH /api/drivers/deliveries/:deliveryId/complete
{
  signature_url?: "url_to_signature",
  photo_url: "url_to_delivery_photo",
  notes?: "Delivery notes"
}
```

---

### 6. Get Driver Earnings
```javascript
GET /api/drivers/earnings?period=month
```

**Response:**
```javascript
{
  success: true,
  data: {
    total_earnings: 5000.00,
    pending: 1000.00,
    completed: 4000.00,
    transactions: [
      { id, date, delivery_id, amount, status }
    ]
  }
}
```

---

## 👥 VENDOR APIs

### 1. Get Vendor Profile
```javascript
GET /api/vendors/:vendorId
```

---

### 2. Update Vendor Profile
```javascript
PUT /api/vendors/profile
{
  store_name: "Fresh Farm Agadir",
  store_description: "...",
  phone: "+212612345678",
  address: "123 Main St",
  city: "Agadir",
  logo_url: "url",
  banner_url: "url"
}
```

---

### 3. Get Vendor Orders
```javascript
GET /api/vendors/orders?page=1&limit=20&status=pending
```

---

### 4. Accept/Reject Order (Vendor)
```javascript
PUT /api/vendors/orders/:orderId/status
{
  status: "vendor_accepted", // or "vendor_rejected"
  rejection_reason?: "Out of stock"
}
```

---

### 5. Get Vendor Analytics
```javascript
GET /api/vendors/analytics?period=month
```

**Response:**
```javascript
{
  success: true,
  data: {
    revenue: 15000.00,
    orders: 45,
    products_sold: 1200,
    average_rating: 4.7,
    reviews: 127,
    top_products: [{id, name, sales, revenue}],
    sales_by_day: [{date, revenue, orders}],
    customer_satisfaction: 95
  }
}
```

---

## 👨‍💼 ADMIN APIs

### 1. Get All Users
```javascript
GET /api/admin/users?page=1&limit=20&role=vendor&status=active

Query Parameters:
- page, limit
- role: "admin" | "vendor" | "buyer" | "driver"
- status: "active" | "inactive" | "suspended"
- search: "email or name"
```

---

### 2. Approve/Reject Vendor
```javascript
PUT /api/admin/vendors/:vendorId/approval
{
  status: "approved", // or "rejected"
  reason?: "Documents verified"
}
```

---

### 3. Suspend User
```javascript
PUT /api/admin/users/:userId/suspend
{
  reason: "Violation of terms",
  duration: 30 // days, null for permanent
}
```

---

### 4. Get Product Approval Queue
```javascript
GET /api/admin/products/pending?page=1&limit=20
```

---

### 5. Approve/Reject Product
```javascript
PUT /api/admin/products/:productId/approval
{
  status: "approved", // or "rejected"
  reason?: "Image quality issue"
}
```

---

### 6. Get Platform Analytics
```javascript
GET /api/admin/analytics?period=month
```

**Response:**
```javascript
{
  success: true,
  data: {
    total_revenue: 450000.00,
    total_orders: 1200,
    average_order_value: 375.00,
    active_vendors: 45,
    active_buyers: 800,
    active_drivers: 12,
    new_users_today: 25,
    conversion_rate: 8.5,
    customer_satisfaction: 4.6,
    pending_approvals: { vendors: 3, products: 5 },
    revenue_by_category: {}
  }
}
```

---

## React Query Hooks (Recommended)

### Authentication Hooks
```javascript
// useAuthLogin()
// useAuthRegister()
// useForgotPassword()
// useResetPassword()
// useVerifyEmail()
// useLogout()
// useRefreshToken()
```

### Product Hooks
```javascript
// useProducts(filters) - Get all products
// useProduct(id) - Get single product
// useCreateProduct(data)
// useUpdateProduct(id, data)
// useDeleteProduct(id)
// useSearchProducts(query)
```

### Cart Hooks
```javascript
// useCart() - Get cart
// useAddToCart(productId, quantity)
// useUpdateCartItem(itemId, quantity)
// useRemoveFromCart(itemId)
// useApplyCoupon(code)
// useClearCart()
```

### Order Hooks
```javascript
// useCreateOrder(data)
// useOrders(filters) - Get user orders
// useOrder(id) - Get single order
// useOrderTracking(orderId)
// useUpdateOrderStatus(orderId, status)
```

### Payment Hooks
```javascript
// useCreateStripeIntent(orderId, amount)
// useProcessCMIPayment(data)
// useRefundPayment(paymentId, amount)
// usePaymentStatus(paymentId)
```

### Vendor Hooks
```javascript
// useVendorProfile()
// useUpdateVendorProfile(data)
// useVendorOrders(filters)
// useVendorAnalytics(period)
// useUpdateOrderStatus(orderId, status)
```

### Driver Hooks
```javascript
// useAvailableOrders()
// useAcceptDelivery(deliveryId)
// useUpdateLocation(lat, lng)
// useCompleteDelivery(deliveryId, data)
// useDriverEarnings(period)
```

### Admin Hooks
```javascript
// useAdminUsers(filters)
// useApproveVendor(vendorId)
// useSuspendUser(userId)
// useApproveProduct(productId)
// useAdminAnalytics(period)
```

---

## 🔒 AUTHENTICATION & HEADERS

All requests (except auth) require:
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
X-API-Version: 1.0
```

---

## ⚡ ERROR CODES

```javascript
// Authentication
401 - Unauthorized (no token)
403 - Forbidden (insufficient permissions)
422 - Invalid token

// Validation
400 - Bad request
422 - Unprocessable entity (validation error)

// Not Found
404 - Resource not found

// Server
500 - Internal server error
503 - Service unavailable

// Business Logic
409 - Conflict (e.g., email already exists)
410 - Gone (resource deleted)
```

---

## 🚀 NEXT STEPS

1. **Setup Axios Interceptors** - Auto token refresh, error handling
2. **Setup React Query** - Caching, retries, invalidation
3. **Implement Each Hook** - One by one
4. **Test with Mock Data** - Before backend ready
5. **Integrate in Components** - Connect UI to APIs

---

**Ready for Phase 3? Let's build powerful APIs! 🔌**
