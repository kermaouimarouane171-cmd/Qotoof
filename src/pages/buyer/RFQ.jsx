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
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import rfqService from '@/services/rfqService'
import { PRODUCT_CATEGORIES } from '@/constants/categories'
import { formatPrice } from '@/utils/currency'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  XMarkIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  StarIcon,
} from '@heroicons/react/24/outline'

// ─── Constants ───────────────────────────────────────────────────────────────

const UNITS = ['kg', 'tonne', 'box', 'crate', 'piece', 'dozen', 'litre']

const STATUS_META = {
  open:       { label: 'مفتوح',      classes: 'bg-green-100 text-green-700' },
  closed:     { label: 'مغلق',       classes: 'bg-blue-100 text-blue-700' },
  expired:    { label: 'منتهي',      classes: 'bg-gray-200 text-gray-600' },
  cancelled:  { label: 'ملغى',       classes: 'bg-red-100 text-red-600' },
}

const OFFER_STATUS_META = {
  pending:    { label: 'قيد الانتظار', classes: 'bg-yellow-100 text-yellow-700' },
  accepted:   { label: 'مقبول',        classes: 'bg-green-100 text-green-700' },
  rejected:   { label: 'مرفوض',        classes: 'bg-red-100 text-red-600' },
  withdrawn:  { label: 'مسحوب',        classes: 'bg-gray-200 text-gray-600' },
}

