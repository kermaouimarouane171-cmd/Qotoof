# 🎨 المرحلة 2: تطبيق المكونات الحقيقية (Real Component Implementation)

> ⚠️ **هذه مهمة ضخمة:** 50+ مكون يجب استبدال محتواهم

---

## نموذج معياري (Blueprint) لكل مكون

### القالب الأساسي:

```javascript
/**
 * ComponentName.jsx
 * 
 * الوصف: ماذا يفعل هذا المكون
 * المسؤوليات:
 * 1. ...
 * 2. ...
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import queryClient from '@/services/queryClient';
import { axiosInstance } from '@/services/axiosInstance';
import toast from 'react-hot-toast';
import { withErrorBoundary } from 'react-error-boundary';

/**
 * === HOOKS المخصصة ===
 * استخدم هذا لجلب البيانات
 */
function useComponentData(params = {}) {
  return useQuery({
    queryKey: ['componentName', params],
    queryFn: () => axiosInstance.get('/api/endpoint', { params }),
    staleTime: 5 * 60 * 1000, // 5 دقائق
  });
}

/**
 * === المكون الرئيسي ===
 */
function ComponentName() {
  const [localState, setLocalState] = useState(null);
  const { data, isLoading, error } = useComponentData();

  // === معالجة الحالات المختلفة ===
  if (isLoading) {
    return <div className="p-4">جاري التحميل...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">خطأ: {error.message}</div>;
  }

  if (!data) {
    return <div className="p-4 text-gray-600">لا توجد بيانات</div>;
  }

  return (
    <div className="space-y-4">
      {/* محتوى المكون */}
    </div>
  );
}

// === Export مع ErrorBoundary ===
export default withErrorBoundary(ComponentName, {
  FallbackComponent: () => <div>حدث خطأ في هذا المكون</div>,
});
```

---

## قائمة المكونات التي يجب تطبيقها

### ✅ 1️⃣ مكونات Auth (المصادقة)

#### Login.jsx ✅ DONE
```
Status: ✅ مكتمل
Features: تسجيل دخول، التحقق من البيانات، توجيه حسب الدور
```

#### Register.jsx (TODO)
```javascript
// النقاط الأساسية:
- جمع: email, password, fullName, phoneNumber
- اختيار الدور: buyer / vendor / driver
- التحقق من البيانات
- إنشاء حساب جديد
- إرسال رسالة تأكيد بريد إلكتروني
- توجيه إلى Email Verification
- شروط الخدمة (checkbox)
```

#### ForgotPassword.jsx (TODO)
```javascript
// النقاط الأساسية:
- إدخال البريد الإلكتروني
- إرسال رسالة استعادة كلمة المرور
- توجيه إلى صفحة إعادة تعيين
- التحقق من الرابط المرسل
```

#### ResetPassword.jsx (TODO)
```javascript
// النقاط الأساسية:
- الحصول على token من URL
- التحقق من صحة التوكن
- إدخال كلمة المرور الجديدة
- حفظ الكلمة الجديدة
- توجيه إلى تسجيل الدخول
```

#### VerifyEmail.jsx (TODO)
```javascript
// النقاط الأساسية:
- عرض كود التحقق (OTP)
- إدخال الكود من رسالة البريد
- التحقق من الكود
- إعادة الإرسال (Resend)
- حد أقصى 3 محاولات
```

---

### ✅ 2️⃣ مكونات Marketplace (المتجر)

#### Home.jsx (TODO - Priority: HIGH)
```javascript
// النقاط الأساسية:
// Section 1: Hero Banner
- صورة كبيرة
- عنوان رئيسي
- CTA button (ابدأ التسوق)

// Section 2: الفئات الشهيرة
- عرض 6 فئات رئيسية
- صور جذابة
- رابط إلى الفئة

// Section 3: أفضل العروض
- عرض 8 منتجات عشوائية
- السعر الأصلي والخصم
- تقييم المنتج
- زر "أضف إلى السلة"

// Section 4: البائعين الموثوقين
- عرض 6 بائعين أفضل
- لوجو المتجر
- عدد المنتجات
- التقييم

// Section 5: الميزات
- توصيل سريع
- دفع آمن
- فترة إرجاع
- ضمان الجودة

// Section 6: أسئلة شائعة (FAQ)
```

