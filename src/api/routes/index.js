import express from 'express';
import driverRoutes from './driver.routes.js';
import adminDriverRoutes from './admin-drivers.routes.js';

const router = express.Router();

router.use('/driver', driverRoutes);
router.use('/admin/drivers', adminDriverRoutes);

export default router;
