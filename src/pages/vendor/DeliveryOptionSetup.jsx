import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner } from '@/components/ui'
import storeTypeService, { DELIVERY_OPTION_META } from '@/services/storeTypeService'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TruckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

const OPTION_ICONS = {
  self: ShoppingBagIcon,
  find_driver: UserGroupIcon,
  own_driver: TruckIcon,
}

const DeliveryOptionSetup = () => {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [storeSetup, setStoreSetup] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)

  useEffect(() => {
    const loadStoreSetup = async () => {
      if (!profile?.id) return

      setLoading(true)
      try {
        const setup = await storeTypeService.getVendorStoreSetup(profile.id)
        setStoreSetup(setup)
        setSelectedOption(setup.deliveryOption)
      } catch (error) {
        toast.error(error.message || 'تعذر تحميل إعدادات التوصيل')
      } finally {
        setLoading(false)
      }
    }

    loadStoreSetup()
  }, [profile?.id])

  const handleSave = async () => {
    if (!profile?.id || !selectedOption) {
      toast.error('يرجى اختيار خيار التوصيل أولاً')
      return
    }

    setSaving(true)
    try {
      const updatedSetup = await storeTypeService.updateDeliveryOption(profile.id, selectedOption)
      setStoreSetup(updatedSetup)
      setSelectedOption(updatedSetup.deliveryOption)

      useAuthStore.setState((state) => ({
        profile: state.profile
          ? {
              ...state.profile,
              store_type: updatedSetup.storeType,
              delivery_option: updatedSetup.deliveryOption,
              active_products_count: updatedSetup.activeProductsCount,
              store_type_updated_at: updatedSetup.store_type_updated_at,
              delivery_option_updated_at: updatedSetup.delivery_option_updated_at,
            }
          : state.profile,
      }))

      if (selectedOption === 'own_driver' && !updatedSetup.hasLinkedOwnDriver) {
        toast.success('تم حفظ الخيار. أكمل الآن ربط السائق قبل قبول الطلبات الجديدة.')
        navigate('/vendor/find-driver')
        return
      }

      if (selectedOption === 'find_driver') {
        toast.success('تم تفعيل خيار البحث عن سائق للطلبات الجديدة.')
      } else if (selectedOption === 'self') {
        toast.success('تم تفعيل التوصيل الذاتي للطلبات الجديدة.')
      } else {
        toast.success('تم حفظ إعداد التوصيل بنجاح.')
      }

      navigate('/vendor/dashboard')
    } catch (error) {
      toast.error(error.message || 'تعذر حفظ خيار التوصيل')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !storeSetup) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const selectedOptionMeta = DELIVERY_OPTION_META[selectedOption]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إعداد خيار التوصيل</h1>
          <p className="text-sm text-gray-500 mt-2 leading-6 max-w-3xl">
            يتغيّر نوع متجرك تلقائياً حسب عدد المنتجات النشطة. اختر هنا طريقة التوصيل المتاحة لنوع متجرك الحالي، وسيتم تطبيقها على الطلبات الجديدة فقط.
          </p>
        </div>
        <button type="button" onClick={() => navigate('/vendor/dashboard')} className="btn-outline">
          العودة إلى لوحة التحكم
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">نوع المتجر الحالي</p>
              <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
                <SparklesIcon className="w-4 h-4" />
                {storeSetup.storeTypeLabel}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">المنتجات النشطة</p>
              <p className="text-lg font-bold text-gray-900">{storeSetup.activeProductsCountLabel}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 leading-6 mb-4">{storeSetup.storeTypeDescription}</p>

          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-900">التقدم نحو النوع التالي</p>
            <span className="text-xs text-gray-500">{storeSetup.progress.percentage}%</span>
          </div>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all"
              style={{ width: `${storeSetup.progress.percentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 leading-6">{storeSetup.progress.headline}</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-gray-500 mb-2">خيار التوصيل الحالي</p>
          <p className="font-semibold text-gray-900 mb-2">{storeSetup.deliveryOptionMeta?.label}</p>
          <p className="text-sm text-gray-600 leading-6 mb-4">{storeSetup.deliveryOptionMeta?.description}</p>

          {storeSetup.hasLinkedOwnDriver ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              يوجد سائق مرتبط ومقبول الشراكة لهذا المتجر.
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              لا يوجد سائق مرتبط ومقبول الشراكة حالياً.
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {storeSetup.allowedDeliveryOptions.map((option) => {
          const Icon = OPTION_ICONS[option.value] || TruckIcon
          const isSelected = selectedOption === option.value

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedOption(option.value)}
              className={`rounded-2xl border p-5 text-right transition-all ${
                isSelected
                  ? 'border-green-500 bg-green-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-green-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  isSelected ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <Icon className={`w-6 h-6 ${isSelected ? 'text-green-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{option.label}</p>
                  <p className="text-xs text-gray-500">{option.shortLabel}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-6">{option.description}</p>
            </button>
          )
        })}
      </div>

      {selectedOptionMeta?.value === 'own_driver' && !storeSetup.hasLinkedOwnDriver && (
        <Card className="p-5 border border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 mb-2">السائق المرتبط يحتاج إكمال الربط أولاً</p>
              <p className="text-sm text-amber-800 leading-6 mb-4">
                يمكنك حفظ هذا الخيار الآن، لكن لن تتمكن من قبول الطلبات الجديدة حتى يصبح لديك سائق مرتبط ومقبول الشراكة لهذا المتجر.
              </p>
              <button type="button" onClick={() => navigate('/vendor/find-driver')} className="btn-outline">
                الانتقال إلى البحث عن سائق
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5 bg-gray-50 border border-gray-200">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700 leading-6">
            سيتم تطبيق الإعداد الجديد على الطلبات الجديدة فقط. أما الطلبات النشطة الحالية فستبقى على حالها حتى تكتمل دورة التنفيذ.
          </p>
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'جارٍ الحفظ...' : 'حفظ خيار التوصيل'}
        </button>
        <button type="button" onClick={() => navigate('/vendor/settings')} disabled={saving} className="btn-outline">
          الرجوع إلى الإعدادات
        </button>
      </div>
    </div>
  )
}

export default DeliveryOptionSetup