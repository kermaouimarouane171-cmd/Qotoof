-- ============================================================
-- Migration 027: Driver Assignment Functions & Column Fixes
-- Author: audit 2026-04-15
-- Run in: Supabase SQL Editor
-- ============================================================
-- Fixes:
--  1. Add missing columns to driver_locations (city, region_id,
--     service_radius_km, is_available, last_updated)
--  2. Add missing columns to delivery_requests (buyer_id,
--     pickup_city, delivery_city, distance_km, estimated_hours,
--     driver_region_id, driver_distance_from_pickup_km,
--     base_fee, distance_fee, total_fee, no_driver_available)
--  3. Add missing columns to deliveries (assigned_at)
--  4. Add missing columns to profiles (is_available_for_delivery,
--     current_active_deliveries, max_concurrent_deliveries)
--  5. CREATE FUNCTION find_nearest_drivers
--  6. CREATE FUNCTION check_driver_availability_in_region
--  7. CREATE FUNCTION create_delivery_request
--  8. CREATE FUNCTION find_available_drivers_with_capacity
-- ============================================================

BEGIN;

-- ============================================================
-- 1. DRIVER_LOCATIONS – ADD MISSING COLUMNS
-- ============================================================
-- The client code uses city, region_id, service_radius_km,
-- is_available (distinct from is_online), and last_updated.

ALTER TABLE driver_locations
  ADD COLUMN IF NOT EXISTS city            TEXT,
  ADD COLUMN IF NOT EXISTS region_id       TEXT,
  ADD COLUMN IF NOT EXISTS service_radius_km DECIMAL(6,2) DEFAULT 50.0,
  ADD COLUMN IF NOT EXISTS is_available    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_updated    TIMESTAMPTZ DEFAULT NOW();

-- Keep is_available in sync with is_online via trigger
CREATE OR REPLACE FUNCTION sync_driver_availability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Sync both directions so old and new code both work
  IF TG_OP = 'UPDATE' OR TG_OP = 'INSERT' THEN
    IF NEW.is_available IS DISTINCT FROM OLD.is_available THEN
      NEW.is_online := NEW.is_available;
    ELSIF NEW.is_online IS DISTINCT FROM OLD.is_online THEN
      NEW.is_available := NEW.is_online;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_driver_availability_trigger ON driver_locations;
CREATE TRIGGER sync_driver_availability_trigger
  BEFORE INSERT OR UPDATE ON driver_locations
  FOR EACH ROW EXECUTE FUNCTION sync_driver_availability();

-- Index for spatial driver search (partial — only online drivers)
CREATE INDEX IF NOT EXISTS idx_driver_locations_available_coords
  ON driver_locations(latitude, longitude)
  WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_driver_locations_region
  ON driver_locations(region_id)
  WHERE is_available = true;

-- ============================================================
-- 2. DELIVERY_REQUESTS – ADD MISSING COLUMNS
-- ============================================================
-- The client code inserts buyer_id, city fields, detailed fee
-- breakdown, and flags not in the original schema.

ALTER TABLE delivery_requests
  ADD COLUMN IF NOT EXISTS buyer_id                        UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS pickup_city                     TEXT,
  ADD COLUMN IF NOT EXISTS pickup_lat                      DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS pickup_lng                      DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS delivery_city                   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_lat                    DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS delivery_lng                    DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS distance_km                     DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS estimated_hours                 DECIMAL(6, 2),
  ADD COLUMN IF NOT EXISTS driver_region_id                TEXT,
  ADD COLUMN IF NOT EXISTS driver_distance_from_pickup_km  DECIMAL(8, 2),
  ADD COLUMN IF NOT EXISTS base_fee                        DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS distance_fee                    DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS total_fee                       DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS no_driver_available             BOOLEAN DEFAULT false;

-- ============================================================
-- 3. DELIVERIES – ADD MISSING COLUMNS
-- ============================================================

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- ============================================================
-- 4. PROFILES – ADD DRIVER CAPACITY COLUMNS
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_available_for_delivery    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_active_deliveries    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_concurrent_deliveries    INTEGER DEFAULT 3;

-- ============================================================
-- 5. FUNCTION: find_nearest_drivers
-- ============================================================
-- Used by driverMatching.js to find available drivers sorted by
-- distance using the Haversine formula. Returns tier flags
-- (same_region = ≤30 km, neighboring = ≤150 km).

