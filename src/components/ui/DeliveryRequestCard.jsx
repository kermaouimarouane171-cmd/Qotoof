import { useState } from 'react'
import { MapPinIcon, ClockIcon, CurrencyDollarIcon, CheckCircleIcon, XCircleIcon, TruckIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/services/supabase'
import { deliveriesApi } from '@/modules/delivery'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const DeliveryRequestCard = ({ request, onAccept, onReject }) => {
  const [responding, setResponding] = useState(false)
  const [response, setResponse] = useState(null) // 'accepted' | 'rejected'

  const handleResponse = async (status) => {
    setResponding(true)
    try {
      if (status === 'accepted') {
        await deliveriesApi.acceptDelivery(request.id, request.driver_id)

        toast.success('✅ Delivery accepted!')
      } else {
        await deliveriesApi.rejectDelivery(request.id, 'Driver declined delivery request')

        // Notify system to find another driver
        await supabase
          .from('notifications')
          .insert({
            user_id: request.vendor_id,
            title: 'Driver Declined Delivery',
            message: `A driver declined the delivery request for order #${request.order_id?.slice(0, 8) || 'N/A'}. Looking for another driver...`,
            type: 'driver_declined',
          })

        toast.info('Delivery request declined')
      }

      setResponse(status)
      if (status === 'accepted' && onAccept) onAccept(request)
      if (status === 'rejected' && onReject) onReject(request)
    } catch (error) {
      logger.error('Error responding to request:', error)
      toast.error('Failed to respond')
    } finally {
      setResponding(false)
    }
  }

  if (response) {
    return (
      <div className={`p-4 rounded-xl border-2 ${
        response === 'accepted' 
          ? 'bg-green-50 border-green-200' 
          : 'bg-gray-50 border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          {response === 'accepted' ? (
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
          ) : (
            <XCircleIcon className="w-8 h-8 text-gray-400" />
          )}
          <div>
            <p className="font-medium text-gray-900">
              {response === 'accepted' ? 'Delivery Accepted!' : 'Request Declined'}
            </p>
            <p className="text-sm text-gray-500">
              {response === 'accepted' 
                ? 'You can now proceed to pickup the order.' 
                : 'The system will look for another driver.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-white border-2 border-blue-200 rounded-xl hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <TruckIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">New Delivery Request</h3>
            <p className="text-xs text-gray-500">Order #{request.order_id?.slice(0, 8) || 'N/A'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
          <ClockIcon className="w-3.5 h-3.5" />
          <span>New</span>
        </div>
      </div>

      {/* Delivery Details */}
      <div className="space-y-3 mb-4">
        {/* Pickup Location */}
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Pickup from</p>
            <p className="text-sm font-medium text-gray-900">{request.vendor_name || 'Vendor Location'}</p>
            {request.pickup_address && (
              <p className="text-xs text-gray-500">{request.pickup_address}</p>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="w-0.5 h-4 bg-gray-300" />
        </div>

        {/* Delivery Location */}
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPinIcon className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Deliver to</p>
            <p className="text-sm font-medium text-gray-900">{request.buyer_name || 'Customer'}</p>
            {request.delivery_address && (
              <p className="text-xs text-gray-500">{request.delivery_address}</p>
            )}
            {request.delivery_city && (
              <p className="text-xs text-gray-500">{request.delivery_city}</p>
            )}
          </div>
        </div>
      </div>

      {/* Order Value */}
      {request.order_total && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-4">
          <div className="flex items-center gap-2">
            <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-600">Order Value</span>
          </div>
          <span className="font-semibold text-gray-900">MAD {request.order_total?.toFixed(2)}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => handleResponse('rejected')}
          disabled={responding}
          className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {responding ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
          ) : (
            <>
              <XCircleIcon className="w-5 h-5" />
              Decline
            </>
          )}
        </button>
        <button
          onClick={() => handleResponse('accepted')}
          disabled={responding}
          className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {responding ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <>
              <CheckCircleIcon className="w-5 h-5" />
              Accept
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default DeliveryRequestCard
