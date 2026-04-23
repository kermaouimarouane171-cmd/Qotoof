-- ============================================
-- Migration 007: Geographic Delivery System - Morocco
-- Purpose: Add region-based driver matching, distance calculation, and dynamic pricing
-- ============================================

-- ============================================
-- 1. REGIONS TABLE (12 Moroccan Regions)
-- ============================================
CREATE TABLE IF NOT EXISTS regions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name_ar TEXT NOT NULL,           -- الاسم بالعربية
    name_fr TEXT NOT NULL,           -- الاسم بالفرنسية
    name_en TEXT,                    -- الاسم بالإنجليزية
    cities TEXT[] NOT NULL,          -- المدن الرئيسية
    center_lat FLOAT NOT NULL,       -- خط العرض للمركز
    center_lng FLOAT NOT NULL,       -- خط الطول للمركز
    radius_km FLOAT DEFAULT 100,     -- نصف قطر الجهة بالكم
    neighboring_regions UUID[],      -- الجهات المجاورة
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert 12 Moroccan regions
INSERT INTO regions (name_ar, name_fr, name_en, cities, center_lat, center_lng, radius_km, neighboring_regions) VALUES
('طنجة-تطوان-الحسيمة', 'Tanger-Tétouan-Al Hoceïma', 'Tangier-Tetouan-Al Hoceima',
    ARRAY['طنجة', 'تطوان', 'الحسيمة', 'العرائش', 'الفنيدق', 'شفشاون'],
    35.7595, -5.8340, 120, NULL),

('الشرق', 'Oriental', 'Oriental',
    ARRAY['وجدة', 'الناظور', 'بركان', 'تاوريرت', 'جرادة', 'فكيك'],
    34.6814, -1.9086, 150, NULL),

('فاس-مكناس', 'Fès-Meknès', 'Fes-Meknes',
    ARRAY['فاس', 'مكناس', 'إفران', 'صفرو', 'تازة', 'الحاجب'],
    34.0331, -5.0003, 130, NULL),

('الرباط-سلا-القنيطرة', 'Rabat-Salé-Kénitra', 'Rabat-Sale-Kenitra',
    ARRAY['الرباط', 'سلا', 'القنيطرة', 'تمارة', 'سيدي قاسم', 'سيدي سليمان'],
    34.0209, -6.8416, 100, NULL),

('بني ملال-خنيفرة', 'Béni Mellal-Khénifra', 'Beni Mellal-Khenifra',
    ARRAY['بني ملال', 'خنيفرة', 'أزيلال', 'الفقيه بن صالح', 'خريبكة'],
    32.3373, -6.3498, 120, NULL),

('الدار البيضاء-سطات', 'Casablanca-Settat', 'Casablanca-Settat',
    ARRAY['الدار البيضاء', 'سطات', 'المحمدية', 'الجديدة', 'برشيد', 'بن سليمان'],
    33.5731, -7.5898, 100, NULL),

('مراكش-آسفي', 'Marrakech-Safi', 'Marrakech-Safi',
    ARRAY['مراكش', 'آسفي', 'قلعة السراغنة', 'شيشاوة', 'الصويرة', 'الحوز'],
    31.6295, -7.9811, 130, NULL),

('درعة-تافيلالت', 'Drâa-Tafilalet', 'Draa-Tafilalet',
    ARRAY['الرشيدية', 'ورززات', 'زاكورة', 'تنغير', 'ميدلت'],
    31.5085, -5.1256, 180, NULL),

('سوس-ماسة', 'Souss-Massa', 'Souss-Massa',
    ARRAY['أكادير', 'تيزنيت', 'إنزكان', 'تارودانت', 'شتوكة آيت باها'],
    30.4278, -9.5981, 140, NULL),

('كلميم-واد نون', 'Guelmim-Oued Noun', 'Guelmim-Oued Noun',
    ARRAY['كلميم', 'طانطان', 'سيدي إفني', 'أسا الزاك'],
    28.9833, -10.0567, 160, NULL),

