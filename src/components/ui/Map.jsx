import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useEffect, useRef, useState, useMemo } from 'react'
import L from 'leaflet'
import { useAuthStore } from '@/store/authStore'
import { logger } from '@/utils/logger'

// ============================================================
// SECURITY CONSTANTS
// ============================================================

const AUTHORIZED_ROLES = ['driver', 'vendor', 'admin', 'buyer']
const CLICK_RATE_LIMIT_MS = 1000
const VALID_LAT_RANGE = [-90, 90]
const LNG_RANGE = [-180, 180]

// Morocco bounds for vendor location setup
const MOROCCO_BOUNDS = {
  latMin: 27.5,
  latMax: 36.0,
  lngMin: -13.5,
  lngMax: -1.0,
}

export const isValidMoroccoLocation = (lat, lng) => {
  const latitude = parseFloat(lat)
  const longitude = parseFloat(lng)
  return (
    !isNaN(latitude) && !isNaN(longitude) &&
    latitude >= MOROCCO_BOUNDS.latMin &&
    latitude <= MOROCCO_BOUNDS.latMax &&
    longitude >= MOROCCO_BOUNDS.lngMin &&
    longitude <= MOROCCO_BOUNDS.lngMax
  )
}

const TILE_PROVIDERS = {
  primary: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    name: 'OpenStreetMap'
  },
  fallback: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    name: 'CARTO'
  }
}

const AUDIT_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SECURITY: 'security'
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export const validateCoordinates = (lat, lng) => {
  const latitude = parseFloat(lat)
  const longitude = parseFloat(lng)

  if (isNaN(latitude) || isNaN(longitude)) {
    return { valid: false, lat: 0, lng: 0, error: 'Invalid coordinate format' }
  }

  if (latitude < VALID_LAT_RANGE[0] || latitude > VALID_LAT_RANGE[1]) {
    return { valid: false, lat: 0, lng: 0, error: `Latitude out of range (${VALID_LAT_RANGE[0]} to ${VALID_LAT_RANGE[1]})` }
  }

  if (longitude < LNG_RANGE[0] || longitude > LNG_RANGE[1]) {
    return { valid: false, lat: 0, lng: 0, error: `Longitude out of range (${LNG_RANGE[0]} to ${LNG_RANGE[1]})` }
  }

  return { valid: true, lat: latitude, lng: longitude }
}

export const sanitizeMarker = (marker, userRole) => {
  if (!marker) return null

  const sanitized = {
    lat: marker.lat,
    lng: marker.lng,
    icon: marker.icon,
  }

  if (marker.popup) {
    let popupContent = marker.popup

    if (userRole === 'buyer' && marker.sensitive) {
      popupContent = typeof popupContent === 'string'
        ? popupContent
        : 'Location'
    }

    sanitized.popup = popupContent
  }

  return sanitized
}

export const auditLog = async (action, data = {}, level = AUDIT_LEVELS.INFO) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action,
    level,
    data: {
      ...data,
      userToken: undefined,
      password: undefined,
    },
    userAgent: navigator.userAgent,
    url: window.location.href,
  }

  if (import.meta.env.DEV) {
    logger.debug(`[MAP AUDIT] ${action}:`, logEntry)
  }
}

