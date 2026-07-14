-- ==========================================================================
-- Migration: Add missing columns to addresses table
--
-- Problem:
--   PGRST204: "Could not find the 'delivery_instructions' column of
--   'addresses' in the schema cache"
--
--   The addresses table was created by legacy migration 030 with a minimal
--   schema. The frontend (Addresses.jsx) sends additional columns that
--   don't exist: delivery_instructions, type, region, postal_code.
--   PostgREST hits the first missing column and returns PGRST204.
--
-- Fix:
--   ALTER TABLE ADD COLUMN IF NOT EXISTS for every column used by
--   Addresses.jsx formData that's missing from the legacy schema.
-- ==========================================================================

BEGIN;

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS type                 TEXT DEFAULT 'home',
  ADD COLUMN IF NOT EXISTS region               TEXT,
  ADD COLUMN IF NOT EXISTS postal_code          TEXT,
  ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;

COMMIT;

NOTIFY pgrst, 'reload schema';
