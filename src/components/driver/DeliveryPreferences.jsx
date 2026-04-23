import { TruckIcon } from '@heroicons/react/24/outline'
import { Card, Input } from '@/components/ui'
import { CARGO_SIZE_OPTIONS, getCargoSizeLabel } from '@/services/deliveryMatchingService'

const DeliveryPreferences = ({
  minDeliveryDistanceKm,
  maxDeliveryDistanceKm,
  acceptedCargoSizes,
  errors = {},
  onMinDistanceChange,
  onMaxDistanceChange,
  onCargoSizeToggle,
}) => {
  return (
    <Card className="p-6">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <TruckIcon className="w-5 h-5 text-gray-600" />
        تفضيلات التوصيل القانونية
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="أدنى مسافة أقبلها (كم)"
          type="number"
          min="0"
          step="1"
          value={minDeliveryDistanceKm}
          onChange={(event) => onMinDistanceChange(event.target.value)}
          error={errors.minDeliveryDistanceKm}
          placeholder="0"
        />

        <Input
          label="أقصى مسافة أقبلها (كم)"
          type="number"
          min="1"
          step="1"
          value={maxDeliveryDistanceKm}
          onChange={(event) => onMaxDistanceChange(event.target.value)}
          error={errors.maxDeliveryDistanceKm}
          placeholder="50"
        />
      </div>

      <div className="mt-5">
        <p className="input-label">أحجام الحمولة المقبولة</p>
        <div className="flex flex-wrap gap-3 mt-3">
          {CARGO_SIZE_OPTIONS.map((option) => {
            const selected = acceptedCargoSizes.includes(option.value)

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onCargoSizeToggle(option.value)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${selected ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                {getCargoSizeLabel(option.value)}
              </button>
            )
          })}
        </div>
        {errors.acceptedCargoSizes && (
          <p className="text-xs text-red-600 mt-2">{errors.acceptedCargoSizes}</p>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600 leading-6">
        الطلبات خارج هذا النطاق أو خارج أحجام الحمولة المختارة لن تظهر لك ضمن صفحة الطلبات المتاحة، وسيُستخدم هذا الضبط أيضاً عند اختيارك يدوياً في صفحة الدفع.
      </div>
    </Card>
  )
}

export default DeliveryPreferences