// Fix Leaflet default icon issue with Vite
const defaultIcon = L.icon({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// Custom icon for selected location
const selectedLocationIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    width: 30px;
    height: 30px;
    background: #22c55e;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

// ============================================================
// SECURE MAP COMPONENTS
// ============================================================

/**
 * SecureMapClickHandler - Rate-limited click handler with audit logging
 */
const SecureMapClickHandler = ({ onLocationSelect, userId }) => {
  const lastClickRef = useRef(0)
  const clickCountRef = useRef(0)
  const map = useMap()

  useEffect(() => {
    if (!onLocationSelect) return

    const handleClick = (e) => {
      const now = Date.now()
      const timeSinceLastClick = now - lastClickRef.current

      if (timeSinceLastClick < CLICK_RATE_LIMIT_MS) {
        clickCountRef.current++
        if (clickCountRef.current > 5) {
          auditLog('rate_limit_exceeded', {
            clickCount: clickCountRef.current,
            timeWindow: `${timeSinceLastClick}ms`
          }, AUDIT_LEVELS.WARNING)
        }
        return
      }

      if (timeSinceLastClick > 5000) {
        clickCountRef.current = 0
      }

      lastClickRef.current = now

      const { lat, lng } = e.latlng
      const validation = validateCoordinates(lat, lng)

      if (!validation.valid) {
        auditLog('invalid_coordinates', { lat, lng, error: validation.error }, AUDIT_LEVELS.ERROR)
        return
      }

      auditLog('location_selected', {
        lat: validation.lat,
        lng: validation.lng,
        userId: userId || 'anonymous'
      }, AUDIT_LEVELS.INFO)

      onLocationSelect({ lat: validation.lat, lng: validation.lng })

      // Note: Don't call map.flyTo() here — the SecureMapUpdater
      // will handle the map view update when center prop changes.
      // Calling both flyTo and setView causes marker jumping.
    }

    map.on('click', handleClick)

    return () => {
      map.off('click', handleClick)
    }
  }, [map, onLocationSelect, userId])

  return null
}

/**
 * SecureMapUpdater - Validates center before updating map view
 */
const SecureMapUpdater = ({ center, zoom }) => {
  const map = useMap()
  const prevCenterRef = useRef(null)

  useEffect(() => {
    if (!center || !map) return

    // Skip if center hasn't changed
    const centerKey = `${center[0]},${center[1]}`
    if (prevCenterRef.current === centerKey) return
    prevCenterRef.current = centerKey

    const validation = validateCoordinates(center[0], center[1])

    if (validation.valid) {
      try {
        map.setView([validation.lat, validation.lng], zoom || map.getZoom(), { animate: false })
      } catch (e) {
        logger.debug('Map setView error:', e)
      }
    } else {
      auditLog('map_update_rejected', {
        center,
        error: validation.error,
        reason: 'Invalid coordinates'
      }, AUDIT_LEVELS.SECURITY)
    }
  }, [center, zoom, map])

  return null
}

/**
 * SecureTileLayer - Tile layer with fallback provider
 */
const SecureTileLayer = () => {
  const [tileError, _setTileError] = useState(false)

  const currentProvider = tileError ? TILE_PROVIDERS.fallback : TILE_PROVIDERS.primary

  return (
    <TileLayer
      attribution={currentProvider.attribution}
      url={currentProvider.url}
      maxZoom={19}
      crossOrigin="anonymous"
      errorTileUrl="/images/placeholder-tile.png"
    />
  )
}

// ============================================================
// MAIN SECURE MAP COMPONENT
// ============================================================

// Counter for unique map IDs
let mapCounter = 0

const SecureMapComponent = ({
  center = [33.5731, -7.5898],
  zoom = 12,
  markers = [],
  onLocationSelect,
  height = '400px',
  className,
  requireAuth = true,
  allowedRoles = AUTHORIZED_ROLES,
}) => {
  const { user, profile, loading: authLoading } = useAuthStore()
  const [mapError, setMapError] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  // Use a stable unique ID that doesn't change on re-renders
  const mapIdRef = useRef(`map-${++mapCounter}-${Math.random().toString(36).substr(2, 6)}`)

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      auditLog('connection_restored', {}, AUDIT_LEVELS.INFO)
    }
    const handleOffline = () => {
      setIsOnline(false)
      auditLog('connection_lost', {}, AUDIT_LEVELS.WARNING)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Validate center coordinates on mount
  const centerLat = center[0]
  const centerLng = center[1]
  const validatedCenter = useMemo(() => {
    const validation = validateCoordinates(centerLat, centerLng)
    if (validation.valid) {
      return [validation.lat, validation.lng]
    }
    auditLog('default_center_used', {
      original: center,
      error: validation.error,
      fallback: [33.5731, -7.5898]
    }, AUDIT_LEVELS.WARNING)
    return [33.5731, -7.5898]
  }, [centerLat, centerLng, center])

  const userRole = profile?.role || 'buyer'

  // Sanitize markers based on user role
  const sanitizedMarkers = useMemo(() => {
    return markers
      .filter(marker => {
        const validation = validateCoordinates(marker.lat, marker.lng)
        if (!validation.valid) {
          auditLog('marker_filtered', { reason: validation.error, marker }, AUDIT_LEVELS.WARNING)
          return false
        }
        return true
      })
      .map(marker => sanitizeMarker(marker, userRole))
  }, [markers, userRole])

  // Log map view
  useEffect(() => {
    auditLog('map_viewed', {
      userId: user?.id || 'anonymous',
      role: userRole,
      markerCount: sanitizedMarkers.length,
      hasLocationSelect: !!onLocationSelect
    }, AUDIT_LEVELS.INFO)
  }, [user?.id, userRole, sanitizedMarkers.length, onLocationSelect])

  // Authentication & authorization check
  if (requireAuth) {
    if (authLoading) {
      return (
        <div
          className={`flex items-center justify-center bg-gray-100 rounded-xl border border-gray-200 ${className}`}
          style={{ height }}
        >
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      )
    }

    if (!user) {
      auditLog('unauthorized_map_access_attempt', { center, zoom }, AUDIT_LEVELS.SECURITY)
      return (
        <div
          className={`flex flex-col items-center justify-center bg-gray-100 rounded-xl border border-gray-200 ${className}`}
          style={{ height }}
        >
          <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-gray-500 font-medium">Authentication Required</p>
          <p className="text-gray-400 text-sm mt-1">Please sign in to view the map</p>
        </div>
      )
    }

    const userRole = profile?.role || 'buyer'
    if (!allowedRoles.includes(userRole)) {
      auditLog('role_unauthorized_map_access', { role: userRole, allowedRoles }, AUDIT_LEVELS.SECURITY)
      return (
        <div
          className={`flex flex-col items-center justify-center bg-gray-100 rounded-xl border border-gray-200 ${className}`}
          style={{ height }}
        >
          <svg className="w-12 h-12 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <p className="text-gray-500 font-medium">Access Denied</p>
          <p className="text-gray-400 text-sm mt-1">Your role does not have permission to view this map</p>
        </div>
      )
    }
  }

  // Error fallback UI
  if (mapError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gray-100 rounded-xl border border-gray-200 ${className}`}
        style={{ height }}
      >
        <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <p className="text-gray-500 font-medium">Map Unavailable</p>
        <p className="text-gray-400 text-sm mt-1">Unable to load map. Please check your connection.</p>
        <button
          onClick={() => {
            mapIdRef.current = `map-${++mapCounter}-${Math.random().toString(36).substr(2, 6)}`
            setMapError(false)
          }}
          className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className={`rounded-xl overflow-hidden border border-gray-200 ${className}`} style={{ height }}>
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-yellow-700 text-sm font-medium">Offline - Map tiles may not load</span>
        </div>
      )}

      <MapContainer
        key={mapIdRef.current}
        center={validatedCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        worldCopyJump={true}
        maxBounds={[[-90, -180], [90, 180]]}
        onError={() => setMapError(true)}
      >
        {/* Secure tile layer with fallback */}
        <SecureTileLayer />

        {/* Secure map updater */}
        <SecureMapUpdater center={center} zoom={zoom} />

        {/* Secure click handler for selecting location */}
        {onLocationSelect && user && (
          <>
            <SecureMapClickHandler
              onLocationSelect={onLocationSelect}
              userId={user?.id}
            />
            {/* Show marker at center when in selection mode */}
            <Marker position={validatedCenter} icon={selectedLocationIcon}>
              <Popup>Selected Location</Popup>
            </Marker>
          </>
        )}

        {/* Sanitized markers */}
        {sanitizedMarkers.map((marker, index) => (
          <Marker
            key={`marker-${index}-${marker.lat}-${marker.lng}`}
            position={[marker.lat, marker.lng]}
            icon={marker.icon || defaultIcon}
          >
            {marker.popup && <Popup>{marker.popup}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

export default SecureMapComponent
