import { CheckCircleIcon } from '@heroicons/react/24/outline'
import PaymentReceiptUpload from '@/components/orders/PaymentReceiptUpload'

export default function OrderPaymentSection({ payment, order, onRetry, t }) {
  const {
    canBuyerUploadFirstReceipt,
    canBuyerUploadSecondReceipt,
    canVendorConfirmPayment,
    paymentConfirmationMode,
    submitting,
    onOrderPatch,
  } = payment

  return (
    <>
      {(canBuyerUploadFirstReceipt || canBuyerUploadSecondReceipt) && (
        <div className="mb-4 space-y-4">
          {canBuyerUploadFirstReceipt && (
            <PaymentReceiptUpload
              order={order}
              stage="first"
              onUploadComplete={onOrderPatch}
            />
          )}

          {canBuyerUploadSecondReceipt && (
            <PaymentReceiptUpload
              order={order}
              stage="second"
              onUploadComplete={onOrderPatch}
            />
          )}
        </div>
      )}

      {canVendorConfirmPayment && (
        <button
          onClick={onRetry}
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
    </>
  )
}