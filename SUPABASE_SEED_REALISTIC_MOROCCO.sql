-- ===============================================================
-- Qotoof Marketplace - Realistic Morocco Seed Data
-- Purpose: Create realistic vendors, drivers, and 19 products for demo/QA
-- Run after SUPABASE_LOCATION_MIGRATION.sql in Supabase SQL Editor
-- ===============================================================

BEGIN;

-- Ensure optional profile columns used by this seed exist.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS service_regions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS center_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS center_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS vehicle_make TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_year INTEGER,
  ADD COLUMN IF NOT EXISTS store_address TEXT;

-- Ensure products table has a primary image URL field used by some app pages.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ---------------------------------------------------------------
-- A) 12 Moroccan vendors (auth + profiles)
-- ---------------------------------------------------------------

WITH vendor_auth AS (
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nour.farms.casa@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"vendor","first_name":"نور","last_name":"العمري"}', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atlas.verdure@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"vendor","first_name":"سفيان","last_name":"بنجلون"}', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rabat.fruits.pro@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"vendor","first_name":"مريم","last_name":"العلوي"}', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'green.ribat.market@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"vendor","first_name":"هشام","last_name":"المريني"}', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fes.olive.house@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"vendor","first_name":"سعاد","last_name":"الإدريسي"}', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'medina.herbs.fes@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"vendor","first_name":"ياسين","last_name":"العلمي"}', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marrakech.garden@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"vendor","first_name":"خديجة","last_name":"الصفريوي"}', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'atlas.fresh.marrakech@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"vendor","first_name":"عمر","last_name":"أمهروق"}', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tanger.sea.breeze.farm@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"vendor","first_name":"فاطمة","last_name":"الكتاني"}', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'detroit.tanger.produce@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"vendor","first_name":"أنس","last_name":"الطاهري"}', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'casa.bulk.veg@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"vendor","first_name":"ليلى","last_name":"الزهراء"}', NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rabat.natural.seed@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"vendor","first_name":"حمزة","last_name":"المنصوري"}', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
INSERT INTO profiles (
  id,
  email,
  first_name,
  last_name,
  phone,
  role,
  store_name,
  city,
  address,
  store_address,
  latitude,
  longitude,
  verification_status,
  is_active,
  is_verified,
  created_at,
  updated_at
)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'nour.farms.casa@qotoof.ma', 'نور', 'العمري', '+212661120001', 'vendor', 'ضيعات نور الخضر', 'الدار البيضاء', 'شارع عبد المؤمن 120، المعاريف، الدار البيضاء', 'شارع عبد المؤمن 120، المعاريف، الدار البيضاء', 33.5731, -7.5898, 'verified', true, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000002', 'atlas.verdure@qotoof.ma', 'سفيان', 'بنجلون', '+212661120002', 'vendor', 'أطلس فيرت للخضر', 'الدار البيضاء', 'زنقة الزرقطوني 45، الدار البيضاء', 'زنقة الزرقطوني 45، الدار البيضاء', 33.5892, -7.6039, 'verified', true, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000003', 'rabat.fruits.pro@qotoof.ma', 'مريم', 'العلوي', '+212661120003', 'vendor', 'فواكه الرباط برو', 'الرباط', 'شارع محمد الخامس 88، الرباط', 'شارع محمد الخامس 88، الرباط', 34.0209, -6.8416, 'verified', true, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000004', 'green.ribat.market@qotoof.ma', 'هشام', 'المريني', '+212661120004', 'vendor', 'سوق الريباط الأخضر', 'الرباط', 'حي أكدال، شارع فال ولد عمير 34، الرباط', 'حي أكدال، شارع فال ولد عمير 34، الرباط', 34.0048, -6.8529, 'verified', true, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000005', 'fes.olive.house@qotoof.ma', 'سعاد', 'الإدريسي', '+212661120005', 'vendor', 'دار الزيتون فاس', 'فاس', 'حي الأطلس، شارع محمد السادس 17، فاس', 'حي الأطلس، شارع محمد السادس 17، فاس', 34.0331, -5.0003, 'verified', true, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000006', 'medina.herbs.fes@qotoof.ma', 'ياسين', 'العلمي', '+212661120006', 'vendor', 'أعشاب المدينة فاس', 'فاس', 'باب بوجلود، زنقة الطالعة الكبرى 12، فاس', 'باب بوجلود، زنقة الطالعة الكبرى 12، فاس', 34.0582, -4.9787, 'verified', true, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000007', 'marrakech.garden@qotoof.ma', 'خديجة', 'الصفريوي', '+212661120007', 'vendor', 'حديقة مراكش الطازجة', 'مراكش', 'حي جيليز، شارع محمد الخامس 61، مراكش', 'حي جيليز، شارع محمد الخامس 61، مراكش', 31.6295, -7.9811, 'verified', true, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000008', 'atlas.fresh.marrakech@qotoof.ma', 'عمر', 'أمهروق', '+212661120008', 'vendor', 'أطلس فريش مراكش', 'مراكش', 'شارع الحسن الثاني 22، مراكش', 'شارع الحسن الثاني 22، مراكش', 31.6400, -8.0089, 'verified', true, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000009', 'tanger.sea.breeze.farm@qotoof.ma', 'فاطمة', 'الكتاني', '+212661120009', 'vendor', 'مزارع نسيم طنجة', 'طنجة', 'شارع مولاي يوسف 14، طنجة', 'شارع مولاي يوسف 14، طنجة', 35.7595, -5.8340, 'verified', true, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000010', 'detroit.tanger.produce@qotoof.ma', 'أنس', 'الطاهري', '+212661120010', 'vendor', 'خيرات طنجة ديترويت', 'طنجة', 'حي مالاباطا، شارع طارق بن زياد 9، طنجة', 'حي مالاباطا، شارع طارق بن زياد 9، طنجة', 35.7767, -5.8039, 'verified', true, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000011', 'casa.bulk.veg@qotoof.ma', 'ليلى', 'الزهراء', '+212661120011', 'vendor', 'الجملة للخضر كازا', 'الدار البيضاء', 'سوق الجملة للخضر والفواكه، سيدي عثمان، الدار البيضاء', 'سوق الجملة للخضر والفواكه، سيدي عثمان، الدار البيضاء', 33.5553, -7.5980, 'verified', true, true, NOW(), NOW()),
  ('10000000-0000-0000-0000-000000000012', 'rabat.natural.seed@qotoof.ma', 'حمزة', 'المنصوري', '+212661120012', 'vendor', 'بذور الرباط الطبيعية', 'الرباط', 'حي الرياض، زنقة النخيل 5، الرباط', 'حي الرياض، زنقة النخيل 5، الرباط', 33.9655, -6.8538, 'verified', true, true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET
  phone = EXCLUDED.phone,
  role = EXCLUDED.role,
  store_name = EXCLUDED.store_name,
  city = EXCLUDED.city,
  address = EXCLUDED.address,
  store_address = EXCLUDED.store_address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  verification_status = EXCLUDED.verification_status,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ---------------------------------------------------------------
-- B) 10 Moroccan drivers (auth + profiles + live locations)
-- ---------------------------------------------------------------

