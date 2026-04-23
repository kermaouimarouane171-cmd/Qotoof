# 📚 GreenMarket - التوثيق الشامل

## 🎯 نظرة عامة

GreenMarket (Qotoof) هو تطبيق B2B متكامل لسوق الجملة في المغرب للمنتجات الزراعية.

### المميزات الرئيسية
- 🛒 سوق متعدد البائعين
- 🚚 نظام توصيل متكامل مع السائقين
- 👥 4 أدوار: مشتري، بائع، سائق، مدير
- 🌍 دعم 3 لغات: العربية، الفرنسية، الإنجليزية
- 📱 PWA مع دعم Offline
- 🔒 أمان متعدد الطبقات
- ⚡ أداء محسن مع caching

---

## 🏗️ البنية التقنية

### Stack التقني
```
Frontend: React 18 + Vite 6
Styling: Tailwind CSS 3
State: Zustand 4
Database: Supabase (PostgreSQL)
Auth: Supabase Auth + MFA
Maps: Leaflet + React-Leaflet
Charts: Chart.js + Recharts
i18n: i18next
Monitoring: Sentry
Analytics: Plausible (privacy-friendly)
Deployment: Firebase Hosting
Testing: Jest + Cypress
```

### هيكل الملفات
```
greenmarket/
├── src/
│   ├── App.jsx                    # التوجيه الرئيسي
│   ├── main.jsx                   # نقطة الدخول
│   ├── components/                # 30+ مكون
│   │   ├── ui/                    # مكونات الواجهة
│   │   ├── auth/                  # مكونات المصادقة
│   │   └── driver/                # مكونات السائق
│   ├── pages/                     # 78 صفحة
│   │   ├── admin/                 # 12 صفحة مدير
│   │   ├── vendor/                # 9 صفحات بائع
│   │   ├── buyer/                 # 3 صفحات مشتري
│   │   ├── driver/                # 12 صفحة سائق
│   │   ├── seller/                # 7 صفحات بديلة
│   │   └── auth/                  # 6 صفحات مصادقة
│   ├── services/                  # 12 خدمة
│   ├── store/                     # 4 متاجر Zustand
│   ├── hooks/                     # 14 hook مخصص
│   ├── utils/                     # 16 أداة
│   ├── layouts/                   # 3 تخطيطات
│   └── i18n/                      # الترجمة
├── database/                      # SQL schemas
├── cypress/                       # E2E tests
├── .github/workflows/             # CI/CD
└── config files                   # الإعدادات
```

---

## 🔐 الأمان

### طبقات الحماية

#### 1. المصادقة
```javascript
// تسجيل الدخول مع MFA
import { useAuthStore } from '@/store/authStore'

const { signIn, verifyMFA } = useAuthStore()

// تسجيل الدخول
const result = await signIn(email, password)
if (result.mfaRequired) {
  await verifyMFA(code)
}
```

#### 2. التحقق من المدخلات
```javascript
import { validateData, loginSchema } from '@/utils/validationSchemas'

const result = validateData(loginSchema, formData)
if (!result.success) {
  // عرض أخطاء التحقق
  result.errors.forEach(err => showError(err.field, err.message))
}
```

#### 3. تنظيف XSS
```javascript
import { sanitizeHTML, detectXSS, SafeHTML } from '@/utils/sanitization'

// تنظيف HTML
const cleanHTML = sanitizeHTML(userContent)

// كشف XSS
if (detectXSS(input)) {
  showError('محتوى غير صالح')
}

// استخدام مكون آمن
<SafeHTML html={content} />
```

#### 4. حماية CSRF
```javascript
import { CSRFProtectedForm, csrfPost } from '@/utils/csrfProtection'

// نموذج محمي
<CSRFProtectedForm action="/api/submit" onSubmit={handleSubmit}>
  {/* حقول النموذج */}
</CSRFProtectedForm>

// طلب API محمي
const response = await csrfPost('/api/submit', data)
```

#### 5. سياسات الأمان (CSP)
```
✅ Content Security Policy
✅ X-Content-Type-Options: nosniff
✅ X-Frame-Options: DENY
✅ Referrer-Policy: strict-origin
✅ Permissions-Policy
```

---

## ⚡ الأداء

### التحسينات المطبقة

