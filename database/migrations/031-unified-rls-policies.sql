-- =============================================================================
-- Migration 031: Unified RLS Policies — QOTOOF
-- Date: 2026-06-21
-- Purpose: Single source of truth for all Row Level Security policies.
--          Replaces scattered policies across 27+ migration files.
--
-- Strategy:
--   1. Enable RLS on every table.
--   2. Drop ALL existing policies to avoid conflicts.
--   3. Recreate a clean, minimal, role-based policy set.
--
-- Role model:
--   • buyer    — owns orders, addresses, favorites, etc.
--   • vendor   — owns store, products, coupons, own orders
--   • driver   — owns location, earnings, assigned deliveries
--   • admin    — cross-cutting read/update for moderation
--   • public   — read-only for marketplace data
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. ENABLE RLS ON ALL TABLES
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_availability_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_availability_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_distances ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_cancellation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_delivery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_wait_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_waitlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_monthly_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmed_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_terms_acceptance ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_broadcast_events ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. DROP ALL EXISTING POLICIES (clean slate)
-- =============================================================================
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- =============================================================================
-- 3. PROFILES
-- =============================================================================
CREATE POLICY "profiles_public_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_update" ON profiles FOR UPDATE TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 4. STORES
-- =============================================================================
CREATE POLICY "stores_public_select" ON stores FOR SELECT USING (is_active = true OR owner_id = auth.uid());
CREATE POLICY "stores_vendor_manage" ON stores FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "stores_admin_manage" ON stores FOR ALL TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 5. PRODUCTS
-- =============================================================================
CREATE POLICY "products_public_select" ON products FOR SELECT USING (is_available = true OR vendor_id = auth.uid());
CREATE POLICY "products_vendor_manage" ON products FOR ALL TO authenticated USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());
CREATE POLICY "products_admin_manage" ON products FOR ALL TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 6. PRODUCT IMAGES
-- =============================================================================
CREATE POLICY "product_images_public_select" ON product_images FOR SELECT USING (true);
CREATE POLICY "product_images_vendor_manage" ON product_images FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_images.product_id AND products.vendor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM products WHERE products.id = product_images.product_id AND products.vendor_id = auth.uid()));

-- =============================================================================
-- 7. ORDERS
-- =============================================================================
CREATE POLICY "orders_participants_select" ON orders FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR vendor_id = auth.uid() OR auth_is_admin());
CREATE POLICY "orders_buyer_insert" ON orders FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "orders_vendor_update" ON orders FOR UPDATE TO authenticated
  USING (vendor_id = auth.uid() OR auth_is_admin())
  WITH CHECK (vendor_id = auth.uid() OR auth_is_admin());
CREATE POLICY "orders_admin_all" ON orders FOR ALL TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 8. ORDER ITEMS
-- =============================================================================
CREATE POLICY "order_items_participants_select" ON order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid() OR auth_is_admin())));
CREATE POLICY "order_items_buyer_insert" ON order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.buyer_id = auth.uid()));

-- =============================================================================
-- 9. DELIVERIES
-- =============================================================================
CREATE POLICY "deliveries_participants_select" ON deliveries FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid()
    OR EXISTS (SELECT 1 FROM orders WHERE orders.id = deliveries.order_id AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid() OR auth_is_admin()))
  );
CREATE POLICY "deliveries_system_insert" ON deliveries FOR INSERT WITH CHECK (true);
CREATE POLICY "deliveries_driver_update" ON deliveries FOR UPDATE TO authenticated
  USING (driver_id = auth.uid() OR auth_is_admin())
  WITH CHECK (driver_id = auth.uid() OR auth_is_admin());
CREATE POLICY "deliveries_vendor_assign" ON deliveries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = deliveries.order_id AND orders.vendor_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = deliveries.order_id AND orders.vendor_id = auth.uid()));

-- =============================================================================
-- 10. REVIEWS
-- =============================================================================
CREATE POLICY "reviews_public_select" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_buyer_insert" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "reviews_buyer_update" ON reviews FOR UPDATE TO authenticated USING (auth.uid() = buyer_id);

