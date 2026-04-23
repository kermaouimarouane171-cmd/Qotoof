import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, LoadingSpinner, Modal } from '@/components/ui'
import PartnershipRequests from '@/components/shared/PartnershipRequests'
import { useAuthStore } from '@/store/authStore'
import { partnershipService } from '@/services/partnershipService'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  StarIcon,
  TruckIcon,
} from '@heroicons/react/24/outline'

const VEHICLE_TYPES = ['', 'motorcycle', 'car', 'van', 'truck']

const defaultVendorMessage = (driver, t) =>
  t('marketplaceFeatures.findDriver.defaultMessage', {
    name: driver.first_name || '',
  }).trim()

const DriverCard = ({
  driver,
  isCurrentPreferred,
  requestState,
  onSendRequest,
  onOpenIncoming,
  sendingId,
  t,
}) => {
  const name = `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || t('marketplaceFeatures.findDriver.card.unknownDriver')
  const rating = Number(driver.rating || 0).toFixed(1)
  const isPendingOutgoing = requestState?.status === 'pending' && requestState?.direction === 'outgoing'
  const hasIncomingPending = requestState?.status === 'pending' && requestState?.direction === 'incoming'
  const isAccepted = requestState?.status === 'accepted'
  const requestStatusLabel = {
    pending: t('marketplaceFeatures.findDriver.requestStatus.pending'),
    accepted: t('marketplaceFeatures.findDriver.requestStatus.accepted'),
    incoming: t('marketplaceFeatures.findDriver.requestStatus.incoming'),
  }

  return (
    <Card className="p-5 h-full">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{name}</h3>
          <p className="text-sm text-gray-500 mt-1">{driver.city || t('marketplaceFeatures.findDriver.card.unknownCity')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            driver.is_available_for_delivery
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {driver.is_available_for_delivery
              ? t('marketplaceFeatures.findDriver.card.available')
              : t('marketplaceFeatures.findDriver.card.unavailable')}
          </span>
          {requestState?.status && (
            <span className={`px-3 py-1 rounded-full text-[11px] font-medium ${
              hasIncomingPending
                ? 'bg-blue-100 text-blue-700'
                : isAccepted || isCurrentPreferred
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {hasIncomingPending ? requestStatusLabel.incoming : requestStatusLabel[requestState.status] || requestState.status}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-600 mb-5">
        <div className="flex items-center gap-2">
          <TruckIcon className="w-4 h-4 text-gray-400" />
          <span>{driver.vehicle_type || t('marketplaceFeatures.findDriver.card.vehicleUnspecified')}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPinIcon className="w-4 h-4 text-gray-400" />
          <span>{driver.vehicle_plate || t('marketplaceFeatures.findDriver.card.noPlate')}</span>
        </div>
        <div className="flex items-center gap-2">
          <StarIcon className="w-4 h-4 text-amber-500" />
          <span>{t('marketplaceFeatures.findDriver.card.ratingOutOfFive', { rating })}</span>
        </div>
      </div>

      <div className="rounded-xl bg-gray-50 p-3 mb-4 text-sm text-gray-600">
        <p>{t('marketplaceFeatures.findDriver.card.completedDeliveries', { count: driver.completed_deliveries || 0 })}</p>
      </div>

      {isCurrentPreferred ? (
        <button type="button" disabled className="w-full rounded-xl bg-green-600 text-white py-2.5 text-sm font-medium opacity-90">
          {t('marketplaceFeatures.findDriver.card.currentPreferred')}
        </button>
      ) : isAccepted ? (
        <button type="button" disabled className="w-full rounded-xl bg-green-50 border border-green-200 text-green-700 py-2.5 text-sm font-medium">
          {t('marketplaceFeatures.findDriver.card.alreadyLinked')}
        </button>
      ) : hasIncomingPending ? (
        <button
          type="button"
          onClick={onOpenIncoming}
          className="w-full rounded-xl border border-blue-300 text-blue-700 py-2.5 text-sm font-medium bg-blue-50 hover:bg-blue-100"
        >
          {t('marketplaceFeatures.findDriver.card.incomingRequest')}
        </button>
      ) : isPendingOutgoing ? (
        <button type="button" disabled className="w-full rounded-xl border border-amber-300 text-amber-700 py-2.5 text-sm font-medium bg-amber-50">
          {t('marketplaceFeatures.findDriver.card.pendingRequest')}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onSendRequest(driver)}
          disabled={sendingId === driver.id}
          className="w-full rounded-xl bg-gray-900 text-white py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {sendingId === driver.id
            ? t('marketplaceFeatures.findDriver.common.sending')
            : t('marketplaceFeatures.findDriver.card.sendRequest')}
        </button>
      )}
    </Card>
  )
}