const EMPTY_FORM = {
  title: '', description: '', category: 'vegetables',
  quantity: '', unit: 'kg', budgetMax: '', city: '', deadline: '',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status, meta }) {
  const m = meta[status] || { label: status, classes: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${m.classes}`}>
      {m.label}
    </span>
  )
}

function RFQCard({ rfq, onViewOffers, onCancel }) {
  const cat = PRODUCT_CATEGORIES.find((c) => c.id === rfq.category)

  return (
    <Card className="p-4 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{cat?.icon}</span>
            <h3 className="text-sm font-semibold text-gray-900 truncate">{rfq.title}</h3>
            <StatusBadge status={rfq.status} meta={STATUS_META} />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {rfq.quantity} {rfq.unit}
            {rfq.city ? ` • ${rfq.city}` : ''}
            {rfq.deadline ? ` • آخر أجل: ${new Date(rfq.deadline).toLocaleDateString('ar-MA')}` : ''}
          </p>
          {rfq.budget_max && (
            <p className="text-xs text-gray-500">الميزانية القصوى: {formatPrice(rfq.budget_max)}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-gray-900">{rfq.offersCount}</p>
          <p className="text-xs text-gray-500">عرض</p>
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
              عروض المورّدين
              <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onCancel(rfq.id)}
              className="btn-outline text-xs px-3 py-1.5 text-red-600 border-red-300 hover:bg-red-50"
            >
              إلغاء
            </button>
          </>
        )}
        {(rfq.status === 'closed' || rfq.status === 'expired') && (
          <button
            type="button"
            onClick={() => onViewOffers(rfq)}
            className="btn-outline text-xs px-3 py-1.5 inline-flex items-center gap-1"
          >
            عرض التفاصيل
          </button>
        )}
      </div>
    </Card>
  )
}

function OfferRow({ offer, rfqStatus, winningOfferId, onAccept }) {
  const isWinner = offer.id === winningOfferId
  const vendorName = offer.vendor?.store_name
    || `${offer.vendor?.first_name || ''} ${offer.vendor?.last_name || ''}`.trim()
    || 'مورّد'

  return (
    <div className={`p-3 rounded-lg border ${isWinner ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{vendorName}</p>
            {offer.vendor?.city && (
              <span className="text-xs text-gray-500">{offer.vendor.city}</span>
            )}
            <StatusBadge status={offer.status} meta={OFFER_STATUS_META} />
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
          <p className="text-xs text-gray-500">/ وحدة</p>
          {offer.total_price && (
            <p className="text-xs font-medium text-green-700 mt-0.5">{formatPrice(offer.total_price)} إجمالي</p>
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
          قبول هذا العرض
        </button>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const BuyerRFQ = () => {
  const { user } = useAuthStore()

  const [loading, setLoading]           = useState(true)
  const [rfqs, setRFQs]                 = useState([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [submitting, setSubmitting]     = useState(false)
  const [selectedRFQ, setSelectedRFQ]   = useState(null)
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
      toast.error('تعذّر تحميل طلباتك')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { loadRFQs() }, [loadRFQs])

  const handleViewOffers = async (rfq) => {
    setSelectedRFQ(rfq)
    setOffersLoading(true)
    try {
      const data = await rfqService.getOffersForRFQ(rfq.id)
      setOffers(data)
    } catch (err) {
      logger.error('[BuyerRFQ] getOffersForRFQ', err)
      toast.error('تعذّر تحميل العروض')
    } finally {
      setOffersLoading(false)
    }
  }

  const handleAcceptOffer = async (offerId) => {
    if (!selectedRFQ) return
    try {
      await rfqService.acceptOffer(selectedRFQ.id, offerId)
      toast.success('تم قبول العرض وإغلاق الطلب')
      setSelectedRFQ(null)
      setOffers([])
      await loadRFQs()
    } catch (err) {
      logger.error('[BuyerRFQ] acceptOffer', err)
      toast.error('تعذّر قبول العرض')
    }
  }

  const handleCancel = async (rfqId) => {
    if (!window.confirm('هل أنت متأكد من إلغاء هذا الطلب؟')) return
    try {
      await rfqService.cancelRFQ(rfqId, user.id)
      toast.success('تم إلغاء الطلب')
      await loadRFQs()
    } catch (err) {
      logger.error('[BuyerRFQ] cancelRFQ', err)
      toast.error('تعذّر إلغاء الطلب')
    }
  }

  const handleSubmitNew = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.quantity) {
      toast.error('العنوان والكمية إلزاميان')
      return
    }
    setSubmitting(true)
    try {
      await rfqService.createRFQ({ ...form, buyerId: user.id })
      toast.success('تم نشر طلب عرض الأسعار')
      setShowNewModal(false)
      setForm(EMPTY_FORM)
      await loadRFQs()
    } catch (err) {
      logger.error('[BuyerRFQ] createRFQ', err)
      toast.error(err?.message || 'تعذّر إنشاء الطلب')
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">طلبات عروض الأسعار</h1>
          <p className="text-sm text-gray-500 mt-1">
            انشر احتياجك من البضاعة وانتظر عروض الموردين — اختر الأفضل سعراً وجودةً.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="btn-primary inline-flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          طلب جديد
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{rfqs.length}</p>
          <p className="text-xs text-gray-500 mt-1">إجمالي الطلبات</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{openRFQCount}</p>
          <p className="text-xs text-gray-500 mt-1">مفتوحة</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{closedRFQCount}</p>
          <p className="text-xs text-gray-500 mt-1">مكتملة</p>
        </Card>
      </div>

      {/* RFQ list */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : rfqs.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          <p className="text-lg font-medium">لا توجد طلبات بعد</p>
          <p className="text-sm mt-1">انشر أول طلب وستصلك عروض الموردين.</p>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="btn-primary mt-4 inline-flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            إنشاء طلب
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
            />
          ))}
        </div>
      )}

      {/* ─── New RFQ Modal ─── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">طلب عرض أسعار جديد</h2>
              <button type="button" onClick={() => setShowNewModal(false)}>
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleSubmitNew} className="p-5 space-y-4">
              <div>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  عنوان الطلب <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: أحتاج 500 كغ طماطم طازجة"
                  className="input w-full"
                  maxLength={120}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
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
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الكمية <span className="text-red-500">*</span>
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
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    الميزانية القصوى (درهم)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.budgetMax}
                    onChange={(e) => setForm({ ...form, budgetMax: e.target.value })}
                    placeholder="اختياري"
                    className="input w-full"
                  />
                </div>
                <div>
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label className="block text-sm font-medium text-gray-700 mb-1">المدينة</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="الدار البيضاء"
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="block text-sm font-medium text-gray-700 mb-1">آخر أجل للعروض</label>
                <input
                  type="date"
                  value={form.deadline}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="block text-sm font-medium text-gray-700 mb-1">تفاصيل إضافية</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="مواصفات الجودة، طريقة التسليم المفضلة..."
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
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
                  disabled={submitting}
                >
                  {submitting ? <LoadingSpinner size="sm" /> : null}
                  نشر الطلب
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
                <p className="text-center text-sm text-gray-500 py-10">لا توجد عروض بعد.</p>
              ) : (
                offers.map((offer) => (
                  <OfferRow
                    key={offer.id}
                    offer={offer}
                    rfqStatus={selectedRFQ.status}
                    winningOfferId={selectedRFQ.winning_offer_id}
                    onAccept={handleAcceptOffer}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BuyerRFQ
