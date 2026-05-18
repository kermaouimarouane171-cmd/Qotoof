import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ShoppingBagIcon,
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  MapPinIcon,
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ShareIcon,
  CameraIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
  UserIcon,
  CalendarIcon,
  TagIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { supabase } from '@/services/supabase'
import { Card, LoadingSpinner, Receipt, OptimizedImage, Modal, ChatComponent } from '@/components/ui'
import PaymentReceiptUpload from '@/components/orders/PaymentReceiptUpload'
import FraudReportButton from '@/components/shared/FraudReportButton'
import ErrorBoundary from '@/components/ErrorBoundary'
import LiveDriverMap from '@/components/maps/LiveDriverMap'
import RouteMap from '@/components/ui/RouteMap'
import { formatPrice } from '@/utils/currency'
import { ordersApi } from '@/services/deliveries'
import { orderTimelineApi } from '@/services/favorites'
import { confirmOrderPayment } from '@/services/paymentService'
import { driverLocationService } from '@/services/driverLocationService'
import cancellationService, { DEFAULT_VENDOR_CANCELLATION_POLICY, normalizeCancellationPolicy } from '@/services/cancellationService'
import reviewService from '@/services/reviewService'
import invoiceService from '@/services/invoiceService'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { getOrderStatusColors, getOrderStatusLabel } from '@/constants/orderStatuses'

// ============================================================
// STATUS META — workflow data (icon, step index, i18n label).
// Colors are NOT stored here — use getOrderStatusColors() at render.
// ============================================================
const ORDER_STATUS_META = {
  pending:          { label: 'orderDetail.status.pending',          labelDefault: 'Order Placed',    icon: ShoppingBagIcon,  stepIndex: 0  },
  confirmed:        { label: 'orderDetail.status.confirmed',        labelDefault: 'Confirmed',        icon: CheckCircleIcon,  stepIndex: 1  },
  payment_received: { label: 'orderDetail.status.payment_received', labelDefault: 'Payment Received', icon: CheckCircleIcon,  stepIndex: 3  },
  preparing:        { label: 'orderDetail.status.preparing',        labelDefault: 'Preparing',        icon: ClockIcon,        stepIndex: 2  },
  shipped:          { label: 'orderDetail.status.shipped',          labelDefault: 'On the Way',       icon: TruckIcon,        stepIndex: 3  },
  on_the_way:       { label: 'orderDetail.status.shipped',          labelDefault: 'On the Way',       icon: TruckIcon,        stepIndex: 3  },
  delivered:        { label: 'orderDetail.status.delivered',        labelDefault: 'Delivered',        icon: CheckCircleIcon,  stepIndex: 4  },
  cancelled:        { label: 'orderDetail.status.cancelled',        labelDefault: 'Cancelled',        icon: XMarkIcon,        stepIndex: -1 },
  vendor_accepted:  { label: 'orderDetail.status.vendor_accepted',  labelDefault: 'Vendor Accepted',  icon: CheckCircleIcon,  stepIndex: 1  },
  vendor_rejected:  { label: 'orderDetail.status.vendor_rejected',  labelDefault: 'Vendor Rejected',  icon: XMarkIcon,        stepIndex: -1 },
  driver_assigned:  { label: 'orderDetail.status.driver_assigned',  labelDefault: 'Driver Assigned',  icon: UserIcon,         stepIndex: 2  },
  driver_accepted:  { label: 'orderDetail.status.driver_accepted',  labelDefault: 'Driver Accepted',  icon: CheckCircleIcon,  stepIndex: 2  },
  driver_picked_up: { label: 'orderDetail.status.driver_picked_up', labelDefault: 'Picked Up',        icon: TruckIcon,        stepIndex: 3  },
  awaiting_driver:  { label: 'orderDetail.status.awaiting_driver',  labelDefault: 'Awaiting Driver',  icon: ClockIcon,        stepIndex: 2  },
}

const TIMELINE_STEPS = [
  { key: 'pending', label: 'orderDetail.timeline.orderPlaced', labelDefault: 'Order Placed', icon: ShoppingBagIcon },
  { key: 'confirmed', label: 'orderDetail.timeline.confirmed', labelDefault: 'Confirmed', icon: CheckCircleIcon },
  { key: 'preparing', label: 'orderDetail.timeline.preparing', labelDefault: 'Preparing', icon: ClockIcon },
  { key: 'shipped', label: 'orderDetail.timeline.shipped', labelDefault: 'On the Way', icon: TruckIcon },
  { key: 'delivered', label: 'orderDetail.timeline.delivered', labelDefault: 'Delivered', icon: CheckCircleIcon },
]

const PAYMENT_CONFIRMATION_ELIGIBLE_STATUSES = ['confirmed', 'vendor_accepted', 'preparing', 'shipped', 'on_the_way', 'driver_assigned', 'driver_accepted', 'driver_picked_up', 'delivered']
const ROUTE_AND_TRACKING_STATUSES = ['confirmed', 'vendor_accepted', 'preparing', 'payment_received', 'shipped', 'on_the_way', 'driver_assigned', 'driver_accepted', 'driver_picked_up']
const BUYER_CANCELLABLE_STATUSES = ['pending', 'confirmed', 'awaiting_driver', 'vendor_accepted', 'payment_received', 'preparing']
const SECOND_RECEIPT_UPLOAD_STATUSES = ['shipped', 'on_the_way', 'driver_assigned', 'driver_accepted', 'driver_picked_up', 'delivered', 'payment_received']
const ORDER_CONFIRMED_STATUSES = ['payment_received', ...PAYMENT_CONFIRMATION_ELIGIBLE_STATUSES]

// ============================================================
// HELPER: Get status step index
// ============================================================
const getStatusStepIndex = (status) => {
  return ORDER_STATUS_META[status]?.stepIndex ?? 0
}

const formatMadAmount = (value) => `${Number(value || 0).toFixed(2)} درهم`

// ============================================================
// MAIN COMPONENT
// ============================================================
const OrderDetail = () => {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // State
  const [order, setOrder] = useState(null)
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [realtimeConnected, setRealtimeConnected] = useState(false)

  // Modal states
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [productRatingModalOpen, setProductRatingModalOpen] = useState(false)
  const [paymentReceivedModalOpen, setPaymentReceivedModalOpen] = useState(false)
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)

  // UI states
  const [expandedProductNotes, setExpandedProductNotes] = useState({})
  const [productNotes, setProductNotes] = useState({})
  const [returnReason, setReturnReason] = useState('')
  const [returnDescription, setReturnDescription] = useState('')
  const [returnItems, setReturnItems] = useState([])
  const [cancellationReason, setCancellationReason] = useState('')
  const [ratingValue, setRatingValue] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selfTrackingBusy, setSelfTrackingBusy] = useState(false)
  const [selfDeliveryTracking, setSelfDeliveryTracking] = useState(false)
  const [selfDeliveryTrackingError, setSelfDeliveryTrackingError] = useState(null)
  const [lastSelfDeliveryPing, setLastSelfDeliveryPing] = useState(null)
  const [cancellationPolicy, setCancellationPolicy] = useState({ ...DEFAULT_VENDOR_CANCELLATION_POLICY })
  const [cancellationPreview, setCancellationPreview] = useState(null)
  const [loadingCancellationPolicy, setLoadingCancellationPolicy] = useState(false)

  // Refs
  const subscriptionRef = useRef(null)
  const timelineSubscriptionRef = useRef(null)
  const selfDeliveryTrackingStopRef = useRef(null)

  // ============================================================
  // LOAD ORDER DATA — WITH OWNERSHIP VERIFICATION (IDOR Prevention)
  // ============================================================
  const loadOrder = useCallback(async () => {
    if (!user) {
      navigate('/login', { state: { from: `/orders/${id}` } })
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Verify session is still valid
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login', { state: { from: `/orders/${id}` } })
        return
      }

      const { data, error: supabaseError } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*, product:products(*)),
          vendor:profiles!orders_vendor_id_fkey(store_name, first_name, last_name, phone, email, avatar_url, city, latitude, longitude),
          driver:profiles!orders_driver_id_fkey(first_name, last_name, phone, avatar_url, vehicle_type, vehicle_plate),
          buyer:profiles!orders_buyer_id_fkey(first_name, last_name, phone, email)
        `)
        .eq('id', id)
        // CRITICAL SECURITY: Verify ownership — only return order if user is buyer, vendor, or driver
        .or(`buyer_id.eq.${user.id},vendor_id.eq.${user.id},driver_id.eq.${user.id}`)
        .single()

      if (supabaseError) {
        if (supabaseError.code === 'PGRST116') {
          // Order not found OR user doesn't have access → treat as forbidden
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

      // Load timeline
      try {
        const timelineData = await orderTimelineApi.getByOrder(id)
        setTimeline(timelineData || [])
      } catch (timelineErr) {
        logger.warn('Failed to load timeline:', timelineErr)
      }
    } catch (err) {
      logger.error('Error loading order:', err)
      setError('load_failed')
      toast.error(t('orderDetail.errors.loadFailed', 'Failed to load order details'))
    } finally {
      setLoading(false)
    }
  }, [id, user, navigate, t])

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: `/orders/${id}` } })
      return
    }
    loadOrder()
  }, [user, id, loadOrder, navigate])

  // ============================================================
  // REAL-TIME SUBSCRIPTIONS — WITH OWNERSHIP VERIFICATION
  // ============================================================
  useEffect(() => {
    if (!id || !user) return

    // Subscribe to order updates — verify ownership before applying
    subscriptionRef.current = ordersApi.subscribeToOrder(id, (payload) => {
      // Verify the update is for an order the user owns
      if (
        payload.new?.buyer_id === user?.id ||
        payload.new?.vendor_id === user?.id ||
        payload.new?.driver_id === user?.id
      ) {
        setOrder((prev) => (prev ? { ...prev, ...payload.new } : payload.new))
        toast.success(t('orderDetail.notifications.orderUpdated', 'Order status updated!'))
      }
    })

    // Subscribe to timeline updates
    timelineSubscriptionRef.current = orderTimelineApi.subscribe(id, (payload) => {
      setTimeline((prev) => {
        const exists = prev.find((item) => item.id === payload.new?.id)
        if (exists) return prev
        return [...prev, payload.new]
      })
    })

    setRealtimeConnected(true)

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
      if (timelineSubscriptionRef.current) {
        timelineSubscriptionRef.current.unsubscribe()
      }
    }
  }, [id, user, t])

  useEffect(() => {
    if (!order || order.delivery_option !== 'self' || user?.id !== order.vendor_id) {
      setSelfDeliveryTracking(false)
      setLastSelfDeliveryPing(null)
      return undefined
    }

    let active = true

    driverLocationService
      .getCurrentTrackedLocation({
        driverId: order.vendor_id,
        orderId: order.id,
      })
      .then((location) => {
        if (!active) return
        const isActiveBroadcast = location?.broadcastStatus === 'active' && location?.orderId === order.id
        setSelfDeliveryTracking(Boolean(isActiveBroadcast))
        setLastSelfDeliveryPing(location?.lastUpdated || null)
      })
      .catch((trackingError) => {
        logger.warn('Failed to load self-delivery tracking state:', trackingError)
      })

    return () => {
      active = false
    }
  }, [order, user?.id])

  useEffect(() => {
    if (!order?.vendor_id || order?.buyer_id !== user?.id) {
      setCancellationPreview(null)
      setCancellationPolicy({ ...DEFAULT_VENDOR_CANCELLATION_POLICY })
      return undefined
    }

    let active = true

    const loadCancellationPolicy = async () => {
      setLoadingCancellationPolicy(true)

      try {
        const vendorPolicy = await cancellationService.getVendorCancellationPolicy(order.vendor_id)
        if (!active) return

        setCancellationPolicy(vendorPolicy)
        setCancellationPreview(cancellationService.getCancellationPreview({
          order,
          policy: vendorPolicy,
        }))
      } catch (policyError) {
        logger.warn('Failed to load cancellation policy:', policyError)
        if (!active) return

        const fallbackPolicy = normalizeCancellationPolicy(order?.cancellation_policy_snapshot || {})
        setCancellationPolicy(fallbackPolicy)
        setCancellationPreview(cancellationService.getCancellationPreview({
          order,
          policy: fallbackPolicy,
        }))
      } finally {
        if (active) {
          setLoadingCancellationPolicy(false)
        }
      }
    }

    loadCancellationPolicy()

    return () => {
      active = false
    }
  }, [
    order?.id,
    order?.status,
    order?.vendor_id,
    order?.buyer_id,
    order?.created_at,
    order?.grand_total,
    order?.buyer_total,
    order?.total,
    user?.id,
  ])

  useEffect(() => {
    return () => {
      if (selfDeliveryTrackingStopRef.current) {
        selfDeliveryTrackingStopRef.current()
        selfDeliveryTrackingStopRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!order || !selfDeliveryTracking || order.delivery_option !== 'self') return

    if (['delivered', 'cancelled', 'vendor_rejected'].includes(order.status)) {
      driverLocationService.stopBrowserTracking({
        driverId: order.vendor_id,
        orderId: order.id,
        vendorId: order.vendor_id,
        buyerId: order.buyer_id,
        eventType: order.status === 'delivered' ? 'completed' : 'stopped',
      })
      selfDeliveryTrackingStopRef.current = null
      setSelfDeliveryTracking(false)
    }
  }, [order, selfDeliveryTracking])

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleContactVendor = () => {
    if (!order?.vendor) return
    setChatModalOpen(true)
  }

  const handleCallVendor = () => {
    if (!order?.vendor?.phone) return
    window.location.href = `tel:${order.vendor.phone}`
  }

  const handleReorder = async () => {
    if (!order?.items?.length) return
    try {
      let addedCount = 0
      const addItem = useCartStore.getState().addItem
      for (const item of order.items) {
        if (item.product) {
          const wasAdded = addItem({
            id: item.product.id,
            name: item.product.name,
            price_per_unit: item.unit_price,
            image_url: item.product.images?.[0]?.url || item.product.image_url || '',
            vendor_id: order.vendor_id,
            vendor_name: order.vendor?.store_name || '',
            min_order_quantity: item.product.min_order_quantity || 1,
            unit_type: item.unit_type || item.product.unit_type || 'piece',
            available_quantity: item.product.available_quantity ?? null,
            is_available: item.product.is_available ?? true,
            category: item.product.category,
          }, item.quantity)

          if (wasAdded) {
            addedCount++
          }
        }
      }

      if (addedCount > 0) {
        toast.success(t('orderDetail.actions.reorderSuccess', '{{count}} items added to cart', { count: addedCount }))
        navigate('/cart')
      }
    } catch (err) {
      logger.error('Reorder error:', err)
      toast.error(t('orderDetail.errors.reorderFailed', 'Failed to add items to cart'))
    }
  }

  const handleProductNoteChange = (itemId, note) => {
    setProductNotes((prev) => ({ ...prev, [itemId]: note }))
  }

  const toggleProductNote = (itemId) => {
    setExpandedProductNotes((prev) => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  const handleRateProduct = (item) => {
    setSelectedProduct(item)
    setProductRatingModalOpen(true)
  }

  const submitProductRating = async () => {
    if (!selectedProduct || ratingValue === 0) {
      toast.error(t('orderDetail.errors.selectRating', 'Please select a rating'))
      return
    }

    setSubmitting(true)
    try {
      await reviewService.createReview({
        productId: selectedProduct.product_id || selectedProduct.product?.id || null,
        orderId: id,
        vendorId: order?.vendor_id,
        userId: user?.id,
        rating: ratingValue,
        comment: ratingComment,
      })

      toast.success(t('orderDetail.notifications.ratingSubmitted', 'Rating submitted successfully!'))
      setProductRatingModalOpen(false)
      setRatingValue(0)
      setRatingComment('')
    } catch (err) {
      logger.error('Rating submission error:', err)
      toast.error(t('orderDetail.errors.ratingFailed', 'Failed to submit rating'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReturnRequest = async () => {
    if (!returnReason.trim()) {
      toast.error(t('orderDetail.errors.selectReason', 'Please select a reason'))
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.from('return_requests').insert({
        order_id: id,
        buyer_id: user?.id,
        reason: returnReason,
        description: returnDescription,
        item_ids: returnItems,
        status: 'pending',
        created_at: new Date().toISOString(),
      }).select().single()

      if (error) throw error

      toast.success(t('orderDetail.notifications.returnSubmitted', 'Return request submitted!'))
      setReturnModalOpen(false)
      setReturnReason('')
      setReturnDescription('')
      setReturnItems([])
    } catch (err) {
      logger.error('Return request error:', err)
      toast.error(t('orderDetail.errors.returnFailed', 'Failed to submit return request'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownloadInvoice = async () => {
    if (!order) return

    try {
      const invoice = await invoiceService.downloadOrderInvoice(order)
      toast.success(`تم تحميل الفاتورة الرسمية ${invoice.invoice_number || ''}`.trim())
    } catch (error) {
      logger.error('Invoice download error:', error)
      toast.error('تعذر تحميل الفاتورة الرسمية')
    }
  }

  const handleShareOrder = async () => {
    const shareData = {
      title: t('orderDetail.share.title', 'My Qotoof Order'),
      text: t('orderDetail.share.text', 'Order #{{orderNumber}} - {{total}}', {
        orderNumber: order?.order_number || order?.id?.slice(0, 8),
        total: formatPrice(order?.buyer_total || order?.total),
      }),
      url: `${window.location.origin}/orders/${id}`,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink()
        }
      }
    } else {
      handleCopyLink()
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/orders/${id}`)
      toast.success(t('orderDetail.notifications.linkCopied', 'Link copied to clipboard!'))
    } catch {
      toast.error(t('orderDetail.errors.copyFailed', 'Failed to copy link'))
    }
  }

  const handleCancelOrder = async () => {
    if (!order || !cancellationPreview) {
      toast.error('تعذر التحقق من سياسة الإلغاء لهذا الطلب حالياً.')
      return
    }

    const trimmedReason = cancellationReason.trim()
    if (trimmedReason.length < 5) {
      toast.error('يرجى كتابة سبب واضح للإلغاء لا يقل عن 5 أحرف.')
      return
    }

    setSubmitting(true)
    try {
      const result = await cancellationService.cancelOrderByBuyer({
        order,
        buyerId: user?.id,
        reason: trimmedReason,
        policy: cancellationPolicy,
      })

      setCancellationModalOpen(false)
      setCancellationReason('')

      toast.success(
        result.preview.withinFreeWindow
          ? 'تم إلغاء الطلب بدون رسوم، وسيتم استرداد كامل المبلغ.'
          : `تم إلغاء الطلب. صافي الاسترداد المتوقع ${formatMadAmount(result.preview.netRefundAmount)}.`
      )
      await loadOrder()
    } catch (err) {
      logger.error('Cancel order error:', err)
      toast.error(err?.message || t('orderDetail.errors.cancelFailed', 'Failed to cancel order'))
    } finally {
      setSubmitting(false)
    }
  }

  const openCancellationModal = () => {
    if (loadingCancellationPolicy) {
      toast.error('جاري تحميل سياسة الإلغاء، حاول مرة أخرى بعد لحظات.')
      return
    }

    if (!cancellationPreview?.allowed) {
      toast.error(cancellationPreview?.blockingReason || 'الإلغاء غير متاح لهذا الطلب حالياً.')
      return
    }

    setCancellationModalOpen(true)
  }

  const handleConfirmPaymentReceived = async () => {
    if (!order || user?.id !== order.vendor_id) {
      toast.error(t('marketplaceFeatures.orderDetailTracking.errors.actionNotAllowed'))
      return
    }

    const saleAmount = Number(order.subtotal || order.total || order.buyer_total || 0)
    if (!saleAmount || Number.isNaN(saleAmount) || saleAmount <= 0) {
      toast.error(t('marketplaceFeatures.orderDetailTracking.errors.saleAmountMissing'))
      return
    }

    setSubmitting(true)
    try {
      const hasPendingFirstReceiptVerification = Boolean(order.first_payment_receipt_url) && order.first_payment_status === 'paid'
      const hasPendingSecondReceiptVerification = Boolean(order.second_payment_receipt_url) && order.second_payment_status === 'paid'
      const needsCommissionConfirmation = hasPendingFirstReceiptVerification || (order.payment_type === 'cod' && !order.payment_received_at)

      const confirmationResult = await confirmOrderPayment({ orderId: order.id })

      if (hasPendingSecondReceiptVerification && !needsCommissionConfirmation) {
        toast.success('تم التحقق من الدفعة الثانية بنجاح.')
      } else {
        toast.success(t('marketplaceFeatures.orderDetailTracking.success.paymentConfirmed', {
          total: formatPrice(confirmationResult?.commission?.totalThisMonth || confirmationResult?.commission?.commissionSoFar || 0),
        }))
      }
      setPaymentReceivedModalOpen(false)
      await loadOrder()
    } catch (err) {
      logger.error('Confirm payment received error:', err)
      toast.error(err?.message || t('marketplaceFeatures.orderDetailTracking.errors.confirmPaymentFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartSelfDeliveryTracking = async () => {
    if (!order || user?.id !== order.vendor_id) {
      toast.error(t('marketplaceFeatures.orderDetailTracking.errors.startNotAllowed'))
      return
    }

    setSelfTrackingBusy(true)
    setSelfDeliveryTrackingError(null)

    try {
      const session = await driverLocationService.startBrowserTracking({
        driverId: user.id,
        orderId: order.id,
        vendorId: order.vendor_id,
        buyerId: order.buyer_id,
        broadcastStatus: 'active',
        metadata: {
          source: 'vendor-order-detail-self-delivery',
          delivery_option: order.delivery_option,
        },
        onLocation: () => {
          setSelfDeliveryTracking(true)
          setLastSelfDeliveryPing(new Date().toISOString())
          setSelfDeliveryTrackingError(null)
        },
        onError: (trackingError) => {
          logger.error('Self-delivery tracking error:', trackingError)
          setSelfDeliveryTrackingError(trackingError?.message || t('marketplaceFeatures.orderDetailTracking.errors.liveLocationUpdateFailed'))
        },
      })

      selfDeliveryTrackingStopRef.current = session.stop
      setSelfDeliveryTracking(true)
      toast.success(t('marketplaceFeatures.orderDetailTracking.success.selfDeliveryStarted'))
    } catch (trackingError) {
      logger.error('Failed to start self-delivery tracking:', trackingError)
      setSelfDeliveryTrackingError(trackingError?.message || t('marketplaceFeatures.orderDetailTracking.errors.startTrackingFailed'))
      toast.error(trackingError?.message || t('marketplaceFeatures.orderDetailTracking.errors.startTrackingFailed'))
    } finally {
      setSelfTrackingBusy(false)
    }
  }

  const handleStopSelfDeliveryTracking = async (eventType = 'paused') => {
    if (!order || user?.id !== order.vendor_id) return

    setSelfTrackingBusy(true)
    try {
      driverLocationService.stopBrowserTracking({
        driverId: user.id,
        orderId: order.id,
        vendorId: order.vendor_id,
        buyerId: order.buyer_id,
        eventType,
      })
      selfDeliveryTrackingStopRef.current = null
      setSelfDeliveryTracking(false)
      toast.success(
        eventType === 'completed'
          ? t('marketplaceFeatures.orderDetailTracking.success.broadcastCompleted')
          : t('marketplaceFeatures.orderDetailTracking.success.broadcastStopped')
      )
    } catch (trackingError) {
      logger.error('Failed to stop self-delivery tracking:', trackingError)
      toast.error(trackingError?.message || t('marketplaceFeatures.orderDetailTracking.errors.stopTrackingFailed'))
    } finally {
      setSelfTrackingBusy(false)
    }
  }

  // ============================================================
  // LOADING STATE
  // ============================================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-16">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-500 text-sm">{t('orderDetail.loading', 'Loading order details...')}</p>
        </div>
      </div>
    )
  }

  // ============================================================
  // ERROR STATE
  // ============================================================
  if (error === 'forbidden') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-16">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-full flex items-center justify-center">
            <ExclamationTriangleIcon className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {t('orderDetail.errors.forbidden.title', 'Access Denied')}
          </h2>
          <p className="text-gray-500 mb-6">
            {t('orderDetail.errors.forbidden.desc', 'You don\'t have permission to view this order.')}
          </p>
          <button
            onClick={() => navigate('/orders')}
            className="btn-primary"
          >
            {t('orderDetail.actions.backToOrders', 'Back to Orders')}
          </button>
        </div>
      </div>
    )
  }

  if (error === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-16">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <ShoppingBagIcon className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {t('orderDetail.errors.notFound.title', 'Order Not Found')}
          </h2>
          <p className="text-gray-500 mb-6">
            {t('orderDetail.errors.notFound.desc', 'We couldn\'t find an order with this ID. Please check the order number and try again.')}
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            {t('orderDetail.actions.backHome', 'Back to Home')}
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-16">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-full flex items-center justify-center">
            <ExclamationTriangleIcon className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {t('orderDetail.errors.loadError.title', 'Something went wrong')}
          </h2>
          <p className="text-gray-500 mb-6">
            {t('orderDetail.errors.loadError.desc', 'We couldn\'t load your order details. Please try again.')}
          </p>
          <button onClick={loadOrder} className="btn-primary">
            {t('common.tryAgain', 'Try Again')}
          </button>
        </div>
      </div>
    )
  }

  if (!order) return null

  // ============================================================
  // COMPUTED VALUES
  // ============================================================
  const currentStepIndex = getStatusStepIndex(order.status)
  const isDelivered = order.status === 'delivered'
  const isCancelled = order.status === 'cancelled' || order.status === 'vendor_rejected'
  const hasPaymentBeenConfirmed = Boolean(order.payment_received_at || order.status === 'payment_received')
  const hasPendingFirstReceiptVerification = Boolean(order.first_payment_receipt_url) && order.first_payment_status === 'paid'
  const hasPendingSecondReceiptVerification = Boolean(order.second_payment_receipt_url) && order.second_payment_status === 'paid'
  const canReturn = isDelivered && !order.return_requested
  const canRate = isDelivered
  const canDisplayCancellationAction = order.buyer_id === user?.id && !isCancelled && !isDelivered && BUYER_CANCELLABLE_STATUSES.includes(order.status)
  const canCancel = canDisplayCancellationAction && Boolean(cancellationPreview?.allowed)
  const canVendorConfirmPayment = order.vendor_id === user?.id && (
    hasPendingFirstReceiptVerification ||
    hasPendingSecondReceiptVerification ||
    (order.payment_type === 'cod' && PAYMENT_CONFIRMATION_ELIGIBLE_STATUSES.includes(order.status) && !hasPaymentBeenConfirmed)
  )
  const liveTrackingActorId = order.delivery_option === 'self' ? order.vendor_id : order.driver_id
  const canShowRouteMap = ROUTE_AND_TRACKING_STATUSES.includes(order.status) && order.vendor?.latitude && order.vendor?.longitude && order.shipping_latitude && order.shipping_longitude
  const canShowLiveMap = canShowRouteMap && Boolean(liveTrackingActorId)
  const canVendorTrackSelfDelivery = order.delivery_option === 'self' && order.vendor_id === user?.id && ROUTE_AND_TRACKING_STATUSES.includes(order.status) && !isCancelled && !isDelivered
  const canBuyerUploadFirstReceipt = order.buyer_id === user?.id && order.payment_type !== 'cod' && Number(order.first_payment_amount || 0) > 0 && order.first_payment_status !== 'verified'
  const canBuyerUploadSecondReceipt = order.buyer_id === user?.id && order.payment_type === 'split' && order.first_payment_status === 'verified' && Number(order.second_payment_amount || 0) > 0 && order.second_payment_status !== 'verified' && SECOND_RECEIPT_UPLOAD_STATUSES.includes(order.status)
  const paymentConfirmationMode = hasPendingSecondReceiptVerification ? 'second' : hasPendingFirstReceiptVerification ? 'first' : 'cod'
  const cancellationActionDescription = loadingCancellationPolicy
    ? 'جاري التحقق من سياسة الإلغاء لهذا الطلب.'
    : cancellationPreview?.allowed
      ? cancellationPreview.withinFreeWindow
        ? 'الإلغاء مجاني حالياً وسيتم استرداد كامل المبلغ.'
        : `رسوم الإلغاء ${formatMadAmount(cancellationPreview.cancellationFee)} وصافي الاسترداد ${formatMadAmount(cancellationPreview.netRefundAmount)}.`
      : cancellationPreview?.blockingReason || t('orderDetail.actions.cancelOrderDesc', 'Cancel this order')

  // Check if order is confirmed or beyond (show delivery info)
  const isOrderConfirmed = ORDER_CONFIRMED_STATUSES.includes(order.status)

  const orderDate = new Date(order.created_at)
  const formattedDate = orderDate.toLocaleDateString(i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'fr' ? 'fr-MA' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const subtotal = order.items?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || order.subtotal || 0
  const platformFee = order.buyer_commission || 0
  const shippingCost = order.shipping_cost || 0
  const total = order.buyer_total || order.total || 0

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50" dir={i18n.dir()}>
      {/* Real-time indicator */}
      {realtimeConnected && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-xs text-green-700 font-medium">
            {t('orderDetail.live', 'Live')}
          </span>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ============================================================
            SECTION 1: ORDER HEADER
            ============================================================ */}
        <div className="mb-6 sm:mb-8">
          {/* Order Number & Status */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShoppingBagIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    {t('orderDetail.orderNumber', 'Order #{{number}}', {
                      number: order.order_number || order.id?.slice(0, 8),
                    })}
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                    <CalendarIcon className="w-4 h-4" />
                    <time dateTime={order.created_at}>{formattedDate}</time>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2 sm:flex-shrink-0">
              {(() => {
                const meta = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.pending
                const Icon = meta.icon
                const sc = getOrderStatusColors(order.status)
                return (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                    <Icon className="w-4 h-4" />
                    {t(meta.label, meta.labelDefault)}
                  </span>
                )
              })()}
            </div>
          </div>

          {/* Vendor Info Card */}
          <Card className="p-4 sm:p-5 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  {order.vendor?.avatar_url ? (
                    <img
                      src={order.vendor.avatar_url}
                      alt={order.vendor.store_name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-6 h-6 text-green-600" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t('orderDetail.vendor', 'Vendor')}</p>
                  <p className="font-semibold text-gray-900">{order.vendor?.store_name || t('orderDetail.vendorUnknown', 'Unknown Vendor')}</p>
                  {order.vendor?.city && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <MapPinIcon className="w-3 h-3" />
                      {order.vendor.city}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCallVendor}
                  disabled={!order.vendor?.phone}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
                  aria-label={t('orderDetail.actions.callVendor', 'Call vendor')}
                >
                  <PhoneIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('orderDetail.actions.call', 'Call')}</span>
                </button>
                <button
                  onClick={handleContactVendor}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors shadow-sm min-h-[48px]"
                  aria-label={t('orderDetail.actions.contactVendor', 'Contact vendor')}
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4" />
                  <span>{t('orderDetail.actions.chat', 'Chat')}</span>
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* ============================================================
            SECTION 2: DELIVERY ADDRESS (Only show after confirmation)
            ============================================================ */}
        {isOrderConfirmed && (
          <Card className="p-4 sm:p-5 bg-white mb-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPinIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {t('orderDetail.deliveryAddress', 'Delivery Address')}
                </h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {order.shipping_address || t('orderDetail.noAddress', 'No address provided')}
                </p>
                {(order.shipping_city || order.shipping_country) && (
                  <p className="text-gray-500 text-sm mt-1">
                    {[order.shipping_city, order.shipping_country].filter(Boolean).join(', ')}
                  </p>
                )}
                {order.requested_delivery_date && order.requested_delivery_slot_label && (
                  <p className="text-indigo-700 text-sm mt-2">
                    موعد التسليم المطلوب: {order.requested_delivery_date} • {order.requested_delivery_slot_label}
                  </p>
                )}
                {order.buyer_notes && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <InformationCircleIcon className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-yellow-800 mb-0.5">
                          {t('orderDetail.deliveryNotes', 'Delivery Notes')}
                        </p>
                        <p className="text-sm text-yellow-700">{order.buyer_notes}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Show pending message if order not yet confirmed */}
        {order.status === 'pending' && (
          <Card className="p-4 sm:p-5 bg-yellow-50 border border-yellow-200 mb-6">
            <div className="flex items-start gap-3">
              <ClockIcon className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900 mb-1">
                  {t('orderDetail.pendingConfirmation', 'Awaiting Vendor Confirmation')}
                </h3>
                <p className="text-yellow-700 text-sm">
                  {t('orderDetail.pendingConfirmationDesc', 'Your order is pending. The vendor will confirm your order shortly.')}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* ============================================================
            ROUTE MAP: Show when order is being delivered
            ============================================================ */}
        {canShowRouteMap && (
          <Card className="p-4 sm:p-5 bg-white mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TruckIcon className="w-5 h-5 text-green-600" />
              {t('orderDetail.deliveryRoute', 'مسار التوصيل')}
            </h3>
            <RouteMap
              origin={{ lat: order.vendor?.latitude, lng: order.vendor?.longitude, label: order.vendor?.store_name || order.vendor?.first_name || 'البائع' }}
              destination={{ lat: order.shipping_latitude, lng: order.shipping_longitude, label: t('orderDetail.yourLocation', 'موقع التسليم') }}
              height="320px"
            />
          </Card>
        )}

        {canShowLiveMap && (
          <Card className="p-4 sm:p-5 bg-white mb-6">
            <LiveDriverMap
              driverId={liveTrackingActorId}
              orderId={order.id}
              pickupLocation={{
                lat: order.vendor.latitude,
                lng: order.vendor.longitude,
                label: order.vendor.store_name || order.vendor.first_name || 'موقع الانطلاق',
              }}
              deliveryLocation={{
                lat: order.shipping_latitude,
                lng: order.shipping_longitude,
                label: t('orderDetail.yourLocation', 'موقع التسليم'),
              }}
              title={order.delivery_option === 'self'
                ? t('marketplaceFeatures.orderDetailTracking.liveMap.vendorTitle')
                : t('marketplaceFeatures.orderDetailTracking.liveMap.driverTitle')}
              height="320px"
            />
          </Card>
        )}

        {canVendorTrackSelfDelivery && (
          <Card className="p-4 sm:p-5 bg-white mb-6 border border-teal-100">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <TruckIcon className="w-5 h-5 text-teal-600" />
                  {t('marketplaceFeatures.orderDetailTracking.card.title')}
                </h3>
                <p className="text-sm text-gray-600 leading-6">
                  {t('marketplaceFeatures.orderDetailTracking.card.description')}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                  <span className={`px-2.5 py-1 rounded-full font-medium ${selfDeliveryTracking ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {selfDeliveryTracking
                      ? t('marketplaceFeatures.orderDetailTracking.card.broadcastOn')
                      : t('marketplaceFeatures.orderDetailTracking.card.broadcastOff')}
                  </span>
                  {lastSelfDeliveryPing && (
                    <span className="text-gray-500">
                      {t('marketplaceFeatures.orderDetailTracking.card.lastPing', {
                        time: new Date(lastSelfDeliveryPing).toLocaleTimeString(i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'fr' ? 'fr-MA' : 'en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      })}
                    </span>
                  )}
                </div>
                {selfDeliveryTrackingError && (
                  <p className="text-xs text-red-600 mt-2">{selfDeliveryTrackingError}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartSelfDeliveryTracking}
                  disabled={selfTrackingBusy || selfDeliveryTracking}
                  className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                >
                  {selfTrackingBusy && !selfDeliveryTracking
                    ? t('marketplaceFeatures.orderDetailTracking.card.starting')
                    : t('marketplaceFeatures.orderDetailTracking.card.startBroadcast')}
                </button>
                <button
                  type="button"
                  onClick={() => handleStopSelfDeliveryTracking('paused')}
                  disabled={selfTrackingBusy || !selfDeliveryTracking}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {selfTrackingBusy && selfDeliveryTracking
                    ? t('marketplaceFeatures.orderDetailTracking.card.stopping')
                    : t('marketplaceFeatures.orderDetailTracking.card.stopBroadcast')}
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* ============================================================
            SECTION 3: ORDER TIMELINE / STATUS TRACKER
            ============================================================ */}
        <Card className="p-4 sm:p-6 bg-white mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-green-600" />
            {t('orderDetail.orderProgress', 'Order Progress')}
          </h2>

          {/* Desktop: Horizontal Timeline */}
          <div className="hidden sm:block">
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${(Math.max(currentStepIndex, 0) / (TIMELINE_STEPS.length - 1)) * 100}%` }}
                />
              </div>

              {/* Steps */}
              <div className="relative flex justify-between">
                {TIMELINE_STEPS.map((step, index) => {
                  const Icon = step.icon
                  const isCompleted = index <= currentStepIndex && !isCancelled
                  const isCurrent = index === currentStepIndex && !isCancelled
                  return (
                    <div key={step.key} className="flex flex-col items-center flex-1">
                      <div
                        className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                          isCancelled && index > 0
                            ? 'bg-gray-200 text-gray-400'
                            : isCompleted
                            ? 'bg-green-500 text-white shadow-md shadow-green-200'
                            : isCurrent
                            ? 'bg-white border-2 border-green-500 text-green-600 ring-4 ring-green-100'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {isCancelled && index === 0 ? (
                          <XMarkIcon className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium text-center ${
                          isCurrent ? 'text-green-600' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                        }`}
                      >
                        {t(step.label, step.labelDefault)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Mobile: Vertical Timeline */}
          <div className="sm:hidden space-y-0">
            {TIMELINE_STEPS.map((step, index) => {
              const Icon = step.icon
              const isCompleted = index <= currentStepIndex && !isCancelled
              const isCurrent = index === currentStepIndex && !isCancelled
              return (
                <div key={step.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        isCancelled && index > 0
                          ? 'bg-gray-200 text-gray-400'
                          : isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-white border-2 border-green-500 text-green-600'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isCancelled && index === 0 ? (
                        <XMarkIcon className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    {index < TIMELINE_STEPS.length - 1 && (
                      <div className={`w-0.5 h-10 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                  <div className="pt-1 pb-4">
                    <p
                      className={`font-medium text-sm ${
                        isCurrent ? 'text-green-600' : isCompleted ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {t(step.label, step.labelDefault)}
                    </p>
                    {/* Show timeline entry if available */}
                    {timeline.find((tl) => tl.status === step.key) && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(timeline.find((tl) => tl.status === step.key).created_at).toLocaleString(
                          i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'fr' ? 'fr-MA' : 'en-US',
                          { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Driver Info (if assigned) */}
          {order.driver && (
            <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  {order.driver.avatar_url ? (
                    <img
                      src={order.driver.avatar_url}
                      alt={order.driver.first_name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <TruckIcon className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">
                    {order.driver.first_name} {order.driver.last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {order.driver.vehicle_type && `${order.driver.vehicle_type}`}
                    {order.driver.vehicle_plate && ` • ${order.driver.vehicle_plate}`}
                  </p>
                </div>
                {order.driver.phone && (
                  <a
                    href={`tel:${order.driver.phone}`}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors min-h-[40px]"
                  >
                    <PhoneIcon className="w-3.5 h-3.5" />
                    {t('orderDetail.actions.call', 'Call')}
                  </a>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* ============================================================
            SECTION 4: ORDER ITEMS
            ============================================================ */}
        <Card className="bg-white mb-6 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <TagIcon className="w-5 h-5 text-green-600" />
              {t('orderDetail.orderItems', 'Order Items')}
              <span className="ml-auto text-sm text-gray-500 font-normal">
                {order.items?.length || 0} {t('orderDetail.items', 'items')}
              </span>
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {order.items?.map((item) => {
              const productImage = item.product?.images?.[0]?.url || item.product?.image_url
              const productName = item.product?.name || t('orderDetail.unknownProduct', 'Unknown Product')
              const itemTotal = item.quantity * item.unit_price
              const isExpanded = expandedProductNotes[item.id]

              return (
                <div key={item.id} className="p-4 sm:p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex gap-3 sm:gap-4">
                    {/* Product Image */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      {productImage ? (
                        <OptimizedImage
                          src={productImage}
                          alt={productName}
                          className="w-full h-full"
                          placeholder="blur"
                          objectFit="cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBagIcon className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                            {productName}
                          </h3>
                          {item.product?.unit && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {t('orderDetail.pricePerUnit', '{{price}} / {{unit}}', {
                                price: formatPrice(item.unit_price),
                                unit: item.product.unit,
                              })}
                            </p>
                          )}
                        </div>
                        <p className="font-bold text-gray-900 text-sm sm:text-base flex-shrink-0">
                          {formatPrice(itemTotal)}
                        </p>
                      </div>

                      {/* Quantity & Price Details */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>
                          {t('orderDetail.quantity', 'Qty')}: {item.quantity}
                        </span>
                        <span>
                          {formatPrice(item.unit_price)} {t('common.each', 'each')}
                        </span>
                      </div>

                      {/* Product Actions */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {canRate && (
                          <button
                            onClick={() => handleRateProduct(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors min-h-[40px]"
                          >
                            <StarSolid className="w-3.5 h-3.5 text-yellow-500" />
                            {t('orderDetail.actions.rateProduct', 'Rate')}
                          </button>
                        )}
                        <button
                          onClick={() => toggleProductNote(item.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors min-h-[40px]"
                        >
                          {isExpanded ? (
                            <ChevronUpIcon className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDownIcon className="w-3.5 h-3.5" />
                          )}
                          {isExpanded
                            ? t('orderDetail.actions.hideNote', 'Hide Note')
                            : t('orderDetail.actions.addNote', 'Add Note')}
                        </button>
                      </div>

                      {/* Product Note Input */}
                      {isExpanded && (
                        <div className="mt-3">
                          <textarea
                            value={productNotes[item.id] || ''}
                            onChange={(e) => handleProductNoteChange(item.id, e.target.value)}
                            placeholder={t('orderDetail.productNotePlaceholder', 'Add a note about this product...')}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                            rows={2}
                            maxLength={500}
                          />
                          <p className="text-xs text-gray-400 mt-1 text-right">
                            {(productNotes[item.id] || '').length}/500
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Financial Summary */}
          <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-100">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('orderDetail.subtotal', 'Subtotal')}</span>
                <span className="font-medium text-gray-900">{formatPrice(subtotal)}</span>
              </div>

              {platformFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                  {t('orderDetail.platformFee', 'Platform Fee')}
                  </span>
                  <span className="font-medium text-gray-900">{formatPrice(platformFee)}</span>
                </div>
              )}

              {shippingCost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('orderDetail.shipping', 'Shipping')}</span>
                  <span className="font-medium text-gray-900">{formatPrice(shippingCost)}</span>
                </div>
              )}

              {order.commission > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    {t('orderDetail.vendorCommission', 'Vendor Commission')}
                  </span>
                  <span className="font-medium text-red-600">- {formatPrice(order.commission)}</span>
                </div>
              )}

              {order.driver_commission > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    {t('orderDetail.driverCommission', 'Driver Commission')}
                  </span>
                  <span className="font-medium text-red-600">- {formatPrice(order.driver_commission)}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-3 mt-3">
                <span className="text-gray-900">{t('orderDetail.totalPaid', 'Total Paid')}</span>
                <span className="text-green-600">{formatPrice(total)}</span>
              </div>

              {order.vendor_amount > 0 && (
                <div className="flex justify-between text-sm pt-1">
                  <span className="text-gray-500 italic">
                    {t('orderDetail.vendorReceives', 'Vendor Receives')}
                  </span>
                  <span className="font-semibold text-green-600">
                    {formatPrice(order.vendor_amount)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ============================================================
            SECTION 5: POST-PURCHASE ACTIONS
            ============================================================ */}
        <Card className="p-4 sm:p-5 bg-white mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <InformationCircleIcon className="w-5 h-5 text-green-600" />
            {t('orderDetail.actions.title', 'Order Actions')}
          </h2>

          {(canBuyerUploadFirstReceipt || canBuyerUploadSecondReceipt) && (
            <div className="mb-4 space-y-4">
              {canBuyerUploadFirstReceipt && (
                <PaymentReceiptUpload
                  order={order}
                  stage="first"
                  onUploadComplete={(updatedOrder) => setOrder((prev) => ({ ...prev, ...updatedOrder }))}
                />
              )}

              {canBuyerUploadSecondReceipt && (
                <PaymentReceiptUpload
                  order={order}
                  stage="second"
                  onUploadComplete={(updatedOrder) => setOrder((prev) => ({ ...prev, ...updatedOrder }))}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Vendor: Confirm external payment and calculate 3% commission */}
            {canVendorConfirmPayment && (
              <button
                onClick={() => setPaymentReceivedModalOpen(true)}
                disabled={submitting}
                className="flex items-center gap-3 p-4 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-xl hover:from-teal-100 hover:to-emerald-100 transition-all group min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircleIcon className="w-5 h-5 text-teal-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">
                    {paymentConfirmationMode === 'second'
                      ? 'تأكيد الدفعة الثانية'
                      : paymentConfirmationMode === 'first'
                        ? 'تأكيد الإيصال المرفوع'
                        : t('marketplaceFeatures.orderDetailTracking.paymentAction.title')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {paymentConfirmationMode === 'second'
                      ? 'راجع الإيصال النهائي وأغلق الالتزام المالي لهذا الطلب.'
                      : paymentConfirmationMode === 'first'
                        ? 'تحقق من الإيصال لبدء التنفيذ واعتماد الدفعة الأولى.'
                        : t('marketplaceFeatures.orderDetailTracking.paymentAction.description')}
                  </p>
                </div>
              </button>
            )}

            {/* Cancel Order (Only for pending/confirmed) */}
            {canDisplayCancellationAction && (
              <button
                onClick={openCancellationModal}
                disabled={submitting || loadingCancellationPolicy || !canCancel}
                className="flex items-center gap-3 p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl hover:from-red-100 hover:to-pink-100 transition-all group min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <XMarkIcon className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">
                    {t('orderDetail.actions.cancelOrder', 'Cancel Order')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {cancellationActionDescription}
                  </p>
                </div>
              </button>
            )}

            {/* Rate Products */}
            {canRate && (
              <button
                onClick={() => {
                  if (order.items?.[0]) {
                    handleRateProduct(order.items[0])
                  }
                }}
                className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl hover:from-yellow-100 hover:to-amber-100 transition-all group min-h-[56px]"
              >
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <StarSolid className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">
                    {t('orderDetail.actions.rateOrder', 'Rate Products')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('orderDetail.actions.rateOrderDesc', 'Share your experience')}
                  </p>
                </div>
              </button>
            )}

            {/* Return / Exchange */}
            {canReturn && (
              <button
                onClick={() => setReturnModalOpen(true)}
                className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl hover:from-orange-100 hover:to-red-100 transition-all group min-h-[56px]"
              >
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ArrowPathIcon className="w-5 h-5 text-orange-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 text-sm">
                    {t('orderDetail.actions.return', 'Return / Exchange')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('orderDetail.actions.returnDesc', 'Request a return')}
                  </p>
                </div>
              </button>
            )}

            {/* Reorder */}
            <button
              onClick={handleReorder}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl hover:from-green-100 hover:to-emerald-100 transition-all group min-h-[56px]"
            >
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowPathIcon className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 text-sm">
                  {t('orderDetail.actions.reorder', 'Reorder')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('orderDetail.actions.reorderDesc', 'Add to cart again')}
                </p>
              </div>
            </button>

            {/* Download Invoice */}
            <button
              onClick={() => navigate(`/orders/${id}/condition`)}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl hover:from-emerald-100 hover:to-teal-100 transition-all group min-h-[56px]"
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <CameraIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 text-sm">سجل حالة المنتج</p>
                <p className="text-xs text-gray-500">توثيق وعرض الصور القانونية</p>
              </div>
            </button>

            <FraudReportButton
              order={order}
              buttonLabel="الإبلاغ عن احتيال"
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl hover:from-red-100 hover:to-rose-100 transition-all group min-h-[56px]"
            />

            <button
              onClick={handleDownloadInvoice}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-indigo-100 transition-all group min-h-[56px]"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <ArrowDownTrayIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 text-sm">
                  {t('orderDetail.actions.downloadInvoice', 'Download Invoice')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('orderDetail.actions.downloadInvoiceDesc', 'PDF receipt')}
                </p>
              </div>
            </button>

            {/* Share Order */}
            <button
              onClick={handleShareOrder}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl hover:from-purple-100 hover:to-pink-100 transition-all group min-h-[56px]"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShareIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 text-sm">
                  {t('orderDetail.actions.share', 'Share Order')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('orderDetail.actions.shareDesc', 'Share via apps')}
                </p>
              </div>
            </button>

            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl hover:from-gray-100 hover:to-slate-100 transition-all group min-h-[56px]"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <ClipboardDocumentIcon className="w-5 h-5 text-gray-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 text-sm">
                  {t('orderDetail.actions.copyLink', 'Copy Link')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('orderDetail.actions.copyLinkDesc', 'Copy order URL')}
                </p>
              </div>
            </button>
          </div>
        </Card>

        {/* ============================================================
            SECTION 6: RECEIPT
            ============================================================ */}
        <div id="order-receipt">
          <Receipt order={order} />
        </div>
      </div>

      {/* ============================================================
          MODALS
          ============================================================ */}

      {/* Chat Modal */}
      <Modal
        isOpen={chatModalOpen}
        onClose={() => setChatModalOpen(false)}
        size="lg"
        title={t('orderDetail.chat.title', 'Chat with Vendor')}
      >
        <div className="h-96">
          {order.vendor && (
            <ChatComponent
              orderId={id}
              receiverId={order.vendor_id}
              receiverName={order.vendor.store_name}
              receiverPhone={order.vendor.phone}
            />
          )}
        </div>
      </Modal>

      <Modal
        isOpen={paymentReceivedModalOpen}
        onClose={() => setPaymentReceivedModalOpen(false)}
        size="md"
        title={paymentConfirmationMode === 'second' ? 'تأكيد الدفعة الثانية' : t('marketplaceFeatures.orderDetailTracking.paymentModal.title')}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 leading-6">
            {paymentConfirmationMode === 'second'
              ? 'تأكيدك لهذه العملية يعني أن الدفعة النهائية وصلت وتمت مراجعة الإيصال النهائي على هذا الطلب.'
              : paymentConfirmationMode === 'first'
                ? 'تأكيدك لهذه العملية يعني أن الدفعة الأولى وصلت وتمت مراجعة الإيصال المرفوع من المشتري.'
                : t('marketplaceFeatures.orderDetailTracking.paymentModal.intro')}
          </p>
          <ul className="list-disc pr-5 space-y-1 text-sm text-gray-600">
            {paymentConfirmationMode === 'second' ? (
              <>
                <li>سيتم اعتماد الدفعة الثانية كمدفوعة ومتحقق منها.</li>
                <li>سيبقى سجل الإيصال محفوظاً للرجوع إليه في أي نزاع لاحق.</li>
                <li>لن تتغير حالة التوصيل الحالية إلا إذا كانت هناك قواعد عمل أخرى تطبق على الطلب.</li>
              </>
            ) : (
              <>
                <li>{t('marketplaceFeatures.orderDetailTracking.paymentModal.recordSale')}</li>
                <li>{t('marketplaceFeatures.orderDetailTracking.paymentModal.applyCommission')}</li>
                <li>{t('marketplaceFeatures.orderDetailTracking.paymentModal.keepDeliveryStatus')}</li>
              </>
            )}
          </ul>
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
            {paymentConfirmationMode === 'second' ? 'قيمة الدفعة الثانية' : t('marketplaceFeatures.orderDetailTracking.paymentModal.saleValue')}: <span className="font-semibold">{formatPrice(paymentConfirmationMode === 'second' ? Number(order?.second_payment_amount || 0) : Number(order?.subtotal || order?.total || order?.buyer_total || 0))}</span>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setPaymentReceivedModalOpen(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={submitting}
            >
              {t('marketplaceFeatures.orderDetailTracking.paymentModal.cancel')}
            </button>
            <button
              onClick={handleConfirmPaymentReceived}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? t('orderDetail.actions.confirming', 'Confirming...') : t('marketplaceFeatures.orderDetailTracking.paymentModal.confirm')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={cancellationModalOpen}
        onClose={() => {
          if (submitting) return
          setCancellationModalOpen(false)
        }}
        size="lg"
        title="إلغاء الطلب"
      >
        <div className="space-y-5 text-sm text-gray-700">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-red-900">
            <p className="font-semibold mb-2">سيتم تنفيذ الإلغاء وفق سياسة المتجر الحالية.</p>
            <p className="leading-6">
              {cancellationPreview?.summaryLine || 'راجع الرسوم ونسبة الاسترداد قبل تأكيد الإلغاء.'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">إجمالي الطلب</p>
              <p className="font-semibold text-gray-900">{formatMadAmount(cancellationPreview?.orderTotal)}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">رسوم الإلغاء</p>
              <p className="font-semibold text-gray-900">{formatMadAmount(cancellationPreview?.cancellationFee)}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">نسبة الاسترداد المطبقة</p>
              <p className="font-semibold text-gray-900">{Number(cancellationPreview?.refundPercentageApplied || 0).toFixed(2)}%</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">صافي الاسترداد المتوقع</p>
              <p className="font-semibold text-emerald-700">{formatMadAmount(cancellationPreview?.netRefundAmount)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-blue-900">
            <p className="font-semibold mb-2">تفاصيل السياسة</p>
            <ul className="space-y-1 leading-6">
              <li>النافذة المجانية: {Number(cancellationPolicy?.free_cancellation_window_minutes || 0).toFixed(0)} دقيقة</li>
              <li>المدة المنقضية منذ إنشاء الطلب: {Number(cancellationPreview?.elapsedMinutes || 0).toFixed(0)} دقيقة</li>
              <li>إيقاف الإلغاء عند الحالة: {cancellationPolicy?.cutoff_status || 'vendor_accepted'}</li>
            </ul>
            {cancellationPolicy?.policy_text_ar && (
              <p className="mt-3 leading-6">{cancellationPolicy.policy_text_ar}</p>
            )}
          </div>

          <div>
            <label htmlFor="buyer-cancellation-reason" className="mb-1 block text-sm font-medium text-gray-700">
              سبب الإلغاء
            </label>
            <textarea
              id="buyer-cancellation-reason"
              rows="4"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="اكتب سبب الإلغاء ليتم حفظه مع الطلب وإرساله للبائع."
              disabled={submitting}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCancellationModalOpen(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={submitting}
            >
              {t('orderDetail.cancel.keepOrder', 'Keep Order')}
            </button>
            <button
              type="button"
              onClick={handleCancelOrder}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? t('orderDetail.actions.cancelling', 'Cancelling...') : t('orderDetail.actions.cancelOrder', 'Cancel Order')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Return / Exchange Modal */}
      <Modal
        isOpen={returnModalOpen}
        onClose={() => {
          setReturnModalOpen(false)
          setReturnReason('')
          setReturnDescription('')
          setReturnItems([])
        }}
        size="md"
        title={t('orderDetail.return.title', 'Return / Exchange Request')}
      >
        <div className="space-y-4">
          {/* Select Items */}
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">
              {t('orderDetail.return.selectItems', 'Select items to return')}
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {order.items?.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={returnItems.includes(item.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setReturnItems((prev) => [...prev, item.id])
                      } else {
                        setReturnItems((prev) => prev.filter((id) => id !== item.id))
                      }
                    }}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.product?.name || t('orderDetail.unknownProduct', 'Unknown Product')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t('orderDetail.quantity', 'Qty')}: {item.quantity} • {formatPrice(item.quantity * item.unit_price)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orderDetail.return.reason', 'Reason for return')}
            </label>
            <select
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent min-h-[48px]"
            >
              <option value="">{t('orderDetail.return.selectReason', 'Select a reason')}</option>
              <option value="damaged">{t('orderDetail.return.reasons.damaged', 'Damaged during delivery')}</option>
              <option value="wrong_item">{t('orderDetail.return.reasons.wrongItem', 'Wrong item received')}</option>
              <option value="quality">{t('orderDetail.return.reasons.quality', 'Quality not as expected')}</option>
              <option value="quantity">{t('orderDetail.return.reasons.quantity', 'Incorrect quantity')}</option>
              <option value="late">{t('orderDetail.return.reasons.late', 'Delivery too late')}</option>
              <option value="other">{t('orderDetail.return.reasons.other', 'Other')}</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orderDetail.return.description', 'Additional details')}
            </label>
            <textarea
              value={returnDescription}
              onChange={(e) => setReturnDescription(e.target.value)}
              placeholder={t('orderDetail.return.descriptionPlaceholder', 'Describe the issue in detail...')}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none min-h-[100px]"
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setReturnModalOpen(false)
                setReturnReason('')
                setReturnDescription('')
                setReturnItems([])
              }}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-h-[48px]"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleReturnRequest}
              disabled={submitting || !returnReason || returnItems.length === 0}
              className="flex-1 px-4 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('common.submitting', 'Submitting...')}
                </span>
              ) : (
                t('orderDetail.return.submit', 'Submit Request')
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Product Rating Modal */}
      <Modal
        isOpen={productRatingModalOpen}
        onClose={() => {
          setProductRatingModalOpen(false)
          setRatingValue(0)
          setRatingComment('')
          setSelectedProduct(null)
        }}
        size="md"
        title={t('orderDetail.rating.title', 'Rate Product')}
      >
        <div className="space-y-5">
          {/* Product Info */}
          {selectedProduct && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {selectedProduct.product?.images?.[0]?.url ? (
                  <img
                    src={selectedProduct.product.images[0].url}
                    alt={selectedProduct.product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBagIcon className="w-5 h-5 text-gray-300" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">
                  {selectedProduct.product?.name || t('orderDetail.unknownProduct', 'Unknown Product')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('orderDetail.quantity', 'Qty')}: {selectedProduct.quantity}
                </p>
              </div>
            </div>
          )}

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('orderDetail.rating.yourRating', 'Your Rating')}
            </label>
            <div className="flex items-center gap-2 justify-center py-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRatingValue(star)}
                  className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
                  aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
                >
                  <StarSolid
                    className={`w-8 h-8 sm:w-10 sm:h-10 ${
                      star <= ratingValue ? 'text-yellow-400' : 'text-gray-200'
                    }`}
                  />
                </button>
              ))}
            </div>
            {ratingValue > 0 && (
              <p className="text-center text-sm text-gray-600 mt-1">
                {ratingValue === 5 && t('orderDetail.rating.excellent', 'Excellent!')}
                {ratingValue === 4 && t('orderDetail.rating.great', 'Great!')}
                {ratingValue === 3 && t('orderDetail.rating.good', 'Good')}
                {ratingValue === 2 && t('orderDetail.rating.fair', 'Fair')}
                {ratingValue === 1 && t('orderDetail.rating.poor', 'Poor')}
              </p>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('orderDetail.rating.comment', 'Your Review (optional)')}
            </label>
            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder={t('orderDetail.rating.commentPlaceholder', 'Tell us about your experience with this product...')}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {ratingComment.length}/500
            </p>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setProductRatingModalOpen(false)
                setRatingValue(0)
                setRatingComment('')
                setSelectedProduct(null)
              }}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-h-[48px]"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              onClick={submitProductRating}
              disabled={submitting || ratingValue === 0}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[48px]"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('common.submitting', 'Submitting...')}
                </span>
              ) : (
                t('orderDetail.rating.submit', 'Submit Rating')
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const OrderDetailWithErrorBoundary = () => (
  <ErrorBoundary componentName="OrderDetailPage">
    <OrderDetail />
  </ErrorBoundary>
)

export default OrderDetailWithErrorBoundary
