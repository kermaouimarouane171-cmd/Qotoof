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
import { getCityCoordinates } from '@/utils/cityCoordinates'
import { useMapCenter } from '@/hooks/useMapCenter'
import { logger } from '@/utils/logger'

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── Nominatim geocoding helper ───────────────────────────
async function nominatimSearch(query) {
  const params = new URLSearchParams({
    q: `${query}, Morocco`,
    format: 'json',
    limit: 5,
    countrycodes: 'ma',
    addressdetails: 1,
  })
  const res = await fetchJsonWithTimeout(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error('geocoding failed')
  return res.json()
}

async function nominatimReverse(lat, lng) {
  const params = new URLSearchParams({ lat, lon: lng, format: 'json', addressdetails: 1 })
  const res = await fetchJsonWithTimeout(
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
  autoDetect = false,
}) => {
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState(null)
  const [locationSelected, setLocationSelected] = useState(!!value?.lat && !!value?.lng)
  const pickerMapCenter = useMapCenter({
    lat: locationSelected ? value?.lat : null,
    lng: locationSelected ? value?.lng : null,
    city,
  })
  const [showMapPrompt, setShowMapPrompt] = useState(false)
  const autoDetectCalledRef = useRef(false)
  const cityAutoSetRef = useRef('')

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
      } catch (error) {
        setSearchError(
          error?.name === 'AbortError'
            ? 'استغرق البحث وقتاً أطول من المتوقع. يمكنك تحديد الموقع من الخريطة مباشرة في الأسفل.'
            : 'فشل البحث. تحقق من الاتصال أو حدد الموقع من الخريطة مباشرة.'
        )
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
    } else {
      setShowMapPrompt(false)
    }
  }, [city, locationSelected])

  // Auto-center map and set initial marker when city changes
  useEffect(() => {
    if (!city) {
      cityAutoSetRef.current = ''
      return
    }
    if (locationSelected) return
    if (cityAutoSetRef.current === city) return

    const coords = getCityCoordinates(city)
    if (coords) {
      cityAutoSetRef.current = city
      onChange({ lat: coords.lat, lng: coords.lng, source: 'city_center', address: city, city })
      setSearchQuery(city)
    }
  }, [city, locationSelected, onChange])

  // Auto-detect GPS on first mount if no location already set and no city provided
  // Only when explicitly enabled via autoDetect prop to avoid browser permission policy warnings
  useEffect(() => {
    if (!autoDetect) return
    if (autoDetectCalledRef.current) return
    if (locationSelected) return
    if (city) return
    if (!navigator.geolocation) return
    autoDetectCalledRef.current = true
    // Small delay to let the map render first
    const timer = setTimeout(() => detectMyLocation(), 600)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDetect, city, locationSelected])

  return (
    <div className={`space-y-4 ${className}`} data-testid="location-picker">
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
            placeholder="ابحث عن الحي، الشارع، أو أقرب نقطة معروفة..."
            data-testid="location-search-input"
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
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto"
          >
            {searchError && (
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
              <li role="option" aria-selected="false" className="px-4 py-3 text-sm text-gray-500 text-center">{searchError}</li>
            )}
            {searchResults.map((r) => (
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
              <li key={r.place_id} role="option" aria-selected="false">
                <button
                  type="button"
                  data-testid="location-search-result"
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
        data-testid="location-detect-btn"
        className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
          detecting
            ? 'border-green-300 bg-green-50 text-green-600 cursor-not-allowed'
            : locationSelected && value?.source === 'gps'
              ? 'border-green-400 bg-green-50 text-green-700'
              : 'border-dashed border-gray-300 bg-gray-50 text-gray-600 hover:border-green-500 hover:bg-green-50 hover:text-green-700'
        }`}
      >
        {detecting ? (
          <>
            <ArrowPathIcon className="w-5 h-5 animate-spin" />
            <span>جاري تحديد موقعك بواسطة GPS...</span>
          </>
        ) : locationSelected && value?.source === 'gps' ? (
          <>
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <span>تم تحديد موقعك تلقائياً</span>
            {value?.accuracy && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">دقة ±{value.accuracy}م</span>
            )}
          </>
        ) : (
          <>
            <MapPinIcon className="w-5 h-5" />
            <span>تحديد موقعي تلقائياً (GPS)</span>
          </>
        )}
      </button>

      {/* Error messages */}
      {detectError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <p>{detectError}</p>
            <p className="mt-1 text-xs text-red-600">يمكنك المتابعة بتحديد الموقع يدويًا من الخريطة أو بالبحث عن العنوان.</p>
          </div>
        </div>
      )}

      {/* Map prompt — shown when city is set but user hasn't precisely selected yet */}
      {showMapPrompt && !locationSelected && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p>
              حددنا مدينة <strong>{city}</strong> على الخريطة بشكل تقريبي.
            </p>
            <p className="mt-1">
              من فضلك ابحث عن الحي أو حرّك العلامة إلى موقعك الدقيق حتى يتم التوصيل بشكل صحيح.
            </p>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border-2 border-gray-200 relative">
        {/* Tap hint overlay — shown only when not yet selected */}
        {!locationSelected && !detecting && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[400] pointer-events-none">
            <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
              👇 اضغط على مكانك في الخريطة
            </span>
          </div>
        )}
        <Map
          center={pickerMapCenter}
          zoom={locationSelected ? 16 : city ? 13 : 12}
          markers={[]}
          onLocationSelect={handleMapLocationSelect}
          accuracyRadius={locationSelected && value?.source === 'gps' ? value?.accuracy : null}
          height="300px"
          requireAuth={false}
        />
      </div>

      {/* Selected location chip */}
      {locationSelected && (
        <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-xl" data-testid="location-selected-state">
          <div className="w-9 h-9 flex-shrink-0 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-sm text-green-800 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">✅ تم تحديد الموقع</p>
              {value?.source === 'gps' && (
                <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">GPS</span>
              )}
              {value?.source === 'manual' && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">يدوي</span>
              )}
              {value?.source === 'search' && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">بحث</span>
              )}
            </div>
            {value?.address && (
              <p className="text-xs text-green-700 mt-1 line-clamp-2">{value.address}</p>
            )}
            {value?.accuracy && (
              <p className="text-xs text-green-600 mt-0.5">دقة الموقع: ±{value.accuracy} متر</p>
            )}
          </div>
          <button
            type="button"
            aria-label="إعادة تحديد الموقع"
            onClick={() => { setLocationSelected(false); onChange({}) }}
            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        👇 اضغط على الخريطة · أو ابحث بالاسم · أو اضغط GPS أعلاه لتحديد موقع التسليم بدقة
      </p>
    </div>
  )
}

export default LocationPicker
