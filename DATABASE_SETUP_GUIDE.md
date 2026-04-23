# 🗄️ دليل إعداد قاعدة البيانات (Database Setup Guide)

## المرحلة 1: Database Setup (URGENT)

> ⚠️ **هذه الخطوة حرجة جداً - بدونها لن يعمل التطبيق نهائياً**

---

## الخطوة 1: التحقق من Supabase Configuration

### 1.1 التحقق من بيانات اعتماد Supabase

```bash
# الملف: .env
# تحقق من أن القيم التالية موجودة:

✓ VITE_SUPABASE_URL=https://your-project.supabase.co
✓ VITE_SUPABASE_ANON_KEY=eyJhbGc...
✓ SUPABASE_URL=https://your-project.supabase.co
✓ SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 1.2 اختبار الاتصال بـ Supabase

```javascript
// في console أو في script
import { supabase } from '@/services/supabase';

const test = async () => {
  const { data, error } = await supabase.auth.getUser();
  console.log('Supabase Status:', error ? '❌ Failed' : '✅ Connected');
};
```

✅ **النتيجة المتوقعة:** لا يوجد خطأ أو User object

---

## الخطوة 2: تطبيق Database Migrations

### 2.1 ترتيب تطبيق الـ Migrations (CRITICAL ORDER)

**اتبع هذا الترتيب بالضبط:**

```bash
# الترتيب الصحيح من الأول إلى الأخير:

1️⃣  supabase/migrations/001_add_cin_to_profiles.sql
2️⃣  supabase/migrations/002_add_driver_assignment.sql
3️⃣  supabase/migrations/003_add_vendor_compliance.sql
4️⃣  supabase/migrations/004_add_commission_tracking.sql
5️⃣  supabase/migrations/20260414000001_add_awaiting_driver_status.sql
6️⃣  supabase/migrations/20260414000002_add_order_statuses.sql
7️⃣  supabase/migrations/20260414000003_geographic_delivery_system.sql
8️⃣  supabase/migrations/20260414000004_create_order_status_indexes.sql
9️⃣  supabase/migrations/20260414000005_fix_profiles_rls.sql
🔟 supabase/migrations/20260414000006_mfa_and_sessions.sql
1️⃣1️⃣ supabase/migrations/20260414000007_fix_mfa_sessions.sql
1️⃣2️⃣ supabase/migrations/20260414000008_fix_audit_logs.sql
1️⃣3️⃣ supabase/migrations/20260414000009_fix_auth_remaining.sql
1️⃣4️⃣ supabase/migrations/20260414000010_fix_active_sessions.sql
1️⃣5️⃣ supabase/migrations/20260414000011_verify_otp_codes.sql
```

### 2.2 كيفية تطبيق الـ Migrations يدويـاً

**الطريقة 1: عبر Supabase Dashboard (الأسهل)**

```bash
1. اذهب إلى: https://app.supabase.com/project/_/sql
2. انقر: "New Query"
3. نسخ محتوى الملف الأول (001_add_cin_to_profiles.sql)
4. الصق الكود في المحرر
5. انقر: "Run"
6. تحقق من الرسالة: "✅ SUCCESS" أو "⚠️ ERROR"
7. كرر مع جميع الملفات بالترتيب أعلاه
```

**الطريقة 2: استخدام Supabase CLI (الأفضل)**

```bash
# تثبيت Supabase CLI
npm install -g supabase

# تسجيل الدخول
supabase login

# ربط المشروع
supabase link --project-ref your-project-ref

# تطبيق جميع الـ migrations
supabase db pull  # يسحب الـ schema الحالي
supabase migration list  # يعرض قائمة الـ migrations
supabase db push  # يطبق جميع الـ migrations
```

### 2.3 اختبار كل Migration

بعد تطبيق كل migration:

```sql
-- تحقق من أن كل شيء موجود
SELECT * FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- تحقق من RLS
SELECT schemaname, tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**النتيجة المتوقعة:**
- ✅ 20+ جدول قاعدة بيانات
- ✅ RLS مفعّل على معظم الجداول
- ✅ لا توجد أخطاء

