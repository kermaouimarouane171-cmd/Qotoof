/**
 * API Endpoints Configuration
 * Centralized endpoint management with versioning and documentation
 */

export const API_ENDPOINTS = {
  // AUTH ENDPOINTS
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth' + '/login',
    VERIFY_EMAIL: '/auth/verify-email',
    REFRESH_TOKEN: '/auth/refresh-token',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    LOGOUT: '/auth/logout',
    '2FA_SETUP': '/auth/2fa/setup',
    '2FA_VERIFY': '/auth/2fa/verify',
    ME: '/auth/me',
    UPDATE_PROFILE: '/auth/profile',
  },

  // PRODUCTS ENDPOINTS
  PRODUCTS: {
    LIST: '/products',
    GET: (id) => `/products/${id}`,
    CREATE: '/products',
    UPDATE: (id) => `/products/${id}`,
    DELETE: (id) => `/products/${id}`,
    SEARCH: '/products/search',
    BY_CATEGORY: (category) => `/products/category/${category}`,
    BY_VENDOR: (vendorId) => `/products/vendor/${vendorId}`,
    REVIEWS: (id) => `/products/${id}/reviews`,
    ADD_REVIEW: (id) => `/products/${id}/reviews`,
    IMAGES: (id) => `/products/${id}/images`,
    UPLOAD_IMAGE: (id) => `/products/${id}/images/upload`,
  },

  // CART ENDPOINTS
  CART: {
    GET: '/cart',
    ADD_ITEM: '/cart/items',
    UPDATE_ITEM: (itemId) => `/cart/items/${itemId}`,
    REMOVE_ITEM: (itemId) => `/cart/items/${itemId}`,
    CLEAR: '/cart/clear',
    APPLY_COUPON: '/cart/coupon',
    REMOVE_COUPON: '/cart/coupon',
    GET_SUMMARY: '/cart/summary',
  },

  // ORDERS ENDPOINTS
  ORDERS: {
    LIST: '/orders',
    CREATE: '/orders',
    GET: (id) => `/orders/${id}`,
    UPDATE: (id) => `/orders/${id}`,
    CANCEL: (id) => `/orders/${id}/cancel`,
    TRACKING: (id) => `/orders/${id}/tracking`,
    HISTORY: '/orders/history',
    INVOICE: (id) => `/orders/${id}/invoice`,
    RETURN: (id) => `/orders/${id}/return`,
  },

  // PAYMENTS ENDPOINTS
  PAYMENTS: {
    PAYPAL_CREATE_ORDER: '/payments/paypal/create-order',
    PAYPAL_CAPTURE_ORDER: '/payments/paypal/capture-order',
    CMI_PROCESS: '/payments/cmi/process',
    COD_CONFIRM: '/payments/cod/confirm',
    STATUS: (id) => `/payments/${id}/status`,
    REFUND: '/payments/refund',
    HISTORY: '/payments/history',
    METHODS: '/payments/methods',
  },

  // VENDOR ENDPOINTS
  VENDOR: {
    PROFILE: '/vendor/profile',
    UPDATE_PROFILE: '/vendor/profile',
    PRODUCTS: '/vendor/products',
    ORDERS: '/vendor/orders',
    ORDER_DETAIL: (id) => `/vendor/orders/${id}`,
    UPDATE_ORDER_STATUS: (id) => `/vendor/orders/${id}/status`,
    ANALYTICS_SALES: '/vendor/analytics/sales',
    ANALYTICS_PRODUCTS: '/vendor/analytics/products',
    ANALYTICS_EARNINGS: '/vendor/analytics/earnings',
    RATINGS: '/vendor/ratings',
    STORE_INFO: '/vendor/store-info',
  },

  // DRIVER ENDPOINTS
  DRIVER: {
    PROFILE: '/driver/profile',
    UPDATE_PROFILE: '/driver/profile',
    AVAILABLE_DELIVERIES: '/driver/available-deliveries',
    ACCEPT_DELIVERY: (id) => `/driver/deliveries/${id}/accept`,
    UPDATE_LOCATION: (id) => `/driver/deliveries/${id}/location`,
    START_DELIVERY: (id) => `/driver/deliveries/${id}/start`,
    COMPLETE_DELIVERY: (id) => `/driver/deliveries/${id}/complete`,
    EARNINGS: '/driver/earnings',
    EARNINGS_HISTORY: '/driver/earnings/history',
    DELIVERIES: '/driver/deliveries',
    DELIVERY_DETAIL: (id) => `/driver/deliveries/${id}`,
    RATINGS: '/driver/ratings',
  },

  // ADMIN ENDPOINTS
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    USERS_LIST: '/admin/users',
    USER_DETAIL: (id) => `/admin/users/${id}`,
    UPDATE_USER: (id) => `/admin/users/${id}`,
    DELETE_USER: (id) => `/admin/users/${id}`,
    PRODUCTS_LIST: '/admin/products',
    APPROVE_PRODUCT: (id) => `/admin/products/${id}/approve`,
    REJECT_PRODUCT: (id) => `/admin/products/${id}/reject`,
    ORDERS_LIST: '/admin/orders',
    UPDATE_ORDER: (id) => `/admin/orders/${id}`,
    ORDERS_SUMMARY: '/admin/orders/summary',
    ANALYTICS_DASHBOARD: '/admin/analytics/dashboard',
    ANALYTICS_SALES: '/admin/analytics/sales',
    ANALYTICS_USERS: '/admin/analytics/users',
    ANALYTICS_TRENDS: '/admin/analytics/trends',
    SETTINGS: '/admin/settings',
    UPDATE_SETTINGS: '/admin/settings',
    REPORTS: '/admin/reports',
  },

  // USER ENDPOINTS
  USER: {
    PROFILE: '/user/profile',
    UPDATE_PROFILE: '/user/profile',
    ADDRESSES: '/user/addresses',
    ADD_ADDRESS: '/user/addresses',
    UPDATE_ADDRESS: (id) => `/user/addresses/${id}`,
    DELETE_ADDRESS: (id) => `/user/addresses/${id}`,
    FAVORITES: '/user/favorites',
    ADD_FAVORITE: '/user/favorites',
    REMOVE_FAVORITE: (id) => `/user/favorites/${id}`,
    NOTIFICATIONS: '/user/notifications',
    MARK_NOTIFICATION_READ: (id) => `/user/notifications/${id}/read`,
    PREFERENCES: '/user/preferences',
    UPDATE_PREFERENCES: '/user/preferences',
  },

  // SUPPORT ENDPOINTS
  SUPPORT: {
    TICKETS: '/support/tickets',
    CREATE_TICKET: '/support/tickets',
    GET_TICKET: (id) => `/support/tickets/${id}`,
    ADD_REPLY: (id) => `/support/tickets/${id}/replies`,
    CLOSE_TICKET: (id) => `/support/tickets/${id}/close`,
    FAQs: '/support/faqs',
  },
};

/**
 * HTTP Status Codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
  // Auth errors
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_ALREADY_EXISTS: 'Email address already registered',
  EMAIL_NOT_VERIFIED: 'Please verify your email first',
  INVALID_TOKEN: 'Invalid or expired token',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'You do not have permission to access this resource',

  // Validation errors
  VALIDATION_FAILED: 'Validation failed',
  REQUIRED_FIELD: (field) => `${field} is required`,
  INVALID_EMAIL: 'Invalid email address',
  INVALID_PHONE: 'Invalid phone number',
  PASSWORD_TOO_WEAK: 'Password must be 8 characters minimum',
  PASSWORDS_DONT_MATCH: 'Passwords do not match',

  // Cart & Order errors
  PRODUCT_OUT_OF_STOCK: 'Product is out of stock',
  INVALID_QUANTITY: 'Invalid quantity',
  CART_EMPTY: 'Your cart is empty',
  INVALID_COUPON: 'Invalid or expired coupon code',
  PAYMENT_FAILED: 'Payment failed. Please try again',

  // Network errors
  NETWORK_ERROR: 'Network connection error',
  SERVER_ERROR: 'Server error. Please try again later',
  REQUEST_TIMEOUT: 'Request timeout. Please try again',

  // General errors
  NOT_FOUND: 'Resource not found',
  SOMETHING_WENT_WRONG: 'Something went wrong. Please try again',
};

/**
 * Success Messages
 */
export const SUCCESS_MESSAGES = {
  REGISTRATION_SUCCESS: 'Registration successful! Please check your email to verify your account.',
  LOGIN_SUCCESS: 'Logged in successfully',
  LOGOUT_SUCCESS: 'Logged out successfully',
  EMAIL_VERIFIED: 'Email verified successfully',
  PASSWORD_RESET_SUCCESS: 'Password reset successfully',
  PRODUCT_CREATED: 'Product created successfully',
  PRODUCT_UPDATED: 'Product updated successfully',
  PRODUCT_DELETED: 'Product deleted successfully',
  ORDER_CREATED: 'Order created successfully',
  ORDER_CANCELLED: 'Order cancelled successfully',
  PAYMENT_SUCCESS: 'Payment completed successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
};

/**
 * Cache Configuration
 */
export const CACHE_CONFIG = {
  PROFILE: { staleTime: 10 * 60 * 1000, cacheTime: 20 * 60 * 1000 }, // 10 min / 20 min
  PRODUCTS: { staleTime: 5 * 60 * 1000, cacheTime: 15 * 60 * 1000 }, // 5 min / 15 min
  ORDERS: { staleTime: 1 * 60 * 1000, cacheTime: 5 * 60 * 1000 }, // 1 min / 5 min
  CART: { staleTime: 0, cacheTime: 5 * 60 * 1000 }, // Real-time / 5 min
  TRACKING: { staleTime: 30 * 1000, cacheTime: 2 * 60 * 1000 }, // 30 sec / 2 min
  ANALYTICS: { staleTime: 5 * 60 * 1000, cacheTime: 15 * 60 * 1000 }, // 5 min / 15 min
  SETTINGS: { staleTime: 30 * 60 * 1000, cacheTime: 60 * 60 * 1000 }, // 30 min / 1 hour
};

/**
 * Retry Configuration
 */
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 10000, // 10 seconds
  BACKOFF_MULTIPLIER: 2,
};

/**
 * Request Timeout
 */
export const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * API Pagination
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MIN_LIMIT: 1,
  MAX_LIMIT: 100,
};

export default API_ENDPOINTS;
