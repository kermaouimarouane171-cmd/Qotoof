# 🔧 إصلاح خطأ 503 في وضع Preview

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
