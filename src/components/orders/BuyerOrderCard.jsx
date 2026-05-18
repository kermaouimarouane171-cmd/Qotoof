/**
 * BuyerOrderCard — memoized order card for the buyer orders page.
 *
 * Extracted from src/pages/buyer/Orders.jsx to keep the page file focused
 * on data-fetching and pagination logic.
 */

import React, { useMemo } from 'react'
import { Card } from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import { getOrderStatusColors, getOrderStatusLabel } from '@/constants/orderStatuses'
import toast from 'react-hot-toast'
import {
  TruckIcon,
  MapPinIcon,
  ClockIcon,
  CheckCircleIcon,
  ShoppingBagIcon,
  ArrowPathIcon,
  StarIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  ClipboardDocumentIcon,
  DocumentArrowDownIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'

// ── Private helpers & constants ───────────────────────────────────────────────

const STATUS_FLOW = [
  'pending',
  'vendor_accepted',
  'driver_assigned',
  'driver_accepted',
  'driver_picked_up',
  'on_the_way',
  'delivered',
]

const STATUS_ICONS = {
  pending:          ClockIcon,
  vendor_accepted:  CheckCircleIcon,
  vendor_rejected:  XMarkIcon,
  driver_assigned:  TruckIcon,
  driver_accepted:  CheckCircleIcon,
  driver_picked_up: ShoppingBagIcon,
  on_the_way:       TruckIcon,
  delivered:        CheckCircleIcon,
  cancelled:        XMarkIcon,
}

const getProgressPercentage = (status) => {
  if (status === 'vendor_rejected' || status === 'cancelled') return 0
  if (status === 'delivered') return 100
  const index = STATUS_FLOW.indexOf(status)
  if (index === -1) return 0
  return Math.round((index / (STATUS_FLOW.length - 1)) * 100)
}

const canReorder = (order) => order?.status === 'delivered'

const canReview = (order) => {
  if (order?.status !== 'delivered') return false
  if (!order?.delivered_at) return false
  const diffDays = (Date.now() - new Date(order.delivered_at)) / (1000 * 60 * 60 * 24)
  return diffDays <= 7
}

const canRequestReturn = (order) => {
  if (order?.status !== 'delivered') return false
  if (!order?.delivered_at) return false
  const diffHours = (Date.now() - new Date(order.delivered_at)) / (1000 * 60 * 60)
  return diffHours <= 24
}

const formatAddress = (address, city) => {
  const parts = [address, city].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'No address provided'
}

const timeAgo = (dateString, t) => {
  const date = new Date(dateString)
  const diffMs = Date.now() - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return t('buyer.orders.time.justNow', 'Just now')
  if (diffMins < 60) return `${diffMins}${t('buyer.orders.time.minutesAgo', 'm ago')}`
  if (diffHours < 24) return `${diffHours}${t('buyer.orders.time.hoursAgo', 'h ago')}`
  if (diffDays < 7) return `${diffDays}${t('buyer.orders.time.daysAgo', 'd ago')}`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const copyOrderNumber = async (orderNumber, t) => {
  try {
    await navigator.clipboard.writeText(orderNumber)
    toast.success(t('buyer.orders.notifications.orderNumberCopied', 'Order number copied!'))
  } catch {
    toast.error(t('buyer.orders.notifications.failedToCopy', 'Failed to copy'))
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const BuyerOrderCard = React.memo(({ order, onReorder, onReview, onReturn, onViewDetails, onDownloadInvoice, isSelected, onSelect, t }) => {
  const colors = getOrderStatusColors(order.status)
  const StatusIcon = STATUS_ICONS[order.status] || ClockIcon
  const progress = getProgressPercentage(order.status)
  const isCancelled = order.status === 'cancelled' || order.status === 'vendor_rejected'
  const isDelivered = order.status === 'delivered'
  const showReview = canReview(order)
  const showReturn = canRequestReturn(order)
  const showReorder = canReorder(order)

  const productImages = useMemo(() => {
    if (!order.items) return []
    return order.items
      .slice(0, 3)
      .map(item => ({
        name: item.product?.name || t('buyer.orders.product', 'Product'),
        image: item.product?.images?.[0]?.url || item.product?.image_url,
        quantity: item.quantity,
      }))
  }, [order.items, t])

  return (
    <Card className={`overflow-hidden border transition-all duration-300 hover:shadow-lg ${
      isCancelled ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'
    }`}>
      {/* Selection Checkbox + Status Header */}
      <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(order.id) }}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              isSelected
                ? 'bg-green-600 border-green-600'
                : 'border-gray-300 hover:border-green-400'
            }`}
            aria-label={`Select order ${order.order_number}`}
          >
            {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
          </button>

          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
              <StatusIcon className="w-4 h-4" />
            </div>
            <div>
              <span className={`text-sm font-semibold ${colors.text}`}>{t(`buyer.orders.status.${order.status}`, getOrderStatusLabel(order.status))}</span>
              <p className="text-xs text-gray-400">{timeAgo(order.created_at, t)}</p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">{formatPrice(order.total)}</p>
        </div>
      </div>

      {/* Progress Bar */}
      {!isCancelled && (
        <div className="px-4 sm:px-6 py-2 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%`, backgroundColor: colors.hex }}
              />
            </div>
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{t('buyer.orders.orderCard.progress', '{{progress}}%', { progress })}</span>
          </div>
        </div>
      )}

      {/* Order Info */}
      <div className="px-4 sm:px-6 py-4">
        {/* Order Number + Copy */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => copyOrderNumber(order.order_number, t)}
            className="inline-flex items-center gap-1.5 text-sm font-mono font-medium text-gray-700 hover:text-green-600 transition-colors"
            title={t('buyer.orders.orderCard.copyOrderNumber', 'Click to copy')}
            aria-label={`${t('buyer.orders.orderCard.copyOrderNumber', 'Click to copy')} ${order.order_number}`}
          >
            {order.order_number}
            <ClipboardDocumentIcon className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>

        {/* Vendor */}
        <p className="text-sm text-gray-500 mb-3">
          {order.vendor?.store_name || `${order.vendor?.first_name || ''} ${order.vendor?.last_name || ''}`}
        </p>

        {/* Product Thumbnails */}
        {productImages.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            {productImages.map((product, idx) => (
              <div key={idx} className="relative group">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg">🌱</div>
                  )}
                </div>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-gray-800 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {product.quantity}
                </span>
              </div>
            ))}
            {order.items?.length > 3 && (
              <span className="text-xs text-gray-400 ml-1">+{order.items.length - 3} {t('buyer.orders.orderCard.more', 'more')}</span>
            )}
          </div>
        )}

        {/* Delivery Address */}
        {order.shipping_address && (
          <div className="flex items-start gap-2 text-xs text-gray-500 mb-3">
            <MapPinIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{formatAddress(order.shipping_address, order.shipping_city)}</span>
          </div>
        )}

        {order.requested_delivery_date && order.requested_delivery_slot_label && (
          <div className="flex items-start gap-2 text-xs text-indigo-700 mb-3 bg-indigo-50 rounded-lg p-3">
            <ClockIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>موعد التسليم: {order.requested_delivery_date} • {order.requested_delivery_slot_label}</span>
          </div>
        )}

        {/* Cancellation / Rejection Reason */}
        {isCancelled && order.cancellation_reason && (
          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-3 mb-3">
            <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{order.cancellation_reason}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={() => onViewDetails(order.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <EyeIcon className="w-4 h-4" />
            {t('buyer.orders.orderCard.details', 'Details')}
          </button>

          <button
            onClick={() => onDownloadInvoice(order)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            {t('buyer.orders.orderCard.invoice', 'Invoice')}
          </button>

          {showReorder && (
            <button
              onClick={() => onReorder(order)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm shadow-green-600/20"
            >
              <ArrowPathIcon className="w-4 h-4" />
              {t('buyer.orders.orderCard.reorder', 'Re-order')}
            </button>
          )}

          {!isCancelled && !isDelivered && (
            <button
              onClick={() => onViewDetails(order.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-sm shadow-orange-500/20"
            >
              <TruckIcon className="w-4 h-4" />
              {t('buyer.orders.orderCard.track', 'Track')}
            </button>
          )}

          {showReview && (
            <button
              onClick={() => onReview(order)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
            >
              <StarIcon className="w-4 h-4" />
              {t('buyer.orders.orderCard.review', 'Review')}
            </button>
          )}

          {showReturn && (
            <button
              onClick={() => onReturn(order)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              {t('buyer.orders.orderCard.return', 'Return')}
            </button>
          )}

          {isCancelled && (
            <button
              onClick={() => onViewDetails(order.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
              {t('buyer.orders.orderCard.contactSupport', 'Contact Support')}
            </button>
          )}
        </div>
      </div>
    </Card>
  )
})

BuyerOrderCard.displayName = 'BuyerOrderCard'

export default BuyerOrderCard
