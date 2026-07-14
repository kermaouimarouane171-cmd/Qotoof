BEGIN;

-- Fix ambiguous column reference "product_id" in inventory reservation functions.
-- The output column name in RETURNS TABLE collides with the CTE column name.
-- Aliasing the CTE and qualifying all references resolves the ambiguity.

CREATE OR REPLACE FUNCTION public.reserve_checkout_inventory(p_items JSONB)
RETURNS TABLE(
  product_id UUID,
  reserved_quantity NUMERIC(10, 2),
  remaining_quantity NUMERIC(10, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reservation_item RECORD;
  current_quantity NUMERIC(10, 2);
  next_quantity NUMERIC(10, 2);
  has_items BOOLEAN := FALSE;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'inventory_items_required';
  END IF;

  FOR reservation_item IN
    WITH normalized_items AS (
      SELECT
        NULLIF(TRIM(COALESCE(value->>'productId', value->>'product_id', value->>'id')), '')::UUID AS normalized_product_id,
        NULLIF(TRIM(COALESCE(value->>'quantity', '')), '')::NUMERIC(10, 2) AS normalized_quantity
      FROM jsonb_array_elements(p_items) AS value
    )
    SELECT normalized_product_id, SUM(normalized_quantity)::NUMERIC(10, 2) AS total_quantity
    FROM normalized_items
    WHERE normalized_product_id IS NOT NULL AND normalized_quantity IS NOT NULL AND normalized_quantity > 0
    GROUP BY normalized_product_id
  LOOP
    has_items := TRUE;

    SELECT COALESCE(stock_quantity, available_quantity, 0)
      INTO current_quantity
    FROM public.products
    WHERE id = reservation_item.normalized_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product_not_found:%', reservation_item.normalized_product_id;
    END IF;

    IF current_quantity < reservation_item.total_quantity THEN
      RAISE EXCEPTION 'insufficient_stock:%', reservation_item.normalized_product_id;
    END IF;

    next_quantity := GREATEST(current_quantity - reservation_item.total_quantity, 0);

    UPDATE public.products
    SET stock_quantity = next_quantity,
        available_quantity = next_quantity
    WHERE id = reservation_item.normalized_product_id;

    RETURN QUERY
    SELECT
      reservation_item.normalized_product_id,
      reservation_item.total_quantity,
      next_quantity;
  END LOOP;

  IF NOT has_items THEN
    RAISE EXCEPTION 'inventory_items_invalid';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_checkout_inventory(p_items JSONB)
RETURNS TABLE(
  product_id UUID,
  released_quantity NUMERIC(10, 2),
  available_quantity NUMERIC(10, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  release_item RECORD;
  current_quantity NUMERIC(10, 2);
  next_quantity NUMERIC(10, 2);
  has_items BOOLEAN := FALSE;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'inventory_items_required';
  END IF;

  FOR release_item IN
    WITH normalized_items AS (
      SELECT
        NULLIF(TRIM(COALESCE(value->>'productId', value->>'product_id', value->>'id')), '')::UUID AS normalized_product_id,
        NULLIF(TRIM(COALESCE(value->>'quantity', '')), '')::NUMERIC(10, 2) AS normalized_quantity
      FROM jsonb_array_elements(p_items) AS value
    )
    SELECT normalized_product_id, SUM(normalized_quantity)::NUMERIC(10, 2) AS total_quantity
    FROM normalized_items
    WHERE normalized_product_id IS NOT NULL AND normalized_quantity IS NOT NULL AND normalized_quantity > 0
    GROUP BY normalized_product_id
  LOOP
    has_items := TRUE;

    SELECT COALESCE(stock_quantity, available_quantity, 0)
      INTO current_quantity
    FROM public.products
    WHERE id = release_item.normalized_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product_not_found:%', release_item.normalized_product_id;
    END IF;

    next_quantity := GREATEST(current_quantity + release_item.total_quantity, 0);

    UPDATE public.products
    SET stock_quantity = next_quantity,
        available_quantity = next_quantity
    WHERE id = release_item.normalized_product_id;

    RETURN QUERY
    SELECT
      release_item.normalized_product_id,
      release_item.total_quantity,
      next_quantity;
  END LOOP;

  IF NOT has_items THEN
    RAISE EXCEPTION 'inventory_items_invalid';
  END IF;
END;
$$;

COMMIT;