#### Marketplace.jsx (TODO - Priority: HIGH)
```javascript
// النقاط الأساسية:
// Grid Layout:
- Sidebar (يسار):
  □ البحث عن المنتجات
  □ الفئات (تصفية)
  □ نطاق السعر
  □ التقييم
  □ التوفر
  □ البائع

- Main Content (يمين):
  □ عرض شبكة من المنتجات (4 أعمدة)
  □ نوع العرض (Grid/List)
  □ التصنيف (الأحدث، الأفضل عن، السعر)
  □ عدد النتائج
  □ Pagination

// Product Card:
- صورة المنتج
- الاسم
- السعر (الأصلي والخصم)
- التقييم والآراء
- النوع (عضوي/عادي)
- الكمية المتاحة
- زر "أضف إلى السلة"
- أيقونة "المفضلة"
```

#### ProductDetail.jsx (TODO - Priority: HIGH)
```javascript
// النقاط الأساسية:
// Layout:
- معرض الصور (يسار)
  □ صورة كبيرة
  □ صور مصغرة (Bottom)
  □ Zoom عند المرور
  □ Lightbox

- تفاصيل (يمين)
  □ الاسم والفئة
  □ التقييم والعدد
  □ السعر (الأصلي، الخصم، النهائي)
  □ يتم الحفظ (مثل: 45 رس)
  □ الحالة (عضوي/منتظم)
  □ وصف المنتج
  □ المادة الفعالة / الفوائد
  □ تاريخ الانتهاء
  □ الكمية (Selector)
  □ تقطيع أم لا
  □ أضف إلى السلة
  □ شراء الآن
  □ أضف إلى المفضلة

- معلومات البائع
  □ صورة البائع
  □ اسم المتجر
  □ التقييم
  □ عدد المنتجات
  □ وقت الرد
  □ اتصل بالبائع

- التعليقات والآراء
  □ عرض 5 تعليقات أولى
  □ الترتيب: الأحدث / أكثر مساعدة
  □ نموذج إضافة تعليق (للمشترين فقط)
```

#### Cart.jsx (TODO - Priority: HIGH)
```javascript
// النقاط الأساسية:
// Layout:
- جدول السلة (يسار): 70%
  □ كل صف = منتج واحد
  □ الصورة + الاسم
  □ السعر الموحد
  □ الكمية (زر + - )
  □ المجموع الفرعي
  □ زر حذف

- ملخص الطلب (يمين): 30%
  □ المجموع
  □ الخصم
  □ الشحن (مجاني / مدفوع)
  □ الضريبة
  □ الإجمالي النهائي
  □ زر "متابعة الدفع"

- فارغة السلة
  □ صورة توضيحية (سلة فارغة)
  □ رسالة: "لا توجد منتجات"
  □ رابط "العودة للتسوق"

// Bonus:
- كوبون الخصم (قسيمة)
- التوصية بمنتجات أخرى
- "اكمل التسوق"
```

