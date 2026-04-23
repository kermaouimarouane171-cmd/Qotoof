import { db } from '../db';
import { DRIVER_CONFIG, DRIVER_ERRORS, DRIVER_STATUSES, DELIVERY_STATUSES } from '../config/driver.config';

class DriverService {
  /**
   * Get driver profile
   */
  async getDriver(driverId) {
    const result = await db.query('SELECT * FROM drivers WHERE id = $1', [driverId]);
    return result.rows[0];
  }

  /**
   * Get driver with stats
   */
  async getDriverWithStats(driverId) {
    const driver = await this.getDriver(driverId);
    if (!driver) return null;

    const stats = await db.query(
      `SELECT 
        COUNT(*) as total_deliveries,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(amount) as total_earnings
       FROM deliveries WHERE driver_id = $1`,
      [driverId]
    );

    return {
      ...driver,
      stats: stats.rows[0],
    };
  }

  /**
   * Create driver profile
   */
  async createDriver(userId, profileData) {
    const { phone, licenseNumber, vehicleInfo } = profileData;

    if (!phone || !licenseNumber) {
      throw new Error('Phone and license number are required');
    }

    const result = await db.query(
      `INSERT INTO drivers (user_id, phone, license_number, vehicle_info, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, phone, licenseNumber, vehicleInfo, DRIVER_STATUSES.ACTIVE]
    );

    return result.rows[0];
  }

  /**
   * Update driver profile
   */
  async updateDriver(driverId, updates) {
    const { phone, vehicleInfo } = updates;

    const result = await db.query(
      `UPDATE drivers 
       SET phone = COALESCE($1, phone),
           vehicle_info = COALESCE($2, vehicle_info),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [phone, vehicleInfo, driverId]
    );

    if (result.rows.length === 0) {
      throw new Error(DRIVER_ERRORS.DRIVER_NOT_FOUND);
    }

    return result.rows[0];
  }

