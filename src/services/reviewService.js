import { supabase } from './supabase'
import { logger } from '@/utils/logger'

export const buildReviewSummary = (reviews = []) => {
  const totalReviews = reviews.length
  const averageRating = totalReviews > 0
    ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / totalReviews).toFixed(2))
    : 0

  return {
    totalReviews,
    averageRating,
    repliedCount: reviews.filter((review) => Boolean(review.vendor_reply)).length,
    pendingReplyCount: reviews.filter((review) => !review.vendor_reply).length,
    lowRatingCount: reviews.filter((review) => Number(review.rating || 0) <= 2).length,
  }
}

const notifyVendorAboutReview = async ({ vendorId, review }) => {
  if (!vendorId) return

  const ratingText = `${Number(review.rating || 0).toFixed(1)} / 5.0`
  const message = review.product_id
    ? `تم استلام تقييم جديد بقيمة ${ratingText} على أحد منتجاتك.`
    : `تم استلام تقييم جديد بقيمة ${ratingText} على متجرك.`

  const payload = {
    p_user_id: vendorId,
    p_title: 'تم استلام تقييم جديد',
    p_message: message,
    p_type: 'review',
    p_category: 'review_updates',
    p_data: {
      review_id: review.id,
      order_id: review.order_id,
      product_id: review.product_id,
      rating: review.rating,
    },
    p_channel: 'in_app',
    p_priority: 'normal',
    p_action_url: vendorId ? '/vendor/reviews' : null,
    p_action_label: 'عرض التقييمات',
  }

  const { error } = await supabase.rpc('create_user_notification', payload)
  if (!error) return

  const { error: fallbackError } = await supabase
    .from('notifications')
    .insert({
      user_id: vendorId,
      title: 'تم استلام تقييم جديد',
      message,
      type: 'review',
      category: 'review_updates',
      channel: 'in_app',
      priority: 'normal',
      action_url: '/vendor/reviews',
      action_label: 'عرض التقييمات',
      data: {
        review_id: review.id,
        order_id: review.order_id,
        product_id: review.product_id,
        rating: review.rating,
      },
      is_read: false,
    })

  if (fallbackError) {
    throw fallbackError
  }
}

const reviewService = {
  async createReview({ orderId = null, productId = null, vendorId, userId, rating, comment = '' }) {
    if (!vendorId || !userId) {
      throw new Error('بيانات التقييم غير مكتملة.')
    }

    const numericRating = Number(rating)
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      throw new Error('التقييم يجب أن يكون بين 1 و5.')
    }

    let existingQuery = supabase
      .from('reviews')
      .select('id')
      .eq('vendor_id', vendorId)
      .eq('user_id', userId)
      .is('deleted_at', null)

    if (orderId) {
      existingQuery = existingQuery.eq('order_id', orderId)
    }

    if (productId) {
      existingQuery = existingQuery.eq('product_id', productId)
    } else {
      existingQuery = existingQuery.is('product_id', null)
    }

    const { data: existingReview, error: existingError } = await existingQuery.maybeSingle()
    if (existingError) throw existingError

    if (existingReview) {
      throw new Error(productId
        ? 'لقد أرسلت تقييماً لهذا المنتج مسبقاً ضمن هذا الطلب.'
        : 'لقد أرسلت تقييماً لهذا الطلب مسبقاً.')
    }

    const payload = {
      order_id: orderId,
      product_id: productId,
      vendor_id: vendorId,
      user_id: userId,
      rating: numericRating,
      comment: comment?.trim() || null,
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error

    try {
      await notifyVendorAboutReview({ vendorId, review: data })
    } catch (notificationError) {
      logger.warn('Failed to notify vendor about new review:', notificationError)
    }

    return data
  },

  async getVendorReviews(vendorId, { page = 1, pageSize = 10 } = {}) {
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from('reviews')
      .select(`
        id,
        order_id,
        product_id,
        vendor_id,
        user_id,
        rating,
        comment,
        created_at,
        vendor_reply,
        vendor_reply_at,
        is_flagged,
        approved_at,
        admin_notes,
        buyer:profiles!reviews_user_id_fkey(id, first_name, last_name, avatar_url, email),
        product:products(id, name)
      `, { count: 'exact' })
      .eq('vendor_id', vendorId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    const { data: ratingRows, error: ratingError } = await supabase
      .from('reviews')
      .select('rating, vendor_reply')
      .eq('vendor_id', vendorId)
      .is('deleted_at', null)

    if (ratingError) throw ratingError

    return {
      data: data || [],
      total: count || 0,
      summary: buildReviewSummary(ratingRows || []),
    }
  },

  async replyToReview({ reviewId, vendorId, replyText }) {
    const trimmedReply = String(replyText || '').trim()
    if (trimmedReply.length < 2) {
      throw new Error('يرجى كتابة رد واضح قبل الإرسال.')
    }

    const { data, error } = await supabase
      .from('reviews')
      .update({
        vendor_reply: trimmedReply,
        vendor_reply_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .eq('vendor_id', vendorId)
      .is('deleted_at', null)
      .select('id, vendor_reply, vendor_reply_at')
      .single()

    if (error) throw error
    return data
  },
}

export default reviewService