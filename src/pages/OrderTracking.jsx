import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Card, LoadingSpinner } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import LiveDriverMap from '@/components/maps/LiveDriverMap'
import {
  CheckCircleIcon, ClockIcon, TruckIcon, ShoppingBagIcon, MapPinIcon,
  PhoneIcon, XMarkIcon, ChatBubbleLeftRightIcon, StarIcon, BanknotesIcon,
  ExclamationTriangleIcon, ArrowPathIcon, DocumentArrowDownIcon,
  HomeIcon, QuestionMarkCircleIcon, ShareIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid, StarIcon as StarSolid } from '@heroicons/react/24/solid'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { formatPrice } from '@/utils/currency'

const formatDate = (dateStr, lang) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_META = {
  pending: { label: 'orderTracking.status.pending', labelDefault: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  confirmed: { label: 'orderTracking.status.confirmed', labelDefault: 'تم التأكيد', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  vendor_accepted: { label: 'orderTracking.status.confirmed', labelDefault: 'تم القبول', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  preparing: { label: 'orderTracking.status.preparing', labelDefault: 'قيد التجهيز', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  driver_assigned: { label: 'orderTracking.status.driver_assigned', labelDefault: 'تم تعيين السائق', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  driver_accepted: { label: 'orderTracking.status.driver_accepted', labelDefault: 'السائق قبل الطلب', color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  driver_picked_up: { label: 'orderTracking.status.driver_picked_up', labelDefault: 'استلم السائق الطلب', color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  shipped: { label: 'orderTracking.status.shipped', labelDefault: 'خرج للتوصيل', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  on_the_way: { label: 'orderTracking.status.shipped', labelDefault: 'في الطريق إليك', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  delivered: { label: 'orderTracking.status.delivered', labelDefault: 'تم التسليم', color: 'bg-green-100 text-green-700', dot: 'bg-green-600' },
  cancelled: { label: 'orderTracking.status.cancelled', labelDefault: 'ملغي', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  vendor_rejected: { label: 'orderTracking.status.cancelled', labelDefault: 'مرفوض', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  awaiting_driver: { label: 'orderTracking.status.awaiting_driver', labelDefault: 'بانتظار سائق', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
}

const TIMELINE_STEPS = [
  { key: 'pending', label: 'تم إنشاء الطلب', icon: ShoppingBagIcon },
  { key: 'vendor_accepted', label: 'قبل البائع الطلب', icon: CheckCircleIcon },
  { key: 'preparing', label: 'يتم تجهيز الطلب', icon: ClockIcon },
  { key: 'driver_assigned', label: 'السائق في الطريق إلى المتجر', icon: TruckIcon },
  { key: 'driver_picked_up', label: 'استلم السائق الطلب', icon: TruckIcon },
  { key: 'on_the_way', label: 'في الطريق إليك', icon: TruckIcon },
  { key: 'delivered', label: 'تم التسليم', icon: CheckCircleSolid },
]

const STATUS_TO_STEP = {
  pending: 0, confirmed: 1, vendor_accepted: 1, preparing: 2,
  driver_assigned: 3, driver_accepted: 3, awaiting_driver: 2,
  driver_picked_up: 4, shipped: 5, on_the_way: 5, delivered: 6,
  cancelled: -1, vendor_rejected: -1,
}

const PAYMENT_METHOD_LABELS = {
  cash_on_delivery: 'الدفع عند الاستلام',
  card: 'بطاقة بنكية',
  bank_transfer: 'تحويل بنكي',
  wallet: 'محفظة إلكترونية',
}

const OrderTracking = () => {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [order, setOrder] = useState(null)
  const [orderItems, setOrderItems] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [, setLastUpdatedAt] = useState(null)
  const [statusHistory, setStatusHistory] = useState([])
  const subscriptionRef = useRef(null)

  const currentStepIndex = order ? (STATUS_TO_STEP[order.status] ?? 0) : 0
  const isCancelled = order?.status === 'cancelled' || order?.status === 'vendor_rejected'
  const hasDriver = order?.driver && order?.driver_id
  const isDelivered = order?.status === 'delivered'
  const isOrderInProgress = ['shipped', 'on_the_way', 'driver_assigned', 'driver_accepted', 'driver_picked_up'].includes(order?.status)
  const statusMeta = order ? (STATUS_META[order.status] || STATUS_META.pending) : null

  const loadOrder = useCallback(async ({ silent = false } = {}) => {
    if (!user) return
    try {
      if (!silent) setLoading(true)
      setError(null)

      const { data, error: supabaseError } = await supabase
        .from('orders')
        .select(`
          *,
          vendor:profiles!orders_vendor_id_fkey(store_name, phone, first_name, last_name, latitude, longitude, avatar_url),
          driver:profiles!orders_driver_id_fkey(first_name, last_name, phone, avatar_url, latitude, longitude, vehicle_type, rating)
        `)
        .eq('id', id)
        .or(`buyer_id.eq.${user.id},vendor_id.eq.${user.id},driver_id.eq.${user.id}`)
        .single()

      if (supabaseError) {
        if (supabaseError.code === 'PGRST116') { setError('forbidden'); return }
        throw supabaseError
      }

      if (data.buyer_id !== user.id && data.vendor_id !== user.id && data.driver_id !== user.id) {
        setError('forbidden'); return
      }

      setOrder(data)
      setLastUpdatedAt(new Date())

      // Load order items
      const { data: itemsData } = await supabase
        .from('order_items')
        .select(`
          id, product_id, product_name, quantity, unit_price, unit_type,
          product:products(id, name, product_images(url, is_primary))
        `)
        .eq('order_id', id)

      if (itemsData) setOrderItems(itemsData)

      // Load payments
      const { data: payData } = await supabase
        .from('payments')
        .select('id, method, status, amount, created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: false })

      if (payData) setPayments(payData)

      // Load status history from notifications
      const { data: histData } = await supabase
        .from('notifications')
        .select('title, message, created_at, data')
        .or(`user_id.eq.${user.id}`)
        .ilike('data->>order_id', `%${id}%`)
        .order('created_at', { ascending: false })
        .limit(10)

      if (histData && histData.length > 0) {
        setStatusHistory(histData)
      } else {
        // Fallback: create basic history from order timestamps
        const hist = []
        if (data.created_at) hist.push({ title: 'تم إنشاء الطلب', created_at: data.created_at })
        if (data.accepted_at) hist.push({ title: 'تم قبول الطلب', created_at: data.accepted_at })
        if (data.shipped_at) hist.push({ title: 'خرج للتوصيل', created_at: data.shipped_at })
        if (data.delivered_at) hist.push({ title: 'تم التسليم', created_at: data.delivered_at })
        setStatusHistory(hist.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
      }
    } catch (err) {
      logger.error('Error loading order:', err)
      setError('load_failed')
      toast.error(t('tracking.loadFailed', 'Failed to load order'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [id, user])

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true)
    try { await loadOrder({ silent: true }) } finally { setRefreshing(false) }
  }, [loadOrder])

  useEffect(() => {
    if (!user) return
    loadOrder()
  }, [id, loadOrder, user])

  useEffect(() => {
    if (!id || !user) return
    subscriptionRef.current = supabase
      .channel(`order-tracking-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => {
          if (payload.new?.buyer_id === user?.id || payload.new?.vendor_id === user?.id || payload.new?.driver_id === user?.id) {
            setOrder((prev) => (prev ? { ...prev, ...payload.new } : payload.new))
            setLastUpdatedAt(new Date())
            toast.success(t('tracking.orderUpdated', 'Order status updated!'))
          }
        })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeConnected(true)
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) setRealtimeConnected(false)
      })
    return () => { if (subscriptionRef.current) subscriptionRef.current.unsubscribe() }
  }, [id, user])

  const handleShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) { await navigator.share({ title: `طلب #${order?.order_number || id?.slice(0, 8)}`, url }) }
      else { await navigator.clipboard.writeText(url); toast.success('تم نسخ الرابط') }
    } catch { /* ignore */ }
  }

  const handleReorder = async () => {
    if (!orderItems.length) return
    try {
      // Navigate to marketplace with vendor filter
      navigate(`/stores/${order.vendor_id}`)
    } catch { /* ignore */ }
  }

  // ─── Loading ──────────────────────────────────────────────
  if (loading) {
    return <div className="flex items-center justify-center py-16"><LoadingSpinner size="lg" /></div>
  }

  // ─── Error States ─────────────────────────────────────────
  if (error === 'forbidden') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-full flex items-center justify-center">
          <XMarkIcon className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('tracking.accessDenied', 'Access Denied')}</h2>
        <p className="text-gray-500 mb-6">{t('tracking.accessDeniedDesc', "You don't have permission to track this order.")}</p>
        <button onClick={() => navigate('/buyer/orders')} className="btn-primary">{t('tracking.backToOrders', 'Back to Orders')}</button>
      </div>
    )
  }

  if (error === 'load_failed') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-full flex items-center justify-center">
          <XMarkIcon className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('tracking.loadError', 'Failed to Load Order')}</h2>
        <p className="text-gray-500 mb-6">{t('tracking.loadErrorDesc', "We couldn't load the tracking information.")}</p>
        <button onClick={loadOrder} className="btn-primary">{t('common.tryAgain', 'Try Again')}</button>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
          <ShoppingBagIcon className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('tracking.orderNotFound', 'Order Not Found')}</h2>
        <button onClick={() => navigate('/buyer/orders')} className="btn-primary">{t('tracking.backToOrders', 'Back to Orders')}</button>
      </div>
    )
  }

  const orderNumber = order.order_number || id?.slice(0, 8)
  const vendorName = order.vendor?.store_name || `${order.vendor?.first_name || ''} ${order.vendor?.last_name || ''}`
  const paymentMethod = payments[0]?.method || order.payment_method || 'cash_on_delivery'
  const paymentLabel = PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod
  const subtotal = orderItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0) || order.subtotal || order.total
  const shippingFee = order.shipping_fee || 0
  const discount = order.discount || 0
  const tax = order.tax || 0
  const total = order.total || order.buyer_total || subtotal + shippingFee - discount + tax

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6" dir={i18n.dir()}>
      {/* Real-time indicator */}
      {realtimeConnected && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-xs text-green-700 font-medium">{t('tracking.live', 'Live')}</span>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          1. ORDER CARD (top)
      ════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 mb-5 shadow-xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white" />
          <div className="absolute top-20 -left-12 w-32 h-32 rounded-full bg-white" />
        </div>
        <div className="relative p-5 sm:p-6 text-white">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-green-100 text-xs mb-1">{t('tracking.orderNumber', 'Order #{{number}}', { number: orderNumber })}</p>
              <h1 className="text-2xl font-bold">طلب #{orderNumber}</h1>
            </div>
            <button onClick={handleManualRefresh} disabled={refreshing} className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors" aria-label={t('orderTracking.aria.refresh', 'تحديث')}>
              <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${statusMeta?.color || 'bg-white/20'} ${statusMeta?.color ? '' : 'text-white'}`}>
              <span className={`w-2 h-2 rounded-full ${statusMeta?.dot || 'bg-white'}`} />
              {statusMeta ? t(statusMeta.label, statusMeta.labelDefault) : '—'}
            </span>
            {realtimeConnected && <span className="text-xs text-green-100">● مباشر</span>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-green-100 text-xs mb-0.5">المتجر</p>
              <p className="font-semibold truncate">{vendorName}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-green-100 text-xs mb-0.5">الإجمالي</p>
              <p className="font-semibold">{formatPrice(total)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-green-100 text-xs mb-0.5">التاريخ</p>
              <p className="font-semibold text-xs">{formatDate(order.created_at, i18n.language)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
              <p className="text-green-100 text-xs mb-0.5">طريقة الدفع</p>
              <p className="font-semibold">{paymentLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          2. TIMELINE
      ════════════════════════════════════════════════════════════ */}
      <Card className="p-5 mb-5">
        <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-green-600" />
          مراحل الطلب
        </h2>
        <div className="space-y-1">
          {TIMELINE_STEPS.map((step, index) => {
            const Icon = step.icon
            const isCompleted = !isCancelled && index < currentStepIndex
            const isCurrent = !isCancelled && index === currentStepIndex
            return (
              <div key={step.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isCancelled && index > 0 ? 'bg-gray-200 text-gray-400'
                    : isCompleted ? 'bg-green-500 text-white'
                    : isCurrent ? 'bg-green-100 text-green-600 ring-4 ring-green-200'
                    : 'bg-gray-200 text-gray-400'
                  }`}>
                    {isCancelled && index === 0 ? <XMarkIcon className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  {index < TIMELINE_STEPS.length - 1 && (
                    <div className={`w-0.5 h-8 ${isCancelled ? 'bg-gray-200' : isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </div>
                <div className="pt-1.5 pb-6">
                  <p className={`text-sm font-medium ${isCancelled && index > 0 ? 'text-gray-400' : isCurrent ? 'text-green-600' : isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                  {isCurrent && <p className="text-xs text-green-500 mt-0.5">● الحالية</p>}
                </div>
              </div>
            )
          })}
        </div>
        {isCancelled && (
          <div className="mt-2 p-3 bg-red-50 rounded-xl flex items-center gap-2">
            <XMarkIcon className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-700 font-medium">تم إلغاء هذا الطلب</p>
          </div>
        )}
      </Card>

      {/* ════════════════════════════════════════════════════════════
          3. MAP (only when driver assigned and in progress)
      ════════════════════════════════════════════════════════════ */}
      {hasDriver && isOrderInProgress && (
        <Card className="p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <MapPinIcon className="w-4 h-4 text-green-600" />
            الموقع المباشر
          </h2>
          <LiveDriverMap
            driverId={order.driver_id}
            pickupLocation={order.vendor?.latitude && order.vendor?.longitude ? { lat: order.vendor.latitude, lng: order.vendor.longitude, label: vendorName } : null}
            deliveryLocation={order.shipping_latitude && order.shipping_longitude ? { lat: order.shipping_latitude, lng: order.shipping_longitude, label: t('tracking.deliveryAddress', 'Delivery Address') } : null}
            title={t('tracking.liveLocation', 'Live Driver Location')}
            height="280px"
          />
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════
          4. DRIVER INFO
      ════════════════════════════════════════════════════════════ */}
      {hasDriver ? (
        <Card className="p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <TruckIcon className="w-4 h-4 text-green-600" />
            معلومات السائق
          </h2>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
              {order.driver.avatar_url ? (
                <img src={order.driver.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-green-600 font-bold text-lg">{order.driver.first_name?.[0]}{order.driver.last_name?.[0]}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{order.driver.first_name} {order.driver.last_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {order.driver.rating && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-500">
                    <StarSolid className="w-3.5 h-3.5 text-yellow-400" />
                    {Number(order.driver.rating).toFixed(1)}
                  </span>
                )}
                {order.driver.vehicle_type && <span className="text-xs text-gray-400">• {order.driver.vehicle_type}</span>}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {order.driver.phone && (
                <a href={`tel:${order.driver.phone}`} className="w-9 h-9 bg-green-50 rounded-full flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors" aria-label={t('orderTracking.aria.callDriver', 'اتصل بالسائق')}>
                  <PhoneIcon className="w-4 h-4" />
                </a>
              )}
              <Link to={`/chat?userId=${order.driver_id}`} className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors" aria-label={t('orderTracking.aria.chatDriver', 'محادثة السائق')}>
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </Card>
      ) : !isCancelled && !isDelivered && (
        <Card className="p-5 mb-5 bg-blue-50 border border-blue-200">
          <div className="flex items-start gap-3">
            <ClockIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">
                {['pending', 'confirmed'].includes(order.status) ? 'بانتظار تعيين سائق' : 'سيتم تعيين سائق قريباً'}
              </h3>
              <p className="text-blue-700 text-sm">
                {order.status === 'pending' ? 'طلبك قيد الانتظار. سيتم تعيين سائق بعد تأكيد البائع.' : 'البائع يقوم بتجهيز طلبك. سيتم تعيين سائق قريباً.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════
          5. PRODUCTS
      ════════════════════════════════════════════════════════════ */}
      {orderItems.length > 0 && (
        <Card className="p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <ShoppingBagIcon className="w-4 h-4 text-green-600" />
            المنتجات ({orderItems.length})
          </h2>
          <div className="space-y-3">
            {orderItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                  {item.product?.product_images?.[0]?.url ? (
                    <img src={item.product.product_images[0].url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingBagIcon className="w-6 h-6 text-gray-400 m-auto" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.product_name || item.product?.name}</p>
                  <p className="text-xs text-gray-500">{item.quantity} {item.unit_type || 'وحدة'}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 flex-shrink-0">{formatPrice(item.unit_price * item.quantity)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════
          6. DELIVERY ADDRESS
      ════════════════════════════════════════════════════════════ */}
      <Card className="p-5 mb-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <HomeIcon className="w-4 h-4 text-green-600" />
          عنوان التوصيل
        </h2>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{order.shipping_address || order.delivery_address || 'العنوان غير متوفر'}</p>
            {(order.shipping_city || order.shipping_country) && (
              <p className="text-sm text-gray-500 mt-0.5">{[order.shipping_city, order.shipping_country].filter(Boolean).join(', ')}</p>
            )}
            {order.shipping_phone && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><PhoneIcon className="w-3.5 h-3.5" /> {order.shipping_phone}</p>
            )}
          </div>
          {order.shipping_latitude && order.shipping_longitude && (
            <a href={`https://www.google.com/maps?q=${order.shipping_latitude},${order.shipping_longitude}`} target="_blank" rel="noopener noreferrer"
              className="flex-shrink-0 w-9 h-9 bg-green-50 rounded-full flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors" aria-label={t('orderTracking.aria.openMaps', 'فتح في الخرائط')}>
              <MapPinIcon className="w-4 h-4" />
            </a>
          )}
        </div>
      </Card>

      {/* ════════════════════════════════════════════════════════════
          7. PAYMENT SUMMARY
      ════════════════════════════════════════════════════════════ */}
      <Card className="p-5 mb-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <BanknotesIcon className="w-4 h-4 text-green-600" />
          ملخص الدفع
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">المنتجات</span><span className="font-medium text-gray-900">{formatPrice(subtotal)}</span></div>
          {shippingFee > 0 && <div className="flex justify-between"><span className="text-gray-500">الشحن</span><span className="font-medium text-gray-900">{formatPrice(shippingFee)}</span></div>}
          {discount > 0 && <div className="flex justify-between"><span className="text-gray-500">الخصم</span><span className="font-medium text-green-600">- {formatPrice(discount)}</span></div>}
          {tax > 0 && <div className="flex justify-between"><span className="text-gray-500">الضريبة</span><span className="font-medium text-gray-900">{formatPrice(tax)}</span></div>}
          <div className="border-t border-gray-200 pt-2 flex justify-between">
            <span className="font-bold text-gray-900">الإجمالي</span>
            <span className="font-bold text-green-600 text-base">{formatPrice(total)}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-gray-500">طريقة الدفع</span>
            <span className="font-medium text-gray-700">{paymentLabel}</span>
          </div>
        </div>
      </Card>

      {/* ════════════════════════════════════════════════════════════
          8. ACTIONS (context-aware)
      ════════════════════════════════════════════════════════════ */}
      <Card className="p-5 mb-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <ShoppingBagIcon className="w-4 h-4 text-green-600" />
          الإجراءات
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* Before acceptance: cancel */}
          {(order.status === 'pending' || order.status === 'confirmed') && (
            <button onClick={() => navigate(`/buyer/orders?cancel=${order.id}`)} className="flex flex-col items-center gap-1.5 p-3 bg-red-50 rounded-xl text-red-600 hover:bg-red-100 transition-colors">
              <XMarkIcon className="w-5 h-5" />
              <span className="text-xs font-medium">إلغاء الطلب</span>
            </button>
          )}
          {/* After acceptance: contact vendor */}
          {order.vendor_id && order.status !== 'pending' && (
            <Link to={`/stores/${order.vendor_id}`} className="flex flex-col items-center gap-1.5 p-3 bg-blue-50 rounded-xl text-blue-600 hover:bg-blue-100 transition-colors">
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
              <span className="text-xs font-medium">تواصل مع البائع</span>
            </Link>
          )}
          {/* After driver assigned: contact + share */}
          {hasDriver && (
            <Link to={`/chat?userId=${order.driver_id}`} className="flex flex-col items-center gap-1.5 p-3 bg-purple-50 rounded-xl text-purple-600 hover:bg-purple-100 transition-colors">
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
              <span className="text-xs font-medium">تواصل مع السائق</span>
            </Link>
          )}
          {isOrderInProgress && (
            <button onClick={handleShare} className="flex flex-col items-center gap-1.5 p-3 bg-green-50 rounded-xl text-green-600 hover:bg-green-100 transition-colors">
              <ShareIcon className="w-5 h-5" />
              <span className="text-xs font-medium">مشاركة التتبع</span>
            </button>
          )}
          {/* After delivery: rate + reorder + invoice + report */}
          {isDelivered && (
            <>
              <button className="flex flex-col items-center gap-1.5 p-3 bg-yellow-50 rounded-xl text-yellow-600 hover:bg-yellow-100 transition-colors">
                <StarIcon className="w-5 h-5" />
                <span className="text-xs font-medium">تقييم السائق</span>
              </button>
              <button className="flex flex-col items-center gap-1.5 p-3 bg-yellow-50 rounded-xl text-yellow-600 hover:bg-yellow-100 transition-colors">
                <StarIcon className="w-5 h-5" />
                <span className="text-xs font-medium">تقييم البائع</span>
              </button>
              <button onClick={handleReorder} className="flex flex-col items-center gap-1.5 p-3 bg-green-50 rounded-xl text-green-600 hover:bg-green-100 transition-colors">
                <ArrowPathIcon className="w-5 h-5" />
                <span className="text-xs font-medium">إعادة الطلب</span>
              </button>
              <button className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors">
                <DocumentArrowDownIcon className="w-5 h-5" />
                <span className="text-xs font-medium">تنزيل الفاتورة</span>
              </button>
              <Link to="/contact" className="flex flex-col items-center gap-1.5 p-3 bg-red-50 rounded-xl text-red-600 hover:bg-red-100 transition-colors">
                <ExclamationTriangleIcon className="w-5 h-5" />
                <span className="text-xs font-medium">الإبلاغ عن مشكلة</span>
              </Link>
            </>
          )}
        </div>
      </Card>

      {/* ════════════════════════════════════════════════════════════
          9. UPDATES / NOTIFICATIONS
      ════════════════════════════════════════════════════════════ */}
      {statusHistory.length > 0 && (
        <Card className="p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-green-600" />
            آخر التحديثات
          </h2>
          <div className="space-y-3">
            {statusHistory.map((entry, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                  {entry.message && <p className="text-xs text-gray-500 mt-0.5">{entry.message}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(entry.created_at, i18n.language)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ════════════════════════════════════════════════════════════
          10. HELP
      ════════════════════════════════════════════════════════════ */}
      <Card className="p-5 mb-8">
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <QuestionMarkCircleIcon className="w-4 h-4 text-green-600" />
          المساعدة
        </h2>
        <div className="space-y-2">
          <Link to="/contact" className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
            <div className="flex items-center gap-2"><ExclamationTriangleIcon className="w-4 h-4 text-red-500" /><span className="text-sm text-gray-700">الإبلاغ عن مشكلة</span></div>
            <span className="text-gray-400">←</span>
          </Link>
          <Link to="/returns" className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
            <div className="flex items-center gap-2"><ArrowPathIcon className="w-4 h-4 text-blue-500" /><span className="text-sm text-gray-700">طلب استرجاع</span></div>
            <span className="text-gray-400">←</span>
          </Link>
          <Link to="/help-center" className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
            <div className="flex items-center gap-2"><ChatBubbleLeftRightIcon className="w-4 h-4 text-green-500" /><span className="text-sm text-gray-700">التواصل مع الدعم</span></div>
            <span className="text-gray-400">←</span>
          </Link>
        </div>
      </Card>

      {/* Back to orders */}
      <div className="text-center">
        <button onClick={() => navigate('/buyer/orders')} className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          {t('tracking.backToOrders', 'Back to Orders')}
        </button>
      </div>
    </div>
  )
}

const OrderTrackingWithErrorBoundary = () => (
  <ErrorBoundary componentName="OrderTrackingPage">
    <OrderTracking />
  </ErrorBoundary>
)

export default OrderTrackingWithErrorBoundary
