-- Migration: get_nearby_drivers RPC
-- Purpose: Efficient spatial pre-filter for auto-assign-driver Edge Function.
--          Uses the Haversine formula to find available drivers within a given
--          radius, ordered by distance.  Replaces the broader
--          find_available_drivers_with_capacity RPC when only proximity matters.
--
-- Idempotent: CREATE OR REPLACE

CREATE OR REPLACE FUNCTION get_nearby_drivers(
  p_lat        DOUBLE PRECISION,
  p_lng        DOUBLE PRECISION,
  p_radius_km  DOUBLE PRECISION DEFAULT 30,
  p_limit      INT              DEFAULT 10
)
RETURNS TABLE (
  driver_id       UUID,
  distance_km     DOUBLE PRECISION,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  vehicle_type    TEXT,
  accepted_cargo_sizes TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id                                                        AS driver_id,
    -- Haversine formula (result in km)
    6371.0 * 2 * ASIN(
      SQRT(
        POWER(SIN(RADIANS((p.latitude  - p_lat)  / 2)), 2)
        + COS(RADIANS(p_lat)) * COS(RADIANS(p.latitude))
          * POWER(SIN(RADIANS((p.longitude - p_lng) / 2)), 2)
      )
    )                                                          AS distance_km,
    p.latitude,
    p.longitude,
    p.vehicle_type,
    p.accepted_cargo_sizes
  FROM profiles p
  WHERE
    p.role = 'driver'
    AND p.is_approved = TRUE
    AND p.latitude  IS NOT NULL
    AND p.longitude IS NOT NULL
    -- Bounding box pre-filter to skip the full table scan before Haversine
    AND p.latitude  BETWEEN p_lat - (p_radius_km / 111.0)
                        AND p_lat + (p_radius_km / 111.0)
    AND p.longitude BETWEEN p_lng - (p_radius_km / (111.0 * COS(RADIANS(p_lat))))
                        AND p_lng + (p_radius_km / (111.0 * COS(RADIANS(p_lat))))
    -- Haversine distance check (accurate circle)
    AND 6371.0 * 2 * ASIN(
          SQRT(
            POWER(SIN(RADIANS((p.latitude  - p_lat)  / 2)), 2)
            + COS(RADIANS(p.latitude)) * COS(RADIANS(p_lat))
              * POWER(SIN(RADIANS((p.longitude - p_lng) / 2)), 2)
          )
        ) <= p_radius_km
  ORDER BY distance_km ASC
  LIMIT p_limit;
$$;

-- Support index for the bounding box pre-filter
CREATE INDEX IF NOT EXISTS idx_profiles_driver_location
  ON profiles (latitude, longitude)
  WHERE role = 'driver' AND is_approved = TRUE AND latitude IS NOT NULL AND longitude IS NOT NULL;

GRANT EXECUTE ON FUNCTION get_nearby_drivers(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT)
  TO service_role;