-- =============================================================================
-- 11. DRIVER REVIEWS
-- =============================================================================
CREATE POLICY "driver_reviews_public_select" ON driver_reviews FOR SELECT USING (true);
CREATE POLICY "driver_reviews_buyer_insert" ON driver_reviews FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid());

-- =============================================================================
-- 12. NOTIFICATIONS
-- =============================================================================
CREATE POLICY "notifications_user_select" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_system_insert" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_user_update" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- =============================================================================
-- 13. VENDOR DOCUMENTS
-- =============================================================================
CREATE POLICY "vendor_documents_user_select" ON vendor_documents FOR SELECT TO authenticated USING (vendor_id = auth.uid());
CREATE POLICY "vendor_documents_user_insert" ON vendor_documents FOR INSERT TO authenticated WITH CHECK (vendor_id = auth.uid());
CREATE POLICY "vendor_documents_admin_manage" ON vendor_documents FOR ALL TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 14. FAVORITES
-- =============================================================================
CREATE POLICY "favorites_user_select" ON favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "favorites_user_manage" ON favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 15. MESSAGES & CONVERSATIONS
-- =============================================================================
CREATE POLICY "messages_user_select" ON messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );
CREATE POLICY "messages_user_insert" ON messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

CREATE POLICY "conversations_user_select" ON conversations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()));
CREATE POLICY "conversations_user_insert" ON conversations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "conversation_participants_user_select" ON conversation_participants FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM conversation_participants cp2 WHERE cp2.conversation_id = conversation_participants.conversation_id AND cp2.user_id = auth.uid())
  );
CREATE POLICY "conversation_participants_user_insert" ON conversation_participants FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 16. DELIVERY ZONES
-- =============================================================================
CREATE POLICY "delivery_zones_public_select" ON delivery_zones FOR SELECT USING (is_active = true);
CREATE POLICY "delivery_zones_admin_manage" ON delivery_zones FOR ALL TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 17. DRIVER PRICING
-- =============================================================================
CREATE POLICY "driver_pricing_public_select" ON driver_pricing FOR SELECT USING (true);
CREATE POLICY "driver_pricing_driver_manage" ON driver_pricing FOR ALL TO authenticated USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());

-- =============================================================================
-- 18. DELIVERY TRACKING
-- =============================================================================
CREATE POLICY "delivery_tracking_user_select" ON delivery_tracking FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.id = delivery_tracking.delivery_id
      AND (EXISTS (SELECT 1 FROM orders o WHERE o.id = d.order_id AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid())))
  ));
CREATE POLICY "delivery_tracking_driver_insert" ON delivery_tracking FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid());

-- =============================================================================
-- 19. TIER PRICING
-- =============================================================================
CREATE POLICY "tier_pricing_public_select" ON tier_pricing FOR SELECT USING (is_active = true);
CREATE POLICY "tier_pricing_vendor_manage" ON tier_pricing FOR ALL TO authenticated USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());

-- =============================================================================
-- 20. DRIVER LOCATIONS
-- =============================================================================
CREATE POLICY "driver_locations_public_select" ON driver_locations FOR SELECT USING (is_online = true);
CREATE POLICY "driver_locations_driver_manage" ON driver_locations FOR ALL TO authenticated USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());

-- =============================================================================
-- 21. DELIVERY REQUESTS
-- =============================================================================
CREATE POLICY "delivery_requests_user_select" ON delivery_requests FOR SELECT TO authenticated
  USING (vendor_id = auth.uid() OR assigned_driver_id = auth.uid() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()));
CREATE POLICY "delivery_requests_vendor_insert" ON delivery_requests FOR INSERT TO authenticated WITH CHECK (vendor_id = auth.uid());
CREATE POLICY "delivery_requests_vendor_update" ON delivery_requests FOR UPDATE TO authenticated USING (vendor_id = auth.uid());
CREATE POLICY "delivery_requests_driver_update" ON delivery_requests FOR UPDATE TO authenticated USING (assigned_driver_id = auth.uid());

