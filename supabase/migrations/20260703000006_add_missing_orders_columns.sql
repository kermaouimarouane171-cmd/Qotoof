-- ==========================================================================
-- Migration: Add missing columns to orders table
--
-- Problem:
--   Several columns referenced by frontend code (ordersService.ts, ordersApi.js,
--   OrderDetail.jsx, Receipt.jsx, ReportPreview.jsx, emailService.js) were
--   never added to the orders table in any supabase migration:
--
--   - payment_method TEXT  → error 42703 "column orders.payment_method does not exist"
--   - estimated_delivery_time TIMESTAMPTZ → in legacy driver-enhancements.sql only
--   - return_requested BOOLEAN → in legacy 013-return-requests-table.sql only
--   - commission NUMERIC → in legacy 004-add-bank-accounts.sql only
--   - commission_rate NUMERIC → in legacy 004-add-bank-accounts.sql only
--   - buyer_notes TEXT → in legacy 030-unified-schema.sql only
--   - vendor_notes TEXT → in legacy 030-unified-schema.sql only
--
--   The code at ordersService.ts:400 also selects a `notes` column which doesn't
--   exist in the schema (the table has buyer_notes + vendor_notes). This is a
--   code bug fixed separately.
--
-- Fix:
--   Add all missing columns with ADD COLUMN IF NOT EXISTS (idempotent).
--
-- Values for payment_method: 'cod', 'bank', 'paypal', 'cmi' (from constants/payment.js)
-- ==========================================================================

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method          TEXT,
  ADD COLUMN IF NOT EXISTS estimated_delivery_time  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_requested         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS commission               NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rate          NUMERIC(5, 2) DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS buyer_notes              TEXT,
  ADD COLUMN IF NOT EXISTS vendor_notes             TEXT;

COMMIT;
