-- =====================================================
-- Migration: Add Notification Triggers
-- Auto-create notifications on order/delivery status changes
-- =====================================================

-- Function to create notifications on order status change
CREATE OR REPLACE FUNCTION public.create_notification_on_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    -- Notify buyer when vendor accepts
    IF NEW.status = 'vendor_accepted' THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.buyer_id,
        'Order Accepted ✅',
        'Your order ' || NEW.order_number || ' has been accepted by the vendor',
        'order',
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number)
      );
    
    -- Notify buyer when vendor rejects
    ELSIF NEW.status = 'vendor_rejected' THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.buyer_id,
        'Order Rejected ❌',
        'Your order ' || NEW.order_number || ' has been rejected',
        'order',
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number)
      );
    
    -- Notify buyer when driver assigned
    ELSIF NEW.status = 'driver_assigned' THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.buyer_id,
        'Driver Assigned 🚚',
        'A driver has been assigned to your order ' || NEW.order_number,
        'order',
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number)
      );
    
    -- Notify buyer and vendor when delivered
    ELSIF NEW.status = 'delivered' THEN
      -- Notify buyer
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.buyer_id,
        'Order Delivered! 🎉',
        'Your order ' || NEW.order_number || ' has been delivered successfully',
        'order',
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number)
      );
      
      -- Notify vendor
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.vendor_id,
        'Order Delivered ✅',
        'Order ' || NEW.order_number || ' has been delivered to the buyer',
        'order',
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number)
      );
    
    -- Notify buyer and vendor when cancelled
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.buyer_id,
        'Order Cancelled',
        'Order ' || NEW.order_number || ' has been cancelled',
        'order',
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number)
      );
      
      INSERT INTO notifications (user_id, title, message, type, data)
      VALUES (
        NEW.vendor_id,
        'Order Cancelled',
        'Order ' || NEW.order_number || ' has been cancelled',
        'order',
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on orders table
DROP TRIGGER IF EXISTS notify_on_order_status_change ON orders;
CREATE TRIGGER notify_on_order_status_change
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_on_order_status_change();

-- Function to create notifications on delivery status change
CREATE OR REPLACE FUNCTION public.create_notification_on_delivery_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    -- Get order info
    DECLARE
      order_info RECORD;
    BEGIN
      SELECT order_number, buyer_id, vendor_id 
      INTO order_info 
      FROM orders 
      WHERE id = NEW.order_id;

      -- Notify vendor when driver accepts
      IF NEW.status = 'accepted' AND NEW.driver_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          order_info.vendor_id,
          'Driver Accepted Delivery',
          'Driver has accepted delivery for order ' || order_info.order_number,
          'order',
          jsonb_build_object('delivery_id', NEW.id, 'order_number', order_info.order_number)
        );
      
      -- Notify buyer when driver picks up
      ELSIF NEW.status = 'picked_up' THEN
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          order_info.buyer_id,
          'Order Picked Up 📦',
          'Your order ' || order_info.order_number || ' has been picked up',
          'order',
          jsonb_build_object('delivery_id', NEW.id, 'order_number', order_info.order_number)
        );
      
      -- Notify buyer when driver is on the way
      ELSIF NEW.status = 'on_the_way' THEN
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          order_info.buyer_id,
          'Driver On The Way! 🚚💨',
          'Your order ' || order_info.order_number || ' is on the way',
          'order',
          jsonb_build_object('delivery_id', NEW.id, 'order_number', order_info.order_number)
        );
      
      -- Notify driver when delivery completed
      ELSIF NEW.status = 'delivered' THEN
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          NEW.driver_id,
          'Delivery Completed ✅',
          'You have successfully delivered order ' || order_info.order_number,
          'order',
          jsonb_build_object('delivery_id', NEW.id, 'order_number', order_info.order_number)
        );
      
      -- Notify buyer and vendor when delivery fails
      ELSIF NEW.status = 'failed' THEN
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          order_info.buyer_id,
          'Delivery Failed ❌',
          'Delivery for order ' || order_info.order_number || ' has failed',
          'order',
          jsonb_build_object('delivery_id', NEW.id, 'order_number', order_info.order_number)
        );
        
        INSERT INTO notifications (user_id, title, message, type, data)
        VALUES (
          order_info.vendor_id,
          'Delivery Failed',
          'Delivery for order ' || order_info.order_number || ' has failed',
          'order',
          jsonb_build_object('delivery_id', NEW.id, 'order_number', order_info.order_number)
        );
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on deliveries table
DROP TRIGGER IF EXISTS notify_on_delivery_status_change ON deliveries;
CREATE TRIGGER notify_on_delivery_status_change
  AFTER UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.create_notification_on_delivery_status_change();
