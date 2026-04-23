# GreenMarket Driver Feature Documentation

## Overview
The driver feature enables delivery personnel to accept, manage, and complete deliveries through a dedicated interface.

## Key Features

### 1. Driver Dashboard
- Real-time metrics (today's earnings, completed deliveries, pending tasks, rating)
- Active delivery status with live tracking
- Quick access to available deliveries

### 2. Delivery Management
- View assigned deliveries
- Accept new delivery requests
- Update delivery status (pending → in_progress → completed)
- Cancel deliveries if needed
- View delivery details (customer, locations, payment)

### 3. Driver Statistics
- Total deliveries completed
- Earnings tracking
- Cancellation rate
- Average rating

## Architecture

### Components
```
driver/
├── components/
│   ├── Dashboard.jsx         # Main dashboard view
│   ├── DeliveryTracker.jsx   # Delivery list management
│   ├── DriverProfile.jsx     # Driver profile management
│   └── RatingView.jsx        # Customer ratings view
├── pages/
│   ├── DriverHome.jsx        # Dashboard page
│   ├── DeliveriesPage.jsx    # Deliveries management page
│   └── StatsPage.jsx         # Statistics page
└── hooks/
    ├── useDeliveries.js      # Delivery data management
    ├── useMetrics.js         # Metrics management
    └── useDriverAuth.js      # Driver authentication
```

### API Endpoints

#### GET `/api/driver/metrics`
Get dashboard metrics
- Response: { todayEarnings, completedToday, pendingDeliveries, rating, activeDelivery }

#### GET `/api/driver/deliveries`
Get all driver deliveries
- Query: limit, offset, status
- Response: [{ id, orderId, customerName, status, amount, ... }]

#### GET `/api/driver/deliveries/available`
Get available deliveries to accept
- Query: limit (default 20)
- Response: [{ id, address, distance, pay, status }]

#### POST `/api/driver/deliveries/:id/accept`
Accept a delivery
- Body: {}
- Response: { id, driverId, status, ... }

#### PATCH `/api/driver/deliveries/:id`
Update delivery status
- Body: { status: 'in_progress' | 'completed' | 'cancelled' }
- Response: { id, status, updatedAt, ... }

#### GET `/api/driver/stats`
Get driver statistics
- Response: { totalDeliveries, completed, cancelled, totalEarnings, avgRating }

## Authentication
- Drivers must be authenticated with role: 'driver'
- JWT token in Authorization header
- Session validation required

## Data Models

### Delivery
```javascript
{
  id: string,
  orderId: string,
  driverId: string,
  customerId: string,
  customerName: string,
  pickupLocation: string,
  deliveryLocation: string,
  amount: number,
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled',
  createdAt: timestamp,
  completedAt: timestamp,
  updatedAt: timestamp
}
```

### Driver
```javascript
{
  id: string,
  userId: string,
  phone: string,
  licenseNumber: string,
  vehicleInfo: string,
  rating: number,
  totalDeliveries: number,
  status: 'active' | 'inactive' | 'on_break',
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## Status Flow
```
pending → in_progress → completed
    ↓
cancelled (any time)
```

## Integration Points

### With Orders
- Delivery assigned when driver accepts
- Order status updates with delivery status
- Customer notifications on status changes

### With Payments
- Payment processed on delivery completion
- Amount credited to driver account
- Transaction history maintained

### With Notifications
- Real-time updates on new deliveries
- Delivery completion notifications
- Earning notifications

## Security
- Role-based access control (driver role only)
- Driver can only see/update their own deliveries
- Amount validation to prevent manipulation
- Rate limiting on delivery acceptance

## Performance Optimizations
- Query pagination for large delivery lists
- Real-time updates using WebSocket
- Caching for driver metrics
- Index optimization for driver_id and status fields

## Error Handling
- Invalid status transitions rejected
- Duplicate acceptance prevention
- Delivery not found handling
- Authorization failures logged

## Testing

### Unit Tests
- Metrics calculation
- Status validation
- Authorization checks

### Integration Tests
- Delivery acceptance flow
- Status update workflow
- Statistics calculation

### E2E Tests
- Complete delivery cycle
- Metrics dashboard rendering
- Real-time updates

## Future Enhancements
- Route optimization for multiple deliveries
- Live map tracking with GPS
- Performance-based incentives
- Driver availability scheduling
- Customer communication tools
- Analytics dashboard for drivers
