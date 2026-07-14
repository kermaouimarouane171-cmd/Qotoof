import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useCartStore } from '@/modules/cart'
import { calculateBulkDiscountBreakdown, couponsApi } from '@/modules/coupons'
import { LoadingSpinner, Breadcrumbs, ProductRecommendations } from '@/components/ui'
import AuthGate from '@/components/auth/AuthGate'
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
  InformationCircleIcon,
  ChatBubbleLeftRightIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import { buildMinimumOrderMessage, evaluateVendorMinimumOrders } from '@/modules/cart'
import NegotiationOnboarding, { hasSeenOnboarding } from '@/components/onboarding/NegotiationOnboarding'
import {
  formatQuantity,
  getQuantityStep,
  isDecimalQuantityUnit,
  normalizeQuantity,
} from '@/modules/cart'

const formatValidationTime = (value) => {
  if (!value) return null
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const parseQuantityInput = (value, item) => {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return 0
  }

  return normalizeQuantity(numericValue, {
    unitType: item.unit_type,
    minOrderQuantity: item.min_order_quantity,
    fallbackQuantity: item.quantity,
  })
}

// ============================================
// Cart Page Component
// ============================================

const CartPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    items,
    removeItem,
    updateQuantity,
    getSubtotal,
    getTax,
    getVendorCount,
    clearCart,
    validateCart,
    setCheckoutVendor,
    clearCheckoutVendor,
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
  const [lastValidatedAt, setLastValidatedAt] = useState(null)
  const [lastValidationSummary, setLastValidationSummary] = useState('')
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    if (!hasSeenOnboarding()) {
      setShowOnboarding(true)
    }
  }, [])

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
          .from('public_vendor_profiles')
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
  const multiVendorCheckoutDisabledMessage = t('cart.messages.singleVendorCheckout')
  const vendorGroups = useMemo(() => {
    const groups = new Map()

    items.forEach((item) => {
      const key = item.vendor_id || 'unknown-vendor'
      const existing = groups.get(key) || {
        vendorId: key,
        vendorName: item.vendor_name || t('cart.labels.unknownVendor'),
        items: [],
        subtotal: 0,
      }

      existing.items.push(item)
      const itemPrice = item.is_negotiated && item.locked_price != null
        ? Number(item.locked_price)
        : (item.price_per_unit || 0)
      existing.subtotal += itemPrice * item.quantity
      groups.set(key, existing)
    })

    return Array.from(groups.values())
  }, [items, t])

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

      const alerts = {}
      result?.changes?.forEach(change => {
        if (change.type === 'price_changed') {
          alerts[change.item.id] = {
            oldPrice: change.oldPrice,
            newPrice: change.newPrice,
            name: change.item.name,
          }
        }
      })
      setPriceAlerts(alerts)
      setLastValidatedAt(new Date())

      if (!result.valid && result.changes?.length > 0) {
        const removedCount = result.changes.filter(c => c.type === 'removed').length
        const updatedCount = result.changes.filter(c => c.type !== 'removed').length
        const summaryParts = []

        if (removedCount > 0) summaryParts.push(t('cart.validation.itemsRemoved', { count: removedCount }))
        if (updatedCount > 0) summaryParts.push(t('cart.validation.itemsUpdated', { count: updatedCount }))

        setLastValidationSummary(summaryParts.join(' • '))

        if (removedCount > 0) {
          toast.error(t('cart.validation.itemsRemovedToast', { count: removedCount }))
        }
        if (updatedCount > 0) {
          toast(t('cart.validation.itemsUpdatedToast', { count: updatedCount }), { icon: '⚠️' })
        }
      } else {
        setLastValidationSummary(t('cart.validation.synced'))
      }
    } catch (error) {
      logger.error('Cart validation failed:', error)
      setLastValidationSummary(t('cart.validation.syncFailed'))
    } finally {
      setValidating(false)
    }
  }, [t, validateCart])

  // Validate cart on mount and re-validate periodically
  useEffect(() => {
    if (items.length === 0) return

    validateCartOnMount()

    // Re-validate every 5 minutes to catch price/stock changes
    const interval = setInterval(() => {
      validateCartOnMount()
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [items.length, validateCartOnMount])

  // ============================================
  // Quantity Management
  // ============================================

  const handleIncrement = useCallback((item) => {
    // Read from store to avoid stale closure
    const store = useCartStore.getState()
    const currentItem = store.items.find(i => i.id === item.id)
    if (!currentItem) return

    const step = getQuantityStep(currentItem.unit_type, currentItem.min_order_quantity)
    const maxQty = currentItem.available_quantity !== null && currentItem.available_quantity !== undefined
      ? currentItem.available_quantity
      : Infinity

    const newQty = parseFloat((currentItem.quantity + step).toFixed(2))

    if (newQty > maxQty) {
      toast.error(t('cart.errors.maxAvailableReached', {
        quantity: formatQuantity(maxQty, currentItem.unit_type),
        unit: currentItem.unit_type,
      }))
      return
    }

    updateQuantity(item.id, newQty)
    setInputQuantities(prev => ({
      ...prev,
      [item.id]: formatQuantity(newQty, currentItem.unit_type),
    }))
    setInputErrors(prev => ({ ...prev, [item.id]: '' }))
  }, [t, updateQuantity])

  const handleDecrement = useCallback((item) => {
    // Read from store to avoid stale closure
    const store = useCartStore.getState()
    const currentItem = store.items.find(i => i.id === item.id)
    if (!currentItem) return

    const step = getQuantityStep(currentItem.unit_type, currentItem.min_order_quantity)
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

    const parsed = parseQuantityInput(rawValue, item)
    const minQty = item.min_order_quantity || 1
    const maxQty = item.available_quantity !== null && item.available_quantity !== undefined
      ? item.available_quantity
      : null

    let error = ''
    if (parsed === 0) {
      error = t('cart.errors.quantityMustBePositive')
    } else if (parsed < minQty) {
      error = t('cart.errors.minimumOrder', {
        quantity: formatQuantity(minQty, item.unit_type),
        unit: item.unit_type,
      })
    } else if (maxQty !== null && parsed > maxQty) {
      error = t('cart.errors.onlyAvailable', {
        quantity: formatQuantity(maxQty, item.unit_type),
        unit: item.unit_type,
      })
    }

    setInputQuantities(prev => ({ ...prev, [productId]: rawValue }))
    setInputErrors(prev => ({ ...prev, [productId]: error }))
  }, [t])

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

    const parsed = parseQuantityInput(rawValue, item)
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
        [productId]: t('cart.errors.minimumOrder', {
          quantity: formatQuantity(minQty, item.unit_type),
          unit: item.unit_type,
        }),
      }))
      // Revert
      setInputQuantities(prev => ({
        ...prev,
        [productId]: formatQuantity(item.quantity, item.unit_type),
      }))
      return
    }

    if (maxQty !== null && parsed > maxQty) {
      const clampedMaxQty = normalizeQuantity(maxQty, {
        unitType: item.unit_type,
        minOrderQuantity: minQty,
        fallbackQuantity: maxQty,
      })

      if (clampedMaxQty <= 0 || clampedMaxQty < minQty) {
        setPendingRemove({ id: item.id, name: item.name })
        setInputQuantities(prev => ({
          ...prev,
          [productId]: formatQuantity(item.quantity, item.unit_type),
        }))
        return
      }

      setInputErrors(prev => ({
        ...prev,
        [productId]: t('cart.errors.onlyAvailable', {
          quantity: formatQuantity(maxQty, item.unit_type),
          unit: item.unit_type,
        }),
      }))
      // Clamp to max AND update store to keep them in sync
      updateQuantity(item.id, clampedMaxQty)
      setInputQuantities(prev => ({
        ...prev,
        [productId]: formatQuantity(clampedMaxQty, item.unit_type),
      }))
      return
    }

    // Valid input — update cart
    if (parsed !== item.quantity) {
      updateQuantity(item.id, parsed)
    }
    setInputErrors(prev => ({ ...prev, [productId]: '' }))
  }, [inputQuantities, t, updateQuantity])

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
    toast.success(t('cart.messages.cartCleared'))
  }, [clearCart, t])

  // ============================================
  // Checkout with Server Validation
  // ============================================

  const handleCheckout = useCallback(async () => {
    if (items.length === 0) return

    if (!user) {
      setShowLoginPrompt(true)
      return
    }

    const vendorIds = [...new Set(items.map((item) => item.vendor_id).filter(Boolean))]
    if (vendorIds.length > 1) {
      toast.error(multiVendorCheckoutDisabledMessage)
      return
    }

    setCheckoutLoading(true)
    try {
      const { data: freshVendorProfiles, error: vendorProfilesError } = await supabase
        .from('public_vendor_profiles')
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
          issues.push(t('cart.checkout.itemUnavailable', { name: item.name }))
          continue
        }

        // Skip price check for negotiated items (locked price)
        if (!item.is_negotiated) {
          const priceDiff = Math.abs(fresh.price_per_unit - item.price_per_unit)
          if (priceDiff > 0.01) {
            issues.push(t('cart.checkout.priceChanged', {
              name: item.name,
              oldPrice: formatPrice(item.price_per_unit),
              newPrice: formatPrice(fresh.price_per_unit),
            }))
          }
        }

        // Verify stock
        if (fresh.available_quantity !== null && item.quantity > fresh.available_quantity) {
          issues.push(t('cart.checkout.onlyAvailable', {
            name: item.name,
            quantity: formatQuantity(fresh.available_quantity, item.unit_type),
            unit: item.unit_type,
          }))
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
      clearCheckoutVendor()
      navigate('/checkout')
    } catch (error) {
      logger.error('Checkout validation error:', error)
      toast.error(t('cart.checkout.validationFailed'))
    } finally {
      setCheckoutLoading(false)
    }
  }, [clearCheckoutVendor, items, multiVendorCheckoutDisabledMessage, navigate, t, user, validateCart])

  const handleCheckoutForVendor = useCallback((vendorId) => {
    const didSelectVendor = setCheckoutVendor(vendorId)

    if (!didSelectVendor) {
      toast.error(t('cart.checkout.prepareVendorCartFailed'))
      return
    }

    toast.success(t('cart.checkout.prepareVendorCartSuccess'))
    navigate('/checkout')
  }, [navigate, setCheckoutVendor, t])

  // ============================================
  // Computed Values
  // ============================================

  const subtotal = getSubtotal()
  const tax = getTax()
  const total = subtotal + tax
  const vendorCount = getVendorCount()
  const multiVendorCheckoutBlocked = vendorCount > 1

  const vendorIds = useMemo(() => [...new Set(items.map((item) => item.vendor_id).filter(Boolean))], [items])

  const { data: bulkCoupons = [] } = useQuery({
    queryKey: ['bulk-discount-candidates', vendorIds],
    queryFn: () => couponsApi.getBulkDiscountCandidates(vendorIds),
    enabled: vendorIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const bulkDiscountPreview = useMemo(() => {
    if (items.length === 0 || bulkCoupons.length === 0) return 0
    const breakdown = calculateBulkDiscountBreakdown({ coupons: bulkCoupons, items })
    return breakdown.reduce((sum, b) => sum + Number(b.discountAmount || 0), 0)
  }, [items, bulkCoupons])

  const bulkDiscountHint = useMemo(() => {
    if (items.length === 0 || bulkCoupons.length === 0) return null
    const next = bulkCoupons
      .filter((c) => {
        const vendorItems = items.filter((i) => i.vendor_id === c.vendor_id)
        const vendorSubtotal = vendorItems.reduce((s, i) => s + (i.is_negotiated && i.locked_price != null ? Number(i.locked_price) : Number(i.price_per_unit || 0)) * i.quantity, 0)
        return vendorSubtotal < Number(c.min_order_amount || 0)
      })
      .sort((a, b) => Number(a.min_order_amount || 0) - Number(b.min_order_amount || 0))[0]
    if (!next) return null
    const vendorItems = items.filter((i) => i.vendor_id === next.vendor_id)
    const vendorSubtotal = vendorItems.reduce((s, i) => s + (i.is_negotiated && i.locked_price != null ? Number(i.locked_price) : Number(i.price_per_unit || 0)) * i.quantity, 0)
    const remaining = Number(next.min_order_amount || 0) - vendorSubtotal
    if (remaining <= 0) return null
    return t('cart.summary.bulkDiscountHint', 'Add {{amount}} more to unlock bulk discount', { amount: formatPrice(remaining) })
  }, [items, bulkCoupons, t])

  // ============================================
  // Empty State
  // ============================================

  if (items.length === 0 && !validating) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center" data-testid="cart-empty-state">
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 lg:pb-8" data-testid="cart-page">
      <Breadcrumbs />
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('cart.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} {items.length !== 1 ? t('cart.items') : t('cart.item')}
            {vendorCount > 1 && ` ${t('cart.fromVendors', { count: vendorCount })}`}
          </p>
          {(lastValidatedAt || lastValidationSummary) && (
            <p className="text-xs text-gray-500 mt-2" data-testid="cart-validation-status">
              {lastValidationSummary}
              {lastValidatedAt && ` · ${t('cart.validation.lastChecked', { time: formatValidationTime(lastValidatedAt) })}`}
            </p>
          )}
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={validateCartOnMount}
              disabled={validating}
              data-testid="cart-refresh-status"
              className="text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {validating ? t('cart.validation.checking') : t('cart.validation.refreshPrices')}
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
            >
              {t('cart.clearCart')}
            </button>
          </div>
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
            {!user && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  {t('cart.guestNotice', 'Your cart is saved on this device. Sign in to complete checkout and access it from any device.')}
                </p>
              </div>
            )}

            {multiVendorCheckoutBlocked && vendorGroups.length > 1 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 space-y-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-amber-900">{t('cart.checkout.splitCartTitle')}</h2>
                  <p className="text-sm text-amber-800 mt-1 leading-6">
                    {t('cart.checkout.splitCartDescription')}
                  </p>
                </div>

                <div className="space-y-3">
                  {vendorGroups.map((group) => (
                    <div
                      key={group.vendorId}
                      className="rounded-xl border border-amber-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{group.vendorName}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {t('cart.checkout.vendorItemSummary', { count: group.items.length })} · {formatPrice(group.subtotal)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCheckoutForVendor(group.vendorId)}
                        className="btn-outline w-full sm:w-auto"
                      >
                        {t('cart.checkout.selectVendorAndContinue')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {items.map((item) => {
              const effectivePrice = item.is_negotiated && item.locked_price != null
                ? Number(item.locked_price)
                : (item.price_per_unit || 0)
              const itemTotal = effectivePrice * item.quantity
              const isLowStock = item.available_quantity !== null && item.available_quantity <= item.quantity * 1.25
              const isAtMax = item.available_quantity !== null && item.quantity >= item.available_quantity
              const step = getQuantityStep(item.unit_type, item.min_order_quantity)
              const minQty = item.min_order_quantity || 1
              const inputError = inputErrors[item.id]
              const displayQty = inputQuantities[item.id] ?? formatQuantity(item.quantity, item.unit_type)
              const hasPriceAlert = priceAlerts[item.id]

              return (
                <div
                  key={item.id}
                  data-testid="cart-item"
                  data-product-id={item.id}
                  className={`bg-white border rounded-xl overflow-hidden transition-all ${
                    inputError ? 'border-red-300 shadow-sm shadow-red-100' : 'border-gray-200'
                  }`}
                >
                  {/* Vendor Label */}
                  {vendorCount > 1 && item.vendor_name && (
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        {t('cart.labels.vendorPrefix', { name: item.vendor_name })}
                      </p>
                    </div>
                  )}

                  {/* Price Change Alert */}
                  {hasPriceAlert && (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                      <BoltIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-amber-700">
                        {t('cart.labels.priceUpdated', {
                          oldPrice: formatPrice(hasPriceAlert.oldPrice),
                          newPrice: formatPrice(hasPriceAlert.newPrice),
                        })}
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
                              className="font-semibold text-gray-900 hover:text-primary-600 transition-colors truncate block"
                            >
                              {item.name}
                            </Link>
                            <p className="text-sm text-gray-500 mt-0.5">
                              {formatPrice(effectivePrice)} / {item.unit_type}
                            </p>
                            {item.is_negotiated ? (
                              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primary-50 border border-primary-200 text-xs font-medium text-primary-700">
                                <LockClosedIcon className="w-3 h-3" />
                                {t('cart.negotiatedPrice', 'Agreed Price')}
                                {item.negotiation_id && (
                                  <Link
                                    to={`/buyer/negotiations/${item.negotiation_id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-primary-600 hover:text-primary-800 underline"
                                  >
                                    {t('cart.viewNegotiation', 'Details')}
                                  </Link>
                                )}
                              </span>
                            ) : item.is_available !== false && (
                              <button
                                onClick={() => {
                                  removeItem(item.id)
                                  navigate(`/buyer/negotiations/new?productId=${item.id}`)
                                }}
                                className="inline-flex items-center gap-1 mt-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                              >
                                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                                {t('cart.negotiateInstead', 'Negotiate price instead')}
                              </button>
                            )}
                          </div>

                          {/* Remove */}
                          <button
                            onClick={() => setPendingRemove({ id: item.id, name: item.name })}
                            data-testid="cart-item-remove"
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                            aria-label={t('cart.removeItemAria', { name: item.name })}
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Low Stock Warning */}
                        {isLowStock && (
                          <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                            <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            {t('cart.errors.onlyAvailable', {
                              quantity: formatQuantity(item.available_quantity, item.unit_type),
                              unit: item.unit_type,
                            })}
                            {item.quantity > item.available_quantity * 0.8 && (
                              <span className="ml-1 px-1.5 py-0.5 bg-orange-100 rounded text-[10px] font-medium">
                                {t('cart.labels.stockReservedBadge')}
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
                              data-testid="cart-item-decrement"
                              className="w-9 h-9 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                              aria-label={t('cart.aria.decrease', 'إنقاص الكمية')}
                            >
                              <MinusIcon className="w-4 h-4" />
                            </button>

                            {/* Manual Input */}
                            <div className="relative">
                              <input
                                type="text"
                                inputMode={isDecimalQuantityUnit(item.unit_type) ? 'decimal' : 'numeric'}
                                value={displayQty}
                                onChange={(e) => handleInputChange(item, e.target.value)}
                                onBlur={() => handleInputBlur(item)}
                                onKeyDown={(e) => handleInputKeyDown(item, e)}
                                data-testid="cart-item-quantity-input"
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
                              data-testid="cart-item-increment"
                              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                                isAtMax
                                  ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                              }`}
                              aria-label={t('cart.aria.increase', 'زيادة الكمية')}
                            >
                              <PlusIcon className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Step Info */}
                          <p className="text-xs text-gray-400 sm:text-right">
                            {t('cart.labels.unitStep', {
                              quantity: formatQuantity(step, item.unit_type),
                              unit: item.unit_type,
                            })}
                            {minQty > 1 && ` · ${t('cart.labels.minimumLabel', { quantity: formatQuantity(minQty, item.unit_type) })}`}
                          </p>

                          {/* Item Subtotal */}
                          <div className="text-right sm:min-w-[100px]" data-testid="cart-item-total">
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
            <div className="card p-6 sticky top-24 bg-white border border-gray-200 rounded-xl" data-testid="cart-summary">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('cart.orderSummary')}</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>{t('cart.summary.subtotalWithCount', { count: items.length })}</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {bulkDiscountPreview > 0 && (
                  <div className="flex justify-between text-sm text-emerald-700" data-testid="cart-bulk-discount-preview">
                    <span>{t('cart.summary.bulkDiscount', 'Bulk discount preview')}</span>
                    <span>- {formatPrice(bulkDiscountPreview)}</span>
                  </div>
                )}
                {bulkDiscountPreview === 0 && bulkDiscountHint && (
                  <div className="text-xs text-gray-400 leading-4" data-testid="cart-bulk-discount-hint">
                    {bulkDiscountHint}
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>{t('cart.summary.tax')}</span>
                    <span>{formatPrice(tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <span>{t('cart.summary.delivery')}</span>
                  <span className="text-gray-400 text-sm">{t('cart.summary.deliveryAtCheckout')}</span>
                </div>
                {vendorCount > 1 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{t('cart.summary.multiVendorOrder')}</span>
                    <span>{t('cart.summary.vendorCount', { count: vendorCount })}</span>
                  </div>
                )}
                {multiVendorCheckoutBlocked && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 leading-5">
                    {multiVendorCheckoutDisabledMessage}
                  </div>
                )}
                {minimumOrderStatus.hasViolations && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                    {minimumOrderStatus.violations.map((vendor) => (
                      <div key={vendor.vendorId} className="text-xs text-amber-800">
                        <p className="font-semibold">{vendor.vendorName}</p>
                        <p>
                          {t('cart.summary.minimumOrderStatus', {
                            minAmount: formatPrice(vendor.minOrderAmount),
                            shortfall: formatPrice(vendor.shortfall),
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Delivery Rules Notice */}
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                  <div className="flex items-start gap-2">
                    <InformationCircleIcon className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 leading-5">
                      {t('cart.summary.deliveryRulesNotice', 'Delivery availability depends on the distance between your location and each vendor, as well as order value. Delivery terms will be reviewed before completing the order.')}
                    </p>
                  </div>
                </div>
                <hr className="border-gray-200" />
                <div className="flex justify-between text-xl font-bold text-gray-900" data-testid="cart-total">
                  <span>{t('cart.total')}</span>
                  <span className="text-primary-600">{formatPrice(total)}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={checkoutLoading || minimumOrderStatus.hasViolations || multiVendorCheckoutBlocked}
                data-testid="cart-checkout-btn"
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {checkoutLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {t('cart.validation.checking')}
                  </>
                ) : multiVendorCheckoutBlocked ? (
                  t('cart.checkout.splitByVendorCta')
                ) : minimumOrderStatus.hasViolations ? (
                  t('cart.checkout.minimumNotMetCta')
                ) : (
                  <>
                    {t('cart.checkoutLabel')}
                    <ArrowRightIcon className="w-5 h-5" />
                  </>
                )}
              </button>

              <Link to="/marketplace" className="btn-ghost w-full mt-3 text-center block">
                {t('cart.continueShopping')}
              </Link>

              {/* Trust Badges */}
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-primary-600" />
                  <span>{t('cart.trust.securePayment')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-primary-600" />
                  <span>{t('cart.trust.buyerProtection')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-primary-600" />
                  <span>{t('cart.trust.qualityGuarantee')}</span>
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
                <p className="text-xs text-gray-500">{t('cart.summary.totalWithCount', { count: items.length })}</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(total)}</p>
                {tax > 0 && <p className="text-xs text-gray-400">{t('cart.summary.taxIncluded', { amount: formatPrice(tax) })}</p>}
                {multiVendorCheckoutBlocked && (
                  <p className="text-xs text-amber-700 mt-1">{t('cart.checkout.splitByVendorHint')}</p>
                )}
                {minimumOrderStatus.hasViolations && (
                  <p className="text-xs text-amber-700 mt-1">{t('cart.checkout.minimumNotMetHint')}</p>
                )}
              </div>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading || minimumOrderStatus.hasViolations || multiVendorCheckoutBlocked}
                data-testid="cart-checkout-btn"
                className="btn-primary flex items-center gap-2 px-8 py-3 text-base disabled:opacity-60"
              >
                {checkoutLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {t('cart.validation.checking')}
                  </>
                ) : multiVendorCheckoutBlocked ? (
                  t('cart.checkout.splitByVendorShortCta')
                ) : minimumOrderStatus.hasViolations ? (
                  t('cart.checkout.minimumNotMetShortCta')
                ) : (
                  <>
                    {t('cart.checkoutLabel')}
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
          data-testid="cart-remove-dialog"
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
              {t('cart.removeDialog.title')}
            </h3>
            <p className="text-sm text-gray-600 mb-6 text-center">
              {t('cart.removeDialog.description', { name: pendingRemove.name })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingRemove(null)}
                className="btn-outline flex-1"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmRemoveItem}
                data-testid="cart-remove-confirm"
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
              >
                {t('common.delete')}
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
              {t('cart.clearDialog.title')}
            </h3>
            <p className="text-sm text-gray-600 mb-6 text-center">
              {t('cart.clearDialog.description', { count: items.length })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn-outline flex-1"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmClearCart}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
              >
                {t('cart.clearDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Checkout Login Prompt */}
      {showLoginPrompt && (
        <AuthGate
          variant="modal"
          icon={ShoppingCartIcon}
          title={t('cart.guestCheckout.title', 'تسجيل الدخول مطلوب')}
          message={t('cart.guestCheckout.message', 'يجب تسجيل الدخول لإكمال الطلب. سلتك محفوظة.')}
          from="/checkout"
          loginTo="/login"
          registerTo="/register"
          showRegister
          onCancel={() => setShowLoginPrompt(false)}
        />
      )}

      {/* Onboarding Modal */}
      <NegotiationOnboarding
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onSkip={() => setShowOnboarding(false)}
      />

      {/* Cross-sell recommendations */}
      <ProductRecommendations className="mt-8" />
    </div>
  )
}

export default CartPage
