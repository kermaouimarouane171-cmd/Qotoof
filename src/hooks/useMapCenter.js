/**
 * useMapCenter - Unified map center resolution hook
 *
 * Resolves the best map center using a priority chain:
 *   1. Explicit coordinates (lat + lng provided by caller)
 *   2. City coordinates from profile.city (via getCityCoordinates)
 *   3. Casablanca fallback (getDefaultCityCenter)
 *
 * This ensures every map in the app centers on the user's actual location
 * (or the entity's location) instead of always defaulting to Casablanca.
 *
 * @param {object} options
 * @param {number|null} options.lat - Explicit latitude (e.g. store.latitude)
 * @param {number|null} options.lng - Explicit longitude (e.g. store.longitude)
 * @param {string} [options.city] - City name to geocode if no coords
 * @returns {[number, number]} - [lat, lng] array for Map component
 */
import { useMemo } from 'react'
import { getCityCoordinates, getDefaultCityCenter } from '@/utils/cityCoordinates'

export function useMapCenter({ lat, lng, city } = {}) {
  return useMemo(() => {
    // Priority 1: explicit coordinates
    if (
      lat != null && lng != null &&
      !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))
    ) {
      return [parseFloat(lat), parseFloat(lng)]
    }

    // Priority 2: city from profile
    if (city) {
      const cityCoords = getCityCoordinates(city)
      if (cityCoords) {
        return [cityCoords.lat, cityCoords.lng]
      }
    }

    // Priority 3: Casablanca fallback
    const fallback = getDefaultCityCenter()
    return [fallback.lat, fallback.lng]
  }, [lat, lng, city])
}

export default useMapCenter
