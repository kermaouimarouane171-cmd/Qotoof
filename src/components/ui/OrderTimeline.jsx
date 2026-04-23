import { useState, useEffect } from 'react'
import { CheckCircleIcon, ClockIcon, TruckIcon, XCircleIcon } from '@heroicons/react/24/solid'
import { orderTimelineApi } from '@/services/favorites'
import { logger } from '@/utils/logger'

const OrderTimeline = ({ orderId }) => {
  const [timeline, setTimeline] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTimeline = async () => {
      try {
        const data = await orderTimelineApi.getByOrder(orderId)
        setTimeline(data || [])
      } catch (error) {
        logger.error('Error loading timeline:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTimeline()

    // Subscribe to timeline updates
    const subscription = orderTimelineApi.subscribe(orderId, (payload) => {
      setTimeline(prev => [...prev, payload.new])
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [orderId])

  const getStatusIcon = (status) => {
    if (status.includes('rejected') || status.includes('failed') || status.includes('cancelled')) {
      return <XCircleIcon className="w-5 h-5 text-red-500" />
    }
    if (status.includes('delivered')) {
      return <CheckCircleIcon className="w-5 h-5 text-green-500" />
    }
    if (status.includes('driver') || status.includes('on_the_way') || status.includes('picked_up')) {
      return <TruckIcon className="w-5 h-5 text-blue-500" />
    }
    return <ClockIcon className="w-5 h-5 text-yellow-500" />
  }

  const getStatusLabel = (status) => {
    const labels = {
      'pending': 'Order Placed',
      'vendor_accepted': 'Vendor Accepted',
      'vendor_rejected': 'Order Rejected',
      'driver_assigned': 'Driver Assigned',
      'driver_accepted': 'Driver Accepted',
      'driver_picked_up': 'Picked Up',
      'on_the_way': 'On the Way',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled',
      'delivery_unassigned': 'Waiting for Driver',
      'delivery_assigned': 'Driver Assigned',
      'delivery_accepted': 'Driver Accepted Delivery',
      'delivery_picked_up': 'Driver Picked Up',
      'delivery_on_the_way': 'Driver On the Way',
      'delivery_delivered': 'Delivery Completed',
      'delivery_failed': 'Delivery Failed'
    }
    return labels[status] || status
  }

  const formatDateTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleString([], { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No timeline information available</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {timeline.map((entry, index) => (
        <div key={entry.id} className="flex gap-4">
          {/* Timeline Line */}
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
              {getStatusIcon(entry.status)}
            </div>
            {index < timeline.length - 1 && (
              <div className="w-0.5 flex-1 bg-gray-200 my-2"></div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="font-semibold text-gray-900 text-sm">
                {getStatusLabel(entry.status)}
              </h4>
              {entry.description && (
                <p className="text-xs text-gray-600 mt-1">{entry.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {formatDateTime(entry.created_at)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default OrderTimeline
