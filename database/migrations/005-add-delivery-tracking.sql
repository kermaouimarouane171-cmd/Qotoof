-- ============================================
-- Migration 005: Driver Delivery Tracking & Pricing
-- Purpose: Add delivery zones, distance-based pricing, and real-time tracking
-- ============================================

-- ============================================
-- 1. DELIVERY ZONES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    city TEXT NOT NULL,
    zone_name TEXT NOT NULL,
    zone_code TEXT,
    base_price DECIMAL(10, 2) NOT NULL, -- Base delivery price for this zone
    price_per_km DECIMAL(10, 2) DEFAULT 2.0, -- Price per kilometer
    max_distance_km DECIMAL(10, 2) DEFAULT 50, -- Maximum delivery distance
    polygon_coordinates JSONB, -- Zone boundaries as GeoJSON
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(city, zone_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_zones_city ON delivery_zones(city);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active);

-- RLS
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- Everyone can view active zones
CREATE POLICY "Everyone can view active zones" ON delivery_zones
    FOR SELECT USING (is_active = true);

-- Drivers can view all zones
CREATE POLICY "Drivers can view all zones" ON delivery_zones
    FOR SELECT USING (true);

-- Admins can manage zones
CREATE POLICY "Admins can manage zones" ON delivery_zones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- 2. DRIVER DELIVERY PRICING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS driver_pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    base_price DECIMAL(10, 2) DEFAULT 15.0, -- Base delivery fee
    price_per_km DECIMAL(10, 2) DEFAULT 2.0, -- Price per km
    min_price DECIMAL(10, 2) DEFAULT 10.0, -- Minimum delivery fee
    max_price DECIMAL(10, 2) DEFAULT 200.0, -- Maximum delivery fee
    max_distance_km DECIMAL(10, 2) DEFAULT 50, -- Maximum distance willing to deliver
    rush_hour_multiplier DECIMAL(5, 2) DEFAULT 1.5, -- Rush hour multiplier (1.5x)
    rush_hour_start TIME DEFAULT '12:00',
    rush_hour_end TIME DEFAULT '14:00',
    evening_multiplier DECIMAL(5, 2) DEFAULT 1.3, -- Evening multiplier (1.3x)
    evening_start TIME DEFAULT '20:00',
    evening_end TIME DEFAULT '06:00',
    is_custom_pricing BOOLEAN DEFAULT false, -- Whether driver uses custom pricing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_pricing_driver ON driver_pricing(driver_id);

-- RLS
ALTER TABLE driver_pricing ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own pricing
CREATE POLICY "Drivers can view own pricing" ON driver_pricing
    FOR SELECT USING (driver_id = auth.uid());

-- Drivers can insert/update their own pricing
CREATE POLICY "Drivers can manage own pricing" ON driver_pricing
    FOR ALL USING (driver_id = auth.uid());

-- Admins can view all pricing
CREATE POLICY "Admins can view all pricing" ON driver_pricing
    FOR SELECT USING (true);

-- ============================================
-- 3. DELIVERY TRACKING TABLE (Enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES profiles(id),
    order_id UUID REFERENCES orders(id),
    
    -- Location tracking
    pickup_latitude DECIMAL(10, 8),
    pickup_longitude DECIMAL(10, 8),
    pickup_address TEXT,
    pickup_time TIMESTAMPTZ,
    
    delivery_latitude DECIMAL(10, 8),
    delivery_longitude DECIMAL(10, 8),
    delivery_address TEXT,
    delivery_time TIMESTAMPTZ,
    
    -- Real-time tracking
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(10, 8),
    last_location_update TIMESTAMPTZ,
    
    -- Distance & pricing
    distance_km DECIMAL(10, 2),
    estimated_distance_km DECIMAL(10, 2),
    delivery_price DECIMAL(10, 2),
    price_breakdown JSONB, -- {base: 15, distance: 20, rush_hour: 5, total: 40}
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'picked_up', 'on_the_way', 'delivered', 'cancelled'
    
    -- Timing
    estimated_delivery_time TIMESTAMPTZ,
    actual_delivery_time TIMESTAMPTZ,
    
    -- Notes
    driver_notes TEXT,
    customer_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_delivery ON delivery_tracking(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_driver ON delivery_tracking(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order ON delivery_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_status ON delivery_tracking(status);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_location ON delivery_tracking(last_location_update DESC);

-- RLS
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;

-- Drivers can view their own deliveries
CREATE POLICY "Drivers can view own deliveries" ON delivery_tracking
    FOR SELECT USING (driver_id = auth.uid());

-- Drivers can update their own deliveries
CREATE POLICY "Drivers can update own deliveries" ON delivery_tracking
    FOR UPDATE USING (driver_id = auth.uid());

-- Vendors can view deliveries for their orders
CREATE POLICY "Vendors can view deliveries for their orders" ON delivery_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = delivery_tracking.order_id 
            AND orders.vendor_id = auth.uid()
        )
    );

-- Buyers can view their own deliveries
CREATE POLICY "Buyers can view own deliveries" ON delivery_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = delivery_tracking.order_id 
            AND orders.buyer_id = auth.uid()
        )
    );

