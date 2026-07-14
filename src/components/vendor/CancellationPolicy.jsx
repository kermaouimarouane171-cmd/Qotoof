import { useMemo } from 'react'
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { Card, Input } from '@/components/ui'
import {
  CANCELLATION_CUTOFF_OPTIONS,
  normalizeCancellationPolicy,
} from '@/services/cancellationService'
import { useTranslation } from 'react-i18next'

const formatMad = (value) => `${Number(value || 0).toFixed(2)} درهم`

const CancellationPolicy = ({ value, onChange, disabled = false, error }) => {
  const { t } = useTranslation()
  const FEE_TYPE_OPTIONS = [
    { value: 'none', label: t('vendor.cancellationPolicy.feeType.none', 'بدون رسوم إلغاء') },
    { value: 'fixed', label: t('vendor.cancellationPolicy.feeType.fixed', 'رسوم ثابتة بالدرهم') },
    { value: 'percentage', label: t('vendor.cancellationPolicy.feeType.percentage', 'رسوم بنسبة مئوية من قيمة الطلب') },
  ]
  const policy = useMemo(() => normalizeCancellationPolicy(value), [value])

  const summary = useMemo(() => {
    if (!policy.allow_cancellation) {
      return t('vendor.cancellationPolicy.summary.disabled', { defaultValue: 'سيتم منع الإلغاء الذاتي من طرف المشتري، وسيتوجب عليه التواصل مع البائع أو الدعم.' })
    }

    if (policy.cancellation_fee_type === 'none') {
      return t('vendor.cancellationPolicy.summary.free', {
        defaultValue: 'الإلغاء متاح مجاناً خلال أول {{minutes}} دقيقة، وبعدها يبقى الاسترداد {{refund}}% بدون رسوم إضافية.',
        minutes: policy.free_cancellation_window_minutes,
        refund: policy.refund_percentage.toFixed(2),
      })
    }

    const feeText = policy.cancellation_fee_type === 'percentage'
      ? `${Number(policy.cancellation_fee_value || 0).toFixed(2)}%`
      : formatMad(policy.cancellation_fee_value)

    return t('vendor.cancellationPolicy.summary.withFee', {
      defaultValue: 'الإلغاء مجاني خلال أول {{minutes}} دقيقة، وبعدها تطبق رسوم {{fee}} مع استرداد {{refund}}% من قيمة الطلب.',
      minutes: policy.free_cancellation_window_minutes,
      fee: feeText,
      refund: policy.refund_percentage.toFixed(2),
    })
  }, [policy, t])

  const updateField = (field, nextValue) => {
    onChange({
      ...policy,
      [field]: nextValue,
    })
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <ArrowPathIcon className="w-5 h-5 text-gray-600" />
            {t('vendor.cancellationPolicy.title', 'سياسة إلغاء الطلبات')}
          </h2>
          <p className="text-sm text-gray-500 leading-6 max-w-3xl">
            {t('vendor.cancellationPolicy.description', 'حدّد متى يُسمح للمشتري بإلغاء الطلب، وما إذا كانت هناك رسوم أو نسبة استرداد بعد انتهاء النافذة المجانية.')}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          <span className={`h-2 w-2 rounded-full ${policy.allow_cancellation ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
          {policy.allow_cancellation ? 'الإلغاء مفعّل' : 'الإلغاء معطّل'}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <label className={`rounded-2xl border p-4 transition-all ${policy.allow_cancellation ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200 bg-gray-50'} ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">السماح بالإلغاء الذاتي</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                عند التفعيل يمكن للمشتري إلغاء الطلب وفق القواعد أدناه، وعند التعطيل سيحتاج إلى التواصل مع المتجر أو الدعم.
              </p>
            </div>
            <input
              type="checkbox"
              checked={policy.allow_cancellation}
              onChange={(event) => updateField('allow_cancellation', event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
              disabled={disabled}
              aria-label="السماح بالإلغاء الذاتي"
            />
          </div>
        </label>

        <label className={`rounded-2xl border p-4 transition-all ${policy.auto_approve_before_preparing ? 'border-amber-200 bg-amber-50/70' : 'border-gray-200 bg-gray-50'} ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">اعتماد تلقائي قبل التجهيز</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                للتوثيق الحالي سيتم حفظ هذا الخيار داخل snapshot الطلب عند الإلغاء حتى تبقى القاعدة واضحة لاحقاً في الإدارة والفواتير.
              </p>
            </div>
            <input
              type="checkbox"
              checked={policy.auto_approve_before_preparing}
              onChange={(event) => updateField('auto_approve_before_preparing', event.target.checked)}
              className="mt-1 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
              disabled={disabled}
              aria-label="اعتماد تلقائي قبل التجهيز"
            />
          </div>
        </label>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Input
          label="نافذة الإلغاء المجاني بالدقائق"
          type="number"
          min="0"
          step="1"
          value={policy.free_cancellation_window_minutes}
          onChange={(event) => updateField('free_cancellation_window_minutes', Number(event.target.value || 0))}
          disabled={disabled}
        />

        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="input-label">إيقاف الإلغاء عند الحالة</label>
          <select
            value={policy.cutoff_status}
            onChange={(event) => updateField('cutoff_status', event.target.value)}
            className="input"
            disabled={disabled}
          >
            {CANCELLATION_CUTOFF_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="input-label">نوع رسوم الإلغاء</label>
          <select
            value={policy.cancellation_fee_type}
            onChange={(event) => updateField('cancellation_fee_type', event.target.value)}
            className="input"
            disabled={disabled}
          >
            {FEE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <Input
          label={policy.cancellation_fee_type === 'percentage' ? 'قيمة الرسوم (%)' : 'قيمة الرسوم'}
          type="number"
          min="0"
          max={policy.cancellation_fee_type === 'percentage' ? '100' : undefined}
          step="0.01"
          value={policy.cancellation_fee_value}
          onChange={(event) => updateField('cancellation_fee_value', Number(event.target.value || 0))}
          disabled={disabled || policy.cancellation_fee_type === 'none'}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="نسبة الاسترداد بعد انتهاء النافذة المجانية (%)"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={policy.refund_percentage}
          onChange={(event) => updateField('refund_percentage', Number(event.target.value || 0))}
          disabled={disabled}
        />

        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="input-label">وصف السياسة للمشتري</label>
          <textarea
            rows="4"
            value={policy.policy_text_ar}
            onChange={(event) => updateField('policy_text_ar', event.target.value)}
            disabled={disabled}
            className="input min-h-[112px]"
            placeholder="مثال: يمكن للمشتري إلغاء الطلب مجاناً خلال أول ساعتين، وبعدها تخصم رسوم تشغيلية ثابتة."
          />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-900">
        <div className="flex items-start gap-3">
          <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div className="space-y-1">
            <p className="font-semibold">ملخص السياسة الحالية</p>
            <p className="leading-6">{summary}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm text-orange-900">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
          <div className="space-y-1">
            <p className="font-semibold">تنبيه تشغيلي</p>
            <p>تُحفظ قواعد الإلغاء داخل snapshot الطلب وقت التنفيذ حتى تبقى الرسوم ونسبة الاسترداد ثابتة حتى لو عدلت السياسة لاحقاً.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </Card>
  )
}

export default CancellationPolicy