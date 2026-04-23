import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCartStore } from '@/store/cartStore'
import { LoadingSpinner } from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import {
  TrashIcon,
  MinusIcon,
  PlusIcon,
  ShoppingCartIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { supabase } from '@/services/supabase'
import { buildMinimumOrderMessage, evaluateVendorMinimumOrders } from '@/services/minimumOrderService'

// ============================================
// Helper Functions
// ============================================

const WEIGHT_UNITS = ['kg', 'ton', 'lb', 'g']
/**
 * Returns true if the unit is weight-based (supports decimals)
 */
const isWeightBasedUnit = (unitType) => {
  return WEIGHT_UNITS.includes(unitType?.toLowerCase())
}

/**
 * Returns the step size for quantity adjustments
 * 0.5 for weight-based units, 1 for count-based units
 */
const getStepSize = (unitType) => {
  return isWeightBasedUnit(unitType) ? 0.5 : 1
}

/**
 * Formats quantity display based on unit type
 * Weight: shows decimals (2.5 kg), Count: shows integer (5 pieces)
 */
const formatQuantity = (quantity, unitType) => {
  if (isWeightBasedUnit(unitType)) {
    // Show up to 2 decimal places, strip trailing zeros
    return parseFloat(quantity.toFixed(2)).toString()
  }
  return Math.round(quantity).toString()
}

/**
 * Parses user input into a valid quantity
 * Rounds to nearest step size for weight units
 */
const parseQuantity = (value, unitType) => {
  const num = parseFloat(value)
  if (isNaN(num) || num < 0) return 0
  if (isWeightBasedUnit(unitType)) {
    // Round to nearest 0.5
    return Math.round(num * 2) / 2
  }
  return Math.round(num)
}

// ============================================
// Cart Page Component
// ============================================

const CartPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    items,
    removeItem,
    updateQuantity,
    getSubtotal,
    getTax,
    getVendorCount,
    clearCart,
    validateCart,
  } = useCartStore()

  // UI state
  const [validating, setValidating] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [pendingRemove, setPendingRemove] = useState(null) // { id, name }
  const [inputQuantities, setInputQuantities] = useState({}) // { productId: string }
  const [inputErrors, setInputErrors] = useState({}) // { productId: string }
  const [priceAlerts, setPriceAlerts] = useState({}) // { productId: { oldPrice, newPrice } }
  const [vendorProfiles, setVendorProfiles] = useState([])

  // Initialize input quantities from cart items
  useEffect(() => {
    const initial = {}
    items.forEach(item => {
      initial[item.id] = formatQuantity(item.quantity, item.unit_type)
    })
    setInputQuantities(initial)
  }, [items])

  useEffect(() => {
    let cancelled = false

    const loadVendorProfiles = async () => {
      const vendorIds = [...new Set(items.map((item) => item.vendor_id).filter(Boolean))]
      if (vendorIds.length === 0) {
        if (!cancelled) setVendorProfiles([])
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, store_name, min_order_amount')
          .in('id', vendorIds)

        if (error) throw error
        if (!cancelled) setVendorProfiles(data || [])
      } catch (error) {
        logger.error('Failed to load vendor minimum-order settings:', error)
        if (!cancelled) setVendorProfiles([])
      }
    }

    loadVendorProfiles()

    return () => {
      cancelled = true
    }
  }, [items])

  const minimumOrderStatus = useMemo(
    () => evaluateVendorMinimumOrders({ items, vendorProfiles }),
    [items, vendorProfiles]
  )

  const validateCartOnMount = useCallback(async () => {
    setValidating(true)
    try {
      const result = await validateCart()

      // Sync inputQuantities with updated store items after validation
      const store = useCartStore.getState()
      const newInputs = {}
      store.items.forEach(item => {
        newInputs[item.id] = formatQuantity(item.quantity, item.unit_type)
      })
      setInputQuantities(newInputs)
      setInputErrors({})

      if (!result.valid && result.changes?.length > 0) {
        // Detect price changes
        const alerts = {}
        result.changes.forEach(change => {
          if (change.type === 'price_changed') {
            alerts[change.item.id] = {
              oldPrice: change.oldPrice,
              newPrice: change.newPrice,
              name: change.item.name,
            }
          }
        })
        setPriceAlerts(alerts)

        const removedCount = result.changes.filter(c => c.type === 'removed').length
        const updatedCount = result.changes.filter(c => c.type !== 'removed').length
        if (removedCount > 0) {
          toast.error(`${removedCount} item(s) were removed (unavailable)`)
        }
        if (updatedCount > 0) {
          toast(`${updatedCount} item(s) were updated`, { icon: '⚠️' })
        }
      }
    } catch (error) {
      logger.error('Cart validation failed:', error)
    } finally {
      setValidating(false)
    }
  }, [validateCart])

  // Validate cart on mount and re-validate periodically
  useEffect(() => {
    if (items.length === 0) return

    validateCartOnMount()

    // Re-validate every 5 minutes to catch price/stock changes
    const interval = setInterval(() => {
      validateCart()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [items.length, validateCart, validateCartOnMount])

  // ============================================
  // Quantity Management
  // ============================================

  const handleIncrement = useCallback((item) => {
    // Read from store to avoid stale closure
    const store = useCartStore.getState()
    const currentItem = store.items.find(i => i.id === item.id)
    if (!currentItem) return

    const step = getStepSize(currentItem.unit_type)
    const maxQty = currentItem.available_quantity !== null && currentItem.available_quantity !== undefined
      ? currentItem.available_quantity
      : Infinity

    const newQty = parseFloat((currentItem.quantity + step).toFixed(2))

    if (newQty > maxQty) {
      toast.error(`Maximum available quantity reached (${formatQuantity(maxQty, currentItem.unit_type)} ${currentItem.unit_type})`)
      return
    }

    updateQuantity(item.id, newQty)
    setInputQuantities(prev => ({
      ...prev,
      [item.id]: formatQuantity(newQty, currentItem.unit_type),
    }))
    setInputErrors(prev => ({ ...prev, [item.id]: '' }))
  }, [updateQuantity])

  const handleDecrement = useCallback((item) => {
    // Read from store to avoid stale closure
    const store = useCartStore.getState()
    const currentItem = store.items.find(i => i.id === item.id)
    if (!currentItem) return

    const step = getStepSize(currentItem.unit_type)
    const minQty = currentItem.min_order_quantity || 1
    const newQty = parseFloat((currentItem.quantity - step).toFixed(2))

    if (newQty <= 0) {
      // Show confirmation before removing
      setPendingRemove({ id: item.id, name: item.name })
      return
    }

    if (newQty < minQty) {
      // Going below minimum order — ask to remove
      setPendingRemove({ id: item.id, name: item.name })
      return
    }

    updateQuantity(item.id, newQty)
    setInputQuantities(prev => ({
      ...prev,
      [item.id]: formatQuantity(newQty, currentItem.unit_type),
    }))
    setInputErrors(prev => ({ ...prev, [item.id]: '' }))
  }, [updateQuantity])

  const handleInputChange = useCallback((item, rawValue) => {
    const productId = item.id

    // Allow empty string for editing
    if (rawValue === '' || rawValue === '-') {
      setInputQuantities(prev => ({ ...prev, [productId]: rawValue }))
      setInputErrors(prev => ({ ...prev, [productId]: '' }))
      return
    }

    const parsed = parseQuantity(rawValue, item.unit_type)
    const minQty = item.min_order_quantity || 1
    const maxQty = item.available_quantity !== null && item.available_quantity !== undefined
      ? item.available_quantity
      : null

    let error = ''
    if (parsed === 0) {
      error = 'Quantity must be greater than 0'
    } else if (parsed < minQty) {
      error = `Minimum order is ${formatQuantity(minQty, item.unit_type)} ${item.unit_type}`
    } else if (maxQty !== null && parsed > maxQty) {
      error = `Only ${formatQuantity(maxQty, item.unit_type)} ${item.unit_type} available`
    }

    setInputQuantities(prev => ({ ...prev, [productId]: rawValue }))
    setInputErrors(prev => ({ ...prev, [productId]: error }))
  }, [])

  const handleInputBlur = useCallback((item) => {
    const productId = item.id
    const rawValue = inputQuantities[productId]
    if (!rawValue || rawValue === '') {
      // Revert to current quantity
      setInputQuantities(prev => ({
        ...prev,
        [productId]: formatQuantity(item.quantity, item.unit_type),
      }))
      return
    }

    const parsed = parseQuantity(rawValue, item.unit_type)
    const minQty = item.min_order_quantity || 1
    const maxQty = item.available_quantity !== null && item.available_quantity !== undefined
      ? item.available_quantity
      : null

    if (parsed <= 0) {
      // Remove item
      setPendingRemove({ id: item.id, name: item.name })
      setInputQuantities(prev => ({
        ...prev,
        [productId]: formatQuantity(item.quantity, item.unit_type),
      }))
      return
    }

    if (parsed < minQty) {
      setInputErrors(prev => ({
        ...prev,
        [productId]: `Minimum order is ${formatQuantity(minQty, item.unit_type)} ${item.unit_type}`,
      }))
      // Revert
      setInputQuantities(prev => ({
        ...prev,
        [productId]: formatQuantity(item.quantity, item.unit_type),
      }))
      return
    }

    if (maxQty !== null && parsed > maxQty) {
      setInputErrors(prev => ({
        ...prev,
        [productId]: `Only ${formatQuantity(maxQty, item.unit_type)} ${item.unit_type} available`,
      }))
      // Clamp to max AND update store to keep them in sync
      updateQuantity(item.id, maxQty)
      setInputQuantities(prev => ({
        ...prev,
        [productId]: formatQuantity(maxQty, item.unit_type),
      }))
      return
    }

    // Valid input — update cart
    if (parsed !== item.quantity) {
      updateQuantity(item.id, parsed)
    }
    setInputErrors(prev => ({ ...prev, [productId]: '' }))
  }, [inputQuantities, updateQuantity])

  const handleInputKeyDown = useCallback((item, e) => {
    if (e.key === 'Enter') {
      e.target.blur()
    }
  }, [])

  // ============================================
  // Remove / Clear
  // ============================================

  const confirmRemoveItem = useCallback(() => {
    if (pendingRemove) {
      removeItem(pendingRemove.id)
      setInputQuantities(prev => {
        const next = { ...prev }
        delete next[pendingRemove.id]
        return next
      })
      setInputErrors(prev => {
        const next = { ...prev }
        delete next[pendingRemove.id]
        return next
      })
      setPendingRemove(null)
    }
  }, [pendingRemove, removeItem])

  const confirmClearCart = useCallback(() => {
    clearCart()
    setInputQuantities({})
    setInputErrors({})
    setPriceAlerts({})
    setShowClearConfirm(false)
    toast.success('Cart cleared')
  }, [clearCart])

  // ============================================
  // Checkout with Server Validation
  // ============================================

  const handleCheckout = useCallback(async () => {
    if (items.length === 0) return

    setCheckoutLoading(true)
    try {
      const vendorIds = [...new Set(items.map((item) => item.vendor_id).filter(Boolean))]
      const { data: freshVendorProfiles, error: vendorProfilesError } = await supabase
        .from('profiles')
        .select('id, store_name, min_order_amount')
        .in('id', vendorIds)

      if (vendorProfilesError) throw vendorProfilesError

      setVendorProfiles(freshVendorProfiles || [])

      const freshMinimumOrderStatus = evaluateVendorMinimumOrders({
        items,
        vendorProfiles: freshVendorProfiles || [],
      })

      if (freshMinimumOrderStatus.hasViolations) {
        toast.error(buildMinimumOrderMessage(freshMinimumOrderStatus.firstViolation))
        setCheckoutLoading(false)
        return
      }

      // Re-fetch all prices from server to prevent tampering
      const productIds = items.map(item => item.id)
      const { data: freshProducts, error } = await supabase
        .from('products')
        .select('id, price_per_unit, is_available, available_quantity, name, min_order_quantity')
        .in('id', productIds)

      if (error) throw error

      const freshMap = new Map(freshProducts.map(p => [p.id, p]))
      const issues = []

      for (const item of items) {
        const fresh = freshMap.get(item.id)

        if (!fresh || !fresh.is_available) {
          issues.push(`${item.name} is no longer available`)
          continue
        }

        // Verify price hasn't changed significantly
        const priceDiff = Math.abs(fresh.price_per_unit - item.price_per_unit)
        if (priceDiff > 0.01) {
          issues.push(`${item.name}: price changed from ${formatPrice(item.price_per_unit)} to ${formatPrice(fresh.price_per_unit)}`)
        }

        // Verify stock
        if (fresh.available_quantity !== null && item.quantity > fresh.available_quantity) {
          issues.push(`${item.name}: only ${formatQuantity(fresh.available_quantity, item.unit_type)} ${item.unit_type} available`)
        }
      }

      if (issues.length > 0) {
        toast.error(issues.join('. '))
        // Re-validate cart to sync with server
        await validateCart()
        setCheckoutLoading(false)
        return
      }

      // All checks passed — proceed to checkout
      navigate('/checkout')
    } catch (error) {
      logger.error('Checkout validation error:', error)
      toast.error('Failed to validate cart. Please try again.')
    } finally {
      setCheckoutLoading(false)
    }
  }, [items, validateCart, navigate])

  // ============================================
  // Computed Values
  // ============================================

  const subtotal = getSubtotal()
  const tax = getTax()
  const total = subtotal + tax
  const vendorCount = getVendorCount()

  // ============================================
  // Empty State
  // ============================================

  if (items.length === 0 && !validating) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingCartIcon className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('cart.empty')}</h2>
        <p className="text-gray-500 mb-2">{t('cart.emptyMessage')}</p>
        <p className="text-sm text-gray-400 mb-8">{t('cart.browseMarketplace')}</p>
        <Link to="/marketplace" className="btn-primary inline-flex items-center gap-2">
          <ShoppingCartIcon className="w-5 h-5" />
          {t('cart.startShopping')}
        </Link>
      </div>
    )
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('cart.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} {items.length !== 1 ? t('cart.items') : t('cart.item')}
            {vendorCount > 1 && ` ${t('cart.fromVendors', { count: vendorCount })}`}
          </p>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
          >
            {t('cart.clearCart')}
          </button>
        )}
      </div>

      {validating && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {!validating && items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ===== Cart Items ===== */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const itemTotal = (item.price_per_unit || 0) * item.quantity
              const isLowStock = item.available_quantity !== null && item.available_quantity <= item.quantity * 1.25
              const isAtMax = item.available_quantity !== null && item.quantity >= item.available_quantity
              const step = getStepSize(item.unit_type)
              const minQty = item.min_order_quantity || 1
              const inputError = inputErrors[item.id]
              const displayQty = inputQuantities[item.id] ?? formatQuantity(item.quantity, item.unit_type)
              const hasPriceAlert = priceAlerts[item.id]

              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-xl overflow-hidden transition-all ${
                    inputError ? 'border-red-300 shadow-sm shadow-red-100' : 'border-gray-200'
                  }`}
                >
                  {/* Vendor Label */}
                  {vendorCount > 1 && item.vendor_name && (
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Sold by: {item.vendor_name}
                      </p>
                    </div>
                  )}

                  {/* Price Change Alert */}
                  {hasPriceAlert && (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                      <BoltIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-amber-700">
                        Price updated: {formatPrice(hasPriceAlert.oldPrice)} → {formatPrice(hasPriceAlert.newPrice)}
                      </p>
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex gap-4">
                      {/* Image */}
                      <Link
                        to={`/product/${item.id}`}
                        className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100"
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            🌱
                          </div>
                        )}
                      </Link>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              to={`/product/${item.id}`}
                              className="font-semibold text-gray-900 hover:text-green-600 transition-colors truncate block"
                            >
                              {item.name}
                            </Link>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {formatPrice(item.price_per_unit || 0)} / {item.unit_type}
                            </p>
                          </div>

                          {/* Remove */}
                          <button
                            onClick={() => setPendingRemove({ id: item.id, name: item.name })}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                            aria-label={`Remove ${item.name}`}
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Low Stock Warning */}
                        {isLowStock && (
                          <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                            <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            Only {formatQuantity(item.available_quantity, item.unit_type)} {item.unit_type} available
                            {item.quantity > item.available_quantity * 0.8 && (
                              <span className="ml-1 px-1.5 py-0.5 bg-orange-100 rounded text-[10px] font-medium">
                                &gt;80% reserved
                              </span>
                            )}
                          </p>
                        )}

                        {/* Quantity Controls */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                          {/* Quantity Selector */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDecrement(item)}
                              className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                              aria-label="Decrease quantity"
                            >
                              <MinusIcon className="w-4 h-4" />
                            </button>

                            {/* Manual Input */}
                            <div className="relative">
                              <input
                                type="text"
                                inputMode={isWeightBasedUnit(item.unit_type) ? 'decimal' : 'numeric'}
                                value={displayQty}
                                onChange={(e) => handleInputChange(item, e.target.value)}
                                onBlur={() => handleInputBlur(item)}
                                onKeyDown={(e) => handleInputKeyDown(item, e)}
                                className={`w-20 text-center text-base font-medium py-1.5 rounded-lg border transition-colors ${
                                  inputError
                                    ? 'border-red-300 bg-red-50 text-red-700 focus:ring-red-500 focus:border-red-500'
                                    : 'border-gray-200 bg-white focus:ring-green-500 focus:border-green-500'
                                }`}
                                aria-label={`Quantity in ${item.unit_type}`}
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                                {item.unit_type}
                              </span>
                            </div>

                            <button
                              onClick={() => handleIncrement(item)}
                              disabled={isAtMax}
                              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                                isAtMax
                                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              }`}
                              aria-label="Increase quantity"
                            >
                              <PlusIcon className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Step Info */}
                          <p className="text-xs text-gray-400 sm:text-right">
                            Step: {formatQuantity(step, item.unit_type)} {item.unit_type}
                            {minQty > 1 && ` · Min: ${formatQuantity(minQty, item.unit_type)}`}
                          </p>

                          {/* Item Subtotal */}
                          <div className="text-right sm:min-w-[100px]">
                            <p className="text-lg font-bold text-gray-900">
                              {formatPrice(itemTotal)}
                            </p>
                          </div>
                        </div>

                        {/* Input Error Message */}
                        {inputError && (
                          <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                            <XMarkIcon className="w-3 h-3" />
                            {inputError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ===== Order Summary (Desktop Sidebar) ===== */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="card p-6 sticky top-24 bg-white border border-gray-200 rounded-xl">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({items.length} items)</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>VAT (20%)</span>
                  <span>{formatPrice(tax)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className="text-gray-400 text-sm">Calculated at checkout</span>
                </div>
                {vendorCount > 1 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Multi-vendor order</span>
                    <span>{vendorCount} vendors</span>
                  </div>
                )}
                {minimumOrderStatus.hasViolations && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                    {minimumOrderStatus.violations.map((vendor) => (
                      <div key={vendor.vendorId} className="text-xs text-amber-800">
                        <p className="font-semibold">{vendor.vendorName}</p>
                        <p>
                          الحد الأدنى {formatPrice(vendor.minOrderAmount)} ويتبقى {formatPrice(vendor.shortfall)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <hr className="border-gray-200" />
                <div className="flex justify-between text-xl font-bold text-gray-900">
                  <span>Total</span>
                  <span className="text-green-600">{formatPrice(total)}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={checkoutLoading || minimumOrderStatus.hasViolations}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {checkoutLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Validating...
                  </>
                ) : minimumOrderStatus.hasViolations ? (
                  'Minimum order not met'
                ) : (
                  <>
                    Proceed to Checkout
                    <ArrowRightIcon className="w-5 h-5" />
                  </>
                )}
              </button>

              <Link to="/marketplace" className="btn-ghost w-full mt-3 text-center block">
                Continue Shopping
              </Link>

              {/* Trust Badges */}
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  <span>Secure checkout</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  <span>Buyer protection</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  <span>Quality guarantee</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Mobile Fixed Bottom Bar ===== */}
      {!validating && items.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-40 safe-area-inset-bottom">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-500">Total ({items.length} items)</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(total)}</p>
                {tax > 0 && <p className="text-xs text-gray-400">incl. {formatPrice(tax)} VAT (20%)</p>}
                {minimumOrderStatus.hasViolations && (
                  <p className="text-xs text-amber-700 mt-1">استوفِ الحد الأدنى للطلب لكل بائع قبل المتابعة.</p>
                )}
              </div>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading || minimumOrderStatus.hasViolations}
                className="btn-primary flex items-center gap-2 px-8 py-3 text-base disabled:opacity-60"
              >
                {checkoutLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Validating...
                  </>
                ) : minimumOrderStatus.hasViolations ? (
                  'Minimum not met'
                ) : (
                  <>
                    Checkout
                    <ArrowRightIcon className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Remove Item Confirmation Modal ===== */}
      {pendingRemove && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-dialog-title"
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl"
          >
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrashIcon className="w-6 h-6 text-red-600" />
            </div>
            <h3 id="remove-dialog-title" className="text-lg font-semibold text-gray-900 mb-2 text-center">
              Remove Item?
            </h3>
            <p className="text-sm text-gray-600 mb-6 text-center">
              Are you sure you want to remove <strong>{pendingRemove.name}</strong> from your cart?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingRemove(null)}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveItem}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Clear Cart Confirmation Modal ===== */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-dialog-title"
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl"
          >
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
            </div>
            <h3 id="clear-dialog-title" className="text-lg font-semibold text-gray-900 mb-2 text-center">
              Clear Entire Cart?
            </h3>
            <p className="text-sm text-gray-600 mb-6 text-center">
              This will remove all <strong>{items.length}</strong> item{items.length !== 1 ? 's' : ''} from your cart. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearCart}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CartPage
