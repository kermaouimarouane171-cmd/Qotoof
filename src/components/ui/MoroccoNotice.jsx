import { MapPinIcon, InformationCircleIcon, GlobeAltIcon } from '@heroicons/react/24/outline'

const MoroccoNotice = ({ variant = 'default' }) => {
  if (variant === 'banner') {
    return (
      <div className="bg-gradient-to-r from-red-600 to-green-600 text-white py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm">
          <MapPinIcon className="w-4 h-4" />
          <span className="font-medium">🇲🇦 Qotoof is available exclusively in Morocco</span>
          <GlobeAltIcon className="w-4 h-4 ml-2" />
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <MapPinIcon className="w-3.5 h-3.5 text-green-500" />
        <span>Available exclusively in 🇲🇦 Morocco</span>
      </div>
    )
  }

  // Default: full notice card
  return (
    <div className="p-4 bg-gradient-to-r from-green-50 via-white to-red-50 border border-green-200 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <MapPinIcon className="w-5 h-5 text-green-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <span className="text-lg">🇲🇦</span>
            Available Exclusively in Morocco
          </h3>
          <p className="text-sm text-gray-600 mb-2">
            Qotoof is currently available only for users in Morocco. 
            All vendors, buyers, and drivers must be located in Morocco.
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <InformationCircleIcon className="w-3.5 h-3.5" />
              Moroccan National ID (CIN) required
            </span>
            <span className="flex items-center gap-1">
              <InformationCircleIcon className="w-3.5 h-3.5" />
              Prices in Moroccan Dirham (MAD)
            </span>
            <span className="flex items-center gap-1">
              <InformationCircleIcon className="w-3.5 h-3.5" />
              Delivery within Morocco only
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MoroccoNotice
