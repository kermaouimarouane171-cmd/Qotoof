/**
 * Google Analytics Service
 * Tracks page views, events, and e-commerce transactions
 */

class GoogleAnalyticsService {
  constructor() {
    this.gaId = import.meta.env.VITE_GA_MEASUREMENT_ID
    this.enabled = !!this.gaId && import.meta.env.PROD
    this.initialized = false
  }

  /**
   * Initialize Google Analytics
   * Loads gtag script and configures tracking
   */
  init() {
    if (!this.enabled || this.initialized) return

    // Load gtag script
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.gaId}`
    document.head.appendChild(script)

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || []
    function gtag() { window.dataLayer.push(arguments) }
    gtag('js', new Date())
    gtag('config', this.gaId, {
      send_page_view: false, // We handle page views manually
    })

    this.initialized = true
  }

  /**
   * Track page view
   * @param {string} path - Current page path
   */
  pageView(path) {
    if (!this.enabled || !this.initialized) return
    window.gtag?.('config', this.gaId, {
      page_path: path,
      page_title: document.title,
    })
  }

  /**
   * Track custom event
   * @param {string} category - Event category
   * @param {string} action - Event action
   * @param {string} label - Event label
   */
  event(category, action, label) {
    if (!this.enabled || !this.initialized) return
    window.gtag?.('event', action, {
      event_category: category,
      event_label: label,
    })
  }

  /**
   * Track e-commerce purchase
   * @param {Object} order - Order object
   */
  purchase(order) {
    if (!this.enabled || !this.initialized) return
    window.gtag?.('event', 'purchase', {
      transaction_id: order.id,
      value: order.total,
      currency: 'MAD',
      items: order.items?.map(item => ({
        item_id: item.product_id,
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    })
  }

  /**
   * Track user sign up
   * @param {string} method - Sign up method (email, google, etc.)
   */
  signUp(method) {
    this.event('Auth', 'sign_up', method)
  }

  /**
   * Track login
   * @param {string} method - Login method
   */
  login(method) {
    this.event('Auth', 'login', method)
  }

  /**
   * Track search
   * @param {string} searchTerm - Search query
   * @param {number} resultsCount - Number of results
   */
  search(searchTerm, resultsCount) {
    if (!this.enabled || !this.initialized) return
    window.gtag?.('event', 'search', {
      search_term: searchTerm,
      results_count: resultsCount,
    })
  }
}

export const googleAnalytics = new GoogleAnalyticsService()
export default googleAnalytics