#### Checkout.jsx (TODO - Priority: CRITICAL)
```javascript
// النقاط الأساسية:
// 4 Steps:

// Step 1: معلومات الشحن
□ العنوان الحالي من الملف الشخصي
□ أو إدخال عنوان جديد:
  - Governorate
  - City
  - Street Address
  - Phone Number
□ اختيار طريقة التسليم (عادي/سريع)

// Step 2: طريقة الدفع
□ اختيار الطريقة:
  - Stripe (بطاقة)
  - CMI (بطاقات محلية)
  - الدفع عند التسليم (COD)
□ عرض ملخص الطلب

// Step 3: تأكيد الطلب
□ ملخص نهائي:
  - المنتجات
  - العنوان
  - طريقة الدفع
  - الإجمالي

// Step 4: معالجة الدفع
□ للـ Stripe: معالجة بطاقة الائتمان
□ للـ CMI: توجيه إلى بوابة CMI
□ للـ COD: تأكيد الطلب مباشرة

// تأكيد النجاح:
□ شاشة شكر
□ رقم الطلب
□ رقم التتبع
□ رابط إلى صفحة الطلب
```

#### Orders.jsx (TODO - Priority: HIGH)
```javascript
// قائمة الطلبات
□ الفلاتر:
  - الحالة (جميع، قيد المعالجة، تم الشحن، مسلم)
  - التاريخ (الأحدث أولاً)
  - السعر (الأعلى, الأقل)

□ جدول الطلبات:
  - رقم الطلب
  - التاريخ
  - العدد
  - الإجمالي
  - الحالة (Badge ملون)
  - الإجرائات (عرض، تتبع، إلغاء)

□ تفاصيل كل طلب (Modal أو صفحة منفصلة)
```

#### OrderDetail.jsx (TODO)
```javascript
// تفاصيل الطلب الواحد
□ رقم الطلب
□ قائمة المنتجات
□ معلومات الشحن
□ نقطة التتبع (Map)
□ حالة الطلب
□ المشكلات (إن وجدت)
□ زر "تحميل الفاتورة"
□ زر "طلب ترجيع"
```

#### Stores.jsx (TODO)
```javascript
// قائمة جميع المتاجر
□ Search + Filters
□ Grid من المتاجر:
  - لوجو
  - الاسم
  - التقييم
  - عدد المنتجات
  - وقت الرد
  - زر "زيارة"

□ أو List View
```

#### StoreDetail.jsx (TODO)
```javascript
// صفحة المتجر
□ Header:
  - صورة الغلاف
  - لوجو المتجر
  - الاسم
  - التقييم
  - عدد المتابعين
  - زر "متابعة"
  - معلومات الاتصال

□ القائمة:
  - نبذة عن المتجر
  - المنتجات
  - الآراء

□ المنتجات:
  - Display 12 منتج
  - Pagination
```

---

### ✅ 3️⃣ مكونات Vendor (البائعين)

#### Dashboard.jsx (TODO - Priority: HIGH)
```javascript
// Vendor Dashboard
□ Cards إحصائية:
  - إجمالي المبيعات اليوم
  - عدد الطلبات الجديدة
  - عدد الطلبات قيد المعالجة
  - المتوسط التقييم

□ رسم بياني (Chart):
  - مبيعات آخر 30 يوم
  - المنتجات الأكثر مبيعاً

□ الطلبات الأخيرة (جدول):
  - 5 طلبات أخيرة
  - مع الإجراءات

□ المنتجات الخاطئة:
  - المخزون المنخفض
  - المنتجات غير المنشورة
```

#### Products.jsx (TODO)
```javascript
// إدارة المنتجات
□ جدول المنتجات:
  - الصورة، الاسم، السعر، الكمية، التقييم، الحالة
  - الإجراءات: تعديل، حذف، عرض

□ أزرار:
  - زر "منتج جديد"
  - زر "استيراد من CSV"
  - زر "حفظ كـ Draft"

□ Filters:
  - الحالة
  - الفئة
  - البحث
```

#### Orders.jsx - Vendor (TODO)
```javascript
// جميع طلبات البائع
□ نفس الفكرة لكن من منظور البائع
□ يمكن تعديل حالة الطلب
□ إضافة رسالة للمشتري
□ طباعة الفاتورة
```

