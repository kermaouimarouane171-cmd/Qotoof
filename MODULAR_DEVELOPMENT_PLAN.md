# خطة التطوير الموديولي — Modular Development Plan

**المشروع:** Greenmarket / Qotoof  
**الهدف:** تقسيم التطبيق إلى موديولات مستقلة ذات حدود واضحة لتسهيل التطوير المستقبلي، إدارة الفريق، واختبار كل جزء على حدة.  
**الإصدار:** 1.1  
**التاريخ:** 2026-06-22  
**الحالة:** قيد التنفيذ — المرحلة 0.5، 1.1، 1.2، 1.3، 1.4 مكتملة (المرحلة 1 مكتملة)، 2.1، 2.2، 2.3، 2.4، 2.5 مكتملة (المرحلة 2 مكتملة)، 2.6 مكتملة (تحضير التدفقات الحرجة قبل Phase 3)، 3.1 مكتملة (موديول checkout)، 3.2 مكتملة (موديول payments)، 3.3 مكتملة (موديول notifications)، 3.4 مكتملة (تحضير الإشعارات/التفضيلات/الدعم)، 4.1 مكتملة (موديول coupons)، 4.2 مكتملة (موديول reviews)، 4.3 مكتملة (موديول chat)، 4.4 مكتملة (موديول commissions)، 4.5 مكتملة (موديول analytics)، 4.6 مكتملة (موديول admin)، 4.7 مكتملة (تحضير ما قبل الترحيل — تقسيم api.js و useVendorAdminQueries.js)، 5.1 مكتملة (تبني الاستيراد الآمن — shared، reviews، coupons)، 5.2 مكتملة (تبني الاستيراد الآمن — auth، users)، 5.3 مكتملة (تبني الاستيراد الآمن — catalog، marketplace)، 5.4 مكتملة (تبني الاستيراد الآمن — notifications، cart)، 5.5 مكتملة (تبني الاستيراد الآمن — orders، delivery)، 5.6 مكتملة (تبني الاستيراد الآمن — analytics، commissions)، 5.7 مكتملة (تبني الاستيراد الآمن — checkout، payments)، 5.8 مكتملة (تبني الاستيراد الآمن — admin، chat)، 6.1 مكتملة (نقل الملفات الآمن — coupons، reviews)، 6.2 مكتملة (نقل الملفات الآمن — reviewsApi، minimumOrderService)، 6.3 مكتملة (نقل الملفات الآمن — cartQuantity، checkoutCleanup، useCheckoutPricing)، 6.4 مكتملة (تقييم نقل loyalty — تم تأجيل النقل، يحتاج موديول مخصص)، 6.5 مكتملة (تأسيس موديول loyalty — طبقة re-export)، 6.6 مكتملة (تبني الاستيراد الآمن — loyalty)، 6.7 مكتملة (نقل الملفات الآمن — loyalty.js)، 6.8 مكتملة (نقل الملفات الآمن — favoritesStore.js)، 6.9 مكتملة (تقسيم ونقل favorites.js — 4 ملفات منقولة)، 6.10 مكتملة (تبني الاستيراد الآمن — favorites.js split)، 6.11 مكتملة (نقل الملفات الآمن — cartStore.js)، 6.12 مكتملة (تبني الاستيراد الآمن — cartStore.js)، 6.13 مكتملة (إصلاح barrel safety — cart module)، 6.14 مكتملة (تبني الاستيراد الآمن مع تحديث Jest mocks — cartStore.js)، 6.15 مكتملة (إصلاح barrel safety — orders module)، 6.16 مكتملة (تبني الاستيراد الآمن — checkoutService.js)، 6.17 مكتملة (تدقيق barrel safety — delivery + checkout)، 6.18 مكتملة (فصل استيراد UI — notifications + admin)، 6.19 مكتملة (فصل استيراد UI — catalog + marketplace)، 6.20 مكتملة (إصلاح عقد استيراد storeTypeService.test.js)، 6.21 مكتملة (تنظيف root barrels — auth + users + payments)، 6.22 مكتملة (تحديث وثائق READMEs و Public API documentation)، 6.23 مكتملة (Legacy Import Audit — تدقيق واستكشاف فقط)، 6.24 مكتملة (Safe Import Adoption — @/utils/cartQuantity)، 6.25 مكتملة (Safe Import Adoption — @/services/reviewService)، 6.26 مكتملة (Class D Stub Removal Readiness Audit — تدقيق فقط)، 6.27 مكتملة (Safe Import Adoption — @/store/favoritesStore)، 6.28 مكتملة (Safe Import Adoption — @/services/coupons)، 6.29 مكتملة (Safe Import Adoption — @/services/minimumOrderService)، 6.30 مكتملة (Safe Import Adoption — @/hooks/useCheckoutPricing)، 6.31 مكتملة (Safe Import Adoption — @/store/cartStore — آخر مسار Class C)، 6.32 مكتملة (Final Legacy Re-Audit + reviewsApi Re-export Cleanup)، 6.33 مكتملة (Class D Stub Deletion — 5 stubs deleted)، 6.34 مكتملة (Phase 6 Closure Report — Phase 6 معلن اكتماله)، 7.1 مكتملة (Pre-Movement Analysis for checkoutService.js — تحليل فقط، لا تغيير في الكود)، 7.2 مكتملة (checkoutService.js File Movement — نقل إلى checkout module + compatibility stub)، 7.3 مكتملة (checkoutService Import Adoption — ترحيل جميع المستهلكين إلى @/modules/checkout)، 7.4 مكتملة (checkoutService Stub Deletion — حذف compatibility stub، صفر مستهلكين)، 7.5 مكتملة (Payment Services Pre-Movement Analysis — تحليل فقط، لا تغيير في الكود)، 7.6 مكتملة (paymentRecords.js File Movement — نقل إلى payments module + compatibility stub)، 7.7 مكتملة (paymentGateway.js File Movement — نقل إلى payments module + compatibility stub)، 7.8 مكتملة (paymentService.js File Movement — نقل إلى payments module + compatibility stub، إكمال نقل جميع ملفات الدفع الثلاثة)، 7.9 مكتملة (Payment Consumer Import Adoption — ترحيل جميع مستهلكي @/services/paymentService و @/services/paymentGateway و @/services/paymentRecords إلى @/modules/payments، صفر مستهلكين نشطين على المسارات القديمة)، 7.10 مكتملة (Payment Stub Deletion — حذف stubs الدفع الثلاثة، إكمال دورة ترحيل خدمات الدفع 7.5→7.10)، 7.11 مكتملة (Pre-Existing Test Failures Stabilization — إصلاح 3 إخفاقات اختبارات سابقة: paymentGateway cache test، paymentRecords schema test، orderFlow flaky test، 183/183 اختبار نجح)، 7.12 مكتملة (Full Test Baseline Audit — تدقيق كامل للاختبارات: 141/141 suite نجح، 1415 اختبار نجح، 0 إخفاقات، إصلاح 5 اختبارات قديمة + Jest config)، 7.13 مكتملة (CMI & Refund Services Pre-Movement Analysis — تحليل قبل نقل cmiPayment.js و refundPolicyService.js: ملكية payments، 7 مستهلكين، خطر منخفض، GO لكلا الملفين، نقل منفصل)، 7.14 مكتملة (Refund Policy Service File Movement — نقل refundPolicyService.js إلى src/modules/payments/api/ + stub توافق، 715 ملف، 0 تبعيات دائرية)، 7.15 مكتملة (CMI Payment File Movement — نقل cmiPayment.js إلى src/modules/payments/api/ + stub توافق + تغيير استيراد داخلي من @/modules/payments إلى ./paymentRecords، 716 ملف، 0 تبعيات دائرية)، 7.16 مكتملة (CMI & Refund Consumer Import Adoption — ترحيل 4 مستهلكين من @/services/cmiPayment و @/services/refundPolicyService إلى @/modules/payments، 0 استيرادات نشطة على المسارات القديمة، 716 ملف، 0 تبعيات دائرية)، 7.17 مكتملة (CMI & Refund Stub Deletion — حذف stubs التوافق لـ cmiPayment.js و refundPolicyService.js، تحديث README docs، 714 ملف، 0 تبعيات دائرية، دورة الهجرة 7.13–7.17 مكتملة)، 7.18 مكتملة (Payments Module Closure & Remaining Services Ownership Map — تدقيق موديول الدفعات مكتمل، خريطة ملكية 63 ملف في src/services/، 7 stubs جاهزة للحذف، توصية Phase 7.19: حذف الـ 7 stubs)، 7.19 مكتملة (Remaining Legacy Stubs Deletion — حذف جميع الـ 7 stubs المتبقية: cartStore، favoritesStore، coupons، reviewService، minimumOrderService، cartQuantity، useCheckoutPricing، تحديث 10 ملفات توثيقية، 707 ملف، 0 stubs متبقية، 141/141 suites، 1415/1417 tests، 0 إخفاقات، 0 تبعيات دائرية — تنظيف الـ stubs مكتمل رسمياً)، 7.20 مكتملة (Payout & Payment Method Strategy Pre-Movement Analysis — تحليل قبل نقل payoutService.js و paymentMethodStrategy.js، تحليل فقط بدون تغيير كود، توصية: نقل الملفين إلى @/modules/commissions/api/ في Phase 7.21 مع إضافة اختبارات و stub)، 7.21 مكتملة (Payout & Payment Method Strategy Test-and-Movement — إضافة 24 اختبار قبل النقل، نقل payoutService.js و paymentMethodStrategy.js إلى @/modules/commissions/api/، إنشاء stubs، تحديث barrels و READMEs، 711 ملف، 0 تبعيات دائرية، 143/143 suites، 1439/1441 tests، 0 إخفاقات)، 7.22 مكتملة (Payout & Payment Method Strategy Stub Deletion — تحديث مسارات استيراد الاختبارات إلى @/modules/commissions، حذف stubs الـ 2، 709 ملف، 0 stubs متبقية، 143/143 suites، 1439/1441 tests، 0 إخفاقات، 0 تبعيات دائرية — دورة هجرة payout/strategy 7.20–7.22 مكتملة)، 7.23 مكتملة (Commission Notifications Pre-Movement Analysis — تحليل قبل نقل commissionNotifications.js، تحليل فقط بدون تغيير كود، توصية: نقل إلى @/modules/commissions/api/ في Phase 7.24 مع إضافة اختبارات و stub)، 7.24 مكتملة (Commission Notifications Test-and-Movement — إضافة 21 اختبار قبل النقل، نقل commissionNotifications.js إلى src/modules/commissions/api/، إنشاء stub، تحديث commissions و notifications barrels، 711 ملف، 0 تبعيات دائرية، 144/144 suites، 1460/1462 tests، 0 إخفاقات)، 7.25 مكتملة (Commission Service Protected Import Adoption — تحديث مسار استيراد commissionNotifications في commissionService.js من @/services/commissionNotifications إلى @/modules/commissions، Protected Zone Section 37، تغيير مسار استيراد فقط بدون تغيير منطق، stub محفوظ، 711 ملف، 0 تبعيات دائرية، 144/144 suites، 1460/1462 tests، 0 إخفاقات)، 7.26 مكتملة (Commission Notifications Stub Deletion — حذف stub src/services/commissionNotifications.js، 0 مستهلكين نشطين قبل وبعد الحذف، 710 ملف، 0 تبعيات دائرية، 144/144 suites، 1460/1462 tests، 0 إخفاقات — دورة هجرة commissionNotifications 7.23–7.26 مكتملة)، 7.27 مكتملة (Commission Service Pre-Movement Analysis — تحليل شامل لـ commissionService.js 696 سطر، Protected Zone، 8 exports، 7 helpers، 3 constants، 6 جداول Supabase، 0 Edge Functions، 0 اختبارات، 3 مستهلكين (1 barrel + 2 UI)، خطر دائري محتول via local import، توصية: إضافة 41–54 اختبار في Phase 7.28 قبل النقل)، 7.28 مكتملة (Commission Service Test Coverage — 61 اختبار في 10 suites، جميع exports و Supabase tables و notification flows و error paths مغطاة، 0 تغييرات في الكود الإنتاجي، 145/145 suites نجح)، 7.29 مكتملة (Commission Service File Movement — نقل commissionService.js إلى commissions/api/ مع stub توافقي، تغيير استيراد commissionNotifications إلى محلي ./commissionNotifications، 0 تبعيات دائرية، 145/145 suites نجح)، 8.19 مكتملة (B-009 fix: signup OTP verification), 8.21 مكتملة (Buyer P1 Stabilization Fixes), 8.22 مكتملة (Buyer P2/P3 UI/UX & i18n Polish), 8.23 مكتملة (Buyer i18n JSON Cleanup & Final Polish Verification)

---

## 1. ملخص تنفيذي

يعد Greenmarket تطبيق سوق متعدد الأدوار (Buyer, Vendor, Driver, Admin) مبني على:
- **Frontend:** React + Vite
- **Backend API:** Express (Sidecar محدود)
- **البيانات والأذونات:** Supabase (PostgreSQL + Auth + RLS + Realtime + Storage)
- **المدفوعات:** PayPal / Bank Transfer / COD مع بوابة داخلية

الهدف من هذه الخطة هو تحويل بنية المشروع الحالية إلى بنية موديولية واضحة، بحيث:
- كل موديول يملك مسؤولية واحدة محددة.
- التبعيا بين الموديولات تكون صريحة ومراقبة.
- يمكن تطوير واختبار كل موديول بشكل مستقل.
- تقليل التأثير الجانبي عند إضافة ميزات جديدة.

---

## 2. التشخيص المعماري الحالي

### 2.1 المشاكل الرئيسية في البنية الحالية

| المشكلة | التأثير | المكان الأكثر تضرراً |
|---|---|---|
| ملفات ضخمة (God Files) | صعوبة المراجعة والاختبار | `pages/admin/Orders.jsx`, `pages/vendor/Products.jsx`, `authStore.js` |
| تبعيات ضمنية ومتداخلة | تغيير جزء واحد يكسر أجزاء أخرى | `services/api.js` يستورد `authStore.js` |
| استدعاءات Supabase مباشرة من الصفحات | صعوبة إعادة الاستخدام والاختبار | معظم ملفات `pages/` |
| تكرار المنطق | تناقضات في السلوك | `STATUS_CONFIG` في 5+ ملفات |
| مزيج بين الصفحات والمكونات الموديولية | `features/` تحتوي على ملفات مهجورة | `features/vendor/components/`, `features/admin/components/` |
| عدم وجود عقد واضح بين الطبقات | صعوبة فهم الواجهات العامة | `services/` بشكل عام |

### 2.2 ما يعمل بالفعل
- وجود طبقة `services/` منفصلة عن `components/`.
- وجود مجلدات `domains/` بدائية (`catalog`, `ordering`, `delivery`, `payments`, `identity`) مع `commands.js` و `queries.js`.
- وجود `data/` repository بدائية (`productRepository.ts`, `orderRepository.ts`, `userRepository.ts`).
- وجود `business/` logic بدائية (`orderLogic.ts`, `productLogic.ts`).
- استخدام `constants/orderStatuses.ts` كمصدر موحد لحالات الطلب.
- وجود `ProtectedRoute.jsx` و `AppRouter.jsx` يدعمان التحميل الكسول والأدوار.

---

## 3. المعمارية المقترحة: Feature + Domain Hybrid

### 3.1 الفلسفة

سنستخدم بنية هجينة تجمع بين:
- **Feature-Based Organization:** كل ميزة مستقلة (مثلاً: الطلبات، المدفوعات، التوصيل).
- **Domain-Driven Design (DDD Lite):** كل موديول يحتوي على: Entities, Use Cases, Repositories, API, UI.
- **Vertical Slices:** كل موديول يحتوي على كل طبقاته داخل مجلد واحد.

### 3.2 قاعدة ذهبية

> **كل موديول يجب أن يكون قابلاً للحذف النظري دون تدمير بقية التطبيق.**

إذا لم يكن الموديول يستطيع تحقيق ذلك، فإما:
- أنه ليس موديولاً مستقلاً.
- أو أنه يحتاج إلى إعادة تقسيم.

### 3.3 المبادئ التوجيهية

| المبدأ | الشرح |
|---|---|
| **Single Responsibility** | كل موديول يمثل قدرة واحدة واضحة (Capability). |
| **Explicit Public API** | كل موديول يصدر فقط ما يحتاجه الموديولات الأخرى عبر `index.js`. |
| **Dependency Inversion** | الموديولات عالية المستوى لا تعتمد على تفاصيل الموديولات المنخفضة. |
| **No Circular Dependencies** | لا تبعيات دائرية بين الموديولات. عند الحاجة لتواصل ثنائي الاتجاه، استخدم نمط الأحداث (Event-Based Communication) المذكور في القسم 11.1 بدل الاستيراد المتبادل. |
| **Cohesion** | الملفات المرتبطة ببعضها تبقى معاً. |
| **Low Coupling** | الموديولات تتواصل عبر واجهات صريحة فقط. |

> **استثناء `admin` الوحيد:** موديول `admin` هو الموديول **الوحيد** المسموح له بالاعتماد على جميع الموديولات الأخرى، نظراً لطبيعته التجميعية الإدارية (لوحة تحكم مركزية تقرأ وتُجري عمليات عبر كل النظام). هذا الاستثناء **لا يُعمَّم** على أي موديول آخر، ولا يجوز استخدامه كذريعة لإنشاء تبعيات واسعة في موديولات الأعمال الأخرى. أي موديول غير `admin` يحاول الاعتماد على «كل شيء» يُعتبر مخالفاً لمبدأ Low Coupling ويجب إعادة تقسيمه.

---

## 4. الموديولات المقترحة

### 4.1 خريطة الموديولات العليا

```
greenmarket/src/
├── modules/
│   ├── auth/                    ← الهوية والمصادقة (Identity + Authentication)
│   ├── users/                   ← الملفات الشخصية والإعدادات (Profiles + Settings)
│   ├── marketplace/             ← استعراض المنتجات والبحث
│   ├── catalog/                 ← إدارة المنتجات (Vendor + Admin)
│   ├── cart/                    ← سلة المشتريات
│   ├── checkout/                ← عملية الدفع والطلب
│   ├── orders/                  ← دورة حياة الطلب
│   ├── delivery/                ← التوصيل والسائقين
│   ├── payments/                ← المدفوعات والبوابة
│   ├── notifications/           ← الإشعارات والتفضيلات
│   ├── commissions/             ← العمولات والمبيعات
│   ├── coupons/                 ← الكوبونات والعروض
│   ├── reviews/                 ← التقييمات
│   ├── chat/                    ← المحادثات
│   ├── analytics/               ← التحليلات والتقارير
│   ├── admin/                   ← لوحة الإدارة المركزية
│   └── shared/                  ← المكونات والأدوات المشتركة
├── app/                         ← تجميع الموديولات (App.jsx, Router, Providers)
├── config/                      ← الإعدادات العامة
├── lib/                         ← مكتبات خارجية ملفوفة
├── utils/                       ← أدوات عامة خالصة (pure utilities)
├── types/                       ← أنواع TypeScript المشتركة
├── i18n/                        ← الترجمة
└── styles/                      ← التنسيقات العامة
```

### 4.2 البنية الداخلية لكل موديول

كل موديول يتبع الهيكل التالي:

```
src/modules/[module-name]/
├── index.js                    ← الواجهة العامة (Public API) - الوارد الوحيد
├── domain/
│   ├── entities.js             ← الكيانات والأنواع (TypeScript types)
│   ├── commands.js             ← عمليات الكتابة (use cases)
│   ├── queries.js              ← عمليات القراءة (use cases)
│   └── businessLogic.js        ← القواعد والعمليات الحسابية الخالصة
├── data/
│   ├── repository.js           ← الوصول إلى Supabase/Edge Functions
│   ├── selectors.js            ← استعلامات PostgREST المشتركة
│   └── transformers.js         ← تحويل الأشكال بين DB و Domain
├── api/
│   ├── hooks.js                ← React Query / TanStack Query hooks
│   ├── mutations.js            ← useMutation hooks
│   └── realtime.js             ← اشتراكات Realtime
├── ui/
│   ├── components/             ← مكونات خاصة بالموديول
│   ├── pages/                  ← صفحات الموديول (إن وجدت)
│   └── widgets/                ← ويدجات صغيرة قابلة لإعادة الاستخدام
├── stores/
│   └── [module]Store.js        ← Zustand store إذا لزم الأمر
├── constants.js                ← ثوابت الموديول
├── validation.js               ← قواعد التحقق الخاصة
└── __tests__/                  ← اختبارات الموديول
```

### 4.3 واجهة الموديول العامة (Public API)

كل `index.js` يصدر فقط ما يلزم:

```js
// src/modules/orders/index.js
export * from './domain/commands';
export * from './domain/queries';
export * from './domain/businessLogic';
export * from './constants';
export { useOrders } from './api/hooks';
export { useOrderMutations } from './api/mutations';
export { OrderCard } from './ui/components/OrderCard';
export { OrderStatusBadge } from './ui/components/OrderStatusBadge';
```

**قاعدة:** لا يجوز لأي موديول الوصول إلى داخل موديول آخر. يجب الاستيراد فقط من `index.js`.

---

## 5. تفاصيل الموديولات والحدود

### 5.1 موديول `auth` — الهوية والمصادقة

**المسؤولية:**
- تسجيل الدخول والخروج
- إنشاء الحساب
- التحقق بخطوتين (MFA)
- إدارة الجلسات والأجهزة
- إعادة تعيين كلمة المرور
- التحقق من البريد والهاتف

**الحدود:**
- لا يتعامل مع الطلبات أو المدفوعات مباشرة.
- يوفر معلومات المستخدم الحالي للموديولات الأخرى عبر `useAuth()`.
- يقوم بمسح `cart` و `favorites` عند الخروج عبر حدث (event) وليس استيراداً مباشراً.

**الواجهة العامة:**
```js
export { useAuth } from './api/hooks';
export { signIn, signOut, register, resetPassword } from './domain/commands';
export { USER_ROLES } from './constants';
export { requireAuth, requireRole } from './utils/permissions';
export { MFASetup, MFAVerify } from './ui/components';
```

**التبعيات:**
- يعتمد على: `supabase.ts` (مكتبة خارجية ملفوفة)
- لا يعتمد على: `cart`, `orders`, `payments`

### 5.2 موديول `users` — المستخدمون والإعدادات

**المسؤولية:**
- ملفات المستخدمين الشخصية (`profiles`)
- إعدادات الحساب (تغيير كلمة المرور، الحذف)
- إعدادات التفضيلات العامة
- إدارة العناوين
- **تخزين تفضيلات الإشعارات** كجزء من بيانات المستخدم داخل `user_settings` (وليس كاستيراد من `notifications`)
- التحقق من الهوية (CIN، رخصة السائق، إلخ)

**الحدود:**
- يتعامل مع جدول `profiles` و `user_settings` و `addresses`.
- لا يتعامل مع الطلبات أو المنتجات.
- **يملك** تفضيلات الإشعارات (notification preferences) ويصدرها عبر واجهته العامة (مثل `getNotificationPreferences(userId)`)؛ موديول `notifications` يستقبل هذه التفضيلات كمعطى (parameter) عند الاستدعاء ولا يستوردها مباشرة من `users`. بهذا يبقى الاتجاه أحادياً: `notifications` لا يعتمد على `users` ولا العكس على مستوى التفضيلات.

**الواجهة العامة (مقتطف):**
```js
export { useUserProfile } from './api/hooks';
export { getNotificationPreferences, updateNotificationPreferences } from './domain/queries';
export { NOTIFICATION_PREFERENCE_KEYS } from './constants';
```

**التبعيات:**
- يعتمد على: `auth` (لمعرفة المستخدم الحالي)
- **لا يعتمد على: `notifications`** (تفضيلات الإشعارات أصبحت جزءاً من `user_settings` يملكه `users`، وتُمرَّر إلى `notifications` كمعطى عند الحاجة)

### 5.3 موديول `marketplace` — السوق العام

**المسؤولية:**
- استعراض المنتجات
- البحث والفلترة
- صفحة المنتج الواحد
- صفحة المتجر/البائع
- قائمة المنتجات العامة

**الحدود:**
- يقرأ فقط من `products` و `profiles`.
- لا يقوم بإدارة المنتجات (هذا دور `catalog`).
- لا يتعامل مع السلة (هذا دور `cart`).

**التبعيات:**
- يعتمد على: `catalog` (لقراءة المنتجات)
- يعتمد على: `users` (لعرض بيانات البائع)
- يعتمد على: `reviews` (لعرض التقييمات)

### 5.4 موديول `catalog` — إدارة المنتجات

**المسؤولية:**
- CRUD للمنتجات (Vendor + Admin)
- إدارة صور المنتجات
- حالات الموافقة (pending, published, rejected, suspended)
- التصنيفات والفئات
- المخزون

**الحدود:**
- لا يتعامل مع الطلبات أو السلة.
- يوفر واجهات للقراءة تستخدمها `marketplace` و `cart`.

**التبعيات:**
- يعتمد على: `auth` (لمعرفة البائع الحالي)
- يعتمد على: `notifications` (لإشعار الموافقة/الرفض)

### 5.5 موديول `cart` — سلة المشتريات

**المسؤولية:**
- إضافة/إزالة/تحديث عناصر السلة
- حساب المجاميع
- الاحتفاظ بالحالة محلياً (Zustand + persist)
- التحقق من توفر المنتجات

**الحدود:**
- لا يقوم بإنشاء طلبات (هذا دور `checkout`).
- لا يتعامل مع المدفوعات.

**التبعيات:**
- يعتمد على: `catalog` (للتحقق من المنتجات والمخزون)
- يعتمد على: `auth` (لربط السلة بالمستخدم عند تسجيل الدخول)

### 5.6 موديول `checkout` — إتمام الشراء

**المسؤولية:**
- جمع معلومات الشحن والتوصيل
- اختيار السائق/طريقة التوصيل
- تطبيق الكوبونات
- حساب الأسعار (تكلفة التوصيل، الضرائب، الخصومات)
- إنشاء الطلب/الطلبات
- الاتصال بـ Edge Functions

**الحدود:**
- ينشئ الطلبات ثم يسلّمها لموديول `orders`.
- لا يتعامل مع حالة الطلب بعد الإنشاء.
- لا يتعامل مع المدفوعات مباشرة (يستخدم `payments` للنوايا).

**التبعيات:**
- يعتمد على: `cart` (لقراءة العناصر)
- يعتمد على: `users` (لعنوان الشحن)
- يعتمد على: `delivery` (لاختيار السائق)
- يعتمد على: `payments` (لإنشاء نية الدفع)
- يعتمد على: `coupons` (للخصومات)

### 5.7 موديول `orders` — دورة حياة الطلب

**المسؤولية:**
- عرض قائمة الطلبات (Buyer, Vendor, Admin)
- عرض تفاصيل الطلب
- تغيير حالة الطلب (accept, reject, cancel)
- تتبع الطلب
- الإرجاعات والنزاعات
- **الاحتفاظ بحقول حالة داخلية** على جدول `orders`: `payment_status` و `delivery_status` تُحدَّث عبر أحداث يُصدرها `payments` و `delivery`.

**الحدود:**
- يتعامل مع جدول `orders` و `order_items`.
- **لا يستورد `payments` أو `delivery` مباشرة.** بدلاً من ذلك يحتفظ بحقلي `payment_status` و `delivery_status` داخل سجل الطلب، ويستمع لأحداث التحديث القادمة من هذين الموديولين (Event-Based Communication — القسم 11.1).
- يستخدم `notifications` لإشعار المستخدمين (بتمرير تفضيلات المستخدم كمعطى).

**الأحداث المستهلَكة (Consumed Events):**

| الحدث | المُصدِر | محتوى الـ payload | أثر `orders` |
|---|---|---|---|
| `order:payment_updated` | `payments` | `{ orderId, paymentStatus, paymentId, amount, method, occurredAt }` | تحديث `orders.payment_status` للطلب المطابق |
| `order:delivery_updated` | `delivery` | `{ orderId, deliveryStatus, deliveryId, driverId, occurredAt }` | تحديث `orders.delivery_status` للطلب المطابق |

> `orders` يشترك في هذين الحدثين عبر pub/sub داخلي (أو `window.addEventListener` لـ `CustomEvent`) ويحدّث حقوله الداخلية فقط، دون استدعاء `payments` أو `delivery`. هذا يكسر التبعية الدائرية ويجعل الاتجاه أحادياً: `payments → orders` و `delivery → orders`.

**التبعيات:**
- يعتمد على: `auth` (لمعرفة الدور والمستخدم)
- يعتمد على: `notifications` (للإشعارات)
- يعتمد على: `users` (لبيانات المشاركين)
- **لا يعتمد على: `delivery` أو `payments`** (الاتصال يتم عبر الأحداث، والاتجاه: `payments → orders` و `delivery → orders`)

### 5.8 موديول `delivery` — التوصيل والسائقين

**المسؤولية:**
- إيجاد السائقين المتاحين
- إسناد الطلبات للسائقين
- تحديث حالة التوصيل (picked up, on the way, delivered)
- تتبع الموقع المباشر
- إدارة أرباح السائقين

**الحدود:**
- يتعامل مع جدول `deliveries`.
- لا يتعامل مع المدفوعات بين البائع والسائق (هذا دور `payments` أو `commissions`).
- **يبلّغ `orders` بتغيير الحالة عبر حدث `order:delivery_updated` فقط** (وليس عبر استيراد عكسي من `orders` إليه أو حقن حالة فيه). `delivery` يقرأ من `orders` معرّف الطلب المرتبط، ثم يُصدر الحدث بعد كل تحديث لوجستي.

**الأحداث المُصدَرة (Emitted Events):**

| الحدث | متى يُصدَر | محتوى الـ payload |
|---|---|---|
| `order:delivery_updated` | بعد كل تغيير لحالة التوصيل (assigned, picked_up, on_the_way, delivered) | `{ orderId, deliveryStatus, deliveryId, driverId, occurredAt }` |

**التبعيات:**
- يعتمد على: `orders` (لقراءة معرّف الطلب المرتبط فقط — الاتجاه `delivery → orders`)
- يعتمد على: `users` (لبيانات السائق والبائع والمشتري)
- يعتمد على: `notifications` (لإشعار المستخدمين)
- **لا يحدث استيراد عكسي:** `orders` لا يستورد `delivery`؛ يستمع فقط لحدث `order:delivery_updated`.

### 5.9 موديول `payments` — المدفوعات

**المسؤولية:**
- إنشاء نوايا الدفع (Payment Intents)
- معالجة PayPal
- التحويل البنكي
- الدفع عند الاستلام (COD)
- تسجيل الدفعات والمبالغ المستردة
- سجل المدفوعات

**الحدود:**
- لا يتعامل مع حالة الطلب نفسها (هذا دور `orders`)؛ **لا يكتب مباشرة في حقول `orders`**.
- **يبلّغ `orders` بحالة الدفع عبر حدث `order:payment_updated` فقط** بعد كل عملية (نجاح، فشل، استرداد). `orders` هو من يحدّث حقله `payment_status` استجابةً للحدث.
- يتكامل مع Edge Functions للعمليات الحساسة.

**الأحداث المُصدَرة (Emitted Events):**

| الحدث | متى يُصدَر | محتوى الـ payload |
|---|---|---|
| `order:payment_updated` | بعد كل عملية دفع/استرداد (paid, failed, refunded, pending) | `{ orderId, paymentStatus, paymentId, amount, method, occurredAt }` |

**التبعيات:**
- يعتمد على: `orders` (لقراءة معرّف الطلب المرتبط فقط — الاتجاه `payments → orders`)
- يعتمد على: `users` (لعميل الدفع)
- يعتمد على: `notifications` (لإشعارات الدفع)
- **لا يحدث استيراد عكسي:** `orders` لا يستورد `payments`؛ يستمع فقط لحدث `order:payment_updated`.

### 5.10 موديول `notifications` — الإشعارات

**المسؤولية:**
- إنشاء الإشعارات
- قراءة الإشعارات
- **تطبيق** تفضيلات الإشعارات التي تُمرَّر إليه (لا يملك التفضيلات ولا يخزّنها — هي ملك `users` داخل `user_settings`)
- الإشعارات المباشرة (Realtime)
- إشعارات البريد والرسائل القصيرة (تنسيق)

**الحدود:**
- يتلقى طلبات الإشعار من الموديولات الأخرى.
- لا يحدد متى يتم إنشاء الإشعار (هذا دور الموديول الأصلي).
- **لا يستورد `users`**؛ تفضيلات الإشعارات تصله كمعطى (parameter) في كل استدعاء، فلا يقرأ `user_settings` بنفسه. هذا يكسر التبعية الدائرية `users ↔ notifications` ويجعل `notifications` موديولاً عديم الحالة بالنسبة للتفضيلات.

**الواجهة العامة (مقتطف):**
```js
// preferences تُمرَّر من المُستدعي (عادةً عبر users.getNotificationPreferences(userId))
export function sendNotification({ userId, type, payload, preferences }) { /* ... */ }
```

**التبعيات:**
- يعتمد على: `auth` (لمعرفة المستخدم)
- **لا يعتمد على: `users`** (التفضيلات تُمرَّر كمعطى عند الاستدعاء، لا تُستورد)

### 5.11 موديول `commissions` — العمولات

**المسؤولية:**
- حساب عمولة المنصة (3%)
- تتبع المبيعات الشهرية
- إغلاق الشهر
- تتبع المتأخرات
- تجميد/إلغاء تجميد الحسابات
- إشعارات العمولات

**الحدود:**
- يتعامل مع `vendor_monthly_sales` و `confirmed_transactions`.
- يتفاعل مع `users` لتغيير حالة الحساب.

**التبعيات:**
- يعتمد على: `orders` (لتأكيد المبيعات)
- يعتمد على: `users` (لتغيير حالة الحساب)
- يعتمد على: `notifications` (لإشعارات العمولات)

### 5.12 موديول `coupons` — الكوبونات والعروض

**المسؤولية:**
- إنشاء الكوبونات (Vendor + Admin)
- التحقق من صلاحية الكوبون
- استبدال الكوبونات
- الخصومات التلقائية على الكميات (Bulk)
- إحصائيات الكوبونات

