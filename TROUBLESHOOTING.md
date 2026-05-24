# 🔧 دليل استكشاف الأخطاء - الشاشة البيضاء

## المشكلة: شاشة بيضاء عند فتح التطبيق

هذه الصفحة تساعدك في تشخيص وإصلاح مشكلة الشاشة البيضاء.

---

## ✅ الإصلاحات المطبقة بالفعل

تم تطبيق الإصلاحات التالية على المشروع:

| الإصلاح | الملف | الوصف |
|---------|-------|-------|
| ✅ تحديث CSP | `index.html` | السماح بـ `http://localhost:*` و `http://127.0.0.1:*` لوضع التطوير |
| ✅ حماية الأخطاء | `main.jsx` | إضافة `try-catch` حول جميع عمليات التهيئة |
| ✅ تحسين ErrorBoundary | `ErrorBoundary.jsx` | عرض رسالة خطأ واضحة مع خطوات الاستكشاف |

---

## 🔍 خطوات التشخيص

### الخطوة 1: افتح Console المتصفح

اضغط `F12` ثم اختر تبويب **Console**

#### إذا رأيت أخطاء حمراء:

| الخطأ | السبب | الحل |
|-------|-------|------|
| `Failed to fetch` | مشكلة في الاتصال بـ Supabase | تحقق من الإنترنت وملف `.env` |
| `Cannot find module` | ملف مفقود | شغّل `npm install` |
| `CSP violation` | سياسة الأمان | امسح Cache المتصفح |
| `JWT expired` | انتهاء الجلسة | سجّل الدخول مرة أخرى |
| `Lock acquisition timeout` | تعارض Supabase | أعد تحميل الصفحة |

### الخطوة 2: تحقق من Network

اختر تبويب **Network** في أدوات المطور:

1. أعد تحميل الصفحة (`Ctrl+R`)
2. ابحث عن طلبات فاشلة (باللون الأحمر)
3. تحقق من أن `main.jsx` يتم تحميله

### الخطوة 3: تحقق من Application

اختر تبويب **Application** → **Storage**:

1. اضغط **Clear site data**
2. أعد تحميل الصفحة

---

## 🛠️ الحلول الشائعة

### الحل 1: مسح Cache المتصفح

```
Chrome/Edge:
1. Ctrl + Shift + Delete
2. اختر "Cached images and files"
3. اضغط "Clear data"

Firefox:
1. Ctrl + Shift + Delete
2. اختر "Cache"
3. اضغط "Clear Now"
```

### الحل 2: إعادة تثبيت الحزم

```bash
cd greenmarket
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### الحل 3: التحقق من ملف .env

تأكد من وجود ملف `.env` بالمحتوى الصحيح:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### الحل 4: إيقاف وإعادة تشغيل خادم التطوير

```bash
# أوقف الخادم (Ctrl+C)
# ثم شغله مرة أخرى
npm run dev
```

### الحل 5: التحقق من منفذ الخادم

إذا كان المنفذ 3000 مشغولاً:

```bash
# ابحث عن العملية
lsof -i :3000

# أوقفها
kill -9 <PID>

# أو استخدم منفذ مختلف
npm run dev -- --port 3001
```

---

## 🚀 تشغيل التطبيق

### وضع التطوير

```bash
npm run dev
```

يفتح على: `http://localhost:3000`

### وضع الإنتاج

```bash
npm run build
npm run preview
```

يفتح على: `http://localhost:4173`

---

## 📋 قائمة التحقق

- [ ] ملف `.env` موجود وبه مفاتيح صحيحة
- [ ] `node_modules` مثبت (`npm install`)
- [ ] خادم التطوير يعمل (`npm run dev`)
- [ ] المتصفح لا يحتوي Cache قديم
- [ ] اتصال الإنترنت يعمل
- [ ] مشروع Supabase نشط

---

## 🆘 إذا استمرت المشكلة

### اجمع هذه المعلومات:

1. **رسالة الخطأ من Console** (انسخ النص الكامل)
2. **إخراج `npm run dev`** (انسخ النص)
3. **إخراج `npm run type-check`** (انسخ النص)
4. **نوع المتصفح وإصداره**

### ثم تحقق من:

```bash
# فحص TypeScript
npm run type-check

# فحص الاختبارات
npm test

# فحص البناء
npm run build
```

---

## 💡 نصائح وقائية

1. **لا تشارك مفاتيح Supabase** - المفاتيح في `.env` يجب أن تبقى سرية
2. **استخدم Git** - احفظ التغييرات لتسهيل التراجع
3. **اختبر في متصفحات متعددة** - Chrome, Firefox, Edge
4. **راقب Console دائماً** - الأخطاء تظهر هناك أولاً

---

*آخر تحديث: 10 أبريل 2026*

---

## Supabase 503 Errors

## المشكلة

عند تشغيل `npm run preview` تظهر أخطاء 503:

```
Failed to load resource: the server responded with a status of 503 ()
router-Cfs5J1Jh.js:1  Failed to load resource: the server responded with a status of 503 ()
vendor-DZBo5846.js:1  Failed to load resource: the server responded with a status of 503 ()
...
```

---

## السبب

**Service Worker (PWA)** يخزن ملفات JavaScript القديمة في الـ cache. عند إعادة البناء:

1. الملفات الجديدة بأسماء مختلفة (hash جديد)
2. Service Worker يحاول تقديم الملفات القديمة من الـ cache
3. الملفات القديمة غير موجودة → خطأ **503 Service Unavailable**

---

## ✅ الإصلاحات المطبقة

### 1. تحديث إعدادات PWA

تم إضافة الإعدادات التالية في `vite.config.js`:

```javascript
workbox: {
  // تنظيف الـ caches القديمة عند التحديث
  cleanupOutdatedCaches: true,
  
  // تفعيل Service Worker الجديد فوراً
  clientsClaim: true,
  skipWaiting: true,
  
  // fallback لـ SPA
  navigateFallback: '/index.html',
}
```

### 2. إضافة وضع Preview

```javascript
preview: {
  port: 4173,
  open: true,
  cors: true,
}
```

---

## 🛠️ خطوات الإصلاح (للمستخدم)

### الطريقة 1: استخدام صفحة المسح (الأسهل)

1. **افتح المتصفح على:**
   ```
   http://localhost:4173/clear-sw.html
   ```

2. **اضغط بالترتيب:**
   - زر "1️⃣ إلغاء تسجيل Service Worker"
   - زر "2️⃣ مسح جميع الـ Caches"
   - زر "🚀 إعادة تحميل التطبيق"

3. **أو اضغط "3️⃣ مسح كل شيء" ثم "🚀 إعادة تحميل التطبيق"**

---

### الطريقة 2: من Console المتصفح

1. افتح **Console** (`F12` → Console)
2. الصق الكود التالي:

```javascript
// إلغاء تسجيل Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister())
    console.log('✓ Service workers unregistered')
  })
}

// مسح الـ Caches
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => {
      caches.delete(name)
      console.log('✓ Cache deleted:', name)
    })
  })
}

// إعادة تحميل
setTimeout(() => window.location.reload(), 500)
```

---

### الطريقة 3: من أدوات المطور

1. افتح **DevTools** (`F12`)
2. اذهب إلى تبويب **Application**
3. اختر **Service Workers** من القائمة اليسرى
4. اضغط **Unregister** بجانب كل Service Worker
5. اختر **Clear storage** من القائمة اليسرى
6. اضغط **Clear site data**
7. أعد تحميل الصفحة (`Ctrl+Shift+R`)

---

### الطريقة 4: إعادة بناء نظيفة

```bash
# إيقاف أي سيرفر يعمل (Ctrl+C)

# مسح dist و node_modules
rm -rf dist node_modules

# إعادة تثبيت الحزم
npm install

# إعادة البناء
npm run build

# تشغيل preview
npm run preview
```

---

## 🚀 تشغيل Preview بعد الإصلاح

```bash
# تأكد من بناء المشروع أولاً
npm run build

# تشغيل وضع المعاينة
npm run preview
```

سيفتح على: **http://localhost:4173**

---

## ✅ التحقق من نجاح الإصلاح

### في Console يجب أن ترى:

```
✓ Service workers unregistered
✓ Cache deleted: workbox-precache-v2-...
✓ Cache deleted: image-cache
```

### في Network tab:

- جميع الملفات تُحمّل بحالة **200 OK**
- لا توجد أخطاء **503**

---

## 💡 نصائح وقائية

### قبل تشغيل Preview دائماً:

```bash
# إعادة بناء نظيفة
npm run build

# ثم تشغيل preview
npm run preview
```

### في وضع التطوير:

Service Worker **معطّل** تلقائياً. لا داعي للقلق.

### عند النشر للإنتاج:

Service Worker سيعمل بشكل صحيح لأن الملفات لن تتغير بعد النشر.

---

## 🔍 تشخيص إضافي

### التحقق من Service Worker المسجل:

```javascript
// في Console
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registered service workers:', regs.length)
  regs.forEach(reg => console.log('- ', reg.scope))
})
```

### التحقق من الـ Caches:

```javascript
// في Console
caches.keys().then(names => {
  console.log('Caches:', names)
  names.forEach(name => {
    caches.open(name).then(cache => {
      cache.keys().then(requests => {
        console.log(`  ${name}: ${requests.length} files`)
      })
    })
  })
})
```

---

## 🆘 إذا استمرت المشكلة

### جرب هذا بالترتيب:

1. **إيقاف السيرفر** (`Ctrl+C`)
2. **مسح dist**: `rm -rf dist`
3. **إعادة البناء**: `npm run build`
4. **مسح Service Worker** من `clear-sw.html`
5. **إعادة تشغيل preview**: `npm run preview`
6. **مسح Cache المتصفح**: `Ctrl+Shift+Delete`

---

*آخر تحديث: 10 أبريل 2026*

---

## Common Supabase Errors

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