('العيون-الساقية الحمراء', 'Laâyoune-Sakia El Hamra', 'Laayoune-Sakia El Hamra',
    ARRAY['العيون', 'بوجدور', 'طرفاية', 'السمارة'],
    27.1253, -13.1625, 200, NULL),

('الداخلة-وادي الذهب', 'Dakhla-Oued Ed-Dahab', 'Dakhla-Oued Ed-Dahab',
    ARRAY['الداخلة', 'أوسرد'],
    23.7151, -15.9520, 250, NULL)
ON CONFLICT DO NOTHING;

-- Update neighboring regions
UPDATE regions SET neighboring_regions = ARRAY[
    (SELECT id FROM regions WHERE name_ar = 'الشرق'),
    (SELECT id FROM regions WHERE name_ar = 'فاس-مكناس'),
    (SELECT id FROM regions WHERE name_ar = 'الرباط-سلا-القنيطرة')
] WHERE name_ar = 'طنجة-تطوان-الحسيمة';

UPDATE regions SET neighboring_regions = ARRAY[
    (SELECT id FROM regions WHERE name_ar = 'طنجة-تطوان-الحسيمة'),
    (SELECT id FROM regions WHERE name_ar = 'فاس-مكناس')
] WHERE name_ar = 'الشرق';

UPDATE regions SET neighboring_regions = ARRAY[
    (SELECT id FROM regions WHERE name_ar = 'طنجة-تطوان-الحسيمة'),
    (SELECT id FROM regions WHERE name_ar = 'الشرق'),
    (SELECT id FROM regions WHERE name_ar = 'الرباط-سلا-القنيطرة'),
    (SELECT id FROM regions WHERE name_ar = 'بني ملال-خنيفرة')
] WHERE name_ar = 'فاس-مكناس';

UPDATE regions SET neighboring_regions = ARRAY[
    (SELECT id FROM regions WHERE name_ar = 'طنجة-تطوان-الحسيمة'),
    (SELECT id FROM regions WHERE name_ar = 'فاس-مكناس'),
    (SELECT id FROM regions WHERE name_ar = 'الدار البيضاء-سطات')
] WHERE name_ar = 'الرباط-سلا-القنيطرة';

UPDATE regions SET neighboring_regions = ARRAY[
    (SELECT id FROM regions WHERE name_ar = 'فاس-مكناس'),
    (SELECT id FROM regions WHERE name_ar = 'الرباط-سلا-القنيطرة'),
    (SELECT id FROM regions WHERE name_ar = 'الدار البيضاء-سطات'),
    (SELECT id FROM regions WHERE name_ar = 'مراكش-آسفي')
] WHERE name_ar = 'بني ملال-خنيفرة';

UPDATE regions SET neighboring_regions = ARRAY[
    (SELECT id FROM regions WHERE name_ar = 'الرباط-سلا-القنيطرة'),
    (SELECT id FROM regions WHERE name_ar = 'بني ملال-خنيفرة'),
    (SELECT id FROM regions WHERE name_ar = 'مراكش-آسفي')
] WHERE name_ar = 'الدار البيضاء-سطات';

UPDATE regions SET neighboring_regions = ARRAY[
    (SELECT id FROM regions WHERE name_ar = 'بني ملال-خنيفرة'),
    (SELECT id FROM regions WHERE name_ar = 'الدار البيضاء-سطات'),
    (SELECT id FROM regions WHERE name_ar = 'درعة-تافيلالت'),
    (SELECT id FROM regions WHERE name_ar = 'سوس-ماسة')
] WHERE name_ar = 'مراكش-آسفي';

UPDATE regions SET neighboring_regions = ARRAY[
    (SELECT id FROM regions WHERE name_ar = 'فاس-مكناس'),
    (SELECT id FROM regions WHERE name_ar = 'مراكش-آسفي'),
    (SELECT id FROM regions WHERE name_ar = 'سوس-ماسة')
] WHERE name_ar = 'درعة-تافيلالت';

