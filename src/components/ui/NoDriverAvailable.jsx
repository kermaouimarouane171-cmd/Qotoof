import { useState } from 'react'
import { ExclamationTriangleIcon, TruckIcon, BellIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/services/supabase'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const NoDriverAvailable = ({ orderId, vendorId, productId, productName, onNotifyVendor }) => {
  const [notifying, setNotifying] = useState(false)
  const [notified, setNotified] = useState(false)
  const [message, setMessage] = useState('')

  const handleNotifyVendor = async () => {
    setNotifying(true)
    try {
      // Create notification for vendor
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: vendorId,
          title: 'Buyer Wants to Wait for Product',
          message: `A buyer is interested in "${productName}" but no driver is currently available. They're willing to wait for delivery.`,
          type: 'delivery_wait_request',
          data: {
            order_id: orderId,
            product_id: productId,
            buyer_message: message,
          },
        })

      if (error) throw error

      setNotified(true)
      toast.success('Vendor has been notified!')
      if (onNotifyVendor) onNotifyVendor()
    } catch (error) {
      logger.error('Error notifying vendor:', error)
      toast.error('Failed to notify vendor')
    } finally {
      setNotifying(false)
    }
  }

  if (notified) {
    return (
      <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-lg font-semibold text-green-800 mb-2">Vendor Notified!</h3>
        <p className="text-sm text-green-700 mb-4">
          The vendor has been notified of your interest. They will respond with a delivery timeline soon.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-green-600">
          <ClockIcon className="w-4 h-4" />
          <span>Expected response within 24 hours</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
      {/* Icon & Title */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-amber-900 mb-1">No Drivers Currently Available</h3>
          <p className="text-sm text-amber-700">
            We sincerely apologize, but there are no delivery drivers available at this moment.
          </p>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-white rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <TruckIcon className="w-5 h-5 text-gray-400" />
          <p className="text-sm text-gray-600">
            All our delivery drivers are currently busy or offline.
          </p>
        </div>
        <p className="text-sm text-gray-500">
          We understand this is inconvenient and we're working to expand our delivery network.
        </p>
      </div>

      {/* Options */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-green-600" />
            Still interested in this product?
          </h4>
          <p className="text-sm text-gray-600 mb-3">
            Let the vendor know you'd like to wait for delivery. They'll respond with an estimated delivery time.
          </p>

          {/* Buyer Message */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message to the vendor (optional)..."
            className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none h-20 mb-3 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />

          <button
            onClick={handleNotifyVendor}
            disabled={notifying}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {notifying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Sending...
              </>
            ) : (
              <>
                <BellIcon className="w-4 h-4" />
                Notify Vendor I'm Willing to Wait
              </>
            )}
          </button>
        </div>

        {/* Waiting Period Info */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <ClockIcon className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">What happens next?</p>
              <ul className="space-y-1 text-xs">
                <li>• Vendor receives your request</li>
                <li>• Vendor responds with estimated delivery time</li>
                <li>• You'll be notified when a driver becomes available</li>
                <li>• Typical wait time: 1-3 business days</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NoDriverAvailable
