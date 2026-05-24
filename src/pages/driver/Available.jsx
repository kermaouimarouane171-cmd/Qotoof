import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner } from '@/components/ui'
import { deliveriesApi } from '@/services/deliveries'
import deliveryMatchingService, {
  getCargoSizeLabel,
  getDriverDeliveryPaymentMethodLabel,
  normalizeDriverPreferences,
} from '@/services/deliveryMatchingService'
import {
  TruckIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import { formatPrice } from '@/utils/currency'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const DriverAvailable = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [acceptingId, setAcceptingId] = useState(null)

  useEffect(() => {
    loadAvailableDeliveries()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const loadAvailableDeliveries = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const data = await deliveryMatchingService.getMatchingDeliveriesForDriver(user.id)
      setDeliveries(data)
    } catch (error) {
      logger.error('Error loading matching deliveries:', error)
      toast.error('تعذر تحميل الطلبات المطابقة حالياً')
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptDelivery = async (deliveryId) => {
    if (!user?.id) return

    try {
      setAcceptingId(deliveryId)
      await deliveriesApi.acceptDelivery(deliveryId, user.id)
      toast.success('تم قبول مهمة التوصيل بنجاح')
      navigate(`/driver/delivery/${deliveryId}/pickup`)
    } catch (error) {
      logger.error('Error accepting delivery:', error)
      toast.error(error.message || 'تعذر قبول مهمة التوصيل')
    } finally {
      setAcceptingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const preferences = normalizeDriverPreferences(profile || {})

  if (deliveries.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('driver.available.title', 'Available Deliveries')}</h1>
            <p className="text-gray-500 mt-1">الطلبات المطابقة لتفضيلاتك القانونية ستظهر هنا فقط.</p>
          </div>
          <button onClick={() => navigate('/driver/settings')} className="btn-outline inline-flex items-center gap-2">
            <AdjustmentsHorizontalIcon className="w-4 h-4" />
            تعديل التفضيلات
          </button>
        </div>

        <Card className="p-6 bg-gray-50 border border-gray-200">
          <div className="flex items-start gap-3">
            <TruckIcon className="w-6 h-6 text-gray-400 mt-0.5" />
            <div>
              <h2 className="font-semibold text-gray-900">لا توجد طلبات مطابقة حالياً</h2>
              <p className="text-sm text-gray-600 mt-2 leading-6">
                النطاق الحالي من {preferences.minDeliveryDistanceKm} كم إلى {preferences.maxDeliveryDistanceKm} كم، والأحجام المقبولة: {preferences.acceptedCargoSizes.map((cargoSize) => getCargoSizeLabel(cargoSize)).join('، ')}.
              </p>
              <div className="flex gap-3 mt-4">
                <button onClick={loadAvailableDeliveries} className="btn-primary inline-flex items-center gap-2">
                  <ArrowPathIcon className="w-4 h-4" />
                  تحديث القائمة
                </button>
                <button onClick={() => navigate('/driver/settings')} className="btn-outline">
                  فتح الإعدادات
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('driver.available.title', 'Available Deliveries')}</h1>
          <p className="text-gray-500 mt-1">{deliveries.length} مهمة مطابقة لتفضيلاتك الحالية.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadAvailableDeliveries} className="btn-outline inline-flex items-center gap-2">
            <ArrowPathIcon className="w-4 h-4" />
            تحديث
          </button>
          <button onClick={() => navigate('/driver/settings')} className="btn-outline inline-flex items-center gap-2">
            <AdjustmentsHorizontalIcon className="w-4 h-4" />
            تفضيلات التوصيل
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TruckIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{deliveries.length}</p>
              <p className="text-xs text-gray-500">مطابقة الآن</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{preferences.maxDeliveryDistanceKm}</p>
              <p className="text-xs text-gray-500">أقصى مسافة</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <ClockIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{preferences.acceptedCargoSizes.map((cargoSize) => getCargoSizeLabel(cargoSize)).join('، ')}</p>
              <p className="text-xs text-gray-500">الأحجام المقبولة</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <CurrencyDollarIcon className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {[preferences.driverDeliveryPaymentCash ? 'نقداً' : null, preferences.driverDeliveryPaymentTransfer ? 'تحويل' : null].filter(Boolean).join(' / ')}
              </p>
              <p className="text-xs text-gray-500">تحصيل رسم التوصيل</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        {deliveries.map((delivery) => (
          <Card key={delivery.id} className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${delivery.assigned_to_current_driver ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {delivery.assigned_to_current_driver ? 'مُسندة إليك' : 'متاحة لك'}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {getCargoSizeLabel(delivery.cargo_size || delivery.order?.cargo_size)}
                  </span>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                    {getDriverDeliveryPaymentMethodLabel(delivery.order?.driver_delivery_payment_method)}
                  </span>
                </div>

                <h2 className="text-lg font-semibold text-gray-900">#{delivery.order?.order_number || delivery.order_id?.slice(0, 8)}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {delivery.order?.vendor?.store_name || 'متجر'} → {delivery.order?.buyer?.first_name || 'عميل'} {delivery.order?.buyer?.last_name || ''}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm text-gray-600">
                  <div className="rounded-2xl bg-gray-50 px-4 py-3">
                    <p className="text-xs text-gray-500 mb-1">عنوان الاستلام</p>
                    <p className="font-medium text-gray-900">{delivery.pickup_address || delivery.order?.vendor?.city || 'غير محدد'}</p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 px-4 py-3">
                    <p className="text-xs text-gray-500 mb-1">عنوان التسليم</p>
                    <p className="font-medium text-gray-900">{delivery.delivery_address || delivery.order?.shipping_address || 'غير محدد'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-500">
                  <span className="rounded-full bg-gray-100 px-3 py-1">مسافة الطلب {delivery.route_distance_km != null ? `${delivery.route_distance_km.toFixed(1)} كم` : 'غير متاحة'}</span>
                  <span className="rounded-full bg-gray-100 px-3 py-1">من المتجر {delivery.pickup_distance_km != null ? `${delivery.pickup_distance_km.toFixed(1)} كم` : 'غير متاحة'}</span>
                  <span className="rounded-full bg-gray-100 px-3 py-1">قيمة المنتجات {formatPrice(delivery.order?.vendor_product_total || delivery.order?.total || 0)}</span>
                  <span className="rounded-full bg-gray-100 px-3 py-1">رسم التوصيل {formatPrice(delivery.order?.delivery_fee_total || delivery.order?.shipping_cost || 0)}</span>
                </div>
              </div>

              <div className="w-full lg:w-56 space-y-3">
                <button
                  onClick={() => handleAcceptDelivery(delivery.id)}
                  disabled={acceptingId === delivery.id}
                  className="btn-primary w-full"
                >
                  {acceptingId === delivery.id ? 'جاري القبول...' : 'قبول المهمة'}
                </button>
                <button
                  onClick={() => navigate(`/orders/${delivery.order_id}`)}
                  className="btn-outline w-full"
                >
                  تفاصيل الطلب
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default DriverAvailable