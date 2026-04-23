import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { LoadingSpinner, Card } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import { formatPrice } from '@/utils/currency'
import {
  ShoppingBagIcon,
  ClockIcon,
  CheckCircleIcon,
  TruckIcon,
  XMarkIcon,
  ArrowRightIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'

const STATUS_CONFIG = {
  pending: { label: 'Order Placed', color: 'badge-warning', icon: ClockIcon },
  confirmed: { label: 'Confirmed', color: 'badge-info', icon: CheckCircleIcon },
  preparing: { label: 'Preparing', color: 'badge-indigo', icon: ClockIcon },
  shipped: { label: 'On the Way', color: 'badge-info', icon: TruckIcon },
  on_the_way: { label: 'On the Way', color: 'badge-info', icon: TruckIcon },
  delivered: { label: 'Delivered', color: 'badge-success', icon: CheckCircleIcon },
  cancelled: { label: 'Cancelled', color: 'badge-danger', icon: XMarkIcon },
  vendor_accepted: { label: 'Accepted', color: 'badge-info', icon: CheckCircleIcon },
  vendor_rejected: { label: 'Rejected', color: 'badge-danger', icon: XMarkIcon },
  driver_assigned: { label: 'Driver Assigned', color: 'badge-indigo', icon: TruckIcon },
  driver_accepted: { label: 'Driver Accepted', color: 'badge-indigo', icon: CheckCircleIcon },
  driver_picked_up: { label: 'Picked Up', color: 'badge-info', icon: TruckIcon },
  awaiting_driver: { label: 'Awaiting Driver', color: 'badge-warning', icon: ClockIcon },
}

const Orders = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuthStore()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(searchParams.get('status') || 'all')

  // Redirect to login if not authenticated
  const loadOrders = useCallback(async () => {
    if (!user) return

    setLoading(true)
    try {
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total,
          buyer_total,
          created_at,
          shipping_city,
          items:order_items(
            id,
            quantity,
            unit_price,
            product:products(id, name, images:product_images(url, is_primary))
          ),
          vendor:profiles!orders_vendor_id_fkey(store_name)
        `)
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query
      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      logger.error('Error loading orders:', error)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [filter, user])

  useEffect(() => {
    if (!user) {
      navigate('/login', {
        state: { from: '/orders', message: 'Please login to view your orders' }
      })
      return
    }
    loadOrders()
  }, [loadOrders, navigate, user])

  // Update URL when filter changes
  useEffect(() => {
    const params = new URLSearchParams()
    if (filter !== 'all') params.set('status', filter)
    setSearchParams(params)
  }, [filter, setSearchParams])

  // Sync from URL changes (browser back/forward)
  useEffect(() => {
    setFilter(searchParams.get('status') || 'all')
  }, [searchParams])

  // Show loading while checking auth
  if (!user) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const statusFilters = [
    { id: 'all', label: t('orders.filters.all', 'All') },
    { id: 'pending', label: t('orders.filters.pending', 'Pending') },
    { id: 'confirmed', label: t('orders.filters.confirmed', 'Confirmed') },
    { id: 'preparing', label: t('orders.filters.preparing', 'Preparing') },
    { id: 'shipped', label: t('orders.filters.shipped', 'Shipped') },
    { id: 'delivered', label: t('orders.filters.delivered', 'Delivered') },
    { id: 'cancelled', label: t('orders.filters.cancelled', 'Cancelled') },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {t('orders.title', 'My Orders')}
        </h1>
        <p className="text-gray-600">
          {t('orders.subtitle', 'Track and manage your orders')}
        </p>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-thin" role="tablist" aria-label={t('orders.filterByStatus', 'Filter by status')}>
        {statusFilters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.id
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            role="tab"
            aria-selected={filter === f.id}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = STATUS_CONFIG[order.status] || { label: order.status, color: 'badge-secondary', icon: ClockIcon }
            const StatusIcon = status.icon
            const itemCount = order.items?.length || 0

            return (
              <Card
                key={order.id}
                className="p-4 sm:p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/orders/${order.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/orders/${order.id}`)
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={`Order ${order.order_number}, ${status.label}, ${formatPrice(order.total || order.buyer_total || 0)}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-gray-900">{order.order_number}</span>
                      <span className={`badge ${status.color} inline-flex items-center gap-1`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-4 h-4" />
                        {new Date(order.created_at).toLocaleDateString(i18n.language || 'en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {order.vendor?.store_name && (
                        <span className="flex items-center gap-1">
                          <ShoppingBagIcon className="w-4 h-4" />
                          {order.vendor.store_name}
                        </span>
                      )}
                      <span className="font-medium text-gray-900">
                        {formatPrice(order.total || order.buyer_total || 0)}
                      </span>
                      <span className="text-gray-400">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Product Preview */}
                    {order.items && order.items.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        {order.items.slice(0, 3).map(item => (
                          <div key={item.id} className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            {item.product?.images?.[0]?.url ? (
                              <img src={item.product.images[0].url} alt={item.product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs">🌱</div>
                            )}
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <span className="text-xs text-gray-400">+{order.items.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <div className="flex items-center gap-2 text-green-600 font-medium text-sm flex-shrink-0">
                    <EyeIcon className="w-4 h-4" />
                    {t('orders.viewDetails', 'View Details')}
                    <ArrowRightIcon className="w-4 h-4" />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBagIcon className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('orders.empty.title', 'No orders yet')}
          </h3>
          <p className="text-gray-500 mb-6">
            {t('orders.empty.description', 'Start shopping to see your orders here')}
          </p>
          <Link to="/marketplace" className="btn-primary inline-flex items-center gap-2">
            <ShoppingBagIcon className="w-5 h-5" />
            {t('orders.empty.browseProducts', 'Browse Products')}
          </Link>
        </div>
      )}
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const OrdersWithErrorBoundary = () => (
  <ErrorBoundary componentName="OrdersPage">
    <Orders />
  </ErrorBoundary>
)

export default OrdersWithErrorBoundary