#### Analytics.jsx (TODO)
```javascript
// تحليلات المبيعات
□ رسوم بيانية:
  - مبيعات شهرية
  - أفضل 10 منتجات
  - توزيع الطلبات حسب المدينة
  - معدل التحويل

□ تقارير:
  - تحميل تقرير شهري
  - تحميل تقرير ربع سنوي
```

#### Profile.jsx - Vendor (TODO)
```javascript
// ملف البائع الشخصي
□ معلومات المتجر:
  - الاسم، الوصف
  - لوجو، صورة الغلاف
  - ساعات العمل

□ معلومات الحساب:
  - البريد الإلكتروني
  - رقم الهاتف
  - CIN (National ID)

□ معلومات البنك:
  - IBAN
  - اسم الحساب
```

---

### ✅ 4️⃣ مكونات Admin (الإدارة)

#### AdminDashboard.jsx (TODO)
```javascript
// Admin Dashboard
□ KPIs:
  - إجمالي المستخدمين
  - إجمالي المبيعات
  - عدد الطلبات
  - عدد الشكاوى

□ الرسوم البيانية:
  - المستخدمين الجدد
  - المبيعات الشهرية
  - الطلبات حسب الحالة

□ التنبيهات (Alerts):
  - منتجات تحتاج موافقة
  - شكاوى جديدة
  - بائعين معطلين
```

#### Users.jsx (Admin) (TODO)
```javascript
// إدارة المستخدمين
□ جدول المستخدمين:
  - البريد الإلكتروني
  - الاسم
  - الدور
  - تاريخ الإنشاء
  - الحالة (نشط/معطل)
  - الإجراءات

□ الإجراءات:
  - تفعيل / تعطيل
  - تغيير الدور
  - حذف
  - عرض التفاصيل
```

#### Products.jsx (Admin) (TODO)
```javascript
// مراجبة المنتجات
□ منتجات تحتاج موافقة
□ منتجات مشبوهة (ربما مزيفة)
□ جدول مع:
  - الصورة، الاسم، البائع
  - الحالة
  - الإجراءات: موافقة / رفض / تعليق
```

#### Orders.jsx (Admin) (TODO)
```javascript
// عرض جميع الطلبات في النظام
□ جدول شامل
□ إمكانية التدخل في حالات النزاع
□ عرض عميق لكل طلب
```

#### Analytics.jsx (Admin) (TODO)
```javascript
// تحليلات عامة
□ رسوم بيانية شاملة للنظام
□ تقارير إيرادات
□ تحليل السلوك
```

#### Settings.jsx (Admin) (TODO)
```javascript
// إعدادات النظام
□ عمولات System
□ سياسات الإرجاع
□ إعدادات الدفع
□ رسائل البريد الإلكتروني
```

---

### ✅ 5️⃣ مكونات Driver (السائقين)

#### Dashboard.jsx - Driver (TODO)
```javascript
// لوحة سائق التوصيل
□ الإحصائيات:
  - الطلبات المكتملة اليوم
  - الإيرادات اليومية
  - التقييم الحالي

□ الطلب الحالي (Now):
  - عنوان الالتقاط
  - عنوان التسليم
  - الخريطة
  □ Accept / Reject الطلب

□ التوصيات:
  - الطلبات المجاورة
  - الطريق الموصى به
```

#### Active.jsx (TODO)
```javascript
// الطلبات النشطة الحالية
□ قائمة الطلبات:
  - الحالة الحالية
  - المدة المتوقعة للتسليم
  - العنوان
  - زر "في الطريق"
  - زر "تسليم"
```

#### History.jsx (TODO)
```javascript
// سجل التوصيلات
□ جدول:
  - التاريخ
  - الطلب
  - الراتب
  - الحالة
  - المربح

□ إمكانية عرض التفاصيل
```

#### Earnings.jsx (TODO)
```javascript
// الربح والإيرادات
□ رسم بياني (Chart):
  - إيرادات آخر 30 يوم

□ جدول:
  - الطلب
  - المبلغ
  - التاريخ
  - الحالة (مدفوع/قيد الانتظار)
```

