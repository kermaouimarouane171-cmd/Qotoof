# 🚀 دليل البدء السريع (Quick Start)

## الخطوة 1: تثبيت المكتبات الجديدة

```bash
cd greenmarket
npm install @tanstack/react-query@^5.48.0 axios@^1.7.5 react-error-boundary@^4.0.11
```

## الخطوة 2: التحقق من ملف .env

تأكد من وجود هذه الكل متغيرات:

```env
VITE_API_URL=http://localhost:3000/api
```

## الخطوة 3: تشغيل التطبيق

```bash
npm run dev
```

**النتيجة المتوقعة:**
- التطبيق يبدأ بدون أخطاء
- جميع المسارات الأساسية تعمل
- نظام الحماية فعال

## الملفات الأساسية التي تم تعديلها/إنشاؤها

| الملف | النوع | الوصف |
|------|------|--------|
| `src/App.jsx` | تعديل | إضافة ErrorBoundary والمسارات الجديدة |
| `src/services/axiosInstance.js` | جديد | Axios مع Interceptors |
| `src/services/queryClient.js` | جديد | إعدادات React Query |
| `src/middleware/authMiddleware.js` | جديد | تحقق من الصلاحيات |
| `src/components/ProtectedRoute.jsx` | جديد | حماية المسارات والـ Layouts |
| `src/components/ErrorBoundary.jsx` | تعديل | معالجة الأخطاء |
| `src/constants/roles.js` | جديد | تعريفات الأدوار |
| `package.json` | تعديل | إضافة المكتبات الجديدة |

## الخطوة 4: اختبار النظام

### 1. اختبر المسارات العامة:
```
http://localhost:5173/
http://localhost:5173/login
http://localhost:5173/register
```

### 2. اختبر المسارات المحمية:
```
http://localhost:5173/vendor/dashboard     (يتطلب دور vendor)
http://localhost:5173/admin/dashboard      (يتطلب دور admin)
http://localhost:5173/driver/dashboard     (يتطلب دور driver)
```

### 3. اختبر معالجة الأخطاء:
```
http://localhost:5173/invalid-page         (404)
http://localhost:5173/unauthorized         (403)
```

## الخطوة 5: البدء بإضافة أول Feature

**مثال:** إضافة صفحة تعرض المنتجات

### 1. إنشاء الخدمة:
```javascript
// src/features/marketplace/services/api.js
import axiosInstance from '@/services/axiosInstance';

export const productsApi = {
  getAll: () => axiosInstance.get('/products'),
  getById: (id) => axiosInstance.get(`/products/${id}`),
};
```

### 2. إنشاء Hook:
```javascript
// src/features/marketplace/hooks/useProducts.js
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../services/api';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: productsApi.getAll,
    staleTime: 5 * 60 * 1000,
  });
}
```

### 3. تطوير المكون:
```javascript
// src/features/marketplace/components/ProductList.jsx
import { useProducts } from '../hooks/useProducts';

export default function ProductList() {
  const { data: products, isLoading, error } = useProducts();

  if (isLoading) return <div>جاري التحميل...</div>;
  if (error) return <div>خطأ: {error.message}</div>;

  return (
    <div className="grid grid-cols-3 gap-4">
      {products?.map(product => (
        <div key={product.id} className="p-4 border rounded">
          <h3>{product.name}</h3>
          <p className="text-gray-600">{product.price}</p>
        </div>
      ))}
    </div>
  );
}
```

### 4. إضافة Route:
```javascript
// في App.jsx

// استبدل الـ import
const ProductList = lazy(() => import('@/features/marketplace/components/ProductList'));

// أضف الـ route
<Route path="/" element={<MainLayout />}>
  <Route path="products" element={<SuspenseRoute><ProductList /></SuspenseRoute>} />
</Route>
```

## الخطوة 6: موارد إضافية

📖 اقرأ:
- [ARCHITECTURE_GUIDE.md](ARCHITECTURE_GUIDE.md) - دليل معمارية شامل
- [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) - ملخص التطبيق

## النقاط المهمة ⚠️

1. **Token Management**: التوكن يتجدد تلقائياً عند انتهاء الصلاحية
2. **Role-Based Access**: تأكد من تعيين الدور الصحيح للمستخدم
3. **Error Handling**: جميع الأخطاء تُقبض بـ ErrorBoundary
4. **API Calls**: استخدم `axiosInstance` دائماً، لا تستخدم `fetch`
5. **State Management**: استخدم React Query للبيانات من السيرفر فقط

## استكشاف الأخطاء

### مشكلة: "Token not found"
**الحل**: تأكد من تسجيل الدخول وحفظ التوكن في localStorage

### مشكلة: "Access denied"
**الحل**: تحقق من أن دور المستخدم يطابق `requiredRole` في الـ Route

### مشكلة: "Network error"
**الحل**: تأكد من أن `VITE_API_URL` صحيح

### مشكلة: "React Query errors"
**الحل**: راجع `cacheTime` و `staleTime` في `src/services/queryClient.js`

## أوامر مفيدة

```bash
# تطوير
npm run dev

# بناء للإنتاج
npm run build

# الاختبار
npm run test

# الـ Linting
npm run lint
npm run lint:fix
```

## ✅ ضبط الاختبار التالي

اختبر هذا لتتأكد من أن كل شيء يعمل:

```bash
1. npm install              # تثبيت المكتبات
2. npm run dev              # تشغيل
3. افتح http://localhost:5173
4. جرب تسجيل الدخول
5. جرب الانتقال بين المسارات
6. تحقق من وحدة تحكم المتصفح (F12) لأي أخطاء
```

---

**حالة الاستعداد**: ✅ جاهز للبدء
**الدروس التعليمية**: موجودة في المجلد
**الدعم**: راجع ARCHITECTURE_GUIDE.md
