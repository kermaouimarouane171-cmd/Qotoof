/**
 * 🗺️ RouteMap Component
 * Shows a driving route between two points (e.g. vendor → buyer).
 * Uses OSRM (free, no API key) for routing and react-leaflet for display.
 */

import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { TruckIcon, ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

// Fix default icon paths broken by bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const GREEN_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

const BLUE_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

// Fit map bounds to show both markers + route
function BoundsFitter({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions && positions.length >= 2) {
      const bounds = L.latLngBounds(positions)
      map.fitBounds(bounds, { padding: [48, 48] })
    }
  }, [map, positions])
  return null
}

async function fetchRoute(origin, destination) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=full&geometries=geojson`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('routing failed')
  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('no route found')
  const route = data.routes[0]
  // GeoJSON coords are [lng, lat] — convert to [lat, lng] for Leaflet
  const polyline = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
  const distanceKm = (route.distance / 1000).toFixed(1)
  const durationMin = Math.ceil(route.duration / 60)
  return { polyline, distanceKm, durationMin }
}

const RouteMap = ({
  origin,       // { lat, lng, label }  — e.g. seller/vendor location
  destination,  // { lat, lng, label }  — e.g. buyer delivery location
  height = '380px',
  className = '',
}) => {
  const [route, setRoute] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!origin?.lat || !destination?.lat) return
    setLoading(true)
    setError(null)
    fetchRoute(origin, destination)
      .then(setRoute)
      .catch(() => setError('تعذّر تحميل المسار. يتم عرض نقطتي البداية والنهاية فقط.'))
      .finally(() => setLoading(false))
  }, [origin, destination])

  const center = origin?.lat
    ? [origin.lat, origin.lng]
    : [33.5731, -7.5898]

  const boundsPositions = route
    ? route.polyline
    : (origin?.lat && destination?.lat)
      ? [[origin.lat, origin.lng], [destination.lat, destination.lng]]
      : null

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Info bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <TruckIcon className="w-4 h-4 text-green-600" />
          <span>مسار التوصيل</span>
        </div>
        {loading && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
            <span>جاري حساب المسار...</span>
          </div>
        )}
        {route && (
          <div className="flex items-center gap-3 text-xs">
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {route.distanceKm} كم
            </span>
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              ~{route.durationMin} دقيقة
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height }}>
        <MapContainer
          center={center}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Vendor / origin marker (green) */}
          {origin?.lat && (
            <Marker position={[origin.lat, origin.lng]} icon={GREEN_ICON}>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold text-green-700">📦 {origin.label || 'موقع البائع'}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Buyer / destination marker (blue) */}
          {destination?.lat && (
            <Marker position={[destination.lat, destination.lng]} icon={BLUE_ICON}>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold text-blue-700">🏠 {destination.label || 'موقع التسليم'}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Route polyline */}
          {route?.polyline && (
            <Polyline
              positions={route.polyline}
              pathOptions={{ color: '#16a34a', weight: 4, opacity: 0.8, dashArray: null }}
            />
          )}

          {boundsPositions && <BoundsFitter positions={boundsPositions} />}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          <span>{origin?.label || 'البائع'}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
          <span>{destination?.label || 'موقع التسليم'}</span>
        </div>
        {route && (
          <div className="flex items-center gap-1">
            <span className="w-5 h-0.5 bg-green-600 inline-block rounded" />
            <span>مسار القيادة</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default RouteMap
