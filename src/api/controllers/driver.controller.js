import { AppError } from '../utils/AppError.js';
import { driverService } from '../services/driver.service.js';

export const driverController = {
  async getMetrics(req, res) {
    const driverId = req.user?.id;
    if (!driverId) {
      throw new AppError('Missing authenticated driver context.', 401);
    }

    const metrics = await driverService.getMetrics(driverId);
    res.status(200).json(metrics);
  },

  async getDeliveries(req, res) {
    const driverId = req.user?.id;
    if (!driverId) {
      throw new AppError('Missing authenticated driver context.', 401);
    }

    const deliveries = await driverService.getDeliveries(driverId);
    res.status(200).json(deliveries);
  },

  async getAvailableDeliveries(req, res) {
    const deliveries = await driverService.getAvailableDeliveries();
    res.status(200).json(deliveries);
  },

  async acceptDelivery(req, res) {
    const driverId = req.user?.id;
    const deliveryId = req.params?.id;

    if (!deliveryId) {
      throw new AppError('Delivery id is required.', 400);
    }

    const delivery = await driverService.acceptDelivery(driverId, deliveryId);
    if (!delivery) {
      throw new AppError('Delivery not available.', 400);
    }

    res.status(200).json(delivery);
  },

  async updateDeliveryStatus(req, res) {
    const driverId = req.user?.id;
    const deliveryId = req.params?.id;
    const status = req.body?.status;

    if (!deliveryId) {
      throw new AppError('Delivery id is required.', 400);
    }

    if (!status) {
      throw new AppError('Status is required.', 400);
    }

    const result = await driverService.updateDeliveryStatus(driverId, deliveryId, status);

    if (result.error === 'INVALID_STATUS') {
      throw new AppError('Invalid status.', 400);
    }

    if (result.error === 'NOT_FOUND') {
      throw new AppError('Delivery not found.', 404);
    }

    res.status(200).json(result.data);
  },

  async getStats(req, res) {
    const driverId = req.user?.id;
    if (!driverId) {
      throw new AppError('Missing authenticated driver context.', 401);
    }

    const stats = await driverService.getDriverStats(driverId);
    res.status(200).json(stats);
  },
};
