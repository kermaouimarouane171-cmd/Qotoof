-- Fix blocked_ips schema drift
-- Problem: Different migrations have different column definitions
-- Solution: Add missing columns to unify schema
-- Date: 2025-01-20
-- Priority: P1

-- Add missing columns (IF NOT EXISTS ensures idempotency)
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES auth.users(id);
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS block_type TEXT DEFAULT 'manual';
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE blocked_ips ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_blocked_ips_is_active ON blocked_ips(is_active);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_blocked_at ON blocked_ips(blocked_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN blocked_ips.blocked_by IS 'Admin user who blocked this IP';
COMMENT ON COLUMN blocked_ips.block_type IS 'Type of block: manual, automatic, temporary';
COMMENT ON COLUMN blocked_ips.is_active IS 'Whether the block is currently active';
COMMENT ON COLUMN blocked_ips.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN blocked_ips.created_at IS 'Creation timestamp';
