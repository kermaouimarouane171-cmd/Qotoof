/**
 * Driver Configuration
 * Central configuration for all driver-related settings
 */

export const DRIVER_CONFIG = {
  // Commission and earnings
  COMMISSION_RATE: parseFloat(import.meta.env.VITE_DRIVER_COMMISSION_RATE || 15), // percentage
  MIN_PAYOUT_AMOUNT: 50, // minimum earned before payout
  PAYOUT_SCHEDULE: 'weekly', // daily, weekly, monthly

  // Rating and validation
  MIN_RATING_ALLOWED: parseFloat(import.meta.env.VITE_DRIVER_MIN_RATING || 2.0),
  MIN_RATING_FOR_PREMIUM: 4.5,
  RATING_EXPIRY_DAYS: 90, // ratings older than 90 days don't affect status

  // Delivery limits
  MAX_ACTIVE_DELIVERIES: parseInt(import.meta.env.VITE_DRIVER_MAX_ACTIVE_DELIVERIES || 3),
  MAX_DAILY_DELIVERIES: 50,
  DELIVERY_TIMEOUT_MINUTES: 120,

  // Penalties and rewards
  CANCELLATION_PENALTY: 5, // percentage deduction from earnings
  LATE_DELIVERY_PENALTY: 2, // percentage deduction per hour late
  PERFECT_RATING_BONUS: 10, // percentage bonus for perfect rating

  // Status management
  BREAK_DURATION_MINUTES: 30,
  BREAK_COOLDOWN_MINUTES: 120, // minimum time between breaks

  // Notifications
  ENABLE_PUSH_NOTIFICATIONS: true,
  NOTIFY_ON_NEW_DELIVERY: true,
  NOTIFY_ON_DELIVERY_COMPLETION: true,
  NOTIFY_ON_EARNINGS: true,

  // Regulations
  REQUIRE_LICENSE: true,
  REQUIRE_PHONE_VERIFICATION: true,
  REQUIRE_VEHICLE_INFO: true,
  AUTO_SUSPEND_BELOW_RATING: true,

  // Feature flags
  ENABLE_GPS_TRACKING: true,
  ENABLE_OFFLINE_MODE: false,
  ENABLE_BATCH_DELIVERIES: false,
  ENABLE_DRIVER_ANALYTICS: true,
};

// Driver status definitions
export const DRIVER_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ON_BREAK: 'on_break',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
};

// Delivery status definitions
export const DELIVERY_STATUSES = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DELAYED: 'delayed',
};

// Earning status definitions
export const EARNING_STATUSES = {
  PENDING: 'pending',
  PAID: 'paid',
  HELD: 'held',
  REFUNDED: 'refunded',
};

// Error messages
export const DRIVER_ERRORS = {
  STATUS_ALREADY_SET: 'Driver status is already set to this value',
  DELIVERY_NOT_FOUND: 'Delivery not found',
  DELIVERY_ALREADY_ACCEPTED: 'Delivery already accepted by another driver',
  INVALID_STATUS_TRANSITION: 'Invalid status transition',
  EXCEEDS_ACTIVE_LIMITS: 'Driver has reached maximum active deliveries',
  INSUFFICIENT_RATING: 'Driver rating is below minimum required',
  SUSPENDED_DRIVER: 'Driver account is suspended',
  INVALID_LICENSE: 'Driver license is invalid or expired',
  UNAUTHORIZED: 'Unauthorized to perform this action',
};

// Success messages
export const DRIVER_SUCCESS = {
  DELIVERY_ACCEPTED: 'Delivery accepted successfully',
  STATUS_UPDATED: 'Status updated successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  BREAK_STARTED: 'Break started successfully',
};

// Query constants
export const DRIVER_QUERY_LIMITS = {
  MAX_RESULTS: 1000,
  DEFAULT_LIMIT: 50,
  DEFAULT_OFFSET: 0,
};

// Validation rules
export const DRIVER_VALIDATION = {
  PHONE_REGEX: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
  LICENSE_MIN_LENGTH: 6,
  LICENSE_MAX_LENGTH: 20,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
};

export default DRIVER_CONFIG;
