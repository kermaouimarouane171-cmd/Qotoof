import express from 'express';
import { verifyAuth, isDriver } from '../middleware/auth';
import { handleError } from '../utils/errorHandler';

const router = express.Router();

// @GET /api/driver/metrics
// Get driver dashboard metrics
router.get('/metrics', verifyAuth, isDriver, async (req, res) => {
  try {
    const driverId = req.user.id;

    // Get today's earnings
    const todayEarnings = await db
      .query('SELECT SUM(amount) as total FROM deliveries WHERE driver_id = $1 AND DATE(completed_at) = CURRENT_DATE AND status = $2', [
        driverId,
        'completed',
      ])
      .then((r) => r.rows[0]?.total || 0);

    // Get completed today
    const completedToday = await db
      .query(
        'SELECT COUNT(*) as count FROM deliveries WHERE driver_id = $1 AND DATE(completed_at) = CURRENT_DATE AND status = $2',
        [driverId, 'completed']
      )
      .then((r) => r.rows[0]?.count || 0);

    // Get pending deliveries
    const pendingDeliveries = await db
      .query('SELECT COUNT(*) as count FROM deliveries WHERE driver_id = $1 AND status = $2', [driverId, 'pending'])
      .then((r) => r.rows[0]?.count || 0);

    // Get driver rating
    const rating = await db
      .query('SELECT AVG(rating) as avg_rating FROM driver_ratings WHERE driver_id = $1', [driverId])
      .then((r) => r.rows[0]?.avg_rating || 0);

    // Get active delivery
    const activeDelivery = await db
      .query(
        `SELECT id, order_id, pickup_location, delivery_location FROM deliveries 
         WHERE driver_id = $1 AND status = $2 LIMIT 1`,
        [driverId, 'in_progress']
      )
      .then((r) => r.rows[0] || null);

    res.json({
      todayEarnings: parseFloat(todayEarnings),
      completedToday: parseInt(completedToday),
      pendingDeliveries: parseInt(pendingDeliveries),
      rating: parseFloat(rating),
      activeDelivery: activeDelivery
        ? {
            orderId: activeDelivery.order_id,
            pickupLocation: activeDelivery.pickup_location,
            deliveryLocation: activeDelivery.delivery_location,
          }
        : null,
    });
  } catch (error) {
    handleError(error, res);
  }
});

// @GET /api/driver/deliveries
// Get all deliveries for driver
router.get('/deliveries', verifyAuth, isDriver, async (req, res) => {
  try {
    const driverId = req.user.id;
    const deliveries = await db.query(
      `SELECT id, order_id, customer_name, pickup_location, delivery_location, amount, status, created_at
       FROM deliveries WHERE driver_id = $1 ORDER BY created_at DESC`,
      [driverId]
    );
    res.json(deliveries.rows);
  } catch (error) {
    handleError(error, res);
  }
});

// @GET /api/driver/deliveries/available
// Get available deliveries for driver
router.get('/deliveries/available', verifyAuth, isDriver, async (req, res) => {
  try {
    const availableDeliveries = await db.query(
      `SELECT id, address, distance, pay, status FROM available_deliveries 
       WHERE status = 'available' ORDER BY pay DESC LIMIT 20`
    );
    res.json(availableDeliveries.rows);
  } catch (error) {
    handleError(error, res);
  }
});

// @POST /api/driver/deliveries/:id/accept
// Accept a delivery
router.post('/deliveries/:id/accept', verifyAuth, isDriver, async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = req.user.id;

    const result = await db.query(
      `UPDATE deliveries SET driver_id = $1, status = 'assigned' 
       WHERE id = $2 AND status = 'available' RETURNING *`,
      [driverId, id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Delivery not available' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(error, res);
  }
});

// @PATCH /api/driver/deliveries/:id
// Update delivery status
router.patch('/deliveries/:id', verifyAuth, isDriver, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const driverId = req.user.id;

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      `UPDATE deliveries SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND driver_id = $3 RETURNING *`,
      [status, id, driverId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(error, res);
  }
});

// @GET /api/driver/stats
// Get driver statistics
router.get('/stats', verifyAuth, isDriver, async (req, res) => {
  try {
    const driverId = req.user.id;

    const stats = await db.query(
      `SELECT 
        COUNT(*) as total_deliveries,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(amount) as total_earnings,
        AVG(rating) as avg_rating
       FROM deliveries WHERE driver_id = $1`,
      [driverId]
    );

    res.json(stats.rows[0]);
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