-- =============================================================================
-- 22. ORDER TIMELINE
-- =============================================================================
CREATE POLICY "order_timeline_user_select" ON order_timeline FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_timeline.order_id AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid() OR auth_is_admin())));
CREATE POLICY "order_timeline_system_insert" ON order_timeline FOR INSERT WITH CHECK (true);

-- =============================================================================
-- 23. VERIFICATION DOCUMENTS
-- =============================================================================
CREATE POLICY "verification_documents_user_select" ON verification_documents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "verification_documents_user_insert" ON verification_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "verification_documents_user_update" ON verification_documents FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "verification_documents_admin_manage" ON verification_documents FOR ALL TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 24. USER REPORTS
-- =============================================================================
CREATE POLICY "user_reports_user_select" ON user_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR auth_is_admin());
CREATE POLICY "user_reports_user_insert" ON user_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "user_reports_admin_update" ON user_reports FOR UPDATE TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 25. DELIVERY CHECKLIST
-- =============================================================================
CREATE POLICY "delivery_checklist_user_select" ON delivery_checklist FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.id = delivery_checklist.delivery_id
      AND (d.driver_id = auth.uid() OR EXISTS (
        SELECT 1 FROM orders o WHERE o.id = d.order_id AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid())
      ))
  ));
CREATE POLICY "delivery_checklist_driver_update" ON delivery_checklist FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM deliveries d WHERE d.id = delivery_checklist.delivery_id AND d.driver_id = auth.uid()));

-- =============================================================================
-- 26. PAYMENTS
-- =============================================================================
CREATE POLICY "payments_participants_select" ON payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id AND (orders.buyer_id = auth.uid() OR orders.vendor_id = auth.uid() OR auth_is_admin())));
CREATE POLICY "payments_system_insert" ON payments FOR INSERT WITH CHECK (true);
CREATE POLICY "payments_admin_update" ON payments FOR UPDATE TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 27. ADDRESSES
-- =============================================================================
CREATE POLICY "addresses_user_select" ON addresses FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "addresses_user_manage" ON addresses FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 28. COUPONS
-- =============================================================================
CREATE POLICY "coupons_public_select" ON coupons FOR SELECT USING (true);
CREATE POLICY "coupons_vendor_manage" ON coupons FOR ALL TO authenticated USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());
CREATE POLICY "coupons_admin_manage" ON coupons FOR ALL TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 29. RETURNS & RETURN REQUESTS
-- =============================================================================
CREATE POLICY "returns_participants_select" ON returns FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR vendor_id = auth.uid());
CREATE POLICY "returns_buyer_insert" ON returns FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "returns_vendor_update" ON returns FOR UPDATE TO authenticated USING (vendor_id = auth.uid());

CREATE POLICY "return_requests_participants_select" ON return_requests FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR vendor_id = auth.uid());
CREATE POLICY "return_requests_buyer_insert" ON return_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "return_requests_vendor_update" ON return_requests FOR UPDATE TO authenticated USING (vendor_id = auth.uid());

-- =============================================================================
-- 30. BANK ACCOUNTS
-- =============================================================================
CREATE POLICY "bank_accounts_user_select" ON bank_accounts FOR SELECT TO authenticated USING (vendor_id = auth.uid());
CREATE POLICY "bank_accounts_user_manage" ON bank_accounts FOR ALL TO authenticated USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());

-- =============================================================================
-- 31. VENDOR SCHEDULES
-- =============================================================================
CREATE POLICY "vendor_schedules_public_select" ON vendor_schedules FOR SELECT USING (true);
CREATE POLICY "vendor_schedules_vendor_manage" ON vendor_schedules FOR ALL TO authenticated USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());

-- =============================================================================
-- 32. STOCK HISTORY
-- =============================================================================
CREATE POLICY "stock_history_vendor_select" ON stock_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM products WHERE products.id = stock_history.product_id AND products.vendor_id = auth.uid()));

-- =============================================================================
-- 33. AUDIT & SECURITY
-- =============================================================================
CREATE POLICY "audit_logs_user_select" ON audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth_is_admin());
CREATE POLICY "audit_logs_system_insert" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_logs_admin_select" ON audit_logs FOR SELECT TO authenticated USING (auth_is_admin());

