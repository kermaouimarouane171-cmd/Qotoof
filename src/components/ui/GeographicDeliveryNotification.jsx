import { useState, useEffect } from 'react'
import { driverMatchingService } from '@/services/driverMatching'
import Card from './Card'
import LoadingSpinner from './LoadingSpinner'
import { formatPrice } from '@/utils/currency'
import { supabase } from '@/services/supabase'
import {
  TruckIcon,
  MapPinIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  BellIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

/**
 * Geographic Delivery Notification Component
 * Shows driver availability and delivery options
 */
const GeographicDeliveryNotification = ({
  pickupLocation,
  deliveryLocation,
  orderId,
  vendorId,
  buyerId,
  onDriverSelected,
  className = '',
}) => {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('checking') // checking, driver_found, no_driver, other_region
  const [drivers, setDrivers] = useState([])
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [deliveryFee, setDeliveryFee] = useState(null)
  const [notifyWhenAvailable, setNotifyWhenAvailable] = useState(false)

  useEffect(() => {
    if (!pickupLocation?.lat || !pickupLocation?.lng) return

    checkDriverAvailability()
  }, [pickupLocation])

  const checkDriverAvailability = async () => {
    setLoading(true)

    try {
      // Find nearest drivers
      const { drivers: foundDrivers, success } = await driverMatchingService.findNearestDrivers(
        pickupLocation,
        { limit: 5 }
      )

      if (!success || foundDrivers.length === 0) {
        setStatus('no_driver')
        setDrivers([])
        return
      }

      setDrivers(foundDrivers)

      const nearestDriver = foundDrivers[0]

      if (nearestDriver.is_in_same_region) {
        setStatus('driver_found')
        setSelectedDriver(nearestDriver)
      } else {
        setStatus('other_region')
        setSelectedDriver(nearestDriver)
      }

      // Calculate delivery fee
      const distance = driverMatchingService.calculateDistance(
        pickupLocation.lat,
        pickupLocation.lng,
        deliveryLocation?.lat || pickupLocation.lat,
        deliveryLocation?.lng || pickupLocation.lng
      )

      const fee = driverMatchingService.calculateDeliveryFee(
        distance,
        nearestDriver.is_in_same_region
      )

      setDeliveryFee(fee)
    } catch (error) {
      logger.error('Check driver availability error:', error)
      setStatus('no_driver')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDriver = async (driver) => {
    setSelectedDriver(driver)

    try {
      // Create delivery request
      const result = await driverMatchingService.createDeliveryRequest({
        orderId,
        vendorId,
        buyerId,
        pickupCity: pickupLocation.city,
        pickupLat: pickupLocation.lat,
        pickupLng: pickupLocation.lng,
        deliveryCity: deliveryLocation?.city,
        deliveryLat: deliveryLocation?.lat,
        deliveryLng: deliveryLocation?.lng,
      })

      if (result.success) {
        toast.success('تم تعيين السائق بنجاح')
        onDriverSelected?.(result)
      } else {
        toast.error('فشل في تعيين السائق')
      }
    } catch (error) {
      logger.error('Select driver error:', error)
      toast.error('حدث خطأ أثناء تعيين السائق')
    }
  }

  const handleNotifyWhenAvailable = async () => {
    setNotifyWhenAvailable(true)

    try {
      // Save notification request to database
      const { error } = await supabase.from('driver_availability_requests').insert({
        order_id: orderId,
        vendor_id: vendorId,
        buyer_id: buyerId,
        pickup_city: pickupLocation.city,
        pickup_lat: pickupLocation.lat,
        pickup_lng: pickupLocation.lng,
        delivery_city: deliveryLocation?.city,
        delivery_lat: deliveryLocation?.lat,
        delivery_lng: deliveryLocation?.lng,
        status: 'pending',
        created_at: new Date().toISOString(),
      })

      if (error) throw error

      toast.success('سنعلمك عند توفر سائق في جهتك')
      logger.info('Driver availability request saved successfully')
    } catch (error) {
      logger.error('Failed to save driver availability request:', error)
      toast.error('حدث خطأ أثناء تسجيل الطلب. حاول مرة أخرى.')
      setNotifyWhenAvailable(false)
    }
  }

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex items-center justify-center gap-3">
          <LoadingSpinner size="sm" />
          <p className="text-gray-600">جاري البحث عن سائق...</p>
        </div>
      </Card>
    )
  }

  // No driver available
  if (status === 'no_driver') {
    const region = driverMatchingService.getRegionFromCoords(
      pickupLocation.lat,
      pickupLocation.lng
    )

    return (
      <Card className={`p-6 border-2 border-red-200 bg-red-50 ${className}`}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <XCircleIcon className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              لا يوجد سائق متاح
            </h3>
            <p className="text-red-700 mb-4">
              عذراً، لا يوجد سائق متاح في {region?.name_ar || 'جهتك'} حالياً
            </p>

            <div className="space-y-3">
              <button
                onClick={handleNotifyWhenAvailable}
                disabled={notifyWhenAvailable}
                className="btn-outline w-full flex items-center justify-center gap-2"
              >
                <BellIcon className="w-5 h-5" />
                {notifyWhenAvailable ? 'تم التسجيل' : 'أعلمني عند توفر سائق'}
              </button>

              <div className="text-sm text-red-600 bg-white p-3 rounded-lg">
                <p className="font-medium mb-1">اقتراحات:</p>
                <ul className="space-y-1 text-xs">
                  <li>• اختر نقطة استلام في مدينة قريبة</li>
                  <li>• تواصل مع البائع لترتيب التوصيل</li>
                  <li>• حاول مرة أخرى لاحقاً</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  // Driver from other region
  if (status === 'other_region' && selectedDriver) {
    return (
      <Card className={`p-6 border-2 border-yellow-200 bg-yellow-50 ${className}`}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              سائق من جهة أخرى
            </h3>
            <p className="text-yellow-700 mb-2">
              لا يوجد سائق في نفس الجهة، لكن وجدنا سائق قريب
            </p>
          </div>
        </div>

        {/* Driver Info */}
        <div className="bg-white rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <span className="text-white font-bold">
                  {selectedDriver.driver_name?.[0] || 'س'}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedDriver.driver_name}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPinIcon className="w-4 h-4" />
                  {selectedDriver.city} - {selectedDriver.region_name}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">المسافة</p>
              <p className="font-bold text-gray-900">{selectedDriver.distance_km} كم</p>
            </div>
          </div>

          {/* Delivery Fee */}
          {deliveryFee && (
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">رسوم التوصيل:</span>
                <span className="font-bold text-gray-900">{formatPrice(deliveryFee.total_fee)}</span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>الرسوم الأساسية:</span>
                  <span>{formatPrice(deliveryFee.base_fee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>رسوم المسافة ({deliveryFee.distance_km} كم):</span>
                  <span>{formatPrice(deliveryFee.distance_fee)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => handleSelectDriver(selectedDriver)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <TruckIcon className="w-5 h-5" />
            قبول هذا السائق
          </button>
          <button
            onClick={handleNotifyWhenAvailable}
            className="btn-outline w-full flex items-center justify-center gap-2"
          >
            <BellIcon className="w-5 h-5" />
            الانتظار حتى يتوفر سائق في جهتي
          </button>
        </div>
      </Card>
    )
  }

  // Driver found in same region
  if (status === 'driver_found' && selectedDriver) {
    return (
      <Card className={`p-6 border-2 border-green-200 bg-green-50 ${className}`}>
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircleIcon className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              ✅ سائق متاح في جهتك
            </h3>
            <p className="text-green-700">
              وجدنا سائق قريب منك في نفس الجهة
            </p>
          </div>
        </div>

        {/* Driver Info */}
        <div className="bg-white rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <span className="text-white font-bold">
                  {selectedDriver.driver_name?.[0] || 'س'}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedDriver.driver_name}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPinIcon className="w-4 h-4" />
                  {selectedDriver.city}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">المسافة</p>
              <p className="font-bold text-green-600">{selectedDriver.distance_km} كم</p>
            </div>
          </div>

          {/* Estimated Time */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t text-sm text-gray-600">
            <ClockIcon className="w-4 h-4" />
            <span>وقت التوصيل المتوقع: {selectedDriver.estimated_hours} ساعة</span>
          </div>

          {/* Delivery Fee */}
          {deliveryFee && (
            <div className="border-t pt-3 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">رسوم التوصيل:</span>
                <span className="text-xl font-bold text-green-600">
                  {formatPrice(deliveryFee.total_fee)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Other Available Drivers */}
        {drivers.length > 1 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">سائقون آخرون متاحون:</p>
            <div className="space-y-2">
              {drivers.slice(1, 4).map((driver, index) => (
                <button
                  key={driver.driver_id || index}
                  onClick={() => handleSelectDriver(driver)}
                  className="w-full flex items-center justify-between p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-sm font-bold">{driver.driver_name?.[0] || 'س'}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{driver.driver_name}</p>
                      <p className="text-xs text-gray-500">{driver.city}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{driver.distance_km} كم</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action */}
        <button
          onClick={() => handleSelectDriver(selectedDriver)}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <TruckIcon className="w-5 h-5" />
          تأكيد الطلب مع هذا السائق
        </button>
      </Card>
    )
  }

  return null
}

export default GeographicDeliveryNotification
