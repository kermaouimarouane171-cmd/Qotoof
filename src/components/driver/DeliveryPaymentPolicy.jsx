import { BanknotesIcon, BuildingLibraryIcon } from '@heroicons/react/24/outline'
import { Card } from '@/components/ui'

const DeliveryPaymentPolicy = ({
  driverDeliveryPaymentCash: _driverDeliveryPaymentCash,
  driverDeliveryPaymentTransfer: _driverDeliveryPaymentTransfer,
  driverDeliveryPaymentNotes,
  errors = {},
  onCashChange,
  onTransferChange,
  onNotesChange,
}) => {
  return (
    <Card className="p-6">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <BanknotesIcon className="w-5 h-5 text-gray-600" />
        سياسة تحصيل رسم التوصيل
      </h2>

      <div className="space-y-3">
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label htmlFor="payment-cash" className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 cursor-pointer">
          <input
            id="payment-cash"
            type="checkbox"
            onChange={(event) => onCashChange(event.target.checked)}
            className="mt-1 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <div>
            <p className="font-medium text-gray-900">نقداً عند التسليم</p>
            <p className="text-xs text-gray-500 mt-1 leading-6">يظهر هذا الخيار للمشتري عندما يكون سداد خدمة التوصيل مباشراً للسائق عند الاستلام النهائي.</p>
          </div>
        </label>

        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label htmlFor="payment-transfer" className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 cursor-pointer">
          <input
            id="payment-transfer"
            type="checkbox"
            onChange={(event) => onTransferChange(event.target.checked)}
            className="mt-1 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <div>
            <p className="font-medium text-gray-900 flex items-center gap-2">
              <BuildingLibraryIcon className="w-4 h-4 text-gray-500" />
              تحويل بنكي للسائق
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-6">يُستخدم عندما يختار المشتري تحويل رسم التوصيل بشكل منفصل عن قيمة المنتجات.</p>
          </div>
        </label>
      </div>

      {errors.driverDeliveryPaymentMethod && (
        <p className="text-xs text-red-600 mt-3">{errors.driverDeliveryPaymentMethod}</p>
      )}

      <div className="mt-5">
        <label htmlFor="driver-delivery-payment-notes" className="input-label">ملاحظات قانونية للمشتري</label>
        <textarea
          id="driver-delivery-payment-notes"
          value={driverDeliveryPaymentNotes}
          onChange={(event) => onNotesChange(event.target.value)}
          className="input h-24 resize-none"
          placeholder="مثال: التحويل البنكي يجب أن يتم قبل التسليم النهائي مع ذكر رقم الطلب"
        />
      </div>
    </Card>
  )
}

export default DeliveryPaymentPolicy