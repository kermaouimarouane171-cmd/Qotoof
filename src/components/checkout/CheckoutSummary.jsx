import OrderSummary from '@/components/checkout/OrderSummary'

export default function CheckoutSummary({ cartItems, pricing, couponCode, onPlaceOrder, isPending, t }) {
  void t

  return (
    <div className="space-y-3">
      <OrderSummary
        items={cartItems}
        vendorMinimumStatus={pricing?.vendorMinimumStatus}
        subtotal={pricing?.subtotal}
        bulkDiscount={pricing?.bulkDiscount}
        couponDiscount={pricing?.couponDiscount}
        shippingCost={pricing?.shippingCost}
        shippingLoading={pricing?.shippingLoading}
        estimatedDeliveryTime={pricing?.estimatedDeliveryTime}
        shippingInfoData={pricing?.shippingInfoData}
        platformFee={pricing?.platformFee}
        platformCommissionRate={pricing?.platformCommissionRate}
        productPaymentTotal={pricing?.productPaymentTotal}
        grandTotal={pricing?.grandTotal}
        cargoSize={pricing?.cargoSize}
        driverDeliveryPaymentMethod={pricing?.driverDeliveryPaymentMethod}
        selectedDeliverySlot={pricing?.selectedDeliverySlot}
        requestedDeliveryDate={pricing?.requestedDeliveryDate}
        couponCode={couponCode}
        onCouponCodeChange={pricing?.onCouponCodeChange}
        onApplyCoupon={pricing?.onApplyCoupon}
        onRemoveCoupon={pricing?.onRemoveCoupon}
        couponLoading={pricing?.couponLoading}
        appliedCoupon={pricing?.appliedCoupon}
        showDriverDeliveryPayment={pricing?.showDriverDeliveryPayment}
      />

      {onPlaceOrder && (
        <button
          type="button"
          onClick={onPlaceOrder}
          disabled={isPending}
          className="w-full btn-primary disabled:opacity-60"
          data-testid="checkout-summary-place-order"
        >
          {pricing?.placeOrderLabel || 'Place Order'}
        </button>
      )}
    </div>
  )
}