CREATE POLICY "security_alerts_user_select" ON security_alerts FOR SELECT TO authenticated USING (user_id = auth.uid() OR auth_is_admin());
CREATE POLICY "security_alerts_system_insert" ON security_alerts FOR INSERT WITH CHECK (true);

CREATE POLICY "blocked_ips_admin_select" ON blocked_ips FOR SELECT TO authenticated USING (auth_is_admin());
CREATE POLICY "blocked_ips_system_insert" ON blocked_ips FOR INSERT WITH CHECK (true);

CREATE POLICY "rate_limits_system_select" ON rate_limits FOR SELECT USING (true);
CREATE POLICY "rate_limits_system_insert" ON rate_limits FOR INSERT WITH CHECK (true);

-- =============================================================================
-- 34. PRODUCT REVIEWS
-- =============================================================================
CREATE POLICY "product_reviews_public_select" ON product_reviews FOR SELECT USING (true);
CREATE POLICY "product_reviews_buyer_insert" ON product_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "product_reviews_buyer_update" ON product_reviews FOR UPDATE TO authenticated USING (auth.uid() = buyer_id);

-- =============================================================================
-- 35. SUPPORT TICKETS
-- =============================================================================
CREATE POLICY "support_tickets_user_select" ON support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid() OR auth_is_admin());
CREATE POLICY "support_tickets_user_insert" ON support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "support_tickets_admin_update" ON support_tickets FOR UPDATE TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 36. COMPARISON LISTS
-- =============================================================================
CREATE POLICY "comparison_lists_user_select" ON comparison_lists FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "comparison_lists_user_manage" ON comparison_lists FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 37. CONTACT MESSAGES
-- =============================================================================
CREATE POLICY "contact_messages_public_insert" ON contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "contact_messages_admin_select" ON contact_messages FOR SELECT TO authenticated USING (auth_is_admin());
CREATE POLICY "contact_messages_admin_update" ON contact_messages FOR UPDATE TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 38. COUPON REDEMPTIONS
-- =============================================================================
CREATE POLICY "coupon_redemptions_user_select" ON coupon_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "coupon_redemptions_user_insert" ON coupon_redemptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 39. DRIVER AVAILABILITY
-- =============================================================================
CREATE POLICY "driver_availability_log_driver_select" ON driver_availability_log FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "driver_availability_log_driver_insert" ON driver_availability_log FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid());
CREATE POLICY "driver_availability_requests_driver_select" ON driver_availability_requests FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "driver_availability_requests_driver_insert" ON driver_availability_requests FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid());

-- =============================================================================
-- 40. DRIVER VERIFICATION & EARNINGS
-- =============================================================================
CREATE POLICY "driver_verification_documents_driver_select" ON driver_verification_documents FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "driver_verification_documents_driver_insert" ON driver_verification_documents FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid());
CREATE POLICY "driver_verification_documents_admin_manage" ON driver_verification_documents FOR ALL TO authenticated USING (auth_is_admin());

CREATE POLICY "driver_earnings_driver_select" ON driver_earnings FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "driver_earnings_admin_select" ON driver_earnings FOR SELECT TO authenticated USING (auth_is_admin());
CREATE POLICY "driver_earnings_system_insert" ON driver_earnings FOR INSERT WITH CHECK (true);
CREATE POLICY "driver_earnings_admin_update" ON driver_earnings FOR UPDATE TO authenticated USING (auth_is_admin());

-- =============================================================================
-- 41. FINANCIAL AUDIT
-- =============================================================================
CREATE POLICY "financial_audit_log_admin_select" ON financial_audit_log FOR SELECT TO authenticated USING (auth_is_admin());
CREATE POLICY "financial_audit_log_system_insert" ON financial_audit_log FOR INSERT WITH CHECK (true);

-- =============================================================================
-- 42. LOYALTY
-- =============================================================================
CREATE POLICY "loyalty_points_user_select" ON loyalty_points FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "loyalty_points_system_insert" ON loyalty_points FOR INSERT WITH CHECK (true);
CREATE POLICY "loyalty_points_system_update" ON loyalty_points FOR UPDATE TO authenticated USING (auth_is_admin());
CREATE POLICY "loyalty_transactions_user_select" ON loyalty_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "loyalty_transactions_system_insert" ON loyalty_transactions FOR INSERT WITH CHECK (true);

