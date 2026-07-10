# Express Backend Deprecation - Complete

## التاريخ
2026-07-08

## الإنجازات
- ✅ حذف مجلد `src/api/` بالكامل (18 ملف)
- ✅ حذف مجلد `src/middleware/` بالكامل (1 ملف)
- ✅ نقل `productsApi.ts` إلى `src/modules/catalog/api/productsApi.ts`
- ✅ تحديث جميع الـ imports
- ✅ إزالة scripts Express من `package.json`

## Routes محذوفة بدون بديل

### `/admin/drivers/:id/suspend` و `/admin/drivers/:id/activate`
- **الحالة:** غير مستخدمة في الواجهة
- **السبب:** Express backend لم يكن مستخدماً أصلاً (0 imports)
- **الوظائف البديلة:** `src/services/driver.service.js` يحتوي على `suspendDriver` و `activateDriver` لكنها لا تُستخدم في الواجهة
- **إذا كانت مطلوبة مستقبلاً:** إنشاء Edge Function `admin-set-driver-status` مع:
  - التحقق من أن المستخدم هو admin
  - قبول parameters: driver_id, action (suspend/activate)
  - تحديث profiles.status في قاعدة البيانات
  - إرجاع النتيجة

## Dependencies
- `express`: محذوف من package.json
- `cors`: لم يُستخدم في الكود - محذوف من package.json
- `helmet`: لم يُستخدم في الكود - محذوف من package.json
- `morgan`: لم يُستخدم في الكود - محذوف من package.json
- `jsonwebtoken`: لم يُستخدم في الكود - محذوف من package.json

## التحقق
- ✅ npm run build بدون أخطاء
- ✅ npm run lint بدون أخطاء جديدة
- ✅ لا توجد imports لـ src/api/
- ✅ لا توجد imports لـ src/middleware/
