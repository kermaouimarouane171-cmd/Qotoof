# مخطط تحسين دور الزائر
## Qotoof — Guest Role Improvement Blueprint v1.0

**تاريخ الإعداد:** 2026-07-05
**المستند إليه:** فحص مباشر للكود الفعلي
**الوضع الحالي:** Sprint 1 مكتمل ✅

---

## مقدمة تنفيذية

هذا المستند هو المرجع الرسمي الوحيد لكل تطوير مستقبلي متعلق بدور الزائر في منصة **قطوف**. تم إعداده بعد مراجعة دقيقة للكود الفعلي لكل ملف ذي صلة، وليس بناءً على افتراضات.

---

## المرحلة 1: مراجعة التدقيق — نتائج موحّدة

### المشاكل المكتشفة مباشرة من الكود (مرتبة حسب الأولوية)

#### مجموعة 1: عدم اتساق رموز الألوان (مشكلة تقنية موثقة)

| الملف | عدد الأصناف المختلطة |
|-------|---------------------|
| `Home.jsx` | 38 استخدام لـ `emerald-*/green-*` بدلاً من `primary-*` |
| `Stores.jsx` | 21 استخدام |
| `MainLayout.jsx` | 57 استخدام |
| `Navbar.jsx` | 1 استخدام في language switcher (`green-100/900`) |
| `TrustBadges.jsx` | 6 استخدامات |
| `Seasonal.jsx` | 16 استخدام |

**السبب الجذري:** `tailwind.config.js` يعرّف `primary-500 = #22c55e` (Tailwind green-500)، لكن `emerald-500 = #10b981` — هما لونان مختلفان بصرياً. تم توحيد `Favorites.jsx` في Sprint 1، لكن باقي الصفحات لا تزال تستخدم الألوان المباشرة.

---

#### مجموعة 2: SEO مفقود في كل الصفحات العامة

`src/components/SEO/SEO.jsx` موجود ومكتمل (يدعم `react-helmet-async`، OG tags، JSON-LD)، لكنه **غير مستخدم في أي صفحة عامة**. الصفحات تستخدم `document.title` مباشرة (`About.jsx`) أو لا تضع SEO أصلاً. ملف `public/og-image.png` غير موجود.

---

#### مجموعة 3: مكوّنات مكررة (Technical Debt)

| المكوّن | الموقع 1 | الموقع 2 |
|---------|---------|---------|
| `OrderTimeline` | `components/ui/OrderTimeline.jsx` | `components/orders/OrderTimeline.jsx` |
| `ReviewModal` | `components/buyer/ReviewModal.jsx` | `components/orders/ReviewModal.jsx` |
| `StoreCard` | مدمجة داخل `Stores.jsx` | غير مستخرجة كمكوّن مستقل |
| `StoreCardSkeleton` | مدمجة داخل `Stores.jsx` | غير مستخرجة |

---

#### مجموعة 4: ثنائية Navbar — مكوّنان يؤديان نفس الدور

- `src/components/Navbar.jsx` — Navbar مستقل
- `src/layouts/MainLayout.jsx` — يحتوي على Header/Navbar/Footer/BottomNav متكاملة

كلاهما موجود ولا يوجد توثيق واضح لأيهما يُستخدم متى. `AppRouter.jsx` يستخدم `MainLayout` الذي يحتوي على كل شيء. `Navbar.jsx` المستقل يُستخدم على الأرجح في بعض الصفحات المحمية فقط.

---

#### مجموعة 5: `SearchResults.jsx` يستخدم `useEffect + useState` بدلاً من TanStack Query

`Marketplace.jsx` تم ترحيله لاستخدام `useProducts` (TanStack Query). لكن `SearchResults.jsx` لا يزال يستخدم `useEffect + useState` يدوياً. هذا يعني فقدان الكاش، وإعادة الفتح عند كل navigation، وعدم اتساق مع النهج المعتمد.

---

#### مجموعة 6: `TrustBadges.jsx` — نصوص مكتوبة مباشرة بالإنجليزية

```jsx
title: 'Protected by 256-bit SSL',
title: 'Secure Storage',
title: 'Privacy Guaranteed',
```
لا تستخدم `useTranslation()` على الإطلاق.

---

#### مجموعة 7: Contact.jsx — يحجب النموذج عن الزائر بدون تجربة بديلة كافية

الزائر يرى `AuthGate` عند محاولة إرسال رسالة. هذا صحيح من ناحية RLS (Supabase)، لكن معلومات الاتصال المباشرة (هاتف، واتساب) يجب أن تكون بارزة أكثر.

---

#### مجموعة 8: HelpCenter — تذاكر الدعم محجوبة خلف Auth

الأسئلة الشائعة (FAQ) متاحة للجميع، لكن إنشاء تذكرة دعم يُظهر `AuthGate modal`. هذا صحيح، لكن يمكن تحسين الرسالة المعروضة.

---

#### مجموعة 9: Navbar language switcher — ألوان غير متسقة مع التصميم

```jsx
'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
```
يستخدم `green-*` بدلاً من `primary-*`.

---

#### مجموعة 10: `Stores.jsx` — فئات المنتجات مكتوبة مباشرة بالعربية

```jsx
{ value: 'vegetables', label: 'خضروات' },
{ value: 'fruits', label: 'فواكه' },
```
بدون استخدام `t(...)`.

---

#### مجموعة 11: `Seasonal.jsx` — نصوص المتاح/غير المتاح مكتوبة مباشرة

```jsx
{ label: 'ذروة الموسم' },
{ label: 'متوفر' },
{ label: 'غير متوفر' },
```
بدون `t(...)`.

---

#### مجموعة 12: PWA — `og-image.png` مفقود

`SEO.jsx` يشير إلى `/og-image.png` كصورة افتراضية. الملف غير موجود في `public/`.

