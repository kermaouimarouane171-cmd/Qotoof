# تقرير مراجعة الملف الشخصي للمشتري

**التاريخ:** 2025-01-20  
**المرحلة:** تحليل UX + إصلاح أخطاء الكونسول  
**الحالة:** ✅ مكتملة

---

## 1. ملخص تنفيذي

### المشكلة الرئيسية
- ⚠️ المستخدمون يُطلب منهم إعادة إدخال رقم الهاتف والبطاقة الوطنية (CIN) بعد التسجيل
- ⚠️ البيانات المدخلة أثناء التسجيل تُفقد
- ⚠️ هذا يؤثر سلباً على تجربة المستخدم، خاصة الأميين

### السبب الجذري
1. **عدم تطابق أسماء الأعمدة:** الكود يستخدم `cin` لكن قاعدة البيانات لديها `cin_number`
2. **Trigger غير مكتمل:** `handle_new_user` لا يحفظ phone و cin_number
3. **Conflict error:** Upsert يفشل لأن الصف موجود بالفعل

### الأثر على المستخدم
- ❌ إحباط المستخدم
- ❌ فقدان الثقة في النظام
- ❌ شعور بأن البيانات سُرقت
- ❌ احتمال ترك التطبيق

### التوصية
- ✅ إصلاح عدم تطابق أسماء الأعمدة (P0)
- ✅ تحديث trigger لحفظ phone و cin_number (P0)
- ✅ إصلاح أخطاء الكونسول (P0)
- ✅ تحسين UX (P1)

---

## 2. تحليل أخطاء الكونسول

### 2.1 platform_settings (400)

**السبب الجذري:**
- RLS policy `platform_settings_admin_insert` يتطلب `auth_is_admin()` لعمليات INSERT
- الخدمة في `src/services/platformSettings.js` قد تحاول إدراج/تحديث الإعدادات بدون صلاحيات admin

**الحل:**
1. التأكد من أن عمليات platform_settings تتم بواسطة admin فقط
2. إضافة دالة service role لعمليات platform_settings
3. تقليل صرامة RLS policy للسماح للمستخدمين بإدراج إعدادات محددة

**الأولوية:** P1 (ليس حرجاً للملف الشخصي)

---

### 2.2 blocked_ips (400 - missing column)

**السبب الجذري:**
- Schema drift بين تعريفين مختلفين لجدول blocked_ips:
  - `008b-add-security-alerts-and-ip-blocking.sql`: يحتوي على `blocked_by`, `block_type`, `is_active`, `updated_at`
  - `030-unified-schema.sql` و `000-complete-fresh-setup.sql`: يحتوي على `blocked_at`, `expires_at`

**الحل:**
```sql
-- إضافة الأعمدة المفقودة
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES auth.users(id);
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS block_type TEXT DEFAULT 'manual';
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
```

**الأولوية:** P1 (ليس حرجاً للملف الشخصي)

---

### 2.3 profiles (409 - Conflict)

**السبب الجذري:**
1. Trigger `handle_new_user` يُدرج فقط: `id, email, first_name, last_name, role` - لا يشمل `phone` أو `cin`
2. دالة `signUp` في `authActionsService.js` تحاول upsert مع `phone` و `cin`
3. **عدم تطابق حرج في أسماء الأعمدة:** عمود قاعدة البيانات هو `cin_number` لكن الكود يستخدم `cin`

**الحل:**
1. تحديث trigger `handle_new_user` ليشمل phone و cin_number
2. تحديث جميع مراجع الكود من `cin` إلى `cin_number`:
   - `src/services/authActionsService.js` line 360
   - `src/pages/Profile.jsx` lines 30, 47, 110
   - `src/pages/auth/Register.jsx` line 291
   - تحديث TypeScript types في `src/types/database.ts`

**الأولوية:** P0 (حرج جداً - السبب الرئيسي للمشكلة)

---

### 2.4 loyalty_transactions (400)

**السبب الجذري:**
- RLS policy `loyalty_transactions_system_insert` يستخدم `WITH CHECK (true)` لكن service role قد لا يكون مُعد بشكل صحيح
- الخدمة لديها منطق fallback للعمود `reason` المفقود

**الحل:**
```sql
CREATE POLICY "loyalty_transactions_user_insert" ON loyalty_transactions 
FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid());
```

**الأولوية:** P1 (ليس حرجاً للملف الشخصي)

---

## 3. تحليل الملف الشخصي

### 3.1 كيف يتم جلب البيانات؟

**الموقع:** `src/pages/Profile.jsx` lines 28-34

**الطريقة:**
- البيانات تُجلب من `useAuthStore` الذي يملأ profile أثناء المصادقة
- المشكلة: Profile data يستخدم `profile?.cin` لكن عمود قاعدة البيانات هو `cin_number`

**الكود:**
```javascript
const [formData, setFormData] = useState({
  firstName: profile?.first_name || '', lastName: profile?.last_name || '',
  email: profile?.email || '', phone: profile?.phone || '', cin: profile?.cin || '',
  // ...
})
```

