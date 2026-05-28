-- ============================================================
-- Migration: get_order_view RPC
--
-- Single function to fetch a complete order read model.
-- Replaces 4–5 individual queries in OrderConfirmation.jsx
-- and OrderDetail.jsx.
--
-- Security: SECURITY DEFINER + explicit ownership check ensures
-- only the buyer, vendor, assigned driver, or an admin can read
-- the data — equivalent to the existing .or() RLS filter.
-- ============================================================

CREATE OR REPLACE FUNCTION get_order_view(p_order_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result  JSON;
  v_user_id UUID := auth.uid();
BEGIN
  -- Only buyer, vendor, assigned driver, or admin may view this order
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE id = p_order_id
      AND (
        buyer_id  = v_user_id OR
        vendor_id = v_user_id OR
        driver_id = v_user_id OR
        EXISTS (
          SELECT 1 FROM deliveries
          WHERE order_id = p_order_id
            AND driver_id = v_user_id
        ) OR
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id   = v_user_id
            AND role = 'admin'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'order', row_to_json(o),

    'items', (
      SELECT json_agg(
        json_build_object(
          'id',            oi.id,
          'product_id',    oi.product_id,
          'quantity',      oi.quantity,
          'unit_price',    oi.unit_price,
          'total_price',   oi.total_price,
          'product_name',  p.name,
          'product_image', (
            SELECT url FROM product_images
            WHERE product_id = p.id
            LIMIT 1
          )
        )
      )
      FROM order_items oi
      JOIN products    p  ON p.id = oi.product_id
      WHERE oi.order_id = o.id
    ),

    'payment', (
      SELECT row_to_json(pay)
      FROM payments pay
      WHERE pay.order_id = o.id
      LIMIT 1
    ),

    'buyer', (
      SELECT json_build_object(
        'id',         pr.id,
        'full_name',  pr.full_name,
        'first_name', pr.first_name,
        'last_name',  pr.last_name,
        'phone',      pr.phone,
        'email',      pr.email,
        'avatar_url', pr.avatar_url
      )
      FROM profiles pr WHERE pr.id = o.buyer_id
    ),

    'vendor', (
      SELECT json_build_object(
        'id',         pr.id,
        'full_name',  pr.full_name,
        'first_name', pr.first_name,
        'last_name',  pr.last_name,
        'store_name', COALESCE(s.name, pr.store_name),
        'phone',      pr.phone,
        'email',      pr.email,
        'city',       pr.city,
        'avatar_url', pr.avatar_url,
        'latitude',   pr.latitude,
        'longitude',  pr.longitude
      )
      FROM profiles pr
      LEFT JOIN stores s ON s.vendor_id = pr.id
      WHERE pr.id = o.vendor_id
    ),

    'driver', (
      SELECT json_build_object(
        'id',            pr.id,
        'first_name',    pr.first_name,
        'last_name',     pr.last_name,
        'phone',         pr.phone,
        'avatar_url',    pr.avatar_url,
        'vehicle_type',  pr.vehicle_type,
        'vehicle_plate', pr.vehicle_plate
      )
      FROM profiles pr WHERE pr.id = o.driver_id
    ),

    'delivery', (
      SELECT row_to_json(d)
      FROM deliveries d
      WHERE d.order_id = o.id
      LIMIT 1
    )
  ) INTO v_result
  FROM orders o
  WHERE o.id = p_order_id;

  RETURN v_result;
END;
$$;

-- Allow authenticated users to call this function
GRANT EXECUTE ON FUNCTION get_order_view(UUID) TO authenticated;