WITH driver_auth AS (
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'driver.mohamed.1@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"driver","first_name":"محمد","last_name":"العماري"}', NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'driver.ayoub.2@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"driver","first_name":"أيوب","last_name":"الراشدي"}', NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'driver.youssef.3@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"driver","first_name":"يوسف","last_name":"التميمي"}', NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'driver.hamza.4@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"driver","first_name":"حمزة","last_name":"العسري"}', NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'driver.mustapha.5@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"driver","first_name":"مصطفى","last_name":"الزياتي"}', NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'driver.saad.6@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"driver","first_name":"سعد","last_name":"القدوري"}', NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'driver.amine.7@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"driver","first_name":"أمين","last_name":"المنير"}', NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'driver.riad.8@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"driver","first_name":"رياض","last_name":"الفاسي"}', NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'driver.nabil.9@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"driver","first_name":"نبيل","last_name":"الحسني"}', NOW(), NOW()),
    ('20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'driver.rachid.10@qotoof.ma', crypt('Qotoof#2026', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"role":"driver","first_name":"رشيد","last_name":"الوردي"}', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING
  RETURNING id
)
INSERT INTO profiles (
  id,
  email,
  first_name,
  last_name,
  phone,
  role,
  city,
  address,
  vehicle_type,
  vehicle_plate,
  vehicle_make,
  vehicle_year,
  service_regions,
  center_lat,
  center_lng,
  latitude,
  longitude,
  verification_status,
  is_active,
  is_available_for_delivery,
  is_verified,
  created_at,
  updated_at
)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'driver.mohamed.1@qotoof.ma', 'محمد', 'العماري', '+212662330001', 'driver', 'الدار البيضاء', 'شارع النخيل 10، عين السبع، الدار البيضاء', 'motorcycle', '12-3489-06', 'Yamaha NMAX', 2022, ARRAY['casa'], 33.5731, -7.5898, 33.5731, -7.5898, 'verified', true, true, true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000002', 'driver.ayoub.2@qotoof.ma', 'أيوب', 'الراشدي', '+212662330002', 'driver', 'الدار البيضاء', 'شارع الأطلس 7، سيدي البرنوصي، الدار البيضاء', 'motorcycle', '34-7751-06', 'Honda SH125', 2021, ARRAY['casa'], 33.5890, -7.5600, 33.5890, -7.5600, 'verified', true, true, true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000003', 'driver.youssef.3@qotoof.ma', 'يوسف', 'التميمي', '+212662330003', 'driver', 'الدار البيضاء', 'شارع الزهور 32، الحي المحمدي، الدار البيضاء', 'motorcycle', '22-6193-06', 'Piaggio Liberty', 2023, ARRAY['casa'], 33.6004, -7.5216, 33.6004, -7.5216, 'verified', true, true, true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000004', 'driver.hamza.4@qotoof.ma', 'حمزة', 'العسري', '+212662330004', 'driver', 'الرباط', 'شارع علال بن عبد الله 18، الرباط', 'motorcycle', '15-2407-07', 'Suzuki Burgman', 2020, ARRAY['rabat'], 34.0209, -6.8416, 34.0209, -6.8416, 'verified', true, true, true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000005', 'driver.mustapha.5@qotoof.ma', 'مصطفى', 'الزياتي', '+212662330005', 'driver', 'الرباط', 'شارع المغرب العربي 11، أكدال، الرباط', 'motorcycle', '61-8820-07', 'SYM Jet X', 2022, ARRAY['rabat'], 34.0070, -6.8469, 34.0070, -6.8469, 'verified', true, true, true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000006', 'driver.saad.6@qotoof.ma', 'سعد', 'القدوري', '+212662330006', 'driver', 'فاس', 'شارع الجيش الملكي 52، فاس', 'van', '73-4912-03', 'Renault Kangoo', 2021, ARRAY['fes'], 34.0331, -5.0003, 34.0331, -5.0003, 'verified', true, true, true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000007', 'driver.amine.7@qotoof.ma', 'أمين', 'المنير', '+212662330007', 'driver', 'فاس', 'حي النرجس، شارع الحسن الثاني 40، فاس', 'van', '29-6408-03', 'Peugeot Partner', 2022, ARRAY['fes'], 34.0521, -4.9833, 34.0521, -4.9833, 'verified', true, true, true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000008', 'driver.riad.8@qotoof.ma', 'رياض', 'الفاسي', '+212662330008', 'driver', 'مراكش', 'حي جيليز، زنقة الحرية 20، مراكش', 'van', '88-5321-08', 'Citroen Berlingo', 2020, ARRAY['marrakech'], 31.6295, -7.9811, 31.6295, -7.9811, 'verified', true, true, true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000009', 'driver.nabil.9@qotoof.ma', 'نبيل', 'الحسني', '+212662330009', 'driver', 'الدار البيضاء', 'شارع الحسن الثاني 77، الدار البيضاء', 'truck', '40-9024-06', 'Isuzu N-Series', 2019, ARRAY['casa'], 33.5722, -7.6578, 33.5722, -7.6578, 'verified', true, true, true, NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000010', 'driver.rachid.10@qotoof.ma', 'رشيد', 'الوردي', '+212662330010', 'driver', 'مراكش', 'شارع الأطلس الكبير 14، مراكش', 'truck', '55-7730-08', 'Mitsubishi Fuso', 2018, ARRAY['marrakech'], 31.6340, -8.0030, 31.6340, -8.0030, 'verified', true, true, true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET
  phone = EXCLUDED.phone,
  city = EXCLUDED.city,
  address = EXCLUDED.address,
  vehicle_type = EXCLUDED.vehicle_type,
  vehicle_plate = EXCLUDED.vehicle_plate,
  vehicle_make = EXCLUDED.vehicle_make,
  vehicle_year = EXCLUDED.vehicle_year,
  service_regions = EXCLUDED.service_regions,
  center_lat = EXCLUDED.center_lat,
  center_lng = EXCLUDED.center_lng,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  verification_status = EXCLUDED.verification_status,
  is_active = EXCLUDED.is_active,
  is_available_for_delivery = EXCLUDED.is_available_for_delivery,
  updated_at = NOW();

-- Seed online driver locations based on center coordinates.
INSERT INTO driver_locations (
  driver_id,
  latitude,
  longitude,
  is_online,
  is_available,
  city,
  region_id,
  service_radius_km,
  last_active_at,
  last_updated,
  updated_at
)
VALUES
  ('20000000-0000-0000-0000-000000000001', 33.5731, -7.5898, true, true, 'الدار البيضاء', 'casa', 25, NOW(), NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000002', 33.5890, -7.5600, true, true, 'الدار البيضاء', 'casa', 20, NOW(), NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000003', 33.6004, -7.5216, true, true, 'الدار البيضاء', 'casa', 20, NOW(), NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000004', 34.0209, -6.8416, true, true, 'الرباط', 'rabat', 25, NOW(), NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000005', 34.0070, -6.8469, true, true, 'الرباط', 'rabat', 20, NOW(), NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000006', 34.0331, -5.0003, true, true, 'فاس', 'fes', 25, NOW(), NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000007', 34.0521, -4.9833, true, true, 'فاس', 'fes', 20, NOW(), NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000008', 31.6295, -7.9811, true, true, 'مراكش', 'marrakech', 25, NOW(), NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000009', 33.5722, -7.6578, true, true, 'الدار البيضاء', 'casa', 35, NOW(), NOW(), NOW()),
  ('20000000-0000-0000-0000-000000000010', 31.6340, -8.0030, true, true, 'مراكش', 'marrakech', 35, NOW(), NOW(), NOW())
