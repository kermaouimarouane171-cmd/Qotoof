import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deliveriesApi } from '@/modules/delivery'
import { Card, LoadingSpinner } from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  StarIcon,
  TruckIcon,
  MapPinIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const DeliverySummaryPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [delivery, setDelivery] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await deliveriesApi.getById(id)
        setDelivery(data)
      } catch {
        toast.error(t('driver.summary.loadFailed', 'Failed to load delivery summary'))
        navigate('/driver/dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, navigate, t])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!delivery) return null

  const isLate = delivery.is_late
  const deliveredAt = delivery.delivered_at || delivery.completed_at
  const durationMs = deliveredAt && delivery.created_at
    ? new Date(deliveredAt) - new Date(delivery.created_at)
    : null
  const durationMin = durationMs ? Math.round(durationMs / 60000) : null

  return (
    <div className="max-w-lg mx-auto py-10 px-4 space-y-6">
      {/* Success Banner */}
      <div className={`rounded-2xl p-6 text-center ${isLate ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
        {isLate ? (
          <ExclamationTriangleIcon className="w-14 h-14 text-yellow-500 mx-auto mb-3" />
        ) : (
          <CheckCircleIcon className="w-14 h-14 text-green-500 mx-auto mb-3" />
        )}
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {t('driver.summary.title', 'Delivery Complete!')}
        </h1>
        <p className={`text-sm font-medium ${isLate ? 'text-yellow-700' : 'text-green-700'}`}>
          {isLate
            ? t('driver.summary.deliveredLate', 'Delivered — later than estimated')
            : t('driver.summary.deliveredOnTime', 'Delivered on time ✅')}
        </p>
      </div>

      {/* Earnings Card */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <BanknotesIcon className="w-5 h-5 text-green-600" />
          <h2 className="font-semibold text-gray-900">{t('driver.summary.earned', 'Earned This Delivery')}</h2>
        </div>
        <p className="text-4xl font-bold text-green-600 mb-1">
          {formatPrice(delivery.delivery_price || 0)}
        </p>
        <p className="text-sm text-gray-500">
          {t('driver.summary.payoutNote', 'Will be added to your pending balance')}
        </p>
      </Card>

      {/* Delivery Stats */}
      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 mb-4">{t('driver.summary.details', 'Delivery Details')}</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-500">
              <TruckIcon className="w-4 h-4" />
              {t('driver.summary.deliveryNumber', 'Delivery #')}
            </span>
            <span className="font-medium text-gray-900">{delivery.delivery_number || delivery.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-500">
              <MapPinIcon className="w-4 h-4" />
              {t('driver.summary.distance', 'Distance')}
            </span>
            <span className="font-medium text-gray-900">
              {delivery.distance_km ? `${Number(delivery.distance_km).toFixed(1)} km` : '—'}
            </span>
          </div>
          {durationMin !== null && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-gray-500">
                <ClockIcon className="w-4 h-4" />
                {t('driver.summary.duration', 'Duration')}
              </span>
              <span className="font-medium text-gray-900">{durationMin} {t('driver.summary.minutes', 'min')}</span>
            </div>
          )}
          {delivery.order?.vendor?.store_name && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500">{t('driver.summary.vendor', 'Vendor')}</span>
              <span className="font-medium text-gray-900">{delivery.order.vendor.store_name}</span>
            </div>
          )}
          {(delivery.order?.buyer?.first_name) && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500">{t('driver.summary.customer', 'Customer')}</span>
              <span className="font-medium text-gray-900">
                {delivery.order.buyer.first_name} {delivery.order.buyer.last_name}
              </span>
            </div>
          )}
          {deliveredAt && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500">{t('driver.summary.completedAt', 'Completed at')}</span>
              <span className="font-medium text-gray-900">
                {new Date(deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Rating Placeholder */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-3">
          <StarIcon className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-gray-900">{t('driver.summary.rating', 'Your Rating')}</h2>
        </div>
        {delivery.driver_rating ? (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <StarIcon
                key={star}
                className={`w-7 h-7 ${star <= delivery.driver_rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
              />
            ))}
            <span className="ml-2 text-lg font-bold text-gray-900">{delivery.driver_rating}/5</span>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {t('driver.summary.ratingPending', 'Customer rating will appear here once submitted')}
          </p>
        )}
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={() => navigate('/driver/available')}
          className="btn-primary"
        >
          {t('driver.summary.findNext', 'Find Next Delivery')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/driver/dashboard')}
          className="btn-outline"
        >
          {t('driver.summary.goToDashboard', 'Dashboard')}
        </button>
      </div>
    </div>
  )
}

export default DeliverySummaryPage
