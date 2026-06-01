import { Card, Input, LocationPicker } from '@/components/ui'
import { TruckIcon } from '@heroicons/react/24/outline'
import { formatPrice } from '@/utils/currency'

const CheckoutAddressStep = ({
  shippingInfo,
  setShippingInfo,
  deliveryLocation,
  setDeliveryLocation,
  errors,
  setErrors,
  vendorMinimumStatus,
  stepOneBlockingMessage,
  onContinue,
}) => {
  return (
    <Card className="p-6 checkout-address-step" data-testid="checkout-step-shipping">
      <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <TruckIcon className="w-5 h-5" />
        Shipping Information
      </h2>
      {vendorMinimumStatus.hasViolations && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">بعض المتاجر في السلة لم تصل إلى الحد الأدنى للطلب.</p>
          <div className="mt-2 space-y-2 text-xs text-amber-800">
            {vendorMinimumStatus.violations.map((vendor) => (
              <p key={vendor.vendorId}>
                {vendor.vendorName}: الحد الأدنى {formatPrice(vendor.minOrderAmount)} والمتبقي {formatPrice(vendor.shortfall)}.
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Input
            label="Full Name *"
            value={shippingInfo.fullName}
            onChange={(e) => {
              setShippingInfo({ ...shippingInfo, fullName: e.target.value })
              setErrors({ ...errors, fullName: null })
            }}
            placeholder="Your full name"
            data-testid="checkout-full-name-input"
          />
          {errors.fullName && <p className="text-red-500 text-xs mt-1" data-testid="checkout-full-name-error">{errors.fullName}</p>}
        </div>
        <div>
          <Input
            label="Phone *"
            type="tel"
            value={shippingInfo.phone}
            onChange={(e) => {
              setShippingInfo({ ...shippingInfo, phone: e.target.value })
              setErrors({ ...errors, phone: null })
            }}
            placeholder="+212 6XX XXX XXX"
            data-testid="checkout-phone-input"
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1" data-testid="checkout-phone-error">{errors.phone}</p>}
        </div>
        <div>
          <Input
            label="City *"
            value={shippingInfo.city}
            onChange={(e) => {
              setShippingInfo({ ...shippingInfo, city: e.target.value })
              setErrors({ ...errors, city: null })
            }}
            placeholder="Casablanca"
            data-testid="checkout-city-input"
          />
          {errors.city && <p className="text-red-500 text-xs mt-1" data-testid="checkout-city-error">{errors.city}</p>}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="checkout-address" className="input-label">Address *</label>
          <textarea
            id="checkout-address"
            value={shippingInfo.address}
            onChange={(e) => {
              setShippingInfo({ ...shippingInfo, address: e.target.value })
              setErrors({ ...errors, address: null })
            }}
            data-testid="checkout-address-input"
            className={`input h-20 resize-none ${errors.address ? 'border-red-500' : ''}`}
            placeholder="الشارع، المبنى، الشقة..."
          />
          {errors.address && <p className="text-red-500 text-xs mt-1" data-testid="checkout-address-error">{errors.address}</p>}
        </div>

        <div className="sm:col-span-2">
          <LocationPicker
            value={deliveryLocation}
            onChange={(loc) => {
              setDeliveryLocation(loc)
              setErrors({ ...errors, location: null })
            }}
            city={shippingInfo.city}
            required
          />
          {errors.location && (
            <p className="text-red-500 text-xs mt-2 flex items-center gap-1" data-testid="checkout-location-error">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {errors.location}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="checkout-notes" className="input-label">Notes (optional)</label>
          <textarea
            id="checkout-notes"
            value={shippingInfo.notes}
            onChange={(e) => setShippingInfo({ ...shippingInfo, notes: e.target.value })}
            data-testid="checkout-notes-input"
            className="input h-16 resize-none"
            placeholder="Delivery instructions, apartment number, etc."
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="btn-primary w-full mt-6"
        disabled={vendorMinimumStatus.hasViolations}
        data-testid="checkout-continue-to-delivery"
      >
        Continue to Delivery Selection
      </button>
      {(errors.minimumOrder || stepOneBlockingMessage) && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" data-testid="checkout-minimum-order-blocker">
          <p className="text-xs font-medium text-amber-900">لا يمكنك متابعة الطلب الآن.</p>
          <p className="mt-1 text-xs leading-6 text-amber-800" data-testid="checkout-minimum-order-error">
            {errors.minimumOrder || stepOneBlockingMessage}
          </p>
        </div>
      )}
    </Card>
  )
}

export default CheckoutAddressStep
