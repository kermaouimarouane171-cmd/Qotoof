import { CheckIcon, ClockIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'
import { Card, LoadingSpinner } from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import {
  getCargoSizeLabel,
  getDriverDeliveryPaymentMethodLabel,
} from '@/services/deliveryMatchingService'

const OrderSummary = ({
  items,
  vendorMinimumStatus,
  subtotal,
  bulkDiscount,
  couponDiscount,
  shippingCost,
  shippingLoading,
  estimatedDeliveryTime,
  shippingInfoData,
  platformFee,
  platformCommissionRate,
  productPaymentTotal,
  grandTotal,
  cargoSize,
  driverDeliveryPaymentMethod,
  selectedDeliverySlot,
  requestedDeliveryDate,
  couponCode,
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  couponLoading,
  appliedCoupon,
  showDriverDeliveryPayment = true,
}) => {
  const { t } = useTranslation()
  const shippingUnavailable = shippingInfoData?.available === false

  return (
    <Card className="p-6 sticky top-24">
      <h2 className="font-semibold text-gray-900 mb-4">{t('checkout.orderSummary', 'Order Summary')}</h2>

      <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            {item.image || item.image_url ? (
              <img src={item.image || item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                <span className="text-lg">🌱</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <p className="text-xs text-gray-500">{t('checkout.quantityLabel', 'Quantity')}: {item.quantity}</p>
            </div>
            <span className="text-sm font-semibold">{formatPrice((item.price_per_unit || item.price) * item.quantity)}</span>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 space-y-3">
        {vendorMinimumStatus.hasViolations && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-2">
            {vendorMinimumStatus.violations.map((vendor) => (
              <div key={vendor.vendorId}>
                <p className="font-semibold">{vendor.vendorName}</p>
                <p>{t('checkout.minimumOrderNotice', 'Minimum {{minimum}} and {{remaining}} remaining', {
                  minimum: formatPrice(vendor.minOrderAmount),
                  remaining: formatPrice(vendor.shortfall),
                })}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t('checkout.productsValue', 'Products value')}</span>
          <span>{formatPrice(subtotal)}</span>
        </div>

        {bulkDiscount > 0 && (
          <div className="flex justify-between text-sm text-emerald-700">
            <span>{t('checkout.bulkDiscounts', 'Bulk discounts')}</span>
            <span>- {formatPrice(bulkDiscount)}</span>
          </div>
        )}

        {couponDiscount > 0 && (
          <div className="flex justify-between text-sm text-emerald-700">
            <span>{t('checkout.couponDiscount', 'Coupon discount')}</span>
            <span>- {formatPrice(couponDiscount)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t('checkout.platformCommission', 'Platform commission ({{rate}}%)', { rate: platformCommissionRate })}</span>
          <span>{formatPrice(platformFee)}</span>
        </div>

        <div className="flex justify-between text-sm font-medium text-gray-900">
          <span>{t('checkout.productPaymentTotal', 'Product payment total')}</span>
          <span>{formatPrice(productPaymentTotal)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">
            {t('checkout.deliveryFee', 'Delivery fee')}
            {shippingLoading && <LoadingSpinner size="sm" className="ml-2 inline-block" />}
          </span>
          {shippingLoading ? (
            <span className="text-gray-400">{t('checkout.calculating', 'Calculating...')}</span>
          ) : shippingUnavailable ? (
            <span className="text-red-600">{t('checkout.unavailable', 'Unavailable')}</span>
          ) : shippingInfoData ? (
            shippingCost > 0 ? (
              <span>{formatPrice(shippingCost)}</span>
            ) : (
              <span className="text-green-600">{t('checkout.free', 'Free')}</span>
            )
          ) : (
            <span className="text-gray-400">{t('checkout.afterAddressSelection', 'After selecting your address')}</span>
          )}
        </div>

        {shippingUnavailable && shippingInfoData?.blockingReason && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 leading-6">
            {shippingInfoData.blockingReason}
          </div>
        )}

        {estimatedDeliveryTime && !shippingUnavailable && (
          <div className="flex justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              {t('checkout.estimatedTime', 'Estimated time')}
            </span>
            <span>{estimatedDeliveryTime}</span>
          </div>
        )}

        {selectedDeliverySlot && (
          <div className="flex justify-between text-xs text-gray-500 gap-4">
            <span>{t('checkout.scheduledSlot', 'Scheduled slot')}</span>
            <span className="text-right">{requestedDeliveryDate} • {selectedDeliverySlot.slot_label}</span>
          </div>
        )}

        {shippingInfoData?.distance && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>{t('checkout.distance', 'Distance')}</span>
            <span>{shippingInfoData.distance.toFixed(1)} كم</span>
          </div>
        )}

        <div className="flex justify-between text-xs text-gray-500">
          <span>{t('checkout.cargoSize', 'Cargo size')}</span>
          <span>{getCargoSizeLabel(cargoSize)}</span>
        </div>

        {showDriverDeliveryPayment && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>{t('checkout.deliveryCollection', 'Delivery collection')}</span>
            <span>{getDriverDeliveryPaymentMethodLabel(driverDeliveryPaymentMethod)}</span>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 leading-6">
          {t('checkout.platformNote', 'Agricultural products listed here are exempt from VAT. The platform commission appears as a separate line, and delivery is paid separately from product value.')}
        </div>

        <div className="flex justify-between text-base font-semibold text-gray-900 border-t pt-3">
          <span>{t('checkout.finalTotal', 'Final total')}</span>
          {shippingUnavailable ? (
            <span className="text-red-600 text-sm">{t('checkout.needsCloserAddress', 'Requires a closer address')}</span>
          ) : (
            <span>{formatPrice(grandTotal)}</span>
          )}
        </div>

        <div className="border-t pt-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <TagIcon className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={couponCode}
                onChange={(event) => onCouponCodeChange(event.target.value.toUpperCase())}
                placeholder={t('checkout.couponCode', 'Coupon code')}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg uppercase font-mono focus:ring-2 focus:ring-green-500 focus:border-green-500"
                disabled={couponLoading || !!appliedCoupon}
              />
            </div>
            {appliedCoupon ? (
              <button
                type="button"
                onClick={onRemoveCoupon}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                aria-label={t('checkout.removeCoupon', 'Remove coupon')}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onApplyCoupon}
                disabled={couponLoading || !couponCode}
                className="px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {couponLoading ? <LoadingSpinner size="sm" /> : t('checkout.applyCoupon', 'Apply')}
              </button>
            )}
          </div>

          {appliedCoupon && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg">
              <CheckIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-medium">{appliedCoupon.code}</span>
              <span>{t('checkout.couponApplied', 'Applied to this cart')}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export default OrderSummary