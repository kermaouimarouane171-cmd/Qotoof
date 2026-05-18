/**
 * Error Handler Utility
 * Centralized error handling, formatting, and logging
 */

import { HTTP_STATUS, ERROR_MESSAGES } from '../constants/apiEndpoints';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  constructor(message, status = 500, errors = [], originalError = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Normalize error response
 */
export const normalizeError = (error) => {
  console.error('[Error]', error);

  // Handle API error response
  if (error.response) {
    const { status, data } = error.response;
    return {
      status,
      message: data?.message || ERROR_MESSAGES.SOMETHING_WENT_WRONG,
      errors: data?.errors || [],
      originalError: error,
    };
  }

  // Handle request error (no response from server)
  if (error.request) {
    return {
      status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: ERROR_MESSAGES.NETWORK_ERROR,
      errors: [],
      originalError: error,
    };
  }

  // Handle other errors
  return {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    message: error.message || ERROR_MESSAGES.SOMETHING_WENT_WRONG,
    errors: [],
    originalError: error,
  };
};

/**
 * Format error for UI display
 */
export const formatErrorForUI = (error) => {
  const normalized = normalizeError(error);

  // Check if it's validation error (400)
  if (normalized.status === HTTP_STATUS.BAD_REQUEST && normalized.errors.length > 0) {
    return {
      type: 'validation',
      message: ERROR_MESSAGES.VALIDATION_FAILED,
      errors: normalized.errors,
    };
  }

  // Check if it's auth error (401)
  if (normalized.status === HTTP_STATUS.UNAUTHORIZED) {
    return {
      type: 'auth',
      message: ERROR_MESSAGES.UNAUTHORIZED,
      action: 'redirect_to_login',
    };
  }

  // Check if it's permission error (403)
  if (normalized.status === HTTP_STATUS.FORBIDDEN) {
    return {
      type: 'permission',
      message: ERROR_MESSAGES.FORBIDDEN,
    };
  }

  // Check if it's not found (404)
  if (normalized.status === HTTP_STATUS.NOT_FOUND) {
    return {
      type: 'not_found',
      message: ERROR_MESSAGES.NOT_FOUND,
      action: 'redirect_to_home',
    };
  }

  // Check if it's conflict (409)
  if (normalized.status === HTTP_STATUS.CONFLICT) {
    return {
      type: 'conflict',
      message: normalized.message || 'This resource already exists',
    };
  }

  // Check if it's too many requests (429)
  if (normalized.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    return {
      type: 'rate_limit',
      message: 'Too many requests. Please try again later.',
      retryAfter: error.response?.headers['retry-after'],
    };
  }

  // Server error (5xx)
  if (normalized.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    return {
      type: 'server_error',
      message: ERROR_MESSAGES.SERVER_ERROR,
      action: 'retry',
    };
  }

  // Network error
  if (!error.response) {
    return {
      type: 'network_error',
      message: ERROR_MESSAGES.NETWORK_ERROR,
      action: 'offline',
    };
  }

  // Generic error
  return {
    type: 'generic',
    message: normalized.message,
  };
};

/**
 * Get user-friendly error message
 */
export const getUserFriendlyMessage = (error) => {
  const formatted = formatErrorForUI(error);
  return formatted.message;
};

/**
 * Resolve a display message using the normalized error type plus optional overrides.
 */
export const getDisplayErrorMessage = (error, overrides = {}) => {
  const formatted = formatErrorForUI(error);
  return (
    overrides[formatted.type] ||
    overrides.default ||
    formatted.message ||
    ERROR_MESSAGES.SOMETHING_WENT_WRONG
  );
};

/**
 * Log error to external service (Sentry, etc.)
 */
export const logErrorToService = async (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    status: error.status || normalizeError(error).status,
    errors: error.errors || normalizeError(error).errors,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    context,
  };

  // Send to error tracking service
  try {
    if (import.meta.env.VITE_SENTRY_DSN) {
      // Sentry integration
      // Sentry.captureException() - already integrated in sentry.js
    }

    // Log to backend
    if (import.meta.env.PROD) {
      await fetch('/api/logs/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorInfo),
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[Error Logging] Failed to log error', err);
  }
};

/**
 * Retry logic with exponential backoff
 */
export const retryWithBackoff = async (
  fn,
  options = {
    maxRetries: 3,
    delay: 1000,
    maxDelay: 10000,
    backoff: 2,
    onRetry: null,
  }
) => {
  const { maxRetries, delay, maxDelay, backoff, onRetry } = options;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const normalized = normalizeError(error);

      // Don't retry if it's a client error (4xx) except 408 and 429
      if (
        normalized.status >= 400 &&
        normalized.status < 500 &&
        normalized.status !== 408 &&
        normalized.status !== 429
      ) {
        throw error;
      }

      if (attempt < maxRetries) {
        const waitTime = Math.min(delay * Math.pow(backoff, attempt - 1), maxDelay);
        if (onRetry) {
          onRetry(attempt, waitTime, error);
        }
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
};

/**
 * Handle specific error by status code
 */
export const handleErrorByStatus = (status, options = {}) => {
  const { onAuth, onForbidden, onNotFound, onRetry } = options;

  switch (status) {
    case HTTP_STATUS.UNAUTHORIZED:
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
      if (onAuth) onAuth();
      break;

    case HTTP_STATUS.FORBIDDEN:
      if (onForbidden) onForbidden();
      break;

    case HTTP_STATUS.NOT_FOUND:
      if (onNotFound) onNotFound();
      break;

    case HTTP_STATUS.TOO_MANY_REQUESTS:
      if (onRetry) onRetry();
      break;

    default:
      break;
  }
};

/**
 * Create error from validation result
 */
export const createValidationError = (validationResult) => {
  if (validationResult.success) {
    return null;
  }

  return {
    message: ERROR_MESSAGES.VALIDATION_FAILED,
    errors: validationResult.errors,
    status: HTTP_STATUS.BAD_REQUEST,
  };
};

/**
 * Parse error message
 */
export const parseErrorMessage = (error) => {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.message) {
    return error.message;
  }

  return ERROR_MESSAGES.SOMETHING_WENT_WRONG;
};

/**
 * Extract field errors from validation response
 */
export const extractFieldErrors = (error) => {
  const fieldErrors = {};

  if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
    error.response.data.errors.forEach((err) => {
      const field = err.field || err.path?.[0] || 'general';
      fieldErrors[field] = err.message;
    });
  }

  return fieldErrors;
};

/**
 * Check if error is network error
 */
export const isNetworkError = (error) => {
  return !error.response && !error.request;
};

/**
 * Check if error is timeout
 */
export const isTimeoutError = (error) => {
  return error.code === 'ECONNABORTED' || error.message === 'timeout of 30000ms exceeded';
};

/**
 * Check if error is auth error
 */
export const isAuthError = (error) => {
  return error.response?.status === HTTP_STATUS.UNAUTHORIZED;
};

/**
 * Check if error is validation error
 */
export const isValidationError = (error) => {
  return error.response?.status === HTTP_STATUS.BAD_REQUEST;
};

/**
 * Create user-friendly error message with fallback
 */
export const createErrorMessage = (error, fallback = ERROR_MESSAGES.SOMETHING_WENT_WRONG) => {
  try {
    const normalized = normalizeError(error);
    return normalized.message || fallback;
  } catch {
    return fallback;
  }
};

export default {
  ApiError,
  normalizeError,
  formatErrorForUI,
  getUserFriendlyMessage,
  getDisplayErrorMessage,
  logErrorToService,
  retryWithBackoff,
  handleErrorByStatus,
  createValidationError,
  parseErrorMessage,
  extractFieldErrors,
  isNetworkError,
  isTimeoutError,
  isAuthError,
  isValidationError,
  createErrorMessage,
};
