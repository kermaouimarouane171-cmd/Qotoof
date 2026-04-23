/**
 * Time constants used throughout the application.
 * Replaces magic numbers like 3000, 5000, 10000, 30000, 60000, 3600000, etc.
 */

// Milliseconds
export const ONE_SECOND = 1000
export const TWO_SECONDS = 2000
export const THREE_SECONDS = 3000
export const FIVE_SECONDS = 5000
export const TEN_SECONDS = 10000
export const FIFTEEN_SECONDS = 15000
export const THIRTY_SECONDS = 30000

// Minutes
export const ONE_MINUTE = 60000
export const FIVE_MINUTES = 300000
export const TEN_MINUTES = 600000
export const FIFTEEN_MINUTES = 900000
export const THIRTY_MINUTES = 1800000

// Hours
export const ONE_HOUR = 3600000
export const TWO_HOURS = 7200000
export const TWENTY_FOUR_HOURS = 86400000

// Days
export const ONE_DAY = 86400000
export const SEVEN_DAYS = 604800000
export const THIRTY_DAYS = 2592000000

// Common timeouts/intervals used in the app
export const AUTO_LOGOUT_TIMEOUT = THIRTY_MINUTES // 30 min inactivity
export const SESSION_TIMEOUT = ONE_HOUR // 60 min session
export const CALLBACK_TIMEOUT = FIFTEEN_SECONDS // Auth callback
export const LOCATION_UPDATE_INTERVAL = TEN_SECONDS // GPS tracking
export const REFRESH_INTERVAL = FIVE_MINUTES // Data refresh
export const TOAST_DURATION = THREE_SECONDS
export const DEBOUNCE_DELAY = 300 // ms (not using ONE_SECOND for sub-second values)
export const THROTTLE_DELAY = ONE_SECOND

// Rate limiting (requests per minute)
export const RATE_LIMIT_API = 100
export const RATE_LIMIT_LOGIN = 5
export const RATE_LIMIT_REGISTER = 3