---

### 3.2 كيف يتم عرض البيانات؟

**الموقع:** `src/pages/Profile.jsx` lines 188-203

**حقل الهاتف:** Line 188 - يعرض حقل إدخال الهاتف

**حقل CIN:** Lines 194-202 - يعرض CIN إذا موجود، وإلا يعرض مكون CINInput

**المشكلة:** يستخدم `profile?.cin` (lines 194, 197) الذي لا يطابق عمود قاعدة البيانات `cin_number`

---

### 3.3 ما هو منطق التحقق؟

**الموقع:** `src/pages/Profile.jsx` lines 106-107

**التحقق من CIN:**
- يتحقق من CIN عند التغيير باستخدام دالة `validateCIN`
- المشكلة: التحقق يعمل لكن يحفظ في اسم عمود خاطئ

---

## 4. تحليل التسجيل

### 4.1 هل يتم حفظ الهاتف؟

**الموقع:** `src/pages/auth/Register.jsx` line 290

**البيانات المرسلة:**
```javascript
phone: formData.phone
```

**الخدمة:** `src/services/authActionsService.js` line 359
```javascript
phone: userData.phone || null
```

**Database trigger:** `handle_new_user` لا يحفظ phone (lines 1463-1470 in 030-unified-schema.sql)

**المشكلة:** الهاتف يُرسل لكن لا يُحفظ بواسطة trigger، يعتمد على upsert يدوي قد يفشل بسبب conflict

---

### 4.2 هل يتم حفظ البطاقة الوطنية؟

**الموقع:** `src/pages/auth/Register.jsx` line 291

**البيانات المرسلة:**
```javascript
cin: cleanedCin
```

**الخدمة:** `src/services/authActionsService.js` line 360
```javascript
cin: userData.cin || null
```

**Database trigger:** `handle_new_user` لا يحفظ cin

**عدم تطابق:** الكود يستخدم `cin` لكن قاعدة البيانات لديها `cin_number`

**المشكلة:** CIN يُرسل لاسم عمود خاطئ، trigger لا يحفظه

---

### 4.3 أين تُحفظ البيانات؟

**المشكلة:** البيانات لا تُحفظ بشكل صحيح بسبب:
1. Trigger غير مكتمل
2. عدم تطابق أسماء الأعمدة
3. Conflict error في upsert

---

## 5. تحليل قاعدة البيانات

### 5.1 تعريف جدول profiles

**الموقع:** `database/migrations/030-unified-schema.sql` lines 73-106

**عمود الهاتف:** Line 78 - `phone TEXT` (موجود)

**عمود CIN:** Line 101 - `cin_number TEXT` (ليس `cin`)

**أعمدة التحقق:** `cin_verified BOOLEAN DEFAULT FALSE` (line 102)

**المشكلة:** عدم تطابق اسم العمود بين schema (`cin_number`) والكود (`cin`)

---

### 5.2 RLS policies

**الموقع:** `database/migrations/031-unified-rls-policies.sql` lines 124-127

**profiles_public_select:** `USING (true)` - مسموح جداً (line 124)

**profiles_self_update:** `USING (auth.uid() = id)` (line 125)

**profiles_self_insert:** `WITH CHECK (auth.uid() = id)` (line 126)

**المشكلة:** Migration 038 يحذف `profiles_public_select` للأمان، لكن 031 يعيد إنشاؤه

---

## 6. تحليل تجربة المستخدم

### 6.1 التدفق الحالي

1. المستخدم يسجل → يدخل الهاتف و CIN في Register.jsx
2. البيانات تُرسل لدالة signUp مع phone و cin
3. Supabase auth يُنشئ المستخدم
4. Trigger `handle_new_user` يُنشئ صف profile مع فقط: id, email, first_name, last_name, role
5. Upsert اليدوي يحاول إضافة phone و cin لكن يفشل بسبب:
   - Conflict (الصف موجود بالفعل)
   - عدم تطابق أسماء الأعمدة (cin vs cin_number)
6. المستخدم يُعيد توجيه لصفحة الملف الشخصي
7. صفحة الملف الشخصي تُظهر حقول الهاتف و CIN فارغة
8. المستخدم يجب إعادة إدخال البيانات

---

### 6.2 المشكلة

**السبب الجذري:**
- Trigger `handle_new_user` يُنشئ صف profile غير مكتمل بدون phone و CIN
- Upsert اليدوي يفشل بسبب عدم تطابق أسماء الأعمدة و conflict
- عدم اتساق أسماء الأعمدة: الكود يستخدم `cin` في كل مكان لكن قاعدة البيانات لديها `cin_number`
- Trigger لا يقرأ phone/cin من user_metadata

---

### 6.3 الأثر على المستخدم

**تجربة المستخدم:**
- ❌ يجب إعادة إدخال الهاتف و CIN بعد التسجيل
- ❌ فقدان البيانات المدخلة أثناء التسجيل
- ❌ شعور بالإحباط
- ❌ فقدان الثقة في النظام

