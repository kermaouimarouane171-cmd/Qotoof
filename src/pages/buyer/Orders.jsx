import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/modules/cart'
import { Card, LoadingSpinner, EmptyState, StateSkeleton as Skeleton, Breadcrumbs } from '@/components/ui'
import { useTranslation } from 'react-i18next'
import { ordersApi } from '@/modules/orders'
import { deliveriesApi } from '@/modules/delivery'
import { fetchBuyerOrders } from '@/services/ordersService'
import { supabase } from '@/services/supabase'
import {
  XMarkIcon,
  CheckCircleIcon,
  CheckIcon,
  ShoppingBagIcon,
  TruckIcon,
  MapPinIcon,
  EyeIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { reviewService } from '@/modules/reviews'
import invoiceService from '@/services/invoiceService'
import loyaltyApi from '@/modules/loyalty'
// STATUS_CONFIG migrated -> constants/orderStatuses.js
import OrderCard from '@/components/buyer/OrderCard'
import ReviewModal from '@/components/buyer/ReviewModal'
import OrderFilters from '@/components/buyer/OrderFilters'
// @react-pdf/renderer is loaded dynamically inside handleDownloadInvoice (see below)

// ============================================
// Constants & Helpers
// ============================================

const getFilterTabs = (t) => [
  { id: 'all', label: t('buyer.orders.filters.all', 'All Orders') },
  { id: 'active', label: t('buyer.orders.filters.active', 'In Progress') },
  { id: 'delivered', label: t('buyer.orders.filters.delivered', 'Completed') },
  { id: 'cancelled', label: t('buyer.orders.filters.cancelled', 'Cancelled') },
]

// ============================================
// Main Orders Page
// ============================================

const OrdersPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile, user } = useAuthStore()
  const { addItem } = useCartStore()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDelivery, setActiveDelivery] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [reviewOrder, setReviewOrder] = useState(null)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [returnOrder, setReturnOrder] = useState(null)
  const [returnReason, setReturnReason] = useState('')
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState(new Set())
  const [_downloadingInvoice, setDownloadingInvoice] = useState(null)
  const subscriptionRef = useRef(null)
  const currentPageRef = useRef(1)
  const isMountedRef = useRef(true)
  const buyerId = profile?.id

  // Server-side pagination state
  const PAGE_SIZE = 20
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  // Advanced filters
  const [advancedFilters, setAdvancedFilters] = useState({
    dateFrom: '',
    dateTo: '',
    priceMin: '',
    priceMax: '',
    paymentStatus: '',
  })

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  /**
   * Load orders from server with pagination
   * @param {number} pageNum - Page number to load
   * @param {boolean} silent - If true, don't show loading spinner
   */
  const loadOrders = useCallback(async (pageNum = 1, silent = false) => {
    if (!buyerId) return

    if (silent) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      const pageEndIndex = pageNum * PAGE_SIZE - 1

      const { data, error, total } = await fetchBuyerOrders(buyerId, {
        status: filter,
        dateFrom: advancedFilters.dateFrom,
        dateTo: advancedFilters.dateTo,
        page: pageNum,
        limit: PAGE_SIZE,
      })

      if (error) {
        throw error
      }

      if (!isMountedRef.current) return

      const count = total || 0

      setTotalCount(count)
      setHasMore(count > pageEndIndex + 1)

      if (pageNum === 1) {
        setOrders(data || [])
      } else {
        setOrders(prev => [...prev, ...(data || [])])
      }

      setPage(pageNum)
    } catch (error) {
      if (!isMountedRef.current) return
      logger.error('Error loading orders:', error)
      toast.error(t('buyer.orders.notifications.loadFailed', 'Failed to load orders'))
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [advancedFilters.dateFrom, advancedFilters.dateTo, buyerId, filter, t])

  // Load orders with server-side pagination
  useEffect(() => {
    if (!buyerId) return undefined
    loadOrders(1) // Reset to page 1 on mount or filter change
    return undefined
  }, [buyerId, loadOrders])

  useEffect(() => {
    if (!buyerId || subscriptionRef.current) return undefined

    const handleOrderChange = () => {
      loadOrders(currentPageRef.current, true)
    }

    if (typeof supabase?.channel === 'function') {
      const channel = supabase
        .channel(`buyer-orders-${buyerId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `buyer_id=eq.${buyerId}`,
          },
          handleOrderChange,
        )
        .subscribe()

      subscriptionRef.current = channel
    } else if (typeof ordersApi?.subscribeToBuyerOrders === 'function') {
      subscriptionRef.current = ordersApi.subscribeToBuyerOrders(buyerId, handleOrderChange)
    } else {
      return undefined
    }

    return () => {
      if (subscriptionRef.current) {
        const activeSubscription = subscriptionRef.current

        if (typeof activeSubscription === 'function') {
          activeSubscription()
        } else if (typeof activeSubscription?.unsubscribe === 'function') {
          activeSubscription.unsubscribe()
        } else if (typeof supabase?.removeChannel === 'function') {
          supabase.removeChannel(activeSubscription)
        }

        subscriptionRef.current = null
      }
    }
  }, [buyerId, loadOrders])

  useEffect(() => {
    currentPageRef.current = page
  }, [page])

  // Load active delivery
  useEffect(() => {
    if (!buyerId) return undefined
    loadActiveDelivery()
    return undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerId])

  useEffect(() => {
    if (!buyerId) return undefined

    let cancelled = false

    const syncBuyerBenefits = async () => {
      try {
        const result = await loyaltyApi.syncDeliveredOrderBenefits(buyerId)
        if (!cancelled && result?.ordersProcessed > 0) {
          loadOrders(1, true)
        }
      } catch (error) {
        logger.warn('Buyer loyalty sync skipped:', error)
      }
    }

    syncBuyerBenefits()

    return () => {
      cancelled = true
    }
  }, [buyerId, loadOrders])

  /**
   * Load more orders (infinite scroll style)
   */
  const loadMoreOrders = () => {
    if (!loadingMore && hasMore && !loading) {
      loadOrders(page + 1)
    }
  }

  const loadActiveDelivery = useCallback(async () => {
    if (!buyerId) return
    try {
      const delivery = await deliveriesApi.getBuyerActiveDelivery(buyerId)
      if (!isMountedRef.current) return
      setActiveDelivery(delivery)
    } catch {
      if (!isMountedRef.current) return
      setActiveDelivery(null)
    }
  }, [buyerId])

  // ============================================
  // Search Suggestions
  // ============================================

  const searchSuggestionsList = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return []
    const q = searchQuery.toLowerCase()
    const suggestions = new Set()

    orders.forEach(order => {
      if (order.order_number?.toLowerCase().includes(q)) {
        suggestions.add(order.order_number)
      }
      if (order.vendor?.store_name?.toLowerCase().includes(q)) {
        suggestions.add(order.vendor.store_name)
      }
      order.items?.forEach(item => {
        if (item.product?.name?.toLowerCase().includes(q)) {
          suggestions.add(item.product.name)
        }
      })
    })

    return Array.from(suggestions).slice(0, 5)
  }, [searchQuery, orders])

  const handleSearchChange = (value) => {
    setSearchQuery(value)
    setShowSuggestions(value.length >= 2)
  }

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion)
    setShowSuggestions(false)
  }

  // ============================================
  // Filtered Orders (client-side only: search, price, payment)
  // Status and date filters are applied server-side
  // ============================================

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Search (client-side since it needs nested data)
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesOrderNumber = order.order_number?.toLowerCase().includes(q)
        const matchesVendor = order.vendor?.store_name?.toLowerCase().includes(q) ||
          `${order.vendor?.first_name} ${order.vendor?.last_name}`.toLowerCase().includes(q)
        const matchesItems = order.items?.some(item =>
          item.product?.name?.toLowerCase().includes(q)
        )
        if (!matchesOrderNumber && !matchesVendor && !matchesItems) return false
      }

      // Price filters (client-side)
      if (advancedFilters.priceMin) {
        if (order.total < parseFloat(advancedFilters.priceMin)) return false
      }
      if (advancedFilters.priceMax) {
        if (order.total > parseFloat(advancedFilters.priceMax)) return false
      }
      if (advancedFilters.paymentStatus) {
        if (advancedFilters.paymentStatus === 'cod' && order.payment_method !== 'cod') return false
        if (advancedFilters.paymentStatus === 'paid' && order.payment_method === 'cod') return false
        if (advancedFilters.paymentStatus === 'pending' && order.status === 'pending' && !order.payment_method) return false
      }

      return true
    })
  }, [orders, searchQuery, advancedFilters.priceMin, advancedFilters.priceMax, advancedFilters.paymentStatus])

  // ============================================
  // Actions
  // ============================================

  const handleReorder = useCallback(async (order) => {
    if (!order.items || order.items.length === 0) {
      toast.error(t('buyer.orders.notifications.reorderNoItems', 'This order has no items to re-order'))
      return
    }

    let addedCount = 0
    for (const item of order.items) {
      const product = item.product
      if (!product) continue

      const cartItem = {
        id: item.product_id,
        name: product.name,
        price_per_unit: item.unit_price || product.price_per_unit,
        unit_type: item.unit_type || product.unit_type || 'kg',
        quantity: item.quantity,
        min_order_quantity: product.min_order_quantity || 1,
        is_available: product.is_available ?? true,
        available_quantity: product.available_quantity ?? null,
        vendor_id: order.vendor_id,
        vendor_name: order.vendor?.store_name,
        image_url: product.images?.[0]?.url || product.image_url || null,
        category: product.category,
      }

      const result = addItem(cartItem, item.quantity)
      if (result) addedCount++
    }

    if (addedCount > 0) {
      toast.success(t('buyer.orders.notifications.reorderSuccess', '{{count}} item(s) added to cart', { count: addedCount }))
      navigate('/cart')
    } else {
      toast.error(t('buyer.orders.notifications.reorderFailed', 'Could not add any items (they may be unavailable)'))
    }
  }, [addItem, navigate, t])

  const handleReviewSubmit = useCallback(async (orderId, rating, comment) => {
    const targetOrder = orders.find((currentOrder) => currentOrder.id === orderId)

    await reviewService.createReview({
      orderId,
      vendorId: targetOrder?.vendor_id,
      productId: targetOrder?.items?.[0]?.product_id || targetOrder?.items?.[0]?.product?.id || null,
      userId: user.id,
      rating,
      comment,
    })

    toast.success(t('buyer.orders.notifications.reviewSubmitted', 'Review submitted successfully!'))
    await loadOrders()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, user?.id, t])

  const handleReturnSubmit = useCallback(async () => {
    if (!returnReason.trim()) {
      toast.error(t('buyer.orders.returnModal.error', 'Please provide a reason for the return'))
      return
    }

    setReturnSubmitting(true)
    try {
      const { error } = await supabase
        .from('return_requests')
        .insert({
          order_id: returnOrder.id,
          buyer_id: user.id,
          user_id: user.id,
          vendor_id: returnOrder.vendor_id,
          reason: returnReason,
          status: 'pending',
        })

      if (error) throw error
      toast.success(t('buyer.orders.returnModal.submitted', 'Return request submitted successfully'))
      setReturnModalOpen(false)
      setReturnOrder(null)
      setReturnReason('')
    } catch (error) {
      logger.error('Error submitting return request:', error)
      toast.error(t('buyer.orders.returnModal.failed', 'Failed to submit return request'))
    } finally {
      setReturnSubmitting(false)
    }
  }, [returnOrder, returnReason, user?.id, t])

  const handleViewDetails = useCallback((orderId) => {
    navigate(`/orders/${orderId}`)
  }, [navigate])

  // ============================================
  // Invoice PDF Download
  // ============================================

  const handleDownloadInvoice = useCallback(async (order) => {
    setDownloadingInvoice(order.id)
    try {
      const invoice = await invoiceService.downloadOrderInvoice(order)
      toast.success(t('buyer.orders.notifications.invoiceDownloaded', 'Official invoice {{number}} downloaded', { number: invoice.invoice_number || '' }))
    } catch (error) {
      logger.error('Error generating invoice PDF:', error)
      toast.error(t('buyer.orders.notifications.invoiceFailed', 'Failed to download invoice'))
    } finally {
      setDownloadingInvoice(null)
    }
  }, [t])

  // ============================================
  // Selection
  // ============================================

  const handleSelectOrder = useCallback((orderId) => {
    setSelectedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)))
    }
  }, [filteredOrders, selectedOrders.size])

  const handleClearSelection = useCallback(() => {
    setSelectedOrders(new Set())
  }, [])

  const handleAdvancedFilterChange = useCallback((key, value) => {
    setAdvancedFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleClearAdvancedFilters = useCallback(() => {
    setAdvancedFilters({
      dateFrom: '',
      dateTo: '',
      priceMin: '',
      priceMax: '',
      paymentStatus: '',
    })
  }, [])

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton.Card className="h-32" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton.Card key={index} className="h-72" />
          ))}
        </div>
      </div>
    )
  }

  const activeDriverPhone = activeDelivery?.driver?.phone
    ? String(activeDelivery.driver.phone).trim()
    : ''

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs />
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{t('buyer.orders.title', 'My Orders')}</h1>
        <p className="text-gray-500 text-sm">
          {t('buyer.orders.ordersTotal', '{{count}} order(s) total', { count: orders.length })}
        </p>
      </div>
      {/* ===== Active Delivery Tracking Banner ===== */}
      {activeDelivery && (
        <Card className="mb-8 border-2 border-green-200 bg-green-50/50 overflow-hidden">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{t('buyer.orders.liveDeliveryTracking', 'Live Delivery Tracking')}</h3>
                <p className="text-sm text-gray-500 truncate">
                  {t('buyer.orders.orderOnTheWay', 'Order {{orderNumber}} is on the way!', { orderNumber: activeDelivery.order?.order_number })}
                </p>
              </div>
              <button
                onClick={() => navigate(`/orders/${activeDelivery.order_id}/tracking`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <EyeIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{t('buyer.orders.trackLive', 'Track Live')}</span>
                <span className="sm:hidden">{t('buyer.orders.track', 'Track')}</span>
              </button>
            </div>

            {/* Driver Info */}
            {activeDelivery.driver && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 font-bold text-sm">
                      {activeDelivery.driver.first_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {activeDelivery.driver.first_name} {activeDelivery.driver.last_name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {activeDelivery.driver.vehicle_type}
                      {activeDelivery.driver.vehicle_plate && ` • ${activeDelivery.driver.vehicle_plate}`}
                    </p>
                  </div>
                </div>
                {activeDriverPhone ? (
                  <a
                    href={`tel:${activeDriverPhone}`}
                    className="inline-flex items-center gap-1.5 text-sm text-green-600 font-medium hover:text-green-700"
                  >
                    <PhoneIcon className="w-4 h-4" />
                    {t('buyer.orders.callDriver', 'Call Driver')}
                  </a>
                ) : (
                  <p className="text-xs text-gray-500">
                    {t('buyer.orders.driverPhoneUnavailable', 'Driver phone unavailable')}
                  </p>
                )}
              </div>
            )}

            {/* Progress Steps */}
            <div className="flex items-center gap-0">
              {[
                { status: 'driver_accepted', label: 'buyer.orders.status.driver_accepted', icon: CheckCircleIcon },
                { status: 'driver_picked_up', label: 'buyer.orders.status.driver_picked_up', icon: ShoppingBagIcon },
                { status: 'on_the_way', label: 'buyer.orders.status.on_the_way', icon: TruckIcon },
                { status: 'delivered', label: 'buyer.orders.status.delivered', icon: MapPinIcon },
              ].map((step, index) => {
                const statuses = ['driver_accepted', 'driver_picked_up', 'on_the_way', 'delivered']
                const currentIndex = statuses.indexOf(activeDelivery.status)
                const isCompleted = index <= currentIndex
                const isCurrent = index === currentIndex

                return (
                  <div key={step.status} className="flex items-center flex-1" data-cy={`order-status-${step.status}`}>
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                      } ${isCurrent ? 'ring-4 ring-green-200' : ''}`}>
                        <step.icon className="w-4 h-4" />
                      </div>
                      <span className={`text-[10px] sm:text-xs font-medium mt-1 text-center ${
                        isCompleted ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {t(step.label, step.label.split('.').pop())}
                      </span>
                    </div>
                    {index < 3 && (
                      <div className={`flex-1 h-0.5 mx-1 mb-6 ${
                        index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ===== Search & Filter Tabs ===== */}
      <OrderFilters
        t={t}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onClearSearch={() => {
          setSearchQuery('')
          setShowSuggestions(false)
        }}
        onSearchFocus={() => searchSuggestionsList.length > 0 && setShowSuggestions(true)}
        onSearchBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        showSuggestions={showSuggestions}
        suggestions={searchSuggestionsList}
        onSuggestionClick={handleSuggestionClick}
        filter={filter}
        onFilterChange={setFilter}
        filterTabs={getFilterTabs(t)}
        advancedFilters={advancedFilters}
        onAdvancedFilterChange={handleAdvancedFilterChange}
        onClearAdvancedFilters={handleClearAdvancedFilters}
        totalCount={totalCount}
      />

      {/* ===== Selection Bar ===== */}
      {selectedOrders.size > 0 && (
        <div className="flex items-center justify-between mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
          <span className="text-sm font-medium text-green-700">
            {selectedOrders.size} {t('buyer.orders.selectionCount', 'order(s) selected', { count: selectedOrders.size })}
          </span>
          <button
            onClick={handleClearSelection}
            className="text-sm text-green-600 hover:underline"
          >
            {t('buyer.orders.clearSelection', 'Clear selection')}
          </button>
        </div>
      )}

      {/* ===== Select All Checkbox (when orders exist) ===== */}
      {filteredOrders.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleSelectAll}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              selectedOrders.size === filteredOrders.length && filteredOrders.length > 0
                ? 'bg-green-600 border-green-600'
                : selectedOrders.size > 0
                  ? 'bg-green-300 border-green-300'
                  : 'border-gray-300 hover:border-green-400'
            }`}
            aria-label={t('buyer.orders.selectAll', 'Select all orders')}
          >
            {selectedOrders.size === filteredOrders.length && filteredOrders.length > 0 && (
              <CheckIcon className="w-3 h-3 text-white" />
            )}
          </button>
          <span className="text-sm text-gray-500">{t('buyer.orders.selectAll', 'Select all')} ({filteredOrders.length})</span>
        </div>
      )}

      {/* ===== Orders Grid ===== */}
      {filteredOrders.length === 0 ? (
        orders.length === 0 ? (
          <EmptyState
            icon="shopping"
            title={t('buyer.orders.emptyState.noOrdersYet', 'No orders yet')}
            description={t('buyer.orders.emptyState.browseMarketplace', 'Browse the marketplace to place your first order')}
            actionLabel={t('buyer.orders.emptyState.startShopping', 'Start Shopping')}
            onAction={() => navigate('/marketplace')}
          />
        ) : (
          <EmptyState
            icon="search"
            title={t('buyer.orders.emptyState.noMatch', 'No matching orders')}
            description={t('buyer.orders.emptyState.tryAdjusting', 'Try adjusting your search or filter criteria')}
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onReorder={handleReorder}
                onReview={setReviewOrder}
                onReturn={(order) => { setReturnOrder(order); setReturnModalOpen(true) }}
                onViewDetails={handleViewDetails}
                onDownloadInvoice={handleDownloadInvoice}
                isSelected={selectedOrders.has(order.id)}
                onSelect={handleSelectOrder}
                cardDataCy={`order-card-${order.id}`}
                statusDataCy={`order-status-${order.status}-${order.id}`}
                t={t}
              />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex flex-col items-center gap-2 mt-8">
              <button
                onClick={loadMoreOrders}
                disabled={loadingMore}
                className="btn-primary px-8 disabled:opacity-60"
              >
                {loadingMore ? (
                  <>
                    <LoadingSpinner size="sm" /> {t('common.loading', 'Loading...')}
                  </>
                ) : (
                  <>{t('buyer.orders.loadMore', 'Load More Orders')}</>
                )}
              </button>
              <p className="text-xs text-gray-400">
                {t('buyer.orders.showingCount', 'Showing {{shown}} of {{total}} order(s)', { shown: orders.length, total: totalCount })}
              </p>
            </div>
          )}
        </>
      )}

      {/* ===== Review Modal ===== */}
      {reviewOrder && (
        <ReviewModal
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
          onSubmit={handleReviewSubmit}
        />
      )}

      {/* ===== Return Request Modal ===== */}
      {returnModalOpen && returnOrder && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('buyer.orders.returnModal.title', 'Request Return')}</h3>
              <button
                onClick={() => setReturnModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
                aria-label={t('common.close', 'Close')}
              >
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              {t('buyer.orders.orderLabel', 'Order')} <strong>{returnOrder.order_number}</strong> — {t('buyer.orders.returnModal.description', 'Returns must be requested within 24 hours of delivery.')}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('buyer.orders.returnModal.reasonLabel', 'Reason for Return')}
              </label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                placeholder={t('buyer.orders.returnModal.reasonPlaceholder', 'Describe the issue with your order...')}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setReturnModalOpen(false)}
                className="btn-outline flex-1"
              >
                {t('buyer.orders.returnModal.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleReturnSubmit}
                disabled={returnSubmitting || !returnReason.trim()}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
              >
                {returnSubmitting ? t('buyer.orders.returnModal.submitting', 'Submitting...') : t('buyer.orders.returnModal.submit', 'Submit Return')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrdersPage
