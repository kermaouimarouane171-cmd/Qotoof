// Driver routes integration
// This file shows how to integrate driver routes into the main Express app

import driverRoutes from './routes/driver.routes.js';
import { verifyAuth, isDriver } from './middleware/auth.js';

export const setupDriverRoutes = (app) => {
  // Mount all driver routes under /api/driver
  app.use('/api/driver', verifyAuth, isDriver, driverRoutes);

  // Additional driver-specific endpoints could be added here
  // For example: notifications, ratings, performance metrics, etc.

  // Driver routes configured
};

/**
 * EXAMPLE: How to add driver routes to your main server file:
 *
 * import { setupDriverRoutes } from './api/driver.integration.js';
 *
 * const app = express();
 *
 * // ... other middleware setup ...
 *
 * // Setup driver routes
 * setupDriverRoutes(app);
 *
 * // ... rest of your app setup ...
 */
