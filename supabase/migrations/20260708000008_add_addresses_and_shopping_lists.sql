-- ==========================================================================
-- Migration: Add Addresses and Shopping Lists Tables
--
-- Problem: These tables exist in database/migrations but not in supabase/migrations.
-- They are used by buyer pages (Addresses.jsx, ShoppingLists.jsx) but may not
-- exist in production or may have been created manually.
--
-- Solution: Create tables if they don't exist or add missing columns if they do.
-- This migration handles both cases gracefully.
-- ==========================================================================

BEGIN;

-- 1. Create addresses table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'addresses') THEN
    CREATE TABLE public.addresses (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      label TEXT, -- e.g., "Home", "Office", "Warehouse"
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address_line1 TEXT NOT NULL,
      address_line2 TEXT,
      city TEXT NOT NULL,
      state TEXT,
      postal_code TEXT,
      country TEXT DEFAULT 'Morocco',
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      is_default BOOLEAN DEFAULT false,
      is_verified BOOLEAN DEFAULT false,
      delivery_instructions TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 2. Create shopping_lists table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shopping_lists') THEN
    CREATE TABLE public.shopping_lists (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      is_public BOOLEAN DEFAULT false,
      is_shared BOOLEAN DEFAULT false,
      shared_with UUID[], -- Array of user IDs this list is shared with
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 2.5. Add missing columns to shopping_lists if they don't exist
ALTER TABLE public.shopping_lists
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_with UUID[],
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Create shopping_list_items table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shopping_list_items') THEN
    CREATE TABLE public.shopping_list_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      shopping_list_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
      product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
      product_name TEXT, -- Denormalized for display
      quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
      unit_type TEXT,
      notes TEXT,
      is_checked BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(shopping_list_id, product_id)
    );
  END IF;
END $$;

-- 3.5. Add missing columns to shopping_list_items if they don't exist
DO $$
BEGIN
  -- Add columns without NOT NULL constraint first for existing tables
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_list_items' AND column_name = 'shopping_list_id') THEN
    ALTER TABLE public.shopping_list_items ADD COLUMN shopping_list_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_list_items' AND column_name = 'product_id') THEN
    ALTER TABLE public.shopping_list_items ADD COLUMN product_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_list_items' AND column_name = 'product_name') THEN
    ALTER TABLE public.shopping_list_items ADD COLUMN product_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_list_items' AND column_name = 'quantity') THEN
    ALTER TABLE public.shopping_list_items ADD COLUMN quantity DECIMAL(10, 2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_list_items' AND column_name = 'unit_type') THEN
    ALTER TABLE public.shopping_list_items ADD COLUMN unit_type TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_list_items' AND column_name = 'notes') THEN
    ALTER TABLE public.shopping_list_items ADD COLUMN notes TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_list_items' AND column_name = 'is_checked') THEN
    ALTER TABLE public.shopping_list_items ADD COLUMN is_checked BOOLEAN;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_list_items' AND column_name = 'updated_at') THEN
    ALTER TABLE public.shopping_list_items ADD COLUMN updated_at TIMESTAMPTZ;
  END IF;
END $$;

-- 3.6. Add foreign key constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shopping_list_items_shopping_list_id_fkey') THEN
    ALTER TABLE public.shopping_list_items ADD CONSTRAINT shopping_list_items_shopping_list_id_fkey FOREIGN KEY (shopping_list_id) REFERENCES public.shopping_lists(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shopping_list_items_product_id_fkey') THEN
    ALTER TABLE public.shopping_list_items ADD CONSTRAINT shopping_list_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_is_default ON public.addresses(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_addresses_city ON public.addresses(city);
CREATE INDEX IF NOT EXISTS idx_addresses_location ON public.addresses(latitude, longitude) WHERE latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shopping_lists_user_id ON public.shopping_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_is_public ON public.shopping_lists(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_shopping_lists_is_shared ON public.shopping_lists(is_shared) WHERE is_shared = true;

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list_id ON public.shopping_list_items(shopping_list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_product_id ON public.shopping_list_items(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_is_checked ON public.shopping_list_items(shopping_list_id, is_checked);

-- 5. Enable RLS
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

-- 6. Drop existing policies if they exist
DROP POLICY IF EXISTS "addresses_user_select" ON public.addresses;
DROP POLICY IF EXISTS "addresses_user_manage" ON public.addresses;
DROP POLICY IF EXISTS "Users can view own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users can manage own addresses" ON public.addresses;

DROP POLICY IF EXISTS "shopping_lists_user_select" ON public.shopping_lists;
DROP POLICY IF EXISTS "shopping_lists_user_manage" ON public.shopping_lists;
DROP POLICY IF EXISTS "Users can view own shopping lists" ON public.shopping_lists;
DROP POLICY IF EXISTS "Users can manage own shopping lists" ON public.shopping_lists;

DROP POLICY IF EXISTS "shopping_list_items_user_select" ON public.shopping_list_items;
DROP POLICY IF EXISTS "shopping_list_items_user_manage" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Users can view own shopping list items" ON public.shopping_list_items;
DROP POLICY IF EXISTS "Users can manage own shopping list items" ON public.shopping_list_items;

-- 7. Create RLS policies for addresses
CREATE POLICY "addresses_user_select"
  ON public.addresses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "addresses_user_manage"
  ON public.addresses FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 8. Create RLS policies for shopping_lists
CREATE POLICY "shopping_lists_user_select"
  ON public.shopping_lists FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_public = true
    OR is_shared = true AND auth.uid() = ANY(shared_with)
  );

CREATE POLICY "shopping_lists_user_manage"
  ON public.shopping_lists FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 9. Create RLS policies for shopping_list_items
CREATE POLICY "shopping_list_items_user_select"
  ON public.shopping_list_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
        AND (
          shopping_lists.user_id = auth.uid()
          OR shopping_lists.is_public = true
          OR (shopping_lists.is_shared = true AND auth.uid() = ANY(shopping_lists.shared_with))
        )
    )
  );

CREATE POLICY "shopping_list_items_user_manage"
  ON public.shopping_list_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
        AND shopping_lists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shopping_lists
      WHERE shopping_lists.id = shopping_list_items.shopping_list_id
        AND shopping_lists.user_id = auth.uid()
    )
  );

-- 10. Add triggers for updated_at
DROP TRIGGER IF EXISTS update_addresses_updated_at ON public.addresses;
CREATE TRIGGER update_addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shopping_lists_updated_at ON public.shopping_lists;
CREATE TRIGGER update_shopping_lists_updated_at
  BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shopping_list_items_updated_at ON public.shopping_list_items;
CREATE TRIGGER update_shopping_list_items_updated_at
  BEFORE UPDATE ON public.shopping_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Add comments for documentation (only if columns exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'addresses') THEN
    COMMENT ON TABLE public.addresses IS 'User delivery addresses for orders';
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'label') THEN
      COMMENT ON COLUMN public.addresses.label IS 'User-defined label for the address (e.g., "Home", "Office")';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'is_default') THEN
      COMMENT ON COLUMN public.addresses.is_default IS 'Flag indicating this is the user default address';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'is_verified') THEN
      COMMENT ON COLUMN public.addresses.is_verified IS 'Flag indicating the address has been verified';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'addresses' AND column_name = 'delivery_instructions') THEN
      COMMENT ON COLUMN public.addresses.delivery_instructions IS 'Special instructions for delivery to this address';
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shopping_lists') THEN
    COMMENT ON TABLE public.shopping_lists IS 'User shopping lists for saving product combinations';
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_lists' AND column_name = 'is_public') THEN
      COMMENT ON COLUMN public.shopping_lists.is_public IS 'Flag indicating the list is publicly viewable';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_lists' AND column_name = 'is_shared') THEN
      COMMENT ON COLUMN public.shopping_lists.is_shared IS 'Flag indicating the list is shared with other users';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_lists' AND column_name = 'shared_with') THEN
      COMMENT ON COLUMN public.shopping_lists.shared_with IS 'Array of user IDs this list is shared with';
    END IF;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shopping_list_items') THEN
    COMMENT ON TABLE public.shopping_list_items IS 'Items within shopping lists';
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_list_items' AND column_name = 'is_checked') THEN
      COMMENT ON COLUMN public.shopping_list_items.is_checked IS 'Flag indicating the item has been checked off';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_list_items' AND column_name = 'product_name') THEN
      COMMENT ON COLUMN public.shopping_list_items.product_name IS 'Denormalized product name for display';
    END IF;
  END IF;
END $$;

-- 12. Grant permissions
GRANT ALL ON public.addresses TO postgres;
GRANT ALL ON public.shopping_lists TO postgres;
GRANT ALL ON public.shopping_list_items TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_lists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_list_items TO authenticated;

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