const FindDriver = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [drivers, setDrivers] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [sendingId, setSendingId] = useState(null)
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [requestMessage, setRequestMessage] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    city: profile?.city || '',
    vehicleType: '',
    minRating: '0',
    availableOnly: true,
  })

  const loadData = useCallback(async () => {
    if (!profile?.id) return

    setLoading(true)
    try {
      const [driverResults, nextOutgoingRequests, nextIncomingRequests] = await Promise.all([
        partnershipService.getDriverSearchResults({
          city: filters.city,
          vehicleType: filters.vehicleType,
          minRating: Number(filters.minRating) || 0,
          availableOnly: filters.availableOnly,
        }),
        partnershipService.getOutgoingRequests(profile.id),
        partnershipService.getIncomingRequests(profile.id),
      ])

      setDrivers(driverResults)
      setOutgoingRequests(nextOutgoingRequests)
      setIncomingRequests(nextIncomingRequests)
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.findDriver.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [filters.availableOnly, filters.city, filters.minRating, filters.vehicleType, profile?.id, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredDrivers = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    if (!query) return drivers

    return drivers.filter((driver) =>
      [
        driver.first_name,
        driver.last_name,
        driver.city,
        driver.vehicle_type,
        driver.vehicle_plate,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [drivers, filters.search])

  const pendingTargetIds = useMemo(
    () => new Set(outgoingRequests.filter((request) => request.status === 'pending').map((request) => request.target_id)),
    [outgoingRequests]
  )

  const requestStateByDriverId = useMemo(() => {
    const map = new Map()

    outgoingRequests.forEach((request) => {
      map.set(request.target_id, { ...request, direction: 'outgoing' })
    })

    incomingRequests.forEach((request) => {
      if (!map.has(request.requester_id) || request.status === 'pending') {
        map.set(request.requester_id, { ...request, direction: 'incoming' })
      }
    })

    return map
  }, [incomingRequests, outgoingRequests])

  const openRequestModal = (driver) => {
    setSelectedDriver(driver)
    setRequestMessage(defaultVendorMessage(driver, t))
  }

  const handleSendRequest = async (driver, messageOverride = '') => {
    if (!profile?.id) return

    setSendingId(driver.id)
    try {
      const response = await partnershipService.sendRequest({
        requesterId: profile.id,
        requesterRole: 'vendor',
        targetId: driver.id,
        targetRole: 'driver',
        message: (messageOverride || defaultVendorMessage(driver)).trim(),
      })

      if (response.alreadyAccepted) {
        toast.success(t('marketplaceFeatures.findDriver.success.alreadyLinked'))
      } else if (response.alreadyPending) {
        toast.success(
          response.reversePending
            ? t('marketplaceFeatures.findDriver.success.reversePending')
            : t('marketplaceFeatures.findDriver.success.alreadyPending')
        )
      } else {
        toast.success(t('marketplaceFeatures.findDriver.success.sent'))
      }

      setSelectedDriver(null)
      await loadData()
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.findDriver.errors.sendFailed'))
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('marketplaceFeatures.findDriver.title')}</h1>
          <p className="text-sm text-gray-500 mt-2 leading-6">
            {t('marketplaceFeatures.findDriver.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => navigate('/vendor/driver-preferences')} className="btn-outline">
            {t('marketplaceFeatures.findDriver.actions.editPreferences')}
          </button>
          <button type="button" onClick={() => navigate('/vendor/dashboard')} className="btn-outline">
            {t('marketplaceFeatures.findDriver.actions.dashboard')}
          </button>
        </div>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-2 block">{t('marketplaceFeatures.findDriver.filters.freeSearch')}</span>
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                className="input-field pr-9"
                placeholder={t('marketplaceFeatures.findDriver.filters.searchPlaceholder')}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-2 block">{t('marketplaceFeatures.findDriver.filters.city')}</span>
            <input
              type="text"
              value={filters.city}
              onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))}
              className="input-field"
              placeholder={t('marketplaceFeatures.findDriver.filters.cityPlaceholder')}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-2 block">{t('marketplaceFeatures.findDriver.filters.vehicleType')}</span>
            <select
              value={filters.vehicleType}
              onChange={(event) => setFilters((prev) => ({ ...prev, vehicleType: event.target.value }))}
              className="input-field"
            >
              {VEHICLE_TYPES.map((vehicleType) => (
                <option key={vehicleType || 'all'} value={vehicleType}>
                  {vehicleType || t('marketplaceFeatures.findDriver.filters.allTypes')}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-2 block">{t('marketplaceFeatures.findDriver.filters.minRating')}</span>
            <select
              value={filters.minRating}
              onChange={(event) => setFilters((prev) => ({ ...prev, minRating: event.target.value }))}
              className="input-field"
            >
              <option value="0">{t('marketplaceFeatures.findDriver.filters.noLimit')}</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="4.5">4.5+</option>
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 mt-8 md:mt-0">
            <input
              type="checkbox"
              checked={filters.availableOnly}
              onChange={(event) => setFilters((prev) => ({ ...prev, availableOnly: event.target.checked }))}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">{t('marketplaceFeatures.findDriver.filters.availableOnly')}</span>
          </label>
        </div>
      </Card>

      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredDrivers.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">{t('marketplaceFeatures.findDriver.noResults')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDrivers.map((driver) => (
            <DriverCard
              key={driver.id}
              driver={driver}
              isCurrentPreferred={profile?.preferred_driver_id === driver.id && profile?.has_own_driver}
              requestState={requestStateByDriverId.get(driver.id) || (pendingTargetIds.has(driver.id) ? { status: 'pending', direction: 'outgoing' } : null)}
              onSendRequest={openRequestModal}
              onOpenIncoming={() => {
                const requestsSection = document.getElementById('vendor-partnership-requests')
                requestsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              sendingId={sendingId}
              t={t}
            />
          ))}
        </div>
      )}

      <div id="vendor-partnership-requests">
        <PartnershipRequests currentUserId={profile?.id} currentRole="vendor" />
      </div>

      <Modal
        isOpen={Boolean(selectedDriver)}
        onClose={() => !sendingId && setSelectedDriver(null)}
        title={t('marketplaceFeatures.findDriver.modal.title')}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            {t('marketplaceFeatures.findDriver.modal.description', {
              driver: selectedDriver
                ? `${selectedDriver.first_name || ''} ${selectedDriver.last_name || ''}`.trim() || t('marketplaceFeatures.findDriver.modal.selectedDriver')
                : '-',
              city: selectedDriver?.city ? t('marketplaceFeatures.findDriver.modal.inCity', { city: selectedDriver.city }) : '',
            })}
          </div>

          <div>
            <label htmlFor="vendor-driver-request-message" className="block text-sm font-medium text-gray-700 mb-1">{t('marketplaceFeatures.findDriver.modal.message')}</label>
            <textarea
              id="vendor-driver-request-message"
              value={requestMessage}
              onChange={(event) => setRequestMessage(event.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 resize-none"
              placeholder={t('marketplaceFeatures.findDriver.modal.messagePlaceholder')}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedDriver(null)}
              disabled={Boolean(sendingId)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              {t('marketplaceFeatures.findDriver.common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => selectedDriver && handleSendRequest(selectedDriver, requestMessage)}
              disabled={Boolean(sendingId) || !requestMessage.trim()}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-black disabled:opacity-50"
            >
              {sendingId === selectedDriver?.id
                ? t('marketplaceFeatures.findDriver.common.sending')
                : t('marketplaceFeatures.findDriver.modal.send')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default FindDriver