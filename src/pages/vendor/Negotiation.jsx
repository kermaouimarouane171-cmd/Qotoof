import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { logger } from '@/utils/logger'
import OfferCard from '@/components/negotiations/OfferCard'
import {
  fetchNegotiation,
  acceptNegotiation,
  rejectNegotiation,
  counterNegotiation,
  subscribeToNegotiation,
  expireStaleNegotiations,
  NEGOTIATION_STATUS,
  NEGOTIATION_MAX_ROUNDS,
} from '@/services/negotiationService'

export default function VendorNegotiation() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [negotiation, setNegotiation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCounterForm, setShowCounterForm] = useState(false)
  const [counterPrice, setCounterPrice] = useState('')
  const [counterNote, setCounterNote] = useState('')

  const loadNegotiation = useCallback(async () => {
    try {
      const data = await fetchNegotiation(id)
      if (!data) {
        setError(t('negotiation.errors.notFound', 'التفاوض غير موجود'))
        return
      }
      if (data.vendor_id !== user?.id) {
        setError(t('negotiation.errors.forbidden', 'لا يمكنك عرض هذا التفاوض'))
        return
      }
      setNegotiation(data)
    } catch (err) {
      logger.error('Failed to load negotiation:', err)
      setError(err.message || t('negotiation.errors.loadFailed', 'فشل تحميل التفاوض'))
    }
  }, [id, user, t])

  useEffect(() => {
    if (!user) return
    expireStaleNegotiations()
    setLoading(true)
    loadNegotiation().finally(() => setLoading(false))
  }, [user, loadNegotiation])

  useEffect(() => {
    if (!id) return
    const unsubscribe = subscribeToNegotiation(id, (updated) => {
      setNegotiation(updated)
    })
    return unsubscribe
  }, [id])

  const canRespond = negotiation
    && (negotiation.status === NEGOTIATION_STATUS.PENDING || negotiation.status === NEGOTIATION_STATUS.COUNTERED)
    && negotiation.offer_by === 'buyer'

  const canCounter = canRespond
    && negotiation.round_number < NEGOTIATION_MAX_ROUNDS

  const handleAccept = async () => {
    setActionLoading(true)
    try {
      await acceptNegotiation(id, {})
      toast.success(t('negotiation.accepted', 'تم قبول العرض'))
      await loadNegotiation()
    } catch (err) {
      toast.error(err.message || t('negotiation.errors.acceptFailed', 'فشل قبول العرض'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    setActionLoading(true)
    try {
      await rejectNegotiation(id, {})
      toast.success(t('negotiation.rejected', 'تم رفض العرض'))
      await loadNegotiation()
    } catch (err) {
      toast.error(err.message || t('negotiation.errors.rejectFailed', 'فشل رفض العرض'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleCounter = async () => {
    const price = Number(counterPrice)
    if (!price || price <= 0) {
      toast.error(t('negotiation.errors.invalidPrice', 'السعر غير صالح'))
      return
    }
    setActionLoading(true)
    try {
      await counterNegotiation(id, {
        proposedPrice: price,
        note: counterNote || null,
        offerBy: 'vendor',
      })
      toast.success(t('negotiation.counterSent', 'تم إرسال العرض المقابل'))
      setShowCounterForm(false)
      setCounterPrice('')
      setCounterNote('')
      await loadNegotiation()
    } catch (err) {
      toast.error(err.message || t('negotiation.errors.counterFailed', 'فشل إرسال العرض المقابل'))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Link to="/vendor/orders" className="text-green-600 dark:text-green-400 text-sm font-medium hover:underline">
            {t('negotiation.backToOrders', 'العودة للطلبات')}
          </Link>
        </Card>
      </div>
    )
  }

  if (!negotiation) return null

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link
        to="/vendor/orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        {t('negotiation.backToOrders', 'العودة للطلبات')}
      </Link>

      <OfferCard negotiation={negotiation} viewerRole="vendor">
        {/* ── Vendor action buttons ─────────────────────────────────── */}
        {canRespond && !showCounterForm && (
          <div className="space-y-3">
            <button
              onClick={handleAccept}
              disabled={actionLoading}
              className="w-full py-3 px-4 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircleIcon className="w-5 h-5" />
              {t('negotiation.acceptOffer', 'قبول العرض')}
            </button>

            {canCounter && (
              <button
                onClick={() => setShowCounterForm(true)}
                disabled={actionLoading}
                className="w-full py-3 px-4 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowPathIcon className="w-5 h-5" />
                {t('negotiation.counterOffer', 'عرض مقابل')}
              </button>
            )}

            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="w-full py-3 px-4 rounded-xl bg-white dark:bg-gray-800 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
            >
              <XCircleIcon className="w-5 h-5" />
              {t('negotiation.rejectOffer', 'رفض العرض')}
            </button>
          </div>
        )}

        {/* Counter-offer form */}
        {showCounterForm && canCounter && (
          <Card className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {t('negotiation.yourPrice', 'سعرك المقترح')} (MAD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {t('negotiation.note', 'ملاحظة (اختياري)')}
              </label>
              <textarea
                value={counterNote}
                onChange={(e) => setCounterNote(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder={t('negotiation.notePlaceholder', 'أضف ملاحظة للمشتري...')}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCounter}
                disabled={actionLoading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? t('common.sending', 'جاري الإرسال...') : t('negotiation.sendCounter', 'إرسال')}
              </button>
              <button
                onClick={() => setShowCounterForm(false)}
                disabled={actionLoading}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel', 'إلغاء')}
              </button>
            </div>
          </Card>
        )}

        {/* Status messages for closed negotiations */}
        {!canRespond && negotiation.status === NEGOTIATION_STATUS.ACCEPTED && (
          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-center">
            <CheckCircleIcon className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              {t('negotiation.acceptedWaitingBuyer', 'تم قبول العرض — بانتظار قيام المشتري بالدفع')}
            </p>
          </div>
        )}

        {!canRespond && negotiation.status === NEGOTIATION_STATUS.CONVERTED && (
          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-center">
            <CheckCircleIcon className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              {t('negotiation.convertedToOrder', 'تم تحويل العرض إلى طلب بنجاح')}
            </p>
            {negotiation.converted_order_id && (
              <Link
                to={`/orders/${negotiation.converted_order_id}`}
                className="inline-block mt-2 text-xs text-green-600 dark:text-green-400 font-medium hover:underline"
              >
                {t('negotiation.viewOrder', 'عرض الطلب')}
              </Link>
            )}
          </div>
        )}

        {!canRespond && negotiation.status === NEGOTIATION_STATUS.REJECTED && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-center">
            <XCircleIcon className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {t('negotiation.offerRejected', 'تم رفض العرض')}
            </p>
          </div>
        )}

        {!canRespond && negotiation.status === NEGOTIATION_STATUS.EXPIRED && (
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 p-4 text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {t('negotiation.offerExpired', 'انتهت صلاحية العرض')}
            </p>
          </div>
        )}
      </OfferCard>
    </div>
  )
}
