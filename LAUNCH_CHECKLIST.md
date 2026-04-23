# 🚀 دليل الإطلاق النهائي - قطوف (Qotoof)

## ✅ قائمة التحقق النهائية

### 1️⃣ إعداد Supabase

```sql
-- 1. تشغيل سكريبت قاعدة البيانات
-- انسخ محتوى: supabase/setup-storage.sql
-- الصقه في: https://app.supabase.com/project/_/sql

-- 2. تفعيل Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
```

**✅ تحقق:**
- [ ] الجداول موجودة
- [ ] الفهارس تم إنشاؤها
- [ ] Storage Buckets تم إنشاؤها
- [ ] Realtime مفعّل

---

### 2️⃣ نشر Edge Functions

```bash
# تسجيل الدخول لـ Supabase
supabase login

# ربط المشروع
supabase link --project-ref YOUR_PROJECT_ID

# نشر الدوال
supabase functions deploy send-email
supabase functions deploy create-payment-intent
supabase functions deploy refund-payment
```

**✅ تحقق:**
- [ ] send-email deployed
- [ ] create-payment-intent deployed
- [ ] refund-payment deployed

---

### 3️⃣ إعداد المتغيرات البيئية

```bash
# نسخ ملف البيئة
cp .env.example .env

# تحرير القيم
nano .env  # أو أي محرر
```

**القيم المطلوبة:**
```env
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...
VITE_STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
VITE_SENTRY_DSN=https://...
```

**✅ تحقق:**
- [ ] جميع القيم موجودة
- [ ] لا توجد قيم placeholder
- [ ] المفاتيح السرية آمنة

---

### 4️⃣ تثبيت ونشر Edge Functions Variables

في Supabase Dashboard → Edge Functions → Secrets:

```
RESEND_API_KEY = re_your_key
STRIPE_SECRET_KEY = sk_your_key
SUPABASE_URL = https://...
SUPABASE_SERVICE_ROLE_KEY = ...
```

**✅ تحقق:**
- [ ] المتغيرات مضافة
- [ ] القيم صحيحة

---

### 5️⃣ فحص TypeScript والبناء

```bash
# فحص TypeScript
npm run type-check

# تثبيت الحزم
npm install

# تشغيل الاختبارات
npm test

# البناء
npm run build

# معاينة
npm run preview
```

**✅ تحقق:**
- [ ] لا أخطاء TypeScript
- [ ] لا أخطاء في البناء
- [ ] التطبيق يعمل في المعاينة

---

### 6️⃣ النشر إلى Firebase

```bash
# تسجيل الدخول
firebase login

# تهيئة (إذا لم تكن مهيأة)
firebase init hosting

# النشر
npm run deploy
# أو
firebase deploy --only hosting
```

**✅ تحقق:**
- [ ] النشر ناجح
- [ ] الرابط يعمل
- [ ] HTTPS مفعّل

---

### 7️⃣ التحقق من الإطلاق

#### الصفحات العامة
- [ ] `/` - الصفحة الرئيسية
- [ ] `/marketplace` - السوق
- [ ] `/stores` - المتاجر
- [ ] `/contact` - تواصل معنا
- [ ] `/about` - حول

#### المصادقة
- [ ] `/login` - تسجيل الدخول
- [ ] `/register` - التسجيل

#### الوظائف الأساسية
- [ ] البحث يعمل
- [ ] إضافة للسلة تعمل
- [ ] الدفع يعمل
- [ ] Real-time يعمل (افتح نافذتين)

#### لوحات التحكم
- [ ] `/buyer/dashboard` - المشتري
- [ ] `/vendor/dashboard` - البائع
- [ ] `/driver/dashboard` - السائق
- [ ] `/admin/dashboard` - المدير

---

### 8️⃣ المراقبة

#### Sentry (الأخطاء)
```
URL: https://sentry.io
✅ تصل الأحداث
```

#### Resend (البريد)
```
URL: https://resend.com
✅ الإرسالات تعمل
```

#### Stripe (الدفع)
```
URL: https://dashboard.stripe.com
✅ المدفوعات تصل
```

#### Supabase (قاعدة البيانات)
```
URL: https://app.supabase.com
✅ الاستعلامات تعمل
✅ Realtime يعمل
```

---

## 🎯 خطوات ما بعد الإطلاق

### الأسبوع الأول
1. **مراقبة الأخطاء** - تحقق من Sentry يومياً
2. **مراقبة الأداء** - تحقق من سرعة التحميل
3. **مراجعة البريد** - تأكد من وصول الإشعارات
4. **اختبار الدفع** - قم بطلب تجريبي كامل

### الشهر الأول
1. **تحليل الاستخدام** - راجع Google Analytics
2. **جمع الملاحظات** - استمع للمستخدمين
3. **تحسين الأداء** - حسّن البطء
4. **إضافة ميزات** - بناءً على الطلب

---

## 🆘 حل المشاكل الشائعة

### المشكلة: خطأ في البناء
```bash
# الحل
rm -rf node_modules
npm install
npm run build
```

### المشكلة: TypeScript أخطاء
```bash
# فحص الأخطاء
npm run type-check

# تجاهل الأخطاء مؤقتاً (ليس مستحسن)
npx tsc --noEmit --skipLibCheck
```

### المشكلة: Real-time لا يعمل
```sql
-- تحقق من التفعيل
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- أضف الجدول
ALTER PUBLICATION supabase_realtime ADD TABLE your_table;
```

### المشكلة: البريد لا يُرسل
```bash
# تحقق من المتغيرات
supabase secrets list

# أعد النشر
supabase functions deploy send-email
```

### المشكلة: الدفع لا يعمل
```bash
# تحقق من Stripe
# Dashboard → Developers → Logs

# تحقق من Edge Function
supabase functions logs send-email
```

---

## 📊 روابط مهمة

| الخدمة | الرابط |
|--------|--------|
| Supabase | https://app.supabase.com |
| Firebase | https://console.firebase.google.com |
| Stripe | https://dashboard.stripe.com |
| Resend | https://resend.com |
| Sentry | https://sentry.io |
| التطبيق | https://your-project-id.web.app |

---

## 🎉 تهانينا!

إذا اكتملت جميع الخطوات أعلاه، فتطبيقك **جاهز للإطلاق**!

**الرابط:** `https://your-project-id.web.app`

**الدعم الفني:** راجع `DEVELOPER_GUIDE.md` و `TYPESCRIPT_SETUP.md`

---

*آخر تحديث: أبريل 2026*
