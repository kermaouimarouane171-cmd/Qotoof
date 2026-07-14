import { useEffect, useMemo, useState } from 'react'
import { Map, LoadingSpinner } from '@/components/ui'
import { useMapCenter } from '@/hooks/useMapCenter'
import { driverLocationService } from '@/modules/delivery'
import { MapPinIcon, SignalIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

const formatTime = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('ar-MA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const LiveDriverMap = ({
  driverId,
  orderId = null,
  deliveryId = null,
  pickupLocation = null,
  deliveryLocation = null,
  height = '320px',
  title = 'الموقع الحي للسائق',
  className = '',
  staleAfterMs = 45000,
}) => {
  const [loading, setLoading] = useState(Boolean(driverId || orderId || deliveryId))
  const [location, setLocation] = useState(null)
  const [liveStatus, setLiveStatus] = useState('connecting')
  const [clockTick, setClockTick] = useState(Date.now())

  useEffect(() => {
    if (!driverId && !orderId && !deliveryId) {
      setLocation(null)
      setLoading(false)
      setLiveStatus('idle')
      return undefined
    }

    let active = true
    setLoading(true)

    const loadLocation = async () => {
      try {
        const currentLocation = await driverLocationService.getCurrentTrackedLocation({
          driverId,
          orderId,
          deliveryId,
        })
        if (!active) return
        setLocation(currentLocation)
        setLiveStatus(currentLocation ? 'live' : 'waiting')
      } catch {
        if (!active) return
        setLiveStatus('error')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadLocation()

    const unsubscribe = driverLocationService.subscribeToTrackedLocation({
      driverId,
      orderId,
      deliveryId,
    }, (nextLocation) => {
      if (!active) return
      setLocation(nextLocation)
      setLiveStatus(nextLocation ? 'live' : 'waiting')
      setLoading(false)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [deliveryId, driverId, orderId])

  useEffect(() => {
    if (!location?.lastUpdated) return undefined

    const intervalId = setInterval(() => {
      setClockTick(Date.now())
    }, 15000)

    return () => clearInterval(intervalId)
  }, [location?.lastUpdated])

  const isStale = useMemo(() => {
    if (!location?.lastUpdated) return false
    const lastUpdated = new Date(location.lastUpdated).getTime()
    if (Number.isNaN(lastUpdated)) return false
    return clockTick - lastUpdated > staleAfterMs
  }, [clockTick, location?.lastUpdated, staleAfterMs])

  const markers = useMemo(() => {
    const items = []

    if (pickupLocation?.lat && pickupLocation?.lng) {
      items.push({
        lat: pickupLocation.lat,
        lng: pickupLocation.lng,
        popup: pickupLocation.label || 'نقطة الاستلام',
      })
    }

    if (deliveryLocation?.lat && deliveryLocation?.lng) {
      items.push({
        lat: deliveryLocation.lat,
        lng: deliveryLocation.lng,
        popup: deliveryLocation.label || 'نقطة التسليم',
      })
    }

    if (location?.lat && location?.lng) {
      items.push({
        lat: location.lat,
        lng: location.lng,
        popup: 'موقع السائق الحالي',
      })
    }

    return items
  }, [deliveryLocation, location, pickupLocation])

  const center = useMapCenter({
    lat: location?.lat || pickupLocation?.lat || deliveryLocation?.lat,
    lng: location?.lng || pickupLocation?.lng || deliveryLocation?.lng,
  })

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <MapPinIcon className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>

        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
          isStale
            ? 'bg-amber-100 text-amber-700'
            : liveStatus === 'live'
            ? 'bg-green-100 text-green-700'
            : liveStatus === 'error'
            ? 'bg-red-100 text-red-700'
            : 'bg-gray-100 text-gray-700'
        }`}>
          <SignalIcon className="w-4 h-4" />
          {isStale
            ? 'آخر تحديث قديم'
            : liveStatus === 'live'
            ? 'بث مباشر'
            : liveStatus === 'error'
            ? 'تعذر تحديث الموقع'
            : 'بانتظار الإشارة'}
        </div>
      </div>

      {isStale && location?.lastUpdated && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            آخر موقع متوفر يعود إلى {formatTime(location.lastUpdated)}. قد يكون السائق خارج التغطية مؤقتاً أو أوقف البث.
          </span>
        </div>
      )}

      {loading ? (
        <div className="h-72 flex items-center justify-center rounded-2xl border border-gray-200 bg-white">
          <LoadingSpinner size="lg" />
        </div>
      ) : markers.length === 0 ? (
        <div className="h-72 rounded-2xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm text-gray-500">
          لا توجد بيانات موقع لعرضها بعد.
        </div>
      ) : (
        <Map center={center} zoom={13} markers={markers} height={height} />
      )}

      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500">
        <span>آخر تحديث: {formatTime(location?.lastUpdated)}</span>
        <span>حالة البث: {location?.broadcastStatus || 'idle'}</span>
        <span>الدقة: {location?.accuracyMeters ? `${location.accuracyMeters}m` : 'غير متوفرة'}</span>
      </div>
    </div>
  )
}

export default LiveDriverMap