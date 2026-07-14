import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  TruckIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { Card } from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import { NEGOTIATION_STATUS } from '@/services/negotiationService'

const STATUS_CONFIG = {
  [NEGOTIATION_STATUS.PENDING]: {
    icon: ClockIcon,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    key: 'negotiation.status.pending',
    fallback: 'بانتظار الرد',
  },
  [NEGOTIATION_STATUS.ACCEPTED]: {
    icon: CheckCircleIcon,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    key: 'negotiation.status.accepted',
    fallback: 'مقبول',
  },
  [NEGOTIATION_STATUS.REJECTED]: {
    icon: XCircleIcon,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    key: 'negotiation.status.rejected',
    fallback: 'مرفوض',
  },
  [NEGOTIATION_STATUS.COUNTERED]: {
    icon: ArrowPathIcon,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    key: 'negotiation.status.countered',
    fallback: 'عرض مقابل',
  },
  [NEGOTIATION_STATUS.EXPIRED]: {
    icon: ExclamationCircleIcon,
    color: 'text-gray-500',
    bg: 'bg-gray-50 dark:bg-gray-800/40',
    border: 'border-gray-200 dark:border-gray-700',
    key: 'negotiation.status.expired',
    fallback: 'منتهي الصلاحية',
  },
  [NEGOTIATION_STATUS.CONVERTED]: {
    icon: CheckCircleIcon,
    color: 'text-green-700',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-300 dark:border-green-700',
    key: 'negotiation.status.converted',
    fallback: 'تم تحويله لطلب',
  },
}

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    if (!expiresAt) return
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      setRemaining(diff > 0 ? diff : 0)
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  if (!remaining) return null

  const hours = Math.floor(remaining / (1000 * 60 * 60))
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000)

  return { hours, minutes, seconds, expired: remaining === 0 }
}

function PartyInfo({ label, name, phone, email, t }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{name || '—'}</span>
      {phone && (
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <PhoneIcon className="w-3.5 h-3.5" />
          {phone}
        </span>
      )}
      {email && (
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <EnvelopeIcon className="w-3.5 h-3.5" />
          {email}
        </span>
      )}
    </div>
  )
}

/**
 * Reusable offer card shared by buyer and vendor negotiation pages.
 *
 * @param {Object} negotiation - The negotiation record with joined relations.
 * @param {('buyer'|'vendor')} viewerRole - Which side is viewing.
 * @param {React.ReactNode} [children] - Action buttons injected by parent.
 */