---

## المرحلة 2: أهداف التطوير

### الهدف 1: توحيد الهوية البصرية (Color Token Consistency)
- **القيمة التجارية:** الاتساق البصري يعكس احترافية المنصة ويبني الثقة.
- **الأثر على المستخدم:** لا يشعر الزائر بـ"خلط" في الألوان بين الصفحات.
- **الأولوية:** عالية (تُؤثر على كل صفحة عامة).

### الهدف 2: تحسين SEO وظهور المنصة في محركات البحث
- **القيمة التجارية:** زيادة الزيارات العضوية، وهو القناة الأساسية لاكتساب المستخدمين الجدد.
- **الأثر على المستخدم:** ظهور معلومات صحيحة عند مشاركة الروابط (OG tags).
- **الأولوية:** عالية جداً (معطّل حالياً بالكامل في صفحات الزائر).

### الهدف 3: إكمال توطين نصوص الزائر (i18n Coverage)
- **القيمة التجارية:** دعم المستخدمين المغاربة بثلاث لغات (عربية، فرنسية، إنجليزية).
- **الأثر على المستخدم:** تجربة متسقة في كل اللغات.
- **الأولوية:** عالية (نصوص مكتوبة مباشرة لا تزال موجودة).

### الهدف 4: تحسين أداء البحث للزائر (Search Performance)
- **القيمة التجارية:** البحث هو نقطة الدخول الرئيسية للمشتري الجديد.
- **الأثر على المستخدم:** نتائج فورية، لا انتظار عند العودة للصفحة.
- **الأولوية:** متوسطة (يعمل حالياً لكن بدون كاش).

### الهدف 5: تقليل التعقيد التقني (Technical Debt Reduction)
- **القيمة التجارية:** سهولة الصيانة وتقليل أوقات التطوير المستقبلي.
- **الأثر على المستخدم:** لا أثر مباشر، لكن يُقلل احتمالية الأخطاء.
- **الأولوية:** متوسطة.

---

## المرحلة 3: مراحل التطوير

| # | المرحلة | السبب في هذا الترتيب |
|---|---------|---------------------|
| 1 | **الأساسيات** *(Foundation)* | مكتملة (Sprint 1 ✅) |
| 2 | **التنقل والتخطيط** *(Navigation & Layout)* | الأساس الهيكلي قبل أي صفحة |
| 3 | **الصفحة الرئيسية** *(Home)* | أول ما يراه الزائر |
| 4 | **الويترين والبيانات الوصفية** *(SEO & OG)* | يُمكّن صفحات المرحلتين 3 و5 من الظهور صحيحاً |
| 5 | **السوق** *(Marketplace)* | أكثر صفحة يزورها الزائر بعد Home |
| 6 | **البحث** *(Search)* | يعتمد على قرارات Marketplace من المرحلة 5 |
| 7 | **التصنيفات والمواسم** *(Categories & Seasonal)* | تعتمد على نظام الفئات الموحّد |
| 8 | **تفاصيل المنتج** *(Product Detail)* | تعتمد على Marketplace |
| 9 | **المتاجر** *(Stores)* | تعتمد على بنية ProductCard المستخرجة |
| 10 | **المصادقة** *(Auth Gates & Trust)* | تعتمد على كل الصفحات الأمامية |
| 11 | **الأداء** *(Performance)* | بعد اكتمال كل الصفحات |
| 12 | **إمكانية الوصول** *(Accessibility)* | مرحلة نهائية شاملة |

---

## المرحلة 4: تقسيم كل مرحلة إلى مهام

---

### المرحلة 2: التنقل والتخطيط

**المهمة 2.1: توحيد Navbar / MainLayout**
- **الهدف:** تحديد أيٌّ من `Navbar.jsx` و`MainLayout.jsx` هو المستخدم فعلياً في مسارات الزائر، وتوثيق الفرق.
- **النتيجة المتوقعة:** لا يوجد تضارب. كل مطوّر يعرف أين يُعدّل.
- **التبعيات:** لا شيء.
- **التعقيد:** منخفض (استقصاء + توثيق).
- **المخاطر:** منخفضة.

**الملفات:**
- Layouts: `src/layouts/MainLayout.jsx`
- Components: `src/components/Navbar.jsx`, `src/components/ProtectedRoute.jsx`

---

**المهمة 2.2: توحيد رموز الألوان في Navbar.jsx**
- **الهدف:** استبدال `green-100/900/700/400` بـ `primary-*/success-*` في language switcher.
- **النتيجة المتوقعة:** Navbar يستخدم `primary-100 dark:primary-900/30 text-primary-700` فقط.
- **التبعيات:** لا شيء.
- **التعقيد:** منخفض (تعديل واحد في سطر واحد).
- **المخاطر:** منخفضة جداً.

**الملفات:**
- Components: `src/components/Navbar.jsx` (السطر 180)

---

**المهمة 2.3: توحيد رموز الألوان في MainLayout.jsx**
- **الهدف:** استبدال 57 استخدام لـ `green-*/emerald-*` بـ `primary-*` في `MainLayout.jsx`.
- **النتيجة المتوقعة:** Header، Footer، BottomNav يستخدمون `primary-*` فقط.
- **التبعيات:** قرار تصميمي: هل `emerald` يُستبدل بـ `primary`؟ (يتطلب موافقة). راجع ملاحظة التصميم أدناه.
- **التعقيد:** متوسط (57 استبدال، يحتاج مراجعة بصرية بعد كل مجموعة).
- **المخاطر:** متوسطة (تأثير بصري على كل صفحة).

**الملفات:**
- Layouts: `src/layouts/MainLayout.jsx`
- Styles: `tailwind.config.js` (للتحقق من قيم primary)

