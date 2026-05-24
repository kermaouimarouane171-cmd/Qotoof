import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deliveriesApi } from '@/services/deliveries'
import { Card, LoadingSpinner, Button, Map } from '@/components/ui'
import { hasStageCapture } from '@/services/legalCameraService'
import {
  MapPinIcon,
  PhoneIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  CameraIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const DeliveryCompletePage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [delivery, setDelivery] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [driverDropoffCaptured, setDriverDropoffCaptured] = useState(false)
  
  useEffect(() => {
    loadDelivery()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  
  const loadDelivery = async () => {
    try {
      const data = await deliveriesApi.getById(id)
      setDelivery(data)
      const hasDropoffStage = await hasStageCapture({
        orderId: data.order_id,
        deliveryId: data.id,
        captureStage: 'driver_dropoff',
      })
      setDriverDropoffCaptured(hasDropoffStage)
    } catch (_error) {
      toast.error(t('driver.deliveryComplete.loadFailed', 'Failed to load delivery'))
      navigate('/driver/dashboard')
    } finally {
      setLoading(false)
    }
  }
  
  const handleMarkDelivered = async () => {
    if (!driverDropoffCaptured) {
      toast.error('يجب توثيق مرحلة ما قبل التسليم بالكاميرا القانونية أولاً.')
      return
    }

    setSubmitting(true)
    try {
      await deliveriesApi.markDelivered(id)
      toast.success(t('driver.deliveryComplete.completeSuccess', 'Delivery completed successfully!'))
      navigate('/driver/dashboard')
    } catch (_error) {
      toast.error(t('driver.deliveryComplete.completeFailed', 'Failed to complete delivery'))
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
          <h1 className="text-2xl font-bold text-gray-900">{t('driver.deliveryComplete.title', 'Complete Delivery')}</h1>
          <p className="text-gray-500">{delivery.delivery_number}</p>
        </div>
      </div>
      
      {/* Buyer Info */}
      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('driver.deliveryComplete.deliveryLocation', 'Delivery Location')}</h3>

        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <MapPinIcon className="w-6 h-6 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-lg">
              {delivery.order?.buyer?.first_name} {delivery.order?.buyer?.last_name}
            </p>
            <p className="text-gray-600 mt-1">{delivery.delivery_address}</p>
            <p className="text-gray-500">{delivery.order?.buyer?.city}</p>

            <button className="flex items-center gap-2 mt-3 text-green-600 font-medium">
              <PhoneIcon className="w-5 h-5" />
              {t('driver.deliveryComplete.callBuyer', 'Call Buyer')}: {delivery.order?.buyer?.phone}
            </button>
          </div>
        </div>
        
        {/* Map */}
        <Map
          center={[delivery.delivery_latitude || 33.5731, delivery.delivery_longitude || -7.5898]}
          zoom={15}
          markers={[
            {
              lat: delivery.delivery_latitude,
              lng: delivery.delivery_longitude,
              popup: 'Delivery Location'
            }
          ]}
          height="300px"
        />
      </Card>
      
      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('driver.deliveryComplete.deliveryProof', 'Delivery Proof')} <span className="text-red-500">*</span>
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-600">توثيق السائق قبل التسليم</span>
            <span className={`font-medium ${driverDropoffCaptured ? 'text-green-700' : 'text-red-700'}`}>
              {driverDropoffCaptured ? 'موثق' : 'مطلوب قبل الإنهاء'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/orders/${delivery.order?.id || delivery.order_id}/condition?stage=driver_dropoff&next=${encodeURIComponent(`/driver/delivery/${id}/complete`)}`)}
            className="btn-outline w-full inline-flex items-center justify-center gap-2"
          >
            <CameraIcon className="w-5 h-5" />
            فتح الكاميرا القانونية قبل التسليم
          </button>

          <p className="text-xs text-gray-500 leading-6">
            بعد التسليم، سيظهر للمشتري خيار توثيق الاستلام النهائي من صفحة الطلب.
          </p>
        </div>
      </Card>

      {/* Complete Button */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleMarkDelivered}
        isLoading={submitting}
        disabled={!driverDropoffCaptured}
        leftIcon={<CheckCircleIcon className="w-5 h-5" />}
      >
        {t('driver.deliveryComplete.completeDelivery', 'Complete Delivery')}
      </Button>
    </div>
  )
}

export default DeliveryCompletePage
