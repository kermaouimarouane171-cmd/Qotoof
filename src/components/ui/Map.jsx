import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet'
import { useEffect, useRef, useState, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
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
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
    name: 'Esri Satellite'
  },
  // Hybrid: satellite + labels overlay (labels on top of satellite imagery)
  hybrid: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    name: 'Esri Labels'
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

// Custom icon for selected location with pulse animation
const selectedLocationIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:40px;height:40px">
    <div style="
      position:absolute;inset:0;
      background:rgba(34,197,94,0.25);
      border-radius:50%;
      animation:map-pulse 1.8s ease-out infinite;
    "></div>
    <div style="
      position:absolute;top:50%;left:50%;
      transform:translate(-50%,-50%);
      width:22px;height:22px;
      background:#16a34a;
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 2px 10px rgba(0,0,0,0.35);
    "></div>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
})

// CSS for pulse animation — injected once
if (typeof document !== 'undefined' && !document.getElementById('map-pulse-style')) {
  const style = document.createElement('style')
  style.id = 'map-pulse-style'
  style.textContent = `
    @keyframes map-pulse {
      0%   { transform: scale(0.5); opacity: 0.8; }
      100% { transform: scale(2.2); opacity: 0; }
    }
  `
  document.head.appendChild(style)
}

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
 * SecureMapUpdater - Validates center before updating map view, with smooth flyTo
 */
const SecureMapUpdater = ({ center, zoom }) => {
  const map = useMap()
  const prevKeyRef = useRef(null)

  useEffect(() => {
    if (!center || !map) return

    // Include zoom in the key so zoom-only changes also trigger flyTo
    const key = `${center[0]},${center[1]},${zoom}`
    if (prevKeyRef.current === key) return
    prevKeyRef.current = key

    const validation = validateCoordinates(center[0], center[1])

    if (validation.valid) {
      try {
        map.flyTo(
          [validation.lat, validation.lng],
          zoom || map.getZoom(),
          { animate: true, duration: 0.8 }
        )
      } catch (e) {
        logger.debug('Map flyTo error:', e)
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
 * SecureTileLayer - Tile layer with fallback provider + satellite support
 */
const SecureTileLayer = ({ satellite = false }) => {
  const [tileError, _setTileError] = useState(false)

  if (satellite) {
    const satProvider = tileError ? TILE_PROVIDERS.fallback : TILE_PROVIDERS.satellite
    return (
      <>
        <TileLayer
          attribution={satProvider.attribution}
          url={satProvider.url}
          maxZoom={18}
        />
        {/* Labels overlay on top of satellite imagery */}
        <TileLayer
          url={TILE_PROVIDERS.hybrid.url}
          attribution={TILE_PROVIDERS.hybrid.attribution}
          maxZoom={18}
        />
      </>
    )
  }

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
  accuracyRadius = null,  // metres — draws accuracy circle around GPS marker
  showSatelliteToggle = true, // show "خريطة / قمر صناعي" toggle button (enabled by default for consistency)
}) => {
  const { user, profile, loading: authLoading } = useAuthStore()
  const [mapError, setMapError] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [satelliteMode, setSatelliteMode] = useState(false)
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
    <div className={`relative rounded-xl overflow-hidden border border-gray-200 ${className}`} style={{ height }}>
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-yellow-700 text-sm font-medium">Offline - Map tiles may not load</span>
        </div>
      )}

      {/* Satellite toggle button */}
      {showSatelliteToggle && (
        <div className="absolute top-3 right-3 z-[1000] flex rounded-lg overflow-hidden border border-gray-300 shadow-md bg-white">
          <button
            type="button"
            onClick={() => setSatelliteMode(false)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              !satelliteMode ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            خريطة
          </button>
          <button
            type="button"
            onClick={() => setSatelliteMode(true)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 ${
              satelliteMode ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            قمر صناعي
          </button>
        </div>
      )}

      <MapContainer
        key={`${mapIdRef.current}-${satelliteMode ? 'sat' : 'map'}`}
        center={validatedCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        worldCopyJump={true}
        maxBounds={[[-90, -180], [90, 180]]}
        onError={() => setMapError(true)}
      >
        {/* Secure tile layer with fallback + satellite support */}
        <SecureTileLayer satellite={satelliteMode} />

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
              <Popup>
                <div style={{ textAlign: 'right', direction: 'rtl', minWidth: 140 }}>
                  <strong style={{ color: '#16a34a' }}>📍 موقع التسليم</strong>
                  <br />
                  <span style={{ fontSize: 11, color: '#6b7280' }}>
                    {validatedCenter[0].toFixed(5)}, {validatedCenter[1].toFixed(5)}
                  </span>
                </div>
              </Popup>
            </Marker>
            {/* GPS accuracy circle */}
            {accuracyRadius && accuracyRadius > 0 && (
              <Circle
                center={validatedCenter}
                radius={accuracyRadius}
                pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.12, weight: 1.5 }}
              />
            )}
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