UPDATE regions SET neighboring_regions = ARRAY[
    (SELECT id FROM regions WHERE name_ar = 'مراكش-آسفي'),
    (SELECT id FROM regions WHERE name_ar = 'درعة-تافيلالت'),
    (SELECT id FROM regions WHERE name_ar = 'كلميم-واد نون')
] WHERE name_ar = 'سوس-ماسة';

UPDATE regions SET neighboring_regions = ARRAY[
    (SELECT id FROM regions WHERE name_ar = 'سوس-ماسة')
] WHERE name_ar = 'كلميم-واد نون';

-- ============================================
-- 2. DRIVER LOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS driver_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID REFERENCES profiles(id) UNIQUE,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    region_id UUID REFERENCES regions(id),
    city TEXT,
    address TEXT,
    is_available BOOLEAN DEFAULT true,
    service_radius_km FLOAT DEFAULT 50,  -- نصف قطر الخدمة
    max_distance_km FLOAT DEFAULT 300,   -- أقصى مسافة للتوصيل
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT valid_longitude CHECK (longitude BETWEEN -180 AND 180)
);

-- Add missing columns if table already exists
ALTER TABLE driver_locations
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id),
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS service_radius_km FLOAT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS max_distance_km FLOAT DEFAULT 300,
  ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_locations_region ON driver_locations(region_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_city ON driver_locations(city);
CREATE INDEX IF NOT EXISTS idx_driver_locations_available ON driver_locations(is_available);
CREATE INDEX IF NOT EXISTS idx_driver_locations_last_updated ON driver_locations(last_updated DESC);

-- RLS
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Drivers can manage their own location
CREATE POLICY "Drivers can manage own location" ON driver_locations
    FOR ALL USING (driver_id = auth.uid());

-- Anyone can view available drivers
CREATE POLICY "Anyone can view available drivers" ON driver_locations
    FOR SELECT USING (is_available = true);

-- Admins can view all locations
CREATE POLICY "Admins can view all locations" ON driver_locations
    FOR SELECT USING (true);

-- ============================================
-- 3. CITY DISTANCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS city_distances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    from_city TEXT NOT NULL,
    to_city TEXT NOT NULL,
    distance_km FLOAT NOT NULL,
    estimated_hours FLOAT,
    highway BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_city, to_city)
);

-- Insert major city distances
INSERT INTO city_distances (from_city, to_city, distance_km, estimated_hours, highway) VALUES
-- From Oriental (الشرق)
('وجدة', 'فاس', 200, 3.0, true),
('وجدة', 'الناظور', 60, 1.0, true),
('وجدة', 'بركان', 45, 0.75, true),
('وجدة', 'تاوريرت', 100, 1.5, true),
('وجدة', 'الرباط', 480, 5.0, true),
('وجدة', 'الدار البيضاء', 550, 6.0, true),
('وجدة', 'طنجة', 620, 7.0, true),

-- From Fes-Meknes
('فاس', 'مكناس', 60, 1.0, true),
('فاس', 'الرباط', 180, 2.0, true),
('فاس', 'الدار البيضاء', 300, 3.5, true),
('فاس', 'طنجة', 320, 4.0, true),
('فاس', 'مراكش', 450, 5.5, true),
('فاس', 'أكادير', 650, 8.0, false),

-- From Rabat-Sale-Kenitra
('الرباط', 'القنيطرة', 40, 0.5, true),
('الرباط', 'سلا', 5, 0.2, true),
('الرباط', 'الدار البيضاء', 90, 1.2, true),
('الرباط', 'طنجة', 250, 3.0, true),
('الرباط', 'مراكش', 330, 4.0, true),

-- From Casablanca-Settat
('الدار البيضاء', 'المحمدية', 30, 0.5, true),
('الدار البيضاء', 'سطات', 90, 1.2, true),
('الدار البيضاء', 'الجديدة', 100, 1.5, true),
('الدار البيضاء', 'مراكش', 240, 3.0, true),
('الدار البيضاء', 'أكادير', 500, 6.0, true),

