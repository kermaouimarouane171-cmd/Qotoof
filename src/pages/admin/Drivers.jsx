import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, LoadingSpinner, Map } from '@/components/ui'
import { useMapCenter } from '@/hooks/useMapCenter'
import {
  TruckIcon,
  DocumentCheckIcon,
  ClockIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  MapPinIcon,
  EyeIcon,
  PhoneIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'

const DRIVER_PAGE_SIZE = 20

const AdminDrivers = () => {
  const { t } = useTranslation()
  const channelRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState([])
  const [activeDrivers, setActiveDrivers] = useState([])
  const [_pendingCount, _setPendingCount] = useState(0)
  const [stats, setStats] = useState({
    totalDrivers: 0,
    verifiedDrivers: 0,
    onlineDrivers: 0,
    pendingDocuments: 0,
  })
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedDriver, setSelectedDriver] = useState(null)

  useEffect(() => {
    loadData()
    setupRealtimeTracking()
    return () => cleanupRealtimeTracking()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = async () => {
    try {
      // Parallel fetch: drivers, active locations, pending count
      const [driversRes, locationsRes, pendingRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, email, phone, city, vehicle_type, vehicle_plate, is_available_for_delivery, created_at')
          .eq('role', 'driver')
          .order('created_at', { ascending: false }),
        supabase
          .from('driver_locations')
          .select('driver_id, latitude, longitude, speed_kmh, heading, is_online, last_active_at, accuracy_meters')
          .eq('is_online', true),
        supabase
          .from('driver_verification_documents')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ])

      if (driversRes.error) throw driversRes.error
      if (locationsRes.error) throw locationsRes.error
      if (pendingRes.error) {
        if (pendingRes.error.code === '42P01' || String(pendingRes.error.message).includes('does not exist')) {
          logger.warn('driver_verification_documents table not found, skipping pending count')
        } else {
          throw pendingRes.error
        }
      }

      const driversList = driversRes.data || []
      const locationsList = locationsRes.data || []

      // Merge driver data with location data
      const driversWithLocation = driversList.map(driver => {
        const loc = locationsList.find(l => l.driver_id === driver.id)
        return { ...driver, location: loc || null }
      })

      setDrivers(driversWithLocation)
      setActiveDrivers(locationsList)

      // Columns license_verified / insurance_verified do not exist in DB schema;
      // treat missing data as unverified (safe fallback)
      const verifiedCount = driversList.filter(d => !!d.license_verified && !!d.insurance_verified).length
      setStats({
        totalDrivers: driversList.length,
        verifiedDrivers: verifiedCount,
        onlineDrivers: locationsList.length,
        pendingDocuments: pendingRes.count || 0,
      })
    } catch (error) {
      logger.error('Error loading admin drivers:', error)
      toast.error(t('admin.drivers.notifications.loadFailed', 'Failed to load drivers'))
    } finally {
      setLoading(false)
    }
  }

  // Real-time tracking of driver locations
  const setupRealtimeTracking = () => {
    const channel = supabase
      .channel('admin-driver-locations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setActiveDrivers(prev => {
              const idx = prev.findIndex(d => d.driver_id === payload.new.driver_id)
              if (idx >= 0) {
                const updated = [...prev]
                updated[idx] = payload.new
                return updated
              }
              if (payload.new.is_online) {
                return [...prev, payload.new]
              }
              return prev
            })

            // Update driver in main list
            setDrivers(prev =>
              prev.map(d =>
                d.id === payload.new.driver_id
                  ? { ...d, location: payload.new.is_online ? payload.new : null }
                  : d
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setActiveDrivers(prev => prev.filter(d => d.driver_id !== payload.old.driver_id))
          }
        }
      )
      .subscribe()

    channelRef.current = channel
  }

  const cleanupRealtimeTracking = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }
  }

  const filteredDrivers = drivers.filter((driver) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'online' && driver.location?.is_online) ||
      (filter === 'verified' && !!driver.license_verified && !!driver.insurance_verified) ||
      (filter === 'unverified' && (!driver.license_verified || !driver.insurance_verified))
    const q = search.trim().toLowerCase()
    const fullName = `${driver.first_name || ''} ${driver.last_name || ''}`.toLowerCase()
    const matchesSearch = !q ||
      fullName.includes(q) ||
      driver.email?.toLowerCase().includes(q) ||
      driver.phone?.toLowerCase().includes(q) ||
      driver.city?.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  const driverTotalPages = Math.max(1, Math.ceil(filteredDrivers.length / DRIVER_PAGE_SIZE))
  const pagedDrivers = filteredDrivers.slice((page - 1) * DRIVER_PAGE_SIZE, page * DRIVER_PAGE_SIZE)

  const getVerificationStatus = (driver) => {
    if (driver.license_verified && driver.insurance_verified) {
      return { label: t('admin.drivers.verificationStatus.verified', 'Verified'), color: 'bg-green-100 text-green-700', icon: CheckCircleIcon }
    }
    if (driver.license_verified || driver.insurance_verified) {
      return { label: t('admin.drivers.verificationStatus.partial', 'Partial'), color: 'bg-yellow-100 text-yellow-700', icon: ClockIcon }
    }
    return { label: t('admin.drivers.verificationStatus.unverified', 'Unverified'), color: 'bg-red-100 text-red-700', icon: XCircleIcon }
  }

  // Map markers for active drivers
  const mapMarkers = activeDrivers.map(driver => ({
    lat: parseFloat(driver.latitude),
    lng: parseFloat(driver.longitude),
    popup: `Driver ${driver.driver_id?.substring(0, 8) || 'Unknown'}`,
    icon: '🚚',
  }))
  // Center on first active driver, fallback to Casablanca
  const driversMapCenter = useMapCenter({
    lat: mapMarkers[0]?.lat,
    lng: mapMarkers[0]?.lng,
  })
  // Center on selected driver in detail modal
  const selectedDriverMapCenter = useMapCenter({
    lat: selectedDriver?.location?.latitude,
    lng: selectedDriver?.location?.longitude,
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.drivers.title', 'Manage Drivers')}</h1>
          <p className="text-gray-500">{t('admin.drivers.subtitle', 'View drivers, verify documents, and track active locations')}</p>
        </div>
        <Link
          to="/admin/drivers/verification"
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          <DocumentCheckIcon className="w-5 h-5" />
          {t('admin.drivers.reviewDocuments', 'Review Documents')} ({stats.pendingDocuments} {t('admin.drivers.stats.pendingDocs', 'pending')})
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <UserGroupIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDrivers}</p>
              <p className="text-sm text-gray-500">{t('admin.drivers.stats.totalDrivers', 'Total Drivers')}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.verifiedDrivers}</p>
              <p className="text-sm text-gray-500">{t('admin.drivers.stats.verified', 'Verified')}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
              <MapPinIcon className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.onlineDrivers}</p>
              <p className="text-sm text-gray-500">{t('admin.drivers.stats.onlineNow', 'Online Now')}</p>
            </div>
          </div>
        </Card>

        <Link to="/admin/drivers/verification">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-2 border-yellow-200 bg-yellow-50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700">{stats.pendingDocuments}</p>
                <p className="text-sm text-yellow-600">{t('admin.drivers.stats.pendingDocs', 'Pending Docs')}</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Active Drivers Map */}
      {activeDrivers.length > 0 ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPinIcon className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">{t('admin.drivers.map.title', 'Active Drivers Map')}</h3>
            <span className="ml-auto flex items-center gap-1 text-sm text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              {activeDrivers.length} {t('admin.drivers.map.online', 'online')}
            </span>
          </div>
          <Map
            center={driversMapCenter}
            zoom={12}
            markers={mapMarkers}
            height="400px"
          />
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <MapPinIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('admin.drivers.map.noActiveDrivers', 'No Active Drivers')}</h3>
          <p className="text-gray-500">{t('admin.drivers.map.noActiveDriversDesc', 'No drivers are currently online')}</p>
        </Card>
      )}

      {/* Search */}
      <div className="mb-2">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          placeholder={t('admin.drivers.searchPlaceholder', 'Search by name, email, phone, or city…')}
          className="input w-full max-w-sm"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { key: 'all', label: `${t('admin.drivers.filters.all', 'All')} (${stats.totalDrivers})` },
          { key: 'online', label: `${t('admin.drivers.filters.online', 'Online')} (${stats.onlineDrivers})` },
          { key: 'verified', label: `${t('admin.drivers.filters.verified', 'Verified')} (${stats.verifiedDrivers})` },
          { key: 'unverified', label: `${t('admin.drivers.filters.unverified', 'Unverified')} (${stats.totalDrivers - stats.verifiedDrivers})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setPage(1) }}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              filter === tab.key
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Drivers List */}
      {filteredDrivers.length === 0 ? (
        <Card className="p-12 text-center">
          <TruckIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('admin.drivers.noDriversFound', 'No Drivers Found')}</h3>
          <p className="text-gray-500">{t('admin.drivers.noDriversFoundDesc', 'No drivers match the selected filter')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pagedDrivers.map(driver => {
            const status = getVerificationStatus(driver)
            const StatusIcon = status.icon
            return (
              <Card key={driver.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <TruckIcon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {driver.first_name} {driver.last_name}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                          {driver.location?.is_online && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700">
                              <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                              {t('admin.drivers.filters.online', 'Online')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      {driver.email && (
                        <div className="flex items-center gap-2">
                          <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                          <span>{driver.email}</span>
                        </div>
                      )}
                      {driver.phone && (
                        <div className="flex items-center gap-2">
                          <PhoneIcon className="w-4 h-4 text-gray-400" />
                          <span>{driver.phone}</span>
                        </div>
                      )}
                      {driver.vehicle_type && (
                        <div className="flex items-center gap-2">
                          <TruckIcon className="w-4 h-4 text-gray-400" />
                          <span className="capitalize">{driver.vehicle_type}</span>
                          {driver.vehicle_plate && (
                            <span className="text-gray-400">• {driver.vehicle_plate}</span>
                          )}
                        </div>
                      )}
                      {driver.city && (
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="w-4 h-4 text-gray-400" />
                          <span>{driver.city}</span>
                        </div>
                      )}
                    </div>

                    {/* Verification Details */}
                    <div className="mt-3 flex gap-3 text-xs">
                      <span className={driver.license_verified ? 'text-green-600' : 'text-gray-400'}>
                        {driver.license_verified ? '✅' : '❌'} {t('admin.drivers.details.license', 'License')}
                      </span>
                      <span className={driver.insurance_verified ? 'text-green-600' : 'text-gray-400'}>
                        {driver.insurance_verified ? '✅' : '❌'} {t('admin.drivers.details.insurance', 'Insurance')}
                      </span>
                      {driver.license_expiry_date && (
                        <span className="text-gray-500">
                          {t('admin.drivers.details.expires', 'Expires')}: {new Date(driver.license_expiry_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    {driver.location && (
                      <button
                        onClick={() => setSelectedDriver(driver)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('admin.drivers.details.viewOnMap', 'View on Map')}
                      >
                        <MapPinIcon className="w-5 h-5" />
                      </button>
                    )}
                    <Link
                      to={`/admin/drivers/verification`}
                      className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title={t('admin.drivers.details.viewDocuments', 'View Documents')}
                    >
                      <EyeIcon className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Drivers Pagination */}
      {driverTotalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {t('common.prev', 'Prev')}
          </button>
          <span className="text-sm text-gray-600">
            {t('common.pageOf', 'Page {{page}} of {{total}}', { page, total: driverTotalPages })}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(driverTotalPages, p + 1))}
            disabled={page === driverTotalPages}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            {t('common.next', 'Next')}
          </button>
        </div>
      )}

      {/* Driver Location Detail Modal */}
      {selectedDriver && selectedDriver.location && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedDriver.first_name} {selectedDriver.last_name} — {t('admin.drivers.details.location', 'Location')}
              </h2>
              <button
                onClick={() => setSelectedDriver(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <XCircleIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <Map
              center={selectedDriverMapCenter}
              zoom={15}
              markers={[{
                lat: parseFloat(selectedDriver.location.latitude),
                lng: parseFloat(selectedDriver.location.longitude),
                popup: `${selectedDriver.first_name} ${selectedDriver.last_name}`,
                icon: '🚚',
              }]}
              height="300px"
            />

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">{t('admin.drivers.details.speed', 'Speed')}</p>
                <p className="font-semibold">{selectedDriver.location.speed_kmh || 0} km/h</p>
              </div>
              <div>
                <p className="text-gray-500">{t('admin.drivers.details.accuracy', 'Accuracy')}</p>
                <p className="font-semibold">{selectedDriver.location.accuracy_meters || 'N/A'} m</p>
              </div>
              <div>
                <p className="text-gray-500">{t('admin.drivers.details.lastActive', 'Last Active')}</p>
                <p className="font-semibold">{new Date(selectedDriver.location.last_active_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">{t('admin.drivers.details.coordinates', 'Coordinates')}</p>
                <p className="font-semibold">
                  {parseFloat(selectedDriver.location.latitude).toFixed(4)}, {parseFloat(selectedDriver.location.longitude).toFixed(4)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default AdminDrivers
