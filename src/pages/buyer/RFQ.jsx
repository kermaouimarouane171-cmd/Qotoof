/**
 * pages/buyer/RFQ.jsx
 * Buyer's Request-for-Quote management page.
 *
 * Features:
 *  - List own RFQs with status badges and offer counts
 *  - Create new RFQ via modal form
 *  - View all vendor offers on a selected RFQ
 *  - Accept a vendor offer (closes the RFQ)
 *  - Cancel an open RFQ
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { useTranslation } from 'react-i18next'
import rfqService from '@/services/rfqService'
import { PRODUCT_CATEGORIES } from '@/modules/catalog'
import { formatPrice } from '@/utils/currency'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  XMarkIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  StarIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'

// ─── Constants ───────────────────────────────────────────────────────────────

const UNITS = ['kg', 'tonne', 'box', 'crate', 'piece', 'dozen', 'litre']

const STATUS_META = {
  open:       { labelKey: 'buyer.rfq.status.open',       classes: 'bg-green-100 text-green-700' },
  closed:     { labelKey: 'buyer.rfq.status.closed',     classes: 'bg-blue-100 text-blue-700' },
  expired:    { labelKey: 'buyer.rfq.status.expired',    classes: 'bg-gray-200 text-gray-600' },
  cancelled:  { labelKey: 'buyer.rfq.status.cancelled',  classes: 'bg-red-100 text-red-600' },
}

const OFFER_STATUS_META = {
  pending:    { labelKey: 'buyer.rfq.offerStatus.pending',   classes: 'bg-yellow-100 text-yellow-700' },
  accepted:   { labelKey: 'buyer.rfq.offerStatus.accepted',  classes: 'bg-green-100 text-green-700' },
  rejected:   { labelKey: 'buyer.rfq.offerStatus.rejected',  classes: 'bg-red-100 text-red-600' },
  withdrawn:  { labelKey: 'buyer.rfq.offerStatus.withdrawn', classes: 'bg-gray-200 text-gray-600' },
}

const EMPTY_FORM = {
  title: '', description: '', category: 'vegetables',
  quantity: '', unit: 'kg', budgetMax: '', city: '', deadline: '',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status, meta, t }) {
  const m = meta[status] || { labelKey: null, label: status, classes: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${m.classes}`}>
      {m.labelKey ? t(m.labelKey, m.label || status) : (m.label || status)}
    </span>
  )
}

function RFQCard({ rfq, onViewOffers, onCancel, t }) {
  const cat = PRODUCT_CATEGORIES.find((c) => c.id === rfq.category)

  return (
    <Card className="p-4 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{cat?.icon}</span>
            <h3 className="text-sm font-semibold text-gray-900 truncate">{rfq.title}</h3>
            <StatusBadge status={rfq.status} meta={STATUS_META} t={t} />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {rfq.quantity} {rfq.unit}
            {rfq.city ? ` • ${rfq.city}` : ''}
            {rfq.deadline ? ` • ${t('buyer.rfq.deadline', 'Deadline')}: ${new Date(rfq.deadline).toLocaleDateString()}` : ''}
          </p>
          {rfq.budget_max && (
            <p className="text-xs text-gray-500">{t('buyer.rfq.maxBudget', 'Max Budget')}: {formatPrice(rfq.budget_max)}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-gray-900">{rfq.offersCount}</p>
          <p className="text-xs text-gray-500">{t('buyer.rfq.offers', 'offers')}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {rfq.status === 'open' && (
          <>
            <button
              type="button"
              onClick={() => onViewOffers(rfq)}
              className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1"
            >
              {t('buyer.rfq.viewOffers', 'View Offers')}
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onCancel(rfq.id)}
              className="btn-outline text-xs px-3 py-1.5 text-red-600 border-red-300 hover:bg-red-50"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </>
        )}
        {(rfq.status === 'closed' || rfq.status === 'expired') && (
          <button
            type="button"
            onClick={() => onViewOffers(rfq)}
            className="btn-outline text-xs px-3 py-1.5 inline-flex items-center gap-1"
          >
            {t('buyer.rfq.viewDetails', 'View Details')}
          </button>
        )}
      </div>
    </Card>
  )
}

function OfferRow({ offer, rfqStatus, winningOfferId, onAccept, t }) {
  const isWinner = offer.id === winningOfferId
  const vendorName = offer.vendor?.store_name
    || `${offer.vendor?.first_name || ''} ${offer.vendor?.last_name || ''}`.trim()
    || t('buyer.rfq.vendorFallback', 'Vendor')

  return (
    <div className={`p-3 rounded-lg border ${isWinner ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{vendorName}</p>
            {offer.vendor?.city && (
              <span className="text-xs text-gray-500">{offer.vendor.city}</span>
            )}
            <StatusBadge status={offer.status} meta={OFFER_STATUS_META} t={t} />
          </div>
          {offer.vendor?.average_rating > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <StarIcon className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs text-gray-600">{Number(offer.vendor.average_rating).toFixed(1)}</span>
            </div>
          )}
          {offer.message && (
            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{offer.message}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-gray-900">{formatPrice(offer.price_per_unit)}</p>
          <p className="text-xs text-gray-500">/ {t('buyer.rfq.unit', 'unit')}</p>
          {offer.total_price && (
            <p className="text-xs font-medium text-green-700 mt-0.5">{formatPrice(offer.total_price)} {t('buyer.rfq.total', 'total')}</p>
          )}
        </div>
      </div>

      {rfqStatus === 'open' && offer.status === 'pending' && (
        <button
          type="button"
          onClick={() => onAccept(offer.id)}
          className="mt-2 btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1 w-full justify-center"
        >
          <CheckCircleIcon className="w-3.5 h-3.5" />
          {t('buyer.rfq.acceptOffer', 'Accept This Offer')}
        </button>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const BuyerRFQ = () => {
  const { user } = useAuthStore()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [loading, setLoading]           = useState(true)
  const [rfqs, setRFQs]                 = useState([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [submitting, setSubmitting]     = useState(false)
  const [selectedRFQ, setSelectedRFQ]   = useState(null)
  const [cancelRFQId, setCancelRFQId]   = useState(null)
  const [offers, setOffers]             = useState([])
  const [offersLoading, setOffersLoading] = useState(false)

  const loadRFQs = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const data = await rfqService.getBuyerRFQs(user.id)
      setRFQs(data)
    } catch (err) {
      logger.error('[BuyerRFQ] loadRFQs', err)
      toast.error(t('buyer.rfq.errors.loadFailed', 'Failed to load your requests'))
    } finally {
      setLoading(false)
    }
  }, [user?.id, t])

  useEffect(() => { loadRFQs() }, [loadRFQs])

  const handleViewOffers = async (rfq) => {
    setSelectedRFQ(rfq)
    setOffersLoading(true)
    try {
      const data = await rfqService.getOffersForRFQ(rfq.id)
      setOffers(data)
    } catch (err) {
      logger.error('[BuyerRFQ] getOffersForRFQ', err)
      toast.error(t('buyer.rfq.errors.loadOffersFailed', 'Failed to load offers'))
    } finally {
      setOffersLoading(false)
    }
  }

  const handleAcceptOffer = async (offerId) => {
    if (!selectedRFQ) return
    try {
      await rfqService.acceptOffer(selectedRFQ.id, offerId)
      toast.success(t('buyer.rfq.success.offerAccepted', 'Offer accepted and request closed'))
      setSelectedRFQ(null)
      setOffers([])
      await loadRFQs()
    } catch (err) {
      logger.error('[BuyerRFQ] acceptOffer', err)
      toast.error(t('buyer.rfq.errors.acceptFailed', 'Failed to accept offer'))
    }
  }

  const handleCancel = (rfqId) => {
    setCancelRFQId(rfqId)
  }

  const confirmCancel = async () => {
    const rfqId = cancelRFQId
    setCancelRFQId(null)
    try {
      await rfqService.cancelRFQ(rfqId, user.id)
      toast.success(t('buyer.rfq.success.cancelled', 'Request cancelled'))
      await loadRFQs()
    } catch (err) {
      logger.error('[BuyerRFQ] cancelRFQ', err)
      toast.error(t('buyer.rfq.errors.cancelFailed', 'Failed to cancel request'))
    }
  }

  const handleSubmitNew = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.quantity) {
      toast.error(t('buyer.rfq.errors.titleAndQuantityRequired', 'Title and quantity are required'))
      return
    }
    setSubmitting(true)
    try {
      await rfqService.createRFQ({ ...form, buyerId: user.id })
      toast.success(t('buyer.rfq.success.created', 'Request for quote published'))
      setShowNewModal(false)
      setForm(EMPTY_FORM)
      await loadRFQs()
    } catch (err) {
      logger.error('[BuyerRFQ] createRFQ', err)
      toast.error(err?.message || t('buyer.rfq.errors.createFailed', 'Failed to create request'))
    } finally {
      setSubmitting(false)
    }
  }

  const openRFQCount  = rfqs.filter((r) => r.status === 'open').length
  const closedRFQCount = rfqs.filter((r) => r.status === 'closed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/marketplace')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t('common.backToMarketplace', 'Back to marketplace')}
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('buyer.rfq.title', 'Request for Quotes')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('buyer.rfq.subtitle', 'Post your product needs and receive vendor offers — choose the best price and quality.')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          {t('buyer.rfq.newRequest', 'New Request')}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{rfqs.length}</p>
          <p className="text-xs text-gray-500 mt-1">{t('buyer.rfq.summary.total', 'Total Requests')}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{openRFQCount}</p>
          <p className="text-xs text-gray-500 mt-1">{t('buyer.rfq.summary.open', 'Open')}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{closedRFQCount}</p>
          <p className="text-xs text-gray-500 mt-1">{t('buyer.rfq.summary.completed', 'Completed')}</p>
        </Card>
      </div>

      {/* RFQ list */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : rfqs.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          <p className="text-lg font-medium">{t('buyer.rfq.empty.title', 'No requests yet')}</p>
          <p className="text-sm mt-1">{t('buyer.rfq.empty.desc', 'Post your first request and receive vendor offers.')}</p>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="btn-primary mt-4 inline-flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            {t('buyer.rfq.empty.createButton', 'Create Request')}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rfqs.map((rfq) => (
            <RFQCard
              key={rfq.id}
              rfq={rfq}
              onViewOffers={handleViewOffers}
              onCancel={handleCancel}
              t={t}
            />
          ))}
        </div>
      )}

      {/* ─── New RFQ Modal ─── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">{t('buyer.rfq.modal.title', 'New Quote Request')}</h2>
              <button type="button" onClick={() => setShowNewModal(false)}>
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmitNew} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('buyer.rfq.form.title', 'Request Title')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={t('buyer.rfq.form.titlePlaceholder', 'e.g., Need 500kg fresh tomatoes')}
                  className="input w-full"
                  maxLength={120}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('buyer.rfq.form.category', 'Category')}</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input w-full"
                  >
                    {PRODUCT_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.labelAr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('buyer.rfq.form.quantity', 'Quantity')} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      required
                      min="0.1"
                      step="0.1"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                      placeholder="500"
                      className="input w-full"
                    />
                    <select
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      className="input w-24"
                    >
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('buyer.rfq.form.maxBudget', 'Max Budget (MAD)')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.budgetMax}
                    onChange={(e) => setForm({ ...form, budgetMax: e.target.value })}
                    placeholder={t('buyer.rfq.form.optional', 'Optional')}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('buyer.rfq.form.city', 'City')}</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder={t('buyer.rfq.form.cityPlaceholder', 'Casablanca')}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('buyer.rfq.form.deadline', 'Offer Deadline')}</label>
                <input
                  type="date"
                  value={form.deadline}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('buyer.rfq.form.description', 'Additional Details')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder={t('buyer.rfq.form.descriptionPlaceholder', 'Quality specs, preferred delivery method...')}
                  className="input w-full resize-none"
                  maxLength={500}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="btn-outline flex-1"
                  disabled={submitting}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
                  disabled={submitting}
                >
                  {submitting ? <LoadingSpinner size="sm" /> : null}
                  {t('buyer.rfq.form.submit', 'Publish Request')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Offers Drawer ─── */}
      {selectedRFQ && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900">{selectedRFQ.title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedRFQ.quantity} {selectedRFQ.unit}
                  {selectedRFQ.city ? ` • ${selectedRFQ.city}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedRFQ(null); setOffers([]) }}
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {offersLoading ? (
                <div className="py-10 flex justify-center"><LoadingSpinner size="lg" /></div>
              ) : offers.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-10">{t('buyer.rfq.noOffersYet', 'No offers yet.')}</p>
              ) : (
                offers.map((offer) => (
                  <OfferRow
                    key={offer.id}
                    offer={offer}
                    rfqStatus={selectedRFQ.status}
                    winningOfferId={selectedRFQ.winning_offer_id}
                    onAccept={handleAcceptOffer}
                    t={t}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Cancel Confirmation Modal ─── */}
      {cancelRFQId && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('buyer.rfq.confirmCancel', 'Are you sure you want to cancel this request?')}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('buyer.rfq.cancelTitle', 'Cancel Request')}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {t('buyer.rfq.confirmCancel', 'Are you sure you want to cancel this request?')}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancelRFQId(null)}
                className="btn-outline flex-1"
              >
                {t('common.no', 'No')}
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors"
              >
                {t('common.yes', 'Yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BuyerRFQ
