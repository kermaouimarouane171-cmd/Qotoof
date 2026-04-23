import { TruckIcon, CheckCircleIcon, StarIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import {
  getCargoSizeLabel,
  getDriverDeliveryPaymentMethodLabel,
  normalizeDriverPreferences,
} from '@/services/deliveryMatchingService'

const DriverSelection = ({ drivers = [], selectedDriver, onChange, cargoSize, deliveryPaymentMethod }) => {
  if (drivers.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <TruckIcon className="w-5 h-5" />
        اختر سائقاً مناسباً ({drivers.length} متاح)
      </h3>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {drivers.map((driver) => (
          <label
            key={driver.id}
            className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
              selectedDriver === driver.id
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="driver"
              value={driver.id}
              checked={selectedDriver === driver.id}
              onChange={() => onChange(driver.id)}
              className="text-green-500"
            />
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-green-600 font-semibold text-sm">
                {driver.first_name?.[0]}{driver.last_name?.[0]}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">
                {driver.first_name} {driver.last_name}
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    i < Math.round(Number(driver.rating || 4)) ? (
                      <StarIconSolid key={i} className="w-3.5 h-3.5 text-yellow-400" />
                    ) : (
                      <StarIcon key={i} className="w-3.5 h-3.5 text-gray-300" />
                    )
                  ))}
                </div>
                <span>{Number(driver.rating || 4).toFixed(1)}</span>
                {driver.vehicle_type && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{driver.vehicle_type}</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-2 text-xs">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                  مسار الطلب {driver.route_distance_km != null ? `${driver.route_distance_km.toFixed(1)} كم` : 'غير متاح'}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                  من المتجر {driver.pickup_distance_km != null ? `${driver.pickup_distance_km.toFixed(1)} كم` : 'غير متاح'}
                </span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                  {getCargoSizeLabel(cargoSize)}
                </span>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">
                  {getDriverDeliveryPaymentMethodLabel(deliveryPaymentMethod)}
                </span>
              </div>
              <div className="mt-2 text-xs text-gray-500 leading-5">
                يقبل: {normalizeDriverPreferences(driver).acceptedCargoSizes.map((size) => getCargoSizeLabel(size)).join('، ')}
              </div>
              {driver.driver_delivery_payment_notes && (
                <p className="mt-2 text-xs text-amber-700 leading-5">{driver.driver_delivery_payment_notes}</p>
              )}
            </div>
            <div className="text-right">
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <CheckCircleIcon className="w-4 h-4" />
                مطابق
              </span>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

export default DriverSelection