> **ملاحظة تصميمية حرجة:** `emerald-500 = #10b981` بينما `primary-500 = #22c55e`. الاستبدال سيُغيّر الدرجة اللونية. الخيار الآمن: تحديث `tailwind.config.js` لجعل `primary-*` تُطابق `emerald-*`، ثم الاستبدال. هذا يحفظ المظهر الحالي ويُحقق الاتساق التقني.

---

**المهمة 2.4: i18n للـ Footer داخل MainLayout**
- **الهدف:** التحقق من أن كل نصوص Footer تستخدم `t(...)`. حالياً الكود يستخدم `t()` لكن يجب التحقق من وجود مفاتيح مقابلة في `ar.json/en.json/fr.json`.
- **النتيجة المتوقعة:** Footer مترجم بالكامل في الثلاث لغات.
- **التبعيات:** 2.1
- **التعقيد:** منخفض.
- **المخاطر:** منخفضة.

**الملفات:**
- Layouts: `src/layouts/MainLayout.jsx`
- i18n: `src/i18n/locales/ar.json`, `en.json`, `fr.json`

---

**المهمة 2.5: توحيد رموز الألوان في TrustBadges.jsx + إضافة i18n**
- **الهدف:** استبدال `green-*` بـ `primary-*` + إضافة `useTranslation` للنصوص.
- **النتيجة المتوقعة:** TrustBadges مترجم ومتسق.
- **التبعيات:** لا شيء.
- **التعقيد:** منخفض.
- **المخاطر:** منخفضة.

**الملفات:**
- Components: `src/components/ui/TrustBadges.jsx`
- i18n: `src/i18n/locales/ar.json`, `en.json`, `fr.json`

---

### المرحلة 3: الصفحة الرئيسية

**المهمة 3.1: توحيد رموز الألوان في Home.jsx**
- **الهدف:** استبدال 38 استخدام لـ `emerald-*/green-*` بـ `primary-*`.
- **النتيجة المتوقعة:** الصفحة الرئيسية بصرياً متسقة مع باقي المنصة.
- **التبعيات:** القرار التصميمي من 2.3 يجب أن يُحسم أولاً.
- **التعقيد:** متوسط.
- **المخاطر:** متوسطة (أكثر صفحة يراها الزائر أولاً).

**الملفات:**
- Pages: `src/pages/Home.jsx`
- Styles: `tailwind.config.js`

---

**المهمة 3.2: تحسين هيكل Hero Section لإمكانية الوصول**
- **الهدف:** التأكد من أن `<h1>` موجود وفريد، أن `<section>` لها `aria-label`، وأن زري CTA واضحان.
- **النتيجة المتوقعة:** اجتياز axe accessibility audit في Hero Section.
- **التبعيات:** 3.1
- **التعقيد:** منخفض.
- **المخاطر:** منخفضة.

**الملفات:**
- Pages: `src/pages/Home.jsx`

---

**المهمة 3.3: إضافة `<SEO>` للصفحة الرئيسية**
- **الهدف:** إضافة `import SEO` وعنصر `<SEO>` مع JSON-LD من نوع `WebSite` + `Organization`.
- **النتيجة المتوقعة:** Google يفهم هيكل المنصة من أول صفحة.
- **التبعيات:** المرحلة 4 (SEO) — يُنفَّذ بعد إنشاء `og-image.png`.
- **التعقيد:** منخفض.
- **المخاطر:** منخفضة.

**الملفات:**
- Pages: `src/pages/Home.jsx`
- Components: `src/components/SEO/SEO.jsx`

---

### المرحلة 4: SEO والبيانات الوصفية

**المهمة 4.1: إنشاء og-image.png**
- **الهدف:** إنشاء صورة OG بمقاس 1200×630 تحمل شعار قطوف وعبارة التعريف.
- **النتيجة المتوقعة:** `public/og-image.png` موجود.
- **التبعيات:** لا شيء.
- **التعقيد:** تصميمي (خارج نطاق الكود مباشرة).
- **المخاطر:** منخفضة.

**الملفات:**
- Assets: `public/og-image.png` (جديد)

---

**المهمة 4.2: تطبيع SEO في `SEO.jsx` — دعم `og:locale` متعدد**
- **الهدف:** `SEO.jsx` حالياً يضع `og:locale = ar_MA` ثابتاً. يجب أن يكون ديناميكياً بناءً على `i18n.language`.
- **النتيجة المتوقعة:** `og:locale` يتغيّر مع اللغة المختارة.
- **التبعيات:** لا شيء.
- **التعقيد:** منخفض.
- **المخاطر:** منخفضة.

**الملفات:**
- Components: `src/components/SEO/SEO.jsx`

---

**المهمة 4.3: إضافة `<SEO>` لصفحة Marketplace**
- **الهدف:** SEO ديناميكي يعكس الفلاتر النشطة (الفئة، المنطقة).
- **النتيجة المتوقعة:** `<title>` يتغيّر عند اختيار فئة.
- **التبعيات:** 4.1، 4.2
- **التعقيد:** متوسط.
- **المخاطر:** منخفضة.

**الملفات:**
- Pages: `src/pages/Marketplace.jsx`
- Components: `src/components/SEO/SEO.jsx`
- i18n: `src/i18n/locales/ar.json`, `en.json`, `fr.json`

---

**المهمة 4.4: إضافة `<SEO>` لصفحة ProductDetail**
- **الهدف:** SEO يعكس اسم المنتج، صورته، سعره (JSON-LD `Product` schema).
- **النتيجة المتوقعة:** Google يعرض بطاقة المنتج الغنية (Rich Snippet).
- **التبعيات:** 4.1، 4.2
- **التعقيد:** متوسط (JSON-LD يحتاج بنية محددة).
- **المخاطر:** منخفضة.

**الملفات:**
- Pages: `src/pages/ProductDetail.jsx`
- Components: `src/components/SEO/SEO.jsx`

