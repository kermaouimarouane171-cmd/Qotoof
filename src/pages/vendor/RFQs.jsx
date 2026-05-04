/**
 * pages/vendor/RFQs.jsx
 * Vendor's RFQ board — browse buyer requests and submit price offers.
 *
 * Features:
 *  - Browse all open RFQs (filterable by category / city / search)
 *  - Submit a price offer on any open RFQ
 *  - Track own submitted offers and their status
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
  MagnifyingGlassIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  ClockIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline'

// ─── Constants ───────────────────────────────────────────────────────────────

const OFFER_STATUS_META = {
  pending:   { label: 'قيد الانتظار', classes: 'bg-yellow-100 text-yellow-700' },
  accepted:  { label: 'مقبول',        classes: 'bg-green-100 text-green-700' },
  rejected:  { label: 'مرفوض',        classes: 'bg-red-100 text-red-600' },
  withdrawn: { label: 'مسحوب',        classes: 'bg-gray-200 text-gray-600' },
}

const TABS = [
  { id: 'board',  label: 'لوحة الطلبات' },
  { id: 'offers', label: 'عروضي' },
]

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status, meta }) {
  const m = meta[status] || { label: status, classes: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${m.classes}`}>
      {m.label}
    </span>
  )
}

function RFQBoardCard({ rfq, alreadyOffered, onSubmitOffer }) {
  const cat = PRODUCT_CATEGORIES.find((c) => c.id === rfq.category)
  const buyerName = rfq.buyer
    ? `${rfq.buyer.first_name || ''} ${rfq.buyer.last_name || ''}`.trim() || 'مشترٍ'
    : 'مشترٍ'

  const isExpiringSoon = rfq.deadline
    ? (new Date(rfq.deadline) - Date.now()) / (1000 * 60 * 60 * 24) < 2
    : false

  return (
    <Card className="p-4 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{cat?.icon}</span>
            <h3 className="text-sm font-semibold text-gray-900 truncate">{rfq.title}</h3>
            {isExpiringSoon && (
              <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                <ClockIcon className="w-3 h-3" />
                ينتهي قريباً
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            بواسطة {buyerName}
            {rfq.buyer?.city || rfq.city ? ` • ${rfq.buyer?.city || rfq.city}` : ''}
          </p>
          <p className="text-sm font-medium text-gray-700 mt-1">
            {rfq.quantity} {rfq.unit}
            {rfq.budget_max ? ` • ميزانية: ${formatPrice(rfq.budget_max)}` : ''}
          </p>
          {rfq.deadline && (
            <p className="text-xs text-gray-500">
              آخر أجل: {new Date(rfq.deadline).toLocaleDateString('ar-MA')}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-gray-900">{rfq.offersCount}</p>
          <p className="text-xs text-gray-500">عرض</p>
        </div>
      </div>

      <div className="mt-3">
        {alreadyOffered ? (
          <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
            <CheckBadgeIcon className="w-4 h-4" />
            قدّمت عرضاً على هذا الطلب
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSubmitOffer(rfq)}
            className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 w-full justify-center"
          >
            <PaperAirplaneIcon className="w-3.5 h-3.5" />
            تقديم عرض سعر
          </button>
        )}
      </div>
    </Card>
  )
}

function MyOfferRow({ offer, onWithdraw }) {
  const rfqTitle = offer.rfq?.title || 'طلب'
  const cat = PRODUCT_CATEGORIES.find((c) => c.id === offer.rfq?.category)

  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {cat && <span>{cat.icon}</span>}
          <p className="text-sm font-medium text-gray-900 truncate">{rfqTitle}</p>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {offer.rfq?.quantity} {offer.rfq?.unit}
          {offer.rfq?.city ? ` • ${offer.rfq.city}` : ''}
        </p>
        {offer.message && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{offer.message}</p>
        )}
      </div>
      <div className="shrink-0 text-right space-y-1">
        <p className="text-sm font-bold text-gray-900">{formatPrice(offer.price_per_unit)}/وحدة</p>
        <StatusBadge status={offer.status} meta={OFFER_STATUS_META} />
        {offer.status === 'pending' && (
          <button
            type="button"
            onClick={() => onWithdraw(offer.id)}
            className="block text-xs text-red-500 hover:underline mt-1"
          >
            سحب العرض
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const VendorRFQs = () => {
  const { user } = useAuthStore()

  const [activeTab, setActiveTab]     = useState('board')
  const [boardLoading, setBoardLoading] = useState(true)
  const [offersLoading, setOffersLoading] = useState(false)
  const [rfqs, setRFQs]               = useState([])
  const [myOffers, setMyOffers]       = useState([])

  const [filters, setFilters]         = useState({ category: '', city: '', search: '' })
  const [appliedFilters, setAppliedFilters] = useState({ category: '', city: '', search: '' })

  // offer form modal
  const [targetRFQ, setTargetRFQ]     = useState(null)
  const [offerForm, setOfferForm]     = useState({ pricePerUnit: '', message: '' })
  const [submitting, setSubmitting]   = useState(false)

  // set of rfq IDs the vendor already offered on
  const offeredRFQIds = new Set(myOffers.map((o) => o.rfq?.id))

  const loadBoard = useCallback(async () => {
    setBoardLoading(true)
    try {
      const data = await rfqService.getOpenRFQs(appliedFilters)
      setRFQs(data)
    } catch (err) {
      logger.error('[VendorRFQs] loadBoard', err)
      toast.error('تعذّر تحميل الطلبات')
    } finally {
      setBoardLoading(false)
    }
  }, [appliedFilters])

  const loadMyOffers = useCallback(async () => {
    if (!user?.id) return
    setOffersLoading(true)
    try {
      const data = await rfqService.getVendorOffers(user.id)
      setMyOffers(data)
    } catch (err) {
      logger.error('[VendorRFQs] loadMyOffers', err)
      toast.error('تعذّر تحميل عروضك')
    } finally {
      setOffersLoading(false)
    }
  }, [user?.id])

  useEffect(() => { loadBoard() }, [loadBoard])
  useEffect(() => { loadMyOffers() }, [loadMyOffers])

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters })
  }

  const handleClearFilters = () => {
    const empty = { category: '', city: '', search: '' }
    setFilters(empty)
    setAppliedFilters(empty)
  }

  const handleSubmitOffer = async (e) => {
    e.preventDefault()
    if (!offerForm.pricePerUnit || Number(offerForm.pricePerUnit) <= 0) {
      toast.error('يرجى إدخال سعر صحيح')
      return
    }
    setSubmitting(true)
    try {
      await rfqService.submitOffer({
        rfqId:       targetRFQ.id,
        vendorId:    user.id,
        pricePerUnit: offerForm.pricePerUnit,
        message:     offerForm.message,
      })
      toast.success('تم تقديم عرضك بنجاح')
      setTargetRFQ(null)
      setOfferForm({ pricePerUnit: '', message: '' })
      await Promise.all([loadBoard(), loadMyOffers()])
    } catch (err) {
      logger.error('[VendorRFQs] submitOffer', err)
      toast.error(err?.message || 'تعذّر تقديم العرض')
    } finally {
      setSubmitting(false)
    }
  }

  const handleWithdraw = async (offerId) => {
    if (!window.confirm('هل تريد سحب هذا العرض؟')) return
    try {
      await rfqService.withdrawOffer(offerId, user.id)
      toast.success('تم سحب العرض')
      await loadMyOffers()
    } catch (err) {
      logger.error('[VendorRFQs] withdrawOffer', err)
      toast.error('تعذّر سحب العرض')
    }
  }

  const acceptedCount = myOffers.filter((o) => o.status === 'accepted').length
  const pendingCount  = myOffers.filter((o) => o.status === 'pending').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">لوحة طلبات المشترين</h1>
        <p className="text-sm text-gray-500 mt-1">
          تصفّح طلبات الجملة من المشترين وقدّم عروض أسعارك التنافسية.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{rfqs.length}</p>
          <p className="text-xs text-gray-500">طلبات مفتوحة</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-xs text-gray-500">عروضي المعلقة</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{acceptedCount}</p>
          <p className="text-xs text-gray-500">عروض مقبولة</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Board Tab ── */}
      {activeTab === 'board' && (
        <>
          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="بحث..."
                  className="input w-full pr-9"
                />
              </div>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="input w-full"
              >
                <option value="">كل الفئات</option>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.labelAr}</option>
                ))}
              </select>
              <input
                type="text"
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                placeholder="المدينة"
                className="input w-full"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={handleApplyFilters} className="btn-primary text-sm px-4">
                تطبيق
              </button>
              <button type="button" onClick={handleClearFilters} className="btn-outline text-sm px-4">
                إعادة ضبط
              </button>
            </div>
          </Card>

          {boardLoading ? (
            <div className="py-16 flex justify-center"><LoadingSpinner size="lg" /></div>
          ) : rfqs.length === 0 ? (
            <Card className="p-10 text-center text-gray-500">
              <p className="text-lg font-medium">لا توجد طلبات مفتوحة حالياً</p>
              <p className="text-sm mt-1">تحقق لاحقاً أو غيّر معايير البحث.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {rfqs.map((rfq) => (
                <RFQBoardCard
                  key={rfq.id}
                  rfq={rfq}
                  alreadyOffered={offeredRFQIds.has(rfq.id)}
                  onSubmitOffer={setTargetRFQ}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── My Offers Tab ── */}
      {activeTab === 'offers' && (
        <Card className="p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-3">عروضي المقدَّمة</h3>
          {offersLoading ? (
            <div className="py-10 flex justify-center"><LoadingSpinner size="lg" /></div>
          ) : myOffers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              لم تقدّم أي عروض بعد. تصفّح لوحة الطلبات وابدأ البيع.
            </p>
          ) : (
            <div>
              {myOffers.map((offer) => (
                <MyOfferRow key={offer.id} offer={offer} onWithdraw={handleWithdraw} />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Submit Offer Modal ── */}
      {targetRFQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-base font-bold">تقديم عرض سعر</h2>
                <p className="text-xs text-gray-500 mt-0.5">{targetRFQ.title}</p>
              </div>
              <button type="button" onClick={() => setTargetRFQ(null)}>
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmitOffer} className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 space-y-1">
                <p><span className="font-medium">الكمية:</span> {targetRFQ.quantity} {targetRFQ.unit}</p>
                {targetRFQ.budget_max && (
                  <p><span className="font-medium">الميزانية القصوى:</span> {formatPrice(targetRFQ.budget_max)}</p>
                )}
                {targetRFQ.city && (
                  <p><span className="font-medium">المدينة:</span> {targetRFQ.city}</p>
                )}
                {targetRFQ.deadline && (
                  <p><span className="font-medium">آخر أجل:</span> {new Date(targetRFQ.deadline).toLocaleDateString('ar-MA')}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  سعر الوحدة (درهم / {targetRFQ.unit}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={offerForm.pricePerUnit}
                  onChange={(e) => setOfferForm({ ...offerForm, pricePerUnit: e.target.value })}
                  placeholder="السعر لكل وحدة"
                  className="input w-full"
                />
                {offerForm.pricePerUnit && Number(offerForm.pricePerUnit) > 0 && (
                  <p className="text-xs text-green-700 mt-1">
                    السعر الإجمالي التقديري:{' '}
                    {formatPrice(Number(offerForm.pricePerUnit) * Number(targetRFQ.quantity))}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  رسالة للمشتري (اختياري)
                </label>
                <textarea
                  value={offerForm.message}
                  onChange={(e) => setOfferForm({ ...offerForm, message: e.target.value })}
                  rows={3}
                  placeholder="مواصفات ما تقدمه، تفاصيل التسليم..."
                  className="input w-full resize-none"
                  maxLength={300}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setTargetRFQ(null)}
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
                  {submitting ? <LoadingSpinner size="sm" /> : <PaperAirplaneIcon className="w-4 h-4" />}
                  إرسال العرض
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default VendorRFQs
