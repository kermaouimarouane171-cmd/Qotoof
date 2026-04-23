# 🚀 Driver Feature - Quick Reference

## 📋 Component Map

| Component | Purpose | Location |
|-----------|---------|----------|
| **Dashboard** | Main driver page with metrics | `features/driver/components/Dashboard.jsx` |
| **DeliveryTracker** | List & manage deliveries | `features/driver/components/DeliveryTracker.jsx` |
| **DriverProfile** | Edit profile & settings | `features/driver/components/DriverProfile.jsx` |
| **DriverRatingView** | Customer rating form | `features/driver/components/DriverRatingView.jsx` |
| **AdminDriverManagement** | Admin driver management | `features/admin/components/AdminDriverManagement.jsx` |

## 🔌 Quick API Reference

### Driver Endpoints
```bash
# Get metrics
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/driver/metrics

# Get deliveries
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/driver/deliveries

# Accept delivery
curl -X POST -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/driver/deliveries/DELIVERY_ID/accept

# Update delivery status
curl -X PATCH -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}' \
  http://localhost:3000/api/driver/deliveries/DELIVERY_ID
```

### Admin Endpoints
```bash
# List drivers
curl -H "Authorization: Bearer ADMIN_TOKEN" http://localhost:3000/api/admin/drivers

# Suspend driver
curl -X POST -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3000/api/admin/drivers/DRIVER_ID/suspend

# Activate driver
curl -X POST -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3000/api/admin/drivers/DRIVER_ID/activate
```

## 📊 Database Tables

```sql
-- Main tables
drivers              -- Driver profiles
deliveries           -- Delivery records
driver_ratings       -- Customer ratings
available_deliveries -- Available delivery listings
driver_earnings      -- Earnings tracking
```

## 🎣 React Hooks

```javascript
import {
  useDriverMetrics,
  useDeliveries,
  useAvailableDeliveries,
  useAcceptDelivery,
  useUpdateDeliveryStatus,
  useDriverStats,
  useDriverProfile,
  useUpdateDriverProfile,
  useDriverAuth
} from './hooks/useDeliveries'

// Usage
const { data: metrics } = useDriverMetrics()
const acceptMutation = useAcceptDelivery()
```

## ⚙️ Configuration

```javascript
// src/config/driver.config.js
DRIVER_CONFIG = {
  COMMISSION_RATE: 15,                    // %
  MIN_RATING_ALLOWED: 2.0,
  MAX_ACTIVE_DELIVERIES: 3,
  CANCELLATION_PENALTY: 5,                // %
  DELIVERY_TIMEOUT_MINUTES: 120,
}
```

## 🔐 Middleware

```javascript
import { verifyAuth, isDriver, isAdmin } from './middleware/auth'

// Apply to routes
app.use('/api/driver', verifyAuth, isDriver)
app.use('/api/admin', verifyAuth, isAdmin)
```

## 📦 Service Methods

```javascript
import driverService from './services/driver.service'

// Get driver
await driverService.getDriver(driverId)

// Create driver
await driverService.createDriver(userId, profileData)

// Accept delivery
await driverService.acceptDelivery(driverId, deliveryId)

// Update delivery status
await driverService.updateDeliveryStatus(driverId, deliveryId, 'completed')

// Get metrics
await driverService.getDriverMetrics(driverId)

// Calculate earnings
await driverService.calculateEarnings(driverId, startDate, endDate)
```

## 🆚 Status Values

```javascript
// Driver statuses
'active' | 'inactive' | 'on_break' | 'suspended' | 'banned'

// Delivery statuses
'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'delayed'

// Earning statuses
'pending' | 'paid' | 'held' | 'refunded'
```

## 🧪 Testing

```bash
# Run tests
npm test src/features/driver/__tests__/driver.test.js

# With coverage
npm test -- --coverage src/features/driver/

# Watch mode
npm test -- --watch src/features/driver/
```

## 📁 File Imports