-- =============================================================================
-- 43. PLATFORM SETTINGS
-- =============================================================================
CREATE POLICY "platform_settings_public_select" ON platform_settings FOR SELECT USING (true);
CREATE POLICY "platform_settings_admin_update" ON platform_settings FOR UPDATE TO authenticated USING (auth_is_admin());
CREATE POLICY "platform_settings_admin_insert" ON platform_settings FOR INSERT TO authenticated WITH CHECK (auth_is_admin());

-- =============================================================================
-- 44. SETTINGS AUDIT
-- =============================================================================
CREATE POLICY "settings_audit_log_admin_select" ON settings_audit_log FOR SELECT TO authenticated USING (auth_is_admin());
CREATE POLICY "settings_audit_log_system_insert" ON settings_audit_log FOR INSERT WITH CHECK (true);

-- =============================================================================
-- 45. SHOPPING LISTS
-- =============================================================================
CREATE POLICY "shopping_lists_user_select" ON shopping_lists FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "shopping_lists_user_manage" ON shopping_lists FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "shopping_list_items_user_select" ON shopping_list_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM shopping_lists WHERE shopping_lists.id = shopping_list_items.shopping_list_id AND shopping_lists.user_id = auth.uid()));
CREATE POLICY "shopping_list_items_user_manage" ON shopping_list_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM shopping_lists WHERE shopping_lists.id = shopping_list_items.shopping_list_id AND shopping_lists.user_id = auth.uid()));

-- =============================================================================
-- 46. STORE FOLLOWS
-- =============================================================================
CREATE POLICY "store_follows_user_select" ON store_follows FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "store_follows_user_manage" ON store_follows FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 47. USER SETTINGS
-- =============================================================================
CREATE POLICY "user_settings_user_select" ON user_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_settings_user_manage" ON user_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 48. ADDITIONAL TABLES
-- =============================================================================
CREATE POLICY "carts_user_manage" ON carts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "cart_items_user_select" ON cart_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()));
CREATE POLICY "cart_items_user_manage" ON cart_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()));

CREATE POLICY "checkout_requests_user_manage" ON checkout_requests FOR ALL TO authenticated
  USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "regions_public_select" ON regions FOR SELECT USING (true);
CREATE POLICY "city_distances_public_select" ON city_distances FOR SELECT USING (true);

CREATE POLICY "vendor_cancellation_policies_public_select" ON vendor_cancellation_policies FOR SELECT USING (true);
CREATE POLICY "vendor_cancellation_policies_vendor_manage" ON vendor_cancellation_policies FOR ALL TO authenticated
  USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "vendor_delivery_slots_public_select" ON vendor_delivery_slots FOR SELECT USING (is_active = true);
CREATE POLICY "vendor_delivery_slots_vendor_manage" ON vendor_delivery_slots FOR ALL TO authenticated
  USING (vendor_id = auth.uid()) WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "vendor_wait_responses_participants_select" ON vendor_wait_responses FOR SELECT TO authenticated
  USING (vendor_id = auth.uid() OR buyer_id = auth.uid());
CREATE POLICY "vendor_wait_responses_vendor_insert" ON vendor_wait_responses FOR INSERT TO authenticated WITH CHECK (vendor_id = auth.uid());

CREATE POLICY "vendor_contracts_vendor_select" ON vendor_contracts FOR SELECT TO authenticated USING (vendor_id = auth.uid());
CREATE POLICY "vendor_contracts_admin_manage" ON vendor_contracts FOR ALL TO authenticated USING (auth_is_admin());

CREATE POLICY "product_waitlists_user_manage" ON product_waitlists FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "product_waitlists_vendor_select" ON product_waitlists FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM products WHERE products.id = product_waitlists.product_id AND products.vendor_id = auth.uid()));

