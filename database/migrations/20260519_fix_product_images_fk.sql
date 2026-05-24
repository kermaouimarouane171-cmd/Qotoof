-- =============================================================================
-- Migration: Fix product_images → products PostgREST Relationship
-- File:      20260519_fix_product_images_fk.sql
-- Date:      2026-05-19
-- Author:    Schema Audit — automated
-- =============================================================================
-- PROBLEM:
--   PostgREST cannot resolve the `products → product_images` relationship,
--   forcing the app to run `runProductImageFallbackQuery` (manual join).
--
--   Root causes identified:
--   A. The FK constraint on product_images.product_id was created without an
--      explicit name (auto-named by Postgres as `product_images_product_id_fkey`).
--      Some PostgREST versions fail to pick up anonymous constraints after
--      schema cache invalidation.
--   B. There is no guarantee that the FK exists at all on freshly seeded
--      databases that ran migrations out of order.
--   C. PostgREST requires the FK to be in the `public` search_path schema and
--      must be visible via `pg_constraint` — a named constraint is safer.
--
-- FIX:
--   1. Drop and re-register the FK with the canonical name
--      `product_images_product_id_fkey` (PostgREST resolves by column name
--      convention: <table>_<col>_fkey).
--   2. Confirm the supporting index exists.
--   3. Issue NOTIFY pgrst to reload the schema cache.
--
-- IDEMPOTENT: Safe to run multiple times.
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1 — Ensure `product_images` table exists with correct schema
-- =============================================================================
CREATE TABLE IF NOT EXISTS product_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  url        TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- STEP 2 — Re-register the FK with the canonical PostgREST-visible name
-- =============================================================================
-- PostgREST resolves relationships through pg_constraint. Dropping and
-- recreating guarantees the constraint is in a clean state.

DO $$
BEGIN
  -- Drop any existing FK (named or anonymous) on this column
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
    WHERE tc.table_name       = 'product_images'
      AND tc.constraint_type  = 'FOREIGN KEY'
      AND kcu.column_name     = 'product_id'
  ) THEN
    -- Retrieve the actual constraint name and drop it
    EXECUTE (
      SELECT 'ALTER TABLE product_images DROP CONSTRAINT ' || quote_ident(tc.constraint_name)
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
      WHERE tc.table_name      = 'product_images'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name    = 'product_id'
      LIMIT 1
    );

    RAISE NOTICE 'Dropped existing FK on product_images.product_id';
  END IF;

  -- Re-add with explicit canonical name
  ALTER TABLE product_images
    ADD CONSTRAINT product_images_product_id_fkey
      FOREIGN KEY (product_id)
      REFERENCES products(id)
      ON DELETE CASCADE;

  RAISE NOTICE 'Re-registered FK product_images_product_id_fkey → products(id)';
END $$;


-- =============================================================================
-- STEP 3 — Ensure supporting index exists (FK columns must be indexed)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON product_images(product_id);


-- =============================================================================
-- STEP 4 — Ensure RLS does NOT block PostgREST relationship traversal
-- =============================================================================
-- PostgREST uses a service-role key internally but the relationship graph
-- is built regardless of RLS. However, SELECT policies need to allow the
-- join direction products → product_images.

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Drop old policies to avoid duplicates
DROP POLICY IF EXISTS "Product images are viewable by everyone" ON product_images;
DROP POLICY IF EXISTS "Vendors can manage own product images"   ON product_images;
DROP POLICY IF EXISTS "product_images_public_select"           ON product_images;
DROP POLICY IF EXISTS "product_images_vendor_all"              ON product_images;

-- Public read (required for PostgREST nested selects from anon/buyer clients)
CREATE POLICY "product_images_public_select"
  ON product_images FOR SELECT
  USING (true);

-- Vendors can insert / update / delete their own product images
CREATE POLICY "product_images_vendor_all"
  ON product_images
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id         = product_images.product_id
        AND products.vendor_id  = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id         = product_images.product_id
        AND products.vendor_id  = auth.uid()
    )
  );


-- =============================================================================
-- STEP 5 — Force PostgREST to reload its schema cache
-- =============================================================================
-- This is the low-latency way to invalidate the in-memory schema graph
-- without restarting the PostgREST process.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =============================================================================
-- VERIFICATION QUERY (run manually to confirm fix)
-- =============================================================================
-- SELECT
--   tc.constraint_name,
--   kcu.column_name,
--   ccu.table_name  AS foreign_table,
--   ccu.column_name AS foreign_column
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON kcu.constraint_name = tc.constraint_name
-- JOIN information_schema.constraint_column_usage ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.table_name      = 'product_images'
--   AND tc.constraint_type = 'FOREIGN KEY';
--
-- Expected: product_images_product_id_fkey | product_id | products | id
-- =============================================================================
