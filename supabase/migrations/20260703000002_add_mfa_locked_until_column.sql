-- ==========================================================================
-- Migration: Add missing locked_until column to mfa_settings
--
-- Problem: The verify_mfa_code RPC (migration 20260628110000) and the
--          frontend code (authServices.js getSettings) both reference
--          mfa_settings.locked_until, but no migration ever added this
--          column via ALTER TABLE. Migration 20260519000025 added
--          method, last_used_at, failed_attempts but missed locked_until.
--          → error 42703: column mfa_settings.locked_until does not exist
--
-- Fix: Add the column with ADD COLUMN IF NOT EXISTS (idempotent).
-- ==========================================================================

BEGIN;

ALTER TABLE mfa_settings
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

COMMIT;
