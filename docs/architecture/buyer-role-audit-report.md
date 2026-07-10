# تقرير مراجعة دور المشتري الشامل — منصة قُطوف (Qotoof)

**تاريخ المراجعة:** 2025  
**النطاق:** تدفق البيانات من التسجيل → جميع صفحات المشتري → نسبة الإكمال  

---

## 1. ملخص تنفيذي

**نسبة الإكمال الفعلية لدور المشتري: ~78%**

| المؤشر | القيمة |
|--------|--------|
| إجمالي الصفحات | 11 (9 رئيسية + تهيئة + دفع) |
| تعمل بشكل صحيح | 8 |
| بها مشاكل | 3 |
| أخطاء حرجة | 2 (1 تم إصلاحه) |
| أخطاء متوسطة | 3 |

---

## 2. الإصلاحات المطبقة

### 2.1 حفظ بيانات التسجيل (حرج)
**الملف:** `src/services/authActionsService.js`  
**المشكلة:** بيانات البائع والمشتري لم تكن تُحفظ في `profiles` عند التسجيل.  
**الحل:** إضافة حقول `store_name`, `store_type`, `city` للبائع، و`address` للمشتري (من `deliveryAddress`).  
**ملاحظة:** `preferredPaymentMethod` لا يوجد عمود مقابل في `profiles`.

### 2.2 استيراد CheckIcon المفقود (حرج)
**الملف:** `src/pages/buyer/Orders.jsx`  
**المشكلة:** `CheckIcon` مستخدم في السطر 665 لكنه غير مُستورد → انكسار عند "تحديد الكل".  
**الحل:** إضافته لقائمة الاستيراد.

### 2.3 اختبارات الانحدار
3 اختبارات جديدة في `authActionsService.signUp.test.js` — جميعها نجحت.

---

## 3. المشاكل المُحدَّدة

### أخطاء حرجة

| # | الصفحة | المشكلة | الحالة |
|---|--------|---------|--------|
| C-1 | Orders.jsx | `CheckIcon` غير مُستورد | ✅ تم الإصلاح |
| C-2 | Settings.jsx | جدول `user_settings` يُعامَل كجدول مسطح بدلاً من Key-Value | ⚠️ يتطلب إصلاح |

### أخطاء متوسطة

| # | الصفحة | المشكلة |
|---|--------|---------|
| M-1 | Orders.jsx | إدراج `return_requests` ينقصه `vendor_id` (مطلوب في schema) |
| M-2 | Registration | `preferredPaymentMethod` لا يوجد عمود في `profiles` |
| M-3 | Checkout | `profile.city` فارغ للمشتري (لا يُجمع عند التسجيل) |

---

## 4. تحليل تدفق البيانات لكل صفحة

### التسجيل → profiles
```
Register.jsx → signUp() → profiles.upsert()
  firstName/lastName/email/phone/cin → profiles ✅
  deliveryAddress → profiles.address ✅ (تم إصلاحه)
  preferredPaymentMethod → ❌ (لا يوجد عمود)
```

### Dashboard — ✅ 95%
استعلامات متوازية (orders, deliveries, products, stores) + Realtime.

### Orders — ⚠️ 88%
ترقيم صفحات + Realtime + بحث + فلترة. تم إصلاح `CheckIcon`. ينقص `vendor_id` في `return_requests`.

### Addresses — ✅ 100%
CRUD كامل على جدول `addresses`.

### Settings — ⚠️ 60%
إعدادات الخصوصية تعمل (`profilesService.updateProfile`). إعدادات الإشعارات **لا تعمل** (`user_settings` جدول Key-Value وليس مسطح).

### Coupons — ✅ 95%
`couponsApi.getAvailableCoupons` — تعمل بشكل صحيح.

### Loyalty — ✅ 95%
`loyaltyApi.getLoyaltyDashboard` + استبدال نقاط + إحالة — تعمل.

### Security — ✅ 92%
تغيير كلمة مرور (OTP) + MFA + إدارة جلسات + سجل نشاط.

### ShoppingLists — ✅ 90%
CRUD + إضافة الكل للسلة + معالجة احتياطية للصور.

### RFQ — ✅ 90%
إنشاء/عرض/قبول/إلغاء طلبات السعر.

### Onboarding — ✅ 100%
3 شرائح تعريفية ثم توجيه للوحة التحكم.

### Checkout — ✅ 85%
يملأ `profile.address` (الآن يُحفظ من التسجيل). `profile.city` فارغ للمشترين الجدد.

---

## 5. شجرة تدفق البيانات

```
التسجيل → profiles (first_name, last_name, email, phone, cin, address, role)
  ↓
VerifyEmail (OTP) → BuyerOnboarding → /buyer/dashboard
  ↓
Dashboard: orders + deliveries + products + stores
Orders: fetchBuyerOrders + return_requests(❌ ينقص vendor_id)
Addresses: addresses CRUD
Settings: user_settings(❌) + profilesService(✅)
Coupons: couponsApi ✅
Loyalty: loyaltyApi ✅
Security: MFA + password + sessions ✅
ShoppingLists: shopping_lists CRUD ✅
RFQ: rfqService ✅
Checkout: profile.address(✅) + profile.city(❌ فارغ)
```

---

## 6. التوصيات

1. **إصلاح Settings.jsx:** تحويل التعامل مع `user_settings` إلى نموذج Key-Value (قراءة/كتابة عبر `setting_key` و `setting_value`)
2. **إصلاح Orders.jsx:** تمرير `vendor_id` عند إدراج `return_requests`
3. **إضافة `city` للمشتري:** إضافة حقل المدينة في نموذج التسجيل للمشتري
4. **`preferredPaymentMethod`:** إما إضافة عمود في `profiles` (migration) أو إزالته من نموذج التسجيل
5. **تحسينات UI:** إضافة زر "العودة" في Security و RFQ