---

**المهمة 4.5: إضافة `<SEO>` لباقي الصفحات العامة**

الصفحات المعنية:
- `StoreDetail.jsx`
- `Stores.jsx`
- `SearchResults.jsx`
- `About.jsx` (استبدال `useEffect document.title` بـ `<SEO>`)
- `Contact.jsx`
- `BecomeVendor.jsx`
- `HelpCenter.jsx`
- `Seasonal.jsx`

**التعقيد:** منخفض لكل صفحة على حدة.
**المخاطر:** منخفضة.

**الملفات:**
- Pages: الصفحات المذكورة أعلاه
- Components: `src/components/SEO/SEO.jsx`

---

### المرحلة 5: السوق

**المهمة 5.1: توحيد رموز الألوان في Marketplace.jsx**
- **الهدف:** 6 استخدامات لـ `emerald-*/green-*` → `primary-*`.
- **التبعيات:** القرار التصميمي من 2.3.
- **التعقيد:** منخفض.

**الملفات:**
- Pages: `src/pages/Marketplace.jsx`

---

**المهمة 5.2: استخراج `StoreCard` من Stores.jsx كمكوّن مستقل**
- **الهدف:** `StoreCardSkeleton` و`StoreCard` المدمجتان في `Stores.jsx` تُستخرجان إلى `src/components/ui/StoreCard.jsx`.
- **النتيجة المتوقعة:** يمكن إعادة استخدام `StoreCard` في `Home.jsx` وأي مكان آخر.
- **التبعيات:** لا شيء.
- **التعقيد:** منخفض.
- **المخاطر:** منخفضة (refactor، لا تغيير في السلوك).

**الملفات:**
- Pages: `src/pages/Stores.jsx`
- Components: `src/components/ui/StoreCard.jsx` (جديد)
- Components: `src/components/ui/index.js` (تحديث)

---

**المهمة 5.3: توحيد i18n في `Stores.jsx` — فئات وخيارات الفرز**
- **الهدف:** استبدال `label: 'خضروات'` بـ `t('home.categories.vegetables', 'خضروات')` وما شابه.
- **التبعيات:** لا شيء.
- **التعقيد:** منخفض.

**الملفات:**
- Pages: `src/pages/Stores.jsx`
- i18n: `src/i18n/locales/ar.json`, `en.json`, `fr.json`

---

### المرحلة 6: البحث

**المهمة 6.1: ترحيل `SearchResults.jsx` إلى TanStack Query**
- **الهدف:** استبدال `useEffect + useState` بـ `useQuery` مثلما هو الحال في `Marketplace.jsx`.
- **النتيجة المتوقعة:** نتائج البحث مُكاشة، العودة للصفحة فورية.
- **التبعيات:** المرحلة 5 (للتأكد من اتساق `useProducts` hook).
- **التعقيد:** متوسط.
- **المخاطر:** متوسطة (تغيير منطق البيانات).

**الملفات:**
- Pages: `src/pages/SearchResults.jsx`
- Hooks: `src/modules/catalog` (التحقق من وجود `useProducts` hook مناسب)
- Services: `src/services/search/productSearchService.js`

---

**المهمة 6.2: إضافة SEO لصفحة SearchResults**
- **الهدف:** `<title>` يعكس مصطلح البحث الحالي.
- **التبعيات:** 4.1، 6.1
- **التعقيد:** منخفض.

**الملفات:**
- Pages: `src/pages/SearchResults.jsx`

---

### المرحلة 7: التصنيفات والمواسم

**المهمة 7.1: توحيد i18n في `Seasonal.jsx`**
- **الهدف:** استبدال `'ذروة الموسم'`، `'متوفر'`، `'غير متوفر'` بمفاتيح `t(...)`.
- **التبعيات:** لا شيء.
- **التعقيد:** منخفض.

**الملفات:**
- Pages: `src/pages/Seasonal.jsx`
- i18n: `src/i18n/locales/ar.json`, `en.json`, `fr.json`

---

**المهمة 7.2: توحيد رموز الألوان في `Seasonal.jsx`**
- **الهدف:** 16 استخدام لـ `green-*` → `primary-*`.
- **التبعيات:** القرار التصميمي من 2.3.
- **التعقيد:** منخفض.

**الملفات:**
- Pages: `src/pages/Seasonal.jsx`

---

**المهمة 7.3: إضافة SEO لصفحة Seasonal**
- **التبعيات:** 4.1، 4.2
- **التعقيد:** منخفض.

**الملفات:**
- Pages: `src/pages/Seasonal.jsx`

---

### المرحلة 8: تفاصيل المنتج والمتاجر

**المهمة 8.1: تحسين تجربة AuthGate في ProductDetail**
- **الهدف:** عند محاولة كتابة مراجعة أو الانضمام للقائمة الانتظار، رسالة `AuthGate` تعرض `showRegister=true` وتوضح الفائدة.
- **النتيجة المتوقعة:** معدل تحويل الزوار أعلى عند الوصول لنقاط الاحتكاك.
- **التبعيات:** لا شيء.
- **التعقيد:** منخفض.

**الملفات:**
- Pages: `src/pages/ProductDetail.jsx`
- Components: `src/components/auth/AuthGate.jsx`
- i18n: `src/i18n/locales/ar.json`, `en.json`, `fr.json`

---

**المهمة 8.2: تحسين تجربة AuthGate في StoreDetail**
- **الهدف:** نفس 8.1 لكن لصفحة StoreDetail (التقييم، التواصل).
- **التبعيات:** 8.1
- **التعقيد:** منخفض.

**الملفات:**
- Pages: `src/pages/StoreDetail.jsx`

---

**المهمة 8.3: توحيد رموز الألوان في StoreDetail.jsx**
- **التبعيات:** القرار التصميمي من 2.3.
- **التعقيد:** متوسط (صفحة كبيرة ~1283 سطر).

