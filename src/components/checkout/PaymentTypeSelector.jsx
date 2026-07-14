import { useMemo } from 'react'
import {
  BanknotesIcon,
  BuildingLibraryIcon,
  CheckCircleIcon,
  CreditCardIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  TruckIcon,
} from '@heroicons/react/24/outline'
import { formatPrice } from '@/utils/currency'
import { getPayPalSettlementCurrency, getStripePublishableKey } from '@/lib/config'

const BANK_OPTIONS = [
  { name: 'Attijariwafa Bank', color: '#F37021' },
  { name: 'BMCE Bank of Africa', color: '#0066B3' },
  { name: 'Banque Populaire', color: '#E30613' },
  { name: 'CIH Bank', color: '#6B2D8B' },
  { name: 'Crédit du Maroc', color: '#009639' },
  { name: 'Société Générale', color: '#E2001A' },
  { name: 'Al Barid Bank', color: '#FFD100' },
  { name: 'CFG Bank', color: '#003366' },
  { name: 'Umnia Bank', color: '#8B0000' },
  { name: 'Bank Assafa', color: '#00A651' },
  { name: 'Dar Al Amane', color: '#0057B8' },
  { name: 'CDG Capital', color: '#005EB8' },
]

const OPTION_CONFIG = {
  full: {
    title: 'Full Payment',
    subtitle: '100% before preparation starts',
    description: 'يبدأ تنفيذ الطلب فقط بعد رفع إيصال التحويل ومراجعته من البائع.',
    icon: BanknotesIcon,
    accent: 'border-emerald-200 bg-emerald-50',
    iconAccent: 'bg-emerald-100 text-emerald-700',
  },
  split: {
    title: 'Split Payment',
    subtitle: '50% now and 50% later',
    description: 'دفعة أولى لتأكيد الطلب، ودفعة ثانية بعد التوصيل أو قبل الإقفال النهائي للطلب.',
    icon: ShieldCheckIcon,
    accent: 'border-amber-200 bg-amber-50',
    iconAccent: 'bg-amber-100 text-amber-700',
  },
  cod: {
    title: 'Cash on Delivery',
    subtitle: 'Pay on verified delivery',
    description: 'يظهر فقط إذا كان كل البائعين في السلة يسمحون به وكانت أهلية المشتري تسمح بذلك.',
    icon: TruckIcon,
    accent: 'border-rose-200 bg-rose-50',
    iconAccent: 'bg-rose-100 text-rose-700',
  },
}

const termsCopyByType = {
  full: 'أوافق على سداد كامل قيمة الطلب مقدماً، وأفهم أن الطلب لن يدخل التنفيذ إلا بعد رفع إيصال الدفع والتحقق منه.',
  split: 'أوافق على نظام الدفع المرحلي، وألتزم بسداد 50% أولاً و50% لاحقاً عند الاستحقاق حسب حالة الطلب.',
  cod: 'أقر بأن رفض الدفع بعد ثبوت التنفيذ أو التسليم قد يؤدي إلى خفض درجة الثقة وفتح نزاع تحصيل وفق سياسة المنصة.',
}

const warningCopyByType = {
  full: {
    title: 'تنبيه الدفع الكامل',
    body: 'إيصال التحويل يصبح جزءاً من سجل الطلب ويُستخدم لإثبات بدء التنفيذ واعتماد الطلب من البائع.',
  },
  split: {
    title: 'تنبيه الدفع المرحلي',
    body: 'الدفعة الثانية تبقى مستحقة ولا يمكن إغلاق الطلب نهائياً قبل تسويتها أو التحقق من النزاع إن وجد.',
  },
  cod: {
    title: 'تنبيه الدفع عند الاستلام',
    body: 'هذا الخيار مقيد بدرجة الثقة، وبيانات الطلب قد تُستخدم قانونياً في حالات رفض الدفع أو التحصيل.',
  },
}

