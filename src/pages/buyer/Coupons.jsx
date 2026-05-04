import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner } from '@/components/ui'
import { useTranslation } from 'react-i18next'
import { couponsApi } from '@/services/coupons'
import { formatPrice } from '@/utils/currency'
import {
  TagIcon,
  ClipboardDocumentIcon,
  ShoppingBagIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const BuyerCoupons = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)

  const loadCoupons = useCallback(async () => {
    if (!user?.id) {
      setCoupons([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data } = await couponsApi.getAvailableCoupons(user.id, { limit: 100 })
      setCoupons(data || [])
    } catch (error) {
      logger.error('Error loading coupons:', error)
      toast.error(t('buyer.coupons.notifications.loadFailed', 'Failed to load coupons'))
    } finally {
      setLoading(false)
    }
  }, [t, user?.id])

  useEffect(() => {
    loadCoupons()
  }, [loadCoupons])

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success(t('buyer.coupons.notifications.copied', 'Coupon code copied!'))
    } catch {
      toast.error(t('buyer.coupons.notifications.copyFailed', 'Failed to copy'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const availableCoupons = coupons.filter(c => !c.is_expired && !c.is_used_up)
  const expiredCoupons = coupons.filter(c => c.is_expired || c.is_used_up)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/buyer/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t('common.back', 'Back to dashboard')}
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TagIcon className="w-7 h-7 text-green-600" />
              {t('buyer.coupons.title', 'My Coupons')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {availableCoupons.length} {t('buyer.coupons.subtitle', 'available coupon(s)')}
            </p>
          </div>
        </div>
      </div>

      {/* Available Coupons */}
      {availableCoupons.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-amber-500" />
            {t('buyer.coupons.availableSection', 'Available Coupons')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableCoupons.map(coupon => (
              <CouponCard
                key={coupon.id}
                coupon={coupon}
                onCopy={() => handleCopyCode(coupon.code)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expired/Used Coupons */}
      {expiredCoupons.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-500 mb-4">{t('buyer.coupons.expiredSection', 'Expired & Used')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
            {expiredCoupons.map(coupon => (
              <CouponCard
                key={coupon.id}
                coupon={coupon}
                onCopy={() => handleCopyCode(coupon.code)}
                isExpired
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {coupons.length === 0 && (
        <Card className="p-12 text-center">
          <TagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('buyer.coupons.emptyTitle', 'No coupons available')}</h3>
          <p className="text-gray-500 mb-6">{t('buyer.coupons.emptyDesc', 'Browse stores to find available coupons and offers')}</p>
          <button
            onClick={() => navigate('/marketplace')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <ShoppingBagIcon className="w-5 h-5" />
            {t('buyer.coupons.browseMarketplace', 'Browse Marketplace')}
          </button>
        </Card>
      )}
    </div>
  )
}

// ============================================
// Coupon Card Component
// ============================================

const CouponCard = ({ coupon, onCopy, isExpired, t }) => {
  const discountText = coupon.discount_type === 'percentage'
    ? `${coupon.discount_value}% OFF`
    : `${formatPrice(coupon.discount_value)} OFF`

  return (
    <Card className={`relative overflow-hidden border-2 border-dashed transition-all ${
      isExpired ? 'border-gray-200 bg-gray-50' : 'border-green-300 bg-green-50/30 hover:shadow-md'
    }`}>
      {/* Discount Badge */}
      <div className={`absolute top-0 right-0 px-4 py-2 rounded-bl-xl text-sm font-bold ${
        isExpired ? 'bg-gray-200 text-gray-500' : 'bg-green-600 text-white'
      }`}>
        {discountText}
      </div>

      <div className="p-5 pr-24">
        {/* Vendor */}
        <p className="text-xs text-gray-500 mb-1">
          {coupon.vendor?.store_name || t('buyer.coupons.vendorFallback', 'Qotoof')}
        </p>

        {/* Title */}
        <h3 className={`font-semibold text-base mb-1 ${isExpired ? 'text-gray-400' : 'text-gray-900'}`}>
          {coupon.title || t('buyer.coupons.titleFallback', 'Special Offer')}
        </h3>

        {/* Description */}
        {coupon.description && (
          <p className="text-xs text-gray-500 mb-3">{coupon.description}</p>
        )}

        {/* Conditions */}
        <div className="flex flex-wrap gap-2 mb-3">
          {coupon.min_order_amount && (
            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
              {t('buyer.coupons.minLabel', 'Min')}: {formatPrice(coupon.min_order_amount)}
            </span>
          )}
          {coupon.expires_at && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
              isExpired ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
            }`}>
              <ClockIcon className="w-3 h-3" />
              {new Date(coupon.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {coupon.max_uses && (
            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
              {coupon.total_usage}/{coupon.max_uses} {t('buyer.coupons.usedLabel', 'used')}
            </span>
          )}
        </div>

        {/* Code + Copy Button */}
        <div className="flex items-center gap-2">
          <code className={`flex-1 px-3 py-2 rounded-lg text-sm font-mono font-bold text-center ${
            isExpired ? 'bg-gray-200 text-gray-400' : 'bg-white border border-green-200 text-green-700'
          }`}>
            {coupon.code}
          </code>
          <button
            onClick={onCopy}
            disabled={isExpired}
            className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
              isExpired
                ? 'bg-gray-200 text-gray-400'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
            aria-label={t('buyer.coupons.copyAriaLabel', 'Copy coupon code')}
          >
            <ClipboardDocumentIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Card>
  )
}

export default BuyerCoupons
