CREATE OR REPLACE FUNCTION get_order_view(p_order_id uuid, p_role text DEFAULT 'buyer')
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'order', row_to_json(o),
    'buyer', row_to_json(b),
    'vendor', row_to_json(v),
    'delivery', row_to_json(d),
    'driver', row_to_json(dr),
    'items', (SELECT jsonb_agg(row_to_json(oi)) FROM order_items oi WHERE oi.order_id = o.id),
    'payment', row_to_json(p)
  ) INTO result
  FROM orders o
  LEFT JOIN profiles b ON b.id = o.buyer_id
  LEFT JOIN profiles v ON v.id = o.vendor_id
  LEFT JOIN deliveries d ON d.order_id = o.id
  LEFT JOIN profiles dr ON dr.id = d.driver_id
  LEFT JOIN payments p ON p.order_id = o.id
  WHERE o.id = p_order_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
