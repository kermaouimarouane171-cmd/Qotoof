/**
 * ReviewModal — star-rating review dialog for a delivered order.
 *
 * Extracted from src/pages/buyer/Orders.jsx.
 */

import { useState } from 'react'
import { StarIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

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

export default ReviewModal
