/**
 * 📍 Location Picker Component
 * Auto-detect + geocoding search + map click for delivery address.
 * Uses Nominatim (OpenStreetMap, no API key).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MapPinIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon,
  MagnifyingGlassIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import Map from './Map'
import { logger } from '@/utils/logger'

// ─── Nominatim geocoding helper ───────────────────────────
async function nominatimSearch(query) {
  const params = new URLSearchParams({
    q: `${query}, Morocco`,
    format: 'json',
    limit: 5,
    countrycodes: 'ma',
    addressdetails: 1,
  })
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error('geocoding failed')
  return res.json()
}

async function nominatimReverse(lat, lng) {
  const params = new URLSearchParams({ lat, lon: lng, format: 'json', addressdetails: 1 })
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    { headers: { Accept: 'application/json' } }
  )
  if (!res.ok) return null
  return res.json()
}
// ──────────────────────────────────────────────────────────

const LocationPicker = ({
  value = {},
  onChange,
  city,
  className = '',
  required = true,
}) => {
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState(null)
  const [locationSelected, setLocationSelected] = useState(!!value?.lat && !!value?.lng)
  const [showMapPrompt, setShowMapPrompt] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const searchTimerRef = useRef(null)

  // Auto-detect user location
  const detectMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setDetectError('المتصفح لا يدعم تحديد الموقع')
      return
    }

    setDetecting(true)
    setDetectError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setDetecting(false)
        setDetectError(null)

        // Reverse geocode to get address string
        try {
          const geo = await nominatimReverse(latitude, longitude)
          const address = geo?.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
          onChange({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy), source: 'gps', address })
          setSearchQuery(address)
        } catch {
          onChange({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy), source: 'gps', address: '' })
        }
        setLocationSelected(true)
      },
      (error) => {
        setDetecting(false)
        setLocationSelected(false)

        switch (error.code) {
          case error.PERMISSION_DENIED:
            setDetectError('تم رفض إذن الوصول للموقع. يرجى السماح بالوصول من إعدادات المتصفح')
            break
          case error.POSITION_UNAVAILABLE:
            setDetectError('الموقع غير متاح. يرجى التحقق من إعدادات GPS')
            break
          case error.TIMEOUT:
            setDetectError('انتهت مهلة تحديد الموقع. يرجى المحاولة مرة أخرى')
            break
          default:
            setDetectError('حدث خطأ أثناء تحديد الموقع')
        }

        logger.error('Geolocation error:', error)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
    )
  }, [onChange])

  // Handle manual location selection from map (click)
  const handleMapLocationSelect = useCallback(async (coords) => {
    setLocationSelected(true)
    setDetectError(null)
    try {
      const geo = await nominatimReverse(coords.lat, coords.lng)
      const address = geo?.display_name || `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
      onChange({ lat: coords.lat, lng: coords.lng, accuracy: null, source: 'manual', address })
      setSearchQuery(address)
    } catch {
      onChange({ lat: coords.lat, lng: coords.lng, accuracy: null, source: 'manual', address: '' })
    }
  }, [onChange])

  // Address search with debounce
  const handleSearchInput = (e) => {
    const v = e.target.value
    setSearchQuery(v)
    setSearchResults([])
    setSearchError(null)
    clearTimeout(searchTimerRef.current)
    if (v.trim().length < 3) return
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await nominatimSearch(v)
        setSearchResults(data)
        if (data.length === 0) setSearchError('لم يتم العثور على نتائج')
      } catch {
        setSearchError('فشل البحث، تحقق من الاتصال')
      } finally {
        setSearching(false)
      }
    }, 500)
  }

  const handleSelectResult = (result) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    const address = result.display_name
    onChange({ lat, lng, accuracy: null, source: 'search', address })
    setSearchQuery(address)
    setSearchResults([])
    setLocationSelected(true)
    setDetectError(null)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setSearchError(null)
  }

  // Show map prompt when city is selected but no precise location
  useEffect(() => {
    if (city && !locationSelected) {
      setShowMapPrompt(true)
    }
  }, [city, locationSelected])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <MapPinIcon className="w-5 h-5 text-green-600" />
          {required && <span className="text-red-500">*</span>}
          موقع التسليم الدقيق
        </p>
        {locationSelected && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircleIcon className="w-4 h-4" />
            تم تحديد الموقع
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <div className="flex items-center gap-2 border-2 border-gray-300 rounded-xl bg-white px-3 py-2 focus-within:border-green-500 transition-colors">
          {searching ? (
            <ArrowPathIcon className="w-5 h-5 text-gray-400 animate-spin flex-shrink-0" />
          ) : (
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchInput}
            placeholder="ابحث عن عنوانك (شارع، حي، مدينة)..."
            className="flex-1 outline-none text-sm bg-transparent text-gray-700 placeholder-gray-400"
            dir="rtl"
          />
          {searchQuery && (
            <button type="button" onClick={handleClearSearch} aria-label="مسح البحث">
              <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {(searchResults.length > 0 || searchError) && (
          <ul
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
          >
            {searchError && (
              <li role="option" aria-selected="false" className="px-4 py-3 text-sm text-gray-500 text-center">{searchError}</li>
            )}
            {searchResults.map((r) => (
              <li key={r.place_id} role="option" aria-selected="false">
                <button
                  type="button"
                  className="w-full text-right px-4 py-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-800 flex items-start gap-2 transition-colors"
                  onClick={() => handleSelectResult(r)}
                >
                  <MapPinIcon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Auto-detect GPS button */}
      <button
        type="button"
        onClick={detectMyLocation}
        disabled={detecting}
        className={`w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border-2 text-sm transition-all ${
          detecting
            ? 'border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed'
            : 'border-dashed border-gray-300 bg-gray-50 text-gray-600 hover:border-green-500 hover:bg-green-50 hover:text-green-700'
        }`}
      >
        {detecting ? (
          <><ArrowPathIcon className="w-4 h-4 animate-spin" /><span>جاري تحديد موقعك...</span></>
        ) : (
          <><MapPinIcon className="w-4 h-4" /><span>استخدام موقعي الحالي (GPS)</span></>
        )}
      </button>

      {/* Error messages */}
      {detectError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{detectError}</p>
        </div>
      )}

      {/* Map prompt */}
      {showMapPrompt && !locationSelected && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            اخترت مدينة <strong>{city}</strong>. يرجى تحديد الموقع الدقيق على الخريطة أو عبر البحث.
          </p>
        </div>
      )}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border-2 border-gray-200">
        <Map
          center={
            locationSelected
              ? [value.lat, value.lng]
              : city
                ? getCityCenter(city)
                : [33.5731, -7.5898]
          }
          zoom={locationSelected ? 16 : city ? 13 : 12}
          markers={locationSelected ? [{ lat: value.lat, lng: value.lng, popup: value.address || 'موقع التسليم' }] : []}
          onLocationSelect={handleMapLocationSelect}
          height="280px"
          requireAuth={false}
        />
      </div>

      {/* Selected location chip */}
      {locationSelected && value?.address && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800 min-w-0">
            <p className="font-medium">الموقع المحدد</p>
            <p className="text-xs text-green-700 mt-0.5 line-clamp-2">{value.address}</p>
            <p className="text-xs font-mono text-green-600 mt-0.5" dir="ltr">
              {value.lat?.toFixed(5)}, {value.lng?.toFixed(5)}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        ابحث بالاسم أو اضغط على الخريطة أو استخدم GPS لتحديد موقع التسليم.
      </p>
    </div>
  )
}