-- Admins can view all deliveries
CREATE POLICY "Admins can view all deliveries" ON delivery_tracking
    FOR SELECT USING (true);

-- ============================================
-- 4. LOCATION HISTORY TABLE (For tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS driver_location_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES deliveries(id),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(10, 8) NOT NULL,
    speed_kmh DECIMAL(10, 2),
    heading DECIMAL(10, 2), -- Direction in degrees
    accuracy_meters INTEGER,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_location_history_driver ON driver_location_history(driver_id);
CREATE INDEX IF NOT EXISTS idx_location_history_delivery ON driver_location_history(delivery_id);
CREATE INDEX IF NOT EXISTS idx_location_history_time ON driver_location_history(recorded_at DESC);

-- Auto cleanup old data (keep 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_location_history()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM driver_location_history
    WHERE recorded_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- RLS
ALTER TABLE driver_location_history ENABLE ROW LEVEL SECURITY;

-- Drivers can insert their own location
CREATE POLICY "Drivers can insert own location" ON driver_location_history
    FOR INSERT WITH CHECK (driver_id = auth.uid());

-- Drivers can view their own history
CREATE POLICY "Drivers can view own history" ON driver_location_history
    FOR SELECT USING (driver_id = auth.uid());

-- Delivery stakeholders can view current delivery history
CREATE POLICY "Stakeholders can view delivery history" ON driver_location_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM deliveries 
            WHERE deliveries.id = driver_location_history.delivery_id
            AND (
                deliveries.driver_id = auth.uid()
                OR deliveries.vendor_id = auth.uid()
            )
        )
    );

-- ============================================
-- 5. FUNCTIONS
-- ============================================