-- From Marrakech-Safi
('مراكش', 'آسفي', 160, 2.0, true),
('مراكش', 'الصويرة', 180, 2.5, true),
('مراكش', 'أكادير', 250, 3.0, true),
('مراكش', 'ورززات', 200, 3.5, false),

-- From Souss-Massa
('أكادير', 'تيزنيت', 100, 1.5, true),
('أكادير', 'إنزكان', 10, 0.3, true),
('أكادير', 'طانطان', 250, 3.5, true),

-- Long distances
('طنجة', 'الداخلة', 2200, 24.0, false),
('العيون', 'الداخلة', 500, 6.0, true),
('كلميم', 'أكادير', 200, 3.0, true)
ON CONFLICT (from_city, to_city) DO NOTHING;

-- Add reverse distances
INSERT INTO city_distances (from_city, to_city, distance_km, estimated_hours, highway)
SELECT to_city, from_city, distance_km, estimated_hours, highway
FROM city_distances
WHERE (to_city, from_city) NOT IN (SELECT from_city, to_city FROM city_distances)
ON CONFLICT (from_city, to_city) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_city_distances_from ON city_distances(from_city);
CREATE INDEX IF NOT EXISTS idx_city_distances_to ON city_distances(to_city);
CREATE INDEX IF NOT EXISTS idx_city_distances_distance ON city_distances(distance_km);

