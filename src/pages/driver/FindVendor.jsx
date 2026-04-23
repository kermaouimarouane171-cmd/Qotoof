import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, LoadingSpinner, Modal } from '@/components/ui'
import PartnershipRequests from '@/components/shared/PartnershipRequests'
import { useAuthStore } from '@/store/authStore'
import { partnershipService } from '@/services/partnershipService'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  BuildingStorefrontIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  StarIcon,
} from '@heroicons/react/24/outline'

const defaultDriverMessage = (vendor, t) =>
  t('marketplaceFeatures.findVendor.defaultMessage', {
    store: vendor.store_name || '',
  }).trim()

const VendorCard = ({
  vendor,
  isCurrentPreferred,
  requestState,
  onSendRequest,
  onOpenIncoming,
  sendingId,
  t,
}) => {
  const displayName = vendor.store_name || `${vendor.first_name || ''} ${vendor.last_name || ''}`.trim() || t('marketplaceFeatures.findVendor.card.unknownVendor')
  const isPendingOutgoing = requestState?.status === 'pending' && requestState?.direction === 'outgoing'
  const hasIncomingPending = requestState?.status === 'pending' && requestState?.direction === 'incoming'
  const isAccepted = requestState?.status === 'accepted'
  const requestStatusLabel = {
    pending: t('marketplaceFeatures.findVendor.requestStatus.pending'),
    accepted: t('marketplaceFeatures.findVendor.requestStatus.accepted'),
    incoming: t('marketplaceFeatures.findVendor.requestStatus.incoming'),
  }

  return (
    <Card className="p-5 h-full">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{displayName}</h3>
          <p className="text-sm text-gray-500 mt-1">{vendor.city || t('marketplaceFeatures.findVendor.card.unknownCity')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            vendor.has_own_driver
              ? 'bg-amber-100 text-amber-700'
              : 'bg-green-100 text-green-700'
          }`}>
            {vendor.has_own_driver
              ? t('marketplaceFeatures.findVendor.card.hasDriver')
              : t('marketplaceFeatures.findVendor.card.lookingForDriver')}
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
          <MapPinIcon className="w-4 h-4 text-gray-400" />
          <span>{vendor.city || t('marketplaceFeatures.findVendor.card.notSpecified')}</span>
        </div>
        <div className="flex items-center gap-2">
          <StarIcon className="w-4 h-4 text-amber-500" />
          <span>{t('marketplaceFeatures.findVendor.card.ratingOutOfFive', { rating: Number(vendor.rating || 0).toFixed(1) })}</span>
        </div>
        <div className="flex items-center gap-2">
          <BuildingStorefrontIcon className="w-4 h-4 text-gray-400" />
          <span>{t('marketplaceFeatures.findVendor.card.weeklyOrders', { count: vendor.weekly_orders || 0 })}</span>
        </div>
      </div>

      <div className="rounded-xl bg-gray-50 p-3 mb-4 text-sm text-gray-600">
        <p>{vendor.product_categories?.length ? vendor.product_categories.join('، ') : t('marketplaceFeatures.findVendor.card.noCategories')}</p>
      </div>

      {isCurrentPreferred ? (
        <button type="button" disabled className="w-full rounded-xl bg-green-600 text-white py-2.5 text-sm font-medium opacity-90">
          {t('marketplaceFeatures.findVendor.card.currentPreferred')}
        </button>
      ) : isAccepted ? (
        <button type="button" disabled className="w-full rounded-xl bg-green-50 border border-green-200 text-green-700 py-2.5 text-sm font-medium">
          {t('marketplaceFeatures.findVendor.card.alreadyLinked')}
        </button>
      ) : hasIncomingPending ? (
        <button
          type="button"
          onClick={onOpenIncoming}
          className="w-full rounded-xl border border-blue-300 text-blue-700 py-2.5 text-sm font-medium bg-blue-50 hover:bg-blue-100"
        >
          {t('marketplaceFeatures.findVendor.card.incomingRequest')}
        </button>
      ) : isPendingOutgoing ? (
        <button type="button" disabled className="w-full rounded-xl border border-amber-300 text-amber-700 py-2.5 text-sm font-medium bg-amber-50">
          {t('marketplaceFeatures.findVendor.card.pendingRequest')}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onSendRequest(vendor)}
          disabled={sendingId === vendor.id}
          className="w-full rounded-xl bg-gray-900 text-white py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
        >
          {sendingId === vendor.id
            ? t('marketplaceFeatures.findVendor.common.sending')
            : t('marketplaceFeatures.findVendor.card.sendRequest')}
        </button>
      )}
    </Card>
  )
}

const FindVendor = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [vendors, setVendors] = useState([])
  const [outgoingRequests, setOutgoingRequests] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [sendingId, setSendingId] = useState(null)
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [requestMessage, setRequestMessage] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    city: profile?.city || '',
    category: '',
    minRating: '0',
    lookingForDriverOnly: true,
  })

  const loadData = useCallback(async () => {
    if (!profile?.id) return

    setLoading(true)
    try {
      const [vendorResults, nextOutgoingRequests, nextIncomingRequests] = await Promise.all([
        partnershipService.getVendorSearchResults({
          city: filters.city,
          category: filters.category,
          minRating: Number(filters.minRating) || 0,
          lookingForDriverOnly: filters.lookingForDriverOnly,
        }),
        partnershipService.getOutgoingRequests(profile.id),
        partnershipService.getIncomingRequests(profile.id),
      ])

      setVendors(vendorResults)
      setOutgoingRequests(nextOutgoingRequests)
      setIncomingRequests(nextIncomingRequests)
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.findVendor.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [filters.category, filters.city, filters.lookingForDriverOnly, filters.minRating, profile?.id, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredVendors = useMemo(() => {
    const query = filters.search.trim().toLowerCase()
    if (!query) return vendors

    return vendors.filter((vendor) =>
      [
        vendor.store_name,
        vendor.first_name,
        vendor.last_name,
        vendor.city,
        ...(vendor.product_categories || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [vendors, filters.search])

  const pendingTargetIds = useMemo(
    () => new Set(outgoingRequests.filter((request) => request.status === 'pending').map((request) => request.target_id)),
    [outgoingRequests]
  )

  const requestStateByVendorId = useMemo(() => {
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

  const openRequestModal = (vendor) => {
    setSelectedVendor(vendor)
    setRequestMessage(defaultDriverMessage(vendor, t))
  }

  const handleSendRequest = async (vendor, messageOverride = '') => {
    if (!profile?.id) return

    setSendingId(vendor.id)
    try {
      const response = await partnershipService.sendRequest({
        requesterId: profile.id,
        requesterRole: 'driver',
        targetId: vendor.id,
        targetRole: 'vendor',
        message: (messageOverride || defaultDriverMessage(vendor)).trim(),
      })

      if (response.alreadyAccepted) {
        toast.success(t('marketplaceFeatures.findVendor.success.alreadyLinked'))
      } else if (response.alreadyPending) {
        toast.success(
          response.reversePending
            ? t('marketplaceFeatures.findVendor.success.reversePending')
            : t('marketplaceFeatures.findVendor.success.alreadyPending')
        )
      } else {
        toast.success(t('marketplaceFeatures.findVendor.success.sent'))
      }

      setSelectedVendor(null)
      await loadData()
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.findVendor.errors.sendFailed'))
    } finally {
      setSendingId(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('marketplaceFeatures.findVendor.title')}</h1>
          <p className="text-sm text-gray-500 mt-2 leading-6">
            {t('marketplaceFeatures.findVendor.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => navigate('/driver/vendor-preferences')} className="btn-outline">
            {t('marketplaceFeatures.findVendor.actions.editPreferences')}
          </button>
          <button type="button" onClick={() => navigate('/driver/dashboard')} className="btn-outline">
            {t('marketplaceFeatures.findVendor.actions.dashboard')}
          </button>
        </div>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-2 block">{t('marketplaceFeatures.findVendor.filters.freeSearch')}</span>
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                className="input-field pr-9"
                placeholder={t('marketplaceFeatures.findVendor.filters.searchPlaceholder')}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-2 block">{t('marketplaceFeatures.findVendor.filters.city')}</span>
            <input
              type="text"
              value={filters.city}
              onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))}
              className="input-field"
              placeholder={t('marketplaceFeatures.findVendor.filters.cityPlaceholder')}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-2 block">{t('marketplaceFeatures.findVendor.filters.category')}</span>
            <input
              type="text"
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
              className="input-field"
              placeholder={t('marketplaceFeatures.findVendor.filters.categoryPlaceholder')}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 mb-2 block">{t('marketplaceFeatures.findVendor.filters.minRating')}</span>
            <select
              value={filters.minRating}
              onChange={(event) => setFilters((prev) => ({ ...prev, minRating: event.target.value }))}
              className="input-field"
            >
              <option value="0">{t('marketplaceFeatures.findVendor.filters.noLimit')}</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="4.5">4.5+</option>
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 mt-8 md:mt-0">
            <input
              type="checkbox"
              checked={filters.lookingForDriverOnly}
              onChange={(event) => setFilters((prev) => ({ ...prev, lookingForDriverOnly: event.target.checked }))}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">{t('marketplaceFeatures.findVendor.filters.lookingOnly')}</span>
          </label>
        </div>
      </Card>

      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredVendors.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">{t('marketplaceFeatures.findVendor.noResults')}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredVendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              isCurrentPreferred={profile?.preferred_vendor_id === vendor.id && profile?.has_preferred_vendor}
              requestState={requestStateByVendorId.get(vendor.id) || (pendingTargetIds.has(vendor.id) ? { status: 'pending', direction: 'outgoing' } : null)}
              onSendRequest={openRequestModal}
              onOpenIncoming={() => {
                const requestsSection = document.getElementById('driver-partnership-requests')
                requestsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              sendingId={sendingId}
              t={t}
            />
          ))}
        </div>
      )}

      <div id="driver-partnership-requests">
        <PartnershipRequests currentUserId={profile?.id} currentRole="driver" />
      </div>

      <Modal
        isOpen={Boolean(selectedVendor)}
        onClose={() => !sendingId && setSelectedVendor(null)}
        title={t('marketplaceFeatures.findVendor.modal.title')}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            {t('marketplaceFeatures.findVendor.modal.description', {
              vendor: selectedVendor?.store_name || `${selectedVendor?.first_name || ''} ${selectedVendor?.last_name || ''}`.trim() || t('marketplaceFeatures.findVendor.modal.selectedVendor'),
              city: selectedVendor?.city ? t('marketplaceFeatures.findVendor.modal.inCity', { city: selectedVendor.city }) : '',
            })}
          </div>

          <div>
            <label htmlFor="driver-vendor-request-message" className="block text-sm font-medium text-gray-700 mb-1">{t('marketplaceFeatures.findVendor.modal.message')}</label>
            <textarea
              id="driver-vendor-request-message"
              value={requestMessage}
              onChange={(event) => setRequestMessage(event.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 resize-none"
              placeholder={t('marketplaceFeatures.findVendor.modal.messagePlaceholder')}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setSelectedVendor(null)}
              disabled={Boolean(sendingId)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              {t('marketplaceFeatures.findVendor.common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => selectedVendor && handleSendRequest(selectedVendor, requestMessage)}
              disabled={Boolean(sendingId) || !requestMessage.trim()}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-black disabled:opacity-50"
            >
              {sendingId === selectedVendor?.id
                ? t('marketplaceFeatures.findVendor.common.sending')
                : t('marketplaceFeatures.findVendor.modal.send')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default FindVendor