const PaymentTypeSelector = ({
  vendorPolicies = [],
  codEligibility,
  availablePaymentTypes,
  paymentType,
  onPaymentTypeChange,
  selectedPaymentMethod,
  onPaymentMethodChange,
  paypalEnabled = false,
  paypalUnavailableReason = '',
  selectedBank,
  onBankChange,
  termsAccepted,
  onTermsAcceptedChange,
  totalAmount,
  errors = {},
  disabled = false,
}) => {
  const selectedWarning = warningCopyByType[paymentType] || warningCopyByType.full
  const paypalSettlementCurrency = getPayPalSettlementCurrency()
  const stripePublishableKey = getStripePublishableKey()
  const stripeEnabled = Boolean(stripePublishableKey)

  const paymentBreakdown = useMemo(() => {
    const total = Number(totalAmount || 0)

    if (paymentType === 'split') {
      const firstPayment = Number((total / 2).toFixed(2))
      const secondPayment = Number((total - firstPayment).toFixed(2))

      return {
        now: firstPayment,
        later: secondPayment,
      }
    }

    if (paymentType === 'cod') {
      return {
        now: 0,
        later: total,
      }
    }

    return {
      now: total,
      later: 0,
    }
  }, [paymentType, totalAmount])

  const disabledReason = (type) => {
    if (type === 'cod' && availablePaymentTypes?.vendorCodSupported && availablePaymentTypes?.codBlockedByTrust) {
      return codEligibility?.reason || 'الدفع عند الاستلام غير متاح لهذا الحساب حالياً.'
    }

    return 'غير متاح لكل المتاجر الموجودة في السلة الحالية.'
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-gray-900 mb-2">Payment Policy</h2>
        <p className="text-sm text-gray-500 leading-6">
          اختر طريقة دفع مدعومة من جميع المتاجر الموجودة في السلة، ثم وافق على الشروط القانونية قبل تأكيد الطلب.
        </p>
      </div>

      {vendorPolicies.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <BuildingLibraryIcon className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
            <div className="space-y-3 w-full">
              <div>
                <p className="text-sm font-semibold text-gray-900">سياسات البائعين في السلة</p>
                <p className="text-xs text-gray-500 mt-1">تم إظهار فقط الخيارات المشتركة بين جميع المتاجر.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {vendorPolicies.map((vendor) => (
                  <div key={vendor.id} className="rounded-xl border border-gray-200 bg-white px-3 py-3">
                    <p className="font-medium text-sm text-gray-900">{vendor.storeName}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className={`rounded-full px-2.5 py-1 ${vendor.full ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                        Full
                      </span>
                      <span className={`rounded-full px-2.5 py-1 ${vendor.split ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                        Split
                      </span>
                      <span className={`rounded-full px-2.5 py-1 ${vendor.cod ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-500'}`}>
                        COD
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Object.entries(OPTION_CONFIG).map(([type, config]) => {
          const Icon = config.icon
          const isSelected = paymentType === type
          const isAvailable = Boolean(availablePaymentTypes?.[type])

          return (
            <button
              key={type}
              type="button"
              onClick={() => isAvailable && onPaymentTypeChange(type)}
              disabled={!isAvailable || disabled}
              data-testid={`payment-type-${type}`}
              data-cy={`payment-method-type-${type}`}
              className={`rounded-2xl border p-4 text-left transition-all ${config.accent} ${isSelected ? 'ring-2 ring-offset-2 ring-green-400' : ''} ${isAvailable ? 'hover:shadow-sm' : 'opacity-70 cursor-not-allowed'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${config.iconAccent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                {isSelected && <CheckCircleIcon className="h-5 w-5 text-green-600" />}
              </div>

              <div className="mt-4 space-y-1">
                <p className="font-semibold text-gray-900">{config.title}</p>
                <p className="text-sm font-medium text-gray-600">{config.subtitle}</p>
                <p className="text-sm text-gray-600 leading-6">{config.description}</p>
              </div>

              <div className="mt-4 rounded-xl bg-white/80 px-3 py-3 text-sm text-gray-700">
                {type === 'split' ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span>الدفعة الأولى</span>
                      <span className="font-semibold">{formatPrice(Number((totalAmount / 2).toFixed(2)))}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span>الدفعة الثانية</span>
                      <span className="font-semibold">{formatPrice(Number((totalAmount - Number((totalAmount / 2).toFixed(2))).toFixed(2)))}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <span>{type === 'cod' ? 'المبلغ عند التسليم' : 'المبلغ المطلوب الآن'}</span>
                    <span className="font-semibold">{formatPrice(type === 'cod' ? totalAmount : totalAmount)}</span>
                  </div>
                )}
              </div>

              {!isAvailable && (
                <p className="mt-3 text-xs leading-5 text-red-700">{disabledReason(type)}</p>
              )}
            </button>
          )
        })}
      </div>

      {errors.paymentType && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.paymentType}
        </div>
      )}

      {paymentType !== 'cod' && (
        <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
          <div>
            <h3 className="font-semibold text-blue-900 flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5" />
              وسيلة دفع المبلغ الآن
            </h3>
            <p className="mt-1 text-sm text-blue-800">يمكنك الدفع بالبطاقة البنكية (Stripe) أو PayPal أو التحويل البنكي حسب المتاح.</p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {stripeEnabled && (
              <button
                type="button"
                onClick={() => onPaymentMethodChange('stripe')}
                disabled={disabled}
                data-testid="payment-method-stripe"
                data-cy="payment-method-stripe"
                className={`rounded-xl border px-3 py-3 text-left transition-colors ${selectedPaymentMethod === 'stripe' ? 'border-indigo-500 bg-white text-indigo-900' : 'border-indigo-100 bg-white/80 text-gray-700'} ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-indigo-300'}`}
              >
                <p className="text-sm font-semibold">بطاقة بنكية (Stripe)</p>
                <p className="text-xs mt-1">دفع آمن بالبطاقة البنكية المغربية — درهم (MAD)</p>
              </button>
            )}

            <button
              type="button"
              onClick={() => onPaymentMethodChange('paypal')}
              disabled={!paypalEnabled || disabled}
              data-testid="payment-method-paypal"
              data-cy="payment-method-paypal"
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${selectedPaymentMethod === 'paypal' ? 'border-blue-500 bg-white text-blue-900' : 'border-blue-100 bg-white/80 text-gray-700'} ${(!paypalEnabled || disabled) ? 'opacity-60 cursor-not-allowed' : 'hover:border-blue-300'}`}
            >
              <p className="text-sm font-semibold">PayPal</p>
              <p className="text-xs mt-1">دفع آمن عبر صفحة PayPal الرسمية بعملة {paypalSettlementCurrency}</p>
            </button>

            <button
              type="button"
              onClick={() => onPaymentMethodChange('bank')}
              disabled={disabled}
              data-testid="payment-method-bank"
              data-cy="payment-method-bank"
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${selectedPaymentMethod === 'bank' ? 'border-blue-500 bg-white text-blue-900' : 'border-blue-100 bg-white/80 text-gray-700'} ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-blue-300'}`}
            >
              <p className="text-sm font-semibold">تحويل بنكي</p>
              <p className="text-xs mt-1">رفع إيصال التحويل بعد إنشاء الطلب</p>
            </button>
          </div>

          {!paypalEnabled && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {paypalUnavailableReason || 'PayPal غير متاح حالياً لهذا الطلب.'}
            </div>
          )}

          {errors.paymentMethod && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errors.paymentMethod}
            </div>
          )}

          {selectedPaymentMethod === 'bank' && (
            <>
              <div>
                <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                  <BuildingLibraryIcon className="h-5 w-5" />
                  اختر بنك التحويل
                </h3>
                <p className="mt-1 text-sm text-blue-800">سترفع إيصال التحويل بعد إنشاء الطلب مباشرة، وسيتم إخطار البائع لمراجعته.</p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BANK_OPTIONS.map((bank) => (
                  <button
                    key={bank.name}
                    type="button"
                    onClick={() => onBankChange(bank.name)}
                    data-testid="payment-bank-option"
                    data-cy={`payment-method-bank-${bank.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    className={`rounded-lg border-2 px-2 py-2 text-xs font-medium transition-all ${selectedBank === bank.name ? 'border-blue-500 bg-white text-blue-900' : 'border-blue-100 bg-white/80 text-gray-700 hover:border-blue-300'}`}
                  >
                    <div className="mx-auto mb-1 h-2 w-2 rounded-full" style={{ backgroundColor: bank.color }}></div>
                    <span className="text-[10px]">{bank.name}</span>
                  </button>
                ))}
              </div>

              {selectedBank && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  ✓ البنك المحدد: <strong>{selectedBank}</strong>
                </div>
              )}

              {errors.selectedBank && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errors.selectedBank}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
          <div>
            <p className="font-semibold text-orange-900">{selectedWarning.title}</p>
            <p className="mt-1 text-sm leading-6 text-orange-900">{selectedWarning.body}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
        <div className="flex items-start gap-3">
          <input
            id="payment-terms-acceptance"
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => onTermsAcceptedChange(event.target.checked)}
            data-testid="payment-terms-checkbox"
            className="mt-1 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
            disabled={disabled}
          />
          <div className="space-y-2">
            <label htmlFor="payment-terms-acceptance" className="font-medium text-gray-900 cursor-pointer">
              أوافق على شروط الدفع الخاصة بهذه الطلبية
            </label>
            <p className="text-sm leading-6 text-gray-600">{termsCopyByType[paymentType] || termsCopyByType.full}</p>
            <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-gray-500">المبلغ الآن:</span>{' '}
                <strong>{formatPrice(paymentBreakdown.now)}</strong>
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-2">
                <span className="text-gray-500">المبلغ لاحقاً:</span>{' '}
                <strong>{formatPrice(paymentBreakdown.later)}</strong>
              </div>
            </div>
          </div>
        </div>

        {errors.paymentTerms && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errors.paymentTerms}
          </div>
        )}
      </div>
    </div>
  )
}

export default PaymentTypeSelector