#### 1. تقسيم الحزم (Code Splitting)
```javascript
// vite.config.js - تقسيم تلقائي
manualChunks: {
  'react-vendor': ['react', 'react-dom'],
  'router-vendor': ['react-router-dom'],
  'state-vendor': ['zustand'],
  'supabase-vendor': ['@supabase/supabase-js'],
  'charts-vendor': ['chart.js', 'recharts'],
  'maps-vendor': ['leaflet', 'react-leaflet'],
}
```

#### 2. التحميل الكسول (Lazy Loading)
```javascript
// الصفحات محملة بشكل كسول
const HomePage = lazy(() => import('./pages/Home'))
const MarketplacePage = lazy(() => import('./pages/Marketplace'))

// الصور محملة بشكل كسول
<OptimizedImage 
  src={image} 
  placeholder="blur"
  priority={false}
/>
```

#### 3. التخزين المؤقت (Caching)
```javascript
// استعلامات مخبأة
import { fetchProductsOptimized, useOptimizedQuery } from '@/utils/databaseOptimizations'

const { data, loading } = useOptimizedQuery(
  'products',
  () => fetchProductsOptimized(filters),
  { staleTime: 60000 } // 1 دقيقة
)
```

#### 4. التحسينات الأخرى
- ✅ Tree shaking
- ✅ Minification مع Terser
- ✅ Console removal في الإنتاج
- ✅ Image optimization مع CDN
- ✅ Virtual scrolling للقوائم الكبيرة
- ✅ Debounce/Throttle للمدخلات

---

## 🎣 Hooks المخصصة

### قائمة الـ Hooks المتاحة

```javascript
import {
  useFetch,              // جلب البيانات
  useSupabaseQuery,      // استعلامات Supabase
  usePagination,         // الترقيم
  useForm,               // إدارة النماذج
  useModal,              // النوافذ المنبثقة
  useToast,              // الإشعارات
  useClipboard,          // النسخ
  useLocalStorage,       // التخزين المحلي
  useMediaQuery,         // الاستجابة
  useBreakpoint,         // نقاط التوقف
  useInterval,           // الفترات الزمنية
  useDocumentTitle,      // عنوان الصفحة
  useConfirmation,       // تأكيد الحوار
} from '@/hooks'
```

### أمثلة الاستخدام

```javascript
// استخدام useForm
const { values, handleChange, handleSubmit, errors } = useForm(
  { email: '', password: '' },
  loginSchema
)

const onSubmit = async (data) => {
  await signIn(data.email, data.password)
}

<form onSubmit={() => handleSubmit(onSubmit)}>
  <input name="email" value={values.email} onChange={handleChange} />
  {errors.email && <span>{errors.email}</span>}
</form>

// استخدام usePagination
const { data, loading, loadMore, hasMore } = usePagination(
  ({ page, limit }) => fetchProductsOptimized({}, { page, limit }),
  { pageSize: 20 }
)

// استخدام useModal
const { isOpen, open, close, modalData } = useModal()

<button onClick={() => open({ id: 1 })}>فتح</button>
<Modal isOpen={isOpen} onClose={close}>
  {/* محتوى النافذة */}
</Modal>
```

---

## 🧪 الاختبارات

### اختبارات Unit (Jest)
```bash
npm run test           # تشغيل الاختبارات
npm run test:watch     # وضع المراقبة
npm run test:coverage  # مع تغطية الكود
```

### اختبارات E2E (Cypress)
```bash
npm run test:cypress       # فتح واجهة Cypress
npm run test:cypress:run   # تشغيل في الرأس
npm run test:e2e           # مع Chrome
```

### هيكل الاختبارات
```
cypress/e2e/
├── auth.cy.js           # اختبارات المصادقة
├── marketplace.cy.js    # اختبارات السوق
├── vendor.cy.js         # اختبارات البائع
└── ...
```

---

## 🚀 النشر

### CI/CD Pipeline

```
push → lint → test → build → e2e → deploy
```

#### المراحل:
1. **Lint** - فحص الكود
2. **Unit Tests** - اختبارات الوحدة
3. **Build** - بناء التطبيق
4. **E2E Tests** - اختبارات شاملة
5. **Deploy Staging** - نشر تجريبي (develop)
6. **Deploy Production** - نشر إنتاجي (main)

### النشر اليدوي
```bash
npm run build          # بناء
npm run deploy         # نشر على Firebase
npm run deploy:all     # نشر كل شيء
```

### المتغيرات البيئية المطلوبة
```bash
# CI/CD Secrets
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SENTRY_DSN
VITE_ANALYTICS_DOMAIN
VITE_ANALYTICS_SITE_ID
FIREBASE_SERVICE_ACCOUNT_PRODUCTION
```

