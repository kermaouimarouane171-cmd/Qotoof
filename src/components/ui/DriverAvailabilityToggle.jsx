import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { TruckIcon, ClockIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const DriverAvailabilityToggle = ({ onStatusChange }) => {
  const { profile, setDriverAvailability } = useAuthStore()
  const [updating, setUpdating] = useState(false)
  
  // Use profile state for availability status
  const isAvailable = profile?.is_available_for_delivery ?? false

  const handleToggle = async () => {
    setUpdating(true)
    try {
      const newStatus = !isAvailable
      
      // ✅ Use store method - single source of truth
      const result = await setDriverAvailability(newStatus)

      if (result.success) {
        if (onStatusChange) onStatusChange(newStatus)
        toast.success(newStatus ? '🟢 You are now available for deliveries!' : '🔴 You are now offline')
      } else {
        toast.error(result.error || 'Failed to update status')
      }
    } catch (error) {
      logger.error('Error updating availability:', error)
      toast.error('Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className={`p-4 rounded-xl border-2 transition-all ${
      isAvailable 
        ? 'bg-green-50 border-green-200' 
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isAvailable ? 'bg-green-100' : 'bg-gray-200'
          }`}>
            {isAvailable ? (
              <TruckIcon className="w-6 h-6 text-green-600" />
            ) : (
              <ClockIcon className="w-6 h-6 text-gray-500" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {isAvailable ? 'Available for Deliveries' : 'Currently Offline'}
            </h3>
            <p className="text-sm text-gray-500">
              {isAvailable 
                ? 'You will receive delivery requests' 
                : 'Turn on to start receiving requests'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={updating}
          className={`relative w-14 h-8 rounded-full transition-colors ${
            isAvailable ? 'bg-green-500' : 'bg-gray-300'
          } ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
            isAvailable ? 'left-7' : 'left-1'
          }`} />
        </button>
      </div>

      {/* Status indicator */}
      <div className="mt-3 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
        <span className="text-xs text-gray-500">
          {isAvailable ? 'Online - Waiting for requests' : 'Offline - No requests will be sent'}
        </span>
      </div>
    </div>
  )
}

export default DriverAvailabilityToggle