CREATE OR REPLACE FUNCTION find_nearest_drivers(
  p_pickup_lat      DECIMAL,
  p_pickup_lng      DECIMAL,
  p_max_distance_km DECIMAL  DEFAULT 300,
  p_limit           INTEGER  DEFAULT 10
)
RETURNS TABLE (
  driver_id                   UUID,
  driver_name                 TEXT,
  city                        TEXT,
  region_id                   TEXT,
  distance_km                 DECIMAL,
  estimated_hours             DECIMAL,
  service_radius_km           DECIMAL,
  is_in_same_region           BOOLEAN,
  is_in_neighboring_region    BOOLEAN,
  phone                       TEXT,
  rating                      DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dl.driver_id,
    (p.first_name || ' ' || COALESCE(p.last_name, ''))::TEXT  AS driver_name,
    dl.city,
    dl.region_id,
    -- Haversine formula (km).  GREATEST/LEAST guards acos domain.
    ROUND((
      6371.0 * acos(GREATEST(-1.0, LEAST(1.0,
        cos(radians(p_pickup_lat)) * cos(radians(dl.latitude))
          * cos(radians(dl.longitude) - radians(p_pickup_lng))
        + sin(radians(p_pickup_lat)) * sin(radians(dl.latitude))
      )))
    )::NUMERIC, 2)::DECIMAL  AS distance_km,
    ROUND((
      6371.0 * acos(GREATEST(-1.0, LEAST(1.0,
        cos(radians(p_pickup_lat)) * cos(radians(dl.latitude))
          * cos(radians(dl.longitude) - radians(p_pickup_lng))
        + sin(radians(p_pickup_lat)) * sin(radians(dl.latitude))
      ))) / 60.0
    )::NUMERIC, 2)::DECIMAL  AS estimated_hours,
    COALESCE(dl.service_radius_km, 50.0)::DECIMAL  AS service_radius_km,
    -- Tier flags based on straight-line distance thresholds
    (
      6371.0 * acos(GREATEST(-1.0, LEAST(1.0,
        cos(radians(p_pickup_lat)) * cos(radians(dl.latitude))
          * cos(radians(dl.longitude) - radians(p_pickup_lng))
        + sin(radians(p_pickup_lat)) * sin(radians(dl.latitude))
      ))) <= 30
    )  AS is_in_same_region,
    (
      6371.0 * acos(GREATEST(-1.0, LEAST(1.0,
        cos(radians(p_pickup_lat)) * cos(radians(dl.latitude))
          * cos(radians(dl.longitude) - radians(p_pickup_lng))
        + sin(radians(p_pickup_lat)) * sin(radians(dl.latitude))
      ))) BETWEEN 30 AND 150
    )  AS is_in_neighboring_region,
    p.phone,
    COALESCE(p.rating, 0.0)::DECIMAL  AS rating
  FROM driver_locations dl
  JOIN profiles p ON p.id = dl.driver_id
  WHERE dl.is_available = TRUE
    AND p.role = 'driver'
    AND (
      6371.0 * acos(GREATEST(-1.0, LEAST(1.0,
        cos(radians(p_pickup_lat)) * cos(radians(dl.latitude))
          * cos(radians(dl.longitude) - radians(p_pickup_lng))
        + sin(radians(p_pickup_lat)) * sin(radians(dl.latitude))
      )))
    ) <= p_max_distance_km
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$;

-- ============================================================
-- 6. FUNCTION: check_driver_availability_in_region
-- ============================================================
-- Used by driverMatching.js to get a quick availability summary
-- for a given region_id.

CREATE OR REPLACE FUNCTION check_driver_availability_in_region(
  p_region_id TEXT
)
RETURNS TABLE (
  has_drivers     BOOLEAN,
  available_count INTEGER,
  nearest_city    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_count       INTEGER;
  v_nearest     TEXT;
BEGIN
  SELECT
    COUNT(*)::INTEGER,
    MIN(dl.city)
  INTO v_count, v_nearest
  FROM driver_locations dl
  JOIN profiles p ON p.id = dl.driver_id
  WHERE dl.is_available = TRUE
    AND p.role = 'driver'
    AND (p_region_id IS NULL OR dl.region_id = p_region_id);

  RETURN QUERY SELECT
    (v_count > 0)::BOOLEAN,
    v_count,
    v_nearest;
END;
$$;

-- ============================================================
-- 7. FUNCTION: create_delivery_request
-- ============================================================
-- Creates a delivery_request row, auto-assigns the nearest
-- available driver, and returns full result for the client.

CREATE OR REPLACE FUNCTION create_delivery_request(
  p_order_id      UUID,
  p_vendor_id     UUID,
  p_buyer_id      UUID       DEFAULT NULL,
  p_pickup_city   TEXT       DEFAULT NULL,
  p_pickup_lat    DECIMAL    DEFAULT NULL,
  p_pickup_lng    DECIMAL    DEFAULT NULL,
  p_delivery_city TEXT       DEFAULT NULL,
  p_delivery_lat  DECIMAL    DEFAULT NULL,
  p_delivery_lng  DECIMAL    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_distance_km     DECIMAL;
  v_nearest         RECORD;
  v_is_same_region  BOOLEAN;
  v_base_fee        DECIMAL;
  v_per_km          DECIMAL;
  v_total_fee       DECIMAL;
  v_delivery        RECORD;
BEGIN
  -- Calculate straight-line distance between pickup and delivery
  IF p_pickup_lat IS NOT NULL AND p_delivery_lat IS NOT NULL THEN
    v_distance_km := ROUND((
      6371.0 * acos(GREATEST(-1.0, LEAST(1.0,
        cos(radians(p_pickup_lat)) * cos(radians(p_delivery_lat))
          * cos(radians(p_delivery_lng) - radians(p_pickup_lng))
        + sin(radians(p_pickup_lat)) * sin(radians(p_delivery_lat))
      )))
    )::NUMERIC, 2);
  ELSE
    v_distance_km := 0;
  END IF;

  -- Find the nearest available driver
  SELECT * INTO v_nearest
  FROM find_nearest_drivers(
    p_pickup_lat, p_pickup_lng,
    300, 1
  )
  LIMIT 1;

  v_is_same_region := COALESCE(v_nearest.is_in_same_region, false);

  -- Fee calculation (mirrors driverMatching.calculateDeliveryFee)
  IF v_is_same_region THEN
    IF    v_distance_km <= 30  THEN v_base_fee := 20;  v_per_km := 1.0;
    ELSIF v_distance_km <= 100 THEN v_base_fee := 40;  v_per_km := 1.5;
    ELSE                            v_base_fee := 80;  v_per_km := 2.0;
    END IF;
  ELSE
    IF    v_distance_km <= 100 THEN v_base_fee := 60;  v_per_km := 2.0;
    ELSIF v_distance_km <= 300 THEN v_base_fee := 100; v_per_km := 2.5;
    ELSE                            v_base_fee := 150; v_per_km := 3.0;
    END IF;
  END IF;

  v_total_fee := ROUND((v_base_fee + v_distance_km * v_per_km)::NUMERIC, 2);

  -- Insert delivery request
  INSERT INTO delivery_requests (
    order_id,
    vendor_id,
    buyer_id,
    pickup_city,
    pickup_lat,
    pickup_lng,
    pickup_address,
    delivery_city,
    delivery_lat,
    delivery_lng,
    delivery_address,
    distance_km,
    estimated_hours,
    assigned_driver_id,
    driver_region_id,
    driver_distance_from_pickup_km,
    base_fee,
    distance_fee,
    total_fee,
    no_driver_available,
    status
  )
  VALUES (
    p_order_id,
    p_vendor_id,
    p_buyer_id,
    p_pickup_city,
    p_pickup_lat,
    p_pickup_lng,
    COALESCE(p_pickup_city, ''),   -- pickup_address is NOT NULL in schema
    p_delivery_city,
    p_delivery_lat,
    p_delivery_lng,
    COALESCE(p_delivery_city, ''), -- delivery_address is NOT NULL in schema
    v_distance_km,
    ROUND((v_distance_km / 60.0)::NUMERIC, 2),
    v_nearest.driver_id,
    v_nearest.region_id,
    v_nearest.distance_km,
    v_base_fee,
    ROUND((v_distance_km * v_per_km)::NUMERIC, 2),
    v_total_fee,
    (v_nearest.driver_id IS NULL),
    CASE WHEN v_nearest.driver_id IS NOT NULL THEN 'assigned' ELSE 'pending' END
  )
  RETURNING * INTO v_delivery;

  RETURN jsonb_build_object(
    'success',        TRUE,
    'delivery_id',    v_delivery.id,
    'driver_found',   (v_nearest.driver_id IS NOT NULL),
    'driver',         CASE WHEN v_nearest.driver_id IS NOT NULL THEN
                        jsonb_build_object(
                          'id',          v_nearest.driver_id,
                          'name',        v_nearest.driver_name,
                          'city',        v_nearest.city,
                          'region',      v_nearest.region_id,
                          'distance_km', v_nearest.distance_km
                        )
                      ELSE NULL END,
    'fee',            jsonb_build_object(
                        'base_fee',     v_base_fee,
                        'per_km',       v_per_km,
                        'distance_km',  v_distance_km,
                        'distance_fee', ROUND((v_distance_km * v_per_km)::NUMERIC, 2),
                        'total_fee',    v_total_fee,
                        'currency',     'MAD'
                      ),
    'distance_km',    v_distance_km,
    'estimated_hours', ROUND((v_distance_km / 60.0)::NUMERIC, 2)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', FALSE,
    'error',   SQLERRM
  );
END;
$$;

-- ============================================================
-- 8. FUNCTION: find_available_drivers_with_capacity
-- ============================================================
-- Used by autoDispatch.js to find drivers who are both available
-- AND haven't hit their max concurrent delivery limit.

CREATE OR REPLACE FUNCTION find_available_drivers_with_capacity(
  p_search_latitude  DECIMAL,
  p_search_longitude DECIMAL,
  p_radius_km        DECIMAL  DEFAULT 20,
  p_vehicle_type     TEXT     DEFAULT NULL
)
RETURNS TABLE (
  driver_id          UUID,
  driver_name        TEXT,
  city               TEXT,
  distance_km        DECIMAL,
  current_load       INTEGER,
  max_load           INTEGER,
  available_slots    INTEGER,
  vehicle_type       TEXT,
  rating             DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dl.driver_id,
    (p.first_name || ' ' || COALESCE(p.last_name, ''))::TEXT  AS driver_name,
    dl.city,
    ROUND((
      6371.0 * acos(GREATEST(-1.0, LEAST(1.0,
        cos(radians(p_search_latitude)) * cos(radians(dl.latitude))
          * cos(radians(dl.longitude) - radians(p_search_longitude))
        + sin(radians(p_search_latitude)) * sin(radians(dl.latitude))
      )))
    )::NUMERIC, 2)::DECIMAL                                    AS distance_km,
    COALESCE(p.current_active_deliveries, 0)::INTEGER          AS current_load,
    COALESCE(p.max_concurrent_deliveries, 3)::INTEGER          AS max_load,
    (
      COALESCE(p.max_concurrent_deliveries, 3)
      - COALESCE(p.current_active_deliveries, 0)
    )::INTEGER                                                  AS available_slots,
    COALESCE(p.vehicle_type::TEXT, 'motorcycle')               AS vehicle_type,
    COALESCE(p.rating, 0.0)::DECIMAL                           AS rating
  FROM driver_locations dl
  JOIN profiles p ON p.id = dl.driver_id
  WHERE dl.is_available = TRUE
    AND p.role = 'driver'
    AND COALESCE(p.is_available_for_delivery, false) = TRUE
    AND COALESCE(p.current_active_deliveries, 0) < COALESCE(p.max_concurrent_deliveries, 3)
    AND (p_vehicle_type IS NULL OR p.vehicle_type::TEXT = p_vehicle_type)
    AND (
      6371.0 * acos(GREATEST(-1.0, LEAST(1.0,
        cos(radians(p_search_latitude)) * cos(radians(dl.latitude))
          * cos(radians(dl.longitude) - radians(p_search_longitude))
        + sin(radians(p_search_latitude)) * sin(radians(dl.latitude))
      )))
    ) <= p_radius_km
  ORDER BY distance_km ASC, available_slots DESC, rating DESC;
END;
$$;

-- ============================================================
-- 9. VERIFY ALL FUNCTIONS CREATED
-- ============================================================

DO $$
DECLARE
  fnames TEXT[] := ARRAY[
    'find_nearest_drivers',
    'check_driver_availability_in_region',
    'create_delivery_request',
    'find_available_drivers_with_capacity'
  ];
  fname TEXT;
BEGIN
  FOREACH fname IN ARRAY fnames LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = fname
    ) THEN
      RAISE EXCEPTION 'CRITICAL: function % was not created!', fname;
    END IF;
  END LOOP;
  RAISE NOTICE 'All 4 driver assignment functions verified.';
END;
$$;

COMMIT;

-- ============================================================
-- SUMMARY
-- ============================================================
-- 1. driver_locations: +city, +region_id, +service_radius_km,
--    +is_available, +last_updated, sync trigger, indexes
-- 2. delivery_requests: +buyer_id, +pickup/delivery city/lat/lng,
--    +distance_km, +estimated_hours, +driver_region_id,
--    +driver_distance_from_pickup_km, +base/distance/total_fee,
--    +no_driver_available
-- 3. deliveries: +assigned_at
-- 4. profiles: +is_available_for_delivery, +current_active_deliveries,
--    +max_concurrent_deliveries
-- 5. find_nearest_drivers(lat, lng, max_km, limit)
-- 6. check_driver_availability_in_region(region_id)
-- 7. create_delivery_request(order_id, vendor_id, buyer_id, ...)
-- 8. find_available_drivers_with_capacity(lat, lng, radius_km, vehicle_type)
-- ============================================================