---

## 📊 المراقبة والتحليلات

### Sentry - مراقبة الأخطاء
```javascript
import { captureException, addBreadcrumb } from '@/services/sentryMonitoring'

try {
  // عملية خطيرة
} catch (error) {
  captureException(error, {
    component: 'CheckoutPage',
    action: 'placeOrder'
  })
}
```

### Analytics - تحليلات الخصوصية
```javascript
import { trackEvent, trackPurchase } from '@/services/analytics'

// تتبع حدث
trackEvent('add_to_cart', { product_id, price })

// تتبع شراء
trackPurchase(orderId, total, itemCount)
```

---

## 🌍 الترجمة (i18n)

### اللغات المدعومة
- 🇬🇧 الإنجليزية (en)
- 🇫🇷 الفرنسية (fr)
- 🇲🇦 العربية (ar) - مع دعم RTL

### الاستخدام
```javascript
import { useTranslation } from 'react-i18next'

const { t, i18n } = useTranslation()

// ترجمة بسيطة
<h1>{t('welcome')}</h1>

// ترجمة مع متغيرات
<p>{t('items_count', { count: 5 })}</p>

// تغيير اللغة
i18n.changeLanguage('ar')
```

---

## 🗄️ قاعدة البيانات

### الجداول الرئيسية
```sql
profiles          -- الملفات الشخصية
stores            -- المتاجر
products          -- المنتجات
orders            -- الطلبات
deliveries        -- التوصيلات
reviews           -- التقييمات
notifications     -- الإشعارات
```

### الأدوار
```sql
buyer    -- مشتري
vendor   -- بائع
driver   -- سائق
admin    -- مدير
```

---

## 🎨 المكونات

### مكونات UI الأساسية
```javascript
import {
  Button,
  Input,
  Modal,
  Card,
  Badge,
  LoadingSpinner,
  ProductCard,
  OptimizedImage,
  Skeleton,
  // ...المزيد
} from '@/components/ui'
```

### مكونات الأمان
```javascript
import {
  ProtectedRoute,
  MFASetup,
  MFAVerify,
  SessionManager,
} from '@/components/auth'
```

---

## 📈 الإحصائيات

| المقياس | القيمة |
|---------|--------|
| الصفحات | 78 |
| المكونات | 30+ |
| الخدمات | 12 |
| Hooks مخصصة | 14 |
| الأدوات | 16 |
| جداول DB | 12+ |
| اختبارات E2E | 50+ |
| حجم الحزمة | ~2.5MB (محسن) |

---

## 🔧 الأوامر المتاحة

```bash
# التطوير
npm run dev              # خادم التطوير
npm run build            # البناء
npm run preview          # معاينة الإنتاج

# الاختبارات
npm run test             # Unit tests
npm run test:watch       # Watch mode
npm run test:coverage    # مع التغطية
npm run test:cypress     # Cypress UI
npm run test:cypress:run # Cypress headless
npm run test:e2e         # E2E مع Chrome
npm run test:all         # كل الاختبارات

# الجودة
npm run lint             # فحص الكود
npm run lint:fix         # إصلاح تلقائي

# النشر
npm run deploy           # نشر على Firebase
npm run deploy:all       # نشر كل شيء

# التحليل
npm run analyze          # تحليل الحزمة
```

---

## ✅ قائمة ما قبل النشر

- [ ] `npm run build` بدون أخطاء
- [ ] `npm run test:all` جميع الاختبارات ناجحة
- [ ] `npm run lint` بدون تحذيرات
- [ ] المتغيرات البيئية مضبوطة
- [ ] Sentry DSN مضبوط
- [ ] Analytics مضبوط
- [ ] Image CDN مضبوط
- [ ] Firebase configured
- [ ] Supabase RLS policies active
- [ ] اختبارات E2E ناجحة

---

## 🆘 الدعم

### مشاكل شائعة

**البناء يفشل:**
```bash
rm -rf node_modules .vite dist
npm install
npm run build
```

**اختبارات Cypress تفشل:**
```bash
npx cypress cache clear
npx cypress install
npm run test:cypress:run
```

**أخطاء Sentry:**
```bash
# تأكد من DSN صحيح
echo $VITE_SENTRY_DSN
```

---

**آخر تحديث:** 2026-04-07  
**الإصدار:** 2.0.0  
**الحالة:** ✅ Production Ready