  /**
   * Accept delivery
   */
  async acceptDelivery(driverId, deliveryId) {
    // Check if driver has right to accept
    const driver = await this.getDriver(driverId);

    if (driver.status === DRIVER_STATUSES.SUSPENDED) {
      throw new Error(DRIVER_ERRORS.SUSPENDED_DRIVER);
    }

    if (driver.rating < DRIVER_CONFIG.MIN_RATING_ALLOWED) {
      throw new Error(DRIVER_ERRORS.INSUFFICIENT_RATING);
    }

    // Check active deliveries limit
    const activeDeliveries = await db.query(
      `SELECT COUNT(*) as count FROM deliveries 
       WHERE driver_id = $1 AND status IN ('assigned', 'in_progress')`,
      [driverId]
    );

    if (activeDeliveries.rows[0].count >= DRIVER_CONFIG.MAX_ACTIVE_DELIVERIES) {
      throw new Error(DRIVER_ERRORS.EXCEEDS_ACTIVE_LIMITS);
    }

    // Accept delivery
    const result = await db.query(
      `UPDATE deliveries SET driver_id = $1, status = $2, updated_at = NOW()
       WHERE id = $3 AND driver_id IS NULL
       RETURNING *`,
      [driverId, DELIVERY_STATUSES.ASSIGNED, deliveryId]
    );

    if (result.rows.length === 0) {
      throw new Error(DRIVER_ERRORS.DELIVERY_ALREADY_ACCEPTED);
    }

    return result.rows[0];
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(driverId, deliveryId, newStatus) {
    const validStatuses = Object.values(DELIVERY_STATUSES);
    if (!validStatuses.includes(newStatus)) {
      throw new Error(DRIVER_ERRORS.INVALID_STATUS);
    }

    const result = await db.query(
      `UPDATE deliveries SET status = $1, updated_at = NOW()
       WHERE id = $2 AND driver_id = $3
       RETURNING *`,
      [newStatus, deliveryId, driverId]
    );

    if (result.rows.length === 0) {
      throw new Error(DRIVER_ERRORS.DELIVERY_NOT_FOUND);
    }

    // If completed, update completed_at
    if (newStatus === DELIVERY_STATUSES.COMPLETED) {
      await db.query(
        `UPDATE deliveries SET completed_at = NOW() 
         WHERE id = $1`,
        [deliveryId]
      );
    }

    return result.rows[0];
  }

  /**
   * Get available deliveries
   */
  async getAvailableDeliveries(limit = 20) {
    const result = await db.query(
      `SELECT id, order_id, address, distance, pay, status 
       FROM available_deliveries 
       WHERE status = 'available'
       ORDER BY pay DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Get driver deliveries
   */
  async getDriverDeliveries(driverId, status = null, limit = 50, offset = 0) {
    let query = `SELECT * FROM deliveries WHERE driver_id = $1`;
    const params = [driverId, limit, offset + 2]; // +2 for limit and offset params

    if (status) {
      query += ` AND status = $${params.length - 1}`;
      params.splice(params.length - 2, 0, status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get driver metrics
   */
  async getDriverMetrics(driverId) {
    const today = new Date().toISOString().split('T')[0];

    const todayMetrics = await db.query(
      `SELECT 
        SUM(amount) as today_earnings,
        COUNT(*) as completed_today
       FROM deliveries 
       WHERE driver_id = $1 
       AND DATE(completed_at) = $2
       AND status = 'completed'`,
      [driverId, today]
    );

    const activeDelivery = await db.query(
      `SELECT id, order_id, pickup_location, delivery_location 
       FROM deliveries 
       WHERE driver_id = $1 AND status = 'in_progress'
       LIMIT 1`,
      [driverId]
    );

    const pending = await db.query(
      `SELECT COUNT(*) as count FROM deliveries 
       WHERE driver_id = $1 AND status = 'pending'`,
      [driverId]
    );

    const driver = await this.getDriver(driverId);

    return {
      todayEarnings: parseFloat(todayMetrics.rows[0]?.today_earnings || 0),
      completedToday: parseInt(todayMetrics.rows[0]?.completed_today || 0),
      pendingDeliveries: parseInt(pending.rows[0]?.count || 0),
      rating: driver?.rating || 0,
      activeDelivery: activeDelivery.rows[0] || null,
    };
  }

  /**
   * Get driver statistics
   */
  async getDriverStats(driverId) {
    const result = await db.query(
      `SELECT 
        COUNT(*) as total_deliveries,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(amount) as total_earnings,
        AVG(rating) as avg_rating
       FROM deliveries WHERE driver_id = $1`,
      [driverId]
    );

    return result.rows[0];
  }

  /**
   * Rate driver
   */
  async rateDriver(driverId, deliveryId, rating, comment = '') {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const result = await db.query(
      `INSERT INTO driver_ratings (driver_id, delivery_id, customer_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [driverId, deliveryId, null, rating, comment]
    );

    return result.rows[0];
  }

  /**
   * Change driver status
   */
  async changeDriverStatus(driverId, newStatus) {
    const validStatuses = Object.values(DRIVER_STATUSES);
    if (!validStatuses.includes(newStatus)) {
      throw new Error(DRIVER_ERRORS.INVALID_STATUS);
    }

    const result = await db.query(
      `UPDATE drivers SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newStatus, driverId]
    );

    if (result.rows.length === 0) {
      throw new Error('Driver not found');
    }

    return result.rows[0];
  }

  /**
   * Suspend driver
   */
  async suspendDriver(driverId, reason = '') {
    return this.changeDriverStatus(driverId, DRIVER_STATUSES.SUSPENDED);
  }

  /**
   * Activate driver
   */
  async activateDriver(driverId) {
    return this.changeDriverStatus(driverId, DRIVER_STATUSES.ACTIVE);
  }

  /**
   * Calculate earnings
   */
  async calculateEarnings(driverId, startDate, endDate) {
    const result = await db.query(
      `SELECT 
        SUM(amount) as total,
        COUNT(*) as deliveries,
        AVG(rating) as avg_rating
       FROM deliveries 
       WHERE driver_id = $1 
       AND completed_at BETWEEN $2 AND $3`,
      [driverId, startDate, endDate]
    );

    const earnings = result.rows[0];
    const commission = (earnings.total || 0) * (DRIVER_CONFIG.COMMISSION_RATE / 100);

    return {
      total: earnings.total || 0,
      deliveries: earnings.deliveries || 0,
      commission,
      netEarnings: (earnings.total || 0) - commission,
      avgRating: earnings.avg_rating || 0,
    };
  }
}

export default new DriverService();
