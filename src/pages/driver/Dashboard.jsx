import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { deliveriesApi } from '@/modules/delivery'
import { realtimeService } from '@/services/realtime'
import ErrorBoundary from '@/components/ErrorBoundary'
import PartnershipRequests from '@/components/shared/PartnershipRequests'
import { Card, LoadingSpinner, Button, Map, DriverAvailabilityToggle, DeliveryRequestCard } from '@/components/ui'
import { useMapCenter } from '@/hooks/useMapCenter'
import { formatPrice } from '@/utils/currency'
import {
  TruckIcon,
  ShoppingBagIcon,
  UsersIcon,
  MapPinIcon,
  ClockIcon,
  CheckCircleIcon,
  PhoneIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'
import { DELIVERY_STATUS_COLORS, DELIVERY_STATUS_DEFAULT_LABELS, COMPLETED_DELIVERY_STATUSES } from '@/constants/deliveryStatus'

const DriverDashboard = () => {
  const { t } = useTranslation()
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [deliveries, setDeliveries] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [activeDelivery, setActiveDelivery] = useState(null)
  const activeDeliveryMapCenter = useMapCenter({
    lat: activeDelivery?.current_latitude || activeDelivery?.pickup_latitude,
    lng: activeDelivery?.current_longitude || activeDelivery?.pickup_longitude,
    city: profile?.city,
  })
  const [stats, setStats] = useState({
    totalDeliveries: 0,
    pendingDeliveries: 0,
    completedToday: 0,
    earnings: 0,
    todayEarnings: 0,
    acceptanceRate: null,
    onTimePercentage: 100,
    lateDeliveries: 0,
  })

  const loadDeliveries = useCallback(async () => {
    try {
      const response = await deliveriesApi.getDriverDeliveries(profile.id)
      const deliveriesList = Array.isArray(response) ? response : (response?.data || [])
      setDeliveries(deliveriesList)

      // Separate pending requests (awaiting response) from accepted/active
      const pending = deliveriesList.filter(d => d.status === 'assigned')
      setPendingRequests(pending)

      // Find active delivery (accepted, picked_up, or on_the_way)
      const active = deliveriesList.find(d => ['accepted', 'picked_up', 'on_the_way'].includes(d.status))
      setActiveDelivery(active)

      const deliveredDeliveries = deliveriesList.filter(d => COMPLETED_DELIVERY_STATUSES.includes(d.status))
      const nonLateDelivered = deliveredDeliveries.filter(d => !d.is_late)
      const today = new Date()
      const todayDelivered = deliveredDeliveries.filter(d => {
        const dt = new Date(d.delivered_at || d.completed_at)
        return dt.toDateString() === today.toDateString()
      })
      const todayEarnings = todayDelivered.reduce((sum, d) => sum + Number(d.delivery_price || 0), 0)
      const totalResponded = deliveriesList.filter(d => d.status !== 'assigned').length
      const totalAssigned = deliveriesList.length
      const acceptanceRate = totalAssigned > 0
        ? Math.round((totalResponded / totalAssigned) * 100)
        : null

      setStats({
        totalDeliveries: profile?.total_deliveries || 0,
        pendingDeliveries: pending.length,
        completedToday: todayDelivered.length,
        earnings: deliveredDeliveries.reduce((sum, d) => sum + Number(d.delivery_price || 0), 0),
        todayEarnings,
        acceptanceRate,
        onTimePercentage: deliveredDeliveries.length > 0
          ? ((nonLateDelivered.length / deliveredDeliveries.length) * 100).toFixed(0)
          : 100,
        lateDeliveries: deliveriesList.filter(d => d.is_late).length,
      })
    } catch (error) {
      logger.error('Error loading deliveries:', error)
    } finally {
      setLoading(false)
    }
  }, [profile.id, profile?.total_deliveries])
  
  useEffect(() => {
    loadDeliveries()

    // Initialize realtime service
    realtimeService.initialize()

    // Subscribe to real-time delivery updates for existing deliveries
    const unsubscribe1 = realtimeService.subscribeToDeliveries(
      profile.id,
      (payload) => {
        logger.info('Realtime delivery update:', payload)
        loadDeliveries()
      }
    )

    // ✅ Subscribe to NEW delivery requests (unassigned deliveries)
    const unsubscribe2 = realtimeService.subscribeToNewDeliveryRequests(
      (payload) => {
        logger.info('New delivery request:', payload)
        toast.success(t('driver.dashboard.newDeliveryRequest', '🆕 New delivery request available!'), {
          duration: 5000,
          icon: '🚚',
        })
        loadDeliveries()
      }
    )

    return () => {
      unsubscribe1()
      unsubscribe2()
    }
  }, [loadDeliveries, profile.id, t])

  useEffect(() => {
    if (profile?.id && profile?.vendor_search_done === false) {
      navigate('/driver/vendor-preferences')
    }
  }, [navigate, profile?.id, profile?.vendor_search_done])
  
  
  if (loading) {
    return <LoadingSpinner size="lg" />
  }
  
  return (
    <div data-testid="page-loaded">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Driver Dashboard 🚚
        </h1>
        <p className="text-gray-500 mt-1">
          {profile?.first_name} {profile?.last_name} • {profile?.vehicle_type}
        </p>
      </div>

      {/* Availability Toggle */}
      <div className="mb-6">
        <DriverAvailabilityToggle />
      </div>

      {!profile?.has_preferred_vendor && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate('/driver/vendor-preferences')}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-right hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
                <ShoppingBagIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{t('driver.dashboard.vendorSetup', 'Preferred Vendor Setup')}</p>
                <p className="text-xs text-gray-500">{t('driver.dashboard.vendorSetupDesc', 'Choose whether to work with a fixed vendor.')}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-6">{t('driver.dashboard.vendorSetupHint', 'Change your preferences or start a vendor partnership.')}</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/driver/find-vendor')}
            className="rounded-2xl border border-gray-200 bg-white p-5 text-right hover:border-green-400 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center">
                <UsersIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{t('driver.dashboard.findVendor', 'Find a Vendor')}</p>
                <p className="text-xs text-gray-500">{t('driver.dashboard.findVendorDesc', 'Browse vendors and send partnership requests.')}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-6">{t('driver.dashboard.findVendorHint', 'The link is confirmed once the vendor accepts.')}</p>
          </button>
        </div>
      )}

      <PartnershipRequests currentUserId={profile?.id} currentRole="driver" className="mb-6" />
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="stats-cards">
        <Card className="p-5">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalDeliveries}</p>
          <p className="text-sm text-gray-500">{t('driver.dashboard.stats.totalDeliveries', 'Total Deliveries')}</p>
        </Card>

        <Card className="p-5">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center mb-3">
            <ClockIcon className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.completedToday}</p>
          <p className="text-sm text-gray-500">{t('driver.dashboard.stats.completedToday', 'Completed Today')}</p>
        </Card>

        <Card className="p-5">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
            <BanknotesIcon className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">{formatPrice(stats.todayEarnings)}</p>
          <p className="text-sm text-gray-500">{t('driver.dashboard.stats.todayEarnings', "Today's Earnings")}</p>
        </Card>

        <Card className="p-5">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
            <TruckIcon className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {stats.acceptanceRate !== null ? `${stats.acceptanceRate}%` : '—'}
          </p>
          <p className="text-sm text-gray-500">{t('driver.dashboard.stats.acceptanceRate', 'Acceptance Rate')}</p>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card className="p-5 mb-6 bg-gradient-to-r from-green-50 to-blue-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('driver.dashboard.performance', 'Performance')}</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-green-600">{stats.onTimePercentage}%</p>
            <p className="text-xs text-gray-600">{t('driver.dashboard.stats.onTimeRate', 'On-Time Rate')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{stats.lateDeliveries}</p>
            <p className="text-xs text-gray-600">{t('driver.dashboard.stats.lateDeliveries', 'Late Deliveries')}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600">{Number(profile?.driver_rating || 0).toFixed(1)}</p>
            <p className="text-xs text-gray-600">{t('driver.dashboard.stats.rating', 'Rating')} ⭐</p>
          </div>
        </div>
      </Card>
      
      {/* Pending Delivery Requests */}
      {pendingRequests.length > 0 && (
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-amber-500" />
              Pending Delivery Requests ({pendingRequests.length})
            </h3>
            <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full font-medium">
              Action Required
            </span>
          </div>

          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <DeliveryRequestCard
                key={request.id}
                request={request}
                onAccept={() => {
                  setPendingRequests(prev => prev.filter(r => r.id !== request.id))
                  loadDeliveries()
                }}
                onReject={() => {
                  setPendingRequests(prev => prev.filter(r => r.id !== request.id))
                }}
              />
            ))}
          </div>
        </Card>
      )}
      {activeDelivery && (
        <Card className="p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active Delivery</h3>
            <div className="flex items-center gap-2">
              {activeDelivery.is_late && (
                <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  Running Late
                </span>
              )}
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${DELIVERY_STATUS_COLORS[activeDelivery.status] || 'bg-gray-100 text-gray-700'}`}>
                {DELIVERY_STATUS_DEFAULT_LABELS[activeDelivery.status] || activeDelivery.status}
              </span>
            </div>
          </div>

          {/* ETA Alert */}
          {activeDelivery.estimated_delivery_time && (
            <div className={`p-4 mb-4 rounded-lg border-2 ${
              activeDelivery.is_late 
                ? 'bg-red-50 border-red-200' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center gap-2">
                <ClockIcon className={`w-5 h-5 ${activeDelivery.is_late ? 'text-red-600' : 'text-blue-600'}`} />
                <div>
                  <p className={`text-sm font-semibold ${activeDelivery.is_late ? 'text-red-900' : 'text-blue-900'}`}>
                    {activeDelivery.is_late ? '⚠️ Delayed!' : '⏱️ Estimated Delivery Time'}
                  </p>
                  <p className={`text-xs ${activeDelivery.is_late ? 'text-red-700' : 'text-blue-700'}`}>
                    {activeDelivery.is_late 
                      ? 'You are running behind schedule. Please expedite.'
                      : `Expected: ${new Date(activeDelivery.estimated_delivery_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <MapPinIcon className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Pickup from</p>
                    <p className="font-medium">{activeDelivery.order?.vendor?.store_name || 'Vendor'}</p>
                    <p className="text-sm text-gray-500">{activeDelivery.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPinIcon className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Deliver to</p>
                    <p className="font-medium">{activeDelivery.order?.buyer?.first_name} {activeDelivery.order?.buyer?.last_name}</p>
                    <p className="text-sm text-gray-500">{activeDelivery.delivery_address}</p>
                    {activeDelivery.order?.buyer?.phone && (
                      <a
                        href={`tel:${activeDelivery.order.buyer.phone}`}
                        className="flex items-center gap-1 text-sm text-green-600 mt-1 hover:text-green-700"
                      >
                        <PhoneIcon className="w-4 h-4" />
                        {t('driver.dashboard.callBuyer', 'Call Buyer')}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                {activeDelivery.status === 'accepted' && (
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => navigate(`/driver/delivery/${activeDelivery.id}/pickup`)}
                  >
                    Mark as Picked Up
                  </Button>
                )}
                {activeDelivery.status === 'picked_up' && (
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => navigate(`/driver/delivery/${activeDelivery.id}/deliver`)}
                  >
                    Start Delivery
                  </Button>
                )}
                {activeDelivery.status === 'on_the_way' && (
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => navigate(`/driver/delivery/${activeDelivery.id}/complete`)}
                  >
                    Mark as Delivered
                  </Button>
                )}
              </div>
            </div>
            
            <Map
              center={activeDeliveryMapCenter}
              zoom={13}
              markers={[
                {
                  lat: activeDelivery.pickup_latitude,
                  lng: activeDelivery.pickup_longitude,
                  popup: 'Pickup Location'
                },
                {
                  lat: activeDelivery.delivery_latitude,
                  lng: activeDelivery.delivery_longitude,
                  popup: 'Delivery Location'
                },
                ...(activeDelivery.current_latitude ? [{
                  lat: activeDelivery.current_latitude,
                  lng: activeDelivery.current_longitude,
                  popup: 'Your Location'
                }] : [])
              ]}
              height="300px"
            />
          </div>
        </Card>
      )}
      
      {/* Deliveries List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Delivery History
        </h3>

        {deliveries.filter(d => COMPLETED_DELIVERY_STATUSES.includes(d.status)).length === 0 ? (
          <div className="text-center py-12">
            <TruckIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No completed deliveries yet</p>
            <p className="text-sm text-gray-400 mt-1">Stay online and accept delivery requests to start building your history</p>
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries
              .filter(d => COMPLETED_DELIVERY_STATUSES.includes(d.status))
              .slice(0, 10)
              .map((delivery) => {
                const isOnTime = !delivery.is_late
                const eta = delivery.estimated_delivery_time
                const actual = delivery.actual_delivery_time || delivery.delivered_at

                return (
                  <div key={delivery.id} className={`p-4 rounded-xl border-2 ${
                    isOnTime ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{delivery.delivery_number}</p>
                        <p className="text-sm text-gray-500">
                          {delivery.order?.vendor?.store_name || 'Vendor'} → {delivery.order?.buyer?.first_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          isOnTime ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isOnTime ? '✓ On Time' : '⚠ Late'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {eta && (
                        <span>ETA: {new Date(eta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      )}
                      {actual && (
                        <span>Actual: {new Date(actual).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      )}
                      {delivery.delivery_price && (
                        <span className="text-green-600 font-semibold">
                          Earned: {formatPrice(delivery.delivery_price)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </Card>
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const DriverDashboardWithErrorBoundary = () => (
  <ErrorBoundary componentName="DriverDashboard">
    <DriverDashboard />
  </ErrorBoundary>
)

export default DriverDashboardWithErrorBoundary
