import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CheckCircleIcon, ShoppingBagIcon, TruckIcon } from '@heroicons/react/24/outline'
import { Receipt } from '@/components/ui'
import PaymentReceiptUpload from '@/components/orders/PaymentReceiptUpload'

const OrderConfirmation = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [order, setOrder] = useState(location.state?.order)

  useEffect(() => {
    setOrder(location.state?.order)
  }, [location.state])

  // Guard: redirect if no order data (direct access without completing checkout)
  useEffect(() => {
    if (!order) {
      // No order data — user navigated here directly without completing checkout
      navigate('/marketplace', { replace: true })
    }
  }, [order, navigate])

  // Show nothing while redirecting
  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-gray-500">{t('orderConfirmation.redirecting', 'Redirecting...')}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="w-12 h-12 text-green-500" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('orderConfirmation.title', 'Order Confirmed!')}</h1>
        <p className="text-gray-600">
          {order ? `${t('orderConfirmation.orderPrefix', 'Order')} #${order.id?.slice(0, 8)}` : t('orderConfirmation.orderPlaced', 'Your order has been placed successfully')}
        </p>
      </div>

      {order && (
        <div className="mb-8">
          <Receipt order={order} />
        </div>
      )}

      {order?.payment_type && order.payment_type !== 'cod' && (
        <div className="mb-8">
          <PaymentReceiptUpload
            order={order}
            stage="first"
            onUploadComplete={setOrder}
          />
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
        <button onClick={() => navigate('/orders')} className="btn-primary flex-1">
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