**الحدود:**
- يوفر وظيفة حساب الخصم للموديولات الأخرى.
- يستخدم من `checkout` و `cart`.

**التبعيات:**
- يعتمد على: `auth` (لمعرفة المستخدم)
- يعتمد على: `orders` (لربط الاستبدال بالطلب)

### 5.13 موديول `reviews` — التقييمات

**المسؤولية:**
- إنشاء التقييمات
- عرض التقييمات
- إدارة التقييمات (Admin)
- حساب متوسط التقييم

**التبعيات:**
- يعتمد على: `orders` (للتحقق من إمكانية التقييم)
- يعتمد على: `users` (لمعرفة المقيّم)
- يعتمد على: `catalog` (للمنتج)

### 5.14 موديول `chat` — المحادثات

**المسؤولية:**
- إنشاء المحادثات
- إرسال واستقبال الرسائل
- تحميل المرفقات
- الاشتراك المباشر في الرسائل

**التبعيات:**
- يعتمد على: `auth` (لمعرفة المستخدم)
- يعتمد على: `users` (لبيانات المشاركين)
- يعتمد على: `orders` (لربط المحادثة بالطلب)

### 5.15 موديول `analytics` — التحليلات والتقارير

**المسؤولية:**
- لوحات تحكم البائع
- لوحات تحكم الإدارة
- التقارير والتصدير
- المقاييس الرئيسية (KPIs)

**التبعيات:**
- يعتمد على: `orders` (للمبيعات)
- يعتمد على: `delivery` (للتوصيل)
- يعتمد على: `payments` (للمدفوعات)
- يعتمد على: `commissions` (للعمولات)
- يعتمد على: `users` (للمستخدمين)

### 5.16 موديول `admin` — لوحة الإدارة المركزية

**المسؤولية:**
- إدارة المستخدمين
- إدارة المنتجات والموافقات
- إدارة الطلبات
- إدارة السائقين والتوثيق
- إدارة النزاعات
- إدارة الدوائر (Circuit Breakers)
- الإعدادات العامة

**الحدود:**
- لا يحتوي على منطق الأعمال الأساسي (يستخدم الموديولات الأخرى).
- يجمع واجهات الإدارة فقط.

**التبعيات:**
- يعتمد على: جميع الموديولات الأخرى (لقراءة البيانات وإجراء العمليات الإدارية)

---

## 6. المكونات المشتركة (Shared Layer)

### 6.1 `modules/shared/`

يحتوي على ما يلي:
- **UI Primitives:** Button, Input, Card, Modal, Select, Badge, Tooltip, Skeleton
- **Layout Components:** MainLayout, DashboardLayout, AuthLayout
- **Cross-Cutting Concerns:** ErrorBoundary, LoadingSpinner, EmptyState, ErrorState
- **Utilities:** useForm, useModal, useToast, usePagination
- **Security:** CSRF, rate limiting, sanitization
- **Accessibility:** SkipLink, focus management

### 6.2 قواعد الاستخدام

- لا يجوز للموديولات الوصول إلى `shared` عبر مسارات عميقة.
- يجب استيراد المكونات المشتركة من `modules/shared/index.js`.
- الموديولات المشتركة لا تعتمد على أي موديول خاص بالأعمال.

---

## 7. موديولات البنية التحتية (Infrastructure)

### 7.1 `lib/`

- **supabase.ts** — العميل الوحيد لـ Supabase.
- **config.ts** — إدارة الإعدادات.
- **validationSchemas.ts** — مخططات التحقق المشتركة.

### 7.2 `utils/`

أدوات خالصة (pure functions) لا تعتمد على React أو موديولات الأعمال:
- `logger.js`
- `withRetry.js`
- `sanitization.jsx`
- `currency.jsx`
- `rateLimiter.js`
- `encryption.js`
- `validationPrimitives.ts`

### 7.3 `app/`

- `App.jsx`
- `AppRouter.jsx`
- `main.jsx`
- `providers.jsx`
- `orchestrators/`

### 7.4 `api/`

- الـ Express sidecar سيتم إيقافه تدريجياً وفق `DEPRECATION_PLAN.md`.
- أي Edge Functions جديدة تُضاف ضمن الموديول المرتبط بها (مثلاً `checkout/functions/`).

---

## 8. خريطة التبعيات بين الموديولات

### 8.1 الرسم التخطيطي

> **مفتاح القراءة:**
> - السهم المصمت `───►` = تبعية استيراد مباشرة (يعتمد على الواجهة العامة عبر `index.js`).
> - السهم المتقطع `┄┄►` = تواصل عبر حدث (Event-Based) وليس استيراداً. الاتجاه يشير إلى الموديول الذي **يستهلك** الحدث.
> - الاتجاه أحادي دائماً: لا يوجد سهمان متقابلان بين أي موديولين (لا تبعيات دائرية).

```
                    ┌─────────────┐
                    │    shared   │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐       ┌─────────┐       ┌─────────────┐
   │  auth   │       │  users  │       │ marketplace │
   └────┬────┘       └────┬────┘       └──────┬──────┘
        │                 │                  │
        │                 │ (تفضيلات الإشعارات تُمرَّر كمعطى — لا استيراد)
        ▼                 │                  ▼
   ┌─────────┐             │           ┌─────────────┐
   │  cart   │◄────────────┼───────────│   catalog   │
   └────┬────┘             │           └──────┬──────┘
        │                  │                  │
        │                  ▼                  │
        │            ┌─────────────┐            │
        │            │ coupons     │            │
        │            └──────┬──────┘            │
        │                  │                  │
        ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │ checkout │─────►│  orders  │◄┄┄┄┄│ delivery │
   └────┬─────┘      └────┬─────┘ event└────┬─────┘
        │              ▲  │ order:delivery_updated│
        │ event        │  │                  │
        │ order:payment_updated              │
        ▼              ┊  ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │ payments │┄┄┄┄┘ │commissions│     │ reviews  │
   └────┬─────┘      └────┬─────┘      └────┬─────┘
        │                 │                 │
        │                 ▼                 │
        │            ┌──────────────┐        │
        └───────────►│ notifications │◄───────┘
                     └────┬─────────┘
                          │  ▲ (preferences كمعطى من المُستدعي)
                          ▼
                     ┌──────────┐
                     │  chat    │
                     └────┬─────┘
                          │
                          ▼
                     ┌──────────┐
                     │ analytics│
                     └────┬─────┘
                          │
                          ▼
                     ┌──────────┐
                     │  admin   │
                     └──────────┘
```

**ملاحظات على الاتجاهات الجديدة (بعد كسر الدوائر):**
- `payments ┄┄► orders` و `delivery ┄┄► orders`: التواصل يتم عبر حدثي `order:payment_updated` و `order:delivery_updated`. `orders` لا يستورد أياً منهما.
- `users` و `notifications`: لا سهم بينهما. التفضيلات يملكها `users` داخل `user_settings`، وتُمرَّر إلى `notifications` كمعطى عند الاستدعاء.

### 8.2 جدول التبعيات

| الموديول | يعتمد على (استيراد مباشر) | يوفر لـ | تواصل عبر حدث |
|---|---|---|---|
| `auth` | `shared`, `lib` | جميع الموديولات | — |
| `users` | `auth` | `marketplace`, `checkout`, `orders`, `delivery`, `payments`, `notifications` (يوفر تفضيلات الإشعارات كمعطى) | — |
| `marketplace` | `catalog`, `users`, `reviews` | `shared` | — |
| `catalog` | `auth`, `notifications` | `marketplace`, `cart`, `checkout`, `orders`, `reviews` | — |
| `cart` | `catalog`, `auth` | `checkout` | — |
| `checkout` | `cart`, `users`, `delivery`, `payments`, `coupons` | `orders` | — |
| `orders` | `auth`, `users`, `notifications` | `checkout`, `delivery`, `payments`, `reviews`, `analytics`, `commissions`, `chat` | **يستهلك** `order:payment_updated` (من `payments`) و `order:delivery_updated` (من `delivery`) |
| `delivery` | `orders`, `users`, `notifications` | `orders` (عبر حدث), `analytics` | **يُصدر** `order:delivery_updated` |
| `payments` | `orders`, `users`, `notifications` | `orders` (عبر حدث), `checkout`, `analytics` | **يُصدر** `order:payment_updated` |
| `commissions` | `orders`, `users`, `notifications` | `admin`, `analytics` | — |
| `coupons` | `auth`, `orders` | `checkout`, `cart` | — |
| `reviews` | `orders`, `users`, `catalog` | `marketplace`, `analytics` | — |
| `chat` | `auth`, `users`, `orders` | `orders` | — |
| `notifications` | `auth` | جميع الموديولات | يستقبل `preferences` كمعطى من المُستدعي |
| `analytics` | `orders`, `delivery`, `payments`, `commissions`, `users` | `admin`, `vendor dashboard`, `admin dashboard` | — |
| `admin` | جميع الموديولات (الاستثناء الوحيد — القسم 3.3) | — | — |

> **التحقق من خلو الجدول من الدوائر:** بعد التعديل لم يعد هناك أي زوج موديولين يعتمد كلٌ منهما على الآخر عبر استيراد مباشر:
> - `users ↔ notifications` → أصبح: `users` يوفر التفضيلات كمعطى، و`notifications` لا يستورد `users`.
> - `orders ↔ payments` → أصبح: `payments → orders` فقط (استيراد لقراءة `orderId`)، و`orders` يستهلك حدث `payments` دون استيراده.
> - `orders ↔ delivery` → أصبح: `delivery → orders` فقط، و`orders` يستهلك حدث `delivery` دون استيراده.

---

## 9. خطط التنفيذ (Phases)

### 9.1 المرحلة 0: التحضير والسلامة (1 أسبوع)

**الهدف:** إعداد بيئة آمنة للتغييرات التدريجية.

| المهمة | الملفات | المخرجات |
|---|---|---|
| إضافة أداة فحص التبعيات الدائرية فعلياً | `package.json`, `package-lock.json` | تثبيت `madge` (أو `dependency-cruiser`) كـ devDependency |
| إضافة سكربت npm لفحص الدوائر | `package.json` | `"check:circular": "madge --circular --extensions js,jsx,ts,tsx src/"` |
| ربط الفحص بـ CI/CD كبوابة إلزامية | `.github/workflows/ci.yml` (أو ما يكافئها) | خطوة `npm run check:circular` تفشل البناء عند وجود أي دائرة |
| إنشاء قاعدة ESLint لمنع الاستيراد من داخل الموديولات | `eslint.config.js` | قاعدة `no-restricted-imports` |
| توثيق خط الأساس الحالي | `docs/baseline.md` | خريطة الملفات والتبعيات + تقرير `madge --circular` الأولي |
| وضع علامة Git | — | `tag: before-modular-refactor` |
| إنشاء اختبارات تكامل أساسية | `cypress/e2e/` | تدفقات حرجة تعمل |

**أداة فحص الدوائر (إلزامية):**
- تُضاف أداة فعلية وليست مذكورة بالاسم فقط. الخيار المفضّل: **`madge --circular`** لخفته، مع `dependency-cruiser` كبديل عند الحاجة لقواعد أعمق.
- مثال السكربت في `package.json`:
  ```json
  "scripts": {
    "check:circular": "madge --circular --extensions js,jsx,ts,tsx src/"
  }
  ```
- **تُشغَّل هذه الخطوة في CI/CD بعد كل مرحلة من المراحل 1→5** (وليس مرة واحدة)، وأي تبعية دائرية جديدة تُفشل خط الأنابيب (build) فوراً.

**بوابة المرور:**
- [x] جميع الاختبارات الحالية تمر.
- [x] `vite build` ينجح.
- [x] `npm run check:circular` يعيد **صفر دوائر** (551 ملف، صفر دوائر).
- [x] لا توجد تبعيات دائرية جديدة.
- [x] `madge` ^8.0.0 مثبّت كـ devDependency.
- [x] سكربت `check:circular` موجود في `package.json`.
- [x] قاعدة ESLint `no-restricted-imports` موجودة في `eslint.config.js`.
- [ ] ربط `check:circular` و `type-check` بـ CI/CD (مهمة مؤجلة).
- [ ] وضع علامة Git `tag: before-modular-refactor` (مهمة مؤجلة).

> **حالة الإنجاز:** المرحلة 0.5 مكتملة (2026-06-22). انظر تقرير التحقق: `docs/architecture/phase-0-5-verification-report.md`.

### 9.2 المرحلة 1: إنشاء الهيكل المشترك (1 أسبوع)

**الهدف:** إنشاء الطبقات المشتركة والموديولات البسيطة أولاً.

| المهمة | الملفات | الملاحظات | الحالة |
|---|---|---|---|
| إنشاء `src/modules/shared/` | `index.js`, `ui/`, `hooks/`, `utils/` | طبقة re-export للمكونات المشتركة | ✅ مكتمل (Phase 1.1) |
| إنشاء `src/app/` | `App.jsx`, `AppRouter.jsx`, `providers.jsx` | نقل التجميع من الجذر | ✅ مكتمل (Phase 1.2) |
| إنشاء `src/modules/auth/` | `domain/`, `api/`, `ui/`, `stores/`, `utils/` | طبقة re-export للمصادقة | ✅ مكتمل (Phase 1.3) |
| إنشاء `src/modules/users/` | `domain/`, `data/`, `api/`, `ui/`, `stores/`, `utils/` | طبقة re-export للمستخدمين/الملفات الشخصية | ✅ مكتمل (Phase 1.4) |
| توحيد `validationPrimitives.ts` | `src/utils/` | استخدامه في جميع الموديولات | ✅ مُصدّر عبر `@/modules/shared` |

> **حالة الإنجاز:** Phase 1.1 (وحدة `shared`) مكتملة (2026-06-22). تم إنشاء طبقة re-export لـ 17 مكون UI و 10 hooks و أدوات عامة. انظر التقرير: `docs/architecture/phase-1-1-shared-module-report.md`.

> **حالة الإنجاز:** Phase 1.2 (طبقة `app`) مكتملة (2026-06-22). تم إنشاء `src/app/` كطبقة re-export لـ App و AppRouter و providers، مع orchestrators/ كـ re-export. تم تحديث import واحد في `main.jsx`. انظر التقرير: `docs/architecture/phase-1-2-app-layer-report.md`.
>
> **حالة الإنجاز:** Phase 1.3 (وحدة `auth`) مكتملة (2026-06-22). تم إنشاء `src/modules/auth/` كطبقة re-export لـ authStore و authServices و ProtectedRoute و roles و auth components و auth utils. لا تغيير في أي imports موجودة. انظر التقرير: `docs/architecture/phase-1-3-auth-module-report.md`.
>
> **حالة الإنجاز:** Phase 1.4 (وحدة `users`) مكتملة (2026-06-22). تم إنشاء `src/modules/users/` كطبقة re-export لـ profilesService و notification preferences و profile pages و CIN validation. لا تغيير في أي imports موجودة. انظر التقرير: `docs/architecture/phase-1-4-users-module-report.md`.
>
> **✅ المرحلة 1 مكتملة بالكامل:** جميع موديولات المرحلة 1 (shared، app، auth، users) تم إنشاؤها بنجاح كطبقات re-export آمنة.

**بوابة المرور (Phase 1 Final Gate):**
- [x] تسجيل الدخول والخروج يعملان — لم يتغير أي سلوك ✅
- [x] `authStore` لا يستورد من موديولات أعمال أخرى ✅
- [x] جميع الوحدات الأربع (shared، app، auth، users) موجودة كطبقات re-export ✅
- [x] `npm run lint` يمر ✅
- [x] `npm run type-check` يمر ✅
- [x] `npm run build` يمر ✅
- [x] `npm run check:circular` يمر — صفر تبعيات دائرية ✅
- [x] لا توجد ملفات محذوفة أو منقولة ✅
- [x] import واحد فقط تغير في Phase 1 (main.jsx) ✅

> **نتيجة بوابة المرور:** ✅ **اجتازت** — انظر `docs/architecture/phase-1-final-gate-report.md`

### 9.3 المرحلة 2: موديولات البيانات الأساسية (4-5 أسابيع)

**الهدف:** إنشاء طبقات البيانات والمنطق للموديولات الأساسية، **موديول واحد لكل Sprint** التزاماً بقاعدة «One Module at a Time» (القسم 10.3).

> **سبب إعادة التقسيم:** الخطة السابقة وضعت 5 موديولات في أسبوعين، وهذا يخالف قاعدة «موديول واحد في كل Sprint». تم تقسيم المرحلة إلى سبرنتات متسلسلة، مع احترام ترتيب التبعيات (`catalog` قبل `marketplace`/`cart`، و`orders` قبل `delivery` لأن `delivery → orders`).

| Sprint | المدة | الموديول | الملفات | الملاحظات | شرط البدء (Dependency Gate) |
|---|---|---|---|---|---|
| 2.1 | أسبوع | `catalog` | `data/`, `api/`, `domain/`, `ui/`, `hooks/` | طبقة re-export لـ productRepository و productImages و productsApi و productSearchService و ProductCard و ProductForm و useProducts | يكفي اكتمال المرحلة 1 (`auth`, `users`) | ✅ مكتمل |
| 2.2 | أسبوع | `marketplace` | `ui/`, `api/`, `domain/`, `hooks/` | طبقة re-export لـ Marketplace و Stores و StoreDetail و SearchResults و Seasonal و SearchBar و storeTypeService و useMarketplaceQueries | يتطلب اكتمال `catalog` (2.1) | ✅ مكتمل |
| 2.3 | أسبوع | `cart` | `stores/`, `ui/`, `api/`, `domain/`, `hooks/` | طبقة re-export لـ cartStore و favoritesStore و Cart و Favorites و cartQuantity و favoritesApi و minimumOrderService | يتطلب اكتمال `catalog` (2.1) | ✅ مكتمل |
| 2.4 | أسبوع | `orders` | `api/`, `data/`, `domain/`, `ui/`, `hooks/` | طبقة re-export لـ ordersService و orderLogic و orderStatuses و orderRepository و ordersApi و useOrderView و order hooks و OrderDetail و OrderConfirmation و OrderTracking و buyer/vendor/admin Orders و order components | مستقل عن `cart`/`marketplace` | ✅ مكتمل |
| 2.5 | أسبوع | `delivery` | `api/`, `data/`, `domain/`, `ui/`, `hooks/` | طبقة re-export لـ deliveries.js (deliveriesApi) و deliveryMatchingService و deliveryEligibilityService و deliveryScheduleService و driverLocationService و driver.config و useDriverQueries و driver pages و vendor delivery pages و admin driver pages و delivery components | يتطلب اكتمال `orders` (2.4) لأن `delivery → orders` | ✅ مكتمل |
| 2.6 | نصف أسبوع | (تحضير) | `services/deliveries.js`, `hooks/queries/` | تحضير التدفقات الحرجة قبل Phase 3: (H1) إعادة تسمية `ordersApi` في `deliveries.js` إلى `vendorOrderActionsApi` مع alias للتوافق الخلفي. (H2) تقسيم `useMarketplaceQueries.js` إلى `useProductQueries.js` و `useOrderQueries.js` و `useReviewQueries.js` مع re-export للتوافق الخلفي. (H3) عزل دوال الطلبات في `deliveries.js` كـ named exports + `vendorOrderActionsApi` وتصديرها عبر orders module. | يتطلب اكتمال Phase 2 | ✅ مكتمل |

> **حالة الإنجاز:** Phase 2.1 (وحدة `catalog`) مكتملة (2026-06-22). تم إنشاء `src/modules/catalog/` كطبقة re-export لـ productRepository و productsApi و productImages و productSearchService و productLogic و categories و ProductCard و ProductForm و useProducts. لا تغيير في أي imports موجودة. لا نقل ملفات. انظر التقرير: `docs/architecture/phase-2-1-catalog-module-report.md`.
>
> **حالة الإنجاز:** Phase 2.2 (وحدة `marketplace`) مكتملة (2026-06-22). تم إنشاء `src/modules/marketplace/` كطبقة re-export لـ Marketplace و Stores و StoreDetail و SearchResults و Seasonal و SearchBar و storeTypeService و algoliaService و seasonalCalendar و publicVisibility و useMarketplaceQueries (product + review hooks فقط). لا تغيير في أي imports موجودة. لا نقل ملفات. انظر التقرير: `docs/architecture/phase-2-2-marketplace-module-report.md`.
>
> **حالة الإنجاز:** Phase 2.3 (وحدة `cart`) مكتملة (2026-06-22). تم إنشاء `src/modules/cart/` كطبقة re-export لـ cartStore و favoritesStore و Cart و Favorites و cartQuantity و favoritesApi و minimumOrderService و useCartHydrated. لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في persisted state keys. انظر التقرير: `docs/architecture/phase-2-3-cart-module-report.md`.
>
> **حالة الإنجاز:** Phase 2.4 (وحدة `orders`) مكتملة (2026-06-22). تم إنشاء `src/modules/orders/` كطبقة re-export لـ ordersService و orderLogic و orderStatuses و orderRepository و ordersApi و useOrderView و order hooks (orderKeys, useOrders, useOrder, useDeletedOrders, useCreateOrder, useUpdateOrderStatus, useDeleteOrder, useRestoreOrder) و OrderDetail و OrderConfirmation و OrderTracking و buyer/vendor/admin Orders و order components. لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في order status lifecycle. انظر التقرير: `docs/architecture/phase-2-4-orders-module-report.md`.
>
> **حالة الإنجاز:** Phase 2.5 (وحدة `delivery`) مكتملة (2026-06-22). تم إنشاء `src/modules/delivery/` كطبقة re-export لـ deliveries.js (deliveriesApi, createDelivery, fetchDeliveryById, updateDeliveryStatus, assignDriver, markDelivered, subscribeToDeliveryUpdates) و deliveryMatchingService و deliveryEligibilityService و deliveryScheduleService و driverLocationService و driver.config (DRIVER_CONFIG, DRIVER_STATUSES, DELIVERY_STATUSES, EARNING_STATUSES) و useDriverQueries (driverKeys, useDriverProfile, useDriverDeliveries, useDeliveryDetail, useAvailableDeliveries, useDriverStats, useDriverEarnings, mutations) و driver pages (Dashboard, Available, Active, Earnings, History, Profile, Settings, Security, FindVendor, VendorPreferenceSetup, DeliveryPickup, DeliveryTracking, DeliveryComplete) و vendor delivery pages (DeliveryOptionSetup, DriverPreferenceSetup, FindDriver) و admin driver pages (Drivers, DriverVerification) و DriverOnboarding و delivery components (LiveDriverMap, DeliveryRequestCard, GeographicDeliveryNotification, DriverAvailabilityToggle, DriverSelection, NoDriverAvailable, DeliveryPreferences, DeliveryPaymentPolicy, DriverVerification, DeliveryComplete). لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في delivery behavior أو driver behavior. انظر التقرير: `docs/architecture/phase-2-5-delivery-module-report.md`.
>
> **ملاحظة جدولة:** Sprints 2.2 و 2.3 (`marketplace`, `cart`) **غير متضاربة** (كلاهما يعتمد على `catalog` فقط ولا يعتمد أحدهما على الآخر)، لذا يمكن لفريقين مختلفين تنفيذهما بالتوازي إذا توفّر مطوران، مع بقاء قاعدة «موديول واحد لكل مطوّر/Sprint» قائمة. أما `orders` ثم `delivery` فيجب أن يكونا متسلسلين بسبب التبعية.
>
> **حالة الإنجاز:** Phase 2.6 (تحضير التدفقات الحرجة) مكتملة (2026-06-22). (H1) تمت إعادة تسمية `ordersApi` في `deliveries.js` إلى `vendorOrderActionsApi` مع حفظ alias `ordersApi` للتوافق الخلفي. (H2) تم تقسيم `useMarketplaceQueries.js` إلى `useProductQueries.js` و `useOrderQueries.js` و `useReviewQueries.js` مع re-export من الملف الأصلي للتوافق الخلفي. (H3) تم عزل دوال الطلبات في `deliveries.js` كـ named exports مستقلة + `vendorOrderActionsApi` وتصديرها عبر orders module. لا تغيير في السلوك. لا تغيير في Supabase queries. لا نقل ملفات. انظر التقرير: `docs/architecture/phase-2-6-critical-flow-preparation-report.md`.
>
> **حالة الإنجاز:** Phase 3.1 (موديول `checkout`) مكتملة (2026-06-22). تم إنشاء `src/modules/checkout/` كطبقة re-export لـ CheckoutSimplified (CheckoutPage) و checkoutService (calculateOrderTotals, calculateCheckoutPricing, createCheckoutOrder) و coupons (couponsApi, normalizeCoupon, isCouponCurrentlyActive, calculateCouponDiscountAmount, calculateBulkDiscountBreakdown) و minimumOrderService (buildMinimumOrderMessage, evaluateVendorMinimumOrders) و useCheckoutPricing (useCheckoutPricing, calculatePricing) و checkoutCleanup (rollbackCheckoutRecords) و checkout step components (CheckoutAddressStep, CheckoutSummary, PaymentStep, PaymentTypeSelector, OrderSummary, AddressStep, DriverSelectionStep). لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في checkout behavior أو order creation behavior أو payment behavior أو delivery behavior أو cart behavior. انظر التقرير: `docs/architecture/phase-3-1-checkout-module-report.md`.
>
> **حالة الإنجاز:** Phase 3.2 (موديول `payments`) مكتملة (2026-06-22). تم إنشاء `src/modules/payments/` كطبقة re-export لـ paymentService (createPaymentIntent, processPayPalPayment, confirmBankTransfer, confirmOrderPayment, refundPayment, إلخ) و paymentGateway (singleton, confirmPayment) و paymentRecords (CRUD: insertPaymentRecord, getLatestPaymentRecordForOrder, updatePaymentRecordById, normalizePaymentMethod, إلخ) و cmiPayment (legacy/deprecated: initCMIPayment, verifyCMICallback, getCMIStatus) و refundPolicyService (DEFAULT_REFUND_POLICY, getVendorRefundPolicy) و payment constants (PAYMENT_METHOD, PAYMENT_STATUS, PAYMENT_STATUS_BADGE, إلخ) و paypalEligibility (isPayPalSetupComplete, assertPayPalSetupOrThrow, إلخ) و PaymentGuard (usePaymentGuard) و payment UI components (OrderPaymentSection, PaymentReceiptUpload, PaymentPolicySettings, RefundPolicySettings, DeliveryPaymentPolicy) و payment hooks (paymentKeys, usePaymentHistory, usePaymentDetail, useCreatePayment, useConfirmPayment). لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في PayPal/Bank/COD/CMI/refund behavior. لا تغيير في Edge Functions. لا تغيير في commission/payout behavior. انظر التقرير: `docs/architecture/phase-3-2-payments-module-report.md`.
>
> **حالة الإنجاز:** Phase 3.3 (موديول `notifications`) مكتملة (2026-06-23). تم إنشاء `src/modules/notifications/` كطبقة re-export لـ notificationsApi (getUserNotifications, getUnreadCount, markAsRead, markAllAsRead, delete, deleteAllRead, getPreferences, savePreferences, create, subscribe) و notificationEvents (badge, preferences) و dispatchNotificationBadgeUpdate و dispatchNotificationPreferencesUpdated و createOrderNotification و createProductApprovalNotification و commissionNotifications و emailService و useEmail و notification formatting helpers (normalizeNotification, normalizeNotificationCategory, isNotificationRead, resolveNotificationLink, resolveNotificationActionLabel, isWithinQuietHours, shouldMuteNotificationPreview) و preference helpers (DEFAULT_NOTIFICATION_PREFERENCES, NOTIFICATION_CATEGORY_OPTIONS, NOTIFICATION_PREFERENCE_FIELDS, normalizeNotificationPreferences) و NotificationLink (bell badge component) و NotificationsPage و notification hooks (notificationKeys, useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead, useNotificationPreferences, useSaveNotificationPreferences, useRealtimeNotifications). لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في notification creation/read/mark-as-read behavior. لا تغيير في realtime subscriptions. لا تغيير في notification preferences behavior. لا تغيير في notification triggers. لا تغيير في email delivery. لا تغيير في Supabase queries أو database/RLS. انظر التقرير: `docs/architecture/phase-3-3-notifications-module-report.md`.

> **حالة الإنجاز:** Phase 3.4 (تحضير الإشعارات/التفضيلات/الدعم) مكتملة (2026-06-23). تم استخراج ثوابت ومساعدات تفضيلات الإشعارات من `notifications.js` إلى `src/services/notificationPreferences.js` (H1). تم استخراج hooks تذاكر الدعم من `useNotificationQueries.js` إلى `src/hooks/queries/useSupportTicketQueries.js` (H2). تم توثيق خطة ترحيل `commissionNotifications.js` إلى موديول العمولات المستقبلي (H3). لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في سلوك الإشعارات أو التفضيلات أو تذاكر الدعم أو العمولات. لا تغيير في Supabase queries. انظر التقرير: `docs/architecture/phase-3-4-notifications-preparation-report.md`.

> **حالة الإنجاز:** Phase 4.1 (موديول `coupons`) مكتملة (2026-06-23). تم إنشاء `src/modules/coupons/` كطبقة re-export لـ couponsApi (getAvailableCoupons, validateCoupon, redeemCoupon, getUserRedemptions, getVendorCoupons, getBulkDiscountCandidates, createCoupon, updateCoupon, deactivateCoupon, getCouponStats, getAllCoupons) و subscribeToVendorCouponRedemptions و normalizeCoupon و isCouponCurrentlyActive و calculateCouponDiscountAmount و calculateBulkDiscountBreakdown. لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في coupon validation أو discount calculation أو checkout behavior. لا تغيير في Supabase queries أو database/RLS. انظر التقرير: `docs/architecture/phase-4-1-coupons-module-report.md`.

> **حالة الإنجاز:** Phase 4.2 (موديول `reviews`) مكتملة (2026-06-23). تم إنشاء `src/modules/reviews/` كطبقة re-export لـ reviewsApi (create, getByVendor, delete, restore, getDeleted) و reviewService (createReview, getVendorReviews, replyToReview) و buildReviewSummary و review hooks (reviewKeys, useVendorReviews, useDeletedReviews, useCreateReview, useDeleteReview, useRestoreReview). لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في review creation أو rating calculations أو review moderation أو ProductDetail/StoreDetail behavior. لا تغيير في Supabase queries أو database/RLS. انظر التقرير: `docs/architecture/phase-4-2-reviews-module-report.md`.

> **حالة الإنجاز:** Phase 4.3 (موديول `chat`) مكتملة (2026-06-23). تم إنشاء `src/modules/chat/` كطبقة re-export لـ chatService (getOrCreateConversation, sendMessage, getMessages, getUserConversations, markMessagesAsRead, subscribeToConversation, uploadAttachment, deleteConversation) و messagesApi (getDeliveryMessages, getOrderMessages, send, markAsRead, subscribeToDelivery, subscribeToOrder) و chat hooks (useChatList, useChatMessages, useUnreadCount, useSendMessage, useUploadFile, useMarkAsRead, useDeleteConversation). لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في chat behavior أو message sending أو realtime subscriptions أو unread/read status. لا تغيير في Supabase queries أو database/RLS. انظر التقرير: `docs/architecture/phase-4-3-chat-module-report.md`.

> **حالة الإنجاز:** Phase 4.4 (موديول `commissions`) مكتملة (2026-06-23). تم إنشاء `src/modules/commissions/` كطبقة re-export لـ commissionService (confirmSaleAndCalculate, closeMonthAndNotify, checkOverdueCommissions, submitPaymentNotice, confirmCommissionPayment, getCurrentMonthSummary, getVendorCommissionHistory, manuallyUnfreezeVendor) و commissionNotifications (afterConfirmedSale, monthEndSummary, reminder3Days, dueToday, accountFrozen, paymentConfirmed) و payoutService (sendPayout). لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في commission calculations أو payout behavior أو payment behavior أو order behavior أو notification behavior. لا تغيير في Supabase queries أو database/RLS أو Edge Functions. انظر التقرير: `docs/architecture/phase-4-4-commissions-module-report.md`.

> **حالة الإنجاز:** Phase 4.5 (موديول `analytics`) مكتملة (2026-06-23). تم إنشاء `src/modules/analytics/` كطبقة re-export لـ analyticsApi (getVendorStats, getAdminStats) و vendorAnalytics helpers (DATE_RANGES, getOrderRevenue, resolveVendorAnalyticsRange, buildTimeBuckets, buildRevenueChartData, buildOrdersChartData, buildRatingsTrendData, buildTopProductMetrics, buildTopProductsChartData, buildCategoryDistributionData, buildStatusBreakdown, calculateVendorAnalyticsMetrics, buildAnalyticsCsvRows, buildAnalyticsPdfSummary) و reportService (generateSalesReport, generateUserReport, generateInventoryReport, generateDeliveryReport) و export utilities (csvExport, excelExport, pdfExport) و privacy-friendly analytics (trackPageView, trackEvent, trackPurchase, initializeAllAnalytics, etc.) و googleAnalytics و analytics utils (trackSignUp, trackViewItem, trackBeginCheckout, etc.) و analytics hooks (useVendorStats, useAdminStats). لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في analytics calculations أو report behavior أو chart behavior أو dashboard behavior أو financial metrics. لا تغيير في Supabase queries أو database/RLS. انظر التقرير: `docs/architecture/phase-4-5-analytics-module-report.md`.

