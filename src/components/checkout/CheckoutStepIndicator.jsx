import { CheckIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

export default function CheckoutStepIndicator({ step, steps }) {
  const { t } = useTranslation()

  return (
    <div className="mb-6">
      <nav aria-label="Checkout steps">
        <div className="flex items-center justify-center flex-wrap gap-1">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step >= s.num ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}
                aria-current={step === s.num ? 'step' : undefined}
              >
                {step > s.num ? <CheckIcon className="w-4 h-4" /> : s.num}
              </div>
              <span className={`text-sm font-medium ${step >= s.num ? 'text-primary-600' : 'text-gray-400'}`}>
                {t(`checkout.steps.${s.label.toLowerCase()}`)}
              </span>
              {i < steps.length - 1 && <ChevronRightIcon className="w-4 h-4 text-gray-300" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </nav>
    </div>
  )
}
