# 📄 شرح الملفات الأساسية

## 1. 🔐 src/constants/roles.js

**الغرض**: تعريف الأدوار والصلاحيات

```javascript
// الأدوار المتاحة
USER_ROLES = {
  ADMIN: 'admin',
  VENDOR: 'vendor',
  BUYER: 'buyer',
  DRIVER: 'driver',
  GUEST: 'guest',
}

// الصلاحيات حسب الدور
ROLE_PERMISSIONS = {
  admin: { modules: ['admin', 'marketplace', 'auth'], canAccessAll: true },
  vendor: { modules: ['vendor', 'marketplace', 'auth'], canAccessAll: false },
  buyer: { modules: ['marketplace', 'auth'], canAccessAll: false },
  driver: { modules: ['driver', 'auth'], canAccessAll: false },
}

// المسارات العامة (بدون حماية)
PUBLIC_PATHS = ['/login', '/register', '/forgot-password', ...]

// المسارات المحمية حسب الدور
PROTECTED_ROUTES_BY_ROLE = {
  admin: /^\/admin/,
  vendor: /^\/vendor/,
  buyer: /^\/marketplace/,
  driver: /^\/driver/,
}
```

**الاستخدام**:
```javascript
import { USER_ROLES, isPublicPath } from '@/constants/roles';

// التحقق من المسار العام
if (isPublicPath('/login')) {
  // السماح بدون توثيق
}

// التحقق من الدور
if (userRole === USER_ROLES.ADMIN) {
  // المسؤول فقط
}
```

---

## 2. 📡 src/services/axiosInstance.js

**الغرض**: إعدادات Axios مع معالجة متقدمة للأخطاء

### مكونات رئيسية:

#### A. إنشء Instance:
```javascript
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,  // السماح بـ HttpOnly Cookies
});
```

#### B. Request Interceptor:
```javascript
axiosInstance.interceptors.request.use(
  (config) => {
    // إضافة Authorization Header
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);
```

#### C. Response Interceptor (معالجة 401):
```javascript
// عند استقبال 401 Unauthorized:
1. إذا كان جاري تجديد Token، أضف الطلب لقائمة الانتظار
2. ابدأ عملية تجديد Token
3. احفظ التوكن الجديد
4. أعد محاولة الطلب الأصلي
5. إذا فشل التجديد، توجه إلى /login
```

**الاستخدام**:
```javascript
import axiosInstance from '@/services/axiosInstance';

// في الخدمات
const products = await axiosInstance.get('/products');

// في React Query
const { data } = useQuery({
  queryKey: ['products'],
  queryFn: () => axiosInstance.get('/products')
});
```

---

## 3. ⚛️ src/services/queryClient.js

**الغرض**: إعدادات React Query (TanStack Query)

```javascript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 دقائق
      cacheTime: 10 * 60 * 1000,   // 10 دقائق
      retry: 2,                     // إعادة محاولة مرتين
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

**شرح المعاملات**:
- `staleTime`: المدة التي بعدها يعتبر الـ Query "قديماً"
- `cacheTime`: المدة التي يبقى الـ Query في الـ Cache
- `retry`: عدد محاولات إعادة المحاولة
- `refetchOnWindowFocus`: تحديث عند العودة للنافذة

**الاستخدام**:
```javascript
// في App.jsx
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

---

## 4. 🔐 src/middleware/authMiddleware.js

**الغرض**: التحقق من المصادقة والصلاحيات

### الدوال الرئيسية:

#### A. validateToken:
```javascript
// التحقق من:
// 1. وجود التوكن
// 2. صحة صيغة التوكن
// 3. انتهاء الصلاحية
// 4. مطابقة الدور المطلوب

const user = validateToken(token, 'admin');
// النتيجة: { id, email, role, name, exp, iat }
```

#### B. getCurrentUser:
```javascript
// الحصول على بيانات المستخدم الحالي
const user = getCurrentUser();
// النتيجة:
// {
//   id: 'user-123',
//   email: 'user@example.com',
//   role: 'vendor',
//   name: 'أحمد',
//   avatar: 'url-to-avatar'
// }
```

#### C. isPublicPath:
```javascript
// التحقق من أن المسار عام
if (isPublicPath('/login')) {
  // السماح بدون توثيق
}
```

#### D. createAuthMiddleware:
```javascript
// إنشاء middleware مخصص
const middleware = createAuthMiddleware({
  requiredRole: USER_ROLES.ADMIN,
  redirectTo: '/login'
});

const result = middleware('/admin/dashboard');
// النتيجة: { authorized: boolean, user?: object, error?: string }
```

**الاستخدام في المكونات**:
```javascript
import { useAuthMiddleware } from '@/middleware/authMiddleware';

function AdminPage() {
  const { authorized, user, error } = useAuthMiddleware({
    requiredRole: USER_ROLES.ADMIN
  });

  if (!authorized) {
    return <Navigate to="/unauthorized" />;
  }

  return <div>مرحباً {user.name}</div>;
}
```

---

## 5. 🛡️ src/components/ProtectedRoute.jsx

**الغرض**: حماية المسارات والـ Layouts

### المكونات:

#### A. ProtectedRoute:
```javascript
<Route
  path="/vendor"
  element={
    <ProtectedRoute
      Layout={VendorLayout}
      requiredRole={USER_ROLES.VENDOR}
      allowedRoles={[USER_ROLES.VENDOR]}
    />
  }
>
  <Route path="dashboard" element={<VendorDashboard />} />
  <Route path="products" element={<VendorProducts />} />
</Route>
```

**المعاملات**:
- `Layout`: مكون Layout مخصص
- `requiredRole`: الدور المطلوب (واحد فقط)
- `allowedRoles`: قائمة الأدوار المسموحة (بديل عن requiredRole)

