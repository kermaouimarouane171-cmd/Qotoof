# Driver Feature Setup Guide

## Quick Start

### 1. Database Setup
Run the migration to create all driver-related tables:

```bash
npm run migrate -- migrations/create_driver_tables.sql
```

This creates:
- `drivers` - Driver profiles and information
- `deliveries` - Delivery tracking
- `driver_ratings` - Customer ratings for drivers
- `available_deliveries` - Available delivery listings
- `driver_earnings` - Earnings tracking and commission calculations

### 2. Backend Integration

Add driver routes to your Express server:

```javascript
// src/server.js
import { setupDriverRoutes } from './api/driver.integration.js';
import adminDriverRoutes from './api/routes/admin-drivers.routes.js';

const app = express();

// Setup authentication middleware
app.use('/api', verifyAuth);

// Setup driver routes (requires driver role)
setupDriverRoutes(app);

// Setup admin driver management
app.use('/api/admin/drivers', isAdmin, adminDriverRoutes);
```

### 3. Environment Configuration

Add to your `.env` file:

```env
# Driver Feature Settings
DRIVER_COMMISSION_RATE=15
DRIVER_MIN_RATING=2.0
DRIVER_MAX_ACTIVE_DELIVERIES=3
DELIVERY_CANCELLATION_PENALTY=5
```

### 4. Frontend Setup

Import driver components in your routing configuration:

```javascript
// src/router.jsx
import DriverHome from './features/driver/pages/DriverHome';
import { useDriverAuth } from './features/driver/hooks/useDeliveries';

// Add to your routes
{
  path: '/driver',
  element: <ProtectedRoute element={<DriverHome />} requiredRole="driver" />
}
```

### 5. Update User Registration

When a user registers as a driver, create a driver profile:

```javascript
import { db } from './db';

export async function createDriver(userId, profileData) {
  const driver = await db.query(
    `INSERT INTO drivers (user_id, phone, license_number, vehicle_info)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, profileData.phone, profileData.licenseNumber, profileData.vehicleInfo]
  );
  return driver.rows[0];
}
```

## File Structure

```
src/
├── features/
│   └── driver/
│       ├── components/
│       │   ├── Dashboard.jsx           # Main dashboard
│       │   ├── DeliveryTracker.jsx     # Delivery management
│       │   ├── DriverProfile.jsx       # Profile management
│       │   ├── DriverRatingView.jsx    # Rating component
│       │   └── AdminDriverManagement.jsx # Admin view
│       ├── hooks/
│       │   └── useDeliveries.js        # React Query hooks
│       ├── pages/
│       │   └── DriverHome.jsx          # Main page
│       └── __tests__/
│           └── driver.test.js          # Unit tests
├── api/
│   ├── routes/
│   │   ├── driver.routes.js            # Driver API
│   │   └── admin-drivers.routes.js     # Admin API
│   ├── middleware/
│   │   └── auth.js                     # Auth middleware
│   └── driver.integration.js           # Setup helper
└── migrations/
    └── create_driver_tables.sql        # Database setup
```

## API Reference

### Driver Endpoints

#### GET /api/driver/metrics
Get dashboard metrics

**Response:**
```json
{
  "todayEarnings": 150.50,
  "completedToday": 5,
  "pendingDeliveries": 2,
  "rating": 4.8,
  "activeDelivery": {
    "orderId": "ORD-123",
    "pickupLocation": "Store A",
    "deliveryLocation": "Customer Home"
  }
}
```

#### GET /api/driver/deliveries
Get driver's deliveries

**Query Parameters:**
- `limit` (default: 50)
- `offset` (default: 0)
- `status` (pending, assigned, in_progress, completed, cancelled)

#### GET /api/driver/deliveries/available
Get available deliveries to accept

**Query Parameters:**
- `limit` (default: 20)

#### POST /api/driver/deliveries/:id/accept
Accept a delivery

#### PATCH /api/driver/deliveries/:id
Update delivery status

**Body:**
```json
{
  "status": "in_progress"
}
```

#### GET /api/driver/stats
Get driver statistics

**Response:**
```json
{
  "totalDeliveries": 150,
  "completed": 145,
  "cancelled": 5,
  "totalEarnings": 5400.00,
  "avgRating": 4.7
}
```

### Admin Endpoints

#### GET /api/admin/drivers
List all drivers

**Query Parameters:**
- `search` - Search by name, phone, or license
- `status` - Filter by status
- `limit` (default: 50)
- `offset` (default: 0)

#### GET /api/admin/drivers/:id
Get driver details

#### POST /api/admin/drivers/:id/suspend
Suspend a driver

#### POST /api/admin/drivers/:id/activate
Activate a driver

#### GET /api/admin/drivers/stats/overview
Get overall driver statistics

## Features by Role

### Driver
- ✅ View dashboard with metrics
- ✅ Accept available deliveries
- ✅ Track active deliveries
- ✅ Update delivery status
- ✅ View earning history
- ✅ Manage profile
- ✅ View customer ratings

### Admin
- ✅ View all drivers
- ✅ Search and filter drivers
- ✅ View driver statistics
- ✅ Suspend/activate drivers
- ✅ View driver details
- ✅ Monitor platform-wide metrics

### Customer
- ✅ Rate drivers after delivery
- ✅ Leave feedback
- ✅ Track delivery in real-time
- ✅ View driver information

## Security Considerations

1. **Role-based Access Control**: Only drivers can access `/api/driver` endpoints
2. **Data Isolation**: Drivers can only see their own deliveries
3. **Amount Validation**: All transactions are validated
4. **Rate Limiting**: Limit delivery acceptance per time period
5. **Authentication**: JWT tokens required for all endpoints

## Testing

Run unit tests:
```bash
npm test src/features/driver/__tests__/driver.test.js
```

Run with coverage:
```bash
npm test -- --coverage src/features/driver/
```

## Performance Optimization

1. **Query Optimization**
   - Indexes on frequently searched columns
   - Pagination for large lists
   - Efficient JOIN queries

2. **Caching Strategy**
   - Cache driver metrics (30 seconds)
   - Cache available deliveries (15 seconds)
   - Cache driver profile

3. **Real-time Updates**
   - Use WebSocket for live metrics
   - Real-time delivery status updates
   - Instant notification of new deliveries

## Deployment Checklist

- [ ] Run database migrations
- [ ] Set environment variables
- [ ] Configure auth middleware
- [ ] Set up API routes
- [ ] Test driver flows
- [ ] Test admin management
- [ ] Set up monitoring
- [ ] Configure alerts for failed deliveries
- [ ] Set up logging

## Troubleshooting

### Driver can't see deliveries
1. Check driver role is set correctly
2. Verify JWT token is valid
3. Check deliveries exist in database
4. Verify query has no filters blocking

### Metrics not updating
1. Check triggers are created
2. Verify database constraints
3. Check delivery status transitions

### Admin can't see drivers
1. Verify admin role is set
2. Check database connection
3. Verify auth middleware is applied

## Contact & Support

For issues or questions, contact the development team.
