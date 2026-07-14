# Phase 4A-5: Analytics Module — Audit Report

> تقرير فحص فعلي لوحدة analytics في GreenMarket (Qotoof).
> لا يحتوي أحكام "Production Ready" أو "PASS" نهائية — فقط النتائج والتصنيف حسب الأولوية.

---

## 1. النطاق المفحوص

### ملفات مصدرية
| الملف | الأسطر | الدور |
|------|--------|------|
| `src/services/apis/analyticsApi.js` | 90 | analyticsApi: getVendorStats, getAdminStats |
| `src/services/vendorAnalytics.js` | 309 | helpers: chart data, KPIs, time bucketing |
| `src/services/analytics.js` | 357 | privacy-friendly analytics (self-hosted) |
| `src/services/googleAnalytics.js` | 113 | Google Analytics (GA4) |
| `src/utils/analytics.js` | 123 | wrappers around googleAnalytics |
| `src/services/reports/reportService.js` | 131 | report generation: sales, user, inventory, delivery |
| `src/services/reports/csvExport.js` | 49 | CSV export |
| `src/services/reports/excelExport.js` | 53 | Excel export |
| `src/services/reports/pdfExport.js` | 107 | PDF export |

### صفحات
| الملف | الدور |
|------|------|
| `src/pages/admin/Analytics.jsx` | لوحة تحكم admin (orders, revenue, vendors, buyers, drivers) |
| `src/pages/vendor/Analytics.jsx` | لوحة تحكم vendor (revenue, orders, ratings, top products) |

### وحدة re-export
`src/modules/analytics/` — طبقة re-export فقط، لا منطق.

### اختبارات موجودة
| الملف | عدد الاختبارات |
|------|----------------|
| `src/__tests__/services/vendorAnalytics.test.js` | ~10 |
| `src/__tests__/pages/AdminAnalytics.query.test.jsx` | 1 |

---

## 2. RLS — فحص حرفي

### جدول `orders` (يستخدمه analyticsApi + reportService + admin/vendor Analytics)
| السياسة | cmd | roles | qual |
|---------|-----|-------|------|
| Admins can manage all orders | ALL | authenticated | `is_current_user_admin()` |
| Users can view own orders | SELECT | authenticated | `(buyer_id = auth.uid()) OR (vendor_id = auth.uid()) OR (driver_id = auth.uid())` |
| Vendors can view orders for their products | SELECT | authenticated | `(vendor_id = auth.uid()) OR current_user_is_order_vendor(id)` |
| Drivers can view assigned orders | SELECT | authenticated | `(driver_id = auth.uid())` |

**النتيجة:** admin يرى كل الطلبات. vendor يرى طلباته فقط. buyer يرى طلباته فقط. driver يرى طلباته فقط.
**التقييم:** RLS صحيح ويمنع تسريب بيانات بين الأدوار.

### جدول `profiles` (يستخدمه analyticsApi + reportService + admin/vendor Analytics)
| السياسة | cmd | roles | qual |
|---------|-----|-------|------|
| profiles_select_admin | SELECT | authenticated | `is_current_user_admin()` |
| profiles_select_own | SELECT | authenticated | `id = auth.uid()` |
| profiles_select_active_drivers | SELECT | authenticated | `(role = 'driver') AND (is_available_for_delivery = true)` |
| profiles_select_order_participant | SELECT | authenticated | `current_user_shares_order_with_profile(id)` |

**النتيجة:** admin يرى كل profiles. غير admin يرى profile خاصته فقط أو مشاركين في طلب.
**التقييم:** RLS صحيح. لكن `analyticsApi.getAdminStats()` تستعلم عن `profiles` بـ count — لو استدعاها غير admin، ستحصل على count = 1 (نفسه فقط) بدلاً من خطأ. هذا ليس تسريب بيانات لكنه بيانات خاطئة بصمت.

### جدول `products` (يستخدمه reportService + vendor Analytics)
| السياسة | cmd | roles | qual |
|---------|-----|-------|------|
| Admins can manage all products | ALL | authenticated | `is_current_user_admin()` |
| Vendors can view their own products | SELECT | authenticated | `vendor_id = auth.uid()` |
| Public can view published products | SELECT | public | `approval_status = 'published'` |

