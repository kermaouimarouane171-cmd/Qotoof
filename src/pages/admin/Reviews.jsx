import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Card, LoadingSpinner } from '@/components/ui'
import {
  StarIcon,
  EyeIcon,
  ChatBubbleLeftIcon,
  UserIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const PAGE_SIZE = 20

const AdminReviews = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [filter, setFilter] = useState('all')
  const [selectedReview, setSelectedReview] = useState(null)
  const [_actionLoading, setActionLoading] = useState(false)
  const [_adminNotes, setAdminNotes] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // ============================================
  // Load Reviews
  // ============================================

  const loadReviews = useCallback(async (pageNum = 1, statusFilter = filter) => {
    try {
      setLoading(true)
      const from = (pageNum - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabase
        .from('reviews')
        .select(`
          *,
          buyer:profiles!reviews_user_id_fkey(id, first_name, last_name, email, avatar_url),
          vendor:profiles!reviews_vendor_id_fkey(id, first_name, last_name, email),
          product:products(id, name)
        `, { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to)

      // Apply status filter
      if (statusFilter === 'with_reply') {
        query = query.not('vendor_reply', 'is', null)
      } else if (statusFilter === 'without_reply') {
        query = query.is('vendor_reply', null)
      }

      const { data, error, count } = await query

      if (error) throw error

      setReviews(data || [])
      setTotalCount(count || 0)
      setHasMore((count || 0) > to + 1)
      setPage(pageNum)
    } catch (error) {
      logger.error('Load reviews error:', error)
      toast.error(t('admin.reviews.notifications.loadFailed', 'Failed to load reviews'))
    } finally {
      setLoading(false)
    }
  }, [filter, t])

  useEffect(() => {
    loadReviews(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  // ============================================
  // Moderation Actions
  // ============================================

  /**
   * Send notification to a user
   */
  const sendUserNotification = async (userId, title, message, type = 'moderation') => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          data: { admin_id: user.id, timestamp: new Date().toISOString() }})
        .select()
        .single()

      if (error) throw error
      logger.info(`Notification sent to user ${userId}:`, title)
      return data
    } catch (error) {
      logger.error('Send notification error:', error)
      return null
    }
  }

  /**
   * Flag a review (mark for review)
   */
  const _handleFlagReview = async (_reviewId) => {
    toast(t('admin.reviews.moderationDisabled', 'Moderation actions are temporarily disabled'))
  }

  /**
   * Approve a review (remove flag, confirm it's valid)
   */
  const _handleApproveReview = async (_reviewId) => {
    toast(t('admin.reviews.moderationDisabled', 'Moderation actions are temporarily disabled'))
  }

  /**
   * Delete a review and notify the user
   */
  const _handleDeleteReview = async (_reviewId) => {
    if (!selectedReview) return

    try {
      setActionLoading(true)

      // Get review info before deletion
      const review = selectedReview
      const buyerId = review.user_id || review.buyer_id
      const buyerName = review.buyer
        ? `${review.buyer.first_name} ${review.buyer.last_name}`
        : t('admin.reviews.unknownUser', 'Unknown user')

      // Soft delete the review
      const { error } = await supabase
        .from('reviews')
        .update({
          deleted_at: new Date().toISOString()})
        .eq('id', _reviewId)

      if (error) throw error

      // Notify the buyer that their review was deleted
      await sendUserNotification(
        buyerId,
        t('admin.reviews.notifications.reviewRemovedTitle', 'Review Removed'),
        t('admin.reviews.notifications.reviewRemovedMessage', 'Your review for "{{productName}}" has been removed by a moderator.', { productName: review.product?.name || 'a product' }),
        'moderation'
      )

      toast.success(t('admin.reviews.notifications.deleted', 'Review deleted. Notification sent to {{name}}', { name: buyerName }))
      setSelectedReview(null)
      await loadReviews(page, filter)
    } catch (error) {
      logger.error('Delete review error:', error)
      toast.error(t('admin.reviews.notifications.deleteFailed', 'Failed to delete review'))
    } finally {
      setActionLoading(false)
    }
  }

  /**
   * Unflag a review
   */
  const _handleUnflagReview = async (_reviewId) => {
    toast(t('admin.reviews.moderationDisabled', 'Moderation actions are temporarily disabled'))
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
  // Helpers
  // ============================================

  const _getFilterStats = () => ({
    all: totalCount,
    withReply: reviews.filter(r => r.vendor_reply).length,
    withoutReply: reviews.filter(r => !r.vendor_reply).length})

  if (loading && reviews.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('admin.reviews.title', 'Review Moderation')}</h1>
        <p className="text-gray-600">{t('admin.reviews.subtitle', 'Manage and moderate customer reviews')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <StarIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-xs text-gray-500">{t('admin.reviews.stats.total', 'Total')}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ChatBubbleLeftIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reviews.filter(r => r.vendor_reply).length}</p>
              <p className="text-xs text-gray-500">{t('admin.reviews.stats.withReply', 'With Reply')}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reviews.filter(r => !r.vendor_reply).length}</p>
              <p className="text-xs text-gray-500">{t('admin.reviews.stats.noReply', 'No Reply')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[
          { key: 'all', label: t('admin.reviews.filters.all', 'All Reviews') },
          { key: 'with_reply', label: t('admin.reviews.filters.withReply', 'With Reply') },
          { key: 'without_reply', label: t('admin.reviews.filters.withoutReply', 'No Reply') },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setSelectedReview(null); setAdminNotes('') }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === key
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reviews List */}
        <div className="lg:col-span-2 space-y-4">
          {reviews.length === 0 ? (
            <Card className="p-12 text-center">
              <StarIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('admin.reviews.noReviews', 'No reviews found')}</p>
            </Card>
          ) : (
            reviews.map((review) => (
              <Card
                key={review.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedReview?.id === review.id ? 'ring-2 ring-green-500' : ''
                }`}
                onClick={() => setSelectedReview(review)}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">
                      {review.buyer?.first_name?.[0]}{review.buyer?.last_name?.[0] || '?'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-gray-900 truncate">
                        {review.buyer ? `${review.buyer.first_name} ${review.buyer.last_name}` : 'Unknown'}
                      </span>
                      {review.vendor_reply && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          {t('admin.reviews.replied', 'Replied')}
                        </span>
                      )}
                      <div className="flex items-center gap-0.5 ml-auto">
                        {[1, 2, 3, 4, 5].map(star => (
                          <StarSolid
                            key={star}
                            className={`w-4 h-4 ${
                              star <= review.rating ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Product */}
                    {review.product && (
                      <p className="text-xs text-green-600 mb-1">
                        {t('admin.reviews.product', 'Product')}: {review.product.name}
                      </p>
                    )}

                    {/* Comment */}
                    {review.comment && (
                      <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                        {review.comment}
                      </p>
                    )}

                    {/* Vendor Reply Preview */}
                    {review.vendor_reply && (
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {t('admin.reviews.vendorReply', 'Reply')}: {review.vendor_reply}
                      </p>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                      <span>{t('admin.reviews.vendor', 'Vendor')}: {review.vendor?.first_name || 'N/A'}</span>
                      <span>{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}

          {/* Load More */}
          {hasMore && reviews.length > 0 && (
            <div className="text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="btn-primary px-8 disabled:opacity-60"
              >
                {loading ? <LoadingSpinner size="sm" /> : t('admin.reviews.loadMore', 'Load More')}
              </button>
              <p className="text-xs text-gray-400 mt-2">
                {t('admin.reviews.showingCount', 'Showing {{current}} of {{total}} reviews', { current: reviews.length, total: totalCount })}
              </p>
            </div>
          )}
        </div>

        {/* Review Details Panel */}
        <div className="lg:col-span-1">
          {selectedReview ? (
            <Card className="p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-green-600" />
                {t('admin.reviews.reviewDetails', 'Review Details')}
              </h3>

              <div className="space-y-4">
                {/* Reviewer Info */}
                <div>
                  <p className="text-sm text-gray-500">{t('admin.reviews.reviewer', 'Reviewer')}</p>
                  <p className="font-medium">
                    {selectedReview.buyer
                      ? `${selectedReview.buyer.first_name} ${selectedReview.buyer.last_name}`
                      : 'Unknown'}
                  </p>
                  {selectedReview.buyer?.email && (
                    <p className="text-xs text-gray-500">{selectedReview.buyer.email}</p>
                  )}
                </div>

                {/* Vendor */}
                <div>
                  <p className="text-sm text-gray-500">{t('admin.reviews.vendor', 'Vendor')}</p>
                  <p className="font-medium">
                    {selectedReview.vendor
                      ? `${selectedReview.vendor.first_name} ${selectedReview.vendor.last_name}`
                      : 'Unknown'}
                  </p>
                </div>

                {/* Product */}
                {selectedReview.product && (
                  <div>
                    <p className="text-sm text-gray-500">{t('admin.reviews.product', 'Product')}</p>
                    <p className="font-medium">{selectedReview.product.name}</p>
                  </div>
                )}

                {/* Rating */}
                <div>
                  <p className="text-sm text-gray-500">{t('admin.reviews.rating', 'Rating')}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <StarSolid
                        key={star}
                        className={`w-5 h-5 ${
                          star <= selectedReview.rating ? 'text-yellow-400' : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="text-sm font-medium ml-2">{selectedReview.rating}/5</span>
                  </div>
                </div>

                {/* Comment */}
                {selectedReview.comment && (
                  <div>
                    <p className="text-sm text-gray-500">{t('admin.reviews.comment', 'Comment')}</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap mt-1">
                      {selectedReview.comment}
                    </p>
                  </div>
                )}

                {/* Vendor Reply */}
                {selectedReview.vendor_reply && (
                  <div>
                    <p className="text-sm text-gray-500">{t('admin.reviews.vendorReply', 'Vendor Reply')}</p>
                    <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg mt-1">
                      {selectedReview.vendor_reply}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      {t('admin.reviews.moderationDisabled', 'Moderation actions are temporarily disabled while review schema is being updated.')}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center sticky top-24">
              <EyeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('admin.reviews.selectToModerate', 'Select a review to moderate')}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminReviews
