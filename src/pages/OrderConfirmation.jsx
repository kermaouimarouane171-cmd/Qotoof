import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { CheckCircleIcon, ShoppingBagIcon, TruckIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { LoadingSpinner, Receipt } from '@/components/ui'
import PaymentReceiptUpload from '@/components/orders/PaymentReceiptUpload'
import { paymentGateway } from '@/services/paymentGateway'
import { updateOrderPaymentRecord, getLatestOrderPaymentRecord } from '@/services/paymentService'
import { useAuthStore } from '@/store/authStore'
import { logger } from '@/utils/logger'
import { useOrderView } from '@/hooks/useOrderView'
import { supabase } from '@/services/supabase'

const OrderConfirmation = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { id: routeOrderId } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()
  const [order, setOrder] = useState(null)
  const [errorState, setErrorState] = useState(null)
  const [paypalMessage, setPaypalMessage] = useState('')
  const [processingPayPal, setProcessingPayPal] = useState(false)
  const paypalHandledRef = useRef(false)

  const paypalAction = searchParams.get('paypal')
  const paypalToken = searchParams.get('token')
  const confirmationPath = routeOrderId ? `/order-confirmation/${routeOrderId}` : '/order-confirmation'

  const targetOrderId = user?.id ? (routeOrderId || location.state?.order?.id) : null
  const {
    data: orderView,
    isLoading: loadingOrder,
    error: queryError,
    refetch,
  } = useOrderView(targetOrderId)

  // Redirect unauthenticated visitors
  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: confirmationPath } })
    }
  }, [user, navigate, confirmationPath])

  // Map RPC response → component order state
  useEffect(() => {
    if (!targetOrderId && !loadingOrder) {
      setOrder(null)
      setErrorState('missing_order')
      return
    }
    if (queryError) {
      logger.error('Failed to load order confirmation data:', queryError)
      setOrder(null)
      setErrorState('load_failed')
      return
    }
    if (orderView) {
      setOrder({
        ...orderView.order,
        items: (orderView.items || []).map((item) => ({
          ...item,
          price: item.unit_price ?? item.price ?? 0,
        })),
        payment_method: orderView.payment?.payment_method || orderView.order?.payment_method || null,
        payment_record_status: orderView.payment?.status || null,
        payment_transaction_id: orderView.payment?.transaction_id || null,
        buyer: orderView.buyer || {},
        vendor: orderView.vendor || {},
      })
      setErrorState(null)
    }
  }, [orderView, queryError, targetOrderId, loadingOrder])

  useEffect(() => {
    paypalHandledRef.current = false
  }, [routeOrderId])

  useEffect(() => {
    let active = true

    const finalizePayPal = async () => {
      if (paypalHandledRef.current) return
      if (!order?.id || order?.payment_method !== 'paypal' || !paypalAction) return

      paypalHandledRef.current = true

      if (paypalAction === 'cancel') {
        if (active) {
          setPaypalMessage('تم إلغاء عملية PayPal. يمكنك إعادة المحاولة من نفس صفحة الطلب.')
        }
        return
      }

      if (paypalAction !== 'success' || !paypalToken) {
        return
      }

      if (order.payment_record_status === 'completed') {
        if (active) {
          setPaypalMessage('تم تأكيد دفع PayPal بنجاح.')
        }
        return
      }

      try {
        setProcessingPayPal(true)
        const result = await paymentGateway.confirmPayPalPayment(paypalToken)

        if (result.status === 'completed') {
          const { data: refreshed } = await refetch()
          if (active && refreshed) {
            setOrder({
              ...refreshed.order,
              items: (refreshed.items || []).map((item) => ({
                ...item,
                price: item.unit_price ?? item.price ?? 0,
              })),
              payment_method: refreshed.payment?.payment_method || refreshed.order?.payment_method || null,
              payment_record_status: refreshed.payment?.status || null,
              payment_transaction_id: refreshed.payment?.transaction_id || null,
              buyer: refreshed.buyer || {},
              vendor: refreshed.vendor || {},
            })
          }
          if (active) {
            setPaypalMessage('تم تأكيد دفع PayPal بنجاح.')
          }
          toast.success('تم تأكيد دفع PayPal بنجاح.')
        } else if (active) {
          setPaypalMessage('تمت العودة من PayPal لكن حالة الدفع ما زالت قيد المعالجة.')
        }
      } catch (error) {
        logger.error('PayPal confirmation failed:', error)
        if (active) {
          setPaypalMessage(error.message || 'تعذر تأكيد دفع PayPal.')
        }
        toast.error(error.message || 'تعذر تأكيد دفع PayPal.')
      } finally {
        if (active) {
          setProcessingPayPal(false)
        }
      }
    }

    finalizePayPal()

    return () => {
      active = false
    }
  }, [refetch, order?.id, order?.payment_method, order?.payment_record_status, paypalAction, paypalToken])

  const restartPayPalCheckout = async () => {
    if (!order?.id) return

    try {
      setProcessingPayPal(true)
      const { data, error } = await supabase.functions.invoke('create-paypal-order', {
        body: {
          orderId: order.id,
          amount: Number(order.first_payment_amount || 0),
          currency: 'MAD',
          customer: {
            email: order?.buyer?.email || null,
            name: `${order?.buyer?.first_name || ''} ${order?.buyer?.last_name || ''}`.trim(),
          },
          returnUrl: `${window.location.origin}/order-confirmation/${order.id}?paypal=success`,
          cancelUrl: `${window.location.origin}/order-confirmation/${order.id}?paypal=cancel`,
        },
      })

      if (error) {
        throw error
      }

      if (!data?.orderId || !data?.approvalUrl) {
        throw new Error('تعذر إعادة تهيئة جلسة PayPal.')
      }

      const paymentRecord = await getLatestOrderPaymentRecord({
        orderId: order.id,
        paymentMethod: 'paypal',
        select: 'id',
        allowMissing: false,
      })

      if (!paymentRecord?.id) {
        throw new Error('تعذر العثور على سجل دفع PayPal لإعادة التهيئة.')
      }

      await updateOrderPaymentRecord({
        paymentId: paymentRecord.id,
        values: {
          transaction_id: data.orderId,
          gateway_response: data,
          status: 'pending',
        },
      })

      window.location.href = data.approvalUrl
    } catch (error) {
      logger.error('Failed to restart PayPal checkout:', error)
      toast.error(error.message || 'تعذر إعادة تهيئة PayPal.')
      setProcessingPayPal(false)
    }
  }

  if (loadingOrder || (!order && routeOrderId)) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="flex items-center justify-center gap-3 text-gray-500">
          <LoadingSpinner size="sm" />
          <p>{t('orderConfirmation.loading', 'Loading your order...')}</p>
        </div>
      </div>
    )
  }

  if (!order || errorState) {
    const errorCopy = {
      forbidden: {
        title: t('orderConfirmation.errors.forbiddenTitle', 'Unable to access this order'),
        description: t('orderConfirmation.errors.forbiddenDescription', 'This order does not exist or you do not have permission to view it.'),
      },
      load_failed: {
        title: t('orderConfirmation.errors.loadFailedTitle', 'Failed to load order confirmation'),
        description: t('orderConfirmation.errors.loadFailedDescription', 'We could not load your order details right now. Please try again from your orders page.'),
      },
      missing_order: {
        title: t('orderConfirmation.errors.missingOrderTitle', 'No order was selected'),
        description: t('orderConfirmation.errors.missingOrderDescription', 'Open this page from checkout or from your orders history.'),
      },
    }[errorState || 'missing_order']

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{errorCopy.title}</h1>
          <p className="text-gray-600 mb-6">{errorCopy.description}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => navigate('/buyer/orders')} className="btn-primary">
              {t('orderConfirmation.viewOrders', 'View My Orders')}
            </button>
            <button onClick={() => navigate('/marketplace')} className="btn-outline">
              {t('orderConfirmation.continueShopping', 'متابعة التسوق')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16" data-testid="order-confirmation-page">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="w-12 h-12 text-green-500" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('orderConfirmation.title', 'Order Confirmed!')}</h1>
        <p className="text-gray-600">
          {order ? `${t('orderConfirmation.orderPrefix', 'Order')} #${order.id?.slice(0, 8)}` : t('orderConfirmation.orderPlaced', 'Your order has been placed successfully')}
        </p>
      </div>

      {paypalMessage && (
        <div className={`mb-8 rounded-xl border px-4 py-4 text-sm leading-6 ${paypalAction === 'cancel' ? 'border-amber-200 bg-amber-50 text-amber-900' : paypalAction === 'success' ? 'border-green-200 bg-green-50 text-green-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
          {paypalMessage}
        </div>
      )}

      {order && (
        <div className="mb-8">
          <Receipt order={order} />
        </div>
      )}

      {order?.payment_method === 'bank' && (
        <div className="mb-8">
          <PaymentReceiptUpload
            order={order}
            stage="first"
            onUploadComplete={setOrder}
          />
        </div>
      )}

      {order?.payment_method === 'paypal' && (
        <div className="card p-6 mb-8 border border-blue-200 bg-blue-50">
          <h2 className="font-semibold text-blue-900 mb-2">الدفع عبر PayPal</h2>
          <p className="text-sm leading-6 text-blue-900">
            {order?.payment_record_status === 'completed'
              ? 'تم تأكيد عملية PayPal لهذا الطلب بنجاح.'
              : 'هذا الطلب ينتظر إكمال أو تأكيد عملية PayPal. يمكنك متابعة الدفع من الزر أدناه إذا لم تكتمل العملية.'}
          </p>
          {order?.payment_record_status !== 'completed' && (
            <button
              onClick={restartPayPalCheckout}
              className="btn-primary mt-4"
              disabled={processingPayPal}
            >
              {processingPayPal ? 'جاري تهيئة PayPal...' : 'إتمام الدفع عبر PayPal'}
            </button>
          )}
        </div>
      )}

      {order?.payment_type === 'cod' && (
        <div className="card p-6 mb-8 border border-amber-200 bg-amber-50">
          <h2 className="font-semibold text-amber-900 mb-2">سياسة الدفع عند الاستلام</h2>
          <p className="text-sm leading-6 text-amber-900">
            تم تسجيل هذا الطلب كدفع عند الاستلام. في حال ثبوت التسليم أو التنفيذ ورفض الدفع، قد يتم خفض درجة الثقة وفتح نزاع تحصيل وفق الشروط القانونية للمنصة.
          </p>
        </div>
      )}

      {/* Next Steps */}
      <div className="card p-6 mb-8">
        <h2 className="font-semibold text-gray-900 mb-4">{t('orderConfirmation.whatsNext', "What's Next?")}</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-green-600 text-sm font-semibold">1</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">{t('orderConfirmation.step1Title', 'Order Confirmation')}</p>
              <p className="text-sm text-gray-500">{t('orderConfirmation.step1Desc', "You'll receive an email confirmation shortly")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <ShoppingBagIcon className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{t('orderConfirmation.step2Title', 'Vendor Prepares Order')}</p>
              <p className="text-sm text-gray-500">{t('orderConfirmation.step2Desc', 'The vendor will prepare your items')}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <TruckIcon className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{t('orderConfirmation.step3Title', 'Delivery')}</p>
              <p className="text-sm text-gray-500">{t('orderConfirmation.step3Desc', 'A driver will deliver to your address')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button onClick={() => navigate('/buyer/orders')} className="btn-primary flex-1">
          {t('orderConfirmation.viewOrders', 'View My Orders')}
        </button>
        <button onClick={() => navigate('/marketplace')} className="btn-outline flex-1">
          {t('orderConfirmation.continueShopping', 'Continue Shopping')}
        </button>
      </div>
    </div>
  )
}

export default OrderConfirmation