ON CONFLICT (driver_id) DO UPDATE
SET
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  is_online = EXCLUDED.is_online,
  is_available = EXCLUDED.is_available,
  city = EXCLUDED.city,
  region_id = EXCLUDED.region_id,
  service_radius_km = EXCLUDED.service_radius_km,
  last_active_at = NOW(),
  last_updated = NOW(),
  updated_at = NOW();

-- ---------------------------------------------------------------
-- C) 19 updated products with AR + FR descriptions and placeholders
-- ---------------------------------------------------------------

INSERT INTO products (
  id,
  vendor_id,
  name,
  description,
  category,
  subcategory,
  price_per_unit,
  unit_type,
  min_order_quantity,
  available_quantity,
  is_available,
  approval_status,
  latitude,
  longitude,
  image_url,
  created_at,
  updated_at
)
VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'طماطم ممتازة', 'AR: طماطم حمراء طازجة من ضيعات الدار البيضاء، مناسبة للمطاعم والجملة. | FR: Tomates rouges fraiches de Casablanca, ideales pour la restauration et la vente en gros.', 'vegetables', 'Tomatoes', 8.50, 'kg', 20, 1500, true, 'approved', 33.5731, -7.5898, 'https://placehold.co/800x600?text=Tomates+Premium', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000011', 'بطاطس بيضاء', 'AR: بطاطس بيضاء مختارة بعناية، حجم موحد وجودة عالية. | FR: Pommes de terre blanches calibrees, qualite premium pour grossistes.', 'vegetables', 'Potatoes', 5.20, 'kg', 30, 2200, true, 'approved', 33.5553, -7.5980, 'https://placehold.co/800x600?text=Pommes+de+Terre', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'بصل أحمر', 'AR: بصل أحمر جاف بنسبة رطوبة منخفضة للتخزين الطويل. | FR: Oignons rouges seches avec faible humidite pour conservation prolongee.', 'vegetables', 'Onions', 4.90, 'kg', 25, 1900, true, 'approved', 33.5731, -7.5898, 'https://placehold.co/800x600?text=Oignons+Rouges', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'فلفل أخضر', 'AR: فلفل أخضر طازج مناسب للسلطات والطهي بالجملة. | FR: Poivrons verts frais adaptes aux salades et cuisson en gros.', 'vegetables', 'Peppers', 9.20, 'kg', 15, 1100, true, 'approved', 33.5892, -7.6039, 'https://placehold.co/800x600?text=Poivrons+Verts', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000011', 'جزر طازج', 'AR: جزر مغربي طازج، مغسول ومعبأ لصناديق الجملة. | FR: Carottes marocaines fraiches, lavees et emballees pour caisses de gros.', 'vegetables', 'Carrots', 6.10, 'kg', 20, 1400, true, 'approved', 33.5553, -7.5980, 'https://placehold.co/800x600?text=Carottes+Fraiches', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'برتقال عصير', 'AR: برتقال حلو مخصص للعصير الطبيعي بجودة موحدة. | FR: Oranges douces speciales jus avec qualite uniforme.', 'fruits', 'Citrus', 7.80, 'kg', 40, 2600, true, 'approved', 34.0209, -6.8416, 'https://placehold.co/800x600?text=Oranges+Jus', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', 'ليمون بلدي', 'AR: ليمون بلدي بطعم قوي مناسب للمطاعم والفنادق. | FR: Citrons beldi au gout intense, ideaux pour restaurants et hotels.', 'fruits', 'Citrus', 8.10, 'kg', 30, 2000, true, 'approved', 34.0209, -6.8416, 'https://placehold.co/800x600?text=Citrons+Beldi', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000005', 'زيتون أخضر', 'AR: زيتون أخضر طري صالح للتصبير والاستهلاك الطازج. | FR: Olives vertes tendres pour confiserie et consommation fraiche.', 'fruits', 'Olives', 12.50, 'kg', 25, 900, true, 'approved', 34.0331, -5.0003, 'https://placehold.co/800x600?text=Olives+Vertes', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000005', 'تمر مجدول', 'AR: تمر مجدول فاخر معبأ لصناديق 5 كلغ و10 كلغ. | FR: Dattes Medjool premium conditionnees en caisses 5kg et 10kg.', 'fruits', 'Dates', 38.00, 'kg', 10, 500, true, 'approved', 34.0331, -5.0003, 'https://placehold.co/800x600?text=Dattes+Medjool', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000007', 'أفوكادو هاس', 'AR: أفوكادو هاس عالي الجودة للمحلات الممتازة. | FR: Avocats Hass de haute qualite pour points de vente premium.', 'fruits', 'Avocados', 24.00, 'kg', 12, 700, true, 'approved', 31.6295, -7.9811, 'https://placehold.co/800x600?text=Avocats+Hass', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000008', 'نعناع بلدي', 'AR: نعناع عطري طازج للحزم اليومية والمقاهي. | FR: Menthe aromatique fraiche pour bottes quotidiennes et cafes.', 'herbs', 'Mint', 3.80, 'bunch', 50, 5000, true, 'approved', 31.6400, -8.0089, 'https://placehold.co/800x600?text=Menthe+Beldi', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000008', 'ريحان أخضر', 'AR: ريحان أخضر برائحة قوية مناسب للمطابخ الاحترافية. | FR: Basilic vert au parfum intense pour cuisines professionnelles.', 'herbs', 'Basil', 5.60, 'bunch', 40, 3200, true, 'approved', 31.6400, -8.0089, 'https://placehold.co/800x600?text=Basilic+Vert', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000006', 'قزبور طازج', 'AR: قزبور أخضر طازج مخصص للمطاعم والتجار. | FR: Coriandre fraiche pour restaurateurs et grossistes.', 'herbs', 'Coriander', 3.40, 'bunch', 60, 4200, true, 'approved', 34.0582, -4.9787, 'https://placehold.co/800x600?text=Coriandre+Fraiche', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000009', 'شتلات زيتون', 'AR: شتلات زيتون مغروسة في أكياس زراعية جاهزة للغرس. | FR: Plants d''olivier en sachets agricoles prets a planter.', 'plants', 'Trees', 45.00, 'piece', 10, 600, true, 'approved', 35.7595, -5.8340, 'https://placehold.co/800x600?text=Plants+Olivier', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000010', 'شتلات ليمون', 'AR: شتلات ليمون صحية مناسبة للمشاتل والمزارع. | FR: Jeunes plants de citron sains pour pepinieres et fermes.', 'plants', 'Trees', 39.00, 'piece', 12, 520, true, 'approved', 35.7767, -5.8039, 'https://placehold.co/800x600?text=Plants+Citron', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000009', 'نخيل زينة', 'AR: نخيل زينة بارتفاع متوسط للمشاريع الفندقية. | FR: Palmiers ornementaux hauteur moyenne pour projets hoteliers.', 'plants', 'Outdoor Plants', 280.00, 'piece', 3, 120, true, 'approved', 35.7595, -5.8340, 'https://placehold.co/800x600?text=Palmiers+Ornement', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000012', 'بذور طماطم', 'AR: بذور طماطم منتقاة بنسبة إنبات مرتفعة. | FR: Graines de tomate selectionnees avec taux de germination eleve.', 'seeds', 'Vegetable Seeds', 220.00, 'box', 2, 180, true, 'approved', 33.9655, -6.8538, 'https://placehold.co/800x600?text=Graines+Tomate', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000012', 'بذور فلفل', 'AR: بذور فلفل عالية الإنتاجية مناسبة للزراعة التجارية. | FR: Graines de poivron haut rendement pour agriculture commerciale.', 'seeds', 'Vegetable Seeds', 245.00, 'box', 2, 150, true, 'approved', 33.9655, -6.8538, 'https://placehold.co/800x600?text=Graines+Poivron', NOW(), NOW()),
  ('30000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000007', 'تفاح أحمر', 'AR: تفاح أحمر فاخر مناسب للفنادق والسوبرماركت. | FR: Pommes rouges premium adaptees hotels et supermarches.', 'fruits', 'Apples', 13.50, 'kg', 15, 980, true, 'approved', 31.6295, -7.9811, 'https://placehold.co/800x600?text=Pommes+Rouges', NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  price_per_unit = EXCLUDED.price_per_unit,
  unit_type = EXCLUDED.unit_type,
  min_order_quantity = EXCLUDED.min_order_quantity,
  available_quantity = EXCLUDED.available_quantity,
  is_available = EXCLUDED.is_available,
  approval_status = EXCLUDED.approval_status,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  image_url = EXCLUDED.image_url,
  updated_at = NOW();

-- Keep product_images table populated with the same placeholders.
INSERT INTO product_images (product_id, url, is_primary, sort_order, created_at)
VALUES
  ('30000000-0000-0000-0000-000000000001', 'https://placehold.co/800x600?text=Tomates+Premium', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000002', 'https://placehold.co/800x600?text=Pommes+de+Terre', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000003', 'https://placehold.co/800x600?text=Oignons+Rouges', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000004', 'https://placehold.co/800x600?text=Poivrons+Verts', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000005', 'https://placehold.co/800x600?text=Carottes+Fraiches', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000006', 'https://placehold.co/800x600?text=Oranges+Jus', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000007', 'https://placehold.co/800x600?text=Citrons+Beldi', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000008', 'https://placehold.co/800x600?text=Olives+Vertes', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000009', 'https://placehold.co/800x600?text=Dattes+Medjool', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000010', 'https://placehold.co/800x600?text=Avocats+Hass', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000011', 'https://placehold.co/800x600?text=Menthe+Beldi', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000012', 'https://placehold.co/800x600?text=Basilic+Vert', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000013', 'https://placehold.co/800x600?text=Coriandre+Fraiche', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000014', 'https://placehold.co/800x600?text=Plants+Olivier', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000015', 'https://placehold.co/800x600?text=Plants+Citron', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000016', 'https://placehold.co/800x600?text=Palmiers+Ornement', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000017', 'https://placehold.co/800x600?text=Graines+Tomate', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000018', 'https://placehold.co/800x600?text=Graines+Poivron', true, 0, NOW()),
  ('30000000-0000-0000-0000-000000000019', 'https://placehold.co/800x600?text=Pommes+Rouges', true, 0, NOW())
ON CONFLICT DO NOTHING;

COMMIT;

-- Quick verification summary.
SELECT 'vendors' AS type, COUNT(*) AS total FROM profiles WHERE role = 'vendor' AND verification_status = 'verified' AND is_active = true
UNION ALL
SELECT 'drivers' AS type, COUNT(*) AS total FROM profiles WHERE role = 'driver' AND verification_status = 'verified' AND is_active = true
UNION ALL
SELECT 'products' AS type, COUNT(*) AS total FROM products WHERE id::text LIKE '30000000-%';