**السيناريوهات:**
- **المستخدم العادي:** يشعر بالإحباط، قد يترك التطبيق
- **المستخدم الأمي:** يعتقد أن بياناته سُرقت، قد يشكو
- **المستخدم الجديد:** يفقد الثقة في التطبيق

---

## 7. التوصيات

### 7.1 إصلاحات فورية (P0)

#### 1. إصلاح عدم تطابق أسماء الأعمدة (حرج جداً)

**الخيار A: إضافة cin كعمود مولد**
```sql
ALTER TABLE profiles ADD COLUMN cin TEXT GENERATED ALWAYS AS (cin_number) STORED;
```

**الخيار B: إعادة تسمية العمود (أبسط لكن يتطلب تغييرات أكثر في الكود)**
```sql
ALTER TABLE profiles RENAME COLUMN cin_number TO cin;
```

**الخطوات:**
1. تشغيل migration لإضافة/إعادة تسمية العمود
2. تحديث جميع مراجع الكود من `cin` إلى `cin_number` إذا اخترت الخيار B
3. تحديث TypeScript types في `src/types/database.ts`

---

#### 2. إصلاح trigger handle_new_user

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role, phone, cin_number)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')::user_role,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'cin'
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = EXCLUDED.phone,
    cin_number = EXCLUDED.cin_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

#### 3. إصلاح schema drift لـ blocked_ips

- اختيار schema واحد قياسي وتشغيل migration للآخر
- التوصية: استخدام إصدار 008b مع أعمدة أكثر
- تشغيل migration لإضافة الأعمدة المفقودة

---

#### 4. إصلاح RLS لـ loyalty_transactions

```sql
CREATE POLICY "loyalty_transactions_user_insert" ON loyalty_transactions 
FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid());
```

---

### 7.2 تحسينات UX (P1)

#### 1. إضافة مؤشر حفظ البيانات
- عرض "جاري حفظ رقم الهاتف..." أثناء التسجيل
- عرض "تم حفظ رقم الهاتف" تأكيد
- عرض أي أخطاء حفظ بوضوح للمستخدم

#### 2. إضافة فحص اكتمال الملف الشخصي
- بعد التسجيل، فحص إذا phone و CIN محفوظة
- إذا مفقودة، عرض بانر: "أكمل ملفك الشخصي - أضف الهاتف و CIN"
- ربط مباشر لصفحة الملف الشخصي مع بيانات مملوءة مسبقاً

#### 3. تحسين معالجة الأخطاء
- تسجيل فشل حفظ profile أثناء التسجيل
- إعادة محاولة تحديثات profile الفاشلة تلقائياً
- إعلام المستخدم إذا البيانات الحرجة لم تُحفظ

#### 4. إضافة ملاحظات التحقق من البيانات
- عرض التحقق في الوقت الفعلي أثناء التسجيل
- تمييز الحقول المطلوبة بوضوح
- شرح سبب الحاجة للهاتف و CIN

#### 5. إصلاح أخطاء الكونسول
- إضافة error boundaries مناسبة لاستعلامات platform_settings
- معالجة drift schema لـ blocked_ips برفق
- إضافة fallback لفشل loyalty_transactions

---

### 7.3 تحسينات طويلة المدى (P2)

#### 1. إضافة progress indicator
- عرض شريط تقدم أثناء التسجيل
- عرض حالة كل خطوة

#### 2. إضافة tooltips توضيحية
- شرح سبب الحاجة لكل حقل
- إضافة مساعدة للأميين

#### 3. إضافة دعم متعدد اللغات
- ترجمة جميع الرسائل
- دعم RTL بشكل كامل

#### 4. إضافة وضع accessibility
- دعم قارئات الشاشة
- دعم لوحة المفاتيح
- تباين ألوان عالي

---

## 8. الخلاصة

### الحالة الحالية
- ❌ المستخدمون يُطلب منهم إعادة إدخال الهاتف و CIN
- ❌ البيانات المدخلة أثناء التسجيل تُفقد
- ❌ أخطاء كونسول متعددة
- ❌ تجربة مستخدم سيئة

### الإصلاحات المطلوبة
- ✅ إصلاح عدم تطابق أسماء الأعمدة (P0)
- ✅ تحديث trigger لحفظ phone و cin_number (P0)
- ✅ إصلاح أخطاء الكونسول (P0)
- ✅ تحسين UX (P1)

### الأولوية
1. **P0:** إصلاح عدم تطابق أسماء الأعمدة وتحديث trigger
2. **P0:** إصلاح أخطاء الكونسول
3. **P1:** تحسين UX
4. **P2:** تحسينات طويلة المدى

### التأثير المتوقع
- ✅ حفظ البيانات أثناء التسجيل
- ✅ عرض البيانات في الملف الشخصي
- ✅ تحسين تجربة المستخدم
- ✅ زيادة الثقة في النظام

---

**التقرير المُعد بواسطة:** Devin AI  
**التاريخ:** 2025-01-20  
**المراجعة:** شاملة
