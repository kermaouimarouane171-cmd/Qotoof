import { Card, Input } from '@/components/ui'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

const RefundPolicySettings = ({ value, onChange, disabled = false, error }) => {
  const { t } = useTranslation()
  const SHIPPING_OPTIONS = [
    { value: 'buyer', label: t('vendor.refundPolicy.shipping.buyer', 'المشتري يتحمل الشحن') },
    { value: 'vendor', label: t('vendor.refundPolicy.shipping.vendor', 'البائع يتحمل الشحن') },
    { value: 'shared', label: t('vendor.refundPolicy.shipping.shared', 'مشاركة التكاليف بين الطرفين') },
  ]
  const updateField = (field, nextValue) => {
    onChange({
      ...value,
      [field]: nextValue,
    })
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <ArrowPathIcon className="w-5 h-5 text-gray-600" />
        {t('vendor.refundPolicy.title', 'سياسة الاسترجاع والاسترداد')}
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        {t('vendor.refundPolicy.description', 'اضبط شروط الإرجاع التي ستظهر للمشتري على صفحة المنتج قبل الشراء.')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t('vendor.refundPolicy.returnWindowLabel', 'نافذة الإرجاع (أيام)')}
          type="number"
          min="1"
          max="30"
          value={value.return_window_days}
          onChange={(event) => updateField('return_window_days', Number(event.target.value || 1))}
          disabled={disabled}
        />

        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="input-label">{t('vendor.refundPolicy.shippingCostLabel', 'تكلفة شحن الإرجاع')}</label>
          <select
            value={value.return_shipping_paid_by}
            onChange={(event) => updateField('return_shipping_paid_by', event.target.value)}
            className="input"
            disabled={disabled}
          >
            {SHIPPING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="mt-4 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value.allow_partial_returns}
          onChange={(event) => updateField('allow_partial_returns', event.target.checked)}
          className="mt-1 h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
          disabled={disabled}
        />
        <div>
          <p className="font-medium text-gray-900">السماح بالإرجاع الجزئي</p>
          <p className="text-sm text-gray-500">تمكين إرجاع جزء من الطلب عند وجود أكثر من عنصر.</p>
        </div>
      </label>

      <div className="mt-4">
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="input-label">فئات غير قابلة للإرجاع (مفصولة بفاصلة)</label>
        <input
          type="text"
          value={(value.non_returnable_categories || []).join(', ')}
          onChange={(event) => {
            const list = event.target.value
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
            updateField('non_returnable_categories', list)
          }}
          className="input"
          disabled={disabled}
          placeholder="مثال: النباتات سريعة التلف، المنتجات المفتوحة"
        />
      </div>

      <div className="mt-4">
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="input-label">نص سياسة الاسترجاع المعروض للمشتري</label>
        <textarea
          rows="4"
          value={value.policy_text}
          onChange={(event) => updateField('policy_text', event.target.value)}
          className="input min-h-[112px]"
          disabled={disabled}
          placeholder="اكتب سياسة واضحة ومباشرة لطلبات الإرجاع والاسترداد."
        />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </Card>
  )
}

export default RefundPolicySettings