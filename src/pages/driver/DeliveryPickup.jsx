import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deliveriesApi } from '@/services/deliveries'
import { Card, LoadingSpinner, Button, Map } from '@/components/ui'
import { hasStageCapture } from '@/services/legalCameraService'
import { formatPrice } from '@/utils/currency'
import {
  MapPinIcon,
  PhoneIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const DeliveryPickupPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [delivery, setDelivery] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [driverLoadingCaptured, setDriverLoadingCaptured] = useState(false)
  const [vendorReleaseCaptured, setVendorReleaseCaptured] = useState(false)
  
  useEffect(() => {
    loadDelivery()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  
  const loadDelivery = async () => {
    try {
      const data = await deliveriesApi.getById(id)
      setDelivery(data)
      const [driverLoading, vendorRelease] = await Promise.all([
        hasStageCapture({ orderId: data.order_id, deliveryId: data.id, captureStage: 'driver_loading' }),
        hasStageCapture({ orderId: data.order_id, captureStage: 'vendor_release' }),
      ])
      setDriverLoadingCaptured(driverLoading)
      setVendorReleaseCaptured(vendorRelease)
    } catch (_error) {
      toast.error(t('driver.deliveryPickup.loadFailed', 'Failed to load delivery'))
      navigate('/driver/dashboard')
    } finally {
      setLoading(false)
    }
  }
  
  const handleMarkPickedUp = async () => {
    setSubmitting(true)
    try {
      await deliveriesApi.markPickedUp(id)
      toast.success(t('driver.deliveryPickup.pickupSuccess', 'Order marked as picked up!'))
      navigate(`/driver/delivery/${id}/deliver`)
    } catch (_error) {
      toast.error(t('driver.deliveryPickup.pickupFailed', 'Failed to update status'))
    } finally {
      setSubmitting(false)
    }
  }
  
  if (loading) {
    return <LoadingSpinner size="lg" />
  }
  
  if (!delivery) {
    return null
  }
  
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/driver/dashboard')}
          className="p-2 rounded-xl hover:bg-gray-100"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('driver.deliveryPickup.title', 'Pickup Order')}</h1>
          <p className="text-gray-500">{delivery.delivery_number}</p>
        </div>
      </div>
      
      {/* Vendor Info */}
      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('driver.deliveryPickup.pickupLocation', 'Pickup Location')}</h3>

        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <MapPinIcon className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-lg">
              {delivery.order?.vendor?.store_name || t('driver.deliveryPickup.vendor', 'Vendor')}
            </p>
            <p className="text-gray-600 mt-1">{delivery.pickup_address}</p>
            <p className="text-gray-500">{delivery.order?.vendor?.city}</p>

            <button className="flex items-center gap-2 mt-3 text-green-600 font-medium">
              <PhoneIcon className="w-5 h-5" />
              {t('driver.deliveryPickup.callVendor', 'Call Vendor')}: {delivery.order?.vendor?.phone}
            </button>
          </div>
        </div>
        
        {/* Map */}
        <Map
          center={[delivery.pickup_latitude || 33.5731, delivery.pickup_longitude || -7.5898]}
          zoom={15}
          markers={[
            {
              lat: delivery.pickup_latitude,
              lng: delivery.pickup_longitude,
              popup: delivery.order?.vendor?.store_name || 'Pickup Location'
            }
          ]}
          height="300px"
        />
      </Card>
      
      {/* Order Details */}
      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('driver.deliveryPickup.orderDetails', 'Order Details')}</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500">{t('driver.deliveryPickup.orderNumber', 'Order Number')}</span>
            <span className="font-medium">{delivery.order?.order_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t('driver.deliveryPickup.totalValue', 'Total Value')}</span>
            <span className="font-bold text-green-600">{formatPrice(delivery.order?.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t('driver.deliveryPickup.deliverTo', 'Deliver to')}</span>
            <span className="font-medium">
              {delivery.order?.buyer?.first_name} {delivery.order?.buyer?.last_name}
            </span>
          </div>
        </div>
      </Card>

      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">التوثيق القانوني قبل الاستلام</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
            <span className="text-gray-600">تسليم البائع للسائق</span>
            <span className={`font-medium ${vendorReleaseCaptured ? 'text-green-700' : 'text-amber-700'}`}>
              {vendorReleaseCaptured ? 'موثق' : 'غير موثق بعد'}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
            <span className="text-gray-600">تحميل السائق للبضاعة</span>
            <span className={`font-medium ${driverLoadingCaptured ? 'text-green-700' : 'text-red-700'}`}>
              {driverLoadingCaptured ? 'موثق' : 'مطلوب قبل المتابعة'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/orders/${delivery.order?.id || delivery.order_id}/condition?stage=driver_loading&next=${encodeURIComponent(`/driver/delivery/${id}/pickup`)}`)}
            className="btn-outline w-full"
          >
            فتح الكاميرا القانونية للتحميل
          </button>
        </div>
      </Card>

      {/* Action Button */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleMarkPickedUp}
        isLoading={submitting}
        disabled={!driverLoadingCaptured}
        leftIcon={<CheckCircleIcon className="w-5 h-5" />}
      >
        {t('driver.deliveryPickup.confirmPickup', 'Confirm Pickup')}
      </Button>
    </div>
  )
}

export default DeliveryPickupPage
