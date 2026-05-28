import { Card } from '@/components/ui'
import PaymentTypeSelector from '@/components/checkout/PaymentTypeSelector'
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'

export default function PaymentStep({ paymentMethod, onMethodSelect, totalAmount, paypalConfig, t }) {
  void t

  const shouldShowInlinePayPal = Boolean(
    paypalConfig?.paypalInline?.enabled
    && paypalConfig?.paypalInline?.clientId
    && paymentMethod === 'paypal'
    && paypalConfig?.paymentType !== 'cod'
  )

  return (
    <Card className="p-6" data-testid="checkout-step-payment">
      <PaymentTypeSelector
        vendorPolicies={paypalConfig?.vendorPolicies || []}
        codEligibility={paypalConfig?.codEligibility}
        availablePaymentTypes={paypalConfig?.availablePaymentTypes}
        paymentType={paypalConfig?.paymentType}
        onPaymentTypeChange={paypalConfig?.onPaymentTypeChange}
        selectedPaymentMethod={paymentMethod}
        onPaymentMethodChange={onMethodSelect}
        paypalEnabled={paypalConfig?.paypalEnabled}
        paypalUnavailableReason={paypalConfig?.paypalUnavailableReason}
        selectedBank={paypalConfig?.selectedBank}
        onBankChange={paypalConfig?.onBankChange}
        termsAccepted={paypalConfig?.termsAccepted}
        onTermsAcceptedChange={paypalConfig?.onTermsAcceptedChange}
        totalAmount={totalAmount}
        errors={paypalConfig?.errors}
        disabled={paypalConfig?.disabled}
      />

      {paypalConfig?.notice && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="checkout-payment-method-notice">
          {paypalConfig.notice}
        </div>
      )}

      {paypalConfig?.summary}

      {shouldShowInlinePayPal && (
        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4" data-testid="checkout-paypal-inline">
          <p className="mb-3 text-sm font-medium text-blue-900">أكمل الدفع الآن عبر PayPal</p>
          <PayPalScriptProvider
            options={{
              clientId: paypalConfig.paypalInline.clientId,
              currency: 'MAD',
              intent: 'capture',
            }}
          >
            <PayPalButtons
              style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' }}
              createOrder={paypalConfig.paypalInline.createOrder}
              onApprove={paypalConfig.paypalInline.onApprove}
              onCancel={paypalConfig.paypalInline.onCancel}
              onError={paypalConfig.paypalInline.onError}
              forceReRender={[paypalConfig.paypalInline.forceRenderKey || 'paypal-inline']}
              disabled={paypalConfig.paypalInline.disabled}
            />
          </PayPalScriptProvider>
          <p className="mt-2 text-xs text-blue-700">
            بعد نجاح الدفع سيتم تحويلك تلقائياً إلى صفحة تأكيد الطلب.
          </p>
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button type="button" onClick={paypalConfig?.onBack} className="btn-outline flex-1">
          Back
        </button>
        <button type="button" onClick={paypalConfig?.onPlaceOrder} className="btn-primary flex-1" disabled={paypalConfig?.submitDisabled} data-testid="checkout-submit" data-cy="place-order-button">
          {paypalConfig?.submitLabel}
        </button>
      </div>

      {paypalConfig?.blockers?.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" data-testid="checkout-submit-blockers">
          <p className="text-xs font-medium text-amber-900">ما الذي يمنع تأكيد الطلب الآن؟</p>
          <ul className="mt-2 space-y-1 text-xs leading-6 text-amber-800">
            {paypalConfig.blockers.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </div>
      )}

      {paypalConfig?.shippingError && <p className="text-red-500 text-xs mt-2" data-testid="checkout-shipping-error">{paypalConfig.shippingError}</p>}
    </Card>
  )
}