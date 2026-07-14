-- ============================================
-- Migration: Add bank account columns to profiles
-- Allows drivers (and vendors) to store bank account details
-- for receiving payouts via bank transfer instead of PayPal.
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_iban TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_swift_code TEXT;
