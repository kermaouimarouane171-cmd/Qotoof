import { useMemo, useState } from 'react'
import {
  BanknotesIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  TruckIcon,
} from '@heroicons/react/24/outline'
import { Card, Modal } from '@/components/ui'

const PAYMENT_OPTIONS = [
  {
    key: 'full',
    title: 'دفع كامل قبل التنفيذ',
    description: 'يدفع المشتري كامل قيمة الطلب قبل بدء التجهيز أو الشحن.',
    icon: BanknotesIcon,
    panelClassName: 'border-emerald-200 bg-emerald-50/60',
    iconClassName: 'bg-emerald-100 text-emerald-700',
  },
  {
    key: 'split',
    title: 'دفع مرحلي 50% + 50%',
    description: '50% عند تأكيد الطلب و50% بعد تأكيد التوصيل أو قبل التسليم النهائي.',
    icon: ShieldCheckIcon,
    panelClassName: 'border-amber-200 bg-amber-50/70',
    iconClassName: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'cod',
    title: 'الدفع عند الاستلام',
    description: 'متاح فقط للمشترين المؤهلين وفق درجة الثقة وسجل الالتزام السابق.',
    icon: TruckIcon,
    panelClassName: 'border-rose-200 bg-rose-50/70',
    iconClassName: 'bg-rose-100 text-rose-700',
  },
]

const PaymentPolicySettings = ({ value, onChange, disabled = false, error }) => {
  const [showCodWarning, setShowCodWarning] = useState(false)

  const enabledPoliciesCount = useMemo(
    () => Object.values(value || {}).filter(Boolean).length,
    [value]
  )

  const handleToggle = (policyKey, checked) => {
    if (disabled) return

    if (policyKey === 'cod' && checked && !value?.cod) {
      setShowCodWarning(true)
      return
    }

    onChange({
      ...value,
      [policyKey]: checked,
    })
  }

  const confirmCodActivation = () => {
    onChange({
      ...value,
      cod: true,
    })
    setShowCodWarning(false)
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <BanknotesIcon className="w-5 h-5 text-gray-600" />
              سياسات الدفع للمتجر
            </h2>
            <p className="text-sm text-gray-500 leading-6 max-w-3xl">
              حدّد أنواع الدفع التي تسمح بها لطلبات متجرك. يجب أن تبقى سياسة واحدة على الأقل مفعلة دائماً.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            {enabledPoliciesCount} سياسات مفعلة
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {PAYMENT_OPTIONS.map((option) => {
            const Icon = option.icon
            const checked = Boolean(value?.[option.key])

            return (
              <label
                key={option.key}
                className={`block rounded-2xl border p-4 transition-all ${option.panelClassName} ${checked ? 'ring-2 ring-offset-2 ring-emerald-400' : ''} ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${option.iconClassName}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{option.title}</p>
                        <p className="mt-1 text-sm leading-6 text-gray-600">{option.description}</p>
                      </div>

                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => handleToggle(option.key, event.target.checked)}
                        className="mt-1 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        disabled={disabled}
                        aria-label={option.title}
                      />
                    </div>

                    {option.key === 'cod' && checked && (
                      <div className="mt-3 rounded-xl border border-rose-200 bg-white/80 px-3 py-3 text-sm text-rose-700">
                        تذكير: الطلبات المؤهلة للدفع عند الاستلام فقط هي التي تظهر هذا الخيار للمشتري. في حالة النزاع قد يتم الإفصاح عن بيانات المشتري لجهات التحصيل وفق الشروط القانونية.
                      </div>
                    )}
                  </div>
                </div>
              </label>
            )
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
            <div className="space-y-1 text-sm text-orange-900">
              <p className="font-semibold">تنبيه تشغيلي وقانوني</p>
              <p>رفع إيصال التحويل يصبح إلزامياً في الدفع الكامل والدفع المرحلي قبل اعتماد الطلب من البائع.</p>
              <p>عند تفعيل الدفع عند الاستلام فأنت تقر بإمكانية فتح نزاع تحصيل رسمي إذا رفض المشتري الدفع بعد إثبات التنفيذ.</p>
            </div>
          </div>
        </div>

        {(error || enabledPoliciesCount === 0) && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || 'يجب تفعيل سياسة دفع واحدة على الأقل قبل الحفظ.'}
          </div>
        )}
      </Card>

      <Modal
        isOpen={showCodWarning}
        onClose={() => setShowCodWarning(false)}
        size="md"
        title="تحذير قبل تفعيل الدفع عند الاستلام"
      >
        <div className="space-y-4 text-sm text-gray-700">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-red-800">
            <p className="font-semibold mb-2">أنت على وشك تفعيل الدفع عند الاستلام.</p>
            <p className="leading-6">
              هذا الخيار يعرّض المتجر لاحتمال رفض الدفع عند التسليم، لذلك سيتم السماح به فقط للمشترين المؤهلين حسب درجة الثقة، وقد تستخدم المنصة بيانات الطلب وبيانات المشتري في حالات النزاع والتحصيل وفق السياسة القانونية المنشورة.
            </p>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4 text-orange-900">
            <p className="font-semibold mb-2">بالموافقة، أنت تقر بما يلي:</p>
            <ul className="list-disc space-y-1 pr-5 leading-6">
              <li>لن يظهر هذا الخيار إلا للمشترين المؤهلين.</li>
              <li>قد يتم خفض درجة ثقة المشتري وفتح نزاع تحصيل إذا ثبت رفضه للدفع دون مبرر.</li>
              <li>تحتفظ المنصة بإيصالات الدفع وسجلات التواصل واللوجستيات كأدلة إثبات.</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCodWarning(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={confirmCodActivation}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              أوافق وأفعّل الدفع عند الاستلام
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default PaymentPolicySettings