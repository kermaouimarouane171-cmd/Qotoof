import express from 'express';
import { verifyAuth, isAdmin } from '../middleware/auth';
import { handleError } from '../utils/errorHandler';

const router = express.Router();

// @GET /api/admin/drivers
// List all drivers with filters
router.get('/', verifyAuth, isAdmin, async (req, res) => {
  try {
    const { search, status, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM drivers WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex} OR license_number ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status && status !== 'all') {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    handleError(error, res);
  }
});

// @GET /api/admin/drivers/:id
// Get driver details
router.get('/:id', verifyAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await db.query('SELECT * FROM drivers WHERE id = $1', [id]);

    if (driver.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Get driver statistics
    const stats = await db.query(
      `SELECT 
        COUNT(*) as total_deliveries,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(amount) as total_earnings,
        AVG(rating) as avg_rating
       FROM deliveries WHERE driver_id = $1`,
      [id]
    );

    res.json({
      ...driver.rows[0],
      stats: stats.rows[0],
    });
  } catch (error) {
    handleError(error, res);
  }
});

// @POST /api/admin/drivers/:id/suspend
// Suspend a driver
router.post('/:id/suspend', verifyAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('UPDATE drivers SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [
      'suspended',
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(error, res);
  }
});

// @POST /api/admin/drivers/:id/activate
// Activate a driver
router.post('/:id/activate', verifyAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('UPDATE drivers SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [
      'active',
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    handleError(error, res);
  }
});

// @GET /api/admin/drivers-stats
// Overall driver statistics
router.get('/stats/overview', verifyAuth, isAdmin, async (req, res) => {
  try {
    const stats = await db.query(
      `SELECT 
        COUNT(*) as total_drivers,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_drivers,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_drivers,
        AVG(rating) as avg_rating,
        SUM(total_deliveries) as total_deliveries_platform
       FROM drivers`
    );

    res.json(stats.rows[0]);
  } catch (error) {
    handleError(error, res);
  }
});

export default router;
