import { db } from '../config/db.js';

const DELIVERY_UPDATE_ALLOWED = ['pending', 'in_progress', 'completed', 'cancelled'];

export const driverService = {
  async getMetrics(driverId) {
    const [todayEarningsResult, completedTodayResult, pendingResult, ratingResult, activeDeliveryResult] = await Promise.all([
      db.query(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM deliveries WHERE driver_id = $1 AND DATE(completed_at) = CURRENT_DATE AND status = $2',
        [driverId, 'completed']
      ),
      db.query(
        'SELECT COUNT(*) AS count FROM deliveries WHERE driver_id = $1 AND DATE(completed_at) = CURRENT_DATE AND status = $2',
        [driverId, 'completed']
      ),
      db.query('SELECT COUNT(*) AS count FROM deliveries WHERE driver_id = $1 AND status = $2', [driverId, 'pending']),
      db.query('SELECT COALESCE(AVG(rating), 0) AS avg_rating FROM driver_ratings WHERE driver_id = $1', [driverId]),
      db.query(
        'SELECT order_id, pickup_location, delivery_location FROM deliveries WHERE driver_id = $1 AND status = $2 LIMIT 1',
        [driverId, 'in_progress']
      ),
    ]);

    const activeDelivery = activeDeliveryResult.rows[0];

    return {
      todayEarnings: parseFloat(todayEarningsResult.rows[0]?.total || 0),
      completedToday: parseInt(completedTodayResult.rows[0]?.count || 0, 10),
      pendingDeliveries: parseInt(pendingResult.rows[0]?.count || 0, 10),
      rating: parseFloat(ratingResult.rows[0]?.avg_rating || 0),
      activeDelivery: activeDelivery
        ? {
            orderId: activeDelivery.order_id,
            pickupLocation: activeDelivery.pickup_location,
            deliveryLocation: activeDelivery.delivery_location,
          }
        : null,
    };
  },

  async getDeliveries(driverId) {
    const result = await db.query(
      `SELECT id, order_id, customer_name, pickup_location, delivery_location, amount, status, created_at
       FROM deliveries
       WHERE driver_id = $1
       ORDER BY created_at DESC`,
      [driverId]
    );

    return result.rows;
  },

  async getAvailableDeliveries() {
    const result = await db.query(
      `SELECT id, address, distance, pay, status
       FROM available_deliveries
       WHERE status = 'available'
       ORDER BY pay DESC
       LIMIT 20`
    );

    return result.rows;
  },

  async acceptDelivery(driverId, deliveryId) {
    const result = await db.query(
      `UPDATE deliveries
       SET driver_id = $1, status = 'assigned'
       WHERE id = $2 AND status = 'available'
       RETURNING *`,
      [driverId, deliveryId]
    );

    return result.rows[0] || null;
  },

  async updateDeliveryStatus(driverId, deliveryId, status) {
    if (!DELIVERY_UPDATE_ALLOWED.includes(status)) {
      return { error: 'INVALID_STATUS' };
    }

    const result = await db.query(
      `UPDATE deliveries
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND driver_id = $3
       RETURNING *`,
      [status, deliveryId, driverId]
    );

    if (!result.rows[0]) {
      return { error: 'NOT_FOUND' };
    }

    return { data: result.rows[0] };
  },

  async getDriverStats(driverId) {
    const result = await db.query(
      `SELECT
        COUNT(*) AS total_deliveries,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
        SUM(amount) AS total_earnings,
        AVG(rating) AS avg_rating
       FROM deliveries
       WHERE driver_id = $1`,
      [driverId]
    );

    return result.rows[0];
  },
};