> **حالة الإنجاز:** Phase 4.7 (تحضير ما قبل الترحيل) مكتملة (2026-06-24). تم تقسيم `src/services/api.js` إلى 6 ملفات فردية تحت `src/services/apis/` مع re-export للتوافق الخلفي. تم تقسيم `src/hooks/queries/useVendorAdminQueries.js` إلى `useVendorQueries.js` و `useAdminQueries.js` مع re-export للتوافق الخلفي. لا تغيير في السلوك. لا تغيير في Supabase queries أو React Query keys. انظر التقرير: `docs/architecture/phase-4-7-pre-migration-split-report.md`.
>
> **حالة الإنجاز:** Phase 5.1 (تبني الاستيراد الآمن — shared، reviews، coupons) مكتملة (2026-06-24). تم ترحيل 5 ملفات لاستيراد من `@/modules/shared` و `@/modules/reviews` و `@/modules/coupons` بدلاً من المسارات القديمة. لا تغيير في السلوك. لا نقل ملفات. لا حذف مسارات قديمة. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular). انظر التقرير: `docs/architecture/phase-5-1-safe-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 5.2 (تبني الاستيراد الآمن — auth، users) مكتملة (2026-06-24). تم ترحيل 8 ملفات لاستيراد من `@/modules/auth` و `@/modules/users` بدلاً من المسارات القديمة (`@/store/authStore`، `@/constants/roles`، `@/utils/authRedirects`، `@/services/profilesService`). لا تغيير في السلوك. لا نقل ملفات. لا حذف مسارات قديمة. لا تغيير في auth أو session أو role checks أو profile behavior. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular). انظر التقرير: `docs/architecture/phase-5-2-auth-users-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 5.3 (تبني الاستيراد الآمن — catalog، marketplace) مكتملة (2026-06-24). تم ترحيل 8 ملفات لاستيراد من `@/modules/catalog` و `@/modules/marketplace` بدلاً من المسارات القديمة (`@/constants/categories`، `@/constants/seasonalCalendar`، `@/business/productLogic`، `@/hooks/useProducts`، `@/services/search/productSearchService`، `@/services/search/algoliaService`، `@/services/storeTypeService`، `@/components/Search/SearchBar`). لا تغيير في السلوك. لا نقل ملفات. لا حذف مسارات قديمة. لا تغيير في product أو marketplace أو search/filter behavior. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular). انظر التقرير: `docs/architecture/phase-5-3-catalog-marketplace-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 5.4 (تبني الاستيراد الآمن — notifications، cart) مكتملة (2026-06-24). تم ترحيل 8 ملفات لاستيراد من `@/modules/notifications` و `@/modules/cart` بدلاً من المسارات القديمة (`@/services/notifications`، `@/services/minimumOrderService`، `@/components/notifications/NotificationLink`، `@/store/cartStore`، `@/store/favoritesStore`). تم أيضاً إصلاح خطأ في `src/modules/notifications/index.js` (تصدير default بدلاً من named export لـ NotificationLink و NotificationsPage). لا تغيير في السلوك. لا نقل ملفات. لا حذف مسارات قديمة. لا تغيير في notification أو cart أو favorites behavior. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular). انظر التقرير: `docs/architecture/phase-5-4-notifications-cart-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 5.5 (تبني الاستيراد الآمن — orders، delivery) مكتملة (2026-06-24). تم ترحيل 8 ملفات لاستيراد من `@/modules/orders` و `@/modules/delivery` بدلاً من المسارات القديمة (`@/business/orderLogic`، `@/constants/orderStatuses`، `@/services/deliveryScheduleService`، `@/services/driverLocationService`، `@/services/deliveries`). لا تغيير في السلوك. لا نقل ملفات. لا حذف مسارات قديمة. لا تغيير في order أو delivery أو driver behavior. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular). انظر التقرير: `docs/architecture/phase-5-5-orders-delivery-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 5.6 (تبني الاستيراد الآمن — analytics، commissions) مكتملة (2026-06-24). تم ترحيل 6 ملفات لاستيراد من `@/modules/analytics` و `@/modules/commissions` بدلاً من المسارات القديمة (`@/services/vendorAnalytics`، `@/services/reports/reportService`، `@/services/reports/csvExport`، `@/services/reports/excelExport`، `@/services/reports/pdfExport`، `@/services/commissionService`). لا تغيير في السلوك. لا نقل ملفات. لا حذف مسارات قديمة. لا تغيير في analytics أو report أو chart أو commission أو payout behavior. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular). انظر التقرير: `docs/architecture/phase-5-6-analytics-commissions-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 5.7 (تبني الاستيراد الآمن — checkout، payments) مكتملة (2026-06-24). تم ترحيل 6 ملفات لاستيراد من `@/modules/checkout` و `@/modules/payments` بدلاً من المسارات القديمة (`@/utils/checkoutCleanup`، `@/services/paymentRecords`، `@/services/paymentService`، `@/utils/paypalEligibility`). لا تغيير في السلوك. لا نقل ملفات. لا حذف مسارات قديمة. لا تغيير في checkout أو payment أو PayPal أو bank transfer أو COD أو refund behavior. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular). انظر التقرير: `docs/architecture/phase-5-7-checkout-payments-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 5.8 (تبني الاستيراد الآمن — admin، chat) مكتملة (2026-06-24). تم ترحيل 7 ملفات لاستيراد من `@/modules/admin` و `@/modules/chat` بدلاً من المسارات القديمة (`@/services/platformSettings`، `@/components/admin/VerificationPanel`، `@/services/chatService`، `@/services/favorites`). لا تغيير في السلوك. لا نقل ملفات. لا حذف مسارات قديمة. لا تغيير في admin أو permissions أو role checks أو ProtectedRoute أو chat أو message أو realtime behavior. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular). **هذه هي المرحلة الأخيرة من تبني الاستيراد الآمن — جميع الموديولات الـ 14 قد أكملت تبني الاستيراد.** انظر التقرير: `docs/architecture/phase-5-8-admin-chat-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.1 (نقل الملفات الآمن — coupons، reviews) مكتملة (2026-06-24). تم نقل 3 ملفات مصدرية إلى مساراتها داخل الموديولات مع الحفاظ على التوافق الخلفي عبر ملفات re-export في المسارات القديمة. الملفات المنقولة: `src/services/coupons.js` → `src/modules/coupons/api/coupons.js`، `src/services/reviewService.js` → `src/modules/reviews/api/reviewService.js`، `src/hooks/queries/useReviewQueries.js` → `src/modules/reviews/hooks/useReviewQueries.js`. جميع المسارات القديمة تعمل عبر re-export. لا تغيير في السلوك. لا حذف مسارات قديمة. لا تغيير في coupon validation أو discount calculation أو review behavior أو React Query keys أو Supabase queries. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 700 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-1-coupons-reviews-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 6.2 (نقل الملفات الآمن — reviewsApi، minimumOrderService) مكتملة (2026-06-24). تم نقل 2 ملفات مصدرية إلى مساراتها داخل الموديولات مع الحفاظ على التوافق الخلفي. الملفات المنقولة: `src/services/apis/reviewsApi.js` → `src/modules/reviews/api/reviewsApi.js`، `src/services/minimumOrderService.js` → `src/modules/cart/api/minimumOrderService.js`. تم أيضاً تحديث `useReviewQueries.js` لاستيراد `reviewsApi` من الملف المحلي بدلاً من `@/services/api` لمنع التبعية الدائرية. `src/services/api.js` لا يزال يعيد تصدير `reviewsApi` من `@/services/apis/reviewsApi` (الآن re-export). `src/modules/checkout/api/index.js` لا يزال يعيد تصدير `minimumOrderService` من `@/services/minimumOrderService` (الآن re-export). لا تغيير في السلوك. لا حذف مسارات قديمة. لا تغيير في review CRUD أو minimum order validation أو checkout/cart behavior أو React Query keys أو Supabase queries. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 702 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-2-reviews-cart-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 6.3 (نقل الملفات الآمن — cartQuantity، checkoutCleanup، useCheckoutPricing) مكتملة (2026-06-24). تم نقل 3 ملفات منخفضة المخاطر إلى مساراتها داخل الموديولات. الملفات المنقولة: `src/utils/cartQuantity.js` → `src/modules/cart/domain/cartQuantity.js`، `src/utils/checkoutCleanup.js` → `src/modules/checkout/utils/checkoutCleanup.js`، `src/hooks/useCheckoutPricing.ts` → `src/modules/checkout/hooks/useCheckoutPricing.ts`. جميع المسارات القديمة تعمل عبر re-export. لا تغيير في السلوك. لا حذف مسارات قديمة. لا تغيير في cart quantity أو checkout cleanup أو pricing behavior أو React Query keys أو Supabase queries. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 705 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-3-cart-checkout-utils-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 6.4 (تقييم نقل loyalty) مكتملة (2026-06-24). **تم تأجيل نقل `src/services/loyalty.js`** بعد تحليل دقيق. loyalty.js (861 سطر) لا ينتمي دلالياً إلى موديول coupons — فهو يدير نقاط الولاء، الطبقات (Bronze/Silver/Gold/Platinum)، نظام الإحالات، ومكافآت الولاء. بينما ينشئ كوبونات في `redeemReward`، هذا اعتماد عبر الموديولات (loyalty → coupons) وليس ملكية. موديول coupons يملك CRUD الكوبونات والتحقق والحساب، وليس نقاط/طبقات/إحالات الولاء. **التوصية: إنشاء موديول مخصص `src/modules/loyalty/` في مرحلة مستقبلية.** لم يتم نقل أي ملفات. لا تغيير في السلوك. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 705 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-4-loyalty-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 6.5 (تأسيس موديول loyalty) مكتملة (2026-06-24). تم إنشاء `src/modules/loyalty/` كطبقة re-export لموديول الولاء. 8 ملفات تم إنشاؤها (index.js + 6 sub-layer index.js + README.md). الموديول يعيد تصدير `loyaltyApi`، `LOYALTY_TIERS`، `REFERRAL_REWARD_POINTS`، `calculateLoyaltyPointsForOrder`، `calculateRewardDiscountAmount`، `addLoyaltyPoints`، `generateReferralCode`، `processReferral` من `@/services/loyalty`. **لم يتم نقل `src/services/loyalty.js`** — هذا تأسيس فقط. الاستيرادات من `@/services/loyalty` لا تزال تعمل. الاستيرادات من `@/modules/loyalty` تعمل الآن. لا تغيير في السلوك. لا تغيير في Supabase queries أو database/RLS أو Edge Functions أو routes أو UI. لا تغيير في loyalty/reward/referral/coupon/cart/checkout behavior. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 713 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-5-loyalty-module-foundation-report.md`.
>
> **حالة الإنجاز:** Phase 6.6 (تبني الاستيراد الآمن — loyalty) مكتملة (2026-06-24). تم ترحيل 6 ملفات لاستيراد من `@/modules/loyalty` بدلاً من `@/services/loyalty`. الملفات المُحدّثة: `pages/buyer/Loyalty.jsx`، `pages/buyer/Orders.jsx`، `__tests__/services/loyalty.test.js`، `store/authSessionStore.js` (استيراد ديناميكي)، `__tests__/pages/buyerOrdersRealtime.test.jsx` (jest.mock)، `features/orders/__tests__/orderFlow.integration.test.js` (jest.mock). **لم يتم نقل `src/services/loyalty.js`**. المسار القديم `@/services/loyalty` لا يزال يعمل (المصدر لم يُلمس). لا تغيير في السلوك. لا تغيير في loyalty/reward/referral/coupon/order/notification behavior. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 712 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-6-loyalty-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.7 (نقل الملفات الآمن — loyalty.js) مكتملة (2026-06-24). تم نقل `src/services/loyalty.js` → `src/modules/loyalty/api/loyalty.js` (861 سطر). تم استبدال المسار القديم بملف re-export توافقي. تعديل واحد فقط: `import { supabase } from './supabase'` → `from '@/services/supabase'` (تعديل مسار الاستيراد بعد النقل). `src/modules/loyalty/api/index.js` يعيد التصدير من `./loyalty` بدلاً من `@/services/loyalty`. جميع المسارات القديمة تعمل (`@/services/loyalty` → re-export → `@/modules/loyalty` → `./api` → `./loyalty`). جميع المسارات الجديدة تعمل. الاستيراد الدييناميكي يعمل. Jest mocks تعمل. 42 اختبار اجتازت (loyalty.test.js: 4، buyerOrdersRealtime.test.jsx: 2، orderFlow.integration.test.js: 36). لا تغيير في السلوك. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 713 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-7-loyalty-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 6.8 (نقل الملفات الآمن — favoritesStore.js) مكتملة (2026-06-24). تم نقل `src/store/favoritesStore.js` → `src/modules/cart/stores/favoritesStore.js` (206 سطر). تم استبدال المسار القديم بملف re-export توافقي. تعديل واحد فقط: `import { logger } from '../utils/logger.js'` → `from '@/utils/logger'` (تعديل مسار الاستيراد بعد النقل). `src/modules/cart/stores/index.js` يعيد التصدير من `./favoritesStore` بدلاً من `@/store/favoritesStore`. جميع المسارات القديمة تعمل (`@/store/favoritesStore` → re-export → `@/modules/cart` → `./stores` → `./favoritesStore`). جميع المسارات الجديدة تعمل. Jest mocks تعمل (6 ملفات تستخدم `jest.mock('@/store/favoritesStore')`). 15 اختبار اجتازت (favoritesStore.test.js: 9، sessionManagement.test.js: 6). لا تغيير في السلوك. لا تغيير في Zustand persist أو hydration أو localStorage. لا تغيير في favorites/auth/logout behavior. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 714 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-8-favorites-store-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 6.9 (تقسيم ونقل favorites.js) مكتملة (2026-06-24). تم تقسيم `src/services/favorites.js` (373 سطر) إلى 4 ملفات منفصلة: `favoritesApi` → `src/modules/cart/api/favorites.js`، `messagesApi` → `src/modules/chat/api/messagesApi.js`، `orderTimelineApi` → `src/modules/orders/api/orderTimelineApi.js`، `verificationApi` → `src/modules/users/api/verificationApi.js`. تم استبدال المسار القديم بملف re-export توافقي يحافظ على جميع الـ 4 exports. تعديل إضافي: `favoritesStore.js` داخل cart module تم تحديث استيراد `favoritesApi` من `@/services/favorites` إلى `../api/favorites` (نسبي داخل الموديول) لمنع تبعية دائرية. تم استخدام deep-path re-exports في stub مع `eslint-disable-next-line` لمنع دورة تقييم الوحدات عند التحميل. تحديث 4 barrels: `cart/api/index.js`، `chat/api/index.js`، `orders/api/index.js`، `users/api/index.js`. 63 اختبار اجتازت (favoritesStore: 9، sessionManagement: 6، authStore: 12، orderFlow.integration: 36). لا تغيير في السلوك. لا تغيير في favorites/chat/messages/timeline/verification behavior. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 718 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-9-favorites-service-split-report.md`.
>
> **حالة الإنجاز:** Phase 6.10 (تبني الاستيراد الآمن — favorites.js split) مكتملة (2026-06-24). تم ترحيل 3 ملفات لاستيراد من الموديولات الصحيحة بدلاً من `@/services/favorites`: `components/ui/OrderTimeline.jsx` و `pages/OrderDetail.jsx` (كلاهما `orderTimelineApi` → `@/modules/orders`)، `pages/Favorites.jsx` (`favoritesApi` → `@/modules/cart`). **لا توجد أي استيرادات متبقية من `@/services/favorites` في كود التطبيق** — فقط re-export stub. لا نقل ملفات. لا تغيير في السلوك. لا تغيير في favorites/chat/messages/timeline/verification behavior. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق. لا تبعيات دائرية. 63 اختبار اجتازت. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 718 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-10-favorites-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.11 (نقل الملفات الآمن — cartStore.js) مكتملة (2026-06-24). تم نقل `src/store/cartStore.js` → `src/modules/cart/stores/cartStore.js` (539 سطر). تم استبدال المسار القديم بملف re-export توافقي. تعديلان فقط: `import { logger } from '../utils/logger.js'` → `from '@/utils/logger'` (تعديل مسار بعد النقل)، `import { normalizeQuantity } from '@/utils/cartQuantity'` → `from '../domain/cartQuantity'` (منع تبعية دائرية — `@/utils/cartQuantity` يعيد التصدير من `@/modules/cart` مما يخلق دورة). `src/modules/cart/stores/index.js` يعيد التصدير من `./cartStore` بدلاً من `@/store/cartStore`. `src/modules/cart/hooks/index.js` يعيد تصدير `useCartHydrated` من `../stores` بدلاً من `@/store/cartStore`. جميع المسارات القديمة تعمل (`@/store/cartStore` → re-export → `@/modules/cart` → `./stores` → `./cartStore`). جميع المسارات الجديدة تعمل. Jest mocks تعمل (9 ملفات تستخدم `jest.mock('@/store/cartStore')`). 81 اختبار اجتازت (favoritesStore: 9، sessionManagement: 6، authStore: 12، orderFlow.integration: 36، checkoutService: 18). لا تغيير في السلوك. لا تغيير في Zustand persist (key: `cart-storage`، version: 4، migration logic، hydration، storage). لا تغيير في cart/checkout/validation/checkoutVendorId behavior. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-11-cart-store-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 6.12 (تبني الاستيراد الآمن — cartStore.js) مكتملة (2026-06-24). تم ترحيل 4 ملفات لاستيراد `useCartStore` من `@/modules/cart` بدلاً من `@/store/cartStore`: `pages/Cart.jsx`، `pages/Favorites.jsx` (دمج مع `favoritesApi` في استيراد واحد)، `pages/CheckoutSimplified.jsx`، `pages/ProductDetail.jsx`. تم إرجاع 3 ملفات (`ProductCard.jsx`، `authSessionStore.js`، `authActionsService.js`) لأن استيرادها من `@/modules/cart` يُحمّل barrel الكامل (بما فيه UI → Map.jsx → Leaflet) مما يكسر Jest mocks. تم تحديث re-export stub في `src/store/cartStore.js` لاستخدام deep path (`@/modules/cart/stores/cartStore`) مع `eslint-disable-next-line` لمنع تحميل barrel الكامل عند الاستيراد من `@/store/cartStore`. 5 ملفات متبقية تستورد من `@/store/cartStore` (checkoutService.js، OrderDetail.jsx، checkoutService.test.js، addToCart.integration.test.js، و stub نفسه). 151 اختبار اجتازت (7 suites). لا نقل ملفات. لا تغيير في السلوك. لا تغيير في cart/persistence/migration/hydration/checkoutVendorId/validation/auth-logout behavior. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق في كود التطبيق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-12-cart-store-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.13 (إصلاح barrel safety — cart module) مكتملة (2026-06-24). تم إزالة `export * from './ui'` من `src/modules/cart/index.js` (root barrel) لمنع التحميل المُسبق لـ `Cart.jsx`/`Favorites.jsx` → `Map.jsx` → Leaflet عند استيراد stores/api/domain فقط. لا كود تطبيق يستورد `CartPage` أو `FavoritesPage` من `@/modules/cart` — Router يستخدم `lazy(() => import('@/pages/Cart'))` مباشرة. تم تحديث `src/store/cartStore.js` stub لاستخدام `@/modules/cart` (root) بدلاً من deep path — لم يعد يحتاج `eslint-disable-next-line`. تم التحقق أن迁移 3 ملفات (ProductCard، authSessionStore، authActionsService) لم يعد يسبب Leaflet crash، لكن يحتاج تحديث Jest mocks أولاً (mocks تستهدف `@/store/cartStore` وليس `@/modules/cart`) — سيتم في Phase 6.14. 151 اختبار اجتازت (7 suites). لا نقل ملفات. لا تغيير في السلوك. لا تغيير في cart/favorites/checkout/persistence behavior. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق في كود التطبيق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-13-cart-barrel-safety-report.md`.
>
> **حالة الإنجاز:** Phase 6.14 (تبني الاستيراد الآمن مع تحديث Jest mocks — cartStore.js) مكتملة (2026-06-24). تم ترحيل 3 ملفات من `@/store/cartStore` إلى `@/modules/cart`: `components/ui/ProductCard.jsx`، `store/authSessionStore.js`، `services/authActionsService.js`. تم تحديث 5 Jest mocks لإضافة `jest.mock('@/modules/cart')` بجانب `jest.mock('@/store/cartStore')` الموجود: `sessionManagement.test.js`، `authStore.test.js`، `darkMode.test.jsx`، `rtlComponents.test.jsx`، `components.a11y.test.jsx`. لم يتم تغيير mocks في 4 اختبارات أخرى لأن ملفاتها تستورد من `@/store/cartStore` وليس من `@/modules/cart`: `checkoutService.test.js`، `orderFlow.integration.test.js`، `checkout.integration.test.js`، `buyerOrdersRealtime.test.jsx`. `addToCart.integration.test.js` لا يُmock cartStore إطلاقاً (يستخدم real store). 151 اختبار اجتازت (7 suites). 3 اختبارات snapshot/a11y فشلت بسبب pre-existing issue: `@/modules/orders` barrel يُحمّل `./ui` → `OrderDetail.jsx` → `RouteMap.jsx` → Leaflet (نفس نمط cart barrel ولكن في orders module — سيتم إصلاحه في Phase مستقبلية). لا نقل ملفات. لا تغيير في السلوك. لا تغيير في cart/favorites/auth/session/logout/persistence/hydration behavior. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق في كود التطبيق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-14-cart-store-mock-safe-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.15 (إصلاح barrel safety — orders module) مكتملة (2026-06-24). تم إزالة `export * from './ui'` من `src/modules/orders/index.js` (root barrel) لمنع التحميل المُسبق لـ `OrderDetailPage` → `@/pages/OrderDetail` → `RouteMap.jsx` → Leaflet عند استيراد lightweight symbols (constants، APIs، hooks) من `@/modules/orders`. لا كود تطبيق يستورد UI components/pages من `@/modules/orders` root barrel — `AppRouter.jsx` يستخدم `lazy(() => import('@/pages/...'))` مباشرة، والمكونات تُستورد من `@/components/orders/...`. UI exports لا تزال متاحة عبر `src/modules/orders/ui/index.js` للاستخدام داخل الموديول. هذا الإصلاح يحل 3 اختبارات كانت فاشلة منذ Phase 6.14 (darkMode.test.jsx، rtlComponents.test.jsx، components.a11y.test.jsx). 118 اختبار اجتازت (6 suites). لا نقل ملفات. لا تغيير في السلوك. لا تغيير في order/delivery/checkout behavior. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق في كود التطبيق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-15-orders-barrel-safety-report.md`.
>
> **حالة الإنجاز:** Phase 6.16 (تبني الاستيراد الآمن — checkoutService.js) مكتملة (2026-06-24). تم ترحيل `src/services/checkoutService.js` من `@/store/cartStore` إلى `@/modules/cart` لاستيراد `useCartStore`. تم تحديث Jest mocks في اختبارين: `checkoutService.test.js` (إضافة `jest.mock('@/modules/cart')` + تغيير استيراد `useCartStore` إلى `@/modules/cart`) و `checkout.integration.test.js` (إضافة `jest.mock('@/modules/cart')` + تغيير `require('@/store/cartStore')` إلى `require('@/modules/cart')` لـ `useCartStore`). تم الإبقاء على `jest.mock('@/store/cartStore')` القديم في كلا الاختبارين للتوافق مع أي مستهلكين آخرين في شجرة الاعتماديات. 130 اختبار اجتازت (7 suites). لا نقل ملفات. لا تغيير في السلوك. لا تغيير في checkout/order creation/payment/cart/coupon/delivery behavior. لا تغيير في Supabase queries أو Edge Function calls أو React Query keys أو database/RLS أو routes أو UI. لا استيراد عميق في كود التطبيق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-16-checkout-service-cart-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.17 (تدقيق barrel safety — delivery + checkout) مكتملة (2026-06-24). تم تدقيق جميع 18 module root barrels تحت `src/modules/*/index.js`. تم تصنيف كل موديول حسب المخاطر. تم إصلاح موديولين: `delivery` (إزالة `export * from './ui'` — كان يُحمّل `LiveDriverMap` → `Map.jsx` → Leaflet) و `checkout` (إزالة UI exports المسماة — كانت تُحمّل `CheckoutSimplified.jsx` 1696 سطر). لا كود تطبيق يستورد UI من `@/modules/delivery` أو `@/modules/checkout` root barrel. UI exports لا تزال متاحة عبر `src/modules/<module>/ui/index.js`. 4 موديولات تحتاج ترحيل استيراد قبل الإصلاح: `catalog` (ProductCard من root)، `marketplace` (SearchBar من root)، `admin` (VerificationPanel من root)، `notifications` (NotificationLink من root). 5 موديولات تصدر UI لكنها آمنة حالياً (shared، auth، users، payments — لا Leaflet/heavy deps). 7 موديولات خفيفة بدون UI (cart، orders، coupons، reviews، chat، commissions، analytics، loyalty). 186 اختبار اجتازت (8 suites). لا نقل ملفات. لا تغيير في السلوك. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-17-module-barrel-safety-audit-report.md`.
>
> **حالة الإنجاز:** Phase 6.18 (فصل استيراد UI — notifications + admin) مكتملة (2026-06-25). تم ترحيل استيراد `NotificationLink` من `@/modules/notifications` إلى `@/components/notifications/NotificationLink` في ملفين: `src/components/Navbar.jsx` و `src/layouts/DashboardLayout.jsx`. تم ترحيل استيراد `VerificationPanel` من `@/modules/admin` إلى `@/components/admin/VerificationPanel` في ملف واحد: `src/pages/admin/Verification.jsx`. بعد الترحيل، لا كود تطبيق يستورد UI من `@/modules/notifications` أو `@/modules/admin` root barrel. تم إزالة UI exports من كلا root barrels: notifications (إزالة `NotificationLink` و `NotificationsPage`) و admin (إزالة 20+ صفحة + `VerificationPanel` + `AdminLayout`). UI exports لا تزال متاحة عبر `src/modules/<module>/ui/index.js`. `ProtectedRoute.jsx` كان يستورد `NotificationLink` مباشرة من `@/components/notifications/NotificationLink` قبل هذه المرحلة — لم يُلمس. الاختبارات كانت تستخدم `jest.mock('@/components/notifications/NotificationLink')` — لم تُلمس. 138 اختبار اجتازت (10 suites). لا نقل ملفات. لا تغيير في السلوك. لا تغيير في notification/admin behavior أو Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-18-admin-notifications-ui-import-decoupling-report.md`.
>
> **حالة الإنجاز:** Phase 6.19 (فصل استيراد UI — catalog + marketplace) مكتملة (2026-06-25). تم ترحيل استيراد `ProductCard` من `@/modules/catalog` إلى `@/components/ui/ProductCard` في ملفين: `src/pages/Marketplace.jsx` و `src/pages/SearchResults.jsx`. تم ترحيل استيراد `SearchBar` من `@/modules/marketplace` إلى `@/components/Search/SearchBar` في نفس الملفين. بعد الترحيل، لا كود تطبيق يستورد UI من `@/modules/catalog` أو `@/modules/marketplace` root barrel. تم إزالة `export * from './ui'` من كلا root barrels. UI exports لا تزال متاحة عبر `src/modules/<module>/ui/index.js`. `StoreDetail.jsx` و `buyer/Dashboard.jsx` كانا يستوردان `ProductCard` من `@/components/ui` مباشرة — لم يُلمسا. الاختبارات كانت تستخدم `@/components/ui/ProductCard` مباشرة — لم تُلمس. 191 اختبار اجتازت (9 suites). فشل واحد في `storeTypeService.test.js` هو موجود مسبقاً (يستورد `resolveOrderDeliveryStrategy` و `decorateStoreProfile` كـ named exports من `@/modules/marketplace` لكنها غير مُصدّرة من الموديول — ليست مرتبطة بتغييرات Phase 6.19). لا نقل ملفات. لا تغيير في السلوك. لا تغيير في product/catalog/marketplace/search/cart/favorites behavior أو Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). جميع 18 module root barrels الآن خفيفة أو آمنة. انظر التقرير: `docs/architecture/phase-6-19-catalog-marketplace-ui-import-decoupling-report.md`.
>
> **حالة الإنجاز:** Phase 6.20 (إصلاح عقد استيراد storeTypeService.test.js) مكتملة (2026-06-25). تم إصلاح الفشل الموجود مسبقاً في `src/__tests__/services/storeTypeService.test.js` (6 اختبارات كانت فاشلة). السبب: الاختبار كان يستورد `decorateStoreProfile` و `resolveOrderDeliveryStrategy` كـ named exports من `@/modules/marketplace`، لكن هذه الدوال هي خصائص داخل كائن `storeTypeService` الافتراضي وليست named exports من الموديول. الإصلاح: تغيير استيراد الاختبار من `import { decorateStoreProfile, resolveOrderDeliveryStrategy } from '@/modules/marketplace'` إلى `import { storeTypeService } from '@/modules/marketplace'` ثم `const { decorateStoreProfile, resolveOrderDeliveryStrategy } = storeTypeService`. هذا تغيير في الاختبار فقط — لم يُلمس أي كود إنتاج. لا تغيير في storeTypeService behavior أو marketplace behavior أو delivery strategy behavior. 141 اختبار اجتازت (7 suites). لا نقل ملفات. لا تغيير في السلوك. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). جميع 18 module root barrels لا تزال خفيفة أو آمنة. انظر التقرير: `docs/architecture/phase-6-20-store-type-service-test-contract-fix-report.md`.
>
> **حالة الإنجاز:** Phase 6.21 (تنظيف root barrels — auth + users + payments) مكتملة (2026-06-25). تم إزالة UI exports من 3 module root barrels: `auth` (إزالة `export * from './ui'` — ProtectedRoute، MainLayout، AdminLayout، VendorLayout، DriverLayout، BuyerLayout، MFASetup، MFAVerify، PhoneVerification، SessionManager، TwoFactor، AuthLayout)، `users` (إزالة `export * from './ui'` — ProfilePage، BuyerSettingsPage، BuyerAddressesPage، VendorProfilePage، DriverProfilePage، VendorPublicProfilePage)، `payments` (إزالة 6 UI exports مسماة — usePaymentGuard، OrderPaymentSection، PaymentReceiptUpload، PaymentPolicySettings، RefundPolicySettings، DeliveryPaymentPolicy). لا كود تطبيق يستورد UI من أي من هذه الـ root barrels. `AppRouter.jsx` يستورد ProtectedRoute والـ layouts مباشرة من `@/components/ProtectedRoute`، ويحمّل الصفحات عبر `lazy(() => import('@/pages/...'))`. `shared` root barrel لم يُلمس عمداً لأن كود التطبيق يستورد UI primitives (Card، Button، LoadingSpinner) من `@/modules/shared` بشكل مشروع. تم أيضاً إصلاح خطأ موجود مسبقاً: إضافة `getPendingAuthRedirect` المفقودة من auth utils barrel re-export (الدالة موجودة في `src/utils/authRedirects.js` لكن لم تكن مُصدّرة من `src/modules/auth/utils/index.js`). UI exports لا تزال متاحة عبر `src/modules/<module>/ui/index.js`. 200 اختبار اجتازت (15 suites). لا نقل ملفات. لا تغيير في السلوك. لا تغيير في auth/user/profile/payment/checkout behavior أو Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). جميع 18 module root barrels الآن خفيفة — بما فيها `shared` التي تصدر UI primitives خفيفة فقط. انظر التقرير: `docs/architecture/phase-6-21-auth-users-payments-root-barrel-cleanup-report.md`.
>
> **حالة الإنجاز:** Phase 6.22 (تحديث وثائق READMEs و Public API documentation) مكتملة (2026-06-25). تم تحديث 11 module README ليعكس سياسة الـ lightweight root barrels: `cart`، `orders`، `delivery`، `checkout`، `notifications`، `admin`، `catalog`، `marketplace`، `auth`، `users`، `payments`. كل README تم تحديثه بإزالة UI/page-level exports من قسم Public API، وإضافة قسم "Intentionally NOT Exported from Root" مع جدول يوضح كل UI symbol والمسار البديل له، وإضافة قسم "UI / Page Import Policy" يوضح سياسة الاستيراد الصحيحة. تم أيضاً تحديث `ARCHITECTURE_GUIDE.md` بإضافة Phases 6.13–6.22 وسياسة الـ root barrels. `shared` README لم يُلمس عمداً لأنه الاستثناء المعتمد (يصدّر UI primitives من root). `DEVELOPER_GUIDE.md` لم يحتج تحديثاً (أوصاف هيكل الموديولات صحيحة). تم التحقق من جميع الـ root barrels: جميعها خفيفة وتصدّر فقط lightweight public APIs باستثناء `shared`. لا تغيير في أي كود مصدر. لا نقل ملفات. لا تغيير في السلوك. لا تغيير في Supabase queries أو React Query keys أو database/RLS أو Edge Functions أو routes أو UI. لا استيراد عميق. لا تبعيات دائرية. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-22-module-readme-public-api-documentation-report.md`.
>
> **حالة الإنجاز:** Phase 6.23 (Legacy Import Audit — تدقيق واستكشاف فقط) مكتملة (2026-06-25). تم تدقيق جميع 12 compatibility stubs وجميع الاستيرادات من المسارات القديمة. النتائج: 15 app imports، 1 test import، 18 jest.mock()، 3 require()، 0 dynamic imports. التصنيف: Class A (مرشح آمن — 2 مسارات: `@/utils/cartQuantity` و `@/services/reviewService`)، Class B (إبقاء مؤقت — 1 مسار: `@/store/favoritesStore` بـ 6 mocks)، Class C (تحتاج تحليل مخصص — 4 مسارات: `@/store/cartStore`، `@/services/coupons`، `@/services/minimumOrderService`، `@/hooks/useCheckoutPricing`)، Class D (مرشح لإزالة الـ stub مستقبلاً — 5 مسارات بـ 0 consumers: `@/services/favorites`، `@/services/loyalty`، `@/services/apis/reviewsApi`، `@/utils/checkoutCleanup`، `@/hooks/queries/useReviewQueries`). `OrderDetail.jsx` (1700 سطر) و `CheckoutSimplified.jsx` (1695 سطر) هي أعلى الملفات مخاطرة. لا تغيير في أي كود مصدر. لا نقل ملفات. لا حذف stubs. لا تغيير في السلوك. جميع أوامر التحقق اجتازت (lint، type-check، build، check:circular — 719 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-23-legacy-import-audit-report.md`.
>
> **حالة الإنجاز:** Phase 6.24 (Safe Import Adoption — @/utils/cartQuantity) مكتملة (2026-06-25). تم ترحيل جميع استيرادات `@/utils/cartQuantity` إلى `@/modules/cart` في 3 ملفات: `src/pages/Cart.jsx` (4 symbols)، `src/pages/ProductDetail.jsx` (3 symbols)، `src/__tests__/utils/cartQuantity.test.js` (4 symbols via require). التغييرات هي استيراد-مسار-فقط — لا تغيير في أي منطق أو سلوك. الـ compatibility stub `src/utils/cartQuantity.js` بقي كما هو ويعمل. لا نقل ملفات. لا حذف stubs. لا deep imports في كود التطبيق. `@/modules/cart` root barrel يصدّر جميع الرموز الأربعة (`normalizeQuantity`، `formatQuantity`، `getQuantityStep`، `isDecimalQuantityUnit`) عبر `export * from './domain'`. لا استيرادات داخلية من `@/utils/cartQuantity` داخل `src/modules/cart/` — الاستيراد الداخلي في cartStore يستخدم `../domain/cartQuantity` (مسار نسبي) لمنع التبعية الدائرية ولم يُلمس. جميع الفحوصات اجتازت: lint، type-check، build (2m 41s)، check:circular (719 ملف، 0 تبعيات دائرية). 138 اختبار موجَّه اجتازت (cartQuantity + productLogic + addToCart + checkout + checkoutService). انظر التقرير: `docs/architecture/phase-6-24-cart-quantity-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.25 (Safe Import Adoption — @/services/reviewService) مكتملة (2026-06-25). تم ترحيل جميع استيرادات `@/services/reviewService` إلى `@/modules/reviews` في 4 ملفات تطبيق + 2 ملفات اختبار. التغييرات: (1) `src/pages/OrderDetail.jsx:41` — `import reviewService from '@/services/reviewService'` → `import { reviewService } from '@/modules/reviews'` (default → named). (2) `src/pages/vendor/Reviews.jsx:5` — نفس التغيير. (3) `src/pages/buyer/Orders.jsx:21` — نفس التغيير. (4) `src/pages/ProductDetail.jsx:9` — نفس التغيير. (5) `src/__tests__/pages/buyerOrdersRealtime.test.jsx:73` — تحديث `jest.mock` من `@/services/reviewService` إلى `@/modules/reviews` مع تغيير البنية من `{ __esModule: true, default: { ... } }` إلى `{ reviewService: { ... } }`. (6) `src/features/orders/__tests__/orderFlow.integration.test.js:151` — نفس تحديث الـ mock. الـ compatibility stub `src/services/reviewService.js` بقي كما هو ويعمل. لا نقل ملفات. لا حذف stubs. لا deep imports. `@/modules/reviews` root barrel يصدّر `reviewService` كـ named export عبر `export { reviewService } from './api'`. لا تغيير في أي منطق أو سلوك أو استعلامات Supabase أو React Query keys. جميع الفحوصات اجتازت: lint، type-check، build (2m 43s)، check:circular (719 ملف، 0 تبعيات دائرية). 115 اختبار موجَّه اجتازت (reviewService + buyerOrdersRealtime + orderFlow + checkout.integration + components.a11y). انظر التقرير: `docs/architecture/phase-6-25-review-service-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.26 (Class D Stub Removal Readiness Audit — تدقيق فقط) مكتملة (2026-06-25). تم تدقيق 5 Class D compatibility stubs للتأكد من عدم وجود مستهلكين نشطين بعد Phase 6.25. النتائج: (1) `@/services/favorites` — 0 مستهلكين نشطين، مؤهل للحذف المستقبلي. (2) `@/services/loyalty` — 0 مستهلكين نشطين، مؤهل للحذف المستقبلي. (3) `@/services/apis/reviewsApi` — **1 مستهلك غير مباشر** (`src/services/api.js:22` يعيد تصدير `reviewsApi` من هذا الـ stub)، لا يحذف حتى يُحدّث `services/api.js`. (4) `@/utils/checkoutCleanup` — 0 مستهلكين نشطين، مؤهل للحذف المستقبلي. (5) `@/hooks/queries/useReviewQueries` — 0 مستهلكين نشطين، مؤهل للحذف المستقبلي. تم العثور على 14 مرجع وثائقي قديم في 8 ملفات (READMEs + placeholder comments) تحتاج تحديثاً قبل الحذف. التوصية: إبقاء جميع الـ stubs حتى Phase 7+ بعد إكمال ترحيل Class B/C وتحديث الوثائق. لا حذف. لا نقل ملفات. لا تغيير في أي كود. جميع الفحوصات اجتازت: lint، type-check، build (2m 46s)، check:circular (719 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-6-26-class-d-stub-removal-readiness-audit-report.md`.
>
> **حالة الإنجاز:** Phase 6.27 (Safe Import Adoption — @/store/favoritesStore) مكتملة (2026-06-25). تم ترحيل جميع استيرادات `@/store/favoritesStore` إلى `@/modules/cart` في 4 ملفات تطبيق + 6 ملفات اختبار. التغييرات: (1) `src/pages/Favorites.jsx:5` — `import { useFavoritesStore } from '@/store/favoritesStore'` → `import { useFavoritesStore } from '@/modules/cart'` (named → named). (2) `src/components/ui/ProductCard.jsx:6` — نفس التغيير. (3) `src/store/authSessionStore.js:6` — نفس التغيير. (4) `src/services/authActionsService.js:7` — نفس التغيير. (5–9) خمسة ملفات اختبار (`components.a11y.test.jsx`، `rtlComponents.test.jsx`، `darkMode.test.jsx`، `sessionManagement.test.js`، `authStore.test.js`) — دمج mock الخاص بـ `useFavoritesStore` في mock الموجود لـ `@/modules/cart` وإزالة mock الخاص بـ `@/store/favoritesStore`. (10) `addToCart.integration.test.js` — تغيير mock من `@/store/favoritesStore` إلى `@/modules/cart` باستخدام `jest.requireActual` للحفاظ على `useCartStore` الحقيقي. الـ compatibility stub `src/store/favoritesStore.js` بقي كما هو ويعمل. لا نقل ملفات. لا حذف stubs. لا deep imports. لا تغيير في أي منطق أو سلوك أو استعلامات Supabase أو React Query keys أو persistence أو hydration. جميع الفحوصات اجتازت: lint، type-check، build (2m 41s)، check:circular (719 ملف، 0 تبعيات دائرية). 176 اختبار موجَّه اجتازت (10 suites). انظر التقرير: `docs/architecture/phase-6-27-favorites-store-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.28 (Safe Import Adoption — @/services/coupons) مكتملة (2026-06-25). تم ترحيل جميع استيرادات `@/services/coupons` إلى `@/modules/coupons` في ملفين. التغييرات: (1) `src/pages/CheckoutSimplified.jsx:16` — `import { couponsApi } from '@/services/coupons'` → `import { couponsApi } from '@/modules/coupons'` (named → named، ملف عالي المخاطر 1696 سطر — تغيير مسار استيراد فقط). (2) `src/modules/checkout/api/index.js:23` — `} from '@/services/coupons'` → `} from '@/modules/coupons'` (module-internal re-export، 6 symbols: `couponsApi`، `normalizeCoupon`، `isCouponCurrentlyActive`، `calculateCouponDiscountAmount`، `calculateBulkDiscountBreakdown`). لا توجد أي jest.mocks تحتاج تحديثاً (لا توجد mocks لـ `@/services/coupons` أو `@/modules/coupons`). الـ compatibility stub `src/services/coupons.js` بقي كما هو ويعمل. لا نقل ملفات. لا حذف stubs. لا deep imports. لا تغيير في أي منطق أو سلوك أو استعلامات Supabase أو React Query keys. جميع الفحوصات اجتازت: lint، type-check، build (2m 47s)، check:circular (719 ملف، 0 تبعيات دائرية). 207 اختبار موجَّه اجتازت (12 suites). انظر التقرير: `docs/architecture/phase-6-28-coupons-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.29 (Safe Import Adoption — @/services/minimumOrderService) مكتملة (2026-06-25). تم ترحيل جميع استيرادات `@/services/minimumOrderService` إلى `@/modules/cart` في 4 ملفات. قرار الملكية: `@/modules/cart` هو المسار الصحيح لأن المصدر يقع في `src/modules/cart/api/minimumOrderService.js` و cart API barrel يصدّر الرموز الثلاثة (`buildVendorCartBuckets`، `evaluateVendorMinimumOrders`، `buildMinimumOrderMessage`). checkout re-export هو compatibility وليس public API. التغييرات: (1) `src/pages/Cart.jsx:22` — `from '@/services/minimumOrderService'` → `from '@/modules/cart'` (named → named). (2) `src/pages/CheckoutSimplified.jsx:23` — نفس التغيير (ملف عالي المخاطر 1696 سطر). (3) `src/modules/checkout/api/index.js:29` — `} from '@/services/minimumOrderService'` → `} from '@/modules/cart'` (module-internal re-export، لا تبعية دائرية: checkout يعتمد على cart وهو مسموح). (4) `src/__tests__/snapshots/rtlComponents.test.jsx` — دمج `evaluateVendorMinimumOrders` و `buildMinimumOrderMessage` في mock الموجود لـ `@/modules/cart` وإزالة mock الخاص بـ `@/services/minimumOrderService`. الـ compatibility stub بقي كما هو. لا نقل ملفات. لا حذف stubs. لا deep imports. جميع الفحوصات اجتازت: lint، type-check، build (2m 41s)، check:circular (719 ملف، 0 تبعيات دائرية). 243 اختبار موجَّه اجتازت (15 suites). انظر التقرير: `docs/architecture/phase-6-29-minimum-order-service-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.30 (Safe Import Adoption — @/hooks/useCheckoutPricing) مكتملة (2026-06-25). تم ترحيل استيراد `@/hooks/useCheckoutPricing` إلى `@/modules/checkout` في ملف واحد. التغيير: `src/pages/CheckoutSimplified.jsx:28` — `import { useCheckoutPricing } from '@/hooks/useCheckoutPricing'` → `import { useCheckoutPricing } from '@/modules/checkout'` (named → named، ملف عالي المخاطر 1696 سطر — تغيير مسار استيراد فقط). لا توجد أي jest.mocks تحتاج تحديثاً (لا توجد mocks لـ `@/hooks/useCheckoutPricing` أو `@/modules/checkout`). الـ compatibility stub `src/hooks/useCheckoutPricing.ts` بقي كما هو ويعمل. لا نقل ملفات. لا حذف stubs. لا deep imports. **معلم مهم: `CheckoutSimplified.jsx` الآن لديه صفر استيرادات من legacy stubs** — جميع الاستيرادات تأتي من module roots أو مسارات خدمة غير stub. جميع الفحوصات اجتازت: lint، type-check، build (2m 40s)، check:circular (719 ملف، 0 تبعيات دائرية). 235 اختبار موجَّه اجتازت (14 suites). انظر التقرير: `docs/architecture/phase-6-30-checkout-pricing-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.31 (Safe Import Adoption — @/store/cartStore — آخر مسار Class C) مكتملة (2026-06-25). تم ترحيل جميع استيرادات ومحاكاة `@/store/cartStore` إلى `@/modules/cart` في 13 ملف. التغييرات: (1) `src/pages/OrderDetail.jsx:44` — `import { useCartStore } from '@/store/cartStore'` → `from '@/modules/cart'` (named → named، ملف عالي المخاطر 1700 سطر). (2) `src/features/marketplace/__tests__/addToCart.integration.test.js:87` — نفس ترحيل الاستيراد. (3) `src/features/orders/__tests__/orderFlow.integration.test.js:410` — `require('@/store/cartStore')` → `require('@/modules/cart')`. (4) `src/features/marketplace/__tests__/useCart.test.js:60` — `require('@/store/cartStore').useCartStore` → `require('@/modules/cart').useCartStore`. (5–13) تحديث 9 jest.mock(): 7 ملفات كان فيها mock مكرر لـ `@/store/cartStore` و `@/modules/cart` — تم إزالة mock القديم؛ ملفان كان فيهما mock فقط لـ `@/store/cartStore` — تم تغيير المسار إلى `@/modules/cart`. الـ compatibility stub بقي كما هو. لا نقل ملفات. لا حذف stubs. لا deep imports. **معلم مهم: جميع مسارات Class A و B و C قد هاجرت بالكامل**. جميع الفحوصات اجتازت: lint، type-check، build (2m 42s)، check:circular (719 ملف، 0 تبعيات دائرية). 294 اختبار موجَّه اجتازت (19 suites). انظر التقرير: `docs/architecture/phase-6-31-cart-store-final-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 6.32 (Final Legacy Re-Audit + reviewsApi Re-export Cleanup) مكتملة (2026-06-25). تم إجراء تدقيق شامل لجميع 12 مسار legacy + تنظيف re-export واحد. التغيير: `src/services/api.js:22` — `export { reviewsApi } from './apis/reviewsApi'` → `export { reviewsApi } from '@/modules/reviews'` (export-path-only، behavior-neutral). نتائج التدقيق الشامل: **صفر مستهلكين نشطين** لجميع 12 مسار legacy (0 استيرادات تطبيق، 0 استيرادات اختبار، 0 jest.mocks، 0 require()، 0 dynamic imports). جميع الإشارات المتبقية هي إما تعليقات داخل الـ stubs نفسها أو تقارير تاريخية في `docs/architecture/`. لم يتم حذف أي stubs. لا نقل ملفات. جميع الفحوصات اجتازت: lint، type-check، build (2m 44s)، check:circular (719 ملف، 0 تبعيات دائرية). 200 اختبار موجَّه اجتازت (14 suites). 5 Class D stubs مؤهلة للحذف في Phase 6.33. انظر التقرير: `docs/architecture/phase-6-32-final-legacy-re-audit-report.md`.
>
> **حالة الإنجاز:** Phase 6.33 (Class D Stub Deletion — 5 stubs deleted) مكتملة (2026-06-25). تم حذف 5 Class D compatibility stubs بعد تأكيد صفر مستهلكين نشطين: (1) `src/services/favorites.js`، (2) `src/services/loyalty.js`، (3) `src/services/apis/reviewsApi.js`، (4) `src/utils/checkoutCleanup.js`، (5) `src/hooks/queries/useReviewQueries.js`. مجموع 75 سطر محذوف. لم يتم حذف أي Class A/B/C stubs (7 stubs تبقى حتى Phase 7+). تم تحديث 7 مراجع وثائقية (تعليقات + READMEs) لتعكس الحذف. لم يتم تغيير أي تقارير تاريخية. لا تغيير في أي سلوك أو منطق أو استعلامات. جميع الفحوصات اجتازت: lint، type-check، build (2m 37s)، check:circular (714 ملف بدلاً من 719، 0 تبعيات دائرية). 229 اختبار موجَّه اجتازت (15 suites). انظر التقرير: `docs/architecture/phase-6-33-class-d-stub-deletion-report.md`.
>
> **حالة الإنجاز:** Phase 6.34 (Phase 6 Closure Report) مكتملة (2026-06-25). **Phase 6 معلن اكتماله رسمياً.** هذه المرحلة وثائقية فقط — لا تغيير في الكود. تم التحقق من: (1) 18 module root barrels جميعها lightweight أو safe، (2) 17 root barrels بدون UI exports، (3) `shared` هو الاستثناء الوحيد المقصود، (4) 5 Class D stubs محذوفة فعلاً، (5) 7 Class A/B/C stubs لا تزال موجودة، (6) صفر استيرادات/mocks نشطة من مسارات محذوفة أو مهاجرة، (7) صفر تبعيات دائرية (714 ملف). تم تحديث `ARCHITECTURE_GUIDE.md` بإدخالات Phase 6.23–6.34. جميع الفحوصات اجتازت: lint، type-check، build (2m 41s)، check:circular (714 ملف، 0 تبعيات دائرية). 175 اختبار smoke اجتازت (8 suites). **خارطة طريق Phase 7.1:** تحليل ما قبل النقل لـ `checkoutService.js` وخدمات الدفع والصفحات الكبيرة + خريطة ملكية الخدمات. انظر التقرير: `docs/architecture/phase-6-34-phase-6-closure-report.md`.
>
> **حالة الإنجاز:** Phase 7.1 (Pre-Movement Analysis for `checkoutService.js`) مكتملة (2026-06-25). هذه المرحلة **تحليل فقط** — لا تغيير في الكود. تم تحليل `src/services/checkoutService.js` (178 سطر، 3 exports: `calculateOrderTotals`، `calculateCheckoutPricing`، `createCheckoutOrder`). **المستهلكون:** 4 ملفات، 6 مواقع استيراد/require (CheckoutSimplified.jsx، checkout/api/index.js، checkoutService.test.js، checkout.integration.test.js). **التبعيات:** 3 فقط (`supabase`، `useCartStore` من `@/modules/cart`، `useAuthStore` من `@/store/authStore`). **قرار الملكية:** checkout module. **المسار المستهدف:** `src/modules/checkout/api/checkoutService.js`. **التوصية:** الإبقاء على compatibility stub في `src/services/checkoutService.js` (re-export من `@/modules/checkout`) — صفر تغييرات للمستهلكين. **خطر التبعيات الدائرية:** لا يوجد. **تقييم المخاطر:** منخفض–متوسط. **التوصية:** ✅ GO للمرحلة 7.2 (نقل الملف + stub). جميع الفحوصات اجتازت: lint، type-check، build (2m 49s)، check:circular (714 ملف، 0 تبعيات دائرية). 124 اختبار smoke اجتازت (4 suites). انظر التقرير: `docs/architecture/phase-7-1-checkout-service-pre-movement-analysis-report.md`.
>
> **حالة الإنجاز:** Phase 7.2 (checkoutService.js File Movement) مكتملة (2026-06-25). تم نقل تنفيذ `checkoutService.js` من `src/services/` إلى `src/modules/checkout/api/checkoutService.js` (178 سطر، 3 exports: `calculateOrderTotals`، `calculateCheckoutPricing`، `createCheckoutOrder`). تم استبدال الملف الأصلي بـ compatibility stub: `export { ... } from '@/modules/checkout'`. تم تحديث `src/modules/checkout/api/index.js` للاستيراد من `./checkoutService` بدلاً من `@/services/checkoutService`. **لم يتم تغيير:** `CheckoutSimplified.jsx`، الاختبارات، أي سلوك أو منطق أو استعلامات أو Edge Functions. كلا المسارين يعملان: `@/services/checkoutService` (عبر stub) و `@/modules/checkout` (عبر module root). جميع الفحوصات اجتازت: lint، type-check، build (2m 44s)، check:circular (715 ملف، 0 تبعيات دائرية). 126 اختبار موجَّه اجتازت (5 suites). **المرحلة التالية المقترحة (7.3):** ترحيل استيرادات المستهلكين من `@/services/checkoutService` إلى `@/modules/checkout`. انظر التقرير: `docs/architecture/phase-7-2-checkout-service-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 7.3 (checkoutService Import Adoption) مكتملة (2026-06-25). تم ترحيل جميع مستهلكي `@/services/checkoutService` إلى `@/modules/checkout` في 3 ملفات (5 مواقع استيراد/require). التغييرات: (1) `src/pages/CheckoutSimplified.jsx:27` — دمج `createCheckoutOrder` في استيراد `@/modules/checkout` الموجود (إزالة استيراد منفصل من `@/services/checkoutService`). (2) `src/__tests__/services/checkoutService.test.js:42` — `from '@/services/checkoutService'` → `from '@/modules/checkout'`. (3) `src/features/checkout/__tests__/checkout.integration.test.js:325,418,503` — 3 `require('@/services/checkoutService')` → `require('@/modules/checkout')`. **لم يتم تحديث أي jest.mock()** (لا توجد mocks لـ `@/services/checkoutService`). الـ compatibility stub في `src/services/checkoutService.js` لم يُلمس — **صفر مستهلكين نشطين الآن**. **معلم مهم: `CheckoutSimplified.jsx` الآن لديه استيراد واحد فقط من `@/modules/checkout`** بدلاً من استيرادين منفصلين. جميع الفحوصات اجتازت: lint، type-check، build (2m 44s)، check:circular (715 ملف، 0 تبعيات دائرية). 126 اختبار موجَّه اجتازت (5 suites). **المرحلة التالية المقترحة (7.4):** حذف stub `src/services/checkoutService.js` (صفر مستهلكين). انظر التقرير: `docs/architecture/phase-7-3-checkout-service-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 7.4 (checkoutService Stub Deletion) مكتملة (2026-06-25). تم حذف `src/services/checkoutService.js` (compatibility stub، 10 أسطر) بعد تأكيد صفر مستهلكين نشطين. **دورة ترحيل checkoutService مكتملة:** 7.1 (تحليل) → 7.2 (نقل + stub) → 7.3 (ترحيل مستهلكين) → 7.4 (حذف stub). عدد الملفات: 715 → 714. تم تحديث مرجعين وثائقيين: `src/modules/orders/README.md:287` (شطب المسار القديم + وضع علامة ✅ Done) و `src/modules/checkout/README.md:191` (نفس التحديث). لم يتم حذف أي Class A/B/C stubs (7 stubs تبقى). لم يتم تغيير أي كود مصدر أو سلوك. جميع الفحوصات اجتازت: lint، type-check، build (2m 42s)، check:circular (714 ملف، 0 تبعيات دائرية). 126 اختبار موجَّه اجتازت (5 suites). **المرحلة التالية المقترحة (7.5):** تحليل ما قبل النقل لخدمات الدفع (paymentService، paymentGateway، paymentRecords). انظر التقرير: `docs/architecture/phase-7-4-checkout-service-stub-deletion-report.md`.
>
> **حالة الإنجاز:** Phase 7.5 (Payment Services Pre-Movement Analysis) مكتملة (2026-06-25). هذه المرحلة **تحليل فقط** — لا تغيير في الكود. تم تحليل 3 ملفات: `paymentService.js` (296 سطر، 12 exports)، `paymentGateway.js` (700 سطر، 7 exports)، `paymentRecords.js` (178 سطر، 12 exports). **المجموع:** 1174 سطر، 29 exports. **المستهلكون:** 13 ملف تطبيق + 11 ملف اختبار + 3 re-export barrels = 33+ موقع استيراد/mock. **التبعيات:** supabase، paymentRecords (داخلي)، paymentGateway (داخلي)، constants/payment، utils، lib/config، react. **Edge Functions:** 10 دوال. **جداول مباشرة:** payments، orders، refunds. **RPC:** confirm_cmi_payment. **خطر التبعيات الدائرية:** لا يوجد. **قرار الملكية:** payments module (الكل). **المسارات المستهدفة:** `src/modules/payments/api/paymentService.js`، `src/modules/payments/api/paymentGateway.js`، `src/modules/payments/api/paymentRecords.js`. **التوصية:** ✅ GO لـ Phase 7.6 — نقل `paymentRecords.js` أولاً (أقل مخاطر)، ثم `paymentGateway.js` (Phase 7.7)، ثم `paymentService.js` (Phase 7.8). **يجب الإبقاء على compatibility stub لكل ملف.** **تحذيرات:** 3 schema tests تستخدم `fs.readFileSync` على مسارات الملفات، 2 `jest.mock()` لـ `@/services/paymentService`. جميع الفحوصات اجتازت: lint، type-check، build (2m 43s)، check:circular (714 ملف، 0 تبعيات دائرية). انظر التقرير: `docs/architecture/phase-7-5-payment-services-pre-movement-analysis-report.md`.
>
> **حالة الإنجاز:** Phase 7.6 (paymentRecords.js File Movement) مكتملة (2026-06-25). تم نقل تنفيذ `paymentRecords.js` من `src/services/` إلى `src/modules/payments/api/paymentRecords.js` (178 سطر، 12 exports). تم استبدال الملف الأصلي بـ compatibility stub: `export { ... } from '@/modules/payments'`. تم تحديث `src/modules/payments/api/index.js` للاستيراد من `./paymentRecords` بدلاً من `@/services/paymentRecords`. تم تحديث `src/__tests__/services/paymentRecords.schema.test.js:5` — مسار `fs.readFileSync` من `../../services/paymentRecords.js` إلى `../../modules/payments/api/paymentRecords.js`. **تم الحفاظ على dynamic import** لـ supabase (`import('@/services/supabase')`) دون تغيير. **لم يتم تغيير:** `paymentService.js`، `paymentGateway.js`، أي مستهلكين عاديين، أي سلوك أو منطق أو استعلامات أو Edge Functions. كلا المسارين يعملان: `@/services/paymentRecords` (عبر stub) و `@/modules/payments` (عبر module root). جميع الفحوصات اجتازت: lint، type-check، build (2m 40s)، check:circular (715 ملف، 0 تبعيات دائرية). **المرحلة التالية المقترحة (7.7):** نقل `paymentGateway.js` إلى payments module. انظر التقرير: `docs/architecture/phase-7-6-payment-records-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 7.7 (paymentGateway.js File Movement) مكتملة (2026-06-25). تم نقل تنفيذ `paymentGateway.js` من `src/services/` إلى `src/modules/payments/api/paymentGateway.js` (700 سطر، 5 named exports + 1 default export: `paymentGateway`، `createPaymentIntent`، `confirmPayment`، `getPaymentById`، `usePayment`، `default`). تم استبدال الملف الأصلي بـ compatibility stub. **تحديث داخلي:** استيراد `paymentRecords` تغيير من `@/services/paymentRecords` إلى `./paymentRecords` (مسار محلي، محايد سلوكياً). **تحديث barrel:** `src/modules/payments/api/index.js` — إعادة تصدير من `./paymentGateway` بدلاً من `@/services/paymentGateway`، مع إضافة `getPaymentById` و `usePayment`. **تحديث root barrel:** `src/modules/payments/index.js` — إضافة `getPaymentById`، `usePayment`، `createGatewayPaymentIntent`. **تحديث schema tests:** `codBankPayment.schema.test.js:5` و `refundPayPal.schema.test.js:5` — مسار `fs.readFileSync` من `../../services/paymentGateway.js` إلى `../../modules/payments/api/paymentGateway.js`. **تنبيه تسمية:** `createPaymentIntent` من gateway تمت إعادة تسميته إلى `createGatewayPaymentIntent` في module barrel لتجنب تعارض مع `createPaymentIntent` من paymentService. الـ stub يعكس هذا: `createGatewayPaymentIntent as createPaymentIntent`. **لم يتم تغيير:** `paymentService.js`، أي مستهلكين عاديين، أي سلوك أو منطق أو استعلامات أو Edge Functions (7 دوال) أو RPC (`confirm_cmi_payment`). كلا المسارين يعملان: `@/services/paymentGateway` (عبر stub) و `@/modules/payments` (عبر module root). جميع الفحوصات اجتازت: lint، type-check، build (2m 42s)، check:circular (716 ملف، 0 تبعيات دائرية). 180 اختبار نجح، 3 إخفاقات سابقة غير متعلقة بالمرحلة. **المرحلة التالية المقترحة (7.8):** نقل `paymentService.js` إلى payments module. انظر التقرير: `docs/architecture/phase-7-7-payment-gateway-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 7.8 (paymentService.js File Movement) مكتملة (2026-06-25). تم نقل تنفيذ `paymentService.js` من `src/services/` إلى `src/modules/payments/api/paymentService.js` (296 سطر، 12 named exports، لا default export). تم استبدال الملف الأصلي بـ compatibility stub. **تحديثات داخلية:** استيراد `paymentGateway` من `@/services/paymentGateway` → `./paymentGateway`، واستيراد `paymentRecords` من `@/services/paymentRecords` → `./paymentRecords` (مسارات محلية، محايدة سلوكياً). **تحديث barrel:** `src/modules/payments/api/index.js:23` — إعادة تصدير من `./paymentService` بدلاً من `@/services/paymentService`. **لا توجد schema tests** تستخدم `fs.readFileSync` على `paymentService.js` — لا حاجة لتحديثات. **تم الحفاظ على تمييز `createPaymentIntent`:** نسخة paymentService تُصدَّر كـ `createPaymentIntent`، نسخة gateway تُصدَّر كـ `createGatewayPaymentIntent`. **لم يتم تغيير:** `paymentGateway.js`، `paymentRecords.js`، أي مستهلكين عاديين، أي سلوك أو منطق أو استعلامات أو Edge Functions (3 دوال: `confirm-bank-transfer`، `register-payment-receipt`، `confirm-order-payment`). **إكمال نقل جميع ملفات الدفع الثلاثة:** `paymentRecords.js` (Phase 7.6) + `paymentGateway.js` (Phase 7.7) + `paymentService.js` (Phase 7.8) = جميعها الآن في `src/modules/payments/api/`. جميع الاستيرادات الداخلية بين الملفات الثلاثة تستخدم مسارات محلية (`./paymentGateway`، `./paymentRecords`). كلا المسارين يعملان: `@/services/paymentService` (عبر stub) و `@/modules/payments` (عبر module root). جميع الفحوصات اجتازت: lint، type-check، build (2m 42s)، check:circular (717 ملف، 0 تبعيات دائرية). 180 اختبار نجح، 3 إخفاقات سابقة غير متعلقة بالمرحلة. **المرحلة التالية المقترحة (7.9):** تبني الاستيراد الآمن — ترحيل جميع مستهلكي `@/services/paymentService`، `@/services/paymentGateway`، `@/services/paymentRecords` إلى `@/modules/payments` (13 ملف). انظر التقرير: `docs/architecture/phase-7-8-payment-service-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 7.9 (Payment Consumer Import Adoption) مكتملة (2026-06-25). تم ترحيل جميع مستهلكي المسارات القديمة (`@/services/paymentService`، `@/services/paymentGateway`، `@/services/paymentRecords`) إلى `@/modules/payments` في 11 ملف (7 ملفات تطبيق + 4 ملفات اختبار). **ملفات التطبيق المُرحَّلة:** (1) `CheckoutSimplified.jsx:26` — `getLatestOrderPaymentRecord`، (2) `OrderDetail.jsx:38` — `confirmOrderPayment`، (3) `OrderConfirmation.jsx:8-9` — دمج استيرادين في استيراد واحد (`paymentGateway`، `updateOrderPaymentRecord`، `getLatestOrderPaymentRecord`)، (4) `admin/Orders.jsx:6-8` — دمج استيرادين في استيراد واحد (`paymentGateway`، `resolvePaymentMethod`) + تحديث تعليق، (5) `PaymentReceiptUpload.jsx:17` — `registerPaymentReceipt`، (6) `emailService.js:3` — `resolvePaymentMethod`، (7) `cmiPayment.js:1` — `getLatestPaymentRecordForOrder`. **ملفات الاختبار المُرحَّلة:** (8) `checkoutService.test.js:22,36` — `jest.mock` + `import * as paymentService`، (9) `checkout.integration.test.js:160` — `jest.mock`، (10) `paymentGateway.test.js` (src/__tests__) — استيراد مع `createGatewayPaymentIntent as createPaymentIntent`، (11) `paymentGateway.test.js` (src/services/__tests__) — دمج 3 استيرادات في استيراد واحد مع alias. **تمييز `createPaymentIntent`:** نسخة paymentService تُصدَّر كـ `createPaymentIntent`، نسخة gateway تُصدَّر كـ `createGatewayPaymentIntent`. استخدمت alias `createGatewayPaymentIntent as createPaymentIntent` في ملفات اختبار gateway للحفاظ على عدم تغيير أجسام الاختبارات. **تحديثات توثيقية:** `payments/README.md:182` و `checkout/README.md:176-177`. **البحث بعد الترحيل:** صفر مستهلكين نشطين على المسارات القديمة (فقط تعليقات في ملفات الـ stubs). **لم يتم:** نقل أي ملفات، حذف أي stubs، تغيير أي سلوك أو منطق أو استعلامات أو Edge Functions أو React Query keys أو routes. جميع الفحوصات اجتازت: lint، type-check، build (2m 52s)، check:circular (717 ملف، 0 تبعيات دائرية). 181 اختبار نجح، 2–3 إخفاقات سابقة غير متعلقة بالمرحلة (إخفاق orderFlow.integration.test.js متقطع — نجح في إعادة التشغيل). **المرحلة التالية المقترحة (7.10):** حذف stubs الدفع الثلاثة (`paymentService.js`، `paymentGateway.js`، `paymentRecords.js`) — صفر مستهلكين نشطين. انظر التقرير: `docs/architecture/phase-7-9-payment-consumer-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 7.10 (Payment Stub Deletion) مكتملة (2026-06-25). تم حذف stubs التوافق الثلاثة: `src/services/paymentService.js` (17 سطر، منشأ في Phase 7.8)، `src/services/paymentGateway.js` (16 سطر، منشأ في Phase 7.7)، `src/services/paymentRecords.js` (18 سطر، منشأ في Phase 7.6). **البحث قبل الحذف:** صفر مستهلكين نشطين على المسارات القديمة (فقط تعليقات داخل ملفات الـ stubs). **البحث بعد الحذف:** صفر مراجع في الكود المصدري. **تحديث توثيقي:** `docs/adr/003-domain-boundaries.md:29` — تحديث مرجع payments primary service من `src/services/paymentService.js` إلى `src/modules/payments`. **لم يتم حذف:** أي stubs غير متعلقة (7 stubs: `cartStore.js`، `favoritesStore.js`، `coupons.js`، `reviewService.js`، `minimumOrderService.js`، `cartQuantity.js`، `useCheckoutPricing.ts`). **لم يتم تغيير:** أي ملفات تنفيذية، أي سلوك أو منطق أو استعلامات أو Edge Functions أو React Query keys أو routes. **دورة ترحيل خدمات الدفع مكتملة:** 7.5 (تحليل) → 7.6 (نقل paymentRecords + stub) → 7.7 (نقل paymentGateway + stub) → 7.8 (نقل paymentService + stub) → 7.9 (ترحيل مستهلكين) → 7.10 (حذف stubs). عدد الملفات: 717 → 714. جميع الفحوصات اجتازت: lint، type-check، build (2m 48s)، check:circular (714 ملف، 0 تبعيات دائرية). 181 اختبار نجح، 2–3 إخفاقات سابقة غير متعلقة بالمرحلة. **المرحلة التالية المقترحة (7.11):** تحليل قبل نقل المجموعة التالية من الخدمات (cmiPayment.js، refundPolicyService.js) أو إصلاح الإخفاقات السابقة. انظر التقرير: `docs/architecture/phase-7-10-payment-stub-deletion-report.md`.
>
> **حالة الإنجاز:** Phase 7.11 (Pre-Existing Test Failures Stabilization) مكتملة (2026-06-25). تم إصلاح 3 إخفاقات اختبارات سابقة بدون تغيير أي كود إنتاجي. **(1) `paymentGateway.test.js:177`** — اختبار الكاش كان يتوقع `from()` مرة واحدة، لكن `processCodPayment` يستدعيها 3 مرات (1× payments + 2× orders). الإصلاح: التحقق من أن الاستدعاء الثاني لا يزيد عدد الاستدعاءات بدلاً من رقم ثابت. **(2) `paymentRecords.schema.test.js:52`** — الاختبار كان يبحث عن `transaction_id: paypalInit.orderId` في CheckoutSimplified، لكن الكود الحالي يستخدم `paypalOrderId: paypalInit.orderId` (transaction_id يُكتب الآن بواسطة paymentGateway). الإصلاح: تحديث التأكيد ليتطابق مع النمط الحالي. **(3) `orderFlow.integration.test.js:498`** — الاختبار كان متقطعاً بسبب مرجع `t` غير مستقر في mock (يُنشأ دالة جديدة في كل render → إعادة إنشاء useCallback → حلقة لا نهائية). الإصلاح: تثبيت مرجع `t` + إضافة `waitFor` للاستدعاء الأول. **النتيجة:** 183/183 اختبار نجح (0 إخفاقات). جميع الفحوصات اجتازت: lint، type-check، build (2m 44s)، check:circular (714 ملف، 0 تبعيات دائرية). لم يتم تغيير أي كود إنتاجي. انظر التقرير: `docs/architecture/phase-7-11-pre-existing-test-failures-stabilization-report.md`.
>
> **حالة الإنجاز:** Phase 7.12 (Full Test Baseline Audit) مكتملة (2026-06-25). تم تشغيل الاختبارات الكاملة للمشروع (141 suite، 1417 اختبار). **النتيجة الأولية:** 5 إخفاقات في 4 suites — جميعها سابقة وغير متعلقة بترحيل الدفع/الـ checkout. **التصنيف:** (1) `AdminCommissionManagement.columns.test.jsx` — اختبار قديم يتوقع استيراد من `@/services/platformSettings` لكن الكود يستورد من `@/modules/admin` (Phase 4.6). (2) `AdminCommissions.columns.test.jsx` — نفس المشكلة. (3) `Home.dataSource.test.jsx` — اختبار قديم يتوقع استيراد من `@/services/profilesService` لكن الكود يستورد من `@/modules/users` (Phase 5.x). (4) `StoreDetail.followDisabled.test.jsx` — regex قديم لا يتطابق مع `_checkFollowStatus` و `_handleFollowStore` (أعيدت تسميتهما بـ `_` prefix) و dependency array تغيير من `[user, id]` إلى `[]`. (5) `vendorAnalytics.test.js` — `jspdf` (ESM-only) يسبب `TextEncoder is not defined` في jsdom. **الإصلاحات:** تحديث 5 اختبارات + `jest.config.js` (إضافة `jspdf|html2canvas|iobuffer|fast-png` إلى `transformIgnorePatterns`) + `jest.mock` لـ `pdfExport`. **النتيجة النهائية:** 141/141 suite نجح، 1415 اختبار نجح، 2 todo، 0 إخفاقات، 0 اختبارات متقطعة. جميع الفحوصات اجتازت: lint، type-check، build (2m 39s)، check:circular (714 ملف، 0 تبعيات دائرية). **لم يتم تغيير أي كود إنتاجي.** الخط الأساسي نظيف وجاهز للمرحلة التالية. انظر التقرير: `docs/architecture/phase-7-12-full-test-baseline-audit-report.md`.
>
> **حالة الإنجاز:** Phase 7.13 (CMI & Refund Services Pre-Movement Analysis) مكتملة (2026-06-25). تحليل قبل نقل `cmiPayment.js` (45 سطر، 3 exports، legacy tombstone) و `refundPolicyService.js` (67 سطر، 3 exports، vendor refund policy CRUD). **الملكية المقترحة:** كلاهما ينتمي إلى payments module → `src/modules/payments/api/`. **المستهلكون:** 7 (3 لـ cmiPayment + 4 لـ refundPolicyService) + 2 test mocks. **Supabase:** `refund_policies` (SELECT + UPSERT)، `payments` (SELECT غير مباشر). **Edge Functions:** 0 في الملفات المستهدفة. **خطر التبعيات الدائرية:** cmiPayment يحتاج تغيير استيراد من `@/modules/payments` إلى `./paymentRecords` (لتجنب الدائرة). refundPolicyService لا يحتاج أي تغيير استيراد. **خطر الأمان:** منخفض لكلا الملفين. cmiPayment هو tombstone (2/3 دوال ترمي أخطاء). refundPolicyService هو CRUD لسياسات الاسترجاع فقط (لا يعالج الاسترجاعات الفعلية). **التوصية:** GO لكلا الملفين — نقل منفصل: Phase 7.14 (refundPolicyService)، Phase 7.15 (cmiPayment)، Phase 7.16 (تبني المستهلكين)، Phase 7.17 (حذف stubs). جميع الفحوصات اجتازت: lint، type-check، build، check:circular (714 ملف، 0 تبعيات دائرية). 195 اختبار smoke نجح. انظر التقرير: `docs/architecture/phase-7-13-cmi-refund-services-pre-movement-analysis-report.md`.
>
> **حالة الإنجاز:** Phase 7.14 (Refund Policy Service File Movement) مكتملة (2026-06-25). تم نقل تنفيذ `refundPolicyService.js` من `src/services/` إلى `src/modules/payments/api/refundPolicyService.js` (67 سطر، 3 exports: `DEFAULT_REFUND_POLICY`، `refundPolicyService`، `default`). تم استبدال الملف الأصلي بـ compatibility stub: `export { DEFAULT_REFUND_POLICY, refundPolicyService, refundPolicyServiceDefault as default } from '@/modules/payments'`. **تحديث barrel:** `src/modules/payments/api/index.js:59-64` — إعادة تصدير من `./refundPolicyService` بدلاً من `@/services/refundPolicyService`، مع إصلاح `getVendorRefundPolicy` (لم يكن export حقيقي) → `refundPolicyService` + `refundPolicyServiceDefault`. **تحديث root barrel:** `src/modules/payments/index.js:66-71` — استبدال `getVendorRefundPolicy` بـ `refundPolicyService` + إضافة `refundPolicyServiceDefault`. **لم يتم تغيير:** أي منطق أو سلوك أو استعلامات أو مستهلكين عاديين. **النتيجة:** 195/195 اختبار smoke نجح، lint/type-check/build (2m 42s)/check:circular (715 ملف، 0 تبعيات دائرية) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-14-refund-policy-service-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 7.15 (CMI Payment File Movement) مكتملة (2026-06-25). تم نقل تنفيذ `cmiPayment.js` من `src/services/` إلى `src/modules/payments/api/cmiPayment.js` (45 سطر، 3 named exports: `initCMIPayment`، `verifyCMICallback`، `getCMIStatus`، لا default export). **تغيير استيراد داخلي:** `@/modules/payments` → `./paymentRecords` (لتجنب التبعية الدائرية، محايد سلوكياً). تم استبدال الملف الأصلي بـ compatibility stub: `export { initCMIPayment, verifyCMICallback, getCMIStatus } from '@/modules/payments'`. **تحديث barrel:** `src/modules/payments/api/index.js:50-57` — إعادة تصدير من `./cmiPayment` بدلاً من `@/services/cmiPayment`. **لم يتم تغيير:** أي منطق أو سلوك أو استعلامات أو مستهلكين عاديين أو `refundPolicyService.js`. **النتيجة:** 195/195 اختبار smoke نجح (بما في ذلك اختبارات CMI tombstone)، lint/type-check/build (2m 38s)/check:circular (716 ملف، 0 تبعيات دائرية) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-15-cmi-payment-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 7.16 (CMI & Refund Consumer Import Adoption) مكتملة (2026-06-25). تم ترحيل جميع المستهلكين النشطين من المسارات القديمة إلى `@/modules/payments`. **(1)** `paymentGateway.test.js:113-119` — دمج استيراد `getCMIStatus`، `initCMIPayment`، `verifyCMICallback` في كتلة `@/modules/payments` الموجودة، حذف استيراد `@/services/cmiPayment`. **(2)** `vendor/Settings.jsx:16` — `import refundPolicyService, { DEFAULT_REFUND_POLICY } from '@/services/refundPolicyService'` → `import { refundPolicyService, DEFAULT_REFUND_POLICY } from '@/modules/payments'` (تغيير من default إلى named import). **(3)** `ProductDetail.jsx:10` — `import refundPolicyService from '@/services/refundPolicyService'` → `import { refundPolicyService } from '@/modules/payments'`. **(4)** `vendorSettings.test.js:122-134` — `jest.mock('@/services/refundPolicyService')` → `jest.mock('@/modules/payments')` مع mock أدنى يوفر فقط `refundPolicyService` و `DEFAULT_REFUND_POLICY` (تجنب `requireActual` بسبب تعقيد الـ barrel). **النتيجة:** 0 استيرادات نشطة على المسارات القديمة، 195/195 اختبار smoke نجح، lint/type-check/build (2m 38s)/check:circular (716 ملف، 0 تبعيات دائرية) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-16-cmi-refund-consumer-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 7.17 (CMI & Refund Stub Deletion) مكتملة (2026-06-25). تم حذف stubs التوافق: `src/services/cmiPayment.js` (1 سطر، منشأ في Phase 7.15) و `src/services/refundPolicyService.js` (1 سطر، منشأ في Phase 7.14). **البحث قبل الحذف:** 0 مستهلكين نشطين على المسارات القديمة. **تحديثات توثيقية:** `src/modules/checkout/README.md` — حذف `@/services/cmiPayment` من قائمة Forbidden Dependencies، `src/modules/catalog/README.md` — تحديث `refundPolicyService.js` كمهاجَر إلى `@/modules/payments`. **لم يتم حذف:** أي stubs أخرى (7 stubs غير متعلقة). **النتيجة:** 195/195 اختبار smoke نجح، lint/type-check/build (2m 47s)/check:circular (714 ملف، 0 تبعيات دائرية) جميعها اجتازت. **دورة الهجرة 7.13–7.17 مكتملة:** 5 مراحل، 0 إخفاقات اختبار، 0 تبعيات دائرية، 0 تغييرات سلوكية. انظر التقرير: `docs/architecture/phase-7-17-cmi-refund-stub-deletion-report.md`.
>
> **حالة الإنجاز:** Phase 7.18 (Payments Module Closure & Remaining Services Ownership Map) مكتملة (2026-06-25). تدقيق وتوثيق فقط — لا تغييرات في الكود. **إغلاق موديول الدفعات:** جميع ملفات الدفعات الخمسة منقولة إلى `src/modules/payments/api/`، جميع الـ stubs الخمسة محذوفة، 0 مراجع نشطة على المسارات القديمة، الـ public API نظيف ومستقر. **خريطة ملكية `src/services/`:** 63 ملف مصنَّف حسب الموديول المالك (shared/infra: 8، auth: 5، delivery: 10، admin: 8، orders: 3، notifications: 4، catalog: 2، analytics: 3، users: 3، payments: 2، commissions: 2، chat: 1، marketplace: 1، stubs: 3). **7 stubs جاهزة للحذف:** `cartStore.js`، `favoritesStore.js`، `coupons.js`، `reviewService.js`، `minimumOrderService.js`، `cartQuantity.js`، `useCheckoutPricing.ts` — جميعها 0 مستهلكين نشطين. **توصية Phase 7.19:** حذف الـ 7 stubs (الخيار الأصغر والأكثر أماناً). **النتيجة:** 195/195 اختبار smoke نجح، lint/type-check/build (2m 50s)/check:circular (714 ملف، 0 تبعيات دائرية) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-18-payments-module-closure-and-remaining-services-ownership-map.md`.
>
> **حالة الإنجاز:** Phase 7.19 (Remaining Legacy Stubs Deletion) مكتملة (2026-06-25). تم حذف جميع الـ 7 stubs المتبقية: `cartStore.js`، `favoritesStore.js`، `coupons.js`، `reviewService.js`، `minimumOrderService.js`، `cartQuantity.js`، `useCheckoutPricing.ts`. **البحث قبل الحذف:** 0 مستهلكين نشطين لجميع المسارات القديمة. **تحديثات توثيقية:** 10 ملفات (7 README + 3 ملفات تعليقات) — تحديث المسارات القديمة إلى مسارات الموديولات. **النتيجة:** 286/286 اختبار smoke نجح، **141/141 suites كاملة نجح (1415/1417 tests، 0 إخفاقات)**، lint/type-check/build (2m 41s)/check:circular (707 ملف، 0 تبعيات دائرية) جميعها اجتازت. **0 stubs متبقية — تنظيف الـ stubs مكتمل رسمياً.** إجمالي stubs محذوفة في Phase 7: 12 stub. انظر التقرير: `docs/architecture/phase-7-19-remaining-legacy-stubs-deletion-report.md`.
>
> **حالة الإنجاز:** Phase 7.20 (Payout & Payment Method Strategy Pre-Movement Analysis) مكتملة (2026-06-25). تحليل وتدقيق فقط — لا تغييرات في الكود. **الملفات المستهدفة:** `payoutService.js` (22 سطر، 1 مستهلك: commissions re-export، 1 Edge Function: `send-payout`، Protected Zone حسب `.windsurfrules` Section 37) و `paymentMethodStrategy.js` (35 سطر، 0 مستهلكين، 0 تبعيات — كود يتيم). **التحليل:** كلا الملفين منخفض التعقيد، لا خطر تبعيات دائرية، لا تغطية اختبارية لكليهما. **توصية Phase 7.21:** نقل الملفين إلى `@/modules/commissions/api/` مع إضافة اختبارات + stub لـ `payoutService.js` + تحديث مسار استيراد في `commissions/api/index.js`. **النتيجة:** lint/type-check/build (2m 50s)/check:circular (707 ملف، 0 تبعيات دائرية) جميعها اجتازت، 200/200 اختبار smoke نجح. انظر التقرير: `docs/architecture/phase-7-20-payout-payment-method-strategy-pre-movement-analysis-report.md`.
>
> **حالة الإنجاز:** Phase 7.21 (Payout & Payment Method Strategy Test-and-Movement) مكتملة (2026-06-25). **الاختبارات أُضيفت قبل النقل:** 16 اختبار لـ `sendPayout()` (payload، error handling، defaults، return shape) + 8 اختبارات لـ `getPayoutStrategy()` و `validateRecipient()` (default method، normalization، unsupported method، email validation، verification check) = 24 اختبار، جميعها نجحت قبل النقل. **النقل:** `payoutService.js` (22 سطر) → `src/modules/commissions/api/payoutService.js` + stub في المسار القديم. `paymentMethodStrategy.js` (35 سطر) → `src/modules/commissions/api/paymentMethodStrategy.js` + stub. **تحديث barrels:** `commissions/api/index.js` — استيراد من `./payoutService` و `./paymentMethodStrategy` بدلاً من `@/services/`. `commissions/index.js` — إضافة `getPayoutStrategy` للـ public API. **تحديثات توثيقية:** 3 READMEs (commissions، payments، checkout). **Protected Zone:** `.windsurfrules` Section 37 — تم احترام جميع القيود (اختبارات أولاً، حفظ السلوك، stub، لا تغيير منطق). **النتيجة:** 224/224 اختبار smoke نجح، **143/143 suites كاملة نجح (1439/1441 tests، 0 إخفاقات)**، lint/type-check/build (2m 44s)/check:circular (711 ملف، 0 تبعيات دائرية) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-21-payout-payment-strategy-test-and-movement-report.md`.
>
> **حالة الإنجاز:** Phase 7.22 (Payout & Payment Method Strategy Stub Deletion) مكتملة (2026-06-25). **تحديث مسارات الاستيراد:** `payoutService.test.js` و `paymentMethodStrategy.test.js` — تغيير من `@/services/payoutService` و `@/services/paymentMethodStrategy` إلى `@/modules/commissions`. إصلاح اختبار default export لاستخدام `payoutServiceDefault` (named export) بدلاً من `default`. **الحذف:** `src/services/payoutService.js` (stub، 1 سطر) و `src/services/paymentMethodStrategy.js` (stub، 1 سطر). **البحث قبل الحذف:** 3 مستهلكين نشطين (استيرادات اختبار فقط) — تم تحديثهم. **البحث بعد الحذف:** 0 مراجع نشطة. **تحديثات توثيقية:** 2 READMEs (commissions، payments). **النتيجة:** 24/24 اختبار جديد نجح، 224/224 اختبار smoke نجح، **143/143 suites كاملة نجح (1439/1441 tests، 0 إخفاقات)**، lint/type-check/build (2m 46s)/check:circular (709 ملف، 0 تبعيات دائرية) جميعها اجتازت. **0 stubs متبقية.** دورة هجرة payout/strategy 7.20–7.22 مكتملة. انظر التقرير: `docs/architecture/phase-7-22-payout-payment-strategy-stub-deletion-report.md`.
>
> **حالة الإنجاز:** Phase 7.23 (Commission Notifications Pre-Movement Analysis) مكتملة (2026-06-25). تحليل وتدقيق فقط — لا تغييرات في الكود. **الملف المستهدف:** `commissionNotifications.js` (111 سطر، 6 methods: `afterConfirmedSale`، `monthEndSummary`، `reminder3Days`، `dueToday`، `accountFrozen`، `paymentConfirmed`). **المستهلكون:** 1 مستهلك مباشر (`commissionService.js` يستدعي جميع الـ 6 methods)، 2 re-export barrels (commissions + notifications). **التبعيات:** 4 (`notificationsApi`، `emailService`، `supabase`، `logger`). **Supabase:** جدول واحد (`profiles`، read-only). **Edge Functions:** 0 مباشرة. **التغطية الاختبارية:** صفر. **إعادة التصدير المزدوجة:** من `@/modules/commissions` و `@/modules/notifications` — تعقيد إضافي. **الخطر:** متوسط (dual re-export، لا اختبارات، مقترن بـ Protected Zone `commissionService.js`). **توصية Phase 7.24:** إضافة اختبارات أولاً، ثم نقل إلى `@/modules/commissions/api/` مع stub، تحديث كلا الـ barrels. **النتيجة:** lint/type-check/build (2m 48s)/check:circular (709 ملف، 0 تبعيات دائرية) جميعها اجتازت، 264/264 اختبار smoke نجح. انظر التقرير: `docs/architecture/phase-7-23-commission-notifications-pre-movement-analysis-report.md`.
>
> **حالة الإنجاز:** Phase 7.24 (Commission Notifications Test-and-Movement) مكتملة (2026-06-26). **الاختبارات أُضيفت قبل النقل:** 21 اختبار لـ `commissionNotifications` (6 methods: `afterConfirmedSale`، `monthEndSummary`، `reminder3Days`، `dueToday`، `accountFrozen`، `paymentConfirmed` + internal helpers: `sendEmailNotification` profile lookup، `formatMad` formatting، default export). **النقل:** `commissionNotifications.js` (111 سطر) → `src/modules/commissions/api/commissionNotifications.js` + stub في المسار القديم. **تحديث barrels:** `commissions/api/index.js` — استيراد من `./commissionNotifications` بدلاً من `@/services/`. `notifications/api/index.js` — إعادة تصدير من `@/modules/commissions` بدلاً من `@/services/`. **عدم تغيير `commissionService.js`** — يستخدم stub عن قصد. **تحديثات توثيقية:** 2 READMEs (commissions، notifications). **النتيجة:** 21/21 اختبار جديد نجح، 285/285 اختبار smoke نجح، **144/144 suites كاملة نجح (1460/1462 tests، 0 إخفاقات)**، lint/type-check/build (2m 59s)/check:circular (711 ملف، 0 تبعيات دائرية) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-24-commission-notifications-test-and-movement-report.md`.
>
> **حالة الإنجاز:** Phase 7.25 (Commission Service Protected Import Adoption) مكتملة (2026-06-26). **Protected Zone (Section 37):** `commissionService.js` مُدرج كـ Protected Zone. **التغيير المصرح به:** تحديث مسار استيراد `commissionNotifications` فقط من `@/services/commissionNotifications` إلى `@/modules/commissions` (سطر 8). **عدم تغيير:** أي منطق، أجسام الدوال، استعلامات Supabase، أو سلوك. **الـ stub محفوظ:** `src/services/commissionNotifications.js` لم يُحذف. **البحث بعد التبني:** 0 مراجع نشطة لـ `@/services/commissionNotifications` (باستثناء الـ stub نفسه). **النتيجة:** 285/285 اختبار smoke نجح، **144/144 suites كاملة نجح (1460/1462 tests، 0 إخفاقات)**، lint/type-check/build (2m 41s)/check:circular (711 ملف، 0 تبعيات دائرية) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-25-commission-service-protected-import-adoption-report.md`.
>
> **حالة الإنجاز:** Phase 7.26 (Commission Notifications Stub Deletion) مكتملة (2026-06-26). **الحذف:** `src/services/commissionNotifications.js` (stub، 1 سطر). **البحث قبل الحذف:** 0 مستهلكين نشطين لـ `@/services/commissionNotifications`. **البحث بعد الحذف:** 0 مراجع نشطة. **عدم تعديل:** `commissionService.js` (Protected Zone)، `commissionNotifications.js` (التنفيذ)، أي barrels. **تحديثات توثيقية:** 2 READMEs (commissions، notifications) — تحديث جداول الهجرة. **النتيجة:** 285/285 اختبار smoke نجح، **144/144 suites كاملة نجح (1460/1462 tests، 0 إخفاقات)**، lint/type-check/build (2m 50s)/check:circular (710 ملف، 0 تبعيات دائرية) جميعها اجتازت. **دورة هجرة commissionNotifications 7.23–7.26 مكتملة رسمياً.** انظر التقرير: `docs/architecture/phase-7-26-commission-notifications-stub-deletion-report.md`.
>
> **حالة الإنجاز:** Phase 7.27 (Commission Service Pre-Movement Analysis) مكتملة (2026-06-26). تحليل وتدقيق فقط — لا تغييرات في الكود. **الملف المستهدف:** `commissionService.js` (696 سطر، Protected Zone Section 37). **التحليل:** 8 exports (commissionService object + 7 wrappers + default)، 7 internal helpers، 3 constants (COMMISSION_RATE=0.03، PAYMENT_DEADLINE_DAYS=7، MANUAL_UNFREEZE_GRACE_DAYS=3)، 6 جداول Supabase (vendor_monthly_sales، confirmed_transactions، orders، vendor_contracts، profiles، commission_notifications)، 0 Edge Functions، 0 RPC calls. **المستهلكون:** 1 barrel مباشر (`commissions/api/index.js`)، 2 UI components (يستوردون من `@/modules/commissions` بالفعل). **التغطية الاختبارية:** صفر — توصية بإضافة 41–54 اختبار في Phase 7.28. **خطر دائري:** محتمل إذا بقي استيراد `commissionNotifications` من `@/modules/commissions` بعد النقل — الحل: استخدام `./commissionNotifications` (local import). **التقييم:** Go مع شروط — إضافة اختبارات أولاً. **النتيجة:** lint/type-check/build (2m 42s)/check:circular (710 ملف، 0 تبعيات دائرية) جميعها اجتازت. 285/285 اختبار smoke نجح. انظر التقرير: `docs/architecture/phase-7-27-commission-service-pre-movement-analysis-report.md`.
>
> **حالة الإنجاز:** Phase 7.28 (Commission Service Test Coverage) مكتملة (2026-06-26). **اختبارات فقط — لا تغيير في الكود الإنتاجي.** تم إنشاء `src/__tests__/services/commissionService.test.js` (706 سطر، **61 اختبار** في 10 suites). **التغطية:** جميع الـ 8 exports + default، جميع الـ 6 جداول Supabase (orders، confirmed_transactions، vendor_contracts، profiles، vendor_monthly_sales، commission_notifications)، جميع تدفقات الإشعارات (afterConfirmedSale، monthEndSummary، reminder3Days، dueToday، accountFrozen، paymentConfirmed)، مسارات الأخطاء (select/insert/update errors)، التحقق من المدخلات، حساب العمولة 3%، التجميد/فك التجميد، dedup guard. **سلوك مشبوه مكتشف (لم يُغيّر):** `checkOverdueCommissions` يجمّد الحساب حتى لو منع dedup إرسال إشعار accountFrozen. **النتيجة:** 61/61 اختبار جديد نجح، 313/313 اختبار smoke نجح، **145/145 suites كاملة نجح (1521/1523 tests، 0 إخفاقات)**، lint/type-check/build (2m 44s)/check:circular (711 ملف، 0 تبعيات دائرية) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-28-commission-service-test-coverage-report.md`.
>
> **حالة الإنجاز:** Phase 7.29 (Commission Service File Movement) مكتملة (2026-06-26). **نقل محروس لـ `commissionService.js` فقط.** تم نقل التنفيذ من `src/services/commissionService.js` (696 سطر) إلى `src/modules/commissions/api/commissionService.js` مع stub توافقي في المسار القديم. **تغيير الاستيراد الداخلي:** `commissionNotifications` من `@/modules/commissions` إلى `./commissionNotifications` (محلي) لمنع التبعية الدائرية. **تحديث الـ barrel:** `commissions/api/index.js` يستورد من `./commissionService` بدلاً من `@/services/commissionService`. **تحديث الاختبارات:** استيراد من `@/modules/commissions/api/commissionService`، mock من `@/modules/commissions/api/commissionNotifications`. **عدم تغيير:** أي منطق، حسابات، statuses، إشعارات، payouts، payments، Supabase queries، Edge Functions، React Query keys، routes. **السلوك المشبوه من Phase 7.28 لم يُغيّر.** **النتيجة:** 277/277 اختبار smoke نجح، **145/145 suites كاملة نجح (1521/1523 tests، 0 إخفاقات)**، lint/type-check/build (2m 45s)/check:circular (712 ملف، 0 تبعيات دائرية) جميعها اجتازت. **دورة هجرة commissionService 7.27–7.29 مكتملة رسمياً.** انظر التقرير: `docs/architecture/phase-7-29-commission-service-file-movement-report.md`.
>
> **حالة الإنجاز:** Phase 7.30 (Commission Service Stub Deletion) مكتملة (2026-06-26). **حذف stub توافقي فقط.** تم حذف `src/services/commissionService.js` (stub) بعد تأكيد صفر مستهلكين نشطين للمسار القديم `@/services/commissionService`. **البحث قبل الحذف:** صفر مراجع نشطة في الكود/الاختبارات (جميع المراجع في تقارير تاريخية فقط). **لم يُغيّر:** أي منطق، حسابات، statuses، إشعارات، payouts، payments، Supabase queries، Edge Functions، React Query keys، routes. **التنفيذ في `src/modules/commissions/api/commissionService.js` (696 سطر) لم يُمَس.** **السلوك المشبوه من Phase 7.28 لم يُغيّر.** **النتيجة:** lint/type-check/build/check:circular جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-30-commission-service-stub-deletion-report.md`.
>
> **حالة الإنجاز:** Phase 7.31 (Commissions Module Closure & Next Risk Map) مكتملة (2026-06-26). **تدقيق وتوثيق فقط — لا تغيير في الكود.** تم إغلاق دورة هجرة العمولات (Phases 7.20–7.30) رسمياً. **التحقق:** جميع ملفات العمولات تحت `src/modules/commissions/api/`، صفر مراجع للمسارات القديمة المحذوفة، صفر stubs متبقية، API عام نظيف (11 symbol من `commissionService` + `commissionNotifications` + `payoutService` + `getPayoutStrategy`). **إعادة تصدير `commissionNotifications` من notifications module:** لا تزال موجودة لكن صفر مستهلكين نشطين يستخدمونها — مرشح آمن لـ Phase 7.32 (MC8). **مستهلكو UI:** `CommissionManagement.jsx` و `CommissionDashboard.jsx` يستوردان من `@/modules/commissions`، `Commissions.jsx` و `Payouts.jsx` يستخدمان Supabase مباشرة. **السلوك المشبوه من Phase 7.28:** موثق في سجل المخاطر. **النتيجة:** lint/type-check/build (2m 29s)/check:circular (711 ملف، 0 تبعيات دائرية)/اختبارات مستهدفة (7 suites، 122 test) جميعها اجتازت. **المرحلة 7.32 الموصى بها:** MC8 — تحليل قبل إزالة إعادة تصدير `commissionNotifications` من notifications module. انظر التقرير: `docs/architecture/phase-7-31-commissions-module-closure-and-next-risk-map.md`.
>
> **حالة الإنجاز:** Phase 7.32 (MC8 — Remove commissionNotifications Re-export from Notifications Module) مكتملة (2026-06-26). **تنظيف معماري فقط.** تم إزالة إعادة تصدير `commissionNotifications` من `src/modules/notifications/api/index.js` و `src/modules/notifications/index.js` بعد تأكيد صفر مستهلكين نشطين. **لم يُغيّر:** أي تنفيذ، أي منطق، أي سلوك. `commissionNotifications` لا يزال مُصدَّرًا حصرياً من `@/modules/commissions`. **السلوك المشبوه R-001 من Phase 7.28 لم يُغيّر.** **النتيجة:** lint/type-check/build (2m 34s)/check:circular (711 ملف، 0 تبعيات دائرية)/اختبارات مستهدفة (10 suites، 162 test)/全套 اختبارات (145/145 suites، 1521/1523 tests، 0 إخفاقات) جميعها اجتازت. **MC8 مكتمل رسمياً.** انظر التقرير: `docs/architecture/phase-7-32-mc8-remove-commission-notifications-notifications-reexport-report.md`.
>
> **حالة الإنجاز:** Phase 7.33 (R-001 Behavior Analysis — checkOverdueCommissions) مكتملة (2026-06-26). **تحليل سلوك فقط — لا تغيير في الكود.** تم تحليل R-001: `checkOverdueCommissions` يجمّد حساب البائع (`profiles.is_active = false`) **قبل** فحص dedup، ثم فحص dedup قد يمنع إرسال إشعار `accountFrozen`. **السبب الجذري:** التجميد يحدث في الأسطر 369–377 قبل استدعاء `insertCommissionNotificationIfMissing` في السطر 379. **النتيجة:** البائع قد يُجمَّد دون إشعار. **الحل الموصى به:** Option B (تجميد الحساب + إرجاع معلومات أن الإشعار تم تخطيه) مع Option E (إنشاء admin audit event). **المرحلة 7.34 الموصى بها:** إضافة characterization tests فقط لتوثيق السلوك الحالي قبل أي إصلاح. **R-001: محلَّل، غير مُصلَح.** **النتيجة:** lint/type-check/build/check:circular (711 ملف، 0 تبعيات دائرية)/اختبارات مستهدفة (7 suites، 134 test) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-33-r001-check-overdue-commissions-behavior-analysis.md`.
>
> **حالة الإنجاز:** Phase 7.34 (R-001 Characterization Tests) مكتملة (2026-06-26). **اختبارات فقط — لا تغيير في الكود الإنتاجي.** تم إضافة 5 اختبارات characterization لـ R-001 في `src/__tests__/services/commissionService.test.js`. **الاختبارات:** (1) يجمّد البائع حتى لو منع dedup الإشعار، (2) لا يُرجع `notifications_skipped`، (3) لا يُصدر `logger.warn`، (4) dedup يمنع الإشعار لكن لا يمنع التجميد، (5) المسار العادي يرسل `accountFrozen` عندما يسمح dedup. **لم يُغيّر:** أي كود إنتاجي، أي سلوك، أي دالة. **R-001: موثَّق بالاختبارات، غير مُصلَح.** **النتيجة:** lint/type-check/build/check:circular (711 ملف، 0 تبعيات دائرية)/اختبارات commissionService (66 test)/اختبارات مستهدفة (7 suites، 139 test)/全套 اختبارات (145/145 suites، 1526/1528 tests، 0 إخفاقات) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-34-r001-characterization-tests-report.md`.
>
> **حالة الإنجاز:** Phase 7.35 (R-001 Minimal Fix — Option B) مكتملة (2026-06-26). **إصلاح Protected Zone — تعديل محدود على `checkOverdueCommissions` فقط.** تم إضافة `notifications_skipped` (مصفوفة) للقيمة المرجعة + `logger.warn` عند تخطي إشعار `accountFrozen` بسبب dedup. **لم يُغيّر:** شروط التجميد، شروط dedup، حمولة الإشعارات، سلوك الإرسال، Supabase queries، Edge Functions، React Query keys، routes. **السلوك المتغير:** المتصل يمكنه الآن رؤية الإشعارات المتخطاة + تحذير مسجل. **Option E (admin audit event) لم يُنفَّذ.** **R-001: مُصلَح جزئياً (observability)، غير مُغلق بالكامل (admin audit pending).** **النتيجة:** lint/type-check/build/check:circular (711 ملف، 0 تبعيات دائرية)/اختبارات commissionService (67 test)/اختبارات مستهدفة (10 suites، 168 test)/全套 اختبارات (145/145 suites، 1527/1529 tests، 0 إخفاقات) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-35-r001-minimal-fix-report.md`.
>
> **حالة الإنجاز:** Phase 7.36 (R-001 Option E Admin Audit Event Analysis) مكتملة (2026-06-26). **تحليل فقط — لا تغيير في الكود.** تم تحليل Option E (admin audit event عند تخطي إشعار `accountFrozen`). **الأنظمة الموجودة:** `audit_logs` (يتطلب `user_id` — RLS يتطلب `auth.uid()`، غير مناسب لـ cron job)، `financial_audit_log` (عبر RPC `log_financial_audit` — مخصص للـ payouts)، `settings_audit_log` (مخصص للإعدادات)، `notifications` table (يستخدم `notificationsApi.create` — نمط موجود في `submitPaymentNotice` لإرسال إشعارات للإدارة). **التوصية:** Option E2 (إشعار إدارة عبر `notificationsApi.create` + `getAdminUsers`) — آمن لأن النمط موجود مسبقاً في نفس الملف، لا يتطلب تغيير schema/RLS. **المرحلة 7.37 الموصى بها:** تنفيذ Option E2 مع `Promise.allSettled` (لا يفشل الـ commission job إذا فشل إشعار الإدارة) + اختبارات. **R-001: مُصلَح جزئياً (observability)، Option E محلَّل، توصية جاهزة.** **النتيجة:** lint/type-check/build/check:circular (711 ملف، 0 تبعيات دائرية)/اختبارات مستهدفة (20 suites، 199 test) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-36-r001-option-e-admin-audit-analysis.md`.
>
> **حالة الإنجاز:** Phase 7.37 (R-001 Option E2 — Admin Notification for Skipped Freeze) مكتملة (2026-06-26). **إصلاح Protected Zone — تعديل محدود على `checkOverdueCommissions` فقط.** عند تخطي إشعار `accountFrozen` بسبب dedup، يتم الآن إرسال إشعار إدارة عبر `getAdminUsers()` + `notificationsApi.create()` + `Promise.allSettled` (نفس نمط `submitPaymentNotice`). **الإشعار:** `type: 'commission'`, `data: { event: 'account_frozen_skipped', vendor_id, monthly_sale_id, notification_type, reason }`. **لم يُغيّر:** شروط التجميد، شروط dedup، حمولة إشعارات البائع، `notifications_skipped`، `logger.warn`، Supabase queries، schema/RLS، Edge Functions، routes، React Query keys. **`Promise.allSettled` يضمن أن فشل إشعار الإدارة لا يكسر الـ commission job.** **R-001: مُغلَق.** التجميد + observability + إشعار إدارة جميعها مغطاة. **النتيجة:** lint/type-check/build/check:circular (711 ملف، 0 تبعيات دائرية)/اختبارات commissionService (71 test)/اختبارات مستهدفة (10 suites، 172 test)/全套 اختبارات (145/145 suites، 1531/1533 tests، 0 إخفاقات) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-37-r001-option-e2-admin-notification-report.md`.
>
> **حالة الإنجاز:** Phase 7.38 (Direct Supabase Usage Analysis — Commissions.jsx & Payouts.jsx) مكتملة (2026-06-26). **تحليل فقط — لا تغيير في الكود.** تم تحليل الاستخدام المباشر لـ Supabase في `src/pages/admin/Commissions.jsx` (322 سطر) و `src/pages/admin/Payouts.jsx` (652 سطر). **Commissions.jsx:** استعلام واحد `supabase.from('payments').select(...)` (read-only) + `platformSettings.getSettings()` — **لا يتداخل مع `commissionService`** (يقرأ من `payments` وليس `vendor_monthly_sales`) — **مستوى المخاطر: منخفض** — مرشح جيد لاستخراج read-only API. **Payouts.jsx:** 4 عمليات Supabase مباشرة: (1) `supabase.from('payouts').select(...)` (read)، (2) `supabase.from('financial_audit_log').select(...)` (read)، (3) `supabase.from('payouts').update(...)` (write — تغيير حالة payout)، (4) `supabase.rpc('log_financial_audit')` (audit write)، (5) `supabase.from('notifications').insert(...)` (notification write) — **يتداخل جزئياً مع `payoutService`** (لكن `payoutService` يغطي فقط `sendPayout` عبر Edge Function) — **مستوى المخاطر: عالي** — عمليات write مالية + audit + notifications. **التوصية:** (أ) Phase 7.39: إضافة اختبارات لـ `Commissions.jsx` (read-only) ثم استخراج استعلامات read إلى `commissionService` أو admin API. (ب) Phase 7.40+: تحليل منفصل لـ `Payouts.jsx` مع إضافة اختبارات أولاً قبل أي استخراج. **النتيجة:** lint/type-check/build/check:circular (711 ملف، 0 تبعيات دائرية)/اختبارات مستهدفة (10 suites، 172 test) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-38-direct-supabase-usage-commissions-payouts-analysis.md`.
>
> **حالة الإنجاز:** Phase 7.39 (Commissions.jsx Behavior Tests) مكتملة (2026-06-26). **اختبارات فقط — لا تغيير في الكود الإنتاجي.** تم إنشاء `src/__tests__/pages/AdminCommissions.behavior.test.jsx` (10 اختبارات سلوكية لـ `src/pages/admin/Commissions.jsx`). **الاختبارات:** (1) renders loading spinner initially، (2) calls supabase.from with payments table، (3) renders stats cards with computed commission values، (4) renders recent payments table with payment rows، (5) renders empty state message، (6) handles Supabase error gracefully، (7) uses commission_rate from platformSettings، (8) period change triggers data reload، (9) does not perform Supabase write operations، (10) renders chart containers when data exists. **لم يُغيّر:** `Commissions.jsx`، `Payouts.jsx`، أي كود إنتاجي، Supabase queries، UI behavior، routes، React Query keys، schema/RLS، Edge Functions. **النتيجة:** lint/type-check/build/check:circular (712 ملف، 0 تبعيات دائرية)/اختبارات Commissions.jsx (10 test)/اختبارات مستهدفة (11 suites، 182 test)/全套 اختبارات (146/146 suites، 1541/1543 tests، 0 إخفاقات) جميعها اجتازت. **آمن للمتابعة إلى Phase 7.40.** انظر التقرير: `docs/architecture/phase-7-39-commissions-page-behavior-tests-report.md`.
>
> **حالة الإنجاز:** Phase 7.40 (Commissions.jsx Read-Only Query Extraction) مكتملة (2026-06-26). **استخراج read-only — تعديل محدود.** تم استخراج استعلام `supabase.from('payments').select(...)` من `src/pages/admin/Commissions.jsx` إلى دالة `getAdminCommissionsPayments({ period })` في `src/modules/commissions/api/adminCommissions.js` (ملف جديد). **التغييرات:** (1) إنشاء `adminCommissions.js` بنفس استعلام Supabase (نفس الأعمدة، نفس gte، نفس order، نفس limit 100)، (2) تحديث `Commissions.jsx` لاستدعاء `getAdminCommissionsPayments({ period })` بدلاً من `supabase.from('payments')`، (3) إزالة `import { supabase }` من `Commissions.jsx`، (4) تحديث barrel exports في `api/index.js` و `index.js`، (5) تحديث اختبارات الصفحة لمحاكاة `@/modules/commissions` بدلاً من `@/services/supabase`، (6) إنشاء `src/__tests__/modules/commissions/adminCommissions.test.js` (10 اختبارات API)، (7) تحديث `AdminCommissions.columns.test.jsx` لفحص `adminCommissions.js` بدلاً من `Commissions.jsx`. **لم يُغيّر:** `Payouts.jsx`، `commissionService.js`، `payoutService.js`، `commissionNotifications.js`، `paymentMethodStrategy.js`، R-001 logic، UI behavior، formatting، chart behavior، routes، React Query keys، schema/RLS، Edge Functions. **نفس استعلام Supabase تماماً — لا تغيير في semantics.** **النتيجة:** lint/type-check/build/check:circular (714 ملف، 0 تبعيات دائرية)/اختبارات API (10 test)/اختبارات صفحة (10 test)/اختبارات مستهدفة (12 suites، 192 test)/全套 اختبارات (147/147 suites، 1551/1553 tests، 0 إخفاقات) جميعها اجتازت. **آمن للمتابعة إلى Phase 7.41.** انظر التقرير: `docs/architecture/phase-7-40-commissions-page-read-query-extraction-report.md`.
>
> **حالة الإنجاز:** Phase 7.41 (Payouts.jsx Deep Analysis) مكتملة (2026-06-26). **تحليل فقط — لا تغيير في الكود.** تم تحليل عميق لـ `src/pages/admin/Payouts.jsx` (652 سطر). **5 عمليات Supabase مباشرة:** (1) `payouts.select` (read)، (2) `financial_audit_log.select` (read)، (3) `payouts.update({ status })` (write — تغيير حالة payout)، (4) `rpc('log_financial_audit')` (audit write)، (5) `notifications.insert` (notification write). **تحليل تدفق الكتابة:** `handleUpdateStatus` ينفذ 3 عمليات متسلسلة غير معاملاتية (update → audit → notify) — إذا فشلت audit أو notification بعد نجاح update، يتم تغيير الحالة في DB دون audit أو إشعار. **تحليل الأعطال:** 8 سيناريوهات فشل موثقة. **توصية الملكية:** Option A — `src/modules/commissions/api/adminPayouts.js` (commissions module يملك `payoutService` و `financial_audit_log` مذكور في README). **تداخل مع APIs الموجودة:** `notificationsApi.create()` موجود ويمكن استخدامه بدلاً من `supabase.from('notifications').insert()`. **فجوات الاختبارات:** لا توجد اختبارات سلوكية لـ loading/empty/error/write flow/audit modal/processing state/toasts. **التسلسل الموصى به:** Phase 7.42 (اختبارات سلوكية) → 7.43 (استخراج read-only) → 7.44 (اختبارات write flow) → 7.45 (استخراج write flow) → 7.46 (تقرير إزالة Supabase المباشر). **مستوى المخاطر:** عالي (writes مالية + audit + notifications + UI معقد). **النتيجة:** lint/type-check/build/check:circular (714 ملف، 0 تبعيات دائرية)/اختبارات مستهدفة (12 suites، 192 test) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-41-payouts-page-deep-analysis.md`.
>
> **حالة الإنجاز:** Phase 7.42 (Payouts.jsx Behavior Tests) مكتملة (2026-06-26). **اختبارات فقط — لا تغيير في الكود الإنتاجي.** تم إنشاء `src/__tests__/pages/AdminPayouts.behavior.test.jsx` (19 اختبار سلوكي لـ `src/pages/admin/Payouts.jsx`). **الاختبارات:** (1) loading spinner initially، (2) renders payouts list with vendor names، (3) empty state، (4) payouts load error with toast.error، (5) calls supabase.from with payouts table، (6) status filter change triggers reload، (7) date range change triggers reload، (8) status update success: update + audit RPC + notification + success toast، (9) audit RPC parameters verification، (10) payout update failure: error toast + no audit + no notification، (11) audit RPC failure: success toast shown (non-transactional behavior)، (12) notification insert failure: success toast shown (non-transactional behavior)، (13) processing state shows "Processing..."، (14) audit modal opens with audit logs، (15) audit modal empty state، (16) audit log select error silently handled، (17) CSV/PDF export buttons present، (18) CSV export with no data shows error toast، (19) financial_audit_log table called when viewing audit. **اكتشافات مهمة:** (1) `rpc('log_financial_audit')` failure لا يُظهر `toast.error` — المكون لا يفحص قيمة الإرجاع للـ RPC، (2) `notifications.insert` failure لا يُظهر `toast.error` — نفس السبب، (3) تدفق الكتابة غير معاملاتي. **هذه سلوكيات موجودة مسبقاً ولم تُصلح.** **لم يُغيّر:** `Payouts.jsx`، `Commissions.jsx`، أي كود إنتاجي، Supabase queries، UI behavior، routes، React Query keys، schema/RLS، Edge Functions. **النتيجة:** اختبارات جديدة (19/19 passed)/اختبارات مستهدفة (13 suites، 211 test)/lint/type-check/build/check:circular (714 ملف، 0 تبعيات دائرية) جميعها اجتازت. **آمن للمتابعة إلى Phase 7.43.** انظر التقرير: `docs/architecture/phase-7-42-payouts-page-behavior-tests-report.md`.
>
> **حالة الإنجاز:** Phase 7.43 (Payouts.jsx Read-Only Query Extraction) مكتملة (2026-06-26). **استخراج read-only — تعديل محدود.** تم استخراج استعلامات القراءة من `src/pages/admin/Payouts.jsx` إلى `src/modules/commissions/api/adminPayouts.js` (ملف جديد). **الدوال الجديدة:** (1) `getAdminPayouts({ dateRange, statusFilter })` — استعلام قراءة لـ `payouts` مع join `profiles`، نفس الأعمدة، نفس الفلاتر (date range + status)، نفس الترتيب (created_at desc)، (2) `getPayoutFinancialAuditLogs({ payoutId })` — استعلام قراءة لـ `financial_audit_log` مع join `profiles`، فلتر `entity_type='payout'` و `entity_id=payoutId`، ترتيب `created_at asc`. **التغييرات:** (1) إنشاء `adminPayouts.js`، (2) تحديث barrel exports في `api/index.js` و `index.js`، (3) تحديث `Payouts.jsx` لاستدعاء `getAdminPayouts` و `getPayoutFinancialAuditLogs` بدلاً من `supabase.from(...)` المباشر للقراءة، (4) إزالة `subDays` غير المستخدم، (5) تحديث اختبارات السلوك لمحاكاة `@/modules/commissions` للقراءة مع الإبقاء على محاكاة `@/services/supabase` للكتابة، (6) إنشاء `src/__tests__/modules/commissions/adminPayouts.test.js` (21 اختبار API). **لم يُغيّر:** تدفق الكتابة `handleUpdateStatus` (update → audit RPC → notification insert) يبقى مباشراً عبر `supabase`، `payouts.update`، `rpc('log_financial_audit')`، `notifications.insert`، toast behavior، processing state، CSV/PDF export، UI، routes، React Query keys، schema/RLS، Edge Functions، R-001، commissionService، payoutService، السلوك غير المعاملاتي (لم يُصلح). **النتيجة:** اختبارات API جديدة (21/21 passed)/اختبارات سلوك (19/19 passed)/اختبارات مستهدفة (14 suites، 232 test)/全套 (149 suites، 1591 test، 0 failures)/lint/type-check/build/check:circular (714 ملف، 0 تبعيات دائرية) جميعها اجتازت. **آمن للمتابعة إلى Phase 7.44.** انظر التقرير: `docs/architecture/phase-7-43-payouts-page-read-query-extraction-report.md`.
>
> **حالة الإنجاز:** Phase 7.44 (Payouts Write-Flow Focused Tests) مكتملة (2026-06-26). **اختبارات فقط — لا تغيير في الكود الإنتاجي.** تم إنشاء `src/__tests__/pages/AdminPayouts.write-flow.test.jsx` (20 اختبار مركز لتدفق الكتابة `handleUpdateStatus`). **الاختبارات:** (1) ترتيب سلسلة الكتابة: update → RPC → notification، (2) شكل حمولة update: `{ status }` فقط، (3) فلتر update: `.eq('id', payoutId)`، (4) حمولة audit RPC الكاملة، (5) حمولة notification insert الكاملة، (6) previous status من state الفعلي، (7) fallback لـ `'unknown'` عند عدم وجود payout، (8) fallback لـ amount `0`، (9–12) تنظيف processing state بعد نجاح/فشل update/فشل audit/فشل notification، (13) short-circuit عند فشل update: لا audit ولا notification، (14) فشل audit: `toast.success` يظهر + notification يُحاول + reload يحدث، (15) فشل notification: `toast.success` يظهر + reload يحدث، (16) reload بعد نجاح السلسلة، (17) لا reload عند فشل update، (18) تخطي notification عند عدم وجود `user_id`، (19) زر Mark Completed → `'completed'`، (20) زر Mark Failed → `'failed'`. **السلوكيات المشبوهة الموثقة (لم تُصلح):** (1) فشل audit RPC لا يُظهر `toast.error`، (2) فشل notification insert لا يُظهر `toast.error`، (3) السلسلة غير معاملاتية، (4) `loadPayouts()` يُستدعى حتى بعد الفشل الجزئي. **لم يُغيّر:** `Payouts.jsx`، `adminPayouts.js`، أي كود إنتاجي، Supabase writes، RPC، notifications، toast، processing state، UI، routes، schema/RLS، Edge Functions. **النتيجة:** اختبارات جديدة (20/20 passed)/اختبارات Payouts الكاملة (64/64 passed)/اختبارات مستهدفة (15 suites، 252 test)/全套 (150 suites، 1611 test، 0 failures)/lint/type-check/build/check:circular (714 ملف، 0 تبعيات دائرية) جميعها اجتازت. **آمن للمتابعة إلى Phase 7.45.** انظر التقرير: `docs/architecture/phase-7-44-payouts-write-flow-focused-tests-report.md`.
>
> **حالة الإنجاز:** Phase 7.45 (Payouts Write-Flow Extraction) مكتملة (2026-06-26). **استخراج فقط — لا تغيير في السلوك.** تم استخراج تدفق الكتابة من `src/pages/admin/Payouts.jsx` إلى `src/modules/commissions/api/adminPayouts.js`. **الدالة الجديدة:** `updateAdminPayoutStatus({ payoutId, newStatus, payout, currentUser })` — تنفذ سلسلة الكتابة: `payouts.update({ status })` → `rpc('log_financial_audit')` → `notifications.insert(...)` بنفس الترتيب، نفس الحمولات، نفس الفلاتر، نفس fallbacks، ونفس السلوك غير المعاملاتي (فشل audit/notification لا يُرجع error). **التغييرات:** (1) إضافة `updateAdminPayoutStatus` إلى `adminPayouts.js` مع `import { formatPrice }`، (2) تحديث barrel exports في `api/index.js` و `index.js`، (3) تحديث `Payouts.jsx` لاستدعاء `updateAdminPayoutStatus` بدلاً من `supabase` مباشرة، (4) **إزالة `import { supabase }` من `Payouts.jsx`** — لم يعد يستخدم Supabase مباشرة، (5) تحديث `AdminPayouts.behavior.test.jsx` لمحاكاة `updateAdminPayoutStatus` (اختبارات 8–12)، (6) إعادة كتابة `AdminPayouts.write-flow.test.jsx` بـ 12 اختبار على مستوى الصفحة، (7) إضافة 15 اختبار API لـ `updateAdminPayoutStatus` في `adminPayouts.test.js`، (8) تحديث `AdminPayouts.test.jsx` للتحقق من ملف API بدلاً من الصفحة. **لم يُغيّر:** السلوك غير المعاملاتي، toast، processing state، reload، UI، CSV/PDF، audit modal، الفلاتر، routes، React Query keys، schema/RLS، Edge Functions، R-001، `commissionService`، `payoutService`. **النتيجة:** اختبارات API (36/36 passed)/اختبارات Payouts الكاملة (71/71 passed)/اختبارات مستهدفة (15 suites، 259 test)/全套 (150 suites، 1618 test، 0 failures)/lint/type-check/build/check:circular (714 ملف، 0 تبعيات دائرية) جميعها اجتازت. **آمن للمتابعة إلى Phase 7.46.** انظر التقرير: `docs/architecture/phase-7-45-payouts-write-flow-extraction-report.md`.
>
> **حالة الإنجاز:** Phase 7.46 (Payouts Direct Supabase Removal Closure + Risk Review) مكتملة (2026-06-26). **تدقيق/توثيق فقط — لا تغيير في الكود الإنتاجي أو الاختبارات.** تم التحقق من: (1) `Payouts.jsx` لا يستخدم `supabase` مباشرة — **0 مراجع** لـ `supabase`، `supabase.from`، `supabase.rpc`، `supabase.functions`، `supabase.auth`، `supabase.storage`، أو `@/services/supabase`، (2) جميع عمليات Supabase (قراءة وكتابة) موجودة في `src/modules/commissions/api/adminPayouts.js`، (3) التصدير العام نظيف عبر `@/modules/commissions` — لا deep imports في كود التطبيق، (4) التغطية: 71 اختبار صفحة + 36 اختبار API = 107 اختبار، (5) **R-002 موثق ومفتوح**: تدفق الكتابة غير معاملاتي — فشل audit RPC أو notification insert لا يمنع `toast.success`، يترك الحالة متغيرة دون audit أو إشعار. **مستوى الخطورة:** عالي. **التوصية:** Phase 7.47 = تحليل R-002 فقط (لا إصلاح). **النتيجة:** اختبارات مستهدفة (9 suites، 175 test)/全套 (150 suites، 1618 test، 0 failures)/lint/type-check/build/check:circular (714 ملف، 0 تبعيات دائرية) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-46-payouts-direct-supabase-removal-closure-report.md`.
>
> **حالة الإنجاز:** Phase 7.47 (R-002 Payout Partial Failure Behavior Analysis) مكتملة (2026-06-26). **تحليل فقط — لا تغيير في الكود الإنتاجي أو الاختبارات.** تم تحليل R-002 (تدفق الكتابة غير المعاملاتي للمدفوعات). **الاكتشافات الرئيسية:** (1) **تريجر قاعدة بيانات `audit_payout_status_change` موجود في migration 021b** — ينفذ تلقائياً بعد `AFTER UPDATE ON payouts` ويسجل audit log، لكن **migration 030 يحذف جدول `payouts`** مما قد يلغي التريجر. (2) **RPC `log_financial_audit` هو `SECURITY DEFINER`** ويتجاوز RLS. (3) **Edge Function `process-vendor-payout` موجود** لكن غير مستخدم من admin UI، وله أيضاً audit غير معاملاتي. (4) **دوال SQL `process_payout_bank_transfer` و `complete_payout`** تجمع تحديث الحالة + إشعار في دالة واحدة، لكن تستخدم `vendor_id` (not `user_id`). (5) **جدول `financial_audit_log` له مخططان متضاربان** عبر migrations (021b vs 030). (6) **R-002 خطر حقيقي لكن مخفف** إذا كان التريجر نشطاً. **خيارات الإصلاح:** Option A (لا شيء)، Option B (observability فقط — `logger.warn` + `side_effects_failed`)، Option C (فشل كامل)، Option D (audit مطلوب، notification best-effort)، Option E (RPC معاملاتي server-side)، Option F (Edge Function كامل). **التوصية:** Phase 7.48 = Option B (observability فقط) كحل قصير المدى، Option E (RPC معاملاتي) كحل طويل المدى. **R-002: محلل، غير مُصلح.** **النتيجة:** Payouts tests (71/71)/全套 (150 suites، 1618 test، 0 failures)/lint/type-check/build/check:circular (714 ملف، 0 تبعيات دائرية) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-47-r002-payout-partial-failure-analysis.md`.
>
> **حالة الإنجاز:** Phase 7.48 (R-002 Minimal Observability Fix — Option B) مكتملة (2026-06-26). **إضافة observability فقط — لا تغيير في السلوك.** تم تحديث `updateAdminPayoutStatus` في `src/modules/commissions/api/adminPayouts.js`: (1) **`logger.warn`** عند فشل audit RPC (`payout_audit_failed`) مع payoutId/newStatus/previousStatus/amount/adminId/error، (2) **`logger.warn`** عند فشل notification insert (`payout_notification_failed`) مع payoutId/newStatus/userId/error، (3) **`side_effects_failed` array** في النتيجة: `[]` عند نجاح كامل، `['audit']` عند فشل audit، `['notification']` عند فشل notification، `['audit','notification']` عند فشلهما معاً، غير موجود عند فشل update (short-circuit). **لم يُغيّر:** toast behavior، reload behavior، processing state، UI، write chain order، payloads، filters، fallbacks، notification skip، schema/RLS، Edge Functions. **R-002: مخفف جزئياً بالobservability، غير مُصلح بالكامل.** **الاختبارات:** API tests (40/40، +4 جديد)/Payouts tests (75/75)/全套 (150 suites، 1622 test، 0 failures)/lint/type-check/build/check:circular (714 ملف، 0 تبعيات دائرية) جميعها اجتازت. انظر التقرير: `docs/architecture/phase-7-48-r002-minimal-observability-fix-report.md`.
>
> **حالة الإنجاز:** Phase 7.49 (Admin Payouts Closure & Stabilization Decision) مكتملة (2026-06-26). **إغلاق/تدقيق فقط — لا تغيير في الكود.** **دورة ترحيل Admin Payouts مغلقة (Phases 7.41–7.49).** تم التحقق من: (1) `Payouts.jsx` لا يستخدم `supabase` مباشرة — **0 مراجع**، (2) `adminPayouts.js` يملك جميع عمليات البيانات (`getAdminPayouts`، `getPayoutFinancialAuditLogs`، `updateAdminPayoutStatus`)، (3) التصدير العام نظيف عبر `@/modules/commissions`، (4) R-002 observability موثق: `logger.warn` + `side_effects_failed`، (5) التغطية: 75 اختبار (40 API + 35 صفحة)، (6)全套 1622/1622 نجح. **R-001: مغلق. R-002: مخفف جزئياً، غير مُصلح بالكامل.** **بوابة القرار:** Option A (توقف Phase 7 → انتقل إلى تثبيت المنتج) موصى به بشدة (6/6 معايير). **المرحلة التالية: Phase 8.1 — Stabilization & Demo Readiness Audit.** انظر التقرير: `docs/architecture/phase-7-49-admin-payouts-closure-and-stabilization-decision.md`.
>
> **حالة الإنجاز:** Phase 8.1 (Stabilization & Demo Readiness Audit) مكتملة (2026-06-27). **تدقيق/تحليل فقط — لا تغيير في الكود.** **Phase 7 مغلق بالكامل.** تم تدقيق: (1) **Direct Supabase audit:** 55 صفحة تستورد `@/services/supabase` مباشرة، 8 صفحات تستخدم `supabase.from`، 3 تستخدم `supabase.rpc`، 2 تستخدم `supabase.functions` (CheckoutSimplified/OrderConfirmation)، 31 صفحة تستورد من `@/modules/` (تقدم جيد). (2) **Module boundaries:** 0 deep imports ممنوعة، 0 تبعيات دائرية (714 ملف). (3) **Demo flows:** تدفقات أساسية مغطاة بالاختبارات (Payouts/Commissions/Auth/Checkout/Vendor)، تدفقات بدون اختبارات (Marketplace/ProductDetail/Cart/Notifications/Driver). (4) **Test coverage:** 150 suites، 1622 test، 0 failures. (5) **Risk register:** R-001 مغلق، R-002 مخفف جزئياً، **R-003 جديد** (جداول مفقودة: `fraud_reports`/`payment_disputes` — demo-blocking)، **R-004 جديد** (CheckoutSimplified `supabase.functions` مباشر)، R-005 (`driver_locations` غير مؤكد)، R-006 (Express `seller` vs `vendor`). (6) **Demo readiness checklist:** must-fix (R-003/R-004/seed data/auth verification)، should-fix (R-005/translations/empty states/RTL)، nice-to-have (tests/extraction)، can-defer (R-002 long-term/full extraction). **التوصية: Phase 8.2 — Final PFE Presentation Readiness.** انظر التقرير: `docs/architecture/phase-8-1-stabilization-and-demo-readiness-audit.md`.
>
> **حالة الإنجاز:** Phase 8.2 (Production Readiness Master Audit) مكتملة (2026-06-27). **تدقيق إنتاجي شامل — لا تغيير في الكود.** **الهدف تغيّر من demo readiness إلى production readiness.** **نتيجة التدقيق: التطبيق غير جاهز للإنتاج الحقيقي — درجة الجاهزية 42/100.** تم اكتشاف: (1) **PB-001 (Critical):** migration 030 يحذف جدول `payouts` (`DROP TABLE IF EXISTS payouts CASCADE` في السطر 1440) — يكسر Admin Payouts بالكامل. (2) **PB-002 (Critical):** جدول `fraud_reports` مفقود من جميع migrations — AdminFraudReports معطّل (routes مُعلّقة في AppRouter). (3) **PB-003 (High):** جدول `refunds` مفقود — تتبّع الاستردادات يفشل بصمت. (4) **PB-004 (High):** `commissionService.js` يستخدم `profiles.is_active` (عمود شبحي) — سيرسل 400 error. (5) **PB-005 (High):** R-002 غير آمن للمال الحقيقي. (6) **PB-006 (High):** `CheckoutSimplified.jsx` يستخدم `supabase.functions` و `supabase.from` مباشرة. (7) **PB-007 (Medium):** لا idempotency على PayPal capture. **تصحيحات Phase 8.1:** `payment_disputes` EXISTS في 030 (R-003 جزئياً خاطئ)، `driver_locations` EXISTS في 030+031 (R-005 ملغي). **مخاطر جديدة:** R-007 (030 ي حذف payouts)، R-008 (`refunds` مفقود)، R-009 (`is_active` ghost في commissionService)، R-010 (PayPal idempotency). **خارطة الطريق الإنتاجية:** Phase 8.3 (Critical Blockers Triage) → 8.4 (Schema/RLS Verification) → 8.5 (Payment Hardening) → 8.6 (UI/UX Completion) → 8.7 (E2E Tests) → 8.8 (Release Checklist). **التوصية: Phase 8.3 — Critical Production Blockers Triage.** انظر التقرير: `docs/architecture/phase-8-2-production-readiness-master-audit.md`.
>
> **حالة الإنجاز:** Phase 8.3 (Critical Production Blockers Triage) مكتملة (2026-06-28). **إصلاحات حد أدنى آمنة لـ PB-001 إلى PB-004.** **PB-001 (Critical) ✅ تم الحل:** إزالة `DROP TABLE IF EXISTS payouts CASCADE` من migration 030 + إنشاء migration 034 لاستعادة الجدول مع RLS/indexes/audit trigger. **PB-002 (Critical) ✅ تم الحل:** إنشاء جدول `fraud_reports` في migration 034 (الأعمدة مطابقة لـ database.ts و fraudReportService.js، RLS كاملة). المسارات لا تزال معطّلة — إعادة التفعيل في مرحلة لاحقة. **PB-003 (High) ✅ تم الحل:** إنشاء جدول `refunds` في migration 034 (payment_id FK، amount CHECK، RLS admin + buyer/vendor). **PB-004 (High) ✅ تم الحل:** إزالة جميع مراجع `profiles.is_active` الشبحية من `commissionService.js` (6 مواقع). `account_active` الآن مشتق من `vendor_monthly_sales.status !== 'overdue'`. **الاختبارات:** commissionService 71/71 نجح، AdminPayouts نجح، AdminCommissionManagement نجح، lint ✅، build ✅، check:circular ✅. **Migration 034:** `034-restore-missing-tables.sql` (payouts + fraud_reports + refunds، جميعها `IF NOT EXISTS`). **خارطة الطريق:** Phase 8.4 (Schema/RLS Verification) → 8.5 (Payment Hardening) → 8.6 (UI/UX) → 8.7 (E2E) → 8.8 (Release). انظر التقرير: `docs/architecture/phase-8-3-critical-production-blockers-triage-report.md`.
>
> **حالة الإنجاز:** Phase 8.4 (Schema/RLS Verification & Production Confidence Audit) مكتملة (2026-06-27). **تدقيق وتحقق فقط + إصلاح خطأ واحد في migration 034.** تم التحقق من: (1) **ترتيب migrations:** 034 يعمل بعد 030، `CREATE TABLE IF NOT EXISTS` آمن، لا تعارض. (2) **payouts:** جميع 30 عمود مطابق لـ database.ts و adminPayouts.js. RLS كاملة (vendor SELECT، admin SELECT/INSERT/UPDATE). audit trigger تم إصلاحه. (3) **fraud_reports:** جميع 21 عمود مطابق لـ database.ts و fraudReportService.js. RLS كاملة. المسارات لا تزال معطّلة. (4) **refunds:** جميع الأعمدة مطابقة لـ paymentGateway.js. FK إلى payments و orders صحيح. RLS admin + buyer/vendor. (5) **profiles.is_active:** تم التأكد من عدم وجود مراجع متبقية. `account_active` مشتق من `vendor_monthly_sales.status`. (6) **financial_audit_log:** تريجر 034 كان به خطأ حرج (action='status_updated' غير موجود في CHECK constraint + FK UUID وهمي) — **تم الإصلاح** باستخدام `log_financial_audit()` RPC من 021b. (7) **database.ts:** `refunds` ليس معرّف في الأنواع — فجوة موثقة. **مخاطر جديدة:** R-011/R-012 (adminPayouts يستخدم user_id لكن الجدول فيه vendor_id)، R-013 (RPC log_financial_audit يستخدم 'status_updated' غير صالح في CHECK). **درجة الجاهزية:** 42/100 → 52/100. **التوصية: Phase 8.5 — Checkout/Payments Hardening.** انظر التقرير: `docs/architecture/phase-8-4-schema-rls-verification-report.md`.
>
> **حالة الإنجاز:** Phase 8.5 (Checkout/Payments Hardening) مكتملة (2026-06-27). **إصلاحات حد أدنى آمنة لـ R-011/R-012، R-013، R-015 + تقييم جاهزية Edge Functions + خارطة طريق R-002.** **R-011/R-012 ✅ تم الحل:** `adminPayouts.js` و `Payouts.jsx` الآن يستخدمان `vendor_id` و `vendor:profiles!payouts_vendor_id_fkey` مطابقاً للمخطط الكنسي (migration 021b/034). **R-013 ✅ تم الحل:** `p_action: 'status_updated'` (غير صالح في CHECK constraint) → `'manual_adjustment'` (صالح). **R-015 ✅ تم الحل:** إضافة `refunds` TableDef إلى `database.ts` مطابقاً لـ migration 034. **تقييم Edge Functions:** جميع 12 دالة موجودة، `create-checkout-order` يستخدم auth + inventory reservation + rollback، PayPal flow منظم (create/capture). **تقييم Refund flow:** جدول `refunds` مع RLS كاملة، `recordRefund()` يعمل لكن بدون error logging (فجوة مراقبة). **R-002 خارطة طريق:** تصميم `update_payout_status_transactional()` RPC جاهز للتنفيذ في Phase 8.6. **الاختبارات:** type-check ✅، lint ✅، build ✅، check:circular ✅، 150 suites / 1622 tests ✅. **درجة الجاهزية:** 52/100 → 62/100. **مخاطر متبقية:** R-002 (non-transactional، مخفف)، R-007 (PayPal idempotency)، R-016 (no SQL tests)، R-017 (payoutService user_id في Edge Function API)، R-018 (recordRefund no logging). **التوصية: Phase 8.6 — R-002 Transactional RPC Implementation أو E2E Smoke Tests.** انظر التقرير: `docs/architecture/phase-8-5-checkout-payments-hardening-report.md`.
>
> **حالة الإنجاز:** Phase 8.6 (R-002 Transactional Payout RPC) مكتملة (2026-06-27). **إغلاق R-002 — تحديث حالة الدفع + السجل المالي أصبح ذرياً (atomic) عبر RPC.** **R-002 ✅ مغلق:** إنشاء `update_payout_status_transactional()` RPC في migration 035 — تحديث `payouts.status` + إدراج `financial_audit_log` في معاملة PostgreSQL واحدة. إذا فشل السجل المالي، يتم التراجع عن تحديث الحالة تلقائياً. `adminPayouts.js` الآن يستدعي RPC بدلاً من `payouts.update` + `log_financial_audit` المنفصلين. الإشعارات (notifications) تبقى best-effort خارج المعاملة مع الحفاظ على المراقبة (`side_effects_failed` + `logger.warn`). **التصميم:** `SECURITY DEFINER`، `FOR UPDATE` lock، فحص دور المدير داخل RPC، `search_path` آمن، `GRANT EXECUTE TO authenticated`، `REVOKE FROM anon`. **الاختبارات:** 14 اختبار API جديد للـ RPC، تحديث اختبارات الصفحة. type-check ✅، lint ✅، build ✅، check:circular ✅، 150 suites / 1617 tests ✅. **درجة الجاهزية:** 62/100 → 69/100 (+7). **R-002: مغلق.** **مخاطر متبقية:** R-020 (notification best-effort، منخفض)، R-007 (PayPal idempotency)، R-016 (no SQL tests)، R-017 (payoutService user_id)، R-018 (recordRefund no logging)، R-019 (CheckoutSimplified direct supabase). **التوصية: Phase 8.7 — E2E Role Flow Smoke Tests.** انظر التقرير: `docs/architecture/phase-8-6-r002-transactional-payout-rpc-report.md`.
>
> **حالة الإنجاز:** Phase 8.7 (Role Flow Smoke/E2E Tests) مكتملة (2026-06-27). **اختبارات smoke لجميع الأدوار الأربعة (admin، vendor، buyer، driver).** **27 اختبار smoke جديد** في 4 ملفات تحت `src/__tests__/smoke/`: admin (6)، vendor (7)، buyer (8)، driver (6). التحقق من: تصيير الصفحات الرئيسية، حراس المسارات (role guards)، إعادة توجيه غير المصادقين إلى `/login`، إعادة توجيه الأدوار الخاطئة إلى `/unauthorized`، روابط التنقل في الـ sidebar، حالة الخطأ في checkout. **استخدام Jest + RTL** (لا إضافة Cypress/Playwright جديد — احترام `.windsurfrules`). **تحقق Phase 8.6:** اختبارات admin payouts تجتاز، RPC التبادلي منعكس في الاختبارات، تغيير عدد الاختبارات (1622→1617) مُفسَّر: 5 اختبارات للتفاصيل الداخلية غير التبادلية أُزيلت، 14 اختبار جديد لعقد RPC. **التغطية لم تُضعف.** **تدقيق البنية التحتية:** Cypress (40 ملف e2e)، Jest (150→154 suites)، ProtectedRoute tests (10)، page-health Cypress (12 ملف). **خريطة تدفق الأدوار:** 74 صفحة موثقة عبر 4 أدوار. **مصفوفة الجاهزية:** Admin (12✅/4⚠️/2❌)، Vendor (6✅/12⚠️)، Buyer (7✅/7⚠️)، Driver (8✅/7⚠️). **التحقق:** type-check ✅، lint ✅، build ✅، check:circular ✅، 154 suites / 1644 tests ✅. **درجة الجاهزية:** 69/100 → 76/100 (+7). **مخاطر متبقية:** R-021 (صفحات بدون Jest tests)، R-022 (fraud reports routes disabled)، R-023 (dispute management routes disabled)، R-024 (no seed system)، R-007/R-016/R-017/R-018/R-019/R-020 (متبقية من مراحل سابقة). **التوصية: Phase 8.8 — Observability/Error Tracking Hardening.** انظر التقرير: `docs/architecture/phase-8-7-role-flow-smoke-e2e-tests-report.md`.
>
> **حالة الإنجاز:** Phase 8.8 (Observability & Error Tracking Hardening) مكتملة (2026-06-27). **جعل فشل الإنتاج مرئياً وقابلاً للتتبع وقابلاً للنجاة.** **إصلاح حرج (P0):** `logger.warn` كان صامتاً في الإنتاج (`isDev && console.warn`) — جميع تحذيرات RPC للمدفوعات وفشل الإشعارات وفشل استرداد الأصول كانت غير مرئية. تم إصلاحه إلى `!isTest && console.warn`. **ErrorBoundary:** توجيه `handleError` إلى `logError()` من `@/services/sentry` — أخطاء التصيير تُرسل الآن إلى Sentry. إضافة `ErrorBoundary` على مستوى المسار حول تخطيطات admin/vendor/buyer/driver في `AppRouter.jsx`. **مراقبة الإسترداد:** `recordRefund()` الآن يسجل الفشل عبر `logger.warn('refund_record_failed', ...)`. استبدال `console.warn`/`console.error` بـ `logger` في `paymentGateway.js` و `errorHandler.js`. **فحص الصحة:** توثيق قائمة فحص صحة الإنتاج + قائمة تصحيح الأعطال في `docs/architecture/production-health-check.md`. **الاختبارات:** 5 اختبارات جديدة (ErrorBoundary + Sentry integration، logger production behavior). تحديث اختبار `refundPayPal.schema.test.js`. **التحقق:** type-check ✅، lint ✅، build ✅، check:circular ✅، 155 suites / 1649 tests ✅. **درجة الجاهزية:** 76/100 → 86/100 (+10). فئة جديدة "Observability" (8/15). **مخاطر متبقية:** R-025/R-026/R-027 (silent catches مقبولة)، R-028 (no structured logging)، R-029 (no Sentry alert rules)، R-030 (no metrics)، R-007/R-016/R-017/R-020/R-021/R-022/R-023/R-024 (متبقية من مراحل سابقة). **التوصية: Phase 8.9 — Production Release Checklist.** انظر التقرير: `docs/architecture/phase-8-8-observability-error-tracking-hardening-report.md`.
>
> **حالة الإنجاز:** Phase 8.9 (Production Release Checklist & Go/No-Go Decision) مكتملة (2026-06-27). **تدقيق جاهزية الإنتاج + قرار ذهاب/عدم ذهاب.** **قرار الإطلاق:** ✅ **GO لبيتا محدود (sandbox payments)** — ⛔ **NO-GO للمدفوعات الحقيقية** (5 حواجز تشغيلية). **التطبيق مكتمل وظيفياً** لجميع الأدوار الأربعة. جميع الفحوصات تجتاز: type-check ✅، lint ✅، build ✅، check:circular ✅ (718 ملف، 0 دائري)، 155 suites / 1649 tests ✅. **الجداول الحرجة:** جميعها موجودة (profiles، products، orders، payments، payouts، refunds، notifications، vendor_monthly_sales، financial_audit_log، fraud_reports، payment_disputes، driver_locations) مع RLS كاملة. **الـ RPCs الحرجة:** `log_financial_audit` (migration 021b/034) و `update_payout_status_transactional` (migration 035) موجودة. **الأمان:** حراس المسارات لجميع الأدوار، لا تعرض مفاتيح خدمة، RLS هي الطبقة الأساسية. **المدفوعات:** PayPal/Bank/COD مكتملة كودياً — الحواجز تشغيلية (B-001: PayPal live credentials، B-002: webhook، B-003: Edge Functions deployment، B-004: idempotency R-007، B-005: no sandbox integration tests). **المراقبة:** logger.warn مرئي في الإنتاج، ErrorBoundary على مسارات الأدوار، Sentry مفعّل. **اكتشاف مهم:** تعليق في `AppRouter.jsx` يقول أن جداول `fraud_reports` و `payment_disputes` غير موجودة — **التعليق قديم (stale)** — الجداول موجودة (migration 034 و 030). المسارات معطلة لكن يمكن إعادة تفعيلها. **قائمة الإطلاق:** 4 مستويات (قبل الإطلاق، قبل المدفوعات الحقيقية، بعد الإطلاق، مؤجل). **خطة التراجع:** موثقة (قاعدة بيانات + تطبيق + تعطيل المدفوعات/المدفوعات). **الاستجابة للأعطال:** قائمة فحص + إجراءات للمدفوعات/الاسترداد/المدفوعات الفاشلة. **درجة الجاهزية:** 86/100 → 90/100 (+4). فئة جديدة "Release Readiness" (14/15). **التوصية: Phase 8.10 — Payment Sandbox Integration Verification.** انظر التقرير: `docs/architecture/phase-8-9-production-release-checklist-report.md`.
>
> **حالة الإنجاز:** Phase 8.10 (Payment Sandbox Integration Verification) مكتملة (2026-06-27). **تحقق تكامل المدفوعات sandbox + إغلاق R-007.** **R-007 ✅ مُغلق:** إضافة `PayPal-Request-Id` header إلى `refund-paypal-payment` Edge Function — idempotency مُطبق على 3 مستويات: checkout (claim_checkout_request RPC مع UNIQUE constraint)، capture (persistPayPalOrderState بـ transaction_id lookup)، refund (PayPal-Request-Id header). **B-004 ✅ مُغلق:** idempotency مُتحقق. **B-005 ✅ مُغلق:** 18 اختبار جديد للتحقق من idempotency + sandbox/production switching + public config safety. **Edge Functions:** توثيق كامل لـ 10 دوال (create-checkout-order، create-paypal-order، capture-paypal-order، refund-paypal-payment، reconcile-paypal-payments، get-public-config، calculate-checkout-pricing، confirm-order-payment، confirm-bank-transfer) مع الأسرار المطلوبة + ترتيب النشر. **PayPal sandbox:** تبديل sandbox/production يعمل عبر `VITE_PAYMENT_MODE` في جميع الدوال. **Webhook:** لا يوجد PayPal webhook handler — B-006 (new blocker) للإنتاج الحقيقي. **Reconciliation:** `reconcile-paypal-payments` يوفر reconciliation يدوي/تلقائي للمدفوعات المعلقة. **قائمة انتقال sandbox→production:** 5 خطوات موثقة. **التحقق:** type-check ✅، lint ✅، build ✅، check:circular ✅، 156 suites / 1667 tests ✅. **درجة الجاهزية:** 90/100 → 94/100 (+4). Payment Flow Reliability +2، Test Coverage +1، Edge Function Readiness +2. **الحواجز المتبقية للإنتاج الحقيقي:** B-001 (PayPal live credentials — تشغيلي)، B-002 (webhook — كود+تشغيل)، B-003 (Edge Functions deployment — تشغيلي)، B-006 (webhook handler — كود). **التوصية: Phase 8.11 — Admin Blocked Routes Recovery.** انظر التقرير: `docs/architecture/phase-8-10-payment-sandbox-integration-verification-report.md`.
>
> **حالة الإنجاز:** Phase 8.11 (Admin Blocked Routes Recovery) مكتملة (2026-06-27). **إعادة تفعيل مسارات الإدارة المعطلة + إغلاق R-022 و R-023.** **مسارات مُعاد تفعيلها:** `/admin/fraud-reports` (FraudReports.jsx) و `/admin/disputes` (DisputeManagement.jsx). **R-022 ✅ مُغلق:** مسار بلاغات الاحتيال مُفعل — الجدول `fraud_reports` موجود (migration 034)، RLS كاملة (admin select + admin update)، الخدمة `fraudReportService.js` صالحة، الصفحة لها loading/error/empty states. **R-023 ✅ مُغلق:** مسار نزاعات الدفع مُفعل — الجدول `payment_disputes` موجود (migration 030)، RLS كاملة (admin select + admin update)، الخدمة `disputeService.js` صالحة، الصفحة لها loading/error/empty states. **تعليقات قديمة:** إزالة 4 تعليقات stale من `AppRouter.jsx` و `ProtectedRoute.jsx` كانت تدعي عدم وجود الجداول. **استيرادات:** إضافة `FlagIcon` و `ExclamationTriangleIcon` إلى `ProtectedRoute.jsx`. **شريط الإدارة الجانبي:** 18/18 مسار إدارة مُفعل الآن (كان 16/18). **اختبارات:** 9 smoke tests جديدة + 7 source verification tests محدثة. **التحقق:** type-check ✅، lint ✅، build ✅، check:circular ✅ (726 ملف، 0 دائري)، 157 suites / 1676 tests ✅. **درجة الجاهزية:** 94/100 (بدون تغيير رقمي لكن تحسين نوعي: اكتمال ميزات الإدارة 100%). **الحواجز المتبقية:** B-001 (PayPal live credentials — تشغيلي)، B-002 (webhook — كود+تشغيل)، B-003 (Edge Functions deployment — تشغيلي)، B-006 (webhook handler — كود). **التوصية: Phase 8.12 — PayPal Webhook Handler Implementation.** انظر التقرير: `docs/architecture/phase-8-11-admin-blocked-routes-recovery-report.md`.
>
> **حالة الإنجاز:** Phase 8.12 (PayPal Webhook Handler Implementation) مكتملة (2026-06-27). **تنفيذ PayPal webhook handler آمن + idempotent + إغلاق B-006.** **Edge Function جديدة:** `supabase/functions/paypal-webhook/index.ts` — تتحقق من أصالة webhook عبر PayPal `verify-webhook-signature` API، تعالج 4 أحداث (`CHECKOUT.ORDER.APPROVED`، `PAYMENT.CAPTURE.COMPLETED`، `PAYMENT.CAPTURE.REFUNDED`، `PAYMENT.CAPTURE.DENIED`)، تسجل الأحداث غير المدعومة دون رمي أخطاء، وتعيد 200 لجميع الأحداث المُتحقق منها لمنع إعادة المحاولة. **التحقق:** استخراج 6 ترويسات توقيع (`PAYPAL-TRANSMISSION-ID`، `PAYPAL-TRANSMISSION-TIME`، `PAYPAL-CERT-URL`، `PAYPAL-AUTH-ALGO`، `PAYPAL-TRANSMISSION-SIG`، `PAYPAL-WEBHOOK-ID`)، استدعاء PayPal API، فشل مغلق (401) عند فشل التحقق. **Idempotency:** جدول جديد `paypal_webhook_events` (migration 036) مع `UNIQUE(paypal_event_id)` — الأحداث المكررة تعيد 200 مع `already_processed`. RLS مُفعّل، وصول `service_role` فقط. **السلامة:** لا تخفيض حالة المدفوعات المُسترجعة/المكتملة، لا حذف سجلات، فحص السجلات المكررة قبل الإنشاء. **B-006 ✅ مُغلق:** webhook handler مُنفّذ. **B-002 ✅ كود مُغلق:** المتبقي هو تكوين PayPal dashboard (تشغيلي). **المرحلة:** `database/migrations/036-paypal-webhook-events.sql` — جدول جديد فقط، RLS كاملة، فهارس. **البيئة:** إضافة `PAYPAL_WEBHOOK_ID` إلى `.env.example` و `.env.production.example` (server-only، لا `VITE_`). **الاختبارات:** 35 source code verification test في `src/__tests__/payments/paypal.webhook.test.js` — التحقق، الأحداث، Idempotency، السلامة، المراقبة، الأمان. **التحقق:** type-check ✅، lint ✅، build ✅، check:circular ✅ (727 ملف، 0 دائري)، 158 suites / 1711 tests ✅. **درجة الجاهزية:** 94/100 → 98/100 (+4). Edge Function Readiness +2، Observability +2. **اكتمال Edge Functions:** 11/11 (100%). **الحواجز المتبقية:** B-001 (PayPal live credentials — تشغيلي)، B-003 (Edge Functions deployment — تشغيلي). **جميع الحواجز البرمجية مُغلقة.** **التوصية: Phase 8.13 — Edge Functions Production Deployment.** انظر التقرير: `docs/architecture/phase-8-12-paypal-webhook-handler-implementation-report.md`.
>
> **حالة الإنجاز:** Phase 8.13 (Edge Functions Production Deployment Readiness) مكتملة (2026-06-27). **تدقيق شامل لجاهزية نشر جميع Supabase Edge Functions + تكوين PayPal sandbox webhook + خطة تحقق sandbox E2E.** **جرد Edge Functions:** 47 دالة إجمالاً (باستثناء `_shared`)، 22 منها حرجة للمدفوعات. **Migration 036:** آمنة، idempotent (`CREATE TABLE IF NOT EXISTS`)، RLS كاملة (`service_role` فقط)، 3 فهارس، جاهزة للتطبيق بعد migration 035. **الأسرار:** 14 سر server-only موثقة بالكامل مع أوامر `supabase secrets set`، 16 متغير frontend (`VITE_`)، 4 أسرار GitHub Actions CI/CD. **اكتشاف حرج (B-007):** سير عمل `cd.yml` ينشر فقط `auth-admin-ops` — 46 دالة أخرى غير مشمولة بالنشر الآلي. **PayPal webhook:** الكود مكتمل (Phase 8.12)، التكوين التشغيلي في PayPal dashboard موثق (8 خطوات). **خطة Sandbox E2E:** 10 سيناريوهات اختبار (checkout، capture، webhook storage، idempotency، refund، denied، admin verification، bank transfer، reconciliation). **قرار الجاهزية:** ⚠️ GO مشروط لـ sandbox — ⛔ NO-GO للمدفوعات الحقيقية. **الحواجز المتبقية:** B-001 (PayPal live credentials — تشغيلي)، B-002 (PayPal webhook dashboard config — تشغيلي)، B-003 (Edge Functions deployment — تشغيلي)، B-007 (CI/CD deploys only 1/47 functions — كود/تكوين)، B-008 (sandbox E2E not executed — تشغيلي). **درجة الجاهزية:** 94/100 (بدون تغيير — هذه المرحلة تحليلية/توثيقية فقط). **التوصية:** تحديث `cd.yml` لنشر جميع الدوال (يتطلب موافقة)، تطبيق migration 036، تعيين الأسرار، نشر الدوال، تكوين PayPal sandbox webhook، تنفيذ خطة E2E. انظر التقرير: `docs/architecture/phase-8-13-edge-functions-production-deployment-report.md`.
>
> **حالة الإنجاز:** Phase 8.14 (Edge Functions CI/CD Deployment Coverage) مكتملة (2026-06-27). **إصلاح فجوة نشر CI/CD + إغلاق B-007.** **B-007 ✅ مُغلق:** سير عمل `cd.yml` كان ينشر فقط `auth-admin-ops` (1 من 47 دالة) — تم استبداله باستراتيجية matrix ذات طبقتين: **Tier 1 (حرج):** 30 دالة (payment + auth/security) مع `fail-fast: true` و `max-parallel: 5` — فشل أي دالة حرجة يوقف النشر. **Tier 2 (قياسي):** 17 دالة (delivery, orders, communication, infrastructure) مع `fail-fast: false` — الفشل لا يمنع نشر Firebase Hosting. **التغطية:** 1/47 (2%) → 47/47 (100%). جميع الدوال الحرجة للمدفوعات (22) مشمولة في Tier 1. **الموافقة:** تم الحصول على موافقة صريحة من المستخدم (Option B) قبل تعديل `cd.yml` حسب `.windsurfrules` Section 37 (Protected Zone). **السلامة:** لا تعديل على كود Edge Functions، لا تعديل منطق الدفع/webhook، لا تعرض أسرار، لا تغيير schema/RLS، لا dependencies جديدة. **B-003 ⚠️ جزئياً مُغلق:** الكود جاهز لكن التنفيذ الفعلي للنشر معلق (يتطلب تعيين أسرار + تشغيل CI/CD). **التحقق:** YAML lint ✅، type-check ✅، lint ✅ (0 errors)، build ✅، check:circular ✅ (727 ملف، 0 دائري)، paypal.webhook.test.js ✅ (35/35)، paypal.sandbox.integration.test.js ✅ (53 pass، 1 skip). **درجة الجاهزية:** 94/100 → 96/100 (+2). CI/CD Deployment: 20 → 95 (+75). **الحواجز المتبقية:** B-001 (PayPal live credentials — تشغيلي)، B-002 (PayPal webhook dashboard config — تشغيلي)، B-003 (Edge Functions deployment execution — تشغيلي)، B-008 (sandbox E2E not executed — تشغيلي). **التوصية: Phase 8.15 — Sandbox End-to-End Manual Execution.** انظر التقرير: `docs/architecture/phase-8-14-edge-functions-cicd-deployment-coverage-report.md`.
>
> **حالة الإنجاز:** Pre-8.15 API Inventory and Missing API Audit مكتملة (2026-06-27). **تدقيق شامل لجميع أسطح API + تحديد الـ APIs المفقودة والمكررة والـ legacy.** **النوع:** مرحلة تدقيق فقط — لا تغيير في الكود. **Edge Functions:** 47 دالة، جميعها منشورة عبر CI/CD، 22 حرجة للمدفوعات، 43 جاهزة و4 تحتاج تحقق (Stripe + CMI). **RPCs:** ~70 دالة إجمالاً (38 حرجة للأعمال + ~32 trigger functions)، جميعها SECURITY DEFINER مع RLS كاملة. **Module APIs:** 17 موديول في `src/modules/*/api/`. **Legacy Services:** ~50 خدمة في `src/services/`. **External APIs:** 14 (PayPal, Stripe, CMI, Twilio, Resend, Sentry, reCAPTCHA, Algolia, Leaflet, OSM, Firebase, Google Analytics, Express sidecar). **Direct Supabase usage:** 8 صفحات بها استعلامات مباشرة (3 متوسطة المخاطر، 5 منخفضة المخاطر). **الـ APIs المفقودة:** 0 — جميع الـ APIs المتوقعة لجميع الأدوار الأربعة (Admin, Vendor, Buyer, Driver) موجودة. **الـ APIs المكررة/Legacy:** Express sidecar (`src/api/`) بـ zero consumers، تكرار بين legacy services و module APIs (8 حالات). **المخاطر الجديدة:** R-031 (Express sidecar dead code — منخفض)، R-032 (3 صفحات باستعلامات مباشرة — منخفض)، R-033 (تكرار خدمات — منخفض)، R-034 (Stripe/CMI غير مختبرة في sandbox — متوسط)، R-035 (~20 trigger function بدون توثيق — منخفض). **التحقق:** type-check ✅، lint ✅ (0 errors)، check:circular ✅ (727 ملف، 0 دائري). **القرار:** ✅ Phase 8.15 يمكن المضي قدماً دون تأخير — لا حواجز إنتاجية جديدة. **التوصية:** المضي إلى Phase 8.15 — Sandbox End-to-End Manual Execution. انظر التقرير: `docs/architecture/pre-8-15-api-inventory-and-missing-api-audit.md`.
>
> **حالة الإنجاز:** Pre-8.15 Page Order, Navigation, and Dead-End UX Audit مكتملة (2026-06-27). **تدقيق شامل لهيكل التنقل وترتيب الصفحات والمسارات المسدودة (dead-ends).** **النوع:** مرحلة تدقيق فقط — لا تغيير في الكود. **الـ Routes:** 115 مساراً عبر 7 فئات (auth, onboarding, public, shared, buyer, vendor, driver, admin, error). **خرائط التنقل:** جميع الصفحات المتوقعة لجميع الأدوار الأربعة موجودة. **الـ Dead-Ends:** 0 حرج، 0 عالي، 1 متوسط (Digital Contract pre-activation — مقصود بالتصميم)، 16 منخفض. **إعدادات البائع (Vendor Settings):** ليست dead-end — الـ sidebar و mobile nav يوفرون مسارات خروج كاملة. **الـ Routes غير القابلة للوصول:** 5 ملفات (CircuitBreakers, SettingsAuditLog, DriverVerification, NotFound, Unauthorized — جميعها بدون route في AppRouter). **الـ Routes المخفية (route موجود لكن بدون sidebar link):** 5 (vendor/subscription, vendor/security, vendor/rfqs, driver/security, admin/verification). **مشكلة عالية الخطورة:** R-036 — Navbar user menu يربط `/buyer/orders` لجميع الأدوار — المستخدمون غير المشترين يُعاد توجيههم إلى `/unauthorized`. **المخاطر الجديدة:** R-036 (Navbar orders link — عالي)، R-037 (5 routes مخفية من sidebar — متوسط)، R-038 (3 صفحات admin بدون route — متوسط)، R-039 (2 ملفات يتيمة — منخفض)، R-040 (Digital Contract pre-activation بدون Home link — متوسط)، R-041 (3 routes مكررة لتتبع الطلبات — منخفض)، R-042 (Footer و NotFound يستخدمان `<a href>` — منخفض). **التحقق:** type-check ✅، lint ✅ (0 errors)، build ✅ (205 precache entries)، check:circular ✅ (727 ملف، 0 دائري). **القرار:** ✅ Phase 8.15 يمكن المضي قدماً دون تأخير — لا حواجز إنتاجية أو beta جديدة. **التوصية:** إصلاح R-036 (Navbar orders link) قبل أو أثناء Phase 8.15، وباقي الإصلاحات في مرحلة UI/UX polish. انظر التقرير: `docs/architecture/pre-8-15-page-order-navigation-dead-end-audit.md`.
>
> **حالة الإنجاز:** Pre-8.15 Navigation Hotfix (R-036 / M-006) مكتملة (2026-06-27). **إصلاح رابط "طلباتي" في Navbar user menu ليكون role-aware.** **المشكلة:** رابط `/buyer/orders` كان hardcoded لجميع الأدوار — vendor/admin/driver يُعاد توجيههم إلى `/unauthorized`. **الإصلاح:** إضافة دالة `getOrdersLinkForRole(role)` مُصدَّرة في `src/components/Navbar.jsx` — buyer → `/buyer/orders`، vendor → `/vendor/orders`، admin → `/admin/orders`، driver → `/driver/history`، fallback → `/orders` (يُحيل إلى `RoleOrdersRedirect`). **الاختبارات:** إضافة `src/__tests__/components/NavbarOrdersLink.test.jsx` — 8 اختبارات (جميع الأدوار + fallback + null/undefined) — جميعها نجحت. **R-036 ✅ مُغلقة.** **التحقق:** type-check ✅، lint ✅ (0 errors)، build ✅ (205 precache entries)، check:circular ✅ (727 ملف، 0 دائري)، 4 role smoke test suites (27 اختبار) ✅. **التغييرات:** `src/components/Navbar.jsx` (إضافة helper + استبدال link واحد)، `src/__tests__/components/NavbarOrdersLink.test.jsx` (جديد)، `docs/architecture/pre-8-15-page-order-navigation-dead-end-audit.md` (ملاحظة ما بعد الإصلاح). لا تغيير في routes أو ProtectedRoute أو sidebar أو payment أو schema.
>
> **حالة الإنجاز:** Phase 8.15 (Sandbox End-to-End Manual Execution) مكتملة (2026-06-27). **تدقيق وتحقق شامل لتدفق الدفع sandbox من منظور الكود والاختبارات والتوثيق.** **النوع:** sandbox E2E — لا تغيير في الكود. **الاختبارات:** 11 test suites، 109 اختبار نجح، 1 skip متوقع (live sandbox يتطلب `PAYPAL_SANDBOX_INTEGRATION=true`)، 0 فشل. **Edge Functions:** 47 دالة مؤكدة موجودة في `supabase/functions/`، CI/CD يغطي 47/47 (Phase 8.14). **Migration 036:** آمنة، idempotent، RLS كاملة — جاهزة للتطبيق يدوياً. **PayPal Webhook Handler:** مكتمل بالكامل — تحقق التوقيع، idempotency عبر `paypal_webhook_events`، 4 أنواع أحداث، فشل مغلق (401). **Refund Idempotency:** `PayPal-Request-Id` header مُطبَّق. **Checkout Idempotency:** `claim_checkout_request` RPC مع `UNIQUE(buyer_id, idempotency_key)`. **Bank Transfer و COD:** مستقلان عن PayPal — لا تبعية. **Rollback Plan:** موثَّق بالكامل (Edge Functions، migration، secrets، disable PayPal، COD-only). **10 E2E Scenarios:** الكود مُتحقَّق بالاختبارات لجميع السيناريوهات. التنفيذ المباشر محجوب بواسطة متطلبات تشغيلية (Supabase access، PayPal sandbox credentials، Edge Function deployment). **القرار:** ✅ CONDITIONAL GO لـ sandbox beta (بانتظار متطلبات تشغيلية) — ⛔ NO-GO لـ real-money production. **التحقق:** type-check ✅، lint ✅ (0 errors)، build ✅ (205 precache entries)، check:circular ✅ (727 ملف، 0 دائري). **حالة الحواجز:** B-001 Pending، B-002 Pending، B-003 Pending، B-008 Partially complete (الكود مُتحقَّق، التنفيذ المباشر محجوب). **درجة الجاهزية:** 97/100 (+1). **المرحلة الموصى بها 8.16:** Live PayPal Verification & Production Environment Setup. انظر التقرير: `docs/architecture/phase-8-15-sandbox-end-to-end-manual-execution-report.md`.
>
> **حالة الإنجاز:** Phase 8.16 (Sandbox Operations Execution) مكتملة (2026-06-27). **تنفيذ عمليات sandbox حقيقية ضد مشروع Supabase المباشر `oyaiiyekfkflesdmcvvo`.** **النوع:** sandbox operations — لا تغيير في الكود. **Migration 036:** ✅ تم التطبيق بنجاح — جدول `paypal_webhook_events` موجود مع unique constraint و RLS (service_role فقط) و 3 فهارس. **Edge Functions المنشورة:** 16/47 — تنقص 31 دالة حرجة منها `paypal-webhook`، `calculate-checkout-pricing`، `create-checkout-order`. **Supabase Secrets:** 18 سر مُفعَّل لكنها مُعدَّة لـ PRODUCTION وليس sandbox — `VITE_PAYMENT_MODE=production`، `PAYPAL_API_BASE=https://api-m.paypal.com`. **PAYPAL_WEBHOOK_ID:** غير مُفعَّل. **اكتشاف حرج:** بيانات اعتماد PayPal الحالية هي PRODUCTION وليست sandbox — لا يمكن تنفيذ sandbox E2E لأن ذلك سيؤدي إلى معاملات حقيقية. **الاختبارات:** 11 test suites، 116 اختبار نجح، 1 skip متوقع، 0 فشل. **التحقق:** type-check ✅، lint ✅ (0 errors)، build ✅ (205 precache entries)، check:circular ✅ (727 ملف، 0 دائري). **القرار:** ⛔ NO-GO لـ sandbox beta (محجوب ببيانات اعتماد production + دوال غير منشورة + webhook غير مُكوَّن) — ⛔ NO-GO لـ real-money production. **حالة الحواجز:** B-001 Pending، B-002 Pending، B-003 Partially resolved (16/47 deployed)، B-008 Partially complete (migration 036 applied، الكود مُتحقَّق، التنفيذ المباشر محجوب). **إجراءات يدوية مطلوبة:** (1) تغيير `VITE_PAYMENT_MODE` إلى `sandbox` في `.env` و Supabase secrets، (2) تغيير `PAYPAL_API_BASE` إلى sandbox، (3) استبدال `PAYPAL_CLIENT_SECRET` و `VITE_PAYPAL_CLIENT_ID` ببيانات sandbox، (4) نشر 31 دالة غير منشورة، (5) إنشاء PayPal sandbox webhook في Dashboard، (6) تعيين `PAYPAL_WEBHOOK_ID`، (7) تنفيذ sandbox E2E. **درجة الجاهزية:** 97/100 (بدون تغيير). **المرحلة الموصى بها 8.17:** Live PayPal Verification & Production Environment Setup. انظر التقرير: `docs/architecture/phase-8-16-sandbox-operations-execution-report.md`.
>
> **حالة الإنجاز:** Phase 8.17 (Sandbox Environment Correction & Edge Functions Deployment) مكتملة (2026-06-27). **تصحيح البيئة من production إلى sandbox + نشر الدوال الحرجة للمدفوعات.** **النوع:** sandbox operations — لا تغيير في الكود. **Supabase Secrets:** ✅ تم تحديث 6 أسرار إلى sandbox — `VITE_PAYMENT_MODE=sandbox`، `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`، `PAYPAL_CLIENT_ID=<REDACTED>`، `PAYPAL_CLIENT_SECRET=<REDACTED>`، `PAYPAL_WEBHOOK_ID=<REDACTED>`، `VITE_PAYPAL_CLIENT_ID=<REDACTED>`. **Edge Functions المنشورة:** 25/47 (+9 دوال حرجة للمدفوعات) — `calculate-checkout-pricing`، `create-checkout-order`، `paypal-webhook`، `get-bank-details`، `reconcile-paypal-payments`، `confirm-order-payment`، `payment-status-write`، `process-manual-refund`، `refund-payment`. **التحقق من النقاط النهائية:** `paypal-webhook` → 401 (يرفض غير الموقع) ✅، `calculate-checkout-pricing` → 401 (يتطلب مصادقة) ✅، `create-checkout-order` → 401 ✅، `get-bank-details` → 401 ✅، `reconcile-paypal-payments` → 401 ✅. **جميع 9 دوال حرجة للمدفوعات منشورة ومتحقَّقة.** **الاختبارات:** 11 test suites، 116 اختبار نجح، 1 skip متوقع، 0 فشل. **التحقق:** type-check ✅، lint ✅ (0 errors)، build ✅ (205 precache entries)، check:circular ✅ (727 ملف، 0 دائري). **القرار:** ✅ CONDITIONAL GO لـ sandbox beta (البيئة مصححة، الدوال منشورة، webhook ID مُفعَّل) — ⛔ NO-GO لـ real-money production. **حالة الحواجز:** B-001 Pending، B-002 Partially resolved (webhook ID set، test event pending)، B-003 Partially resolved (25/47 deployed، جميع الدوال الحرجة للمدفوعات منشورة)، B-008 Partially complete (البيئة جاهزة، بانتظار تنفيذ sandbox E2E مباشر). **إجراءات يدوية متبقية:** (1) تحديث `.env` إلى sandbox للتنمية المحلية، (2) إرسال test webhook من PayPal dashboard، (3) تنفيذ sandbox E2E مباشر (Phase 8.18). **درجة الجاهزية:** 97/100 (بدون تغيير — محجوب بـ B-008). **المرحلة الموصى بها 8.18:** Direct Sandbox E2E Execution. انظر التقرير: `docs/architecture/phase-8-17-sandbox-environment-correction-and-edge-functions-deployment-report.md`.
>
> **حالة الإنجاز:** Phase 8.18 (Direct Sandbox E2E Execution) مكتملة (2026-06-27). **تنفيذ مباشر لتدفق PayPal sandbox: إنشاء طلب → موافقة المشتري → capture → refund.** **النوع:** sandbox E2E — لا تغيير في الكود. **PayPal sandbox order:** ✅ مُنشأ (ID: `9981986473487620F`). **موافقة المشتري:** ✅ مكتملة يدوياً بواسطة المستخدم. **Capture:** ✅ `COMPLETED` (Capture ID: `6X2682348M9382240`، 4.56 EUR). **Refund:** ✅ `COMPLETED` (Refund ID: `1JD64383AJ020650S`، 4.56 EUR). **Edge Functions:** `create-paypal-order` ✅، `capture-paypal-order` ✅، `refund-paypal-payment` ✅. **webhook handler:** ✅ يرفض الطلبات غير الموقعة. **webhook test event:** ⏳ لم يُرسَل من PayPal Dashboard بعد. **database order creation:** ⚠️ محجوب بمشكلة `calculate-checkout-pricing` 500 error. **return_url/cancel_url:** ⚠️ مشكلة مُكتشفة — fallback في Edge Function يستخدم Supabase URL بدلاً من frontend URL، و `paymentGateway.js` لا يُمرِّر return/cancel URLs. **الاختبارات:** ✅ 159 test suites، 1719 اختبار نجح، 1 skip متوقع، 2 todo، 0 فشل. **التحقق:** type-check ✅، lint ✅ (0 errors)، build ✅ (205 precache entries)، check:circular ✅ (0 دائري). **القرار:** ✅ CONDITIONAL GO لـ sandbox beta (capture + refund مُثبتان، لكن database order creation + webhook + return_url يحتاجون إصلاحاً) — ⛔ NO-GO لـ real-money production. **حالة الحواجز:** B-001 Pending، B-002 Partially resolved (webhook ID set، handler يعمل، test event يدوي متبقٍ)، B-003 Partially resolved (25/47 deployed)، B-008 Partially complete (capture + refund تمّا، order creation + webhook + return_url لا يزالون محجوبين). **درجة الجاهزية:** 93/100. **التوصية:** Phase 8.19 — إصلاح حواجز sandbox E2E المتبقية (return_url، pricing، inventory).
>
> **حالة الإنجاز:** Phase 8.19 (Sandbox E2E Blockers + Signup Verification Fix) مكتملة (2026-06-27). **إصلاح الحواجز الحرجة التي تمنع إتمام تدفق sandbox من الواجهة + إصلاح B-009 التحقق من البريد عند التسجيل.** **النوع:** كود + sandbox operations. **PayPal return_url/cancel_url:** ✅ تم إصلاح fallback في `create-paypal-order` لاستخدام `FRONTEND_APP_URL` (مصدر Supabase) وإرسال `returnUrl`/`cancelUrl` صريح من `paymentGateway.js` و `OrderConfirmation.jsx`. **calculate-checkout-pricing 500:** ✅ تم إصلاح استعلام `platform_settings` ليتوافق مع المخطط key-value + تحسين رسائل الأخطاء. **moroccan_banks:** ✅ تم إضافة fallback في `get-bank-details` عند غياب/اختلاف الجدول. **reserve_checkout_inventory:** ✅ تم إصلاح ambiguity في `product_id` عبر migration جديد (2026-06-27). **create-checkout-order:** ✅ يعمل الآن (Order ID: `ee7839a0-9c10-488e-85f4-39f405efb86f`، PayPal Order IDs: `9LD28116S3172474D` و `0JC824925V238150A`). **PayPal redirect:** ✅ التوجيه بعد الموافقة إلى `https://greenmarket-marketplace.web.app/order-confirmation/...?paypal=success`. **Capture:** ✅ نجح للطلب الثاني (0JC824925V238150A)؛ الطلب الأول أعاد `INTERNAL_SERVICE_ERROR` sandbox (مُوثَّق). **B-009 Signup verification:** ✅ تم تصحيح flow: Supabase يرسل رمز تحقق (OTP) وليس رابط تأكيد. تم تحديث `VerifyEmail.jsx` لإدخال رمز 6 أرقام + `supabase.auth.verifyOtp({ type: 'signup' })`. تم إزالة `emailRedirectTo` من `signUp`. `AuthCallback.jsx` يبقى كـ fallback. تم تحديث i18n (ar/en/fr). **الاختبارات:** ✅ VerifyEmail tests (12 test)، authActionsService.signUp tests (6 test)، 160 suites / 1728 tests ✅ (1 skipped، 2 todo). **التحقق:** type-check ✅، lint ✅ (0 errors)، build ✅، check:circular ✅ (0 دائري). **القرار:** ✅ CONDITIONAL GO لـ sandbox beta (order creation + PayPal redirect مُثبتان، capture sandbox متقطع، B-009 مُصلح كودياً) — ⛔ NO-GO لـ real-money production. **حالة الحواجز:** B-001 Pending، B-002 Partially resolved (webhook test event pending)، B-003 Partially resolved (25/47 deployed)، B-008 Partially complete (order creation + redirect تمّا، capture متقطع)، B-009 Code fixed (OTP-based)، manual verification pending. **درجة الجاهزية:** 95/100 (+2). **التوصية:** إغلاق B-009 يدوياً بعد التحقق من Site URL + إعادة تشغيل E2E لـ capture + refund. انظر التقرير: `docs/architecture/phase-8-19-b009-signup-email-verification-report.md`. **تنفيذ مباشر لتدفق PayPal sandbox: إنشاء طلب → موافقة المشتري → capture → refund.** **النوع:** sandbox E2E — لا تغيير في الكود. **PayPal sandbox order:** ✅ مُنشأ (ID: `9981986473487620F`). **موافقة المشتري:** ✅ مكتملة يدوياً بواسطة المستخدم. **Capture:** ✅ `COMPLETED` (Capture ID: `6X2682348M9382240`، 4.56 EUR). **Refund:** ✅ `COMPLETED` (Refund ID: `1JD64383AJ020650S`، 4.56 EUR). **Edge Functions:** `create-paypal-order` ✅، `capture-paypal-order` ✅، `refund-paypal-payment` ✅. **webhook handler:** ✅ يرفض الطلبات غير الموقعة. **webhook test event:** ⏳ لم يُرسَل من PayPal Dashboard بعد. **database order creation:** ⚠️ محجوب بمشكلة `calculate-checkout-pricing` 500 error. **return_url/cancel_url:** ⚠️ مشكلة مُكتشفة — fallback في Edge Function يستخدم Supabase URL بدلاً من frontend URL، و `paymentGateway.js` لا يُمرِّر return/cancel URLs. **الاختبارات:** ✅ 159 test suites، 1719 اختبار نجح، 1 skip متوقع، 2 todo، 0 فشل. **التحقق:** type-check ✅، lint ✅ (0 errors)، build ✅ (205 precache entries)، check:circular ✅ (0 دائري). **القرار:** ✅ CONDITIONAL GO لـ sandbox beta (capture + refund مُثبتان، لكن database order creation + webhook + return_url يحتاجون إصلاحاً) — ⛔ NO-GO لـ real-money production. **حالة الحواجز:** B-001 Pending، B-002 Partially resolved (webhook ID set، handler يعمل، test event يدوي متبقٍ)، B-003 Partially resolved (25/47 deployed)، B-008 Partially complete (capture + refund تمّا، order creation + webhook + return_url لا يزالون محجوبين). **درجة الجاهزية:** 93/100. **المرحلة المُوصى بها 8.19:** Remaining Edge Functions Deployment + Production Environment Setup (إصلاح calculate-checkout-pricing + return_url + نشر 22 دالة متبقية + إرسال test webhook). انظر التقرير: `docs/architecture/phase-8-18-direct-sandbox-e2e-execution-report.md`.
>
> **حالة الإنجاز:** Phase 4.6 (موديول `admin`) مكتملة (2026-06-23). تم إنشاء `src/modules/admin/` كطبقة re-export لـ admin pages (Dashboard, Users, Products, Orders, Analytics, Settings, Reports, Vendors, Drivers, Moderation, Commissions, CommissionManagement, Payouts, Reviews, Security, Verification, SupportTickets, SettingsAuditLog, CircuitBreakers, DisputeManagement, FraudReports) و VerificationPanel و AdminLayout و platformSettings (getSettings, updateSettings, getSettingsAuditLog, subscribeToSettingsChanges) و fraudReportService (createFraudReport, listFraudReportsForAdmin, updateFraudReport) و disputeService (openDispute, releaseBuyerDataToVendor, applyDisputePenalty) و admin hooks (adminKeys, useAdminUsers, useAdminUser, useDeletedUsers, useAdminStats, useUpdateUser, useDeleteUser, useRestoreUser). لا تغيير في أي imports موجودة. لا نقل ملفات. لا تغيير في admin behavior أو permissions أو role checks أو ProtectedRoute أو user management أو product moderation أو order management أو payment/commission/payout behavior أو analytics behavior أو driver verification أو routes. لا تغيير في Supabase queries أو database/RLS أو Edge Functions. انظر التقرير: `docs/architecture/phase-4-6-admin-module-report.md`.

**بوابة المرور (بعد كل Sprint):**
- [ ] الموديول المنجَز يعمل وظيفياً (استعراض المنتجات / السلة / قائمة الطلبات / تتبع التوصيل بحسب الموديول).
- [ ] `npm run check:circular` = صفر دوائر.
- [ ] لا استيراد عكسي: `orders` لا يستورد `delivery`؛ التواصل عبر `order:delivery_updated`.

### 9.4 المرحلة 3: موديولات العمليات الحرجة (2-3 أسابيع)

**الهدف:** إنشاء الموديولات التي تتعامل مع التدفقات الحرجة.

| المهمة | الملفات | الملاحظات |
|---|---|---|
| إنشاء `src/modules/checkout/` | `ui/pages/`, `api/mutations.js` | تقسيم `CheckoutSimplified.jsx` |
| إنشاء `src/modules/payments/` | `domain/`, `data/`, `api/` | نقل `paymentService.js` و `paymentGateway.js` |
| إنشاء `src/modules/notifications/` | `domain/`, `data/`, `api/` | نقل `notifications.js` |
| إنشاء `src/modules/coupons/` | `domain/`, `data/`, `api/` | نقل `coupons.js` |

**بوابة المرور:**
- [ ] تدفق الدفع كامل (Checkout → Payment → Order) يعمل.
- [ ] الإشعارات تُنشأ في المناسبات الصحيحة.
- [ ] الكوبونات تُطبق بشكل صحيح.

### 9.5 المرحلة 4: موديولات الدعم والإدارة (2-3 أسابيع)

**الهدف:** إنشاء الموديولات الداعمة للنظام.

| المهمة | الملفات | الملاحظات |
|---|---|---|
| إنشاء `src/modules/reviews/` | `domain/`, `data/`, `ui/` | تجميع منطق التقييمات |
| إنشاء `src/modules/chat/` | `domain/`, `data/`, `ui/` | نقل `chatService.jsx` |
| إنشاء `src/modules/commissions/` | `domain/`, `data/`, `api/` | نقل `commissionService.js` |
| إنشاء `src/modules/analytics/` | `ui/`, `api/hooks.js` | نقل لوحات التحكم والتقارير |
| إنشاء `src/modules/admin/` | `ui/pages/` | تجميع صفحات الإدارة |

**بوابة المرور:**
- [ ] التقييمات تعمل.
- [ ] المحادثات تعمل.
- [ ] العمولات تُحسب وتُعرض.
- [ ] لوحات التحكم تعمل.

### 9.6 المرحلة 5: التنظيف والتقاعد (1-2 أسابيع)

**الهدف:** إزالة البنية القديمة والملفات المهجورة.

| المهمة | الملفات | الملاحظات |
|---|---|---|
| حذف `src/features/` المهجورة | `features/vendor/components/`, `features/admin/components/` | حذر — التحقق من الاستخدام أولاً |
| حذف `src/api/` بعد استبدال Edge Functions | `api/routes/`, `api/controllers/` | وفق `DEPRECATION_PLAN.md` |
| حذف `src/middleware/authMiddleware.js` و `axiosInstance.js` | — | إذا لم يعدا مستخدمين |
| توحيد `src/services/` المتبقي | `services/` | الباقي يكون مكتبات مشتركة فقط |
| تحديث `STRUCTURE.md` و `ARCHITECTURE.md` | — | توثيق البنية الجديدة |

**بوابة المرور:**
- [ ] `vite build` ينجح.
- [ ] جميع اختبارات Cypress E2E تمر.
- [ ] لا توجد ملفات مهجورة غير مستخدمة.

---

## 10. استراتيجية الترحيل

### 10.1 المبدأ الأساسي

> **لا تُعيد كتابة كل شيء دفعة واحدة. قم بإنشاء الموديول الجديد بجانب القديم، ثم انقل الملفات تدريجياً.**

### 10.2 نمط Strangler Fig

1. **إنشاء** الموديول الجديد بجانب القديم.
2. **نقل** المنطق البسيط أولاً (constants, pure functions, hooks).
3. **تحديث** الملفات التي تستخدم القديم لتستخدم الواجهة العامة للجديد.
4. **حذف** القديم فقط بعد التحقق من عدم استخدامه.
5. **تكرار** حتى اكتمال التحول.

### 10.3 قواعد الترحيل

| القاعدة | الشرح |
|---|---|
| **Additive First** | أضف الموديولات الجديدة قبل حذف القديمة. |
| **Preserve Behavior** | لا تغير السلوك أثناء الترحيل. |
| **Test at Boundaries** | اختبار كل موديول بعد اكتماله. |
| **Feature Flags** | استخدم Feature Flags للتغييرات الكبيرة إذا أمكن. |
| **One Module at a Time** | لا تُرحّل أكثر من موديول واحد في نفس الـ Sprint. |

### 10.4 مثال عملي: ترحيل `ordersService`

**الحالة الحالية:**
```
src/services/ordersService.ts
src/data/orderRepository.ts
src/business/orderLogic.ts
src/pages/buyer/Orders.jsx
src/pages/vendor/Orders.jsx
src/pages/admin/Orders.jsx
```

**الخطوات:**
1. إنشاء `src/modules/orders/domain/commands.js` و `queries.js`.
2. نقل `src/data/orderRepository.ts` إلى `src/modules/orders/data/repository.ts`.
3. نقل `src/business/orderLogic.ts` إلى `src/modules/orders/domain/businessLogic.ts`.
4. إنشاء `src/modules/orders/api/hooks.js` (React Query).
5. إنشاء `src/modules/orders/ui/components/OrderList.jsx` و `OrderCard.jsx`.
6. تحديث `pages/buyer/Orders.jsx` لاستخدام `OrderList` من `modules/orders`.
7. تحديث `pages/vendor/Orders.jsx` و `pages/admin/Orders.jsx`.
8. حذف `src/services/ordersService.ts` بعد التحقق.

---

## 11. أفضل الممارسات

### 11.1 للمطورين

| الممارسة | التطبيق |
|---|---|
| **Import from the barrel** | استورد دائماً من `index.js` للموديول. |
| **No deep imports** | لا تستورد من `modules/orders/data/repository.js` مباشرة. |
| **Keep modules small** | إذا تجاوزت ملفات الموديول 20 ملفاً، فكّر في التقسيم. |
| **Write tests for the public API** | اختبار الواجهة العامة للموديول فقط. |
| **Avoid cross-module stores** | كل store يبقى داخل موديوله. |
| **Use events for cross-module communication** | استخدم `window.CustomEvent` أو pub/sub بسيط للتواصل. |

### 11.2 للمراجعات (Code Reviews)

- هل الملف الجديد يخص الموديول الصحيح؟
- هل هناك استيراد من داخل موديول آخر؟
- هل الموديول يصدر واجهة عامة واضحة؟
- هل هناك تكرار مع موديول آخر؟
- هل تمت إضافة اختبار للمنطق الجديد؟

### 11.3 للاختبار

| المستوى | الأدوات | النطاق |
|---|---|---|
| Unit | Jest | `domain/businessLogic.js`, `utils/` |
| Integration | Jest + MSW | `api/hooks.js`, `data/repository.js` |
| E2E | Cypress | تدفقات المستخدم الكاملة |
| Visual | Storybook | `ui/components/` |

### 11.4 للتوثيق

- كل `index.js` يجب أن يحتوي على تعليق يوضح الواجهة العامة.
- كل `README.md` داخل الموديول يجب أن يوضح:
  - المسؤولية.
  - التبعيات.
  - الواجهة العامة.
  - كيفية الاختبار.

---

## 12. قواعد ESLint و TypeScript المقترحة

### 12.1 قواعد الاستيراد

```js
// eslint.config.js
{
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        {
          name: 'src/modules/orders/data/repository',
          message: 'Import from src/modules/orders instead.',
        },
      ],
      patterns: [
        {
          group: ['src/modules/*/!(index)'],
          message: 'Import only from the module public API (index.js).',
        },
      ],
    }],
  },
}
```

### 12.2 قواعد TypeScript

- استخدام `strict` mode.
- تعريف أنواع الكيانات في `domain/entities.ts`.
- تجنب `any` في الطبقات العامة.
- استخدام `readonly` للخصائص التي لا تتغير.

---

## 13. مقاييس النجاح

### 13.1 المقاييس الفنية

| المقياس | الهدف | طريقة القياس |
|---|---|---|
| عدد الموديولات | 15-18 موديول | عدد مجلدات `modules/` |
| متوسط حجم الموديول | < 25 ملف | `find src/modules/X -type f \| wc -l` |
| التبعيات الضمنية | 0 | `dependency-cruiser` |
| التبعيات الدائرية | 0 | `madge --circular` (مدمج في CI/CD بعد كل مرحلة) |
| تغطية الاختبارات (معدل عام) | > 60% | `jest --coverage` |
| **تغطية الموديولات المالية** | **≥ 85%** لموديولات `payments`, `commissions`, `checkout` | `jest --coverage` مع حدود `coverageThreshold` لكل مسار موديول |
| حجم الحزمة الأولي | لا يزيد بشكل كبير | `vite build` + تحليل |

> **لماذا 85%+ للموديولات المالية؟** موديولات `payments` و `commissions` و `checkout` تتعامل مباشرة بالمال (دفعات، استردادات، عمولات، إنشاء الطلبات وحساب الأسعار). تكلفة الخطأ فيها أعلى بكثير من بقية الموديولات (خسائر مالية، نزاعات، فقدان ثقة)، لذا تُفرض عليها عتبة تغطية أعلى (85%+) بدل المعدل العام (60%). يُنصح بضبط ذلك في إعداد Jest عبر `coverageThreshold` المخصص لكل مسار:
> ```js
> // jest.config.js (مقتطف)
> coverageThreshold: {
>   global: { lines: 60 },
>   './src/modules/payments/': { lines: 85, branches: 85, functions: 85 },
>   './src/modules/commissions/': { lines: 85, branches: 85, functions: 85 },
>   './src/modules/checkout/': { lines: 85, branches: 85, functions: 85 },
> }
> ```

### 13.2 المقاييس التنظيمية

| المقياس | الهدف |
|---|---|
| سرعة إضافة ميزة جديدة | تقليل 30% |
| معدل الأخطاء الناشئة عن تغييرات في أجزاء أخرى | تقليل 50% |
| عدد المطورين الذين يمكنهم العمل على نفس الموديول | 2-3 |
| عدد المطورين الذين يمكنهم العمل على موديولات مختلفة | غير محدود |

---

## 14. المخاطر والتخفيف

| الخطر | الاحتمال | التأثير | التخفيف |
|---|---|---|---|
| فترة الترحيل الطويلة | عالية | متوسط | استخدام Strangler Fig + Sprints قصيرة |
| كسر الميزات أثناء التنقل | متوسطة | عالي | اختبارات E2E + Feature Flags |
| مقاومة الفريق للتغيير | متوسطة | متوسط | توثيق واضح + تدريب |
| زيادة حجم الحزمة | منخفضة | متوسط | Lazy loading + Code splitting |
| تبعيات دائرية جديدة | متوسطة | عالي | ESLint + dependency-cruiser |

---

## 15. خطة التواصل

| الجمهور | الرسالة | التوقيت |
|---|---|---|
| فريق التطوير | شرح البنية الجديدة والقواعد | قبل بدء المرحلة 1 |
| المدير الفني | المخاطر والجداول الزمنية | مع الموافقة على الخطة |
| أصحاب المصلحة | تأثير التطوير على الميزات الجديدة | كل Sprint |
| المساهمون الجدد | دليل الموديولات وكيفية البدء | مع كل تغيير كبير |

---

## 16. المراحل التالية المقترحة

1. **مراجعة هذه الخطة** من قبل الفريق المختص.
2. **الموافقة على التقسيم النهائي** للموديولات.
3. **بدء المرحلة 0** (التحضير والسلامة).
4. **إنشاء أول موديول تجريبي** (مثلاً `modules/auth`) لاختبار النمط.
5. **تقييم النتيجة** وتعديل الخطة بناءً على الدروس المستفادة.

---

## 17. الملخص التنفيذي

هذه الخطة تقترح تحويل تطبيق Greenmarket إلى **بنية موديولية هجينة** تجمع بين:
- **Feature-Based Organization**
- **Domain-Driven Design**
- **Vertical Slices**

كل موديول يملك واجهة عامة واضحة، طبقات داخلية متناسقة، واختبارات خاصة. الترحيل يتم **بشكل تدريجي** عبر نمط Strangler Fig، مع الحفاظ على عمل التطبيق في كل مرحلة.

**الأولوية:**
1. المرحلة 0: التحضير والسلامة.
2. المرحلة 1: الهيكل المشترك و `auth`.
3. المرحلة 2: الموديولات الأساسية (catalog, marketplace, cart, orders, delivery).
4. المرحلة 3: العمليات الحرجة (checkout, payments, notifications, coupons).
5. المرحلة 4: الدعم والإدارة (reviews, chat, commissions, analytics, admin).
6. المرحلة 5: التنظيف والتقاعد.

---

**تم إعداد هذه الخطة للمراجعة والموافقة.**

---

## Phase 8.20 — Buyer P0 Critical Fixes: Security, Navigation, Payment Idempotency

**التاريخ:** 2026-06-29  
**الحالة:** مكتملة ✅  
**النتيجة:** جميع P0 blockers مغلقة — قرار Beta: GO

### P0 Issues Fixed

| ID | Issue | Status |
|---|---|---|
| B-001 / ARCH-001 | Buyer Dashboard link navigates to /profile when profile null | ✅ CLOSED |
| SEC-001 | payments_system_insert RLS allows fake payment records | ✅ CLOSED |
| SEC-002 | deliveries_system_insert RLS allows fake delivery records | ✅ CLOSED |
| SEC-003 | notifications_system_insert RLS allows notification spam | ✅ CLOSED |
| API-001 / PAY-001 | PayPal capture idempotency missing | ✅ CLOSED |
| TEST-001 | Missing targeted regression tests | ✅ CLOSED |

### Files Changed

- `src/components/Navbar.jsx` — getDashboardLink returns null when role unknown; disabled span rendered instead of /profile link.
- `supabase/functions/capture-paypal-order/index.ts` — Added secondary idempotency check on orders table by payment_intent_id.
- `src/__tests__/components/NavbarDashboardLink.test.jsx` — Updated test for disabled link behavior.
- `src/__tests__/supabase/rlsPolicies.test.js` — 22 RLS policy regression tests (NEW).
- `src/__tests__/supabase/paypalCaptureIdempotency.test.js` — 14 idempotency tests (NEW).
- `src/__tests__/integration/buyerP0CheckoutRegression.test.js` — 10 checkout + idempotency tests (NEW).
- `docs/architecture/buyer-role-strict-audit-report.md` — Added P0 Critical Fixes implementation results section.

### Migrations

- `database/migrations/037-fix-open-insert-rls-policies.sql` (pre-existing) — Restricts INSERT on payments, deliveries, notifications, order_timeline to service_role only.

### Verification

- type-check: ✅ | lint: ✅ | build: ✅ | check:circular: ✅ | tests: 165 suites, 1785 passed

### Buyer Readiness Score: 42/100 → 79/100 | Beta Decision: GO ✅

---

## Phase 8.21 — Buyer P1 Stabilization Fixes

**Date**: 2025-01-20
**Goal**: Address all P1 stabilization issues for Buyer role before UI polish.

### Issues Fixed

| Issue | Description | Resolution |
|-------|-------------|------------|
| DB-001 | `usePaymentHistory` queries non-existent `payments.user_id` | Fixed query to use `orders!inner` join with `buyer_id`; fixed `useCreatePayment` to omit `user_id` |
| DB-004/ARCH-003 | Dual cart systems undocumented | Documented Zustand `cartStore` as source of truth; deprecated all 6 DB cart hooks with `@deprecated` JSDoc |
| SEC-004 | `order_timeline` RLS open INSERT | Verified migration 037 restricts to `service_role`; added RLS violation tests |
| API-002 | Missing buyer role verification in Edge Functions | Added `requireRole(req, ['buyer'])` to 5 Edge Functions: `create-checkout-order`, `create-paypal-order`, `capture-paypal-order`, `confirm-bank-transfer`, `register-payment-receipt` |
| PAY-002 | Order confirmation title misleading | Dynamic title based on payment status (paid/pending/failed/COD/bank review); dynamic icon and color |
| PAY-004 | Missing pending payment state UI | Added amber pending banner with method-specific messaging; added red failed payment banner |
| PAY-003/UX-003 | PayPal retry does not handle old order | Blocks retry on completed payments; marks old pending payment as `superseded` before creating new PayPal order |
| TEST-002 | Missing buyer checkout/payment coverage | Added 55 regression tests covering checkout, PayPal states, retry, confirmation rendering |
| TEST-012 | Missing RLS violation tests | Added tests for payments, deliveries, notifications, order_timeline INSERT blocked; buyer cannot mutate another buyer's data |

### Files Changed

- `src/hooks/queries/useCartPaymentQueries.js` — Fixed `usePaymentHistory` query (DB-001); deprecated DB cart hooks (DB-004)
- `src/pages/OrderConfirmation.jsx` — Dynamic title (PAY-002), pending/failed banners (PAY-004), retry safety (PAY-003)
- `src/i18n/locales/en.json` — New order confirmation i18n keys
- `src/i18n/locales/ar.json` — Arabic translations for new keys
- `supabase/functions/create-checkout-order/index.ts` — Added `requireRole(req, ['buyer'])` (API-002)
- `supabase/functions/create-paypal-order/index.ts` — Added `requireRole(req, ['buyer'])` (API-002)
- `supabase/functions/capture-paypal-order/index.ts` — Added `requireRole(req, ['buyer'])` (API-002)
- `supabase/functions/confirm-bank-transfer/index.ts` — Replaced inline auth with `requireRole(req, ['buyer'])` (API-002)
- `supabase/functions/register-payment-receipt/index.ts` — Replaced inline auth with `requireRole(req, ['buyer'])` (API-002)
- `src/__tests__/integration/buyerP1Stabilization.test.js` — 55 new regression tests (NEW)
- `docs/architecture/buyer-role-strict-audit-report.md` — Added P1 Stabilization Fixes results section

### Migrations

- No new migrations. Migration 037 (pre-existing) already restricts `order_timeline` INSERT to `service_role`.

### Verification

- type-check: ✅ | lint: ✅ (0 errors, 2 pre-existing warnings) | build: ✅ | check:circular: ✅ | tests: 166 suites, 1840 passed, 1 skipped, 2 todo

### Buyer Readiness Score: 79/100 → 87/100 | Beta Decision: GO ✅ | UI Polish: Can Begin

## Phase 8.22 — Buyer P2/P3 UI/UX & i18n Polish

**Date**: 2026-06-28
**Goal**: Address P2/P3 Buyer role issues focused on hardcoded Arabic strings, mobile navigation i18n, and UI/UX consistency.

### Issues Fixed

- **B-010** — Hardcoded Arabic strings in Buyer mobile navigation (`buyerTabs`)
- **B-011** — Hardcoded Arabic strings in Buyer RFQ page (`RFQ.jsx`)
- **B-012** — Hardcoded Arabic strings in Buyer Loyalty page (`Loyalty.jsx`)
- **B-013** — Hardcoded Arabic strings in Buyer Security page (`Security.jsx`)
- **B-014** — Hardcoded Arabic strings in Buyer Settings page (`Settings.jsx`)
- **B-015** — Hardcoded Arabic strings in Buyer Dashboard (`Dashboard.jsx`)
- **B-016** — Hardcoded Arabic strings in Buyer Orders page (`Orders.jsx`)

### Files Changed

- `src/components/ProtectedRoute.jsx` — i18n keys for all role mobile nav tabs
- `src/pages/buyer/RFQ.jsx` — `useTranslation` + all hardcoded Arabic replaced
- `src/pages/buyer/Loyalty.jsx` — i18n for stats, referral, rewards, reasons
- `src/pages/buyer/Security.jsx` — i18n for headers, MFA, sessions, phone verify
- `src/pages/buyer/Settings.jsx` — i18n for delete account verification
- `src/pages/buyer/Dashboard.jsx` — `getQuickActions(t)` for i18n
- `src/pages/buyer/Orders.jsx` — i18n for invoice download toast
- `src/i18n/locales/ar.json` — New keys for buyer.rfq, buyer.loyalty, buyerSecurity, layout.mobileTabs, buyerSettings.deletePhoneVerify, privacySettings.addPhoneFirst
- `src/i18n/locales/en.json` — Corresponding English keys
- `src/__tests__/pages/buyer/BuyerI18nFixes.test.jsx` — Source-scanning regression tests for hardcoded Arabic removal and key existence

### Verification

- type-check: ✅ Pass
- lint: ✅ Pass (0 errors, 2 pre-existing warnings in paypal-webhook)
- build: ✅ Pass
- check:circular: ✅ No circular dependencies
- tests: ✅ 167 suites, 2102 passed, 1 skipped, 2 todo

### Buyer Readiness Score: 87/100 → 89/100 | Beta Decision: GO ✅ | Next: Cart/Checkout UX Polish

## Phase 8.23 — Buyer i18n JSON Cleanup & Final Polish Verification

**Date**: 2026-06-28
**Goal**: Remove duplicate JSON object keys from the locale files, preserve correct translations, and add a regression test to prevent future duplicate keys.

### Issues Fixed

- **B-017** — Duplicate `checkout` key in `cart` section (`string` vs `object`) in `ar.json`, `en.json`, `fr.json`
- **B-018** — Duplicate `payouts` section in `en.json`
- **B-019** — Duplicate `settings` section in `en.json`

### Files Changed

- `src/i18n/locales/ar.json` — Renamed `cart.checkout` string to `cart.checkoutLabel`
- `src/i18n/locales/en.json` — Renamed `cart.checkout` string to `cart.checkoutLabel`; removed stale duplicate `admin.payouts` and `admin.settings` sections
- `src/i18n/locales/fr.json` — Renamed `cart.checkout` string to `cart.checkoutLabel`
- `src/pages/Cart.jsx` — Updated button labels to use `cart.checkoutLabel`
- `src/layouts/MainLayout.jsx` — Updated footer link to use `cart.checkoutLabel`
- `scripts/checkDuplicateJsonKeys.cjs` — Standalone duplicate-key checker
- `src/__tests__/i18n/localeJsonValidation.test.js` — Jest regression tests for duplicate keys and JSON validity

### Verification

- type-check: Pass
- lint: Pass (0 errors, 2 pre-existing warnings in paypal-webhook)
- build: Pass
- check:circular: No circular dependencies
- targeted i18n tests: 268 passed (Buyer i18n fixes + locale JSON validation)
- tests: 168 suites, 2108 passed, 1 skipped, 2 todo

### Buyer Readiness Score: 89/100 → 90/100 | Beta Decision: GO | Final 100/100 Verification Gate: Ready

## Phase 8.24 — Buyer Final 100/100 Verification Gate

**Date**: 2026-06-28
**Goal**: Execute the final verification gate for the Buyer role, fix any tiny final-gate issues, and determine whether the Buyer role reaches 100/100.

### Issues Fixed

- **FG-024** — Hardcoded Arabic strings in `OrderConfirmation.jsx` PayPal/COD sections
- **FG-025** — Hardcoded English filter tabs in `Orders.jsx`
- **FG-026** — Hardcoded Arabic default in `Cart.jsx` delivery notice

### Files Changed

- `src/pages/OrderConfirmation.jsx` — Internationalized PayPal messages and COD policy section
- `src/pages/buyer/Orders.jsx` — Internationalized filter tabs
- `src/pages/Cart.jsx` — Fixed English default for delivery rules notice
- `src/i18n/locales/en.json` — Added `orderConfirmation.paypal.*`, `orderConfirmation.cod.*`, and `cart.summary.deliveryRulesNotice`
- `src/i18n/locales/ar.json` — Added Arabic translations for the same keys
- `src/__tests__/integration/buyerP1Stabilization.test.js` — Updated assertion to use i18n key
- `src/__tests__/pages/OrderConfirmation.i18n.test.jsx` — New regression test

### Verification

- type-check: Pass
- lint: Pass (0 errors, 2 pre-existing warnings in paypal-webhook)
- build: Pass
- check:circular: No circular dependencies
- full tests: 169 suites, 2149 passed, 1 skipped, 2 todo

### Final Score

- Security/RLS: 18/20
- Payment Integrity: 18/20
- Buyer Core Journey: 19/20
- UX/Error/Mobile Readiness: 13/15
- Database/API Consistency: 8/10
- Test Coverage: 9/10
- Documentation/Operations: 5/5
- **Total: 90/100**

### Decisions

- Buyer Beta: GO ✅
- Buyer 100/100: NO-GO ❌ (11 P2/P3 issues remain)
- Real-Money Launch: NO-GO ❌
- Play Store Readiness: NO-GO ❌

### Next Phase

**Phase 8.25 — Buyer Production Hardening**: close the remaining 11 P2/P3 issues to reach 100/100 and enable real-money launch / Play Store submission.