export default function OfferCard({ negotiation, viewerRole, children }) {
  const { t } = useTranslation()
  const countdown = useCountdown(negotiation.expires_at)
  const statusCfg = STATUS_CONFIG[negotiation.status] || STATUS_CONFIG[NEGOTIATION_STATUS.PENDING]
  const StatusIcon = statusCfg.icon

  const product = negotiation.product || {}
  const buyer = negotiation.buyer || {}
  const vendor = negotiation.vendor || {}

  const buyerName = `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim()
  const vendorName = vendor.store_name || `${vendor.first_name || ''} ${vendor.last_name || ''}`.trim()

  const productTotal = Number(negotiation.proposed_price) * Number(negotiation.proposed_quantity)
  const deliveryPrice = Number(negotiation.delivery_price || 0)
  const grandTotal = productTotal + deliveryPrice

  const isExpired = countdown?.expired || negotiation.status === NEGOTIATION_STATUS.EXPIRED

  return (
    <Card className={`p-5 sm:p-6 border ${statusCfg.border} ${statusCfg.bg}`}>
      {/* ── Status badge ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center gap-2 ${statusCfg.color}`}>
          <StatusIcon className="w-5 h-5" />
          <span className="text-sm font-bold">{t(statusCfg.key, statusCfg.fallback)}</span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {t('negotiation.round', 'الجولة')} {negotiation.round_number} / {negotiation.max_rounds}
        </span>
      </div>

      {/* ── Product ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-gray-800">
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{product.name || '—'}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('negotiation.originalPrice', 'السعر الأصلي')}: {formatPrice(negotiation.original_price)}
          </p>
        </div>
      </div>

      {/* ── Price comparison ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{t('negotiation.originalPrice', 'السعر الأصلي')}</p>
          <p className="text-lg font-bold text-gray-600 dark:text-gray-300 line-through">
            {formatPrice(negotiation.original_price)}
          </p>
        </div>
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 text-center border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-600 dark:text-green-400 mb-1">{t('negotiation.proposedPrice', 'السعر المقترح')}</p>
          <p className="text-2xl font-extrabold text-green-700 dark:text-green-300">
            {formatPrice(negotiation.proposed_price)}
          </p>
        </div>
      </div>

      {/* ── Quantity + totals ──────────────────────────────────────── */}
      <div className="space-y-2 mb-5">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">{t('negotiation.quantity', 'الكمية')}</span>
          <span className="font-medium text-gray-900 dark:text-white">{negotiation.proposed_quantity}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">{t('negotiation.productTotal', 'إجمالي المنتج')}</span>
          <span className="font-medium text-gray-900 dark:text-white">{formatPrice(productTotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <TruckIcon className="w-4 h-4" />
            {t('negotiation.delivery', 'التوصيل')}
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {deliveryPrice > 0 ? formatPrice(deliveryPrice) : t('negotiation.deliveryFree', 'مجاني')}
          </span>
        </div>
        {negotiation.delivery_distance_km != null && (
          <div className="flex justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
              <MapPinIcon className="w-3.5 h-3.5" />
              {t('negotiation.distance', 'المسافة')}
            </span>
            <span className="text-gray-400 dark:text-gray-500">{Number(negotiation.delivery_distance_km).toFixed(1)} km</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
          <span className="text-sm font-bold text-gray-900 dark:text-white">{t('negotiation.grandTotal', 'الإجمالي الكلي')}</span>
          <span className="text-lg font-extrabold text-green-700 dark:text-green-300">{formatPrice(grandTotal)}</span>
        </div>
      </div>

      {/* ── Party info ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 mb-5 pt-4 border-t border-gray-100 dark:border-gray-800">
        <PartyInfo
          label={t('negotiation.buyer', 'المشتري')}
          name={buyerName}
          phone={buyer.phone}
          email={buyer.email}
          t={t}
        />
        <PartyInfo
          label={t('negotiation.vendor', 'البائع')}
          name={vendorName}
          phone={vendor.phone}
          email={vendor.email}
          t={t}
        />
      </div>

      {/* ── Notes ──────────────────────────────────────────────────── */}
      {negotiation.buyer_note && (
        <div className="mb-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">{t('negotiation.buyerNote', 'ملاحظة المشتري')}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{negotiation.buyer_note}</p>
        </div>
      )}
      {negotiation.vendor_note && (
        <div className="mb-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">{t('negotiation.vendorNote', 'ملاحظة البائع')}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300">{negotiation.vendor_note}</p>
        </div>
      )}

      {/* ── Expiry countdown ───────────────────────────────────────── */}
      {!isExpired && negotiation.status !== NEGOTIATION_STATUS.CONVERTED && (
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-4">
          <ClockIcon className="w-4 h-4" />
          {countdown && (
            <span>
              {t('negotiation.expiresIn', 'ينتهي خلال')}{' '}
              <span className="font-mono font-medium text-gray-600 dark:text-gray-300">
                {String(countdown.hours).padStart(2, '0')}:
                {String(countdown.minutes).padStart(2, '0')}:
                {String(countdown.seconds).padStart(2, '0')}
              </span>
            </span>
          )}
        </div>
      )}

      {/* ── Disclaimer ─────────────────────────────────────────────── */}
      {negotiation.status === NEGOTIATION_STATUS.PENDING || negotiation.status === NEGOTIATION_STATUS.COUNTERED ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic mb-4">
          {t('negotiation.disclaimer', 'هذا عرض غير مُلزم حتى الموافقة النهائية وإتمام الدفع')}
        </p>
      ) : null}

      {/* ── Action buttons (injected by parent) ────────────────────── */}
      {children && <div className="mt-2">{children}</div>}
    </Card>
  )
}
