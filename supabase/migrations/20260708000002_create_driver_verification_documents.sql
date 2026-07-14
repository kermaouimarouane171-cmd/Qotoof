-- ==========================================================================
-- Migration: Create missing driver_verification_documents table
--
-- This table was originally defined in database/driver-enhancements.sql
-- but was never ported to supabase/migrations/, causing 404 errors when
-- AdminDrivers attempts to query it.
-- ==========================================================================

BEGIN;

-- Ensure verification fields on profiles exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS license_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS license_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_expiry_date DATE,
  ADD COLUMN IF NOT EXISTS insurance_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';

-- Create verification documents table
CREATE TABLE IF NOT EXISTS public.driver_verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('driver_license', 'vehicle_insurance', 'vehicle_registration')),
  document_url TEXT NOT NULL,
  document_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_verification_driver ON public.driver_verification_documents(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_verification_status ON public.driver_verification_documents(status);
CREATE INDEX IF NOT EXISTS idx_driver_verification_type ON public.driver_verification_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_driver_verification_expiry ON public.driver_verification_documents(expiry_date);

-- RLS for verification documents
ALTER TABLE public.driver_verification_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers can view own verification documents" ON public.driver_verification_documents;
CREATE POLICY "Drivers can view own verification documents"
  ON public.driver_verification_documents FOR SELECT USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "Drivers can upload verification documents" ON public.driver_verification_documents;
CREATE POLICY "Drivers can upload verification documents"
  ON public.driver_verification_documents FOR INSERT WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all verification documents" ON public.driver_verification_documents;
CREATE POLICY "Admins can view all verification documents"
  ON public.driver_verification_documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admins can update verification documents" ON public.driver_verification_documents;
CREATE POLICY "Admins can update verification documents"
  ON public.driver_verification_documents FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_driver_verification_updated_at ON public.driver_verification_documents;
CREATE TRIGGER update_driver_verification_updated_at
  BEFORE UPDATE ON public.driver_verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if driver is verified
CREATE OR REPLACE FUNCTION public.is_driver_verified(p_driver_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_verified BOOLEAN;
BEGIN
  SELECT
    p.license_verified
    AND p.insurance_verified
    AND p.verification_status = 'verified'
    AND (p.license_expiry_date IS NULL OR p.license_expiry_date > CURRENT_DATE)
    AND (p.insurance_expiry_date IS NULL OR p.insurance_expiry_date > CURRENT_DATE)
  INTO v_verified
  FROM public.profiles p
  WHERE p.id = p_driver_id;

  RETURN COALESCE(v_verified, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grants
GRANT ALL ON public.driver_verification_documents TO postgres;
GRANT SELECT, INSERT, UPDATE ON public.driver_verification_documents TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_driver_verified(UUID) TO authenticated;

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
