import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { logger } from '@/utils/logger'
import { useTranslation } from 'react-i18next'
import {
  TruckIcon,
  ClockIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'
import { Card, LoadingSpinner, EmptyState } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { formatPrice } from '@/utils/currency'

const formatDate = (value, language = 'ar') => {
  if (!value) return '-'
  const locale = language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-MA' : 'en-US'
  return new Date(value).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
}

const TRACKING_STATUSES = [
  'pending',
  'vendor_accepted',
  'preparing',
  'driver_assigned',
  'driver_picked_up',
  'on_the_way',
]

const STATUS_LABELS = {
  pending: { key: 'orderStatus.pending', fallback: 'قيد الانتظار', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  vendor_accepted: { key: 'orderStatus.vendor_accepted', fallback: 'تم القبول', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  preparing: { key: 'orderStatus.preparing', fallback: 'قيد التجهيز', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  driver_assigned: { key: 'orderStatus.driver_assigned', fallback: 'تم تعيين سائق', color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  driver_picked_up: { key: 'orderStatus.driver_picked_up', fallback: 'تم الاستلام', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  on_the_way: { key: 'orderStatus.on_the_way', fallback: 'في الطريق', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  delivered: { key: 'orderStatus.delivered', fallback: 'تم التوصيل', color: 'text-green-700', bg: 'bg-green-50 dark:bg-green-900/20' },
  cancelled: { key: 'orderStatus.cancelled', fallback: 'ملغي', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
}

export default function BuyerTracking() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()

  const { data: orders = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['buyer-tracking-orders', user?.id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total,
          created_at,
          vendor:profiles!vendor_id(store_name, city),
          delivery:deliveries(status, driver_id)
        `)
        .eq('buyer_id', user.id)
        .in('status', [...TRACKING_STATUSES, 'delivered'])
        .order('created_at', { ascending: false })
        .limit(20)
      if (err) {
        logger.error('BuyerTracking: failed to load orders', err)
        throw err
      }
      return data || []
    },
    enabled: Boolean(user?.id),
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  })

  const error = queryError?.message || null

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </Card>
      </div>
    )
  }

  const activeOrders = orders.filter((o) => TRACKING_STATUSES.includes(o.status))
  const deliveredOrders = orders.filter((o) => o.status === 'delivered')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <TruckIcon className="w-6 h-6 text-green-600" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('buyerTracking.title', 'تتبع الطلبات')}
        </h1>
      </div>

      {orders.length === 0 && (
        <EmptyState
          icon="shopping"
          title={t('buyerTracking.empty', 'لا توجد طلبات للتتبع')}
          description={t('buyerTracking.emptyMessage', 'ابدأ التسوق من السوق')}
          actionLabel={t('buyerTracking.browse', 'تصفح السوق')}
          onAction={() => window.location.href = '/marketplace'}
        />
      )}

      {/* Active orders */}
      {activeOrders.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
            {t('buyerTracking.active', 'الطلبات النشطة')} ({activeOrders.length})
          </h2>
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <OrderTrackingCard key={order.id} order={order} t={t} i18n={i18n} />
            ))}
          </div>
        </div>
      )}

      {/* Delivered orders */}
      {deliveredOrders.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
            {t('buyerTracking.delivered', 'تم التوصيل')} ({deliveredOrders.length})
          </h2>
          <div className="space-y-3">
            {deliveredOrders.map((order) => (
              <OrderTrackingCard key={order.id} order={order} t={t} i18n={i18n} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const STATUS_ETA_MINUTES = {
  pending: { min: 120, max: 180, label: 'buyerTracking.eta.pending' },
  vendor_accepted: { min: 90, max: 150, label: 'buyerTracking.eta.accepted' },
  preparing: { min: 60, max: 120, label: 'buyerTracking.eta.preparing' },
  driver_assigned: { min: 45, max: 90, label: 'buyerTracking.eta.driverAssigned' },
  driver_picked_up: { min: 20, max: 45, label: 'buyerTracking.eta.pickedUp' },
  on_the_way: { min: 10, max: 30, label: 'buyerTracking.eta.onTheWay' },
}

function computeETA(order, t) {
  if (order.status === 'delivered') return null
  const cfg = STATUS_ETA_MINUTES[order.status]
  if (!cfg) return null

  const createdAt = new Date(order.created_at)
  const now = new Date()
  const elapsedMin = Math.floor((now - createdAt) / 60000)
  const remainingMax = Math.max(0, cfg.max - elapsedMin)
  const remainingMin = Math.max(0, cfg.min - elapsedMin)

  if (remainingMax === 0) {
    return { text: t('buyerTracking.eta.arrivingSoon', 'Arriving soon'), urgent: true }
  }

  const formatDuration = (mins) => {
    if (mins < 60) return t('buyerTracking.eta.minutes', '{{count}} min', { count: mins })
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (m === 0) return t('buyerTracking.eta.hours', '{{count}}h', { count: h })
    return t('buyerTracking.eta.hoursMinutes', '{{h}}h {{m}}m', { h, m })
  }

  return {
    text: t('buyerTracking.eta.range', '{{min}}–{{max}}', {
      min: formatDuration(remainingMin),
      max: formatDuration(remainingMax),
    }),
    urgent: remainingMax <= 30,
  }
}

function OrderTrackingCard({ order, t, i18n }) {
  const statusCfg = STATUS_LABELS[order.status] || STATUS_LABELS.pending
  const vendorName = order.vendor?.store_name || '—'
  const eta = computeETA(order, t)

  return (
    <Link to={`/orders/${order.id}/tracking`}>
      <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer" hover>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {order.order_number || `#${order.id.slice(0, 8)}`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{vendorName}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
            {t(statusCfg.key, statusCfg.fallback)}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <ClockIcon className="w-3.5 h-3.5" />
            {formatDate(order.created_at, i18n.language)}
          </span>
          <span className="font-medium text-gray-600 dark:text-gray-300">
            {formatPrice(order.total)}
          </span>
        </div>

        {order.delivery?.[0]?.driver_id && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <MapPinIcon className="w-3.5 h-3.5" />
            {t('buyerTracking.driverAssigned', 'سائق معين')}
          </div>
        )}

        {eta && (
          <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${eta.urgent ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`} data-testid="order-eta">
            <ClockIcon className="w-3.5 h-3.5" />
            {t('buyerTracking.eta.label', 'ETA')}: {eta.text}
          </div>
        )}
      </Card>
    </Link>
  )
}
