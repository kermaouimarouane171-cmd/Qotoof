import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { Card, LoadingSpinner } from '@/components/ui'
import { useTranslation } from 'react-i18next'
import { ordersApi, deliveriesApi } from '@/services/deliveries'
import { formatPrice } from '@/utils/currency'
import {
  TruckIcon,
  MapPinIcon,
  PhoneIcon,
  ClockIcon,
  CheckCircleIcon,
  ShoppingBagIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  StarIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  ClipboardDocumentIcon,
  DocumentArrowDownIcon,
  ChevronDownIcon,
  CheckIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { supabase } from '@/services/supabase'
import reviewService from '@/services/reviewService'
import invoiceService from '@/services/invoiceService'
import loyaltyApi from '@/services/loyalty'
// @react-pdf/renderer is loaded dynamically inside handleDownloadInvoice (see below)

// ============================================
// Constants & Helpers
// ============================================

const STATUS_FLOW = [
  'pending',
  'vendor_accepted',
  'driver_assigned',
  'driver_accepted',
  'driver_picked_up',
  'on_the_way',
  'delivered',
]

const STATUS_CONFIG = {
  pending:            { label: 'Pending',              color: '#F59E0B', bg: 'bg-amber-100',    text: 'text-amber-700',    icon: ClockIcon },
  vendor_accepted:    { label: 'Accepted by Vendor',   color: '#F59E0B', bg: 'bg-amber-100',    text: 'text-amber-700',    icon: CheckCircleIcon },
  vendor_rejected:    { label: 'Rejected by Vendor',   color: '#EF4444', bg: 'bg-red-100',      text: 'text-red-700',      icon: XMarkIcon },
  driver_assigned:    { label: 'Driver Assigned',      color: '#F97316', bg: 'bg-orange-100',   text: 'text-orange-700',   icon: TruckIcon },
  driver_accepted:    { label: 'Driver Accepted',      color: '#F97316', bg: 'bg-orange-100',   text: 'text-orange-700',   icon: CheckCircleIcon },
  driver_picked_up:   { label: 'Picked Up',            color: '#F97316', bg: 'bg-orange-100',   text: 'text-orange-700',   icon: ShoppingBagIcon },
  on_the_way:         { label: 'On the Way',           color: '#F97316', bg: 'bg-orange-100',   text: 'text-orange-700',   icon: TruckIcon },
  delivered:          { label: 'Delivered',            color: '#10B981', bg: 'bg-emerald-100',  text: 'text-emerald-700',  icon: CheckCircleIcon },
  cancelled:          { label: 'Cancelled',            color: '#EF4444', bg: 'bg-red-100',      text: 'text-red-700',      icon: XMarkIcon },
}

const FILTER_TABS = [
  { id: 'all', label: 'All Orders' },
  { id: 'active', label: 'In Progress' },
  { id: 'delivered', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

const ACTIVE_STATUSES = ['pending', 'vendor_accepted', 'driver_assigned', 'driver_accepted', 'driver_picked_up', 'on_the_way']

const PAYMENT_STATUS_OPTIONS = [
  { id: '', label: 'All Payments' },
  { id: 'paid', label: 'Paid' },
  { id: 'pending', label: 'Pending' },
  { id: 'cod', label: 'Cash on Delivery' },
]

/**
 * Returns progress percentage (0-100) based on status position in flow
 */
const getProgressPercentage = (status) => {
  if (status === 'vendor_rejected' || status === 'cancelled') return 0
  if (status === 'delivered') return 100
  const index = STATUS_FLOW.indexOf(status)
  if (index === -1) return 0
  return Math.round((index / (STATUS_FLOW.length - 1)) * 100)
}

/**
 * Checks if an order can be re-ordered
 */
const canReorder = (order) => {
  return order?.status === 'delivered'
}

/**
 * Checks if an order can be reviewed (delivered within last 7 days)
 */
const canReview = (order) => {
  if (order?.status !== 'delivered') return false
  if (!order?.delivered_at) return false
  const deliveredDate = new Date(order.delivered_at)
  const now = new Date()
  const diffDays = (now - deliveredDate) / (1000 * 60 * 60 * 24)
  return diffDays <= 7
}

/**
 * Checks if a return can be requested (delivered within last 24 hours)
 */
const canRequestReturn = (order) => {
  if (order?.status !== 'delivered') return false
  if (!order?.delivered_at) return false
  const deliveredDate = new Date(order.delivered_at)
  const now = new Date()
  const diffHours = (now - deliveredDate) / (1000 * 60 * 60)
  return diffHours <= 24
}

/**
 * Formats address for display
 */
const formatAddress = (address, city) => {
  const parts = [address, city].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'No address provided'
}

/**
 * Returns relative time string ("2 days ago", "5 hours ago")
 */
const timeAgo = (dateString, t) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return t('buyer.orders.time.justNow', 'Just now')
  if (diffMins < 60) return `${diffMins}${t('buyer.orders.time.minutesAgo', 'm ago')}`
  if (diffHours < 24) return `${diffHours}${t('buyer.orders.time.hoursAgo', 'h ago')}`
  if (diffDays < 7) return `${diffDays}${t('buyer.orders.time.daysAgo', 'd ago')}`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Copies order number to clipboard
 */
const copyOrderNumber = async (orderNumber, t) => {
  try {
    await navigator.clipboard.writeText(orderNumber)
    toast.success(t('buyer.orders.notifications.orderNumberCopied', 'Order number copied!'))
  } catch {
    toast.error(t('buyer.orders.notifications.failedToCopy', 'Failed to copy'))
  }
}

// ============================================
// Invoice PDF Document (using @react-pdf/renderer)
// ============================================

// InvoicePDF and pdfStyles are defined inside handleDownloadInvoice below
// using a dynamic import so @react-pdf/renderer (643 kB) only loads on demand.

// ============================================
// Order Card Component (memoized)
// ============================================

const OrderCard = React.memo(({ order, onReorder, onReview, onReturn, onViewDetails, onDownloadInvoice, isSelected, onSelect, t }) => {
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
  const StatusIcon = status.icon
  const progress = getProgressPercentage(order.status)
  const isCancelled = order.status === 'cancelled' || order.status === 'vendor_rejected'
  const isDelivered = order.status === 'delivered'
  const showReview = canReview(order)
  const showReturn = canRequestReturn(order)
  const showReorder = canReorder(order)

  // Get product images (up to 3)
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
          {/* Select Checkbox */}
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
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${status.bg} ${status.text}`}>
              <StatusIcon className="w-4 h-4" />
            </div>
            <div>
              <span className={`text-sm font-semibold ${status.text}`}>{t(`buyer.orders.status.${order.status}`, status.label)}</span>
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
                style={{
                  width: `${progress}%`,
                  backgroundColor: status.color,
                }}
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
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg">
                      🌱
                    </div>
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

        {/* Delivery Address — visible on ALL screen sizes */}
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
          {/* View Details */}
          <button
            onClick={() => onViewDetails(order.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <EyeIcon className="w-4 h-4" />
            {t('buyer.orders.orderCard.details', 'Details')}
          </button>

          {/* Download Invoice */}
          <button
            onClick={() => onDownloadInvoice(order)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
            {t('buyer.orders.orderCard.invoice', 'Invoice')}
          </button>

          {/* Re-order — prominent green */}
          {showReorder && (
            <button
              onClick={() => onReorder(order)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm shadow-green-600/20"
            >
              <ArrowPathIcon className="w-4 h-4" />
              {t('buyer.orders.orderCard.reorder', 'Re-order')}
            </button>
          )}

          {/* Track — prominent orange for active orders */}
          {!isCancelled && !isDelivered && (
            <button
              onClick={() => onViewDetails(order.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-sm shadow-orange-500/20"
            >
              <TruckIcon className="w-4 h-4" />
              {t('buyer.orders.orderCard.track', 'Track')}
            </button>
          )}

          {/* Review */}
          {showReview && (
            <button
              onClick={() => onReview(order)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
            >
              <StarIcon className="w-4 h-4" />
              {t('buyer.orders.orderCard.review', 'Review')}
            </button>
          )}

          {/* Return */}
          {showReturn && (
            <button
              onClick={() => onReturn(order)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              {t('buyer.orders.orderCard.return', 'Return')}
            </button>
          )}

          {/* Contact Support for cancelled/rejected */}
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

OrderCard.displayName = 'OrderCard'

// ============================================
// Review Modal Component
// ============================================

const ReviewModal = ({ order, onClose, onSubmit, t }) => {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error(t('buyer.orders.reviewModal.error', 'Please select a rating'))
      return
    }
    setSubmitting(true)
    try {
      await onSubmit(order.id, rating, comment)
      onClose()
    } catch (error) {
      logger.error('Error submitting review:', error)
      toast.error(t('buyer.orders.reviewModal.failed', 'Failed to submit review'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
      aria-hidden="false"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-dialog-title"
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id="review-dialog-title" className="text-lg font-semibold text-gray-900">
            {t('buyer.orders.reviewModal.title', 'Rate Your Experience')}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg" aria-label={t('common.close', 'Close')}>
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          {t('buyer.orders.reviewModal.question', 'How was your order {{orderNumber}} from {{vendor}}?', {
            orderNumber: order.order_number,
            vendor: order.vendor?.store_name || `${order.vendor?.first_name} ${order.vendor?.last_name}`,
          })}
        </p>

        {/* Star Rating */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110"
              aria-label={`${star} ${t('buyer.orders.reviewModal.star', 'star')}${star > 1 ? 's' : ''}`}
            >
              {star <= rating ? (
                <StarSolid className="w-10 h-10 text-yellow-400" />
              ) : (
                <StarIcon className="w-10 h-10 text-gray-300" />
              )}
            </button>
          ))}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none mb-4"
          placeholder={t('buyer.orders.reviewModal.commentPlaceholder', 'Share your experience (optional)...')}
        />

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-outline flex-1">
            {t('buyer.orders.reviewModal.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
          >
            {submitting ? t('buyer.orders.reviewModal.submitting', 'Submitting...') : t('buyer.orders.reviewModal.submit', 'Submit Review')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Advanced Filters Dropdown
// ============================================

const AdvancedFilters = ({ filters, onChange, onClear, orderCount, t }) => {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.priceMin || filters.priceMax || filters.paymentStatus

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
          hasActiveFilters
            ? 'border-green-300 bg-green-50 text-green-700'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <AdjustmentsHorizontalIcon className="w-4 h-4" />
        {t('buyer.orders.advancedFilters', 'Filters')}
        {hasActiveFilters && (
          <span className="w-5 h-5 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {[filters.dateFrom, filters.dateTo, filters.priceMin, filters.priceMax, filters.paymentStatus].filter(Boolean).length}
          </span>
        )}
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{t('buyer.orders.advancedFilters', 'Advanced Filters')}</h3>
            {hasActiveFilters && (
              <button onClick={onClear} className="text-xs text-green-600 hover:underline">
                {t('buyer.orders.clearFilters', 'Clear all')}
              </button>
            )}
          </div>

          {/* Date Range */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('buyer.orders.filters.dateRange', 'Date Range')}</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => onChange('dateFrom', e.target.value)}
                className="input text-xs py-2"
                placeholder={t('buyer.orders.filters.from', 'From')}
              />
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => onChange('dateTo', e.target.value)}
                className="input text-xs py-2"
                placeholder={t('buyer.orders.filters.to', 'To')}
              />
            </div>
          </div>

          {/* Price Range */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('buyer.orders.filters.priceRange', 'Price Range (MAD)')}</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder={t('buyer.orders.filters.min', 'Min')}
                min="0"
                value={filters.priceMin || ''}
                onChange={(e) => { const v = e.target.value; if (v === '' || parseFloat(v) >= 0) onChange('priceMin', v) }}
                className="input text-xs py-2"
              />
              <input
                type="number"
                placeholder={t('buyer.orders.filters.max', 'Max')}
                min="0"
                value={filters.priceMax || ''}
                onChange={(e) => { const v = e.target.value; if (v === '' || parseFloat(v) >= 0) onChange('priceMax', v) }}
                className="input text-xs py-2"
              />
            </div>
          </div>

          {/* Payment Status */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('buyer.orders.filters.paymentStatus', 'Payment Status')}</label>
            <select
              value={filters.paymentStatus || ''}
              onChange={(e) => onChange('paymentStatus', e.target.value)}
              className="input text-xs py-2 w-full"
            >
              {PAYMENT_STATUS_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{t(`buyer.orders.paymentStatus.${opt.id || 'all'}`, opt.label)}</option>
              ))}
            </select>
          </div>

          {/* Results count */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {t('buyer.orders.orderCount', 'Showing {{count}} order(s)', { count: orderCount })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Main Orders Page
// ============================================

const OrdersPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile, user } = useAuthStore()
  const { addItem } = useCartStore()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeDelivery, setActiveDelivery] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [reviewOrder, setReviewOrder] = useState(null)
  const [returnModalOpen, setReturnModalOpen] = useState(false)
  const [returnOrder, setReturnOrder] = useState(null)
  const [returnReason, setReturnReason] = useState('')
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState(new Set())
  const [_downloadingInvoice, setDownloadingInvoice] = useState(null)

  // Server-side pagination state
  const PAGE_SIZE = 20
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  // Advanced filters
  const [advancedFilters, setAdvancedFilters] = useState({
    dateFrom: '',
    dateTo: '',
    priceMin: '',
    priceMax: '',
    paymentStatus: '',
  })

  // Load orders with server-side pagination
  useEffect(() => {
    if (!profile?.id) return
    loadOrders(1) // Reset to page 1 on mount or filter change

    // Real-time subscription — only refresh current page, not all data
    const channel = ordersApi.subscribeToBuyerOrders(
      profile.id,
      () => loadOrders(page, true) // Silent refresh of current page
    )

    return () => channel.unsubscribe()
  }, [profile?.id, filter, advancedFilters.dateFrom, advancedFilters.dateTo])

  // Load active delivery
  useEffect(() => {
    if (!profile?.id) return
    loadActiveDelivery()
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return

    let cancelled = false

    const syncBuyerBenefits = async () => {
      try {
        const result = await loyaltyApi.syncDeliveredOrderBenefits(profile.id)
        if (!cancelled && result?.ordersProcessed > 0) {
          loadOrders(1, true)
        }
      } catch (error) {
        logger.warn('Buyer loyalty sync skipped:', error)
      }
    }

    syncBuyerBenefits()

    return () => {
      cancelled = true
    }
  }, [profile?.id])

  /**
   * Load orders from server with pagination
   * @param {number} pageNum - Page number to load
   * @param {boolean} silent - If true, don't show loading spinner
   */
  const loadOrders = async (pageNum = 1, silent = false) => {
    if (silent) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    try {
      // Build the base query
      let query = supabase
        .from('orders')
        .select(`
          *,
          vendor:profiles!vendor_id(first_name, last_name, store_name, phone),
          items:order_items(*, product:products(name, images:product_images(url, is_primary)))
        `, { count: 'exact' })
        .eq('buyer_id', profile.id)

      // Apply status filter server-side
      if (filter === 'active') {
        query = query.in('status', ACTIVE_STATUSES)
      } else if (filter === 'delivered') {
        query = query.eq('status', 'delivered')
      } else if (filter === 'cancelled') {
        query = query.in('status', ['cancelled', 'vendor_rejected'])
      }

      // Apply date range filter server-side
      if (advancedFilters.dateFrom) {
        query = query.gte('created_at', new Date(advancedFilters.dateFrom).toISOString())
      }
      if (advancedFilters.dateTo) {
        const endDate = new Date(advancedFilters.dateTo)
        endDate.setHours(23, 59, 59, 999)
        query = query.lte('created_at', endDate.toISOString())
      }

      // Order by newest first
      query = query.order('created_at', { ascending: false })

      // Apply pagination
      const from = (pageNum - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error

      setTotalCount(count || 0)
      setHasMore((count || 0) > to + 1)

      if (pageNum === 1) {
        setOrders(data || [])
      } else {
        setOrders(prev => [...prev, ...(data || [])])
      }

      setPage(pageNum)
    } catch (error) {
      logger.error('Error loading orders:', error)
      toast.error(t('buyer.orders.notifications.loadFailed', 'Failed to load orders'))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  /**
   * Load more orders (infinite scroll style)
   */
  const loadMoreOrders = () => {
    if (!loadingMore && hasMore && !loading) {
      loadOrders(page + 1)
    }
  }

  const loadActiveDelivery = async () => {
    try {
      const delivery = await deliveriesApi.getBuyerActiveDelivery(profile.id)
      setActiveDelivery(delivery)
    } catch {
      setActiveDelivery(null)
    }
  }

  // ============================================
  // Search Suggestions
  // ============================================

  const searchSuggestionsList = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return []
    const q = searchQuery.toLowerCase()
    const suggestions = new Set()

    orders.forEach(order => {
      if (order.order_number?.toLowerCase().includes(q)) {
        suggestions.add(order.order_number)
      }
      if (order.vendor?.store_name?.toLowerCase().includes(q)) {
        suggestions.add(order.vendor.store_name)
      }
      order.items?.forEach(item => {
        if (item.product?.name?.toLowerCase().includes(q)) {
          suggestions.add(item.product.name)
        }
      })
    })

    return Array.from(suggestions).slice(0, 5)
  }, [searchQuery, orders])

  const handleSearchChange = (value) => {
    setSearchQuery(value)
    setShowSuggestions(value.length >= 2)
  }

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion)
    setShowSuggestions(false)
  }

  // ============================================
  // Filtered Orders (client-side only: search, price, payment)
  // Status and date filters are applied server-side
  // ============================================

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Search (client-side since it needs nested data)
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const matchesOrderNumber = order.order_number?.toLowerCase().includes(q)
        const matchesVendor = order.vendor?.store_name?.toLowerCase().includes(q) ||
          `${order.vendor?.first_name} ${order.vendor?.last_name}`.toLowerCase().includes(q)
        const matchesItems = order.items?.some(item =>
          item.product?.name?.toLowerCase().includes(q)
        )
        if (!matchesOrderNumber && !matchesVendor && !matchesItems) return false
      }

      // Price filters (client-side)
      if (advancedFilters.priceMin) {
        if (order.total < parseFloat(advancedFilters.priceMin)) return false
      }
      if (advancedFilters.priceMax) {
        if (order.total > parseFloat(advancedFilters.priceMax)) return false
      }
      if (advancedFilters.paymentStatus) {
        if (advancedFilters.paymentStatus === 'cod' && order.payment_method !== 'cod') return false
        if (advancedFilters.paymentStatus === 'paid' && order.payment_method === 'cod') return false
        if (advancedFilters.paymentStatus === 'pending' && order.status === 'pending' && !order.payment_method) return false
      }

      return true
    })
  }, [orders, searchQuery, advancedFilters.priceMin, advancedFilters.priceMax, advancedFilters.paymentStatus])

  // ============================================
  // Actions
  // ============================================

  const handleReorder = useCallback(async (order) => {
    if (!order.items || order.items.length === 0) {
      toast.error(t('buyer.orders.notifications.reorderNoItems', 'This order has no items to re-order'))
      return
    }

    let addedCount = 0
    for (const item of order.items) {
      const product = item.product
      if (!product) continue

      const cartItem = {
        id: item.product_id,
        name: product.name,
        price_per_unit: item.unit_price || product.price_per_unit,
        unit_type: item.unit_type || product.unit_type || 'kg',
        quantity: item.quantity,
        min_order_quantity: product.min_order_quantity || 1,
        is_available: product.is_available ?? true,
        available_quantity: product.available_quantity ?? null,
        vendor_id: order.vendor_id,
        vendor_name: order.vendor?.store_name,
        image_url: product.images?.[0]?.url || product.image_url || null,
        category: product.category,
      }

      const result = addItem(cartItem, item.quantity)
      if (result) addedCount++
    }

    if (addedCount > 0) {
      toast.success(t('buyer.orders.notifications.reorderSuccess', '{{count}} item(s) added to cart', { count: addedCount }))
      navigate('/cart')
    } else {
      toast.error(t('buyer.orders.notifications.reorderFailed', 'Could not add any items (they may be unavailable)'))
    }
  }, [addItem, navigate, t])

  const handleReviewSubmit = useCallback(async (orderId, rating, comment) => {
    const targetOrder = orders.find((currentOrder) => currentOrder.id === orderId)

    await reviewService.createReview({
      orderId,
      vendorId: targetOrder?.vendor_id,
      productId: targetOrder?.items?.[0]?.product_id || targetOrder?.items?.[0]?.product?.id || null,
      userId: user.id,
      rating,
      comment,
    })

    toast.success(t('buyer.orders.notifications.reviewSubmitted', 'Review submitted successfully!'))
    await loadOrders()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, user?.id, t])

  const handleReturnSubmit = useCallback(async () => {
    if (!returnReason.trim()) {
      toast.error(t('buyer.orders.returnModal.error', 'Please provide a reason for the return'))
      return
    }

    setReturnSubmitting(true)
    try {
      const { error } = await supabase
        .from('return_requests')
        .insert({
          order_id: returnOrder.id,
          buyer_id: user.id,
          reason: returnReason,
          status: 'pending',
        })

      if (error) throw error
      toast.success(t('buyer.orders.returnModal.submitted', 'Return request submitted successfully'))
      setReturnModalOpen(false)
      setReturnOrder(null)
      setReturnReason('')
    } catch (error) {
      logger.error('Error submitting return request:', error)
      toast.error(t('buyer.orders.returnModal.failed', 'Failed to submit return request'))
    } finally {
      setReturnSubmitting(false)
    }
  }, [returnOrder, returnReason, user?.id, t])

  const handleViewDetails = useCallback((orderId) => {
    navigate(`/orders/${orderId}`)
  }, [navigate])

  // ============================================
  // Invoice PDF Download
  // ============================================

  const handleDownloadInvoice = useCallback(async (order) => {
    setDownloadingInvoice(order.id)
    try {
      const invoice = await invoiceService.downloadOrderInvoice(order)
      toast.success(`تم تحميل الفاتورة الرسمية ${invoice.invoice_number || ''}`.trim())
    } catch (error) {
      logger.error('Error generating invoice PDF:', error)
      toast.error(t('buyer.orders.notifications.invoiceFailed', 'Failed to download invoice'))
    } finally {
      setDownloadingInvoice(null)
    }
  }, [t])

  // ============================================
  // Selection
  // ============================================

  const handleSelectOrder = useCallback((orderId) => {
    setSelectedOrders(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)))
    }
  }, [filteredOrders, selectedOrders.size])

  const handleClearSelection = useCallback(() => {
    setSelectedOrders(new Set())
  }, [])

  const handleAdvancedFilterChange = useCallback((key, value) => {
    setAdvancedFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleClearAdvancedFilters = useCallback(() => {
    setAdvancedFilters({
      dateFrom: '',
      dateTo: '',
      priceMin: '',
      priceMax: '',
      paymentStatus: '',
    })
  }, [])

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{t('buyer.orders.title', 'My Orders')}</h1>
        <p className="text-gray-500 text-sm">
          {orders.length} {t('buyer.orders.ordersTotal', 'order(s) total', { count: orders.length })}
        </p>
      </div>
      {/* ===== Active Delivery Tracking Banner ===== */}
      {activeDelivery && (
        <Card className="mb-8 border-2 border-green-200 bg-green-50/50 overflow-hidden">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{t('buyer.orders.liveDeliveryTracking', 'Live Delivery Tracking')}</h3>
                <p className="text-sm text-gray-500 truncate">
                  {t('buyer.orders.orderOnTheWay', 'Order {{orderNumber}} is on the way!', { orderNumber: activeDelivery.order?.order_number })}
                </p>
              </div>
              <button
                onClick={() => navigate(`/orders/${activeDelivery.order_id}/tracking`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <EyeIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{t('buyer.orders.trackLive', 'Track Live')}</span>
                <span className="sm:hidden">{t('buyer.orders.track', 'Track')}</span>
              </button>
            </div>

            {/* Driver Info */}
            {activeDelivery.driver && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 font-bold text-sm">
                      {activeDelivery.driver.first_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {activeDelivery.driver.first_name} {activeDelivery.driver.last_name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {activeDelivery.driver.vehicle_type}
                      {activeDelivery.driver.vehicle_plate && ` • ${activeDelivery.driver.vehicle_plate}`}
                    </p>
                  </div>
                </div>
                <a
                  href={`tel:${activeDelivery.driver.phone}`}
                  className="inline-flex items-center gap-1.5 text-sm text-green-600 font-medium hover:text-green-700"
                >
                  <PhoneIcon className="w-4 h-4" />
                  {t('buyer.orders.callDriver', 'Call Driver')}
                </a>
              </div>
            )}

            {/* Progress Steps */}
            <div className="flex items-center gap-0">
              {[
                { status: 'driver_accepted', label: 'buyer.orders.status.driver_accepted', icon: CheckCircleIcon },
                { status: 'driver_picked_up', label: 'buyer.orders.status.driver_picked_up', icon: ShoppingBagIcon },
                { status: 'on_the_way', label: 'buyer.orders.status.on_the_way', icon: TruckIcon },
                { status: 'delivered', label: 'buyer.orders.status.delivered', icon: MapPinIcon },
              ].map((step, index) => {
                const statuses = ['driver_accepted', 'driver_picked_up', 'on_the_way', 'delivered']
                const currentIndex = statuses.indexOf(activeDelivery.status)
                const isCompleted = index <= currentIndex
                const isCurrent = index === currentIndex

                return (
                  <div key={step.status} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                      } ${isCurrent ? 'ring-4 ring-green-200' : ''}`}>
                        <step.icon className="w-4 h-4" />
                      </div>
                      <span className={`text-[10px] sm:text-xs font-medium mt-1 text-center ${
                        isCompleted ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {t(step.label, step.label.split('.').pop())}
                      </span>
                    </div>
                    {index < 3 && (
                      <div className={`flex-1 h-0.5 mx-1 mb-6 ${
                        index < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ===== Search & Filter Tabs ===== */}
      <div className="mb-6 space-y-4">
        {/* Search with Suggestions */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('buyer.orders.searchPlaceholder', 'Search by order number, vendor, or product...')}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchSuggestionsList.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="input pl-12 pr-10 py-3"
            aria-label={t('buyer.orders.searchPlaceholder', 'Search orders')}
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="buyer-orders-search-suggestions"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setShowSuggestions(false) }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
              aria-label="Clear search"
            >
              <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}

          {/* Search Suggestions Dropdown */}
          {showSuggestions && searchSuggestionsList.length > 0 && (
            <div id="buyer-orders-search-suggestions" className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden">
              {searchSuggestionsList.map((suggestion, idx) => (
                <button
                  key={idx}
                  onMouseDown={() => handleSuggestionClick(suggestion)}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{suggestion}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filter Tabs + Advanced Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin flex-1">
            {FILTER_TABS.map(tab => {
              const isActive = filter === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t(`buyer.orders.filters.${tab.id}`, tab.label)}
                </button>
              )
            })}
          </div>

          {/* Advanced Filters */}
          <AdvancedFilters
            filters={advancedFilters}
            onChange={handleAdvancedFilterChange}
            onClear={handleClearAdvancedFilters}
            orderCount={totalCount}
            t={t}
          />
        </div>
      </div>

      {/* ===== Selection Bar ===== */}
      {selectedOrders.size > 0 && (
        <div className="flex items-center justify-between mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
          <span className="text-sm font-medium text-green-700">
            {selectedOrders.size} {t('buyer.orders.selectionCount', 'order(s) selected', { count: selectedOrders.size })}
          </span>
          <button
            onClick={handleClearSelection}
            className="text-sm text-green-600 hover:underline"
          >
            {t('buyer.orders.clearSelection', 'Clear selection')}
          </button>
        </div>
      )}

      {/* ===== Select All Checkbox (when orders exist) ===== */}
      {filteredOrders.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleSelectAll}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              selectedOrders.size === filteredOrders.length && filteredOrders.length > 0
                ? 'bg-green-600 border-green-600'
                : selectedOrders.size > 0
                  ? 'bg-green-300 border-green-300'
                  : 'border-gray-300 hover:border-green-400'
            }`}
            aria-label={t('buyer.orders.selectAll', 'Select all orders')}
          >
            {selectedOrders.size === filteredOrders.length && filteredOrders.length > 0 && (
              <CheckIcon className="w-3 h-3 text-white" />
            )}
          </button>
          <span className="text-sm text-gray-500">{t('buyer.orders.selectAll', 'Select all')} ({filteredOrders.length})</span>
        </div>
      )}

      {/* ===== Orders Grid ===== */}
      {filteredOrders.length === 0 ? (
        <Card className="p-12 text-center">
          <ShoppingBagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          {orders.length === 0 ? (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('buyer.orders.emptyState.noOrdersYet', 'No orders yet')}</h3>
              <p className="text-gray-500 mb-6">{t('buyer.orders.emptyState.browseMarketplace', 'Browse the marketplace to place your first order')}</p>
              <button
                onClick={() => navigate('/marketplace')}
                className="btn-primary inline-flex items-center gap-2"
              >
                <ShoppingBagIcon className="w-5 h-5" />
                {t('buyer.orders.emptyState.startShopping', 'Start Shopping')}
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('buyer.orders.emptyState.noMatch', 'No matching orders')}</h3>
              <p className="text-gray-500">{t('buyer.orders.emptyState.tryAdjusting', 'Try adjusting your search or filter criteria')}</p>
            </>
          )}
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onReorder={handleReorder}
                onReview={setReviewOrder}
                onReturn={(order) => { setReturnOrder(order); setReturnModalOpen(true) }}
                onViewDetails={handleViewDetails}
                onDownloadInvoice={handleDownloadInvoice}
                isSelected={selectedOrders.has(order.id)}
                onSelect={handleSelectOrder}
                t={t}
              />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex flex-col items-center gap-2 mt-8">
              <button
                onClick={loadMoreOrders}
                disabled={loadingMore}
                className="btn-primary px-8 disabled:opacity-60"
              >
                {loadingMore ? (
                  <>
                    <LoadingSpinner size="sm" /> {t('common.loading', 'Loading...')}
                  </>
                ) : (
                  <>{t('buyer.orders.loadMore', 'Load More Orders')}</>
                )}
              </button>
              <p className="text-xs text-gray-400">
                {t('buyer.orders.showingCount', 'Showing {{shown}} of {{total}} order(s)', { shown: orders.length, total: totalCount })}
              </p>
            </div>
          )}
        </>
      )}

      {/* ===== Review Modal ===== */}
      {reviewOrder && (
        <ReviewModal
          order={reviewOrder}
          onClose={() => setReviewOrder(null)}
          onSubmit={handleReviewSubmit}
        />
      )}

      {/* ===== Return Request Modal ===== */}
      {returnModalOpen && returnOrder && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('buyer.orders.returnModal.title', 'Request Return')}</h3>
              <button
                onClick={() => setReturnModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-lg"
                aria-label={t('common.close', 'Close')}
              >
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              {t('buyer.orders.orderLabel', 'Order')} <strong>{returnOrder.order_number}</strong> — {t('buyer.orders.returnModal.description', 'Returns must be requested within 24 hours of delivery.')}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('buyer.orders.returnModal.reasonLabel', 'Reason for Return')}
              </label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                placeholder={t('buyer.orders.returnModal.reasonPlaceholder', 'Describe the issue with your order...')}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setReturnModalOpen(false)}
                className="btn-outline flex-1"
              >
                {t('buyer.orders.returnModal.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleReturnSubmit}
                disabled={returnSubmitting || !returnReason.trim()}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors"
              >
                {returnSubmitting ? t('buyer.orders.returnModal.submitting', 'Submitting...') : t('buyer.orders.returnModal.submit', 'Submit Return')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrdersPage
