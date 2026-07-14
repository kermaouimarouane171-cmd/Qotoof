# 🏗️ معمارية Marketplace - دليل شامل

## 📋 نظرة عامة على الهيكل

هذا المشروع يستخدم **Feature-based Architecture** مع **Production-Grade Standards**:

```
src/
├── features/                    # المميزات الرئيسية (Feature Modules)
│   ├── auth/                    # مميزة المصادقة
│   │   ├── routes/              # مسارات المصادقة
│   │   ├── services/            # خدمات API للمصادقة
│   │   ├── components/          # مكونات المصادقة
│   │   └── hooks/               # Hooks خاصة بالمصادقة
│   │
│   ├── marketplace/             # مميزة السوق (Buyers)
│   │   ├── routes/
│   │   ├── services/
│   │   ├── components/
│   │   └── hooks/
│   │
│   ├── vendor/                  # مميزة البائعين (Vendors)
│   │   ├── routes/
│   │   ├── services/
│   │   ├── components/
│   │   └── hooks/
│   │
│   ├── admin/                   # مميزة الإدارة (Admins)
│   │   ├── routes/
│   │   ├── services/
│   │   ├── components/
│   │   └── hooks/
│   │
│   └── driver/                  # مميزة السائقين (Drivers)
│       ├── routes/
│       ├── services/
│       ├── components/
│       └── hooks/
│
├── services/                    # خدمات مشتركة
│   ├── axiosInstance.js         # إعدادات Axios مع Interceptors
│   ├── queryClient.js           # إعدادات React Query
│   └── api.js                   # واجهة API العامة (الحالية)
│
├── middleware/                  # Middlewares
│   └── authMiddleware.js        # التحقق من المصادقة والصلاحيات (RBAC)
│
├── components/                  # مكونات عامة مشتركة
│   ├── ProtectedRoute.jsx       # مكون حماية المسارات + Layouts
│   ├── ErrorBoundary.jsx        # التقاط أخطاء المكونات
│   ├── NotFound.jsx             # صفحة 404
│   └── Unauthorized.jsx         # صفحة 403
│
├── layouts/                     # Layouts عامة
│   └── (يتم التعريف في ProtectedRoute.jsx)
│
├── hooks/                       # Hooks عامة مشتركة
├── constants/                   # ثوابت عامة
│   └── roles.js                 # تعريف الأدوار والصلاحيات
│
├── utils/                       # دوال مرافقة
├── types/                       # تعريفات TypeScript (إذا لزم الأمر)
│
└── App.jsx                      # نقطة الدخول الرئيسية
```

---

## 🛡️ نظام الحماية (Role-Based Access Control - RBAC)

### الأدوار المتوفرة:
```javascript
admin    → الوصول الكامل للنظام
vendor   → إدارة المتجر والمنتجات
buyer    → الشراء والطلبات
driver   → توصيل الطلبات
guest    → دون وصول (بحاجة تسجيل دخول)
```

### آلية الحماية:

1. **Request Interceptor**: يضيف `Authorization: Bearer <token>` تلقائياً
2. **Response Interceptor**: يتعامل مع:
   - **401 Unauthorized**: تجديد التوكن تلقائياً
   - **403 Forbidden**: إعادة توجيه إلى `/unauthorized`
   - **5xx Errors**: إعادة محاولة تلقائية

3. **ProtectedRoute Component**: يتحقق من:
   - وجود التوكن
   - صحة التوكن (Expiry)
   - مطابقة الدور المطلوب

---

## 📡 طبقة الخدمات (API Layer)

### axiosInstance.js

```javascript
// الاستخدام البسيط:
import axiosInstance from '@/services/axiosInstance';

// في الخدمات:
const response = await axiosInstance.get('/products');

// في React Query:
const { data } = useQuery({
  queryKey: ['products'],
  queryFn: () => axiosInstance.get('/products')
});
```

**المميزات:**
- إضافة Token تلقائياً
- تجديد Token عند الحاجة
- معالجة الأخطاء الشاملة
- دعم HttpOnly Cookies
- قائمة انتظار للطلبات المعلقة

---

## ⚛️ إدارة الحالة (State Management)

### استخدام TanStack Query **فقط** للبيانات من السيرفر:

```javascript
import { useQuery, useMutation } from '@tanstack/react-query';
import axiosInstance from '@/services/axiosInstance';

// جلب البيانات
function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: () => axiosInstance.get('/products'),
    staleTime: 5 * 60 * 1000,        // 5 دقائق
    cacheTime: 10 * 60 * 1000,        // 10 دقائق
  });
}

// تحديث البيانات
function useCreateProduct() {
  return useMutation({
    mutationFn: (data) => axiosInstance.post('/products', data),
    onSuccess: (data) => {
      // إعادة جلب البيانات تلقائياً
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
```

**ملاحظة**: بيانات المستخدم الحالي والإعدادات المحلية تبقى في **zustand** أو **localStorage**

---

## 🎯 App.jsx - شرح البنية

### 1. Setup الأساسي:
```javascript
<ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <Routes>
      {/* جميع المسارات هنا */}
    </Routes>
  </QueryClientProvider>
</ErrorBoundary>
```

### 2. المسارات حسب الأدوار:

```javascript
// مسارات عامة (بدون حماية)
<Route path="/login" element={<LoginPage />} />
<Route path="/register" element={<RegisterPage />} />
<Route path="/" element={<MainLayout />}>
  <Route index element={<HomePage />} />
  <Route path="marketplace" element={<MarketplacePage />} />
</Route>

// مسارات محمية - Buyer
<Route path="/marketplace" element={
  <ProtectedRoute
    Layout={MainLayout}
    requiredRole={USER_ROLES.BUYER}
  />
}>
  <Route path="orders" element={<OrdersPage />} />
</Route>

// مسارات محمية - Vendor
<Route path="/vendor" element={
  <ProtectedRoute
    Layout={VendorLayout}
    requiredRole={USER_ROLES.VENDOR}
  />
}>
  <Route path="dashboard" element={<VendorDashboard />} />
  <Route path="products" element={<VendorProducts />} />
</Route>

// مسارات محمية - Admin
<Route path="/admin" element={
  <ProtectedRoute
    Layout={AdminLayout}
    requiredRole={USER_ROLES.ADMIN}
  />
}>
  <Route path="dashboard" element={<AdminDashboard />} />
  <Route path="users" element={<AdminUsers />} />
</Route>

// مسارات محمية - Driver
<Route path="/driver" element={
  <ProtectedRoute
    Layout={DriverLayout}
    requiredRole={USER_ROLES.DRIVER}
  />
}>
  <Route path="dashboard" element={<DriverDashboard />} />
</Route>
```

### 3. معالجة الأخطاء:
```javascript
<Route path="/unauthorized" element={<UnauthorizedPage />} />
<Route path="*" element={<NotFoundPage />} />
```

---

## 🚀 كيفية الاستخدام

### 1. إضافة Feature جديدة:

```bash
mkdir -p src/features/newfeature/{routes,services,components,hooks}
```

### 2. إنشاء خدمة API:

```javascript
// src/features/newfeature/services/api.js
import axiosInstance from '@/services/axiosInstance';

export const newFeatureApi = {
  getAll: () => axiosInstance.get('/new-feature'),
  getById: (id) => axiosInstance.get(`/new-feature/${id}`),
  create: (data) => axiosInstance.post('/new-feature', data),
  update: (id, data) => axiosInstance.put(`/new-feature/${id}`, data),
  delete: (id) => axiosInstance.delete(`/new-feature/${id}`),
};
```

### 3. إنشاء Hook مخصص:

```javascript
// src/features/newfeature/hooks/useNewFeature.js
import { useQuery, useMutation } from '@tanstack/react-query';
import { newFeatureApi } from '../services/api';
import queryClient from '@/services/queryClient';

export function useNewFeatureList() {
  return useQuery({
    queryKey: ['newfeature'],
    queryFn: newFeatureApi.getAll,
  });
}

export function useCreateNewFeature() {
  return useMutation({
    mutationFn: newFeatureApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['newfeature'] });
    },
  });
}
```

### 4. استخدام في مكون:

```javascript
// src/features/newfeature/components/List.jsx
import { useNewFeatureList, useCreateNewFeature } from '../hooks/useNewFeature';

export default function NewFeatureList() {
  const { data, isLoading, error } = useNewFeatureList();
  const { mutate: create } = useCreateNewFeature();

  if (isLoading) return <div>جاري التحميل...</div>;
  if (error) return <div>حدث خطأ: {error.message}</div>;

  return (
    <div>
      {data?.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

---

## 📦 الملفات الأساسية

### 1. constants/roles.js
- تعريف الأدوار والصلاحيات
- المسارات العامة
- قوائم التحكم بالوصول

### 2. services/axiosInstance.js
- إعدادات Axios
- Interceptors للتوكن
- تجديد التوكن التلقائي
- معالجة الأخطاء

### 3. services/queryClient.js
- إعدادات React Query
- staleTime و cacheTime محسنة
- استراتيجيات إعادة المحاولة

### 4. middleware/authMiddleware.js
- التحقق من التوكن
- التحقق من الصلاحيات
- إدارة جلسات المستخدم

### 5. components/ProtectedRoute.jsx
- حماية المسارات
- Layouts مختلفة لكل دور
- معالجة إعادة التوجيه

### 6. components/ErrorBoundary.jsx
- التقاط الأخطاء في المكونات
- عرض واجهة بديلة
- تسجيل الأخطاء

---

## ✅ Checklist قبل الإنتاج

- [ ] تثبيت المكتبات: `npm install`
- [ ] إعداد متغيرات البيئة `.env`
- [ ] اختبار تسجيل الدخول والتوكن
- [ ] اختبار الانتقال بين المسارات
- [ ] اختبار صلاحيات كل دور
- [ ] اختبار تجديد التوكن
- [ ] اختبار معالجة الأخطاء
- [ ] تفعيل Sentry أو logging service
- [ ] اختبار Performance مع React DevTools Profiler

---

## 🔗 الموارد المفيدة

- [React Router v6](https://reactrouter.com/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Axios Documentation](https://axios-http.com/)
- [react-error-boundary](https://github.com/bvaughn/react-error-boundary)

---

**آخر تحديث:** أبريل 2024
**الحالة:** جاهز للإنتاج ✅

---

## ⚠️ TODO — تحديث وثيقة المعمارية (Modular Migration)

**ما هو قديم:** هيكل `src/features/` الموصوف في هذه الوثيقة يتم استبداله تدريجياً بـ `src/modules/` وفق `MODULAR_DEVELOPMENT_PLAN.md`.

**لماذا هو قديم:** المشروع بدأ ترحيل المعمارية من Feature-based إلى Modular (Feature + Domain Hybrid) في يونيو 2026.

**ما تم إنجازه حتى الآن:**
- Phase 0.5: التحقق من السلامة + تثبيت `madge` + قاعدة ESLint للحدود الموديولية ✅
- Phase 1.1: إنشاء `src/modules/shared/` كطبقة re-export ✅
- Phase 1.2: إنشاء `src/app/` كطبقة composition مع re-exports ✅
- Phase 1.3: إنشاء `src/modules/auth/` كطبقة re-export للمصادقة ✅
- Phase 1.4: إنشاء `src/modules/users/` كطبقة re-export للمستخدمين/الملفات الشخصية ✅
- **المرحلة 1 مكتملة بالكامل** ✅
- Phase 2.1: إنشاء `src/modules/catalog/` كطبقة re-export للمنتجات/الفئات ✅
- Phase 2.2: إنشاء `src/modules/marketplace/` كطبقة re-export لتصفح السوق ✅
- Phase 2.3: إنشاء `src/modules/cart/` كطبقة re-export للسلة والمفضلة ✅
- Phase 2.4: إنشاء `src/modules/orders/` كطبقة re-export للطلبات ✅
- Phase 2.5: إنشاء `src/modules/delivery/` كطبقة re-export للتوصيل والسائقين ✅
- Phase 2.6: تحضير التدفقات الحرجة (H1: ordersApi naming conflict، H2: split useMarketplaceQueries، H3: isolate order functions in deliveries.js) ✅
- **المرحلة 2 مكتملة بالكامل** ✅
- Phase 3.1: إنشاء `src/modules/checkout/` كطبقة re-export للـ checkout flow ✅
- Phase 3.2: إنشاء `src/modules/payments/` كطبقة re-export للـ payments ✅
- Phase 3.3: إنشاء `src/modules/notifications/` كطبقة re-export للإشعارات ✅
- Phase 3.4: استخراج تفضيلات الإشعارات إلى `notificationPreferences.js` وتذاكر الدعم إلى `useSupportTicketQueries.js` وتوثيق ترحيل `commissionNotifications.js` ✅
- Phase 4.1: إنشاء `src/modules/coupons/` كطبقة re-export للكوبونات ✅
- Phase 4.2: إنشاء `src/modules/reviews/` كطبقة re-export للتقييمات ✅
- Phase 4.3: إنشاء `src/modules/chat/` كطبقة re-export للدردشة/الرسائل ✅
- Phase 4.4: إنشاء `src/modules/commissions/` كطبقة re-export للعمولات/المدفوعات ✅
- Phase 4.5: إنشاء `src/modules/analytics/` كطبقة re-export للتحليلات/التقارير ✅
- Phase 4.6: إنشاء `src/modules/admin/` كطبقة re-export للإدارة/لوحة التحكم ✅
- Phase 6.5: إنشاء `src/modules/loyalty/` كطبقة re-export للولاء/النقاط/الإحالات ✅
- Phase 6.13: إزالة `export * from './ui'` من root barrel لـ `cart` — الـ root barrel يصدّر فقط lightweight public API ✅
- Phase 6.15: إزالة `export * from './ui'` من root barrel لـ `orders` ✅
- Phase 6.17: إزالة UI exports من root barrels لـ `delivery` و `checkout` ✅
- Phase 6.18: إزالة UI exports من root barrels لـ `notifications` و `admin` ✅
- Phase 6.19: إزالة `export * from './ui'` من root barrels لـ `catalog` و `marketplace` ✅
- Phase 6.21: إزالة UI exports من root barrels لـ `auth` و `users` و `payments` ✅
- Phase 6.22: تحديث وثائق READMEs لجميع الموديولات لتعكس سياسة الـ lightweight root barrels ✅
- Phase 6.23: تدقيق شامل للاستيرادات القديمة (Legacy Import Audit) — 12 مسار قديم مصنف ✅
- Phase 6.24: ترحيل `@/utils/cartQuantity` → `@/modules/cart` ✅
- Phase 6.25: ترحيل `@/services/reviewService` → `@/modules/reviews` ✅
- Phase 6.26: تدقيق جاهزية حذف Class D stubs ✅
- Phase 6.27: ترحيل `@/store/favoritesStore` → `@/modules/cart` ✅
- Phase 6.28: ترحيل `@/services/coupons` → `@/modules/coupons` ✅
- Phase 6.29: ترحيل `@/services/minimumOrderService` → `@/modules/cart` ✅
- Phase 6.30: ترحيل `@/hooks/useCheckoutPricing` → `@/modules/checkout` ✅
- Phase 6.31: ترحيل `@/store/cartStore` → `@/modules/cart` (آخر مسار Class C) ✅
- Phase 6.32: تدقيق نهائي شامل + تنظيف `reviewsApi` re-export في `src/services/api.js` ✅
- Phase 6.33: حذف 5 Class D stubs (`favorites.js`، `loyalty.js`، `reviewsApi.js`، `checkoutCleanup.js`، `useReviewQueries.js`) ✅
- Phase 6.34: إغلاق Phase 6 — تقرير نهائي + تأكيد حالة المعمارية ✅

**سياسة الـ Root Barrels (Phase 6.13–6.22):**
- الـ root barrels (`src/modules/*/index.js`) تصدّر فقط lightweight public APIs (stores, API services, domain constants, hooks, utils).
- UI/page-level exports لا تُصدّر من الـ root barrel لمعظم الموديولات.
- UI يبقى متاحاً عبر المسارات الأصلية للمكونات/الصفحات أو عبر module UI barrels (`src/modules/*/ui/index.js`) للاستخدام الداخلي.
- `shared` هو الاستثناء: يصدّر عن قصد lightweight UI primitives (Button, Card, Modal, LoadingSpinner, إلخ) من الـ root barrel.

**ما يجب تحديثه (وفي أي مرحلة):**
- هيكل `src/features/` → استبداله بـ `src/modules/` — **المرحلة 2-5**
- قسم "إضافة Feature جديدة" → تحديثه لاستخدام هيكل الموديولات — **المرحلة 2**
- أي إشارة إلى `axiosInstance.js` → Supabase هو الـ backend الأساسي — **المرحلة 2**

**المرحلة المسؤولة عن التحديث:** المرحلة 2 (عند بدء نقل موديولات البيانات الأساسية)