#### B. الـ Layouts:

1. **MainLayout**: للمستخدمين العاديين
```
┌─ Header ─┐
│          │
│ Content  │
│          │
└─ Footer ─┘
```

2. **AdminLayout**: للمسؤولين
```
┌────────────────────┐
│     Header         │
├──────┬─────────────┤
│      │             │
│ Sidebar  Content   │
│      │             │
└──────┴─────────────┘
```

3. **VendorLayout**: للبائعين
```
┌──────────────────────┐
│     Header (متجري)  │
├──────┬───────────────┤
│      │               │
│ Sidebar   Content    │
│      │               │
└──────┴───────────────┘
```

4. **DriverLayout**: للسائقين
```
┌─ Header ─┐
│          │
│ Content  │
│          │
└─ Footer ─┘
```

---

## 6. 🚨 src/components/ErrorBoundary.jsx

**الغرض**: التقاط الأخطاء في المكونات

### المكونات:

#### A. ErrorFallback:
```javascript
// واجهة تُعرض عند حدوث خطأ
<div>
  <h1>حدث خطأ ما</h1>
  <p>{error.message}</p>
  
  {/* في Development فقط */}
  {process.env.NODE_ENV === 'development' && (
    <details>
      <summary>التفاصيل</summary>
      <pre>{error.stack}</pre>
    </details>
  )}
  
  <button onClick={resetErrorBoundary}>
    حاول مرة أخرى
  </button>
</div>
```

#### B. ErrorBoundary Component:
```javascript
// استخدام مباشر
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// أو كـ HOC
const SafeComponent = withErrorBoundary(YourComponent);
```

**الفوائد**:
- التقاط الأخطاء في الـ Render
- عدم تأثر باقي التطبيق
- رسائل خطأ واضحة للمستخدم
- تسجيل الأخطاء للتطوير

---

## 7. 🗺️ src/App.jsx

**الغرض**: نقطة الدخول الرئيسية

### البنية:

```javascript
<ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <Routes>
      {/* مسارات عامة */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomePage />} />
      </Route>

      {/* مسارات محمية - Buyer */}
      <Route path="/marketplace" element={<ProtectedRoute Layout={MainLayout} />}>
        <Route path="orders" element={<OrdersPage />} />
      </Route>

      {/* مسارات محمية - Vendor */}
      <Route path="/vendor" element={<ProtectedRoute Layout={VendorLayout} />}>
        <Route path="dashboard" element={<VendorDashboard />} />
      </Route>

      {/* مسارات محمية - Admin */}
      <Route path="/admin" element={<ProtectedRoute Layout={AdminLayout} />}>
        <Route path="dashboard" element={<AdminDashboard />} />
      </Route>

      {/* مسارات محمية - Driver */}
      <Route path="/driver" element={<ProtectedRoute Layout={DriverLayout} />}>
        <Route path="dashboard" element={<DriverDashboard />} />
      </Route>

      {/* أخطاء */}
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </QueryClientProvider>
</ErrorBoundary>
```

---

## 8. 📦 package.json (التحديثات)

الحزم المضافة:

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.48.0",
    "axios": "^1.7.5",
    "react-error-boundary": "^4.0.11"
  }
}
```

---

## 📋 جدول ملخص

| الملف | الغرض | الاستخدام |
|------|--------|----------|
| `roles.js` | تعريف الأدوار | `import { USER_ROLES } from '@/constants/roles'` |
| `axiosInstance.js` | طلبات API | `import axiosInstance from '@/services/axiosInstance'` |
| `queryClient.js` | تخزين البيانات | `<QueryClientProvider client={queryClient}>` |
| `authMiddleware.js` | التحقق من الصلاحيات | `createAuthMiddleware({ requiredRole })` |
| `ProtectedRoute.jsx` | حماية المسارات | `<ProtectedRoute Layout={...} />` |
| `ErrorBoundary.jsx` | معالجة الأخطاء | `<ErrorBoundary><App /></ErrorBoundary>` |
| `App.jsx` | المسارات الرئيسية | نقطة الدخول الرئيسية |

---

## 🎯 مثال عملي شامل

### المسألة: عرض قائمة المنتجات

#### 1. الخدمة:
```javascript
// src/features/marketplace/services/api.js
import axiosInstance from '@/services/axiosInstance';

export const productsApi = {
  getAll: () => axiosInstance.get('/products'),
  getById: (id) => axiosInstance.get(`/products/${id}`),
  create: (data) => axiosInstance.post('/products', data),
};
```

#### 2. الـ Hook:
```javascript
// src/features/marketplace/hooks/useProducts.js
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../services/api';

export function useProducts(filters = {}) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => productsApi.getAll(filters),
    staleTime: 5 * 60 * 1000,
  });
}
```

#### 3. المكون:
```javascript
// src/features/marketplace/components/ProductList.jsx
import { useProducts } from '../hooks/useProducts';

export default function ProductList() {
  const { data: products, isLoading, error, isFetching } = useProducts();

  if (isLoading) return <div>جاري التحميل...</div>;
  if (error) return <div>خطأ: {error.message}</div>;

  return (
    <div>
      {isFetching && <p>جاري التحديث...</p>}
      <div className="grid grid-cols-3 gap-4">
        {products?.map(product => (
          <div key={product.id} className="p-4 border rounded">
            <h3>{product.name}</h3>
            <p>{product.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 4. المسار:
```javascript
// في App.jsx
import ProductList from '@/features/marketplace/components/ProductList';

<Route path="/" element={<MainLayout />}>
  <Route index element={<SuspenseRoute><ProductList /></SuspenseRoute>} />
</Route>
```

---

✅ **الآن أنت جاهز للبدء!**
