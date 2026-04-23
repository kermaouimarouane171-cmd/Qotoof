/**
 * Analytics utility – thin wrapper around googleAnalytics service
 * Use these helpers instead of calling googleAnalytics directly
 * to ensure consistent event naming and data shaping.
 */
import { googleAnalytics } from '@/services/googleAnalytics'

// ─── Page tracking ─────────────────────────────────────────────────────────

export function trackPageView(path, title) {
  googleAnalytics.pageView(path, title)
}

// ─── Generic events ────────────────────────────────────────────────────────

export function trackEvent(eventName, params = {}) {
  googleAnalytics.event(eventName, params)
}

// ─── User events ────────────────────────────────────────────────────────────

export function trackSignUp(method = 'email') {
  googleAnalytics.signUp(method)
}

export function trackLogin(method = 'email') {
  googleAnalytics.login(method)
}

// ─── Product / Ecommerce ───────────────────────────────────────────────────

export function trackViewItem(product) {
  googleAnalytics.event('view_item', {
    currency: 'MAD',
    value: product?.price || 0,
    items: [{
      item_id: product?.id,
      item_name: product?.name,
      item_category: product?.category,
      price: product?.price || 0,
      quantity: 1
    }]
  })
}

export function trackAddToCart(product, quantity = 1) {
  googleAnalytics.event('add_to_cart', {
    currency: 'MAD',
    value: (product?.price || 0) * quantity,
    items: [{
      item_id: product?.id,
      item_name: product?.name,
      item_category: product?.category,
      price: product?.price || 0,
      quantity
    }]
  })
}

export function trackRemoveFromCart(product, quantity = 1) {
  googleAnalytics.event('remove_from_cart', {
    currency: 'MAD',
    value: (product?.price || 0) * quantity,
    items: [{
      item_id: product?.id,
      item_name: product?.name,
      price: product?.price || 0,
      quantity
    }]
  })
}

export function trackBeginCheckout(cartItems = [], total = 0) {
  googleAnalytics.event('begin_checkout', {
    currency: 'MAD',
    value: total,
    items: cartItems.map(item => ({
      item_id: item.product?.id || item.product_id,
      item_name: item.product?.name,
      price: item.product?.price || item.price || 0,
      quantity: item.quantity || 1
    }))
  })
}

export function trackPurchase(order) {
  googleAnalytics.purchase({
    transaction_id: order?.id,
    value: order?.total_amount || 0,
    currency: 'MAD',
    items: (order?.items || []).map(item => ({
      item_id: item.product_id || item.product?.id,
      item_name: item.product?.name,
      price: item.price || item.unit_price || 0,
      quantity: item.quantity || 1
    }))
  })
}

// ─── Search ────────────────────────────────────────────────────────────────

export function trackSearch(query, resultsCount = 0) {
  googleAnalytics.search(query)
  googleAnalytics.event('search_results', {
    search_term: query,
    results_count: resultsCount
  })
}

// ─── Vendor / Driver ───────────────────────────────────────────────────────

export function trackProductCreate(vendorId) {
  googleAnalytics.event('product_created', { vendor_id: vendorId })
}

export function trackOrderAccepted(driverId) {
  googleAnalytics.event('delivery_accepted', { driver_id: driverId })
}

export function trackOrderDelivered(orderId) {
  googleAnalytics.event('delivery_completed', { order_id: orderId })
}
