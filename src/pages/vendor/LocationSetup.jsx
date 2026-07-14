import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Button, Map, LoadingSpinner } from '@/components/ui'
import { MapPinIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

// ============================================
// Morocco Bounds Validation
// ============================================

// Morocco approximate bounds
const MOROCCO_BOUNDS = {
  latMin: 27.5,
  latMax: 36.0,
  lngMin: -13.5,
  lngMax: -1.0,
}

const isValidMoroccoLocation = (lat, lng) => {
  return (
    lat >= MOROCCO_BOUNDS.latMin &&
    lat <= MOROCCO_BOUNDS.latMax &&
    lng >= MOROCCO_BOUNDS.lngMin &&
    lng <= MOROCCO_BOUNDS.lngMax
  )
}

// Round coordinates to 6 decimal places (~0.1m precision)
const roundCoordinate = (val) => Math.round(val * 1e6) / 1e6

const VendorLocationSetup = ({ onComplete }) => {
  const { t } = useTranslation()
  const { profile, refreshProfile } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [address, setAddress] = useState(profile?.address || profile?.store_address || '')
  const [city, setCity] = useState(profile?.city || '')
  const [isOutsideMorocco, setIsOutsideMorocco] = useState(false)
  const [reverseGeocoding, setReverseGeocoding] = useState(false)
  // Map center derived from the vendor's city (forward-geocoded) so the map
  // opens on the registration city instead of always defaulting to Casablanca.
  const [cityCenter, setCityCenter] = useState(null)

  useEffect(() => {
    // If vendor already has location, use it directly
    if (profile?.latitude && profile?.longitude) {
      setSelectedLocation({ lat: profile.latitude, lng: profile.longitude })
      return
    }

    // No coordinates yet — try to forward-geocode the city from registration
    // so the map opens centered on the vendor's city instead of Casablanca.
    const cityName = (profile?.city || '').trim()
    if (!cityName) return

    let cancelled = false
    ;(async () => {
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName + ', Morocco')}&format=json&limit=1&accept-language=ar`,
          { headers: { 'User-Agent': 'Qotoof/1.0' } }
        )
        const data = await resp.json()
        if (!cancelled && data?.[0]) {
          const lat = parseFloat(data[0].lat)
          const lng = parseFloat(data[0].lon)
          if (isValidMoroccoLocation(lat, lng)) {
            setCityCenter({ lat: roundCoordinate(lat), lng: roundCoordinate(lng) })
          }
        }
      } catch (err) {
        logger.error('Forward geocoding city failed:', err)
      }
    })()

    return () => { cancelled = true }
  }, [profile])

  const handleLocationSelect = async (latlng) => {
    const { lat, lng } = latlng

    // Check if location is within Morocco
    const isMorocco = isValidMoroccoLocation(lat, lng)
    setIsOutsideMorocco(!isMorocco)

    if (!isMorocco) {
      toast.error(t('vendor.locationSetup.moroccoBoundsError', 'يرجى اختيار موقع داخل حدود المغرب'))
      return
    }

    // Round coordinates to 6 decimal places (~0.1m precision)
    const rounded = { lat: roundCoordinate(lat), lng: roundCoordinate(lng) }
    setSelectedLocation(rounded)

    // Reverse geocode to get city name
    setReverseGeocoding(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${rounded.lat}&lon=${rounded.lng}&format=json&accept-language=ar&zoom=10&addressdetails=1`,
        { headers: { 'User-Agent': 'Qotoof/1.0' } }
      )
      const data = await response.json()

      if (data.address) {
        const addr = data.address
        // Extract city from various possible fields
        const detectedCity =
          addr.city || addr.town || addr.village || addr.municipality ||
          addr.county || addr.state || addr.province || ''

        if (detectedCity && !city) {
          setCity(detectedCity)
        }

        // Extract street address if available
        const detectedAddress =
          [addr.road, addr.house_number, addr.suburb, addr.neighbourhood]
            .filter(Boolean)
            .join(', ')

        if (detectedAddress && !address) {
          setAddress(detectedAddress)
        }
      }
    } catch (err) {
      logger.error('Reverse geocoding failed:', err)
      // Non-critical — user can still type manually
    } finally {
      setReverseGeocoding(false)
    }
  }
  
  const handleSave = async () => {
    if (!selectedLocation) {
      toast.error(t('vendor.locationSetup.selectLocationError', 'Please select your store location on the map'))
      return
    }

    if (isOutsideMorocco) {
      toast.error(t('vendor.locationSetup.moroccoBoundsError', 'يرجى اختيار موقع داخل حدود المغرب'))
      return
    }

    if (!city.trim()) {
      toast.error(t('vendor.locationSetup.enterCityError', 'Please enter your city'))
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          latitude: roundCoordinate(selectedLocation.lat),
          longitude: roundCoordinate(selectedLocation.lng),
          store_address: address.trim() || null,
          city: city.trim(),
        })
        .eq('id', profile.id)

      if (error) throw error

      await refreshProfile()
      toast.success(t('vendor.locationSetup.savedSuccess', 'Store location saved successfully!'))

      if (onComplete) {
        onComplete()
      } else {
        navigate('/vendor/dashboard')
      }
    } catch (error) {
      logger.error('Error saving location:', error)
      toast.error(t('vendor.locationSetup.saveFailed', 'Failed to save location'))
    } finally {
      setLoading(false)
    }
  }
  
  // Priority: selectedLocation > cityCenter (from registration city) > Casablanca fallback
  // Map component expects [lat, lng] array, so convert from {lat, lng} objects.
  const defaultCenter = selectedLocation
    ? [selectedLocation.lat, selectedLocation.lng]
    : cityCenter
      ? [cityCenter.lat, cityCenter.lng]
      : [33.5731, -7.5898] // Casablanca
  const defaultZoom = selectedLocation ? 15 : cityCenter ? 12 : 6
  
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPinIcon className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('vendor.locationSetup.title', 'Set Your Store Location')}</h1>
        <p className="text-gray-500 max-w-md mx-auto">
          {t('vendor.locationSetup.subtitle', 'To start selling, you need to set your store location on the map. This helps buyers find you and enables accurate delivery calculations.')}
        </p>
      </div>
      
      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">{t('vendor.locationSetup.whyRequired', 'Why is this required?')}</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• {t('vendor.locationSetup.reason1', 'Buyers can see your store location')}</li>
              <li>• {t('vendor.locationSetup.reason2', 'Accurate delivery distance calculations')}</li>
              <li>• {t('vendor.locationSetup.reason3', 'Driver assignment based on proximity')}</li>
              <li>• {t('vendor.locationSetup.reason4', 'Better search results for nearby buyers')}</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* City Field (imported from registration, editable) */}
      <div className="mb-6">
        <label className="input-label">{t('vendor.locationSetup.cityLabel', 'City *')}</label>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder={t('vendor.locationSetup.cityPlaceholder', 'e.g., Casablanca')}
          className="input"
          required
        />
        {reverseGeocoding && (
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <LoadingSpinner size="sm" /> {t('vendor.locationSetup.detectingCity', 'Detecting city from map...')}
          </p>
        )}
      </div>

      {/* Morocco Bounds Warning */}
      {isOutsideMorocco && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">{t('vendor.locationSetup.outsideMoroccoTitle', 'Location Outside Morocco')}</p>
            <p className="text-xs text-red-700 mt-1">
              {t('vendor.locationSetup.outsideMoroccoDesc', "The selected location is outside Morocco. Please click on the map within Morocco's borders.")}
            </p>
          </div>
        </div>
      )}

      {/* Prominent instruction to click on the map */}
      {!selectedLocation && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4 flex items-center gap-3">
          <MapPinIcon className="w-6 h-6 text-amber-600 flex-shrink-0 animate-bounce" />
          <div>
            <p className="text-sm font-bold text-amber-900">
              {t('vendor.locationSetup.clickInstruction', 'انقر على الخريطة لتحديد موقع متجرك بدقة')}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {t('vendor.locationSetup.clickInstructionHint', 'اضغط على المكان الذي يوجد فيه متجرك داخل المدينة. سيتم استخراج العنوان تلقائياً.')}
            </p>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="mb-6">
        <label className="input-label flex items-center gap-2">
          {t('vendor.locationSetup.storeLocationLabel', 'Store Location *')}
          {selectedLocation && (
            <span className="text-green-600 flex items-center gap-1 inline-flex">
              <CheckCircleIcon className="w-4 h-4" />
              {t('vendor.locationSetup.locationSelected', 'Location selected')}
            </span>
          )}
        </label>
        <Map
          center={defaultCenter}
          zoom={defaultZoom}
          onLocationSelect={handleLocationSelect}
          height="400px"
        />
      </div>

      {/* Extracted address card — shows after clicking on the map */}
      {selectedLocation && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900 mb-1">
                {t('vendor.locationSetup.detectedAddress', 'العنوان المحدد')}
              </p>
              {reverseGeocoding ? (
                <p className="text-sm text-green-700 flex items-center gap-1">
                  <LoadingSpinner size="sm" /> {t('vendor.locationSetup.detectingAddress', 'جاري استخراج العنوان...')}
                </p>
              ) : address ? (
                <p className="text-sm text-green-800">{address}</p>
              ) : (
                <p className="text-sm text-green-600">
                  {t('vendor.locationSetup.noAddressDetected', 'تم تحديد الموقع. يمكنك حفظ الموقع الآن.')}
                </p>
              )}
              <p className="text-xs text-green-500 mt-2 font-mono">
                {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </p>
              <button
                type="button"
                onClick={() => { setSelectedLocation(null); setAddress('') }}
                className="mt-2 text-xs text-amber-700 underline hover:text-amber-900"
              >
                {t('vendor.locationSetup.reselectLocation', 'إعادة التحديد')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleSave}
        isLoading={loading}
        disabled={!selectedLocation || !city.trim()}
        leftIcon={<MapPinIcon className="w-5 h-5" />}
      >
        {t('vendor.locationSetup.saveButton', 'Save Store Location')}
      </Button>
    </div>
  )
}

export default VendorLocationSetup