#### Profile.jsx - Driver (TODO)
```javascript
// ملف السائق الشخصي
□ معلومات الهوية:
  - الاسم
  - البريد الإلكتروني
  - رقم الهاتف
  - CIN (رقم بطاقة التعريف)

□ معلومات المركبة:
  - رقم السيارة
  - نوع السيارة
  - سنة الصنع
  - صورة المركبة

□ معلومات البنك:
  - IBAN
  - اسم الحساب
```

---

## استراتيجية التطبيق المقترحة

### المرحلة A: الأساسيات (4-5 أيام)

البدء بهذه المكونات الحرجة أولاً:

```
Priority 1 (MUST HAVE):
1. Register.jsx - ✅ يجب أن يعمل
2. ForgotPassword.jsx
3. ResetPassword.jsx
4. VerifyEmail.jsx
5. Home.jsx - الصفحة الرئيسية
6. Marketplace.jsx - قائمة المنتجات
7. ProductDetail.jsx - تفاصيل المنتج
8. Cart.jsx - السلة
9. Checkout.jsx - الدفع (الأكثر أهمية!)

Deliverable: تطبيق نوى يمكن للمستخدم أن:
- ينشئ حساب
- يشتري منتج واحد
- يكمل الدفع
```

### المرحلة B: المميزات الإضافية (3-4 أيام)

```
Priority 2:
1. Orders.jsx
2. OrderDetail.jsx
3. VendorDashboard.jsx
4. VendorProducts.jsx
5. DriverDashboard.jsx
6. AdminDashboard.jsx

Deliverable: كل دور له لوحة تحكم أساسية
```

### المرحلة C: طلب من الميزات (4-5 أيام)

```
Priority 3:
- Stores, StoreDetail
- VendorAnalytics, AdminAnalytics
- VendorProfile, DriverProfile, AdminSettings
- الرسائل والإشعارات
- المفضلات والتقييمات
```

---

## نموذج كامل: HomeComponent

```javascript
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/services/axiosInstance';
import ProductCard from './ProductCard';
import StoreCard from './StoreCard';

export default function Home() {
  // === جلب البيانات ===
  const { data: products } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => axiosInstance.get('/api/products?featured=true&limit=12'),
  });

  const { data: stores } = useQuery({
    queryKey: ['recommended-stores'],
    queryFn: () => axiosInstance.get('/api/stores?rating=true&limit=6'),
  });

  return (
    <div>
      {/* === Hero Banner === */}
      <section className="bg-green-600 text-white py-20">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold mb-4">قطوف - للخضار والفواكه</h1>
          <p className="text-xl mb-8">أفضل المنتجات الطازة بأسعار تنافسية</p>
          <button className="bg-white text-green-600 px-8 py-3 rounded-lg font-bold">
            ابدأ التسوق الآن
          </button>
        </div>
      </section>

      {/* === Featured Products === */}
      <section className="py-20 container mx-auto">
        <h2 className="text-3xl font-bold mb-10">أفضل العروض</h2>
        <div className="grid grid-cols-4 gap-4">
          {products?.data?.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* === Recommended Stores === */}
      <section className="py-20 container mx-auto bg-gray-50">
        <h2 className="text-3xl font-bold mb-10">المتاجر الموثوقة</h2>
        <div className="grid grid-cols-3 gap-4">
          {stores?.data?.map(store => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

---

## ✅ Checklist التطبيق

- [ ] جميع المكونات لها منطق حقيقي
- [ ] جميع المكونات متصلة بـ Supabase
- [ ] جميع المكونات لها معالجة أخطاء
- [ ] جميع المكونات لها loading states
- [ ] جميع المكونات موثقة (JSDoc)
- [ ] جميع الـ forms لها validation
- [ ] جميع العمليات تسجل في audit logs
- [ ] جميع المكونات مغلفة بـ ErrorBoundary

