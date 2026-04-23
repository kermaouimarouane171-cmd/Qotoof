-- =====================================================
-- GreenMarket - Seed Data
-- Run this AFTER schema-extended.sql to populate sample data
-- =====================================================

-- Note: First, create test users via Supabase Dashboard → Authentication → Users
-- Or use the signup form in the app

-- Sample Products (you'll need to replace vendor_id with actual user IDs)
-- After creating users, get their IDs and update the vendor_id values below

-- Example: Insert sample products
-- INSERT INTO products (vendor_id, name, description, category, price_per_unit, unit_type, min_order_quantity, available_quantity, is_available)
-- VALUES 
--   ('REPLACE_WITH_VENDOR_ID_1', 'Fresh Organic Tomatoes', 'Premium quality organic tomatoes from Agadir', 'vegetables', 2.50, 'kg', 50, 5000, true),
--   ('REPLACE_WITH_VENDOR_ID_1', 'Red Onions', 'Fresh red onions, perfect for wholesale', 'vegetables', 1.80, 'kg', 100, 8000, true),
--   ('REPLACE_WITH_VENDOR_ID_2', 'Premium Olive Trees', 'High-quality olive trees for nurseries', 'plants', 45.00, 'piece', 10, 500, true),
--   ('REPLACE_WITH_VENDOR_ID_2', 'Palm Trees Date', 'Date palm trees, various sizes', 'plants', 120.00, 'piece', 5, 100, true),
--   ('REPLACE_WITH_VENDOR_ID_3', 'Fresh Oranges Navel', 'Sweet navel oranges from Berkane', 'fruits', 3.20, 'kg', 100, 10000, true),
--   ('REPLACE_WITH_VENDOR_ID_3', 'Lemon Eureka', 'Fresh lemons, perfect for juice', 'fruits', 2.90, 'kg', 75, 6000, true),
--   ('REPLACE_WITH_VENDOR_ID_4', 'Organic Avocados', 'Premium Hass avocados', 'fruits', 8.00, 'kg', 25, 3000, true),
--   ('REPLACE_WITH_VENDOR_ID_4', 'Fresh Carrots', 'Organic carrots, washed and packed', 'vegetables', 1.50, 'kg', 150, 7000, true);

-- Sample product images
-- INSERT INTO product_images (product_id, url, is_primary)
-- VALUES
--   ('PRODUCT_ID_1', 'https://images.unsplash.com/photo-1546470427-e26264c9656a?w=800', true),
--   ('PRODUCT_ID_2', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800', true),
--   ('PRODUCT_ID_3', 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800', true),
--   ('PRODUCT_ID_4', 'https://images.unsplash.com/photo-1580974852861-c381510a1e7c?w=800', true),
--   ('PRODUCT_ID_5', 'https://images.unsplash.com/photo-1547514701-42782101795e?w=800', true),
--   ('PRODUCT_ID_6', 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=800', true),
--   ('PRODUCT_ID_7', 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=800', true),
--   ('PRODUCT_ID_8', 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800', true);

-- =====================================================
-- Quick Setup Instructions:
-- =====================================================
-- 1. Create test users via Supabase Dashboard or app signup:
--    - buyer@demo.com / demo1234 (role: buyer)
--    - vendor@demo.com / demo1234 (role: vendor)
--    - driver@demo.com / demo1234 (role: driver)
--    - admin@demo.com / demo1234 (role: admin)
--
-- 2. Get the vendor user ID from profiles table
--
-- 3. Uncomment and run the INSERT statements above with actual IDs
--
-- 4. Or use the app UI to add products via Vendor Dashboard!
