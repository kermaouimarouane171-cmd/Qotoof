import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, LoadingSpinner, Badge, Modal } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { returnsApi, subscribeToVendorReturns } from '@/services/returns'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftEllipsisIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META = {
  pending:           { color: 'bg-yellow-100 text-yellow-700', icon: ClockIcon },
  vendor_approved:   { color: 'bg-blue-100 text-blue-700',   icon: CheckCircleIcon },
  vendor_rejected:   { color: 'bg-red-100 text-red-600',     icon: XCircleIcon },
  refund_issued:     { color: 'bg-green-100 text-green-700', icon: CheckCircleIcon },
  escalated:         { color: 'bg-orange-100 text-orange-700', icon: ExclamationTriangleIcon },
  closed:            { color: 'bg-gray-100 text-gray-600',   icon: CheckCircleIcon },
  cancelled_by_buyer:{ color: 'bg-gray-100 text-gray-500',   icon: XCircleIcon },
}

const PAGE_SIZE = 20

const getLocale = (lang) =>
  lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-US'

const formatDate = (value, lang) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(getLocale(lang), {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// ─── Return Card ─────────────────────────────────────────────────────────────

function ReturnCard({ returnReq, onRespond, t, lang }) {
  const [expanded, setExpanded] = useState(false)
  const meta = STATUS_META[returnReq.status] || { color: 'bg-gray-100 text-gray-600', icon: ClockIcon }
  const StatusIcon = meta.icon
  const isPending = returnReq.status === 'pending'
  const buyerName = returnReq.buyer
    ? `${returnReq.buyer.first_name || ''} ${returnReq.buyer.last_name || ''}`.trim()
    : t('vendor.returns.unknownBuyer', 'مشترٍ')

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        className="w-full flex items-start justify-between gap-3 p-4 text-right hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start gap-3 min-w-0">
          <StatusIcon className={`w-5 h-5 shrink-0 mt-0.5 ${isPending ? 'text-yellow-500' : 'text-gray-400'}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              #{returnReq.order?.order_number}
              {' · '}
              <span className="font-normal text-gray-600">
                {Array.isArray(returnReq.items) && returnReq.items.length > 0
                  ? `${returnReq.items.length} ${t('vendor.returns.items', 'منتج')}`
                  : t('vendor.returns.returnRequest', 'طلب إرجاع')}
              </span>
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {buyerName} · {formatDate(returnReq.created_at, lang)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {t(`vendor.returns.reason.${returnReq.reason}`, returnReq.reason)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${meta.color}`}>
            {t(`vendor.returns.status.${returnReq.status}`, returnReq.status)}
          </span>
          {expanded ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {returnReq.description && (
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">
              <p className="text-xs text-gray-500 mb-1">{t('vendor.returns.buyerDescription', 'وصف المشتري')}</p>
              <p>{returnReq.description}</p>
            </div>
          )}

          {returnReq.image_urls?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {returnReq.image_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={t('vendor.returns.photoAlt', 'صورة الإرجاع {{n}}', { n: i + 1 })}
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:opacity-80"
                  />
                </a>
              ))}
            </div>
          )}

          {returnReq.admin_response && (
            <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-800">
              <p className="text-xs text-blue-500 mb-1">{t('vendor.returns.yourResponse', 'ردّك')}</p>
              <p>{returnReq.admin_response}</p>
            </div>
          )}

          {isPending && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onRespond(returnReq, 'approved')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700"
              >
                <CheckCircleIcon className="w-4 h-4" />
                {t('vendor.returns.actions.approve', 'قبول الإرجاع')}
              </button>
              <button
                type="button"
                onClick={() => onRespond(returnReq, 'rejected')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50"
              >
                <XCircleIcon className="w-4 h-4" />
                {t('vendor.returns.actions.reject', 'رفض الإرجاع')}
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VendorReturns() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const lang = i18n.language

  const [returns, setReturns]     = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [page, setPage]           = useState(0)
  const [statusFilter, setStatusFilter] = useState('')

  const [respondModal, setRespondModal]     = useState(null)  // { returnReq, action }
  const [responseNotes, setResponseNotes]   = useState('')
  const [submitting, setSubmitting]         = useState(false)

  const channelRef = useRef(null)

  const loadReturns = useCallback(async (p = 0, status = '') => {
    if (!user?.id) return
    setLoading(true)
    try {
      const result = await returnsApi.getVendorReturns(user.id, {
        offset: p * PAGE_SIZE,
        limit: PAGE_SIZE,
        ...(status ? { status } : {}),
      })
      setReturns(result.data)
      setTotal(result.total)
    } catch (err) {
      logger.error('[VendorReturns] loadReturns', err)
      toast.error(t('vendor.returns.errors.loadFailed', 'تعذّر تحميل طلبات الإرجاع'))
    } finally {
      setLoading(false)
    }
  }, [user?.id, t])

  useEffect(() => {
    loadReturns(page, statusFilter)
  }, [loadReturns, page, statusFilter])

  // Real-time: new return arrives → reload first page
  useEffect(() => {
    if (!user?.id) return
    channelRef.current = subscribeToVendorReturns(user.id, () => {
      loadReturns(0, statusFilter)
    })
    return () => {
      channelRef.current?.unsubscribe?.()
    }
  }, [user?.id, statusFilter, loadReturns])

  const handleRespond = (returnReq, action) => {
    setRespondModal({ returnReq, action })
    setResponseNotes('')
  }

  const confirmRespond = async () => {
    if (!respondModal) return
    setSubmitting(true)
    try {
      await returnsApi.respondToReturnRequest(
        respondModal.returnReq.id,
        user.id,
        respondModal.action,
        responseNotes.trim()
      )
      toast.success(
        respondModal.action === 'approved'
          ? t('vendor.returns.notifications.approved', 'تم قبول طلب الإرجاع')
          : t('vendor.returns.notifications.rejected', 'تم رفض طلب الإرجاع')
      )
      setRespondModal(null)
      setResponseNotes('')
      await loadReturns(page, statusFilter)
    } catch (err) {
      logger.error('[VendorReturns] confirmRespond', err)
      toast.error(t('vendor.returns.errors.respondFailed', 'تعذّر إرسال الرد'))
    } finally {
      setSubmitting(false)
    }
  }

  const pendingCount = returns.filter((r) => r.status === 'pending').length
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const FILTER_OPTIONS = [
    { value: '', label: t('vendor.returns.filters.all', 'الكل') },
    { value: 'pending', label: t('vendor.returns.filters.pending', 'بانتظار الرد') },
    { value: 'vendor_approved', label: t('vendor.returns.filters.approved', 'مقبولة') },
    { value: 'vendor_rejected', label: t('vendor.returns.filters.rejected', 'مرفوضة') },
    { value: 'refund_issued', label: t('vendor.returns.filters.refunded', 'مُستردّة') },
    { value: 'closed', label: t('vendor.returns.filters.closed', 'مغلقة') },
  ]

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('vendor.returns.title', 'طلبات الإرجاع')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('vendor.returns.subtitle', 'إدارة طلبات الإرجاع والاسترداد من المشترين')}</p>
        </div>
        <button
          type="button"
          onClick={() => loadReturns(page, statusFilter)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh', 'تحديث')}
        </button>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && !loading && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800">
          <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">
            {t('vendor.returns.pendingAlert', 'لديك {{count}} طلب إرجاع بانتظار ردّك', { count: pendingCount })}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setStatusFilter(opt.value); setPage(0) }}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              statusFilter === opt.value
                ? 'bg-green-600 text-white border-green-600'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : returns.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          <ChatBubbleLeftEllipsisIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="font-medium">{t('vendor.returns.empty', 'لا توجد طلبات إرجاع')}</p>
          <p className="text-sm mt-1">{t('vendor.returns.emptyHint', 'ستظهر هنا طلبات الإرجاع التي يرسلها المشترون')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {returns.map((r) => (
            <ReturnCard
              key={r.id}
              returnReq={r}
              onRespond={handleRespond}
              t={t}
              lang={lang}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
          >
            {t('common.previous', 'السابق')}
          </button>
          <span className="text-sm text-gray-600">
            {t('common.pageOf', 'صفحة {{current}} من {{total}}', { current: page + 1, total: totalPages })}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40"
          >
            {t('common.next', 'التالي')}
          </button>
        </div>
      )}

      {/* Respond Modal */}
      <Modal
        isOpen={!!respondModal}
        onClose={() => { if (!submitting) setRespondModal(null) }}
        title={
          respondModal?.action === 'approved'
            ? t('vendor.returns.modal.approveTitle', 'قبول طلب الإرجاع')
            : t('vendor.returns.modal.rejectTitle', 'رفض طلب الإرجاع')
        }
        size="sm"
      >
        <div className="space-y-4">
          {respondModal && (
            <div className={`rounded-xl border p-3 text-sm ${respondModal.action === 'approved' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
              <p className="font-medium">
                #{respondModal.returnReq.order?.order_number} · {Array.isArray(respondModal.returnReq.items) && respondModal.returnReq.items.length > 0 ? `${respondModal.returnReq.items.length} ${t('vendor.returns.items', 'منتج')}` : t('vendor.returns.returnRequest', 'طلب إرجاع')}
              </p>
              <p className="text-xs mt-0.5">{t(`vendor.returns.reason.${respondModal.returnReq.reason}`, respondModal.returnReq.reason)}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('vendor.returns.modal.notesLabel', 'رسالة للمشتري (اختياري)')}
            </label>
            <textarea
              value={responseNotes}
              onChange={(e) => setResponseNotes(e.target.value)}
              rows={3}
              placeholder={
                respondModal?.action === 'approved'
                  ? t('vendor.returns.modal.approveNotesPlaceholder', 'مثال: يرجى إعادة المنتج خلال 3 أيام...')
                  : t('vendor.returns.modal.rejectNotesPlaceholder', 'مثال: المنتج المُعاد لا يستوفي شروط الإرجاع...')
              }
              className="input w-full resize-none"
              maxLength={300}
              disabled={submitting}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRespondModal(null)}
              disabled={submitting}
              className="btn-outline flex-1"
            >
              {t('common.cancel', 'إلغاء')}
            </button>
            <button
              type="button"
              onClick={confirmRespond}
              disabled={submitting}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium ${respondModal?.action === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-50`}
            >
              {submitting && <LoadingSpinner size="sm" />}
              {respondModal?.action === 'approved'
                ? t('vendor.returns.modal.confirmApprove', 'تأكيد القبول')
                : t('vendor.returns.modal.confirmReject', 'تأكيد الرفض')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