-- Function: Calculate delivery price based on distance
CREATE OR REPLACE FUNCTION calculate_delivery_price(
    p_driver_id UUID,
    p_distance_km DECIMAL,
    p_delivery_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pricing RECORD;
    v_base_price DECIMAL;
    v_distance_price DECIMAL;
    v_time_multiplier DECIMAL := 1.0;
    v_total_price DECIMAL;
    v_current_time TIME;
BEGIN
    -- Get driver pricing settings
    SELECT * INTO v_pricing
    FROM driver_pricing
    WHERE driver_id = p_driver_id;
    
    -- If no custom pricing, use defaults
    IF NOT FOUND THEN
        v_base_price := 15.0;
        v_pricing.price_per_km := 2.0;
        v_pricing.min_price := 10.0;
        v_pricing.max_price := 200.0;
        v_pricing.rush_hour_multiplier := 1.5;
        v_pricing.rush_hour_start := '12:00';
        v_pricing.rush_hour_end := '14:00';
        v_pricing.evening_multiplier := 1.3;
        v_pricing.evening_start := '20:00';
        v_pricing.evening_end := '06:00';
    ELSE
        v_base_price := v_pricing.base_price;
    END IF;
    
    -- Calculate distance price
    v_distance_price := p_distance_km * v_pricing.price_per_km;
    
    -- Check time-based multipliers
    v_current_time := EXTRACT(TIME FROM p_delivery_time);
    
    -- Rush hour check
    IF v_current_time BETWEEN v_pricing.rush_hour_start AND v_pricing.rush_hour_end THEN
        v_time_multiplier := v_pricing.rush_hour_multiplier;
    END IF;
    
    -- Evening check (handles overnight)
    IF v_pricing.evening_start < v_pricing.evening_end THEN
        IF v_current_time BETWEEN v_pricing.evening_start AND v_pricing.evening_end THEN
            v_time_multiplier := GREATEST(v_time_multiplier, v_pricing.evening_multiplier);
        END IF;
    ELSE
        -- Overnight range (e.g., 20:00 to 06:00)
        IF v_current_time >= v_pricing.evening_start OR v_current_time <= v_pricing.evening_end THEN
            v_time_multiplier := GREATEST(v_time_multiplier, v_pricing.evening_multiplier);
        END IF;
    END IF;
    
    -- Calculate total
    v_total_price := (v_base_price + v_distance_price) * v_time_multiplier;
    
    -- Apply min/max limits
    v_total_price := GREATEST(v_total_price, v_pricing.min_price);
    v_total_price := LEAST(v_total_price, v_pricing.max_price);
    
    RETURN jsonb_build_object(
        'base_price', ROUND(v_base_price, 2),
        'distance_km', p_distance_km,
        'distance_price', ROUND(v_distance_price, 2),
        'time_multiplier', v_time_multiplier,
        'total_price', ROUND(v_total_price, 2),
        'price_per_km', v_pricing.price_per_km
    );
END;
$$;

-- Function: Calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance_km(
    lat1 DECIMAL,
    lng1 DECIMAL,
    lat2 DECIMAL,
    lng2 DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_r DECIMAL := 6371; -- Earth radius in km
    v_dlat DECIMAL;
    v_dlng DECIMAL;
    v_a DECIMAL;
    v_c DECIMAL;
BEGIN
    -- Convert to radians
    v_dlat := RADIANS(lat2 - lat1);
    v_dlng := RADIANS(lng2 - lng1);
    
    -- Haversine formula
    v_a := SIN(v_dlat / 2) * SIN(v_dlat / 2) +
           COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
           SIN(v_dlng / 2) * SIN(v_dlng / 2);
    
    v_c := 2 * ATAN2(SQRT(v_a), SQRT(1 - v_a));
    
    RETURN ROUND(v_r * v_c, 2);
END;
$$;

-- Function: Update driver location (for real-time tracking)
CREATE OR REPLACE FUNCTION update_driver_location(
    p_driver_id UUID,
    p_delivery_id UUID,
    p_latitude DECIMAL,
    p_longitude DECIMAL,
    p_speed_kmh DECIMAL DEFAULT NULL,
    p_heading DECIMAL DEFAULT NULL,
    p_accuracy INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update delivery tracking current location
    UPDATE delivery_tracking
    SET 
        current_latitude = p_latitude,
        current_longitude = p_longitude,
        last_location_update = NOW()
    WHERE delivery_id = p_delivery_id
    AND driver_id = p_driver_id;
    
    -- Insert location history
    INSERT INTO driver_location_history (
        driver_id, delivery_id, latitude, longitude, speed_kmh, heading, accuracy_meters
    ) VALUES (
        p_driver_id, p_delivery_id, p_latitude, p_longitude, p_speed_kmh, p_heading, p_accuracy
    );
    
    -- Update profile location
    UPDATE profiles
    SET 
        latitude = p_latitude,
        longitude = p_longitude,
        last_seen_at = NOW()
    WHERE id = p_driver_id;
    
    RETURN jsonb_build_object('success', true, 'timestamp', NOW());
END;
$$;

-- ============================================
-- 6. SEED DATA - Default Delivery Zones for Major Moroccan Cities
-- ============================================
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
    ('Casablanca', 'Centre Ville', 'CASA-01', 15.0, 2.0, 30),
    ('Casablanca', 'Ain Diab', 'CASA-02', 18.0, 2.5, 35),
    ('Casablanca', 'Anfa', 'CASA-03', 16.0, 2.0, 30),
    ('Casablanca', 'Maarif', 'CASA-04', 15.0, 2.0, 25),
    ('Casablanca', 'Hay Hassani', 'CASA-05', 20.0, 2.5, 40),
    ('Casablanca', 'Sidi Bernoussi', 'CASA-06', 22.0, 3.0, 45),
    ('Casablanca', 'Ain Sebaa', 'CASA-07', 20.0, 2.5, 40),
    ('Rabat', 'Agdal', 'RABAT-01', 15.0, 2.0, 25),
    ('Rabat', 'Hassan', 'RABAT-02', 14.0, 2.0, 25),
    ('Rabat', 'Souissi', 'RABAT-03', 18.0, 2.5, 30),
    ('Rabat', 'Yacoub El Mansour', 'RABAT-04', 16.0, 2.0, 30),
    ('Marrakech', 'Medina', 'MARR-01', 12.0, 1.5, 20),
    ('Marrakech', 'Gueliz', 'MARR-02', 15.0, 2.0, 25),
    ('Marrakech', 'Hivernage', 'MARR-03', 18.0, 2.5, 30),
    ('Marrakech', 'Menara', 'MARR-04', 16.0, 2.0, 30),
    ('Tangier', 'Centre', 'TANG-01', 14.0, 2.0, 25),
    ('Tangier', 'Malabata', 'TANG-02', 16.0, 2.5, 30),
    ('Fes', 'Medina', 'FES-01', 12.0, 1.5, 20),
    ('Fes', 'Ville Nouvelle', 'FES-02', 14.0, 2.0, 25),
    ('Agadir', 'Centre', 'AGAD-01', 14.0, 2.0, 25),
    ('Agadir', 'Talborjt', 'AGAD-02', 15.0, 2.0, 30),
    ('Meknes', 'Centre', 'MEKN-01', 12.0, 1.5, 20),
    ('Oujda', 'Centre', 'OUJD-01', 12.0, 1.5, 20),
    ('Tetouan', 'Centre', 'TET-01', 13.0, 1.5, 20)
ON CONFLICT (city, zone_name) DO NOTHING;

-- ============================================
-- Migration complete!
-- ============================================
COMMENT ON TABLE delivery_zones IS 'Delivery zones with pricing for different cities';
COMMENT ON TABLE driver_pricing IS 'Driver-specific delivery pricing settings';
COMMENT ON TABLE delivery_tracking IS 'Real-time delivery tracking information';
COMMENT ON TABLE driver_location_history IS 'Historical driver location data (auto-cleaned after 7 days)';