**الملفات:**
- Pages: `src/pages/StoreDetail.jsx`

---

### المرحلة 9: الثقة والمصادقة

**المهمة 9.1: تحسين Contact.jsx للزائر**
- **الهدف:** عرض معلومات الاتصال (هاتف، واتساب، بريد) بشكل بارز قبل `AuthGate`.
- **النتيجة المتوقعة:** الزائر يجد معلومات الاتصال فوراً.
- **التبعيات:** لا شيء.
- **التعقيد:** منخفض.

**الملفات:**
- Pages: `src/pages/Contact.jsx`

---

**المهمة 9.2: تحسين رسالة AuthGate في Cart للزائر**
- **الهدف:** رسالة AuthGate في Cart توضح "سلتك محفوظة ✓" وتعرض فوائد التسجيل.
- **التبعيات:** لا شيء.
- **التعقيد:** منخفض.

**الملفات:**
- Pages: `src/pages/Cart.jsx`
- i18n: `src/i18n/locales/ar.json`, `en.json`, `fr.json`

---

**المهمة 9.3: تحسين رسالة AuthGate في HelpCenter**
- **الهدف:** توضيح سبب الحاجة للتسجيل لفتح تذكرة دعم.
- **التبعيات:** لا شيء.
- **التعقيد:** منخفض.

**الملفات:**
- Pages: `src/pages/HelpCenter.jsx`

---

**المهمة 9.4: إزالة التكرار — توحيد ReviewModal**
- **الهدف:** تحديد أيٌّ من `components/buyer/ReviewModal.jsx` و`components/orders/ReviewModal.jsx` هو المرجعي، وإزالة الآخر أو توجيهه.
- **التبعيات:** تحليل الاستخدامات الفعلية أولاً.
- **التعقيد:** متوسط.
- **المخاطر:** متوسطة.

**الملفات:**
- Components: `src/components/buyer/ReviewModal.jsx`
- Components: `src/components/orders/ReviewModal.jsx`

---

**المهمة 9.5: إزالة التكرار — توحيد OrderTimeline**
- **الهدف:** نفس 9.4 لكن لـ `OrderTimeline`.
- **التبعيات:** تحليل الاستخدامات أولاً.
- **التعقيد:** متوسط.

**الملفات:**
- Components: `src/components/ui/OrderTimeline.jsx`
- Components: `src/components/orders/OrderTimeline.jsx`

---

### المرحلة 10: الأداء

**المهمة 10.1: التحقق من bundle size بعد كل الإضافات**
- **الهدف:** تشغيل `npm run build:check` والتحقق من عدم تجاوز الحد.
- **التبعيات:** اكتمال كل المراحل السابقة.
- **التعقيد:** منخفض (تشغيل سكريبت).

**الملفات:**
- Scripts: `scripts/checkBundleSize.js`

---

**المهمة 10.2: التحقق من Lighthouse Score للزائر**
- **الهدف:** تشغيل `npm run perf:lighthouse` والتحقق من Performance ≥ 90، SEO = 100، Accessibility ≥ 90.
- **التبعيات:** اكتمال المرحلة 4 (SEO).

---

### المرحلة 11: إمكانية الوصول

**المهمة 11.1: تشغيل اختبارات axe على كل صفحات الزائر**
- **الهدف:** `npm run test:a11y` يجتاز بدون أخطاء critical أو serious.
- **التبعيات:** اكتمال كل المراحل.

**الملفات:**
- Tests: `cypress/e2e/accessibility.cy.js`

---

**المهمة 11.2: تحقق من RTL في كل صفحات الزائر**
- **الهدف:** التأكد من أن `dir="rtl"` مُطبق صحيحاً في كل صفحة عند تحديد اللغة العربية.

---

## المرحلة 5: الملفات المطلوبة بالكامل

### الصفحات (Pages) المعنية بدور الزائر

| الملف | المهام المتعلقة |
|-------|----------------|
| `src/pages/Home.jsx` | 3.1, 3.2, 3.3 |
| `src/pages/Marketplace.jsx` | 5.1, 4.3 |
| `src/pages/SearchResults.jsx` | 6.1, 6.2 |
| `src/pages/ProductDetail.jsx` | 8.1, 4.4 |
| `src/pages/StoreDetail.jsx` | 8.2, 8.3, 4.5 |
| `src/pages/Stores.jsx` | 5.2, 5.3, 4.5 |
| `src/pages/Cart.jsx` | 9.2 |
| `src/pages/Favorites.jsx` | مكتملة (Sprint 1) ✅ |
| `src/pages/Seasonal.jsx` | 7.1, 7.2, 7.3 |
| `src/pages/About.jsx` | 4.5 |
| `src/pages/Contact.jsx` | 9.1, 4.5 |
| `src/pages/HelpCenter.jsx` | 9.3, 4.5 |
| `src/pages/BecomeVendor.jsx` | 4.5 |

### التخطيطات (Layouts)

| الملف | المهام |
|-------|--------|
| `src/layouts/MainLayout.jsx` | 2.1, 2.3, 2.4 |

### المكوّنات (Components)

| الملف | المهام |
|-------|--------|
| `src/components/Navbar.jsx` | 2.1, 2.2 |
| `src/components/SEO/SEO.jsx` | 4.2 |
| `src/components/auth/AuthGate.jsx` | 8.1, 9.2 |
| `src/components/ui/TrustBadges.jsx` | 2.5 |
| `src/components/ui/ProductCard.jsx` | مراجعة (لا تعديل متوقع) |
| `src/components/ui/Breadcrumbs.jsx` | مراجعة |
| `src/components/ui/StoreCard.jsx` | 5.2 (جديد) |
| `src/components/ui/index.js` | 5.2 |
| `src/components/buyer/ReviewModal.jsx` | 9.4 |
| `src/components/orders/ReviewModal.jsx` | 9.4 |
| `src/components/ui/OrderTimeline.jsx` | 9.5 |
| `src/components/orders/OrderTimeline.jsx` | 9.5 |

### الـ Hooks

| الملف | المهام |
|-------|--------|
| `src/hooks/useRequireAuth.js` | مراجعة (لا تعديل متوقع) |
| `src/modules/catalog` | 6.1 |

### الخدمات (Services)

| الملف | المهام |
|-------|--------|
| `src/services/search/productSearchService.js` | 6.1 |

### الأنماط (Styles)

| الملف | المهام |
|-------|--------|
| `tailwind.config.js` | **القرار التصميمي الحرج** — 2.3, 3.1, 5.1, 7.2, 8.3 |

### السياقات (Contexts / i18n)

| الملف | المهام |
|-------|--------|
| `src/i18n/locales/ar.json` | 2.4, 2.5, 4.3, 4.4, 4.5, 5.3, 7.1, 8.1, 9.2, 9.3 |
| `src/i18n/locales/en.json` | نفس السابق |
| `src/i18n/locales/fr.json` | نفس السابق |

### الـ Assets

| الملف | المهام |
|-------|--------|
| `public/og-image.png` | 4.1 (جديد) |

---

## المرحلة 6: شجرة التبعيات

```
القرار التصميمي (tailwind.config.js)
    └──► 2.3 (MainLayout)
    └──► 3.1 (Home)
    └──► 5.1 (Marketplace)
    └──► 7.2 (Seasonal)
    └──► 8.3 (StoreDetail)

4.1 (og-image.png)
    └──► 4.2 (SEO.jsx locale)
         └──► 3.3 (Home SEO)
         └──► 4.3 (Marketplace SEO)
         └──► 4.4 (ProductDetail SEO)
         └──► 4.5 (باقي الصفحات)
         └──► 6.2 (SearchResults SEO)
         └──► 7.3 (Seasonal SEO)

5.2 (استخراج StoreCard)
    └──► يُمكّن إعادة الاستخدام في Home.jsx و Marketplace.jsx

6.1 (SearchResults → TanStack Query)
    └──► 6.2 (SearchResults SEO)

2.1 (توثيق Navbar vs MainLayout)
    └──► 2.2 (Navbar colors)
    └──► 2.3 (MainLayout colors)
    └──► 2.4 (Footer i18n)

9.4 + 9.5 (إزالة التكرار) — مستقلتان
```

---

## المرحلة 7: تحليل المخاطر

| المرحلة | المخاطر | تقليل المخاطر |
|---------|---------|---------------|
| **2.3 (ألوان MainLayout)** | تغيير بصري على كل الصفحات | تشغيل `visual-public.cy.js` قبل وبعد |
| **3.1 (ألوان Home)** | تغيير بصري على أكثر صفحة مرئية | Screenshot comparison |
| **6.1 (TanStack Query في Search)** | تغيير منطق البيانات | اختبارات regression + مراجعة يدوية |
| **9.4 و9.5 (إزالة التكرار)** | كسر مكوّن يستخدمه كود آخر | بحث عن كل المستوردين أولاً بـ grep |
| **5.2 (استخراج StoreCard)** | كسر صفحة Stores | اختبار صفحة Stores بعد الاستخراج مباشرة |
| **4.4 (JSON-LD للمنتج)** | خطأ في schema يُضر بـ SEO | التحقق بـ Google Rich Results Test |

### الانتكاسات المحتملة (Regressions)

1. **ألوان Dark Mode:** عند استبدال `emerald-*` بـ `primary-*`، يجب التحقق من أن متغيرات Dark Mode (`dark:primary-*`) تعمل.
2. **RTL + Tailwind:** بعض utility classes تتأثر بـ `dir="rtl"`. أي تغيير في Layout يحتاج تحقق RTL.
3. **TanStack Query cache keys:** في `SearchResults.jsx`، إذا تغيّر شكل `queryKey` يجب أن يتوافق مع بقية الكود.

---

## المرحلة 8: استراتيجية الاختبار

### لكل مرحلة

| نوع الاختبار | الأداة | الأمر |
|-------------|--------|-------|
| اختبار يدوي | --- | تصفح الصفحة في المتصفح |
| اختبار موبايل | Chrome DevTools (375px) | --- |
| اختبار سطح المكتب | Chrome DevTools (1280px) | --- |
| اختبار تجاوب | Chrome DevTools Responsive | --- |
| اختبار Dark Mode | Toggle في Navbar | --- |
| اختبار الترجمة | Language Switcher (AR/FR/EN) | --- |
| اختبار a11y | `jest-axe` + `cypress-axe` | `npm run test:a11y` |
| اختبار Regression | Cypress Visual | `npm run test:visual` |
| اختبار وحدة | Jest | `npm run test:unit` |
| اختبار Smoke | Cypress Smoke | `npm run test:smoke` |
| اختبار Bundle | Vite + سكريبت | `npm run build:check` |
| اختبار i18n | Jest (localeJsonValidation) | `npm run test:unit -- localeJsonValidation` |
| اختبار SEO | Google Rich Results Test | (يدوي) |
| اختبار Lighthouse | LHCI | `npm run perf:lighthouse` |

---

## المرحلة 9: تعريف "الاكتمال" لكل مرحلة

### المرحلة 2 (Navigation & Layout) مكتملة إذا:
- ✔ `Navbar.jsx` يستخدم `primary-*` فقط في language switcher
- ✔ توثيق `Navbar.jsx vs MainLayout.jsx` موجود
- ✔ `TrustBadges.jsx` مترجم بالكامل
- ✔ لا أخطاء Console
- ✔ الوضع الداكن يعمل
- ✔ `npm run test:smoke` يجتاز

### المرحلة 3 (Home) مكتملة إذا:
- ✔ لا يوجد `emerald-*/green-*` في `Home.jsx`
- ✔ اختبار Visual لا يُظهر انحدار
- ✔ `<SEO>` موجود مع JSON-LD صحيح
- ✔ `<h1>` فريد وواحد في الصفحة
- ✔ RTL يعمل
- ✔ لا أخطاء ESLint

### المرحلة 4 (SEO) مكتملة إذا:
- ✔ `public/og-image.png` موجود بالأبعاد الصحيحة (1200×630)
- ✔ كل صفحة عامة لها `<SEO>` مع `<title>` و`description` مناسبَيْن
- ✔ Google Rich Results Test يقبل JSON-LD للمنتج
- ✔ `og:locale` يتغيّر مع اللغة
- ✔ Lighthouse SEO = 100

### المرحلة 5 (Marketplace) مكتملة إذا:
- ✔ `StoreCard` مستخرج كمكوّن مستقل وقابل للاستيراد
- ✔ `Stores.jsx` يستخدم `StoreCard` المستقل
- ✔ فئات Stores مترجمة
- ✔ لا أخطاء TypeScript
- ✔ `npm run test:smoke` يجتاز

### المرحلة 6 (Search) مكتملة إذا:
- ✔ `SearchResults.jsx` يستخدم TanStack Query
- ✔ العودة للصفحة من ProductDetail تُعيد نتائج البحث فوراً (من الكاش)
- ✔ لا `useEffect` يدوي للبيانات في `SearchResults.jsx`
- ✔ اختبارات regression تجتاز

### المرحلة 7 (Categories & Seasonal) مكتملة إذا:
- ✔ جميع نصوص `Seasonal.jsx` تستخدم `t(...)`
- ✔ الصفحة تُترجم لـ EN/FR/AR بشكل كامل
- ✔ `npm run test:unit -- localeJsonValidation` يجتاز

### المرحلة 8 (Product & Store Detail) مكتملة إذا:
- ✔ `AuthGate` في `ProductDetail` يعرض `showRegister=true` وفوائد التسجيل
- ✔ `StoreDetail` ألوانه موحّدة
- ✔ لا أخطاء Console في أي من الصفحتين

### المرحلة 9 (Trust & Auth Gates) مكتملة إذا:
- ✔ معلومات الاتصال بارزة في `Contact.jsx` للزائر
- ✔ `ReviewModal` و`OrderTimeline` لكل منهما نسخة واحدة مستخدمة
- ✔ لا ملفات مكررة غير مستخدمة

### المرحلة 10 (Performance) مكتملة إذا:
- ✔ `npm run build:check` لا يُظهر تجاوز الحد
- ✔ Lighthouse Performance ≥ 90
- ✔ Lighthouse SEO = 100

### المرحلة 11 (Accessibility) مكتملة إذا:
- ✔ `npm run test:a11y` يجتاز بدون أخطاء critical
- ✔ RTL محقق في كل الصفحات العامة
- ✔ كل العناصر التفاعلية لها `aria-label` أو `aria-current`

---

## المرحلة 10: ترتيب التنفيذ

### Sprint 1 — الأساسيات ✅ (مكتمل)
- ✅ 1.1 مراجعة النصوص المكتوبة مباشرة
- ✅ 1.2 ترحيل Home/Favorites إلى i18n
- ✅ 1.3 تطبيع البريد الإلكتروني
- ✅ 1.4 إصلاح Toast messages
- ✅ 1.5 توحيد ألوان Favorites.jsx

---

### Sprint 2 — التنقل والتخطيط (المهام 2.x)
**الهدف:** حل القرار التصميمي الحرج وتوحيد الهيكل قبل أي صفحة.

> **⚠️ يجب حسم القرار التصميمي الآتي قبل البدء:**
>
> هل تُحدَّث قيم `primary-*` في `tailwind.config.js` لتطابق `emerald-*` (حفظ المظهر الحالي + تحقيق الاتساق التقني)؟
>
> أم تُحوَّل كل `emerald-*` إلى `primary-*` الحالية (مما سيُغيّر الدرجة اللونية من `#10b981` إلى `#22c55e`)؟
>
> **التوصية:** خيار 1 (تحديث `tailwind.config.js`) — الأقل مخاطرة بصرياً.

1. 2.1 — توثيق Navbar vs MainLayout
2. 2.2 — ألوان Navbar.jsx (سريع جداً)
3. 2.3 — ألوان MainLayout.jsx (الأكبر تأثيراً)
4. 2.4 — i18n Footer
5. 2.5 — TrustBadges i18n + ألوان

**لماذا هذا الترتيب يُقلل المخاطر:** كل الصفحات تستخدم `MainLayout`. توحيده أولاً يعني أن كل صفحة لاحقة تبدأ من أساس سليم.

---

### Sprint 3 — SEO والأصول (المهام 4.1, 4.2 + 3.3)
**الهدف:** فتح مسار SEO لكل الصفحات.

1. 4.1 — إنشاء `og-image.png` (1200×630)
2. 4.2 — تحديث `SEO.jsx` لـ `og:locale` ديناميكي
3. 3.3 — إضافة `<SEO>` للصفحة الرئيسية أولاً كتجربة

**لماذا قبل باقي SEO:** `og-image.png` مطلوب من كل الصفحات. إنجازه أولاً يُفتح الطريق للسبرنت التالي.

---

### Sprint 4 — الصفحة الرئيسية + تحسين المرئيات (المهام 3.1, 3.2, 4.3, 5.1)
**الهدف:** أولى الصفحات التي يراها الزائر متسقة وكاملة.

1. 3.1 — ألوان Home.jsx
2. 3.2 — a11y Hero Section
3. 4.3 — SEO للـ Marketplace
4. 5.1 — ألوان Marketplace.jsx

---

### Sprint 5 — المكوّنات المشتركة والتكرار (المهام 5.2, 5.3, 9.4, 9.5)
**الهدف:** تنظيف تقني يُسهّل كل السبرنتات اللاحقة.

1. 5.2 — استخراج StoreCard
2. 5.3 — i18n Stores
3. 9.4 — توحيد ReviewModal
4. 9.5 — توحيد OrderTimeline

---

### Sprint 6 — البحث والتصنيفات (المهام 6.1, 6.2, 7.1, 7.2, 7.3)
**الهدف:** رحلة الاكتشاف كاملة.

1. 6.1 — SearchResults → TanStack Query
2. 6.2 — SEO SearchResults
3. 7.1, 7.2, 7.3 — Seasonal i18n + ألوان + SEO

---

### Sprint 7 — تفاصيل المنتج والمتاجر (المهام 4.4, 4.5, 8.1, 8.2, 8.3)
**الهدف:** اكتمال صفحات "عمق الاستكشاف".

1. 4.4 — SEO ProductDetail مع JSON-LD
2. 4.5 — SEO لكل الصفحات الباقية
3. 8.1 — AuthGate ProductDetail
4. 8.2 — AuthGate StoreDetail
5. 8.3 — ألوان StoreDetail

---

### Sprint 8 — الثقة والاحتكاك (المهام 9.1, 9.2, 9.3)
**الهدف:** كل نقطة احتكاك بين الزائر والمنصة مُحسّنة.

1. 9.1 — Contact.jsx للزائر
2. 9.2 — AuthGate Cart
3. 9.3 — AuthGate HelpCenter

---

### Sprint 9 — الأداء وإمكانية الوصول (المهام 10.x, 11.x)
**الهدف:** التحقق الشامل قبل الإطلاق.

1. 10.1 — Bundle check
2. 10.2 — Lighthouse audit
3. 11.1 — axe a11y audit
4. 11.2 — RTL verification

---

## المرحلة 11: التحسينات المستقبلية

### الإصدار 1.0 (المشروع الحالي)
كل ما تم تعريفه في Sprints 1–9 أعلاه.

---

### الإصدار 1.1 — تحسين تجربة الاكتشاف
- **Social Proof بارز:** عرض "X مشتري اشتروا هذا المنتج اليوم" في ProductCard.
- **Recently Viewed للزائر:** `RecentlyViewed.jsx` موجود لكن قد لا يعمل للزوار غير المسجلين — التحقق والتمكين.
- **تحسين SearchBar:** اقتراحات فورية (Autocomplete) في نتائج البحث.
- **Breadcrumbs في ProductDetail و StoreDetail:** `Breadcrumbs.jsx` موجود ومُدرج في `Favorites.jsx` و`Marketplace.jsx`، لكن غير مضاف في `ProductDetail.jsx` و`StoreDetail.jsx`.

---

### الإصدار 2.0 — تحسين معدل التحويل
- **Wishlist / Comparison للزائر:** مقارنة منتجات متعددة.
- **تسجيل دخول اجتماعي (Social Login):** Google OAuth — `supabase.auth.signInWithOAuth` متوفر في Supabase لكن غير مُفعَّل في `authStore.js`. يُضيف قيمة تجارية كبيرة لتسريع التسجيل.
- **WhatsApp CTA مباشر من ProductDetail:** زر "استفسر عبر واتساب" يفتح محادثة مع البائع.
- **Progressive Registration:** الزائر يُكمل الطلب ويُسجَّل في الخطوة الأخيرة بدلاً من الحجب المبكر.

---

### الإصدار 3.0 — منصة متقدمة
- **Personalization:** صفحة رئيسية مُخصصة بناءً على تاريخ التصفح (حتى بدون تسجيل، بناءً على localStorage).
- **Push Notifications (PWA):** إشعارات لانخفاض الأسعار أو عودة مخزون منتج محفوظ.
- **Multi-language SEO:** صفحات `/ar/`, `/fr/`, `/en/` لكل صفحة رئيسية (hreflang).
- **A/B Testing CTA:** اختبار أنواع مختلفة من رسائل التسجيل.

---

## المرحلة 12: معايير النجاح النهائية

| المعيار | الهدف |
|---------|-------|
| Lighthouse Performance | ≥ 90 |
| Lighthouse SEO | 100 |
| Lighthouse Accessibility | ≥ 90 |
| Jest Unit Tests | ✔ كل التوقعات تجتاز |
| Cypress Smoke Tests | ✔ كل الصفحات العامة تجتاز |
| Cypress a11y Tests | ✔ لا أخطاء critical |
| ESLint | 0 أخطاء |
| TypeScript `tsc --noEmit` | 0 أخطاء |
| Bundle Size | ضمن حد `checkBundleSize.js` |
| `emerald-*/green-*` في الصفحات العامة | 0 استخدام خارج `tailwind.config.js` |
| صفحات عامة بدون `<SEO>` | 0 |
| نصوص مكتوبة مباشرة في صفحات الزائر | 0 |

---

## أوامر التحقق عند كل Sprint

```bash
# بعد كل Sprint
npm run test:unit -- --testPathPattern=<ما يتعلق بالتغيير>
npm run test:smoke
npm run lint
npm run type-check

# بعد Sprint 3 وما بعده
npm run build:check
npm run test:a11y

# عند النهاية
npm run perf:lighthouse
```

---

**هذا المستند هو المرجع الرسمي الوحيد. أي تطوير متعلق بدور الزائر يجب أن يُحدَّث فيه.**

---

*آخر تحديث: 2026-07-05 | الإصدار: 1.0 | الحالة: Sprint 1 مكتمل ✅*
