import { useState } from 'react'
import { ClockIcon, CheckCircleIcon, XCircleIcon, CalendarIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { supabase } from '@/services/supabase'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

// Flexible waiting periods based on vendor availability and product demand
const WAITING_PERIODS = [
  // Short-term (same day)
  { value: 1, label: '1 hour', description: 'Urgent - same city', type: 'hours' },
  { value: 2, label: '2 hours', description: 'Quick delivery', type: 'hours' },
  { value: 5, label: '5 hours', description: 'Within the day', type: 'hours' },
  { value: 10, label: '10 hours', description: 'End of day', type: 'hours' },
  // Medium-term (1-3 days)
  { value: 1, label: '1 day', description: 'Next day delivery', type: 'days' },
  { value: 2, label: '2 days', description: 'Standard delivery', type: 'days' },
  { value: 3, label: '3 days', description: 'Relaxed timeline', type: 'days' },
  // Long-term (up to a week)
  { value: 5, label: '5 days', description: 'Remote areas', type: 'days' },
  { value: 7, label: '1 week', description: 'Maximum wait', type: 'days' },
]

// High demand apology message
const HIGH_DEMAND_MESSAGE = `Thank you for your interest in this product! Unfortunately, it's currently in very high demand and we're running low on stock. We expect to have more available soon. We apologize for any inconvenience and appreciate your patience.`

const VendorWaitResponse = ({ notificationId, orderId, productId, buyerId, productName, onClose }) => {
  const [selectedPeriod, setSelectedPeriod] = useState({ value: 5, type: 'hours' })
  const [vendorMessage, setVendorMessage] = useState('')
  const [responding, setResponding] = useState(false)
  const [response, setResponse] = useState(null) // 'accepted' | 'rejected' | 'high_demand'
  const [useHighDemandMessage, setUseHighDemandMessage] = useState(false)

  const handleRespond = async (status) => {
    setResponding(true)
    try {
      let message = vendorMessage
      if (status === 'high_demand') {
        message = HIGH_DEMAND_MESSAGE + (vendorMessage ? `\n\nAdditional note: ${vendorMessage}` : '')
      }

      // Create response notification for buyer
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: buyerId,
          title: status === 'high_demand'
            ? 'Product in High Demand'
            : status === 'accepted' 
            ? 'Vendor Will Hold Your Order' 
            : 'Order Cannot Be Fulfilled',
          message: status === 'accepted'
            ? `The vendor will hold "${productName}" for ${selectedPeriod.label}. A driver will be assigned when available.`
            : status === 'high_demand'
            ? `The product "${productName}" is currently in very high demand. The vendor apologizes but cannot fulfill your request right now.`
            : `Unfortunately, the vendor cannot fulfill your request for "${productName}" at this time.`,
          type: 'delivery_wait_response',
          data: {
            order_id: orderId,
            product_id: productId,
            status,
            waiting_period_value: selectedPeriod.value,
            waiting_period_type: selectedPeriod.type,
            waiting_period_label: selectedPeriod.label,
            vendor_message: message,
          },
        })

      if (error) throw error

      // Update original notification as handled
      if (notificationId) {
        await supabase
          .from('notifications')
          .update({ read: true, data: { ...notificationId?.data, handled: true, handled_at: new Date().toISOString() } })
          .eq('id', notificationId.id)
      }

      setResponse(status)
      toast.success(status === 'accepted' ? 'Buyer will be notified' : status === 'high_demand' ? 'High demand message sent' : 'Request declined')
    } catch (error) {
      logger.error('Error responding:', error)
      toast.error('Failed to send response')
    } finally {
      setResponding(false)
    }
  }

  if (response) {
    return (
      <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-lg font-semibold text-green-800 mb-2">
          {response === 'high_demand' ? 'High Demand Message Sent!' : 'Response Sent!'}
        </h3>
        <p className="text-sm text-green-700">
          {response === 'high_demand' 
            ? 'The buyer has been informed about the high demand situation.'
            : 'The buyer has been notified of your decision.'}
        </p>
        {onClose && (
          <button onClick={onClose} className="btn-primary mt-4">
            Close
          </button>
        )}
      </div>
    )
  }

  // Group periods by type
  const hoursPeriods = WAITING_PERIODS.filter(p => p.type === 'hours')
  const daysPeriods = WAITING_PERIODS.filter(p => p.type === 'days')

  return (
    <div className="p-6 bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <ClockIcon className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">Buyer Wants to Wait for Delivery</h3>
          <p className="text-sm text-gray-600">
            A buyer is interested in "{productName}" and is willing to wait for a driver.
          </p>
        </div>
      </div>

      {/* Response Options */}
      <div className="space-y-4">
        {/* Accept with waiting period */}
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
          <h4 className="font-medium text-green-800 mb-3 flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5" />
            Accept & Set Waiting Period
          </h4>

          {/* Same Day (Hours) */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <ClockIcon className="w-4 h-4" />
              Same Day Delivery
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {hoursPeriods.map((period) => (
                <label
                  key={`hours-${period.value}`}
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-all text-center ${
                    selectedPeriod.value === period.value && selectedPeriod.type === 'hours'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="waitingPeriod"
                    value={period.value}
                    checked={selectedPeriod.value === period.value && selectedPeriod.type === 'hours'}
                    onChange={() => setSelectedPeriod({ value: period.value, type: 'hours' })}
                    className="hidden"
                  />
                  <p className="font-semibold text-gray-900">{period.label}</p>
                  <p className="text-xs text-gray-500">{period.description}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Multi-Day */}
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <CalendarIcon className="w-4 h-4" />
              Multi-Day Delivery
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {daysPeriods.map((period) => (
                <label
                  key={`days-${period.value}`}
                  className={`p-3 border-2 rounded-lg cursor-pointer transition-all text-center ${
                    selectedPeriod.value === period.value && selectedPeriod.type === 'days'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="waitingPeriod"
                    value={period.value}
                    checked={selectedPeriod.value === period.value && selectedPeriod.type === 'days'}
                    onChange={() => setSelectedPeriod({ value: period.value, type: 'days' })}
                    className="hidden"
                  />
                  <p className="font-semibold text-gray-900">{period.label}</p>
                  <p className="text-xs text-gray-500">{period.description}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Vendor Message */}
          <textarea
            value={vendorMessage}
            onChange={(e) => setVendorMessage(e.target.value)}
            placeholder="Add a message to the buyer (optional)..."
            className="w-full p-3 border border-gray-200 rounded-lg text-sm resize-none h-20 mb-3 focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />

          <button
            onClick={() => handleRespond('accepted')}
            disabled={responding}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {responding ? 'Sending...' : `Accept - Hold for ${selectedPeriod.label}`}
          </button>
        </div>

        {/* High Demand Apology */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <h4 className="font-medium text-amber-800 mb-2 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5" />
            Product in High Demand
          </h4>
          <p className="text-sm text-amber-700 mb-3">
            If this product is running low due to high demand, let the buyer know politely.
          </p>

          {/* Preview message */}
          <div className="p-3 bg-white rounded-lg mb-3 text-sm text-gray-600 italic">
            "{HIGH_DEMAND_MESSAGE.slice(0, 100)}..."
          </div>

          <textarea
            value={vendorMessage}
            onChange={(e) => setVendorMessage(e.target.value)}
            placeholder="Add a personal note (optional)..."
            className="w-full p-3 border border-amber-200 rounded-lg text-sm resize-none h-16 mb-3 focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />

          <button
            onClick={() => handleRespond('high_demand')}
            disabled={responding}
            className="w-full py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {responding ? 'Sending...' : 'Send High Demand Apology'}
          </button>
        </div>

        {/* Decline */}
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
            <XCircleIcon className="w-5 h-5" />
            Unable to Fulfill
          </h4>
          <p className="text-sm text-red-700 mb-3">
            If you cannot fulfill this order for any other reason, let the buyer know.
          </p>
          <textarea
            value={vendorMessage}
            onChange={(e) => setVendorMessage(e.target.value)}
            placeholder="Reason for declining (optional)..."
            className="w-full p-3 border border-red-200 rounded-lg text-sm resize-none h-16 mb-3 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          <button
            onClick={() => handleRespond('rejected')}
            disabled={responding}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {responding ? 'Sending...' : 'Decline Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default VendorWaitResponse
