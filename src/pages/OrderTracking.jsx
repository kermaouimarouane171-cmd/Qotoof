import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Card, LoadingSpinner } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import LiveDriverMap from '@/components/maps/LiveDriverMap'
import { CheckCircleIcon, ClockIcon, TruckIcon, ShoppingBagIcon, MapPinIcon, PhoneIcon, XMarkIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const formatSyncTime = (value) => {
  if (!value) return null
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const OrderTracking = () => {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const subscriptionRef = useRef(null)

  // Status steps with full coverage
  const statusSteps = [
    { key: 'pending', label: 'orderDetail.timeline.orderPlaced', labelDefault: 'Order Placed', desc: 'orderTracking.desc.pending', descDefault: 'Your order has been received', icon: ShoppingBagIcon },
    { key: 'confirmed', label: 'orderDetail.timeline.confirmed', labelDefault: 'Confirmed', desc: 'orderTracking.desc.confirmed', descDefault: 'Vendor confirmed your order', icon: CheckCircleIcon },
    { key: 'preparing', label: 'orderDetail.timeline.preparing', labelDefault: 'Preparing', desc: 'orderTracking.desc.preparing', descDefault: 'Vendor is preparing your items', icon: ClockIcon },
    { key: 'shipped', label: 'orderDetail.timeline.shipped', labelDefault: 'Out for Delivery', desc: 'orderTracking.desc.shipped', descDefault: 'Driver is on the way', icon: TruckIcon },
    { key: 'on_the_way', label: 'orderDetail.timeline.shipped', labelDefault: 'Out for Delivery', desc: 'orderTracking.desc.shipped', descDefault: 'Driver is on the way', icon: TruckIcon },
    { key: 'delivered', label: 'orderDetail.timeline.delivered', labelDefault: 'Delivered', desc: 'orderTracking.desc.delivered', descDefault: 'Order delivered successfully', icon: CheckCircleIcon },
  ]

  // Map additional statuses to their corresponding step
  const statusToStepMap = {
    vendor_accepted: 1,
    vendor_rejected: -1,
    driver_assigned: 2,
    driver_accepted: 2,
    driver_picked_up: 3,
    awaiting_driver: 2,
    cancelled: -1,
  }

  const getCurrentStepIndex = (status) => {
    if (statusToStepMap[status] !== undefined) return statusToStepMap[status]
    return statusSteps.findIndex(s => s.key === status)
  }

  const currentStepIndex = order ? getCurrentStepIndex(order.status) : 0
  const isCancelled = order?.status === 'cancelled' || order?.status === 'vendor_rejected'
  const hasDriver = order?.driver && order?.driver_id
  const isOrderInProgress = ['shipped', 'on_the_way', 'driver_assigned', 'driver_accepted', 'driver_picked_up'].includes(order?.status)

  // ============================================================
  // LOAD ORDER — WITH OWNERSHIP VERIFICATION (IDOR Prevention)
  // ============================================================
  const loadOrder = useCallback(async ({ silent = false } = {}) => {
    if (!user) {
      navigate('/login', { state: { from: `/orders/${id}/tracking` } })
      return
    }

    try {
      if (!silent) {
        setLoading(true)
      }
      setError(null)

      // Verify session is still valid
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login', { state: { from: `/orders/${id}/tracking` } })
        return
      }

      const { data, error: supabaseError } = await supabase
        .from('orders')
        .select(`
          *,
          vendor:profiles!orders_vendor_id_fkey(store_name, phone, latitude, longitude),
          driver:profiles!orders_driver_id_fkey(first_name, last_name, phone, avatar_url, latitude, longitude, vehicle_type)
        `)
        .eq('id', id)
        // CRITICAL: Verify ownership
        .or(`buyer_id.eq.${user.id},vendor_id.eq.${user.id},driver_id.eq.${user.id}`)
        .single()

      if (supabaseError) {
        if (supabaseError.code === 'PGRST116') {
          setError('forbidden')
          return
        }
        throw supabaseError
      }

      // Double-check ownership in frontend (defense in depth)
      if (
        data.buyer_id !== user.id &&
        data.vendor_id !== user.id &&
        data.driver_id !== user.id
      ) {
        setError('forbidden')
        return
      }

      setOrder(data)
      setLastUpdatedAt(new Date())
    } catch (error) {
      logger.error('Error loading order:', error)
      setError('load_failed')
      toast.error(t('tracking.loadFailed', 'Failed to load order'))
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [id, navigate, t, user])

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await loadOrder({ silent: true })
    } finally {
      setRefreshing(false)
    }
  }, [loadOrder])

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: `/orders/${id}/tracking` } })
      return
    }
    loadOrder()
  }, [id, loadOrder, navigate, user])

  // ============================================================
  // REAL-TIME SUBSCRIPTIONS — WITH CLEANUP
  // ============================================================
  useEffect(() => {
    if (!id || !user) return

    // Subscribe to order status updates via Supabase Realtime
    subscriptionRef.current = supabase
      .channel(`order-tracking-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          // Verify ownership before applying update
          if (
            payload.new?.buyer_id === user?.id ||
            payload.new?.vendor_id === user?.id ||
            payload.new?.driver_id === user?.id
          ) {
            setOrder((prev) => (prev ? { ...prev, ...payload.new } : payload.new))
            setLastUpdatedAt(new Date())
            toast.success(t('tracking.orderUpdated', 'Order status updated!'))
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true)
          return
        }

        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          setRealtimeConnected(false)
        }
      })

    // CRITICAL: Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [id, user, t])

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // ============================================================
  // ERROR STATES
  // ============================================================
  if (error === 'forbidden') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-full flex items-center justify-center">
          <XMarkIcon className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {t('tracking.accessDenied', 'Access Denied')}
        </h2>
        <p className="text-gray-500 mb-6">
          {t('tracking.accessDeniedDesc', 'You don\'t have permission to track this order.')}
        </p>
        <button onClick={() => navigate('/orders')} className="btn-primary">
          {t('tracking.backToOrders', 'Back to Orders')}
        </button>
      </div>
    )
  }

  if (error === 'load_failed') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-full flex items-center justify-center">
          <XMarkIcon className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {t('tracking.loadError', 'Failed to Load Order')}
        </h2>
        <p className="text-gray-500 mb-6">
          {t('tracking.loadErrorDesc', 'We couldn\'t load the tracking information. Please try again.')}
        </p>
        <button onClick={loadOrder} className="btn-primary">
          {t('common.tryAgain', 'Try Again')}
        </button>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
          <ShoppingBagIcon className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {t('tracking.orderNotFound', 'Order Not Found')}
        </h2>
        <p className="text-gray-500 mb-6">
          {t('tracking.orderNotFoundDesc', 'We couldn\'t find an order with this ID.')}
        </p>
        <button onClick={() => navigate('/orders')} className="btn-primary">
          {t('tracking.backToOrders', 'Back to Orders')}
        </button>
      </div>
    )
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Real-time indicator */}
      {realtimeConnected && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-xs text-green-700 font-medium">
            {t('tracking.live', 'Live')}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {t('tracking.title', 'Order Tracking')}
        </h1>
        <p className="text-gray-500">
          {t('tracking.orderNumber', 'Order #{{number}}', {
            number: order.order_number || id?.slice(0, 8),
          })}
        </p>
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${realtimeConnected ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`} data-testid="tracking-sync-status">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">
                {realtimeConnected
                  ? t('tracking.liveConnected', 'Live tracking is connected.')
                  : t('tracking.liveDisconnected', 'Live updates are unavailable right now.')}
              </p>
              <p className="mt-1 text-xs leading-6">
                {lastUpdatedAt
                  ? t('tracking.lastUpdated', 'Last update at {{time}}.', { time: formatSyncTime(lastUpdatedAt) })
                  : t('tracking.lastUpdatedFallback', 'Tracking will refresh once data is received.')}
              </p>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              data-testid="tracking-manual-refresh"
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium transition-colors ${realtimeConnected ? 'bg-white text-green-700 hover:bg-green-100' : 'bg-white text-amber-800 hover:bg-amber-100'} disabled:opacity-60`}
            >
              {refreshing ? t('tracking.refreshing', 'Refreshing...') : t('tracking.refreshNow', 'Refresh now')}
            </button>
          </div>
        </div>
      </div>

      {/* Progress Timeline */}
      <Card className="mb-8 p-6">
        <div className="space-y-6">
          {statusSteps.map((step, index) => {
            const Icon = step.icon
            const isCompleted = index < currentStepIndex && !isCancelled
            const isCurrent = index === currentStepIndex && !isCancelled
            return (
              <div key={step.key} className="flex items-start gap-4">
                {/* Timeline Line */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isCancelled && index > 0
                      ? 'bg-gray-200 text-gray-400'
                      : isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-green-100 text-green-600 ring-4 ring-green-200'
                      : 'bg-gray-200 text-gray-400'
                  }`}>
                    {isCancelled && index === 0 ? (
                      <XMarkIcon className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  {index < statusSteps.length - 1 && (
                    <div className={`w-0.5 h-12 ${
                      isCancelled ? 'bg-gray-200' : isCompleted ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>

                {/* Step Info */}
                <div className="pt-2">
                  <h3 className={`font-semibold ${
                    isCancelled
                      ? 'text-gray-400'
                      : isCurrent
                      ? 'text-green-600'
                      : isCompleted
                      ? 'text-gray-900'
                      : 'text-gray-400'
                  }`}>
                    {t(step.label, step.labelDefault)}
                  </h3>
                  <p className="text-sm text-gray-500">{t(step.desc, step.descDefault)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Driver Info or Pending Message */}
      {hasDriver ? (
        <Card className="p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-3">
            {t('tracking.yourDriver', 'Your Driver')}
          </h2>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              {order.driver.avatar_url ? (
                <img src={order.driver.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-green-600 font-semibold">
                  {order.driver.first_name?.[0]}{order.driver.last_name?.[0]}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">
                {order.driver.first_name} {order.driver.last_name}
              </p>
              <p className="text-sm text-gray-500">
                {isOrderInProgress
                  ? t('tracking.driverOnTheWay', 'On the way to you')
                  : t('tracking.driverAssigned', 'Assigned to your order')}
              </p>
              {order.driver.vehicle_type && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {t('tracking.vehicle', 'Vehicle')}: {order.driver.vehicle_type}
                </p>
              )}
            </div>
            {order.driver.phone && (
              <a
                href={`tel:${order.driver.phone}`}
                className="btn-primary text-sm inline-flex items-center gap-1"
              >
                <PhoneIcon className="w-4 h-4" />
                {t('tracking.callDriver', 'Call Driver')}
              </a>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-6 mb-8 bg-blue-50 border border-blue-200">
          <div className="flex items-start gap-3">
            <ClockIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">
                {['pending', 'confirmed', 'preparing'].includes(order.status)
                  ? t('tracking.awaitingDriver', 'Awaiting Driver Assignment')
                  : t('tracking.driverNotAssigned', 'Driver Not Yet Assigned')}
              </h3>
              <p className="text-blue-700 text-sm">
                {order.status === 'pending'
                  ? t('tracking.pendingDesc', 'Your order is pending. A driver will be assigned once the vendor confirms.')
                  : order.status === 'confirmed'
                  ? t('tracking.confirmedDesc', 'Your order is confirmed. The vendor is preparing your items.')
                  : t('tracking.preparingDesc', 'A driver will be assigned once your order is ready for delivery.')}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Live Driver Location Map (only when driver assigned and location available) */}
      {hasDriver && (
        <Card className="p-6 mb-8">
          <LiveDriverMap
            driverId={order.driver_id}
            pickupLocation={
              order.vendor?.latitude && order.vendor?.longitude
                ? {
                    lat: order.vendor.latitude,
                    lng: order.vendor.longitude,
                    label: order.vendor.store_name || 'موقع البائع',
                  }
                : null
            }
            deliveryLocation={
              order.shipping_latitude && order.shipping_longitude
                ? {
                    lat: order.shipping_latitude,
                    lng: order.shipping_longitude,
                    label: t('tracking.deliveryAddress', 'Delivery Address'),
                  }
                : null
            }
            title={t('tracking.liveLocation', 'Live Driver Location')}
            height="300px"
          />
        </Card>
      )}

      {/* Delivery Address */}
      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <MapPinIcon className="w-5 h-5" />
          {t('tracking.deliveryAddress', 'Delivery Address')}
        </h2>
        <p className="text-gray-600">
          {order.shipping_address || order.delivery_address || t('tracking.addressNotProvided', 'Address not provided')}
        </p>
        {order.shipping_city && (
          <p className="text-sm text-gray-500 mt-1">
            {[order.shipping_city, order.shipping_country].filter(Boolean).join(', ')}
          </p>
        )}
      </Card>
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const OrderTrackingWithErrorBoundary = () => (
  <ErrorBoundary componentName="OrderTrackingPage">
    <OrderTracking />
  </ErrorBoundary>
)

export default OrderTrackingWithErrorBoundary
