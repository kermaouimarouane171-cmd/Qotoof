import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { deliveriesApi } from '@/modules/delivery'
import { supabase } from '@/services/supabase'
import { Card, LoadingSpinner } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import { TruckIcon, MapPinIcon, PhoneIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'
import { formatPrice } from '@/utils/currency'
import { DELIVERY_STATUS_COLORS, DELIVERY_STATUS_DEFAULT_LABELS, ACTIVE_DELIVERY_STATUSES } from '@/constants/deliveryStatus'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const DriverActive = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [activeDeliveries, setActiveDeliveries] = useState([])
  const channelRef = useRef(null)

  const loadActiveDeliveries = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)
      const response = await deliveriesApi.getDriverDeliveries(user.id)
      const deliveries = Array.isArray(response) ? response : (response?.data || [])

      const active = deliveries.filter(d => ACTIVE_DELIVERY_STATUSES.includes(d.status))
      setActiveDeliveries(active)
    } catch (error) {
      logger.error('Error loading active deliveries:', error)
      toast.error(t('driver.active.loadFailed', 'Failed to load active deliveries'))
    } finally {
      setLoading(false)
    }
  }, [user, t])

  useEffect(() => {
    if (!user?.id) return
    loadActiveDeliveries()

    const channel = supabase
      .channel(`driver-active-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries', filter: `driver_id=eq.${user.id}` },
        () => { loadActiveDeliveries() }
      )
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, loadActiveDeliveries])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (activeDeliveries.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">
          {t('driver.active.title', 'Active Delivery')}
        </h1>
        <Card className="p-12 text-center">
          <TruckIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('driver.active.noActive', 'No Active Delivery')}
          </h3>
          <p className="text-gray-500 mb-6">
            {t('driver.active.noActiveDesc', 'You don\'t have any active deliveries right now.')}
          </p>
          <button
            onClick={() => navigate('/driver/available')}
            className="btn-primary"
          >
            {t('driver.active.viewAvailable', 'View Available Deliveries')}
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        {t('driver.active.title', 'Active Delivery')} ({activeDeliveries.length})
      </h1>

      <div className="space-y-4">
        {activeDeliveries.map((delivery) => {
          return (
            <Card
              key={delivery.id}
              className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/driver/delivery/${delivery.id}/deliver`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {delivery.delivery_number || `Delivery #${delivery.id.slice(0, 8)}`}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {delivery.order?.vendor?.store_name || 'Vendor'} → {delivery.order?.buyer?.first_name}
                  </p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${DELIVERY_STATUS_COLORS[delivery.status] || 'bg-gray-100 text-gray-700'}`}>
                  {DELIVERY_STATUS_DEFAULT_LABELS[delivery.status] || delivery.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                {delivery.delivery_address && (
                  <div className="flex items-center gap-1">
                    <MapPinIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{delivery.delivery_address}</span>
                  </div>
                )}
                {delivery.order?.buyer?.phone && (
                  <a
                    href={`tel:${delivery.order.buyer.phone}`}
                    className="flex items-center gap-1 text-green-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <PhoneIcon className="w-4 h-4" />
                    {t('driver.active.call', 'Call')}
                  </a>
                )}
                {delivery.delivery_price && (
                  <span className="flex items-center gap-1 font-semibold text-green-600">
                    <CurrencyDollarIcon className="w-4 h-4" />
                    {formatPrice(delivery.delivery_price)}
                  </span>
                )}
                {delivery.estimated_delivery_time && (
                  <span className="flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    {new Date(delivery.estimated_delivery_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <div className="mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/driver/delivery/${delivery.id}/deliver`)
                  }}
                  className="btn-primary w-full"
                >
                  {t('driver.active.viewTracking', 'View Tracking')}
                </button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

const DriverActiveWithErrorBoundary = () => (
  <ErrorBoundary componentName="DriverActive">
    <DriverActive />
  </ErrorBoundary>
)

export default DriverActiveWithErrorBoundary
