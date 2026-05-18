# ARCHITECTURE

## كيف يعمل التطبيق
Qotoof هو تطبيق marketplace متعدد الأدوار (Buyer, Vendor, Driver, Admin) مبني على:
- Frontend: React + Vite
- Backend API: Express داخل `src/api`
- Data/Auth/Realtime/Storage: Supabase
- Payments: عبر خدمات الدفع المدمجة في طبقة `services`

الفكرة الأساسية:
1. المستخدم يتفاعل مع الواجهة (صفحات React).
2. الواجهة تستدعي خدمات من طبقة `src/services`.
3. الخدمات تتصل إما بـ:
- Express API (`src/api`)
- أو Supabase مباشرة (حسب نوع العملية)
4. النتيجة تعود للواجهة مع تحديث الحالة المحلية (stores/hooks).

---

## تدفق الطلبات
التدفق القياسي لأي Request:
1. UI Event (click/submit) في Component أو Page.
2. استدعاء Service function من `src/services`.
3. تنفيذ Validation/Sanitization محليًا.
4. إرسال الطلب عبر:
- `axios` نحو API routes (Express)
- أو Supabase client للبيانات/التخزين/المصادقة
5. في API:
- Middleware (auth, error handling, async handling)
- Route handler
- Service/DB access
6. Response يرجع بصيغة موحدة (success/error + payload).
7. Frontend يحدّث UI و state ويعرض إشعارات النجاح/الفشل.

---

## payment flow
تدفق الدفع (مختصر عملي):
1. Buyer يضيف المنتجات للسلة ويبدأ checkout.
2. Checkout service يحسب:
- subtotal
- shipping
- tax/fees (إن وجدت)
- final amount
3. إنشاء Payment Intent/Reference عبر payment service.
4. تأكيد الدفع من بوابة الدفع.
5. عند النجاح:
- إنشاء/تحديث order status
- تسجيل receipt/transaction record
- تفعيل إشعارات للأطراف المعنية (buyer/vendor/admin)
6. عند الفشل:
- حفظ failure reason
- إتاحة إعادة المحاولة
- منع أي انتقال غير صحيح لحالة الطلب

حماية أساسية مطبقة في هذا المسار:
- idempotency checks
- inventory/commission guards
- validation قبل وبعد الدفع

---

## authentication
التوثيق يعتمد على Supabase Auth مع سياسات إضافية بالتطبيق:
1. Login/Register/Forgot/Reset عبر صفحات auth.
2. الحصول على session/token من Supabase.
3. تخزين آمن للجلسة واستخدامها في الطلبات المحمية.
4. Protected routes تمنع الوصول بدون صلاحية.
5. RBAC حسب الدور (admin/vendor/buyer/driver).
6. دعم التحقق الإضافي مثل:
- email verification
- phone verification
- MFA/2FA (حسب المسار)

على مستوى API:
- middleware يتحقق من التوكن
- التحقق من الدور قبل الوصول للمسارات الحساسة

---

## webhook flow
تدفق الـ Webhooks (نمط عام في المشروع):
1. مزود خارجي (مثل payment provider) يرسل webhook event.
2. endpoint مخصص يستقبل الحدث في backend layer.
3. التحقق من signature/secret.
4. تحويل الحدث إلى action domain واضح (payment success/failure/refund...).
5. تحديث البيانات داخليًا بشكل idempotent.
6. إطلاق آثار جانبية لازمة:
- تحديث حالة الطلب
- تسجيل audit log
- إرسال notifications
7. إرجاع status code صحيح للمزود لتأكيد الاستلام.

ملاحظات أمان مهمة:
- رفض أي webhook بدون signature صحيحة
- منع المعالجة المكررة لنفس event id
- تسجيل كل حدث لأغراض التتبع

---

## roles
الأدوار الأساسية ومسؤولياتها:
- Buyer:
  - تصفح وشراء المنتجات
  - إدارة الطلبات والعناوين والمدفوعات
- Vendor:
  - إدارة المنتجات والطلبات والمتجر
  - إعدادات التوصيل والعقود/السياسات
- Driver:
  - تنفيذ التوصيل وتتبع الحالات
  - إدارة التوفر والتفضيلات
- Admin:
  - إدارة المستخدمين والمنتجات والطلبات
  - المراجعة/التحقق/التقارير/الأمان

RBAC مطبق على:
- Frontend routing
- API endpoints
- بعض العمليات الحساسة على مستوى البيانات

---

## services
طبقة `src/services` هي قلب منطق الأعمال في الواجهة، وتشمل أمثلة رئيسية:
- auth / session services
- checkout & payment services
- order / delivery services
- inventory & product services
- notification & realtime services
- fraud / security / compliance services
- reporting / analytics services

خصائص هذه الطبقة:
1. عزل منطق الأعمال عن UI.
2. توحيد طريقة استدعاء API/Supabase.
3. تسهيل الاختبارات (unit/integration).
4. دعم إعادة الاستخدام بين الصفحات والمكونات.

---

## ملخص معماري سريع
- Presentation: React pages + components
- Application Logic: services + hooks + stores
- API Layer: Express routes + middleware
- Data/Auth/Realtime: Supabase
- Cross-cutting: validation, error handling, RBAC, logging, notifications