```javascript
// Components
import DriverDashboard from './features/driver/components/Dashboard'
import DeliveryTracker from './features/driver/components/DeliveryTracker'
import DriverProfile from './features/driver/components/DriverProfile'

// Hooks
import { useDriverMetrics, useDeliveries } from './features/driver/hooks/useDeliveries'

// Services
import driverService from './services/driver.service'

// Config
import { DRIVER_CONFIG, DELIVERY_STATUSES } from './config/driver.config'

// Middleware
import { verifyAuth, isDriver } from './middleware/auth'
```

## 🚀 Setup Steps

```bash
# 1. Run migrations
npm run migrate -- migrations/create_driver_tables.sql

# 2. Set env variables
echo "DRIVER_COMMISSION_RATE=15" >> .env

# 3. Setup routes in server.js
import { setupDriverRoutes } from './api/driver.integration'
setupDriverRoutes(app)

# 4. Run tests
npm test src/features/driver/

# 5. Start server
npm start
```

## 🎯 Key Flows

### Driver Accepts Delivery
```
1. Driver views available deliveries
2. Clicks accept button
3. System validates:
   - Driver status (not suspended)
   - Rating (meets minimum)
   - Active limits (not exceeded)
4. Delivery assigned to driver
5. Status changes to 'assigned'
```

### Driver Completes Delivery
```
1. Driver updates status to 'in_progress'
2. Customer can track delivery
3. Driver marks 'completed'
4. System records completion time
5. Earnings calculated
6. Customer can rate driver
```

### Admin Manages Driver
```
1. Admin views driver list
2. Can search/filter
3. View statistics
4. Suspend/activate as needed
5. Monitor metrics
```

## 🔍 Debugging Tips

```javascript
// Check driver exists
const driver = await driverService.getDriver(driverId)
console.log('Driver:', driver)

// Check deliveries
const deliveries = await db.query(
  'SELECT * FROM deliveries WHERE driver_id = $1', 
  [driverId]
)

// Check metrics
const metrics = await driverService.getDriverMetrics(driverId)
console.log('Metrics:', metrics)

// Check database connection
await db.query('SELECT NOW()')
```

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| 403 Unauthorized | Check JWT token and user role |
| Driver not found | Verify driver exists in database |
| Can't accept delivery | Check rating, status, active limits |
| Metrics not updating | Check database triggers |
| API 404 | Verify routes mounted correctly |

## 📞 Documentation

- `DRIVER_SETUP_GUIDE.md` - Installation guide
- `DRIVER_FEATURE_DOCUMENTATION.md` - Feature details
- `DRIVER_IMPLEMENTATION_SUMMARY.md` - Technical overview
- `DRIVER_VALIDATION_CHECKLIST.md` - Pre-launch checklist

## 💾 Database Schema Quick View

```sql
-- Drivers table
id (UUID) PK | user_id | phone | license_number | status | rating | created_at

-- Deliveries table
id (UUID) PK | order_id | driver_id | customer_id | status | amount | created_at

-- Driver ratings table
id (UUID) PK | driver_id | delivery_id | rating (1-5) | comment | created_at
```

## 🎓 Example Usage

```javascript
// React component
import { useDriverMetrics, useAcceptDelivery } from './hooks'

export function DeliveryCard({ delivery }) {
  const accept = useAcceptDelivery()
  const { data: metrics } = useDriverMetrics()
  
  return (
    <div>
      <h3>{delivery.address}</h3>
      <p>{delivery.pay} DH</p>
      <button onClick={() => accept.mutate(delivery.id)}>
        Accept Delivery
      </button>
    </div>
  )
}

// Express endpoint
router.get('/metrics', verifyAuth, isDriver, async (req, res) => {
  const metrics = await driverService.getDriverMetrics(req.user.id)
  res.json(metrics)
})
```

## ✅ Verification Steps

```bash
# 1. Verify tables exist
psql -c "SELECT tablename FROM pg_tables WHERE tablename LIKE 'driver%'"

# 2. Verify API endpoints work
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/driver/metrics

# 3. Run tests
npm test src/features/driver/

# 4. Check logs for errors
tail -f logs/error.log
```

---

**Version**: 1.0.0 | **Updated**: 2024 | **Status**: Production Ready ✅
