-- ============================================
-- Migration: Add missing columns to deliveries table
-- and extend delivery_status enum with 'completed'
--
-- Problem: Frontend code queries columns that don't exist in the
-- deliveries table (distance_km, is_late, driver_rating, deleted_at)
-- and uses 'completed' as a delivery status value that is not in
-- the delivery_status enum.
--
-- This causes 400 errors on all driver pages (History, Earnings,
-- Wallet, Performance, Dashboard).
-- ============================================

-- 1. Add 'completed' to delivery_status enum
ALTER TYPE public.delivery_status ADD VALUE IF NOT EXISTS 'completed';

-- 2. Add missing columns to deliveries table
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS driver_rating INTEGER,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 3. Add index for soft-delete queries
CREATE INDEX IF NOT EXISTS idx_deliveries_deleted_at
  ON public.deliveries(deleted_at)
  WHERE deleted_at IS NOT NULL;