// City centers for Morocco
const getCityCenter = (city) => {
  const cityCenters = {
    'الدار البيضاء': [33.5731, -7.5898],
    'casablanca': [33.5731, -7.5898],
    'الرباط': [34.0209, -6.8417],
    'rabat': [34.0209, -6.8417],
    'مراكش': [31.6295, -7.9811],
    'marrakech': [31.6295, -7.9811],
    'فاس': [34.0181, -5.0078],
    'fes': [34.0181, -5.0078],
    'طنجة': [35.7595, -5.8340],
    'tangier': [35.7595, -5.8340],
    'أكادير': [30.4278, -9.5981],
    'agadir': [30.4278, -9.5981],
    'مكناس': [33.8935, -5.5473],
    'meknes': [33.8935, -5.5473],
    'وجدة': [34.6814, -1.9086],
    'oujda': [34.6814, -1.9086],
    'القنيطرة': [34.2610, -6.5802],
    'kenitra': [34.2610, -6.5802],
    'تطوان': [35.5889, -5.3626],
    'tetouan': [35.5889, -5.3626],
    'آسفي': [32.2994, -9.2372],
    'saf': [32.2994, -9.2372],
  }

  const normalizedCity = city?.toLowerCase().trim()
  return cityCenters[normalizedCity] || [33.5731, -7.5898] // Default: Casablanca
}

export default LocationPicker