---

## الخطوة 3: تفعيل RLS Policies (CRITICAL)

### 3.1 المشكلة المعروفة

```
⚠️ ملاحظة حرجة:
بعض الـ migrations تعاني من "infinite recursion" في RLS policies
هذا يسبب فشل الـ SELECT queries
```

### 3.2 الحل: تطبيق RLS Policies الآمنة

**انقر نسخ الكود التالي وطبقه في SQL Editor:**

```sql
-- ============================================
-- FIX RLS POLICIES (Safe Version)
-- ============================================

-- 1. Drop problematic policies
DROP POLICY IF EXISTS "Users can view own CIN" ON profiles;
DROP POLICY IF EXISTS "Users can update own CIN" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;

-- 2. Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Safe RLS Policies for profiles
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_admin"
  ON profiles FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- 4. Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'profiles';

-- Expected: rowsecurity = true ✅
```

### 3.3 إصلاح RLS على جداول أخرى

```sql
-- ============================================
-- Enable RLS on all tables
-- ============================================

-- Orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_own"
  ON orders FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid() OR 
    vendor_id = (SELECT id FROM profiles WHERE id = auth.uid() AND role = 'vendor') OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_public"
  ON products FOR SELECT
  TO authenticated
  USING (status = 'published' OR vendor_id = auth.uid());

-- Deliveries table
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deliveries_select_own"
  ON deliveries FOR SELECT
  TO authenticated
  USING (
    driver_id = auth.uid() OR
    order_id IN (SELECT id FROM orders WHERE buyer_id = auth.uid() OR vendor_id = auth.uid())
  );
```

---

## الخطوة 4: التحقق من قاعدة البيانات

### 4.1 Verify All Tables

```sql
-- LIST جميع الجداول
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

**النتائج المتوقعة (20+ جدول):**
```
profiles
orders
products
deliveries
drivers
vendors
admin_settings
audit_logs
otp_codes
sessions
...
```

### 4.2 Verify RLS Status

```sql
-- التحقق من أن RLS مفعّل
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true
ORDER BY tablename;
```

**النتيجة المتوقعة:**
```
tablename          | rowsecurity
-------------------|------------
profiles           | true
orders             | true
products           | true
deliveries         | true
drivers            | true
...
```

---

## الخطوة 5: Setup Edge Functions

### 5.1 Deploy Edge Functions

Edge Functions مطلوبة لـ:
- 📧 إرسال الإيميلات
- 💳 معالجة الدفع
- 📝 Create Payment Intents

**اتبع الخطوات:**

```bash
# 1. تسجيل دخول Supabase CLI
supabase login

# 2. الذهاب لمجلد البروجيكت
cd greenmarket

# 3. إنشاء edge function جديد
supabase functions new send-email

# 4. نسخ الكود من: supabase/functions/send-email/index.ts
# 5. طبق الدالة
supabase functions deploy

# 6. كرر مع الدوال الأخرى:
#    - create-payment-intent
#    - refund-payment
```

---

## الخطوة 6: Setup Storage Buckets

### 6.1 Create Storage Buckets

**عبر Supabase Dashboard:**

```bash
1. اذهب إلى: Storage > Buckets
2. اضغط: "New Bucket"
3. أنشئ البكتات التالية:

📦 Bucket Name: product-images
   - Public: ✅ true
   - File size: 5 MB

📦 Bucket Name: vendor-documents
   - Public: ❌ false
   - File size: 10 MB

📦 Bucket Name: delivery-proofs
   - Public: ❌ false
   - File size: 5 MB

📦 Bucket Name: user-avatars
   - Public: ✅ true
   - File size: 2 MB
```

### 6.2 Setup RLS for Storage

```sql
-- Add storage RLS policies
-- (يتم تطبيقها تلقائياً من خلال Dashboard)

