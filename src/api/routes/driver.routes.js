import express from 'express';
import { verifyAuth, isDriver } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { driverController } from '../controllers/driver.controller.js';

const router = express.Router();

// @GET /api/driver/metrics
// Get driver dashboard metrics
router.get('/metrics', verifyAuth, isDriver, asyncHandler(driverController.getMetrics));

// @GET /api/driver/deliveries
// Get all deliveries for driver
router.get('/deliveries', verifyAuth, isDriver, asyncHandler(driverController.getDeliveries));

// @GET /api/driver/deliveries/available
// Get available deliveries for driver
router.get('/deliveries/available', verifyAuth, isDriver, asyncHandler(driverController.getAvailableDeliveries));

// @POST /api/driver/deliveries/:id/accept
// Accept a delivery
router.post('/deliveries/:id/accept', verifyAuth, isDriver, asyncHandler(driverController.acceptDelivery));

// @PATCH /api/driver/deliveries/:id
// Update delivery status
router.patch('/deliveries/:id', verifyAuth, isDriver, asyncHandler(driverController.updateDeliveryStatus));

// @GET /api/driver/stats
// Get driver statistics
router.get('/stats', verifyAuth, isDriver, asyncHandler(driverController.getStats));

export default router;