**النتيجة:** admin يرى كل المنتجات. vendor يرى منتجاته. public يرى المنشور فقط.
**التقييم:** RLS صحيح.

### جدول `deliveries` (يستخدمه admin Analytics)
| السياسة | cmd | roles | qual |
|---------|-----|-------|------|
| Users can view own deliveries | SELECT | authenticated | `(driver_id = auth.uid()) OR current_user_can_view_order(order_id)` |
| Drivers can update assigned deliveries | UPDATE | authenticated | `driver_id = auth.uid()` |
| Vendors can assign drivers | UPDATE | authenticated | `current_user_can_view_order(order_id)` |

**النتيجة:** admin يرى كل deliveries (عبر `current_user_can_view_order` الذي يسمح للـ admin). driver يرى deliveries المسندة إليه. vendor يرى deliveries المرتبطة بطلباته.
**التقييم:** RLS صحيح.

### جدول `reviews` (يستخدمه vendor Analytics)
| السياسة | cmd | roles | qual |
|---------|-----|-------|------|
| reviews_public_select | SELECT | public | `deleted_at IS NULL` |
| Reviews are publicly viewable | SELECT | public | `true` |
| Authenticated users can create reviews | INSERT | authenticated | `NULL` |
| Users can update own reviews | UPDATE | public | `buyer_id = auth.uid()` |

**النتيجة:** reviews متاحة للجميع (public). لا حاجة لـ auth لقراءة reviews.
**التقييم:** RLS صحيح (reviews مصممة لتكون عامة).

---

## 3. المشاكل المكتشفة

### P1 — عالية الأولوية

#### P1-1: `completed_at` غير موجود في جدول `deliveries` — bug حقيقي
**الملف:** `src/pages/admin/Analytics.jsx` الأسطر 98 و 214
**المشكلة:**
- السطر 98: `.select('id, driver_id, status, created_at, accepted_at, completed_at', { count: 'exact' })`
- السطر 214: `const finishedAt = delivery.completed_at`

جدول `deliveries` لديه `delivered_at` وليس `completed_at` (تأكدت من information_schema.columns).
**التأثير:**
- الاستعلام سيرجع `completed_at: null` لكل الصفوف (Supabase لا يُخطئ للأعمدة غير الموجودة في select، يُرجع null).
- `finishedAt` سيكون دائماً null → `avgTimeMinutes` سيكون دائماً 0.
- **مؤشر أداء السائقين (Driver Performance) معطوب بالكامل** — لا يُحسب متوسط وقت التوصيل أبداً.

#### P1-2: `price` غير موجود في جدول `products` — bug في reportService
**الملف:** `src/services/reports/reportService.js` السطر 73
**المشكلة:**
```js
.select('id, name, category, price, stock_quantity, created_at, ...')
```
جدول `products` لديه `price_per_unit` وليس `price` (تأكدت من information_schema.columns).
**التأثير:**
- `generateInventoryReport` سترجع `price: null` لكل المنتجات.
- تقرير المخزون (Inventory Report) سيفتقد عمود السعر.

### P2 — متوسطة الأولوية

#### P2-1: `analyticsApi.getAdminStats()` لا تتحقق من دور admin
**الملف:** `src/services/apis/analyticsApi.js` السطور 52-89
**المشكلة:** الدالة لا تتحقق من دور admin قبل تنفيذ الاستعلامات. تعتمد كلياً على RLS.
**التأثير:** لو استدعاها مستخدم غير admin، ستحصل على بيانات خاطئة (count = 1 لـ profiles، orders خاصة به فقط) بدلاً من خطأ واضح. الصفحة `admin/Analytics.jsx` تتحقق من `isAdmin` قبل العرض (سطر 283)، لكن `analyticsApi` نفسها لا تتحقق — defense-in-depth مفقود.
**ملاحظة:** RLS يمنع تسريب البيانات فعلياً، لذا هذا P2 وليس P0.

