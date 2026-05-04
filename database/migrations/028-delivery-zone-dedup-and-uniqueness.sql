-- ============================================
-- Migration 028: Delivery Zone Dedup & Uniqueness
-- Purpose: Remove legacy duplicate rows before enforcing
--          a unique city/zone key on delivery_zones.
-- ============================================

BEGIN;

WITH ranked_zones AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY city, zone_name
      ORDER BY
        COALESCE(is_active, false) DESC,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS duplicate_rank
  FROM public.delivery_zones
)
DELETE FROM public.delivery_zones
WHERE id IN (
  SELECT id
  FROM ranked_zones
  WHERE duplicate_rank > 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.delivery_zones'::regclass
      AND contype = 'u'
      AND conname = 'delivery_zones_city_zone_name_key'
  ) THEN
    ALTER TABLE public.delivery_zones
      ADD CONSTRAINT delivery_zones_city_zone_name_key UNIQUE (city, zone_name);
  END IF;
END;
$$;

COMMIT;