-- product-images: everyone can read, vendors can upload
-- vendor-documents: only owners can access
-- delivery-proofs: only drivers can upload
-- user-avatars: everyone can read, users can upload own avatar
```

---

## الخطوة 7: Seed Initial Data

### 7.1 Create Admin User

```sql
-- Create test admin account
-- (في Supabase Auth: Add user manually من Dashboard)

Email: admin@qotoof.com
Password: AdminPassword123!
Role: admin
```

### 7.2 Seed Database with Test Data

```bash
# إذا كان هناك ملف seed
cd greenmarket
psql -h your-host -U postgres -d postgres -f database/seed.sql

# أو عبر Supabase Dashboard SQL Editor
# انسخ محتوى: database/seed.sql
# والصقه في SQL Editor
```

---

## الخطوة 8: اختبار الاتصال من التطبيق

### 8.1 Integration Test

```javascript
// src/services/supabase.test.js
import { supabase } from './supabase';

describe('Database Connection', () => {
  test('should connect to Supabase', async () => {
    const { error } = await supabase.auth.getUser();
    expect(error).toBeNull();
  });

  test('should read from profiles table', async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    expect(error).toBeNull();
  });

  test('should test RLS policies', async () => {
    // يجب أن يفشل الاستعلام بدون authentication
    // يجب أن ينجح مع role صحيح
  });
});
```

### 8.2 Run Test

```bash
npm test -- src/services/supabase.test.js
```

---

## 🔍 Troubleshooting Database Issues

### المشكلة: "RLS policy with recursive reference"

**الحل:**
```sql
-- Drop problematic policy
DROP POLICY IF EXISTS "Users can view own CIN" ON profiles;

-- Create simplified policy instead
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR role = 'admin');
```

### المشكلة: "Table doesn't exist"

**الحل:**
```bash
1. تأكد من تطبيق جميع migrations بالترتيب
2. تحقق: SELECT * FROM pg_tables WHERE schemaname = 'public';
3. إذا كان الجدول مفقود، طبق الـ migration المناسب
```

### المشكلة: "Permission denied"

**الحل:**
```sql
-- تحقق من أنك تستخدم service_role_key للـ admin operations
-- استخدم anon_key لـ user operations فقط
```

---

## ✅ Verification Checklist

- [ ] Supabase مرتبط بـ .env
- [ ] جميع الـ migrations طُبقت بنجاح
- [ ] RLS policies مفعّلة على core tables
- [ ] Edge Functions مُنشرة
- [ ] Storage buckets موجودة
- [ ] اختبار الاتصال نجح
- [ ] البيانات الأولية (Seed) مُحملة
- [ ] Audit logs يسجل الأنشطة

---

## 📊 Database Statistics

```
الجداول الرئيسية:
├── profiles (Users + Roles)
├── orders (Order Management)
├── products (Catalog)
├── deliveries (Tracking)
├── drivers (Driver Info)
├── vendors (Vendor Info)
├── payments (Payment History)
├── audit_logs (Security)
├── sessions (Active Sessions)
├── otp_codes (MFA)
└── ... + 10 more tables

الـ Indexes: 50+
الـ Triggers: 20+
الـ Functions: 30+
الـ RLS Policies: 40+
```

---

## 🚀 الخطوة التالية

بعد إعداد قاعدة البيانات بنجاح:

✅ **المرحلة 2: Component Implementation**
- نستبدل الـ placeholder بمكونات حقيقية
- نضيف المنطق التجاري

---

## 📞 في حالة المشاكل

اطلب مساعدة في:
1. Error Message بالضبط
2. Migration file name
3. SQL query أن كانت مرتبطة

مثال:
```
❌ Error:
"relation "profiles" does not exist"

📝 Details:
Migration: 001_add_cin_to_profiles.sql
Query: SELECT * FROM profiles
```

---

✅ **عند انتهاء Database Setup:**

سننتقل إلى المرحلة 2 - تطبيق المكونات الحقيقية!
