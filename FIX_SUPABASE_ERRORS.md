# 🔧 دليل إصلاح أخطاء Supabase

## المشاكل الشائعة وحلولها

---

## 1️⃣ خطأ JWT expired

### الأعراض:
```
Error loading products: { code: "PGRST303", message: "JWT expired" }
Error fetching products: { code: "PGRST303", message: "JWT expired" }
```

### السبب:
انتهت صلاحية رمز المصادقة (JWT Token). هذا يحدث عادةً عندما:
- يبقى المستخدم مسجلاً لفترة طويلة
- يتم تحديث الصفحة بعد فترة طويلة من تسجيل الدخول

### ✅ الحل التلقائي (تم تطبيقه):

تم تحسين `authStore.js` لـ:
1. اكتشاف انتهاء JWT تلقائياً
2. محاولة تحديث الجلسة (`refreshSession`)
3. إذا فشل التحديث → إعادة توجيه إلى `/login?expired=true`

### 🔧 الحل اليدوي:

```bash
# سجّل الخروج ثم سجّل الدخول مرة أخرى
# أو افتح في المتصفح:
http://localhost:3000/login
```

---

## 2️⃣ خطأ vendor_guidelines_accepted مفقود

### الأعراض:
```
Error accepting guidelines: { 
  code: "PGRST204", 
  message: "Could not find the 'vendor_guidelines_accepted' column of 'profiles'" 
}
```

### السبب:
العمود `vendor_guidelines_accepted` غير موجود في جدول `profiles` بقاعدة البيانات.

### ✅ الحل:

**الخطوة 1:** افتح Supabase SQL Editor
```
https://app.supabase.com/project/YOUR_PROJECT/sql
```

**الخطوة 2:** شغّل ملف migration
```
database/migrations/003-fix-missing-columns.sql
```

**أو انسخ الكود التالي والصقه في SQL Editor:**

```sql
-- إضافة الأعمدة المفقودة
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS vendor_guidelines_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vendor_guidelines_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_available_for_delivery BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'van',
ADD COLUMN IF NOT EXISTS vehicle_plate TEXT;

-- إنشاء الفهارس
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_vendor_guidelines ON profiles(vendor_guidelines_accepted);
CREATE INDEX IF NOT EXISTS idx_profiles_verified ON profiles(is_verified);
```

**الخطوة 3:** أعد تحميل الصفحة

---

## 3️⃣ خطأ Cookie rejected

### الأعراض:
```
Cookie "__cf_bm" has been rejected for invalid domain.
```

### السبب:
هذا تحذير من Cloudflare وليس خطأ حقيقي. المتصفح يرفض كوكي Cloudflare لأنه:
- يعمل على `localhost`
- النطاق لا يتطابق

### ✅ الحل:

**لا حاجة للإصلاح!** هذا تحذير فقط ولا يؤثر على عمل التطبيق.

إذا أردت إخفاء التحذير:
```javascript
// في Console المتصفح
console.warn = function(msg) {
  if (!msg.includes('__cf_bm')) {
    console.warn.apply(console, arguments)
  }
}
```

---

## 4️⃣ خطأ 400 Bad Request

### الأعراض:
```
XHR GET https://...supabase.co/rest/v1/orders... [HTTP/2 400]
```

### السبب:
طلب خاطئ لـ Supabase بسبب:
- JWT منتهي الصلاحية
- استعلام خاطئ
- أعمدة مفقودة

### ✅ الحل:

1. **تحقق من JWT:** سجّل الدخول مرة أخرى
2. **تحقق من الاستعلام:** راجع ملف الـ migration
3. **أعد تحميل الصفحة:** `Ctrl+Shift+R`

---

## 🛠️ خطوات الإصلاح الشاملة

### الخطوة 1: تشغيل ملف migration

```sql
-- افتح: https://app.supabase.com/project/_/sql
-- الصق محتوى: database/migrations/003-fix-missing-columns.sql
-- اضغط Run
```

### الخطوة 2: مسح Session القديم

```javascript
// في Console المتصفح
await supabase.auth.signOut()
window.location.reload()
```

### الخطوة 3: تسجيل الدخول مرة أخرى

```
http://localhost:3000/login
```

---

## 📋 قائمة التحقق

- [ ] تشغيل ملف `003-fix-missing-columns.sql` في Supabase
- [ ] تسجيل الخروج والدخول مرة أخرى
- [ ] التحقق من عدم وجود أخطاء JWT expired
- [ ] التحقق من عدم وجود أخطاء PGRST204
- [ ] التحقق من عمل التطبيق بشكل طبيعي

---

## 🆘 إذا استمرت المشاكل

### جمع معلومات التشخيص:

```javascript
// في Console المتصفح
console.log('User:', await supabase.auth.getUser())
console.log('Session:', await supabase.auth.getSession())
console.log('Profile:', await supabase.from('profiles').select('*').single())
```

### إرسال المعلومات:

1. انسخ إخراج Console
2. انسخ رسالة الخطأ الكاملة
3. أرسلها للمطور

---

*آخر تحديث: 10 أبريل 2026*