-- ============================================
-- 4. DELIVERY REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id),
    vendor_id UUID REFERENCES profiles(id),
    buyer_id UUID REFERENCES profiles(id),
    pickup_city TEXT NOT NULL,
    pickup_region_id UUID REFERENCES regions(id),
    pickup_lat FLOAT NOT NULL,
    pickup_lng FLOAT NOT NULL,
    delivery_city TEXT NOT NULL,
    delivery_region_id UUID REFERENCES regions(id),
    delivery_lat FLOAT NOT NULL,
    delivery_lng FLOAT NOT NULL,
    distance_km FLOAT,
    estimated_hours FLOAT,
    status TEXT DEFAULT 'pending', -- 'pending', 'searching', 'assigned', 'in_transit', 'delivered', 'cancelled'
    assigned_driver_id UUID REFERENCES profiles(id),
    driver_region_id UUID,
    driver_distance_from_pickup_km FLOAT,
    base_fee FLOAT,
    distance_fee FLOAT,
    total_fee FLOAT,
    no_driver_available BOOLEAN DEFAULT false,
    notified_drivers UUID[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if table already exists
ALTER TABLE delivery_requests
  ADD COLUMN IF NOT EXISTS pickup_region_id UUID REFERENCES regions(id),
  ADD COLUMN IF NOT EXISTS delivery_region_id UUID REFERENCES regions(id),
  ADD COLUMN IF NOT EXISTS driver_region_id UUID,
  ADD COLUMN IF NOT EXISTS driver_distance_from_pickup_km FLOAT,
  ADD COLUMN IF NOT EXISTS no_driver_available BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notified_drivers UUID[],
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS pickup_city TEXT,
  ADD COLUMN IF NOT EXISTS pickup_lat FLOAT,
  ADD COLUMN IF NOT EXISTS pickup_lng FLOAT,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_lat FLOAT,
  ADD COLUMN IF NOT EXISTS delivery_lng FLOAT,
  ADD COLUMN IF NOT EXISTS distance_km FLOAT,
  ADD COLUMN IF NOT EXISTS estimated_hours FLOAT,
  ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS base_fee FLOAT,
  ADD COLUMN IF NOT EXISTS distance_fee FLOAT,
  ADD COLUMN IF NOT EXISTS total_fee FLOAT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON delivery_requests(status);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_pickup_region ON delivery_requests(pickup_region_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_delivery_region ON delivery_requests(delivery_region_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_driver ON delivery_requests(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_created ON delivery_requests(created_at DESC);

-- RLS
ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their delivery requests
CREATE POLICY "Users can view own delivery requests" ON delivery_requests
    FOR SELECT USING (buyer_id = auth.uid() OR vendor_id = auth.uid());

-- Drivers can view assigned deliveries
CREATE POLICY "Drivers can view assigned deliveries" ON delivery_requests
    FOR SELECT USING (assigned_driver_id = auth.uid());

-- System can create delivery requests
CREATE POLICY "System can create delivery requests" ON delivery_requests
    FOR INSERT WITH CHECK (true);

-- Drivers can update their assigned deliveries
CREATE POLICY "Drivers can update assigned deliveries" ON delivery_requests
    FOR UPDATE USING (assigned_driver_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can view all delivery requests" ON delivery_requests
    FOR SELECT USING (true);

-- ============================================
-- 5. FUNCTIONS
-- ============================================

-- Function: Calculate distance using Haversine formula
CREATE OR REPLACE FUNCTION calculate_distance_km(
    lat1 FLOAT, lng1 FLOAT,
    lat2 FLOAT, lng2 FLOAT
)
RETURNS FLOAT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    R FLOAT := 6371; -- Earth radius in km
    dLat FLOAT;
    dLng FLOAT;
    a FLOAT;
    c FLOAT;
BEGIN
    dLat := (lat2 - lat1) * PI() / 180;
    dLng := (lng2 - lng1) * PI() / 180;
    
    a := SIN(dLat/2) * SIN(dLat/2) +
         COS(lat1 * PI() / 180) * COS(lat2 * PI() / 180) *
         SIN(dLng/2) * SIN(dLng/2);
    
    c := 2 * ATAN2(SQRT(a), SQRT(1-a));
    
    RETURN R * c;
END;
$$;

-- Function: Get region from coordinates
CREATE OR REPLACE FUNCTION get_region_from_coords(lat FLOAT, lng FLOAT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_region_id UUID;
BEGIN
    SELECT id INTO v_region_id
    FROM regions
    WHERE calculate_distance_km(lat, lng, center_lat, center_lng) <= radius_km
    ORDER BY calculate_distance_km(lat, lng, center_lat, center_lng) ASC
    LIMIT 1;
    
    RETURN v_region_id;
END;
$$;

-- Function: Find nearest available drivers
CREATE OR REPLACE FUNCTION find_nearest_drivers(
    p_pickup_lat FLOAT,
    p_pickup_lng FLOAT,
    p_max_distance_km FLOAT DEFAULT 300,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    driver_id UUID,
    driver_name TEXT,
    city TEXT,
    region_id UUID,
    region_name TEXT,
    distance_km FLOAT,
    estimated_hours FLOAT,
    service_radius_km FLOAT,
    is_in_same_region BOOLEAN,
    is_in_neighboring_region BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_pickup_region_id UUID;
BEGIN
    -- Get pickup region
    v_pickup_region_id := get_region_from_coords(p_pickup_lat, p_pickup_lng);
    
    RETURN QUERY
    SELECT 
        dl.driver_id,
        CONCAT(p.first_name, ' ', p.last_name),
        dl.city,
        dl.region_id,
        r.name_ar,
        calculate_distance_km(p_pickup_lat, p_pickup_lng, dl.latitude, dl.longitude) as distance_km,
        calculate_distance_km(p_pickup_lat, p_pickup_lng, dl.latitude, dl.longitude) / 60.0 as estimated_hours,
        dl.service_radius_km,
        dl.region_id = v_pickup_region_id as is_in_same_region,
        dl.region_id = ANY(
            SELECT neighboring_regions 
            FROM regions 
            WHERE id = v_pickup_region_id
        ) as is_in_neighboring_region
    FROM driver_locations dl
    JOIN profiles p ON p.id = dl.driver_id
    LEFT JOIN regions r ON r.id = dl.region_id
    WHERE dl.is_available = true
      AND dl.service_radius_km >= calculate_distance_km(p_pickup_lat, p_pickup_lng, dl.latitude, dl.longitude)
    ORDER BY 
        -- Priority: same region first, then neighboring, then others
        CASE 
            WHEN dl.region_id = v_pickup_region_id THEN 1
            WHEN dl.region_id = ANY(
                SELECT neighboring_regions FROM regions WHERE id = v_pickup_region_id
            ) THEN 2
            ELSE 3
        END,
        distance_km ASC
    LIMIT p_limit;
END;
$$;

-- Function: Check if driver is available in region
CREATE OR REPLACE FUNCTION check_driver_availability_in_region(
    p_region_id UUID
)
RETURNS TABLE (
    has_drivers BOOLEAN,
    available_count INTEGER,
    nearest_city TEXT,
    nearest_distance_km FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_region RECORD;
BEGIN
    SELECT * INTO v_region FROM regions WHERE id = p_region_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, NULL, NULL;
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        COUNT(*) > 0 as has_drivers,
        COUNT(*)::INTEGER as available_count,
        (SELECT city FROM driver_locations 
         WHERE region_id = p_region_id AND is_available = true 
         ORDER BY last_updated DESC LIMIT 1) as nearest_city,
        NULL as nearest_distance_km;
END;
$$;

-- Function: Calculate delivery fee based on distance
CREATE OR REPLACE FUNCTION calculate_delivery_fee(
    p_distance_km FLOAT,
    p_same_region BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_base_fee FLOAT;
    v_per_km FLOAT;
    v_total_fee FLOAT;
    v_tier TEXT;
BEGIN
    IF p_same_region THEN
        -- Same region pricing
        IF p_distance_km <= 30 THEN
            v_base_fee := 20;
            v_per_km := 1.0;
            v_tier := 'local';
        ELSIF p_distance_km <= 100 THEN
            v_base_fee := 40;
            v_per_km := 1.5;
            v_tier := 'regional';
        ELSE
            v_base_fee := 80;
            v_per_km := 2.0;
            v_tier := 'long_distance';
        END IF;
    ELSE
        -- Different region pricing (more expensive)
        IF p_distance_km <= 100 THEN
            v_base_fee := 60;
            v_per_km := 2.0;
            v_tier := 'inter_region_short';
        ELSIF p_distance_km <= 300 THEN
            v_base_fee := 100;
            v_per_km := 2.5;
            v_tier := 'inter_region_medium';
        ELSE
            v_base_fee := 150;
            v_per_km := 3.0;
            v_tier := 'inter_region_long';
        END IF;
    END IF;
    
    v_total_fee := v_base_fee + (p_distance_km * v_per_km);
    
    RETURN jsonb_build_object(
        'base_fee', ROUND(v_base_fee, 2),
        'per_km', v_per_km,
        'distance_km', ROUND(p_distance_km, 2),
        'distance_fee', ROUND(p_distance_km * v_per_km, 2),
        'total_fee', ROUND(v_total_fee, 2),
        'tier', v_tier,
        'currency', 'MAD'
    );
END;
$$;

-- Function: Create delivery request with driver matching
CREATE OR REPLACE FUNCTION create_delivery_request(
    p_order_id UUID,
    p_vendor_id UUID,
    p_buyer_id UUID,
    p_pickup_city TEXT,
    p_pickup_lat FLOAT,
    p_pickup_lng FLOAT,
    p_delivery_city TEXT,
    p_delivery_lat FLOAT,
    p_delivery_lng FLOAT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_delivery_id UUID;
    v_pickup_region_id UUID;
    v_delivery_region_id UUID;
    v_distance_km FLOAT;
    v_drivers RECORD;
    v_nearest_driver RECORD;
    v_fee JSONB;
    v_driver_found BOOLEAN := false;
BEGIN
    -- Get regions
    v_pickup_region_id := get_region_from_coords(p_pickup_lat, p_pickup_lng);
    v_delivery_region_id := get_region_from_coords(p_delivery_lat, p_delivery_lng);
    
    -- Calculate distance
    v_distance_km := calculate_distance_km(p_pickup_lat, p_pickup_lng, p_delivery_lat, p_delivery_lng);
    
    -- Find nearest drivers
    FOR v_drivers IN 
        SELECT * FROM find_nearest_drivers(p_pickup_lat, p_pickup_lng, 300, 5)
    LOOP
        v_nearest_driver := v_drivers;
        v_driver_found := true;
        EXIT;
    END LOOP;
    
    -- Calculate fee
    v_fee := calculate_delivery_fee(
        v_distance_km, 
        v_nearest_driver.is_in_same_region
    );
    
    -- Create delivery request
    INSERT INTO delivery_requests (
        order_id, vendor_id, buyer_id,
        pickup_city, pickup_region_id, pickup_lat, pickup_lng,
        delivery_city, delivery_region_id, delivery_lat, delivery_lng,
        distance_km, estimated_hours,
        assigned_driver_id, driver_region_id, driver_distance_from_pickup_km,
        base_fee, distance_fee, total_fee,
        no_driver_available,
        status
    ) VALUES (
        p_order_id, p_vendor_id, p_buyer_id,
        p_pickup_city, v_pickup_region_id, p_pickup_lat, p_pickup_lng,
        p_delivery_city, v_delivery_region_id, p_delivery_lat, p_delivery_lng,
        v_distance_km, v_distance_km / 60.0,
        CASE WHEN v_driver_found THEN v_nearest_driver.driver_id ELSE NULL END,
        CASE WHEN v_driver_found THEN v_nearest_driver.region_id ELSE NULL END,
        CASE WHEN v_driver_found THEN v_nearest_driver.distance_km ELSE NULL END,
        (v_fee->>'base_fee')::FLOAT,
        (v_fee->>'distance_fee')::FLOAT,
        (v_fee->>'total_fee')::FLOAT,
        NOT v_driver_found,
        CASE WHEN v_driver_found THEN 'assigned' ELSE 'pending' END
    )
    RETURNING id INTO v_delivery_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'delivery_id', v_delivery_id,
        'driver_found', v_driver_found,
        'driver', CASE WHEN v_driver_found THEN jsonb_build_object(
            'id', v_nearest_driver.driver_id,
            'name', v_nearest_driver.driver_name,
            'city', v_nearest_driver.city,
            'region', v_nearest_driver.region_name,
            'distance_km', ROUND(v_nearest_driver.distance_km, 2)
        ) ELSE NULL END,
        'fee', v_fee,
        'distance_km', ROUND(v_distance_km, 2),
        'estimated_hours', ROUND(v_distance_km / 60.0, 2)
    );
END;
$$;

-- ============================================
-- 6. TRIGGERS
-- ============================================

-- Trigger: Auto-update region on driver location change
CREATE OR REPLACE FUNCTION update_driver_region()
RETURNS TRIGGER AS $$
BEGIN
    NEW.region_id := get_region_from_coords(NEW.latitude, NEW.longitude);
    NEW.last_updated := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_driver_region ON driver_locations;
CREATE TRIGGER trg_update_driver_region
    BEFORE INSERT OR UPDATE ON driver_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_region();

-- Trigger: Auto-update delivery request timestamps
CREATE OR REPLACE FUNCTION update_delivery_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_delivery_timestamps ON delivery_requests;
CREATE TRIGGER trg_update_delivery_timestamps
    BEFORE UPDATE ON delivery_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_delivery_timestamps();

-- ============================================
-- Migration complete!
-- ============================================
COMMENT ON TABLE regions IS '12 Moroccan regions with coordinates';
COMMENT ON TABLE driver_locations IS 'Real-time driver locations';
COMMENT ON TABLE city_distances IS 'Distances between major Moroccan cities';
COMMENT ON TABLE delivery_requests IS 'Delivery requests with driver matching';
COMMENT ON FUNCTION calculate_distance_km IS 'Haversine formula for distance calculation';
COMMENT ON FUNCTION find_nearest_drivers IS 'Find nearest available drivers with priority by region';
COMMENT ON FUNCTION create_delivery_request IS 'Create delivery request with automatic driver matching';
