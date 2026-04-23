import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner, StarRating } from '@/components/ui'
import reviewService from '@/services/reviewService'
import {
  StarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const PAGE_SIZE = 10

const VendorReviews = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [averageRating, setAverageRating] = useState(0)
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)

  // ============================================
  // Load Reviews
  // ============================================

  const loadReviews = useCallback(async (pageNum = 1) => {
    if (!user) return

    try {
      setLoading(true)

      const from = (pageNum - 1) * PAGE_SIZE

      const result = await reviewService.getVendorReviews(user.id, {
        page: pageNum,
        pageSize: PAGE_SIZE,
      })

      setReviews(result.data || [])
      setTotalCount(result.total || 0)
      setHasMore((result.total || 0) > from + PAGE_SIZE)
      setPage(pageNum)
      setAverageRating(result.summary?.averageRating || 0)
    } catch (error) {
      logger.error('Error loading reviews:', error)
      toast.error('تعذر تحميل التقييمات')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadReviews(1)
  }, [loadReviews])

  // ============================================
  // Reply to Review
  // ============================================

  const handleReply = async (reviewId) => {
    if (!replyText.trim()) {
      toast.error('يرجى كتابة رد قبل الإرسال')
      return
    }

    setReplySubmitting(true)

    try {
      // Check if already replied (prevent double reply)
      const existingReview = reviews.find(r => r.id === reviewId)
      if (existingReview?.vendor_reply) {
        toast.error('تم إرسال رد على هذا التقييم مسبقاً')
        setReplyingTo(null)
        setReplyText('')
        return
      }

      const replyResult = await reviewService.replyToReview({
        reviewId,
        vendorId: user.id,
        replyText,
      })

      // Update local state
      setReviews(prev =>
        prev.map(r =>
          r.id === reviewId
            ? { ...r, vendor_reply: replyResult.vendor_reply, vendor_reply_at: replyResult.vendor_reply_at }
            : r
        )
      )

      toast.success('تم إرسال الرد بنجاح')
      setReplyingTo(null)
      setReplyText('')
    } catch (error) {
      logger.error('Error posting reply:', error)
      toast.error(error?.message || 'تعذر إرسال الرد')
    } finally {
      setReplySubmitting(false)
    }
  }

  // ============================================
  // Load More
  // ============================================

  const loadMore = () => {
    if (!loading && hasMore) {
      loadReviews(page + 1)
    }
  }

  // ============================================
  // Loading State
  // ============================================

  if (loading && reviews.length === 0) {
    return <LoadingSpinner size="lg" />
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('vendor.reviews.title') || 'Customer Reviews'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} review{totalCount !== 1 ? 's' : ''} · {averageRating > 0 ? averageRating.toFixed(1) : '—'} / 5.0
          </p>
        </div>
        <button
          onClick={() => loadReviews(1)}
          className="btn-outline text-sm py-2 px-3 flex items-center gap-2"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Rating Summary */}
      <Card className="p-6 mb-8 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
            <StarSolid className="w-10 h-10 text-yellow-500" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold text-gray-900">
                {averageRating > 0 ? averageRating.toFixed(1) : '—'}
              </span>
              <span className="text-gray-500 text-lg">/ 5.0</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map(star => (
                <StarSolid
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.round(averageRating) ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Based on {totalCount} review{totalCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </Card>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <Card className="p-12 text-center">
          <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No reviews yet</h3>
          <p className="text-gray-500">Reviews from customers will appear here</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <Card key={review.id} className="p-6">
              {/* Review Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                    <span className="text-white font-bold">
                      {review.buyer?.first_name?.[0]}{review.buyer?.last_name?.[0] || 'م'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {review.buyer ? `${review.buyer.first_name} ${review.buyer.last_name}` : 'عميل'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(review.created_at).toLocaleDateString('ar-MA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    {review.product && (
                      <p className="text-xs text-green-600 mt-0.5">
                        📦 {review.product.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <StarSolid
                      key={star}
                      className={`w-5 h-5 ${
                        star <= review.rating ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Review Comment */}
              {review.comment && (
                <p className="text-gray-700 leading-relaxed mb-4 pl-15">{review.comment}</p>
              )}

              {/* Vendor Reply */}
              {review.vendor_reply ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 ml-8">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-800">رد البائع</span>
                    {review.vendor_reply_at && (
                      <span className="text-xs text-green-500">
                        {new Date(review.vendor_reply_at).toLocaleDateString('ar-MA')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-green-700">{review.vendor_reply}</p>
                </div>
              ) : replyingTo === review.id ? (
                /* Reply Form */
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 ml-8">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-blue-800">رد على هذا التقييم</span>
                    <button
                      onClick={() => { setReplyingTo(null); setReplyText('') }}
                      className="text-blue-400 hover:text-blue-600"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="اكتب ردك هنا..."
                    autoFocus
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleReply(review.id)}
                      disabled={replySubmitting || !replyText.trim()}
                      className="btn-primary text-sm py-1.5 px-4 disabled:opacity-50"
                    >
                      {replySubmitting ? 'جاري الإرسال...' : 'إرسال الرد'}
                    </button>
                    <button
                      onClick={() => { setReplyingTo(null); setReplyText('') }}
                      className="btn-outline text-sm py-1.5 px-4"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                /* Reply Button */
                <button
                  onClick={() => { setReplyingTo(review.id); setReplyText('') }}
                  className="ml-8 text-sm text-green-600 hover:text-green-700 hover:underline flex items-center gap-1"
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4" />
                  رد على هذا التقييم
                </button>
              )}
            </Card>
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="btn-primary px-8 disabled:opacity-60"
              >
                {loading ? <LoadingSpinner size="sm" /> : 'تحميل المزيد'}
              </button>
              <p className="text-xs text-gray-400 mt-2">
                عرض {reviews.length} من {totalCount} تقييم
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VendorReviews
