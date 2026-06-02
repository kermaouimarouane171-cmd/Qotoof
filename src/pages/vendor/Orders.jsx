import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { fetchVendorOrders, subscribeToVendorOrders } from '@/services/ordersService'
import { supabase } from '@/services/supabase'
import { ordersApi, deliveriesApi } from '@/services/deliveries'
import { Card, Badge, Button, Modal, ChatComponent, OrderTimeline, EmptyState, StateSkeleton as Skeleton, OrderCardSkeleton } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import LiveDriverMap from '@/components/maps/LiveDriverMap'
import { formatPrice } from '@/utils/currency'
import {
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const VendorOrders = () => {
  const { t, i18n } = useTranslation()
  const { profile } = useAuthStore()
  const vendorId = profile?.id
  const [orders, setOrders] = useState([])
  const [drivers, setDrivers] = useState([])
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [trackingModalOpen, setTrackingModalOpen] = useState(false)
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [timelineModalOpen, setTimelineModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [trackingData, setTrackingData] = useState(null)
  const [chatReceiver, setChatReceiver] = useState(null)
  const [processingOrder, setProcessingOrder] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const subscriptionRef = useRef(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadOrders = useCallback(async () => {
    if (!vendorId) {
      if (isMountedRef.current) {
        setOrders([])
        setLoadError(null)
        setLoading(false)
      }
      return
    }

    if (isMountedRef.current) {
      setLoading(true)
      setLoadError(null)
    }

    try {
      const { data, error } = await fetchVendorOrders(vendorId)
      if (error) throw error
      if (!isMountedRef.current) return
      setOrders(data || [])
    } catch (error) {
      logger.error('Error loading orders:', error)
      if (isMountedRef.current) {
        setLoadError(error?.message || 'Failed to load orders')
        setOrders([])
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [vendorId])
  
  useEffect(() => {
    if (!vendorId) return undefined
    loadOrders()
    return undefined
  }, [vendorId, loadOrders])

  useEffect(() => {
    if (!vendorId || subscriptionRef.current) return undefined

    const handleOrderChange = (payload) => {
      if (payload.eventType === 'INSERT' && payload.new?.status === 'pending') {
        toast.success(`🛒 New order received: ${payload.new.order_number || 'Order'}!`, {
          duration: 5000,
          icon: '🛒',
        })
      }

      loadOrders()
    }

    if (typeof supabase?.channel === 'function') {
      const channel = supabase
        .channel(`vendor-orders-${vendorId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `vendor_id=eq.${vendorId}`,
          },
          handleOrderChange,
        )
        .subscribe()

      subscriptionRef.current = channel
    } else if (typeof subscribeToVendorOrders === 'function') {
      subscriptionRef.current = subscribeToVendorOrders(vendorId, handleOrderChange)
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
  }, [vendorId, loadOrders])

  const loadAvailableDrivers = async () => {
    if (!profile) {
      setDrivers([])
      return
    }

    try {
      const driversList = await deliveriesApi.getAvailableDrivers(
        profile.latitude || 33.5731,
        profile.longitude || -7.5898,
        20
      )
      setDrivers(driversList)
    } catch (error) {
      logger.error('Error loading drivers:', error)
    }
  }

  const handleAcceptOrder = async (orderId) => {
    setProcessingOrder(orderId)
    try {
      await ordersApi.acceptOrder(orderId)
      toast.success(t('vendor.orders.notifications.orderAccepted', 'Order accepted!'))
      loadOrders()
    } catch (error) {
      logger.error('Error accepting order:', error)
      toast.error(t('vendor.orders.errors.acceptFailed', 'Failed to accept order'))
    } finally {
      setProcessingOrder(null)
    }
  }

  const handleRejectOrder = async (orderId) => {
    const confirmed = window.confirm('هل أنت متأكد من رفض هذا الطلب؟')
    if (!confirmed) {
      return
    }

    setProcessingOrder(orderId)
    try {
      await ordersApi.rejectOrder(orderId, 'Not available')
      toast.success(t('vendor.orders.notifications.orderRejected', 'Order rejected'))
      loadOrders()
    } catch (error) {
      logger.error('Error rejecting order:', error)
      toast.error(t('vendor.orders.errors.rejectFailed', 'Failed to reject order'))
    } finally {
      setProcessingOrder(null)
    }
  }
  
  const handleOpenAssignModal = async (order) => {
    setSelectedOrder(order)
    setAssignModalOpen(true)
    await loadAvailableDrivers()
  }
  
  const handleTrackOrder = async (order) => {
    const delivery = order.deliveries?.[0]
    if (delivery) {
      setTrackingData({
        deliveryId: delivery.id,
        driverId: delivery.driver_id,
        driver: delivery.driver,
        currentLat: delivery.current_latitude,
        currentLng: delivery.current_longitude,
        deliveryLat: delivery.delivery_latitude,
        deliveryLng: delivery.delivery_longitude,
        status: delivery.status,
      })
      setTrackingModalOpen(true)
    }
  }

  const handleOpenChat = (order, driver) => {
    setSelectedOrder(order)
    setChatReceiver({
      id: driver?.driver_id || driver?.id,
      name: `${driver?.first_name || ''} ${driver?.last_name || ''}`,
      phone: driver?.phone
    })
    setChatModalOpen(true)
  }

  const handleOpenTimeline = (order) => {
    setSelectedOrder(order)
    setTimelineModalOpen(true)
  }
  
  const handleAssignDriver = async () => {
    if (!selectedOrder || !selectedDriver) return
    
    try {
      const delivery = selectedOrder.deliveries?.[0]
      if (delivery) {
        await deliveriesApi.assignDriver(delivery.id, selectedDriver.driver_id)
        toast.success('Driver assigned successfully!')
      }
      
      setAssignModalOpen(false)
      setSelectedOrder(null)
      setSelectedDriver(null)
      loadOrders()
    } catch (_error) {
      toast.error('Failed to assign driver')
    }
  }

  const getOrderTotal = (order) => order.total_amount ?? order.total ?? order.buyer_total ?? 0
  const getOrderItemCount = (order) => order.items?.length ?? order.order_items?.length ?? 0
  const getPaymentMethodLabel = (method) => {
    const map = {
      cod: 'Cash',
      cash: 'Cash',
      bank_transfer: 'Bank Transfer',
      bank: 'Bank Transfer',
      paypal: 'PayPal',
      cmi: 'CMI',
      mada: 'MADA',
    }
    if (!method) return 'Unknown'
    return map[String(method).toLowerCase()] || String(method).replace('_', ' ')
  }

  const getPaymentStatusLabel = (status) => {
    const map = {
      pending: 'Pending',
      processing: 'Processing',
      confirmed: 'Confirmed',
      completed: 'Completed',
      failed: 'Failed',
      refunded: 'Refunded',
      cancelled: 'Cancelled',
    }
    if (!status) return 'Unknown'
    return map[String(status).toLowerCase()] || String(status).replace('_', ' ')
  }

  const renderOrderActions = (order) => {
    if (order.status === 'pending') {
      return (
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<CheckCircleIcon className="w-4 h-4" />}
            onClick={() => handleAcceptOrder(order.id)}
            disabled={processingOrder === order.id}
            data-cy={`accept-order-${order.id}`}
          >
            {processingOrder === order.id ? t('vendor.orders.accepting', 'Accepting...') : 'قبول'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<XCircleIcon className="w-4 h-4" />}
            onClick={() => handleRejectOrder(order.id)}
            disabled={processingOrder === order.id}
            data-cy={`reject-order-${order.id}`}
          >
            {processingOrder === order.id ? t('vendor.orders.rejecting', 'Rejecting...') : 'رفض'}
          </Button>
        </div>
      )
    }

    if (order.status === 'vendor_accepted') {
      return (
        <Button
          variant="primary"
          size="sm"
          leftIcon={<TruckIcon className="w-4 h-4" />}
          onClick={() => handleOpenAssignModal(order)}
          data-cy={`order-prepared-${order.id}`}
        >
          تم التحضير
        </Button>
      )
    }

    if (['driver_assigned', 'driver_accepted', 'driver_picked_up', 'on_the_way'].includes(order.status)) {
      return (
        <Button
          variant="primary"
          size="sm"
          leftIcon={<EyeIcon className="w-4 h-4" />}
          onClick={() => handleTrackOrder(order)}
          data-cy={`track-order-${order.id}`}
        >
          متابعة التوصيل
        </Button>
      )
    }

    return <span className="text-sm text-gray-500">لا يوجد إجراء رئيسي</span>
  }

  const statusFilters = [
    { key: 'all', label: 'الكل', statuses: null },
    { key: 'pending', label: 'جديدة', statuses: ['pending'] },
    { key: 'vendor_accepted', label: 'قيد التحضير', statuses: ['vendor_accepted'] },
    { key: 'driver_assigned', label: 'جاهزة للتوصيل', statuses: ['driver_assigned', 'driver_accepted', 'driver_picked_up'] },
    { key: 'on_the_way', label: 'قيد التوصيل', statuses: ['on_the_way'] },
    { key: 'delivered', label: 'مكتملة', statuses: ['delivered'] },
    { key: 'cancelled', label: 'ملغاة', statuses: ['cancelled', 'vendor_rejected'] },
  ]

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter((order) => {
      const filter = statusFilters.find((item) => item.key === filterStatus)
      return filter?.statuses?.includes(order.status)
    })

  const statusColors = {
    pending: 'badge-warning',
    vendor_accepted: 'badge-primary',
    vendor_rejected: 'badge-danger',
    driver_assigned: 'bg-blue-100 text-blue-700 badge',
    driver_accepted: 'bg-blue-100 text-blue-700 badge',
    driver_picked_up: 'bg-purple-100 text-purple-700 badge',
    on_the_way: 'bg-indigo-100 text-indigo-700 badge',
    delivered: 'badge-gray',
    cancelled: 'badge-danger',
  }
  
  const statusLabels = {
    pending: 'جديدة',
    vendor_accepted: 'قيد التحضير',
    vendor_rejected: 'ملغاة',
    driver_assigned: 'جاهزة للتوصيل',
    driver_accepted: 'جاهزة للتوصيل',
    driver_picked_up: 'قيد التوصيل',
    on_the_way: 'قيد التوصيل',
    delivered: 'مكتملة',
    cancelled: 'ملغاة',
  }
  
  return (
    <div className="overflow-x-hidden pb-20">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">إدارة الطلبات</h1>
      
      {/* Status Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {statusFilters.map((status) => (
          <button
            key={status.key}
            onClick={() => setFilterStatus(status.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
              filterStatus === status.key
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.label}
          </button>
        ))}
      </div>
      
      {/* Orders List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <OrderCardSkeleton key={index} className="max-w-full" />
            ))}
          </div>
        ) : loadError ? (
          <EmptyState
            icon="alert"
            title="حدث خطأ أثناء تحميل الطلبات"
            description="حاول إعادة المحاولة مرة أخرى."
            actionLabel="إعادة المحاولة"
            onAction={loadOrders}
          />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon="truck"
            title="لا توجد طلبات حالياً"
            description="سيظهر هنا أي طلبات جديدة من العملاء."
          />
        ) : (
          filteredOrders.map((order) => (
            <Card key={order.id} className="p-4 sm:p-6 overflow-hidden max-w-full">
              <div className="flex flex-col gap-4 min-w-0">
                <div className="flex items-start justify-between gap-4 min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-500 mb-1">طلب #{order.order_number}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{order.order_number}</h3>
                      <Badge className={statusColors[order.status]}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right min-w-0">
                    <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleDateString(
                      i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'fr' ? 'fr-MA' : 'en-US',
                      { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                    )}</p>
                    <p className="mt-2 text-xl font-bold text-gray-900">{formatPrice(getOrderTotal(order))}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">عدد المنتجات</p>
                    <p>{getOrderItemCount(order)}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">طريقة الدفع</p>
                    <p>{getPaymentMethodLabel(order.payment_method || order.payment_type)}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">حالة الدفع</p>
                    <p>{getPaymentStatusLabel(order.payment_status)}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">حالة الطلب</p>
                    <p>{statusLabels[order.status] || order.status}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-gray-500">الإجراء التالي</div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    {renderOrderActions(order)}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
      
      {/* Assign Driver Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false)
          setSelectedOrder(null)
          setSelectedDriver(null)
        }}
        title="تعيين سائق"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            اختر سائقاً لتوصيل الطلب {selectedOrder?.order_number}
          </p>
          
          {drivers.length === 0 ? (
            <div className="text-center py-8">
              <TruckIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">لا يوجد سائقون متاحون بالقرب منك حالياً</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {drivers.map((driver) => (
                <button
                  key={driver.driver_id}
                  onClick={() => setSelectedDriver(driver)}
                  data-cy={`assign-driver-option-${driver.driver_id}`}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                    selectedDriver?.driver_id === driver.driver_id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <TruckIcon className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {driver.first_name} {driver.last_name}
                    </p>
                    <p className="text-sm text-gray-500 capitalize">
                      {driver.vehicle_type} • {driver.vehicle_plate || 'No plate'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{driver.distance?.toFixed(1)} km</p>
                    <p className="text-xs text-gray-500">⭐ {driver.rating || 'New'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setAssignModalOpen(false)
                setSelectedOrder(null)
                setSelectedDriver(null)
              }}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleAssignDriver}
              disabled={!selectedDriver}
              data-cy="assign-driver-confirm"
            >
              تعيين السائق
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Tracking Modal */}
      <Modal
        isOpen={trackingModalOpen}
        onClose={() => {
          setTrackingModalOpen(false)
          setTrackingData(null)
        }}
        title="تتبع الطلب"
        size="lg"
      >
        {trackingData && (
          <div className="space-y-4">
            {/* Driver Info */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TruckIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {trackingData.driver?.first_name} {trackingData.driver?.last_name}
                </p>
                <p className="text-sm text-gray-500">الحالة: {trackingData.status}</p>
              </div>
              <a
                href={`tel:${trackingData.driver?.phone}`}
                className="btn-sm btn-primary"
              >
                الاتصال بالسائق
              </a>
            </div>
            
            <LiveDriverMap
              driverId={trackingData.driverId}
              pickupLocation={
                profile?.latitude && profile?.longitude
                  ? {
                      lat: profile.latitude,
                      lng: profile.longitude,
                      label: profile.store_name || 'موقع المتجر',
                    }
                  : null
              }
              deliveryLocation={
                trackingData.deliveryLat && trackingData.deliveryLng
                  ? {
                      lat: trackingData.deliveryLat,
                      lng: trackingData.deliveryLng,
                      label: 'نقطة التسليم',
                    }
                  : null
              }
              height="300px"
              title="التتبع الحي للسائق"
            />
          </div>
        )}
      </Modal>

      {/* Chat Modal */}
      <Modal
        isOpen={chatModalOpen}
        onClose={() => {
          setChatModalOpen(false)
          setChatReceiver(null)
        }}
        title={`Chat with ${chatReceiver?.name || 'Driver'}`}
        size="lg"
      >
        {selectedOrder && chatReceiver && (
          <div className="h-[500px]">
            <ChatComponent
              deliveryId={selectedOrder.deliveries?.[0]?.id}
              receiverId={chatReceiver.id}
              receiverName={chatReceiver.name}
              receiverPhone={chatReceiver.phone}
            />
          </div>
        )}
      </Modal>

      {/* Timeline Modal */}
      <Modal
        isOpen={timelineModalOpen}
        onClose={() => {
          setTimelineModalOpen(false)
          setSelectedOrder(null)
        }}
        title="سجل الطلب"
        size="lg"
      >
        {selectedOrder && (
          <div className="max-h-[500px] overflow-y-auto">
            <OrderTimeline orderId={selectedOrder.id} />
          </div>
        )}
      </Modal>
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const VendorOrdersWithErrorBoundary = () => (
  <ErrorBoundary componentName="VendorOrders">
    <VendorOrders />
  </ErrorBoundary>
)

export default VendorOrdersWithErrorBoundary
