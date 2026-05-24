import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'

const VENDOR_STATUS_OPTIONS = [
  { value: 'vendor_accepted', label: 'قبول الطلب' },
  { value: 'vendor_rejected', label: 'رفض الطلب' },
]

const DRIVER_STATUS_OPTIONS = [
  { value: 'driver_accepted', label: 'قبول التوصيل' },
  { value: 'driver_picked_up', label: 'تم استلام الطلب' },
  { value: 'on_the_way', label: 'في الطريق' },
  { value: 'delivered', label: 'تم التسليم' },
]

export default function OrderActionsPanel({ order, userRole, onStatusChange, onCancelOrder, isPending, t }) {
  const showVendorControls = userRole === 'vendor' && order?.status === 'pending'
  const showDriverControls = userRole === 'driver' && Boolean(order?.delivery)
  const showCancel = userRole === 'buyer'
  const cancelDisabled = isPending || !onCancelOrder

  return (
    <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {showVendorControls && (
        <>
          <button
            type="button"
            onClick={() => onStatusChange('vendor_accepted')}
            disabled={isPending}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl hover:from-emerald-100 hover:to-green-100 transition-all group min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">{t('orderDetail.actions.acceptOrder', 'Accept Order')}</p>
              <p className="text-xs text-gray-500">{t('orderDetail.actions.acceptOrderDesc', 'Confirm and start processing')}</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onStatusChange('vendor_rejected')}
            disabled={isPending}
            className="flex items-center gap-3 p-4 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl hover:from-red-100 hover:to-rose-100 transition-all group min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <XMarkIcon className="w-5 h-5 text-red-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-sm">{t('orderDetail.actions.rejectOrder', 'Reject Order')}</p>
              <p className="text-xs text-gray-500">{t('orderDetail.actions.rejectOrderDesc', 'Decline this order')}</p>
            </div>
          </button>
        </>
      )}

      {(showVendorControls || showDriverControls) && (
        <label className="sm:col-span-2 flex flex-col gap-2 text-sm text-gray-700">
          <span className="font-medium">{t('orderDetail.actions.changeStatus', 'Change Status')}</span>
          <select
            className="input"
            defaultValue=""
            onChange={(event) => {
              const value = event.target.value
              if (!value) return
              onStatusChange(value)
              event.target.value = ''
            }}
            disabled={isPending}
          >
            <option value="">{t('orderDetail.actions.selectStatus', 'Select status')}</option>
            {(userRole === 'vendor' ? VENDOR_STATUS_OPTIONS : DRIVER_STATUS_OPTIONS).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      )}

      {showCancel && (
        <button
          type="button"
          onClick={onCancelOrder || undefined}
          disabled={cancelDisabled}
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
              {t('orderDetail.actions.cancelOrderDesc', 'Cancel this order')}
            </p>
          </div>
        </button>
      )}
    </div>
  )
}