CREATE POLICY "notification_preferences_user_manage" ON notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "loyalty_rewards_public_select" ON loyalty_rewards FOR SELECT USING (is_active = true);
CREATE POLICY "loyalty_rewards_admin_manage" ON loyalty_rewards FOR ALL TO authenticated USING (auth_is_admin());

CREATE POLICY "referrals_user_select" ON referrals FOR SELECT TO authenticated USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());
CREATE POLICY "referrals_user_insert" ON referrals FOR INSERT TO authenticated WITH CHECK (referrer_id = auth.uid());

CREATE POLICY "invoices_participants_select" ON invoices FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR vendor_id = auth.uid() OR auth_is_admin());
CREATE POLICY "invoices_system_insert" ON invoices FOR INSERT WITH CHECK (true);

CREATE POLICY "payment_methods_public_select" ON payment_methods FOR SELECT USING (is_active = true);
CREATE POLICY "payment_methods_admin_manage" ON payment_methods FOR ALL TO authenticated USING (auth_is_admin());

CREATE POLICY "user_payment_methods_user_manage" ON user_payment_methods FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "platform_commissions_admin_select" ON platform_commissions FOR SELECT TO authenticated USING (auth_is_admin());
CREATE POLICY "platform_commissions_system_insert" ON platform_commissions FOR INSERT WITH CHECK (true);

CREATE POLICY "vendor_monthly_sales_vendor_select" ON vendor_monthly_sales FOR SELECT TO authenticated
  USING (vendor_id = auth.uid() OR auth_is_admin());
CREATE POLICY "vendor_monthly_sales_system_insert" ON vendor_monthly_sales FOR INSERT WITH CHECK (true);

CREATE POLICY "confirmed_transactions_admin_select" ON confirmed_transactions FOR SELECT TO authenticated USING (auth_is_admin());
CREATE POLICY "commission_notifications_vendor_select" ON commission_notifications FOR SELECT TO authenticated
  USING (vendor_id = auth.uid() OR auth_is_admin());
CREATE POLICY "commission_notifications_system_insert" ON commission_notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "cancellation_log_participants_select" ON cancellation_log FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR vendor_id = auth.uid() OR auth_is_admin());
CREATE POLICY "cancellation_log_system_insert" ON cancellation_log FOR INSERT WITH CHECK (true);

CREATE POLICY "payment_disputes_participants_select" ON payment_disputes FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR vendor_id = auth.uid() OR auth_is_admin());
CREATE POLICY "payment_disputes_buyer_insert" ON payment_disputes FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "payment_disputes_admin_update" ON payment_disputes FOR UPDATE TO authenticated USING (auth_is_admin());

CREATE POLICY "payment_terms_acceptance_user_select" ON payment_terms_acceptance FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "payment_terms_acceptance_user_insert" ON payment_terms_acceptance FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "driver_broadcast_events_driver_select" ON driver_broadcast_events FOR SELECT TO authenticated
  USING (driver_id = auth.uid() OR EXISTS (SELECT 1 FROM deliveries d WHERE d.id = driver_broadcast_events.delivery_id AND (d.driver_id = auth.uid() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = d.order_id AND (o.buyer_id = auth.uid() OR o.vendor_id = auth.uid())))));
CREATE POLICY "driver_broadcast_events_driver_insert" ON driver_broadcast_events FOR INSERT TO authenticated WITH CHECK (driver_id = auth.uid());

-- =============================================================================
-- 49. STORAGE POLICIES
-- =============================================================================
DROP POLICY IF EXISTS "storage_public_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_owner_delete" ON storage.objects;

CREATE POLICY "storage_public_select" ON storage.objects FOR SELECT
  USING (bucket_id IN ('product-images', 'return-images', 'profile-photos', 'store-logos', 'avatars', 'delivery-proofs', 'signatures', 'vehicle-photos'));

CREATE POLICY "storage_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner);

CREATE POLICY "storage_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (auth.uid() = owner);

CREATE POLICY "storage_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (auth.uid() = owner);

-- =============================================================================
-- 49. VERIFICATION
-- =============================================================================
-- Verification is performed by migration 033-verify-schema.sql
-- to avoid false negatives caused by in-transaction catalog visibility.

COMMIT;
