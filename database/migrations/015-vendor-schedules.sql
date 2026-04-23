-- ============================================
-- Vendor Schedules & Business Hours
-- Creates vendor_schedules table and adds
-- business_hours column to profiles
-- ============================================

-- 1. Add business_hours JSON column to profiles (for quick display)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS business_hours JSONB;

-- 2. Create vendor_schedules table
CREATE TABLE IF NOT EXISTS vendor_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  open_time TIME,
  close_time TIME,
  is_open BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One schedule per vendor per day
  CONSTRAINT unique_vendor_day UNIQUE (vendor_id, day_of_week)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_schedules_vendor ON vendor_schedules(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_schedules_day ON vendor_schedules(day_of_week);

-- 4. RLS Policies
ALTER TABLE vendor_schedules ENABLE ROW LEVEL SECURITY;

-- Everyone can view schedules
DROP POLICY IF EXISTS "Schedules are viewable by everyone" ON vendor_schedules;
CREATE POLICY "Schedules are viewable by everyone"
  ON vendor_schedules FOR SELECT
  TO authenticated
  USING (true);

-- Vendors can manage their own schedules
DROP POLICY IF EXISTS "Vendors can manage own schedules" ON vendor_schedules;
CREATE POLICY "Vendors can manage own schedules"
  ON vendor_schedules FOR ALL
  TO authenticated
  USING (vendor_id = auth.uid())
  WITH CHECK (vendor_id = auth.uid());

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_schedule_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_schedule_updated_at ON vendor_schedules;
CREATE TRIGGER set_schedule_updated_at
  BEFORE UPDATE ON vendor_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_schedule_updated_at();

-- 6. Function to check if vendor is currently open
CREATE OR REPLACE FUNCTION public.is_vendor_open(p_vendor_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_day INTEGER;
  v_current_time TIME;
  v_schedule RECORD;
BEGIN
  -- Get current day of week (0=Sunday in JS, but we store 0=Sunday)
  -- PostgreSQL: EXTRACT(DOW FROM NOW()) returns 0=Sunday
  v_current_day := EXTRACT(DOW FROM NOW())::INTEGER;
  v_current_time := CURRENT_TIME;

  SELECT * INTO v_schedule
  FROM vendor_schedules
  WHERE vendor_id = p_vendor_id
    AND day_of_week = v_current_day;

  -- If no schedule found, assume closed
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- If explicitly closed
  IF NOT v_schedule.is_open THEN
    RETURN false;
  END IF;

  -- Check if current time is within open hours
  IF v_current_time >= v_schedule.open_time AND v_current_time <= v_schedule.close_time THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify success
DO $$
BEGIN
  RAISE NOTICE '✅ Vendor schedules enabled!';
  RAISE NOTICE '   - vendor_schedules table created';
  RAISE NOTICE '   - business_hours JSONB column added to profiles';
  RAISE NOTICE '   - is_vendor_open() function created';
END $$;
