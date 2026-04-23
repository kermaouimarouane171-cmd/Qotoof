import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui'
import storeTypeService from '@/services/storeTypeService'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import {
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  TruckIcon,
} from '@heroicons/react/24/outline'

const getEventTone = (event) => {
  if (!event?.previous_store_type) {
    return {
      accent: 'text-blue-700',
      surface: 'border-blue-200 bg-blue-50',
      icon: SparklesIcon,
      title: 'تم تفعيل تصنيف متجرك',
    }
  }

  if (event.previous_store_type !== event.current_store_type) {
    const upgraded = event.current_active_products_count > event.previous_active_products_count
    return upgraded
      ? {
          accent: 'text-green-700',
          surface: 'border-green-200 bg-green-50',
          icon: ArrowTrendingUpIcon,
          title: 'ترقية تلقائية في نوع المتجر',
        }
      : {
          accent: 'text-amber-800',
          surface: 'border-amber-200 bg-amber-50',
          icon: ArrowTrendingDownIcon,
          title: 'تراجع تلقائي في نوع المتجر',
        }
  }

  return {
    accent: 'text-slate-700',
    surface: 'border-slate-200 bg-slate-50',
    icon: TruckIcon,
    title: 'تم تحديث خيار التوصيل تلقائياً',
  }
}

const StoreEvolutionNotification = ({ vendorId }) => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [acknowledging, setAcknowledging] = useState(false)
  const [storeSetup, setStoreSetup] = useState(null)
  const [evolutionEvent, setEvolutionEvent] = useState(null)

  useEffect(() => {
    const loadStoreEvolutionData = async () => {
      if (!vendorId) return

      setLoading(true)
      try {
        const [setup, latestEvent] = await Promise.all([
          storeTypeService.getVendorStoreSetup(vendorId),
          storeTypeService.getLatestStoreEvolutionEvent(vendorId),
        ])

        setStoreSetup(setup)
        setEvolutionEvent(latestEvent)

        useAuthStore.setState((state) => ({
          profile: state.profile
            ? {
                ...state.profile,
                store_type: setup.storeType,
                delivery_option: setup.deliveryOption,
                active_products_count: setup.activeProductsCount,
                preferred_driver_id: setup.preferred_driver_id,
                partnership_status: setup.partnership_status,
              }
            : state.profile,
        }))
      } catch (error) {
        toast.error(error.message || 'تعذر تحميل حالة تطور المتجر')
      } finally {
        setLoading(false)
      }
    }

    loadStoreEvolutionData()
  }, [vendorId])

  const handleAcknowledge = async () => {
    if (!vendorId || !evolutionEvent?.id) return

    setAcknowledging(true)
    try {
      await storeTypeService.acknowledgeStoreEvolutionEvent(evolutionEvent.id, vendorId)
      setEvolutionEvent(null)
      toast.success('تم تأكيد الاطلاع على تحديث المتجر')
    } catch (error) {
      toast.error(error.message || 'تعذر تأكيد الإشعار حالياً')
    } finally {
      setAcknowledging(false)
    }
  }

  if (loading || !storeSetup) {
    return (
      <Card className="p-5 mb-6 animate-pulse">
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="h-20 rounded-2xl bg-gray-100" />
          <div className="h-20 rounded-2xl bg-gray-100" />
          <div className="h-20 rounded-2xl bg-gray-100" />
        </div>
        <div className="h-3 rounded-full bg-gray-100" />
      </Card>
    )
  }

  const eventTone = getEventTone(evolutionEvent)
  const EventIcon = eventTone.icon
  const progressWidth = `${storeSetup.progress.percentage}%`

  return (
    <Card className="p-5 mb-6 overflow-hidden">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 mb-3">
            <SparklesIcon className="w-4 h-4" />
            حالة تطور المتجر
          </div>
          <h2 className="text-lg font-semibold text-gray-900">نوع المتجر وخيار التوصيل</h2>
          <p className="text-sm text-gray-600 leading-6 mt-2 max-w-3xl">
            يتم تحديث النوع تلقائياً عند تغيّر عدد المنتجات النشطة، مع الحفاظ على خيار التوصيل الحالي ما لم يصبح غير صالح للفئة الجديدة.
          </p>
        </div>

        <button type="button" onClick={() => navigate('/vendor/delivery-options')} className="btn-outline">
          إدارة الإعدادات
        </button>
      </div>

      {evolutionEvent && (
        <div className={`rounded-2xl border px-4 py-4 mb-5 ${eventTone.surface}`}>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                <EventIcon className={`w-5 h-5 ${eventTone.accent}`} />
              </div>
              <div>
                <p className={`font-semibold ${eventTone.accent}`}>{eventTone.title}</p>
                <p className="text-sm text-gray-700 leading-6 mt-2">{evolutionEvent.message_ar}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(evolutionEvent.created_at).toLocaleString('ar-MA')}
                </p>
              </div>
            </div>

            <button type="button" onClick={handleAcknowledge} disabled={acknowledging} className="btn-outline">
              {acknowledging ? 'جارٍ التأكيد...' : 'تم الاطلاع'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">نوع المتجر الحالي</p>
          <p className="font-semibold text-gray-900">{storeSetup.storeTypeLabel}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">خيار التوصيل المعتمد</p>
          <p className="font-semibold text-gray-900">{storeSetup.deliveryOptionMeta?.label}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">المنتجات النشطة</p>
          <p className="font-semibold text-gray-900">{storeSetup.activeProductsCountLabel}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-medium text-gray-900">التقدم نحو النوع التالي</p>
          <span className="text-xs text-gray-500">{storeSetup.progress.percentage}%</span>
        </div>
        <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all"
            style={{ width: progressWidth }}
          />
        </div>
        <p className="text-sm text-gray-600 leading-6">{storeSetup.progress.headline}</p>
      </div>

      {storeSetup.requiresOwnDriverSetup && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">خيار السائق المرتبط يحتاج سائقاً مقبول الشراكة</p>
                <p className="text-sm text-amber-800 leading-6 mt-2">
                  نوع متجرك يسمح بهذا الخيار، لكن قبول الطلبات سيبقى معطلاً حتى تربط سائقاً وتقبل الشراكة معه.
                </p>
              </div>
            </div>

            <button type="button" onClick={() => navigate('/vendor/find-driver')} className="btn-outline">
              ربط سائق الآن
            </button>
          </div>
        </div>
      )}

      {!evolutionEvent && !storeSetup.requiresOwnDriverSetup && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 leading-6">
              إعداد متجرك متوافق حالياً مع نوعه الحالي، وسيتم الحفاظ على هذا الخيار تلقائياً ما دام صالحاً.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

export default StoreEvolutionNotification