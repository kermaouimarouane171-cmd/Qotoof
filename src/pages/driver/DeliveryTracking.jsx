import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { deliveriesApi } from '@/services/deliveries'
import { Card, LoadingSpinner } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import LiveDriverMap from '@/components/maps/LiveDriverMap'
import { driverLocationService } from '@/services/driverLocationService'
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  TruckIcon,
  ArrowRightCircleIcon,
  SignalIcon,
  WifiIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

// Configuration
const LOCATION_SEND_INTERVAL = 10000 // 10 seconds
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY = 2000 // 2 seconds
const GOOD_ACCURACY_THRESHOLD = 50 // meters
const POOR_ACCURACY_THRESHOLD = 200 // meters

const DriverDeliveryTracking = () => {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [delivery, setDelivery] = useState(null)
  const [currentLocation, setCurrentLocation] = useState(null)
  const [tracking, setTracking] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [signalQuality, setSignalQuality] = useState(null) // 'good' | 'medium' | 'poor' | null
  const [lastSyncTime, setLastSyncTime] = useState(null)
  const [syncFailed, setSyncFailed] = useState(false)
  const watchIdRef = useRef(null)
  const intervalIdRef = useRef(null)
  const retryTimeoutRef = useRef(null)
  const locationCacheRef = useRef(null) // Cache latest location for interval sends

  const loadDelivery = useCallback(async () => {
    try {
      const data = await deliveriesApi.getById(id)
      setDelivery({
        ...data,
        customer: data.order?.buyer || null,
      })
    } catch (error) {
      logger.error('Load delivery error:', error)
      toast.error('Failed to load delivery')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDelivery()
    return () => stopTracking()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadDelivery])

  const sendLocationToBackend = useCallback(async (location, retryCount = 0) => {
    try {
      const { latitude, longitude, speed, accuracy } = location

      const speedKmh = speed ? Number((speed * 3.6).toFixed(1)) : null
      const accuracyMeters = accuracy ? Math.round(accuracy) : null

      await driverLocationService.broadcastDriverLocation({
        driverId: user.id,
        deliveryId: id,
        orderId: delivery?.order?.id || delivery?.order_id || null,
        vendorId: delivery?.order?.vendor_id || null,
        buyerId: delivery?.order?.buyer_id || null,
        latitude,
        longitude,
        speedKmh,
        accuracyMeters,
        broadcastStatus: 'active',
        metadata: { source: 'driver-delivery-tracking' },
      })

      await deliveriesApi.updateLocation(id, latitude, longitude)

      // Success
      setLastSyncTime(new Date())
      setSyncFailed(false)
      logger.info(`Location synced successfully (attempt ${retryCount + 1})`)
    } catch (error) {
      logger.error(`Send location error (attempt ${retryCount + 1}):`, error)

      // Retry logic
      if (retryCount < MAX_RETRY_ATTEMPTS) {
        retryTimeoutRef.current = setTimeout(() => {
          sendLocationToBackend(location, retryCount + 1)
        }, RETRY_DELAY * (retryCount + 1)) // Exponential backoff
      } else {
        setSyncFailed(true)
        logger.error('Max retry attempts reached for location update')
      }
    }
  }, [delivery?.order?.buyer_id, delivery?.order?.id, delivery?.order?.vendor_id, delivery?.order_id, id, user.id])

  const calculateSignalQuality = useCallback((accuracy) => {
    if (!accuracy) return 'poor'
    if (accuracy <= GOOD_ACCURACY_THRESHOLD) return 'good'
    if (accuracy <= POOR_ACCURACY_THRESHOLD) return 'medium'
    return 'poor'
  }, [])

  const startTracking = async () => {
    if (!navigator.geolocation) {
      toast.error(t('driver.tracking.geolocationNotSupported', 'Geolocation is not supported by your browser'))
      return
    }

    // Check permission first
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' })

      if (permissionStatus.state === 'denied') {
        toast.error(
          t('driver.tracking.permissionDenied', 'Location permission denied. Please enable location access in your browser settings.'),
          { duration: 8000 }
        )
        return
      }
    } catch {
      // permissions.query not supported, proceed with watchPosition
    }

    setTracking(true)
    setSyncFailed(false)
    toast.success(t('driver.tracking.started', 'Location tracking started'))

    driverLocationService.setBroadcastState({
      driverId: user.id,
      deliveryId: id,
      orderId: delivery?.order?.id || delivery?.order_id || null,
      vendorId: delivery?.order?.vendor_id || null,
      buyerId: delivery?.order?.buyer_id || null,
      eventType: 'started',
      metadata: { source: 'driver-delivery-tracking' },
    }).catch((error) => {
      logger.warn('Failed to mark live broadcast as started:', error)
    })

    // Start watchPosition for real-time updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, speed, accuracy } = position.coords
        const location = { latitude, longitude, speed, accuracy }

        // Update UI
        setCurrentLocation(location)
        locationCacheRef.current = location

        // Calculate and update signal quality
        const quality = calculateSignalQuality(accuracy)
        setSignalQuality(quality)

        // Send to backend immediately
        sendLocationToBackend(location)
      },
      (error) => {
        logger.error('Geolocation error:', error)

        let errorMessage = t('driver.tracking.locationFailed', 'Failed to get location')
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = t('driver.tracking.permissionDenied', 'Location permission denied. Please enable location access.')
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = t('driver.tracking.positionUnavailable', 'Location information unavailable.')
            break
          case error.TIMEOUT:
            errorMessage = t('driver.tracking.locationTimeout', 'Location request timed out. Please try again.')
            break
        }

        toast.error(errorMessage, { duration: 5000 })
        setTracking(false)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0, // Don't use cached positions
        timeout: 10000,
      }
    )

    // Start interval-based sending as backup (ensures updates even if watchPosition stalls)
    intervalIdRef.current = setInterval(() => {
      if (locationCacheRef.current) {
        sendLocationToBackend(locationCacheRef.current)
      } else {
        // If no cached location, try to get current position
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude, speed, accuracy } = position.coords
            const location = { latitude, longitude, speed, accuracy }
            setCurrentLocation(location)
            locationCacheRef.current = location
            setSignalQuality(calculateSignalQuality(accuracy))
            sendLocationToBackend(location)
          },
          (error) => {
            logger.warn('Interval getCurrentPosition error:', error)
          },
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 8000,
          }
        )
      }
    }, LOCATION_SEND_INTERVAL)
  }

  const stopTracking = (eventType = 'stopped') => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current)
      intervalIdRef.current = null
    }
    if (retryTimeoutRef.current !== null) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    setTracking(false)
    setSignalQuality(null)
    setSyncFailed(false)

    if (user?.id && (tracking || currentLocation)) {
      driverLocationService.setBroadcastState({
        driverId: user.id,
        deliveryId: id,
        orderId: delivery?.order?.id || delivery?.order_id || null,
        vendorId: delivery?.order?.vendor_id || null,
        buyerId: delivery?.order?.buyer_id || null,
        eventType,
        latitude: currentLocation?.latitude || null,
        longitude: currentLocation?.longitude || null,
        metadata: { source: 'driver-delivery-tracking' },
      }).catch((error) => {
        logger.warn('Failed to mark live broadcast as stopped:', error)
      })
    }
  }

  const updateStatus = async (newStatus) => {
    setUpdatingStatus(true)
    try {
      if (newStatus === 'picked_up') {
        await deliveriesApi.markPickedUp(id)
      } else if (newStatus === 'on_the_way') {
        await deliveriesApi.markOnTheWay(id)
      } else if (newStatus === 'delivered') {
        await deliveriesApi.markDelivered(id)
      } else {
        const { data, error } = await supabase
          .from('deliveries')
          .update({ status: newStatus })
          .eq('id', id)
          .eq('driver_id', user.id)
          .select('id')
          .maybeSingle()

        if (error) throw error
        if (!data) {
          throw new Error('Delivery not found')
        }
      }

      setDelivery({ ...delivery, status: newStatus })
      toast.success(t('driver.tracking.statusUpdated', 'Status updated to: {{status}}', { status: newStatus }))

      // Auto-stop tracking when delivered or cancelled
      if (newStatus === 'delivered' || newStatus === 'cancelled') {
        stopTracking(newStatus === 'delivered' ? 'completed' : 'stopped')
        if (newStatus === 'delivered') {
          toast.success(t('driver.tracking.deliveryCompleted', 'Delivery completed! Redirecting to history...'))
          navigate('/driver/history')
        }
      }
    } catch (error) {
      logger.error('Update status error:', error)
      toast.error(t('driver.tracking.statusUpdateFailed', 'Failed to update status'))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const callCustomer = () => {
    if (delivery?.customer?.phone) {
      window.open(`tel:${delivery.customer.phone}`, '_self')
    }
  }

  const openInGoogleMaps = () => {
    if (delivery?.delivery_latitude && delivery?.delivery_longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${delivery.delivery_latitude},${delivery.delivery_longitude}`
      window.open(url, '_blank')
    }
  }

  const openInWaze = () => {
    if (delivery?.delivery_latitude && delivery?.delivery_longitude) {
      const url = `https://waze.com/ul?ll=${delivery.delivery_latitude},${delivery.delivery_longitude}&navigate=yes`
      window.open(url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!delivery) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">{t('driver.tracking.deliveryNotFound', 'Delivery not found')}</p>
        <button onClick={() => navigate('/driver/active')} className="btn-primary mt-4">
          {t('driver.tracking.backToActive', 'Back to Active Deliveries')}
        </button>
      </div>
    )
  }

  const statusSteps = [
    { key: 'accepted', label: t('driver.tracking.statuses.accepted', 'Accepted'), icon: CheckCircleIcon },
    { key: 'picked_up', label: t('driver.tracking.statuses.pickedUp', 'Picked Up'), icon: TruckIcon },
    { key: 'on_the_way', label: t('driver.tracking.statuses.onTheWay', 'On The Way'), icon: ArrowRightCircleIcon },
    { key: 'delivered', label: t('driver.tracking.statuses.delivered', 'Delivered'), icon: CheckCircleIcon },
  ]

  const currentStepIndex = statusSteps.findIndex(s => s.key === delivery.status)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Delivery Tracking</h1>
        <p className="text-gray-600">Order #{delivery.order_id?.substring(0, 8)}</p>
      </div>

      {/* Status Progress */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between">
          {statusSteps.map((step, index) => {
            const Icon = step.icon
            const isActive = index <= currentStepIndex
            const isCurrent = index === currentStepIndex
            
            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                  } ${isCurrent ? 'ring-4 ring-green-200' : ''}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={`text-xs mt-2 ${
                    isActive ? 'text-green-600 font-medium' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index < statusSteps.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 ${
                    index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Map & Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Map */}
          <Card className="p-4">
            <LiveDriverMap
              driverId={user?.id}
              orderId={delivery?.order?.id || delivery?.order_id || null}
              deliveryId={id}
              pickupLocation={
                delivery.pickup_latitude && delivery.pickup_longitude
                  ? {
                      lat: delivery.pickup_latitude,
                      lng: delivery.pickup_longitude,
                      label: delivery.pickup_address || 'Vendor Location',
                    }
                  : null
              }
              deliveryLocation={
                delivery.delivery_latitude && delivery.delivery_longitude
                  ? {
                      lat: delivery.delivery_latitude,
                      lng: delivery.delivery_longitude,
                      label: delivery.delivery_address || 'Customer Location',
                    }
                  : null
              }
              title={t('driver.tracking.liveMap', 'Live Delivery Map')}
              height="400px"
            />
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={startTracking}
              disabled={tracking}
              className="btn-primary disabled:opacity-50"
            >
              {tracking ? t('driver.tracking.trackingActive', '🔴 Tracking Active') : t('driver.tracking.startTracking', '▶️ Start Tracking')}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={openInGoogleMaps}
                className="btn-secondary text-xs"
              >
                🗺️ Google
              </button>
              <button
                onClick={openInWaze}
                className="btn-secondary text-xs"
              >
                🚗 Waze
              </button>
            </div>
            <button
              onClick={callCustomer}
              className="btn-outline"
            >
              📞 {t('driver.tracking.callCustomer', 'Call Customer')}
            </button>
            <button
              onClick={() => updateStatus('cancelled')}
              disabled={updatingStatus}
              className="btn-outline text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50"
            >
              ❌ {t('driver.tracking.cancel', 'Cancel')}
            </button>
          </div>

          {/* Status Update Buttons */}
          <div className="space-y-3">
            {delivery.status === 'accepted' && (
              <button
                onClick={() => updateStatus('picked_up')}
                disabled={updatingStatus}
                className="btn-primary w-full disabled:opacity-50"
              >
                {updatingStatus ? t('driver.tracking.updating', 'Updating...') : t('driver.tracking.confirmPickup', '📦 Confirm Pickup')}
              </button>
            )}
            {delivery.status === 'picked_up' && (
              <button
                onClick={() => updateStatus('on_the_way')}
                disabled={updatingStatus}
                className="btn-primary w-full disabled:opacity-50"
              >
                {updatingStatus ? t('driver.tracking.updating', 'Updating...') : t('driver.tracking.startDelivery', '🚚 Start Delivery')}
              </button>
            )}
            {delivery.status === 'on_the_way' && (
              <button
                onClick={() => updateStatus('delivered')}
                disabled={updatingStatus}
                className="btn-primary w-full bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {updatingStatus ? t('driver.tracking.updating', 'Updating...') : t('driver.tracking.markDelivered', '✅ Mark as Delivered')}
              </button>
            )}
          </div>
        </div>

        {/* Right: Delivery Details */}
        <div className="space-y-6">
          {/* Customer Info */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Customer</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">
                  {delivery.customer?.first_name} {delivery.customer?.last_name}
                </p>
              </div>
              {delivery.customer?.phone && (
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{delivery.customer.phone}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Delivery Address</p>
                <p className="font-medium">{delivery.delivery_address || 'N/A'}</p>
              </div>
            </div>
          </Card>

          {/* Delivery Info */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Delivery Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Distance</p>
                <p className="font-medium">{delivery.distance_km || delivery.estimated_distance_km || 'N/A'} km</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Delivery Price</p>
                <p className="text-xl font-bold text-green-600">{delivery.delivery_price || '0.00'} MAD</p>
              </div>
              {delivery.estimated_delivery_time && (
                <div>
                  <p className="text-sm text-gray-500">Estimated Time</p>
                  <p className="font-medium flex items-center gap-1">
                    <ClockIcon className="w-4 h-4" />
                    {new Date(delivery.estimated_delivery_time).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Tracking Status */}
          <Card className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Tracking</h3>
            <div className={`p-3 rounded-lg ${
              tracking ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
            }`}>
              <div className="flex items-center gap-2">
                {tracking ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-700 font-medium">Live Tracking Active</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-gray-400 rounded-full" />
                    <span className="text-gray-600">Tracking Inactive</span>
                  </>
                )}
              </div>

              {/* Signal Quality Indicator */}
              {tracking && signalQuality && (
                <div className="mt-3 flex items-center gap-2">
                  {signalQuality === 'good' ? (
                    <WifiIcon className="w-4 h-4 text-green-600" />
                  ) : signalQuality === 'medium' ? (
                    <SignalIcon className="w-4 h-4 text-yellow-600" />
                  ) : (
                    <SignalIcon className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-xs font-medium ${
                    signalQuality === 'good' ? 'text-green-700' :
                    signalQuality === 'medium' ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    {signalQuality === 'good' ? 'Excellent signal' :
                     signalQuality === 'medium' ? 'Moderate signal' :
                     'Weak signal'}
                  </span>
                </div>
              )}

              {/* Sync Status */}
              {tracking && lastSyncTime && (
                <div className="mt-2 flex items-center gap-2">
                  {syncFailed ? (
                    <XCircleIcon className="w-3 h-3 text-red-500" />
                  ) : (
                    <CheckCircleIcon className="w-3 h-3 text-green-500" />
                  )}
                  <span className={`text-xs ${syncFailed ? 'text-red-600' : 'text-gray-500'}`}>
                    {syncFailed ? 'Sync failed - retrying...' : `Last sync: ${lastSyncTime.toLocaleTimeString()}`}
                  </span>
                </div>
              )}

              {currentLocation && (
                <p className="text-xs text-gray-500 mt-2 font-mono">
                  {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  {currentLocation.accuracy && ` (±${Math.round(currentLocation.accuracy)}m)`}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const DriverDeliveryTrackingWithErrorBoundary = () => (
  <ErrorBoundary componentName="DriverDeliveryTracking">
    <DriverDeliveryTracking />
  </ErrorBoundary>
)

export default DriverDeliveryTrackingWithErrorBoundary
