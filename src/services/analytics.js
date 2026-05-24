/**
 * 📊 Lightweight Privacy-Friendly Analytics
 * Self-hosted analytics without cookies or personal data tracking
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { logger } from '../utils/logger.js'

// ============================================
// 1. ANALYTICS INITIALIZATION
// ============================================

/**
 * Initialize analytics
 * Only active in production
 */
export const initializeAnalytics = () => {
  // Skip in development
  if (import.meta.env.DEV) {
    logger.log('📊 Analytics disabled in development mode')
    return
  }

  const domain = import.meta.env.VITE_ANALYTICS_DOMAIN
  const siteId = import.meta.env.VITE_ANALYTICS_SITE_ID

  if (!domain || !siteId) {
    logger.warn('⚠️ Analytics not configured. Set VITE_ANALYTICS_DOMAIN and VITE_ANALYTICS_SITE_ID')
    return
  }

  // Create script element
  const script = document.createElement('script')
  script.defer = true
  script.src = `https://${domain}/js/script.js`
  script.setAttribute('data-domain', siteId)

  // Respect Do Not Track
  if (navigator.doNotTrack !== '1') {
    document.head.appendChild(script)
    logger.log('📊 Analytics initialized')
  } else {
    logger.log('📊 Analytics skipped (Do Not Track enabled)')
  }
}

// ============================================
// 2. PAGE VIEW TRACKING
// ============================================

/**
 * Track page view manually
 */
export const trackPageView = (url, _title = '') => {
  if (import.meta.env.DEV) return

  const domain = import.meta.env.VITE_ANALYTICS_DOMAIN
  const siteId = import.meta.env.VITE_ANALYTICS_SITE_ID

  if (!domain || !siteId) return

  // Send pageview
  const payload = {
    n: 'pageview',
    u: url,
    d: siteId,
    r: document.referrer || null,
    w: window.innerWidth,
  }

  // Send to analytics endpoint
  fetch(`https://${domain}/api/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Silently fail
  })
}

// ============================================
// 3. CUSTOM EVENT TRACKING
// ============================================

/**
 * Track custom event
 */
export const trackEvent = (eventName, properties = {}) => {
  if (import.meta.env.DEV) {
    logger.log('📊 Event:', eventName, properties)
    return
  }

  const domain = import.meta.env.VITE_ANALYTICS_DOMAIN
  const siteId = import.meta.env.VITE_ANALYTICS_SITE_ID

  if (!domain || !siteId) return

  const payload = {
    n: eventName,
    u: window.location.pathname,
    d: siteId,
    p: properties,
  }

  fetch(`https://${domain}/api/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Silently fail
  })
}

// ============================================
// 4. E-COMMERCE TRACKING
// ============================================

/**
 * Track product view
 */
export const trackProductView = (productId, productName, category) => {
  trackEvent('product_view', {
    product_id: productId,
    product_name: productName,
    category,
  })
}

/**
 * Track add to cart
 */
export const trackAddToCart = (productId, productName, price, quantity) => {
  trackEvent('add_to_cart', {
    product_id: productId,
    product_name: productName,
    price,
    quantity,
  })
}

/**
 * Track remove from cart
 */
export const trackRemoveFromCart = (productId, productName) => {
  trackEvent('remove_from_cart', {
    product_id: productId,
    product_name: productName,
  })
}

/**
 * Track checkout start
 */
export const trackCheckoutStart = (cartValue, itemCount) => {
  trackEvent('checkout_start', {
    cart_value: cartValue,
    item_count: itemCount,
  })
}

/**
 * Track purchase
 */
export const trackPurchase = (orderId, total, itemCount) => {
  trackEvent('purchase', {
    order_id: orderId,
    total,
    item_count: itemCount,
  })
}

// ============================================
// 5. USER ACTION TRACKING
// ============================================

/**
 * Track login attempt
 */
export const trackLoginAttempt = (success) => {
  trackEvent('login_attempt', { success })
}

/**
 * Track registration
 */
export const trackRegistration = (role) => {
  trackEvent('registration', { role })
}

/**
 * Track search
 */
export const trackSearch = (query, resultsCount) => {
  trackEvent('search', {
    query: query.substring(0, 100), // Limit length
    results_count: resultsCount,
  })
}

/**
 * Track filter usage
 */
export const trackFilter = (filterType, filterValue) => {
  trackEvent('filter', {
    filter_type: filterType,
    filter_value: filterValue,
  })
}

// ============================================
// 6. PERFORMANCE TRACKING
// ============================================

/**
 * Track page load time
 */
export const trackPageLoadTime = () => {
  if (import.meta.env.DEV) return

  window.addEventListener('load', () => {
    setTimeout(() => {
      const timing = performance.getEntriesByType('navigation')[0]
      if (timing) {
        trackEvent('page_load_time', {
          load_time: Math.round(timing.loadEventEnd - timing.startTime),
          dom_content_loaded: Math.round(timing.domContentLoadedEventEnd - timing.startTime),
          dom_complete: Math.round(timing.domComplete - timing.startTime),
        })
      }
    }, 0)
  })
}

// ============================================
// 7. REACT HOOKS
// ============================================

/**
 * Hook to track page views
 */
export const usePageViewTracking = () => {
  const location = useLocation()

  useEffect(() => {
    trackPageView(location.pathname + location.search, document.title)
  }, [location])
}

/**
 * Hook to track time on page
 */
export const useTimeOnPage = (pageName) => {
  useEffect(() => {
    const startTime = Date.now()

    return () => {
      const timeSpent = Math.round((Date.now() - startTime) / 1000)
      trackEvent('time_on_page', {
        page: pageName,
        seconds: timeSpent,
      })
    }
  }, [pageName])
}

// ============================================
// 8. OUTBOUND LINK TRACKING
// ============================================

/**
 * Track outbound link clicks
 */
export const setupOutboundLinkTracking = () => {
  if (import.meta.env.DEV) return

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a')
    if (!link) return

    const href = link.getAttribute('href')
    if (!href || href.startsWith('/') || href.startsWith('#')) return

    // Outbound link
    trackEvent('outbound_click', {
      url: href,
      text: link.textContent?.substring(0, 100),
    })
  })
}

// ============================================
// 9. ERROR TRACKING
// ============================================

/**
 * Track JavaScript errors
 */
export const setupErrorTracking = () => {
  if (import.meta.env.DEV) return

  window.addEventListener('error', (event) => {
    trackEvent('js_error', {
      message: event.message?.substring(0, 200),
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    trackEvent('unhandled_promise', {
      reason: String(event.reason)?.substring(0, 200),
    })
  })
}

// ============================================
// 10. INITIALIZATION HELPER
// ============================================

/**
 * Initialize all analytics features
 */
export const initializeAllAnalytics = () => {
  initializeAnalytics()
  trackPageLoadTime()
  setupOutboundLinkTracking()
  setupErrorTracking()
}

// ============================================
// Default export
// ============================================
export default {
  initializeAnalytics,
  trackPageView,
  trackEvent,
  trackProductView,
  trackAddToCart,
  trackRemoveFromCart,
  trackCheckoutStart,
  trackPurchase,
  trackLoginAttempt,
  trackRegistration,
  trackSearch,
  trackFilter,
  trackPageLoadTime,
  usePageViewTracking,
  useTimeOnPage,
  setupOutboundLinkTracking,
  setupErrorTracking,
  initializeAllAnalytics,
}