#### P2-2: `analyticsApi.getVendorStats()` لا تتحقق من vendorId
**الملف:** `src/services/apis/analyticsApi.js` السطور 12-50
**المشكلة:** الدالة تقبل `vendorId` كـ parameter لكن لا تتحقق أنه يطابق `auth.uid()`. تعتمد على RLS.
**التأثير:** لو استدعاها buyer بـ vendorId خاص بـ vendor آخر، RLS على `orders` سيمنع تسريب البيانات (buyer سيرى فقط طلباته الخاصة). لكن النتيجة ستكون خاطئة بصمت.

#### P2-3: `total_amount` في admin Analytics — fallback لعمود غير موجود
**الملف:** `src/pages/admin/Analytics.jsx` السطر 124
**المشكلة:**
```js
const revenue = Number(order.total_amount ?? order.total ?? 0) || 0
```
جدول `orders` لديه `total` وليس `total_amount` (مؤكد في .windsurfrules). `total_amount` سيكون دائماً null، لكن الـ fallback إلى `total` يعمل. هذا ليس bug وظيفي لكنه كود ميت.
**التأثير:** لا تأثير وظيفي (fallback يعمل)، لكنه كود مضلل يشير إلى عمود غير موجود.

#### P2-4: `reportService.generateUserReport()` لا تتحقق من دور admin
**الملف:** `src/services/reports/reportService.js` السطور 48-63
**المشكلة:** تستعلم عن `profiles` بكل الأعمدة (first_name, last_name, email, role, created_at) بدون فحص admin. تعتمد على RLS.
**التأثير:** RLS `profiles_select_admin` يسمح فقط للـ admin برؤية كل profiles. غير admin سيرى فقط profile خاصته. لكن النتيجة ستكون قائمة بحجم 1 بدلاً من خطأ.

### P3 — منخفضة الأولوية

#### P3-1: `trackSearch` لا تُطبع query قبل الإرسال
**الملف:** `src/services/analytics.js` السطر 199
**المشكلة:**
```js
query: query.substring(0, 100), // Limit length
```
يحد الطول إلى 100 حرف لكن لا يُطبع (sanitize) من XSS أو أحرف خاصة. الـ payload يُرسل كـ JSON إلى analytics endpoint.
**التأثير:** منخفض — الـ payload يُرسل كـ JSON (ليس HTML)، لذا XSS غير ممكن. لكن لو كان الـ endpoint يعرض الـ query في لوحة تحكم HTML، قد يكون XSS ممكناً.

#### P3-2: `trackEvent` ترسل `window.location.pathname` بدون تحقق
**الملف:** `src/services/analytics.js` السطر 103
**المشكلة:**
```js
u: window.location.pathname,
```
يرسل pathname تلقائياً. لا يمكن للمستخدم التحكم فيه مباشرة (يأتي من المتصفح).
**التأثير:** منخفض — pathname يأتي من المتصفح وليس من إدخال مستخدم.

#### P3-3: `setupOutboundLinkTracking` يرسل `link.textContent` بدون تحقق
**الملف:** `src/services/analytics.js` السطر 290
**المشكلة:**
```js
text: link.textContent?.substring(0, 100),
```
يرسل نص الرابط الخارجي. يحد الطول لكن لا يُطبع.
**التأثير:** منخفض — يُرسل كـ JSON.

#### P3-4: `setupErrorTracking` يرسل `event.message` بدون تحقق
**الملف:** `src/services/analytics.js` السطور 307-311
**المشكلة:**
```js
message: event.message?.substring(0, 200),
filename: event.filename,
```
يرسل رسالة الخطأ واسم الملف. يحد الطول لكن لا يُطبع.
**التأثير:** منخفض — يُرسل كـ JSON.

#### P3-5: `googleAnalytics.purchase` لا تتحقق من وجود `order.items`
**الملف:** `src/services/googleAnalytics.js` السطر 73
**المشكلة:**
```js
items: order.items?.map(item => ({...})),
```
لو `order.items` undefined، `items` سيكون undefined (بسبب optional chaining). GA4 قد يرفض الـ event.
**التأثير:** منخفض — GA4 سيتجاهل الـ event بصمت.

#### P3-6: `csvExport.exportToCSV` لا تُطبع قيم الخلايا
**الملف:** `src/services/reports/csvExport.js` السطور 28-46
**المشكلة:** تستخدم `Papa.unparse` مباشرة على الـ rows بدون sanitization. لو احتوت قيمة على `,` أو `"` أو `\n`، Papa.parse يتعامل معها بشكل صحيح (escaping تلقائي).
**التأثير:** منخفض — Papa.unparse يتكفل بالـ escaping.

#### P3-7: `reportService.generateDeliveryReport` تستخدم `delivered_at` بشكل صحيح
**الملف:** `src/services/reports/reportService.js` السطر 97
**الملاحظة:** على عكس admin Analytics.jsx، reportService تستخدم `delivered_at` بشكل صحيح. هذا يؤكد أن P1-1 bug حقيقي في admin Analytics فقط.

#### P3-8: `vendorAnalytics.js` يستخدم `order.order_items` بدون تحقق من null
**الملف:** `src/services/vendorAnalytics.js` السطر 172
**المشكلة:**
```js
order.order_items?.forEach((item) => {
```
يستخدم optional chaining — صحيح. لكن لو `order_items` undefined، الـ forEach لن يُنفذ بصمت.
**التأثير:** منخفض — optional chaining يتعامل معها.

### P4 — تحسينات جودة

#### P4-1: `analyticsApi` يستخدم `withRetry` — جيد
**الملاحظة:** `getVendorStats` و `getAdminStats` يستخدمان `withRetry` بـ maxRetries=3. هذا جيد ويحمي من فشل شبكة مؤقت.

#### P4-2: `googleAnalytics` يعطل في development — جيد
**الملاحظة:** `this.enabled = !!this.gaId && import.meta.env.PROD` — لا يعمل في dev. جيد.

#### P4-3: `analytics.js` يحترم Do Not Track — جيد
**الملاحظة:** السطر 40: `if (navigator.doNotTrack !== '1')` — يحترم DNT. جيد.

#### P4-4: `analytics.js` يعطل في development — جيد
**الملاحظة:** كل الدوال تتحقق من `import.meta.env.DEV` وتخرج مبكراً. جيد.

#### P4-5: `vendorAnalytics.js` helpers خالصة (pure functions)
**الملاحظة:** كل helpers (buildRevenueChartData, buildOrdersChartData, etc.) خالصة — لا side effects، لا استعلامات DB. تستقبل data وتُرجع chart data. هذا نمط ممتاز للاختبار.

---

## 4. ملخص التصنيف

| الأولوية | العدد | الوصف |
|----------|-------|------|
| P0 | 0 | لا توجد ثغرات أمنية حرجة |
| P1 | 2 | bugs وظيفية حقيقية (completed_at, price) |
| P2 | 4 | فحص admin مفقود، fallback لعمود غير موجود |
| P3 | 8 | تحسينات sanitization، تحقق null، كود مضلل |
| P4 | 5 | ملاحظات إيجابية (withRetry, DNT, pure functions) |

---

## 5. ملاحظات إضافية

### اختبارات موجودة
- `vendorAnalytics.test.js`: يغطي helpers (resolveVendorAnalyticsRange, buildTopProductMetrics, calculateVendorAnalyticsMetrics, buildAnalyticsCsvRows). لا يغطي analyticsApi أو reportService.
- `AdminAnalytics.query.test.jsx`: اختبار واحد فقط يتحقق أن الاستعلام يستخدم `total` وليس `total_amount`. لا يغطي logic الـ analytics.

### فجوات اختبارية
- لا اختبارات لـ `analyticsApi.getAdminStats` أو `getVendorStats`.
- لا اختبارات لـ `reportService` (generateSalesReport, generateUserReport, generateInventoryReport, generateDeliveryReport).
- لا اختبارات لـ `analytics.js` (trackPageView, trackEvent, etc.).
- لا اختبارات لـ `googleAnalytics.js`.
- لا اختبارات لـ admin/vendor Analytics.jsx (logic الاستعلامات والتجميع).

### ملاحظة على RLS
RLS على الجداول المستخدمة (orders, profiles, products, deliveries, reviews) صحيح ويمنع تسريب البيانات بين الأدوار. المشكلة الرئيسية ليست في RLS بل في:
1. bugs وظيفية (completed_at, price).
2. غياب فحص admin في API layer (defense-in-depth).
3. غياب اختبارات لمعظم الملفات.
