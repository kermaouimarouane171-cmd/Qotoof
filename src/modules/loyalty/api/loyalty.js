import { supabase } from '@/services/supabase'
import { withRetry } from '@/utils/withRetry'

/**
 * Loyalty Program API Service
 * Handles loyalty points, tiers, and rewards for buyers
 */

const toAmount = (value) => Number(Number(value || 0).toFixed(2))
const toInteger = (value) => Math.max(0, Math.round(Number(value || 0)))
const LOYALTY_POINT_RATE = 0.1
export const REFERRAL_REWARD_POINTS = 100

// Loyalty tier definitions
export const LOYALTY_TIERS = [
  { name: 'Bronze', minPoints: 0, color: 'from-amber-600 to-amber-800', icon: '🥉', multiplier: 1.0 },
  { name: 'Silver', minPoints: 500, color: 'from-gray-400 to-gray-600', icon: '🥈', multiplier: 1.2 },
  { name: 'Gold', minPoints: 2000, color: 'from-yellow-400 to-yellow-600', icon: '🥇', multiplier: 1.5 },
  { name: 'Platinum', minPoints: 5000, color: 'from-purple-500 to-purple-700', icon: '💎', multiplier: 2.0 },
]

const getTierByName = (tierName) => LOYALTY_TIERS.find((tier) => tier.name === tierName) || LOYALTY_TIERS[0]

export const calculateLoyaltyPointsForOrder = ({ orderTotal, tierName = 'Bronze' }) => {
  const tier = getTierByName(tierName)
  const qualifyingTotal = Math.max(toAmount(orderTotal), 0)
  const basePoints = Math.floor(qualifyingTotal * LOYALTY_POINT_RATE)
  const adjustedPoints = Math.floor(basePoints * tier.multiplier)
  return Math.max(qualifyingTotal > 0 ? 1 : 0, adjustedPoints)
}

export const calculateRewardDiscountAmount = ({ reward, subtotal = 0 }) => {
  if (!reward) return 0
  if (reward.reward_type !== 'coupon' && reward.reward_type !== 'points_discount') return 0
  return Math.min(toAmount(reward.reward_value || 0), toAmount(subtotal))
}

const buildReferralLink = (referralCode) => {
  if (!referralCode || typeof window === 'undefined') return ''
  return `${window.location.origin}/register?role=buyer&ref=${encodeURIComponent(referralCode)}`
}

const isMissingLoyaltyReasonColumnError = (error) => (
  error?.code === '42703' && /loyalty_transactions\.reason/i.test(error.message || '')
)

const buildCompatTransactionMetadata = ({ metadata = {}, reason }) => {
  if (!reason) return metadata || {}
  return {
    ...(metadata || {}),
    transaction_reason: reason,
  }
}

const insertLoyaltyTransaction = async ({
  userId,
  pointsChange,
  reason,
  orderId = null,
  balanceAfter,
  metadata = {},
  createdAt,
}) => {
  const basePayload = {
    user_id: userId,
    points_change: pointsChange,
    reason,
    order_id: orderId,
    balance_after: balanceAfter,
    metadata,
    created_at: createdAt,
  }

  let result = await supabase
    .from('loyalty_transactions')
    .insert(basePayload)
    .select()
    .single()

  if (!isMissingLoyaltyReasonColumnError(result.error)) {
    if (result.error) throw result.error
    return result.data
  }

  const fallbackPayload = {
    ...basePayload,
    metadata: buildCompatTransactionMetadata({ metadata, reason }),
  }
  delete fallbackPayload.reason

  result = await supabase
    .from('loyalty_transactions')
    .insert(fallbackPayload)
    .select()
    .single()

  if (result.error) throw result.error
  return result.data
}

const fetchProcessedOrderTransactions = async (userId) => {
  let result = await supabase
    .from('loyalty_transactions')
    .select('order_id, metadata')
    .eq('user_id', userId)
    .eq('reason', 'order_completed')

  if (!isMissingLoyaltyReasonColumnError(result.error)) {
    if (result.error) throw result.error
    return result.data || []
  }

  result = await supabase
    .from('loyalty_transactions')
    .select('order_id, metadata')
    .eq('user_id', userId)
    .not('order_id', 'is', null)

  if (result.error) throw result.error
  return result.data || []
}

const fetchReferralBonusTransactions = async (userId) => {
  let result = await supabase
    .from('loyalty_transactions')
    .select('metadata')
    .eq('user_id', userId)
    .eq('reason', 'referral_bonus')

  if (!isMissingLoyaltyReasonColumnError(result.error)) {
    if (result.error) throw result.error
    return result.data || []
  }

  result = await supabase
    .from('loyalty_transactions')
    .select('metadata')
    .eq('user_id', userId)

  if (result.error) throw result.error
  return (result.data || []).filter((entry) => Boolean(entry.metadata?.referral_id))
}

const insertNotification = async ({ userId, type, title, message, data = {} }) => {
  if (!userId) return

  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      data,
      is_read: false,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Notifications are best-effort only.
  }
}

const writePointsBalance = async ({
  userId,
  points,
  lifetimePoints,
  tier,
  referralBonusEarned,
  lastEarnedAt,
}) => {
  const payload = {
    user_id: userId,
    points: toInteger(points),
    lifetime_points: toInteger(lifetimePoints),
    tier,
    referral_bonus_earned: toInteger(referralBonusEarned),
    last_earned_at: lastEarnedAt || null,
  }

  const { error } = await supabase
    .from('loyalty_points')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) throw error
}

export const loyaltyApi = {
  // ============================================
  // Points operations
  // ============================================

  /**
   * Get user's loyalty points balance
   */
  getPointsBalance: withRetry(async (userId) => {
    const { data, error } = await supabase
      .from('loyalty_points')
      .select('points, lifetime_points, tier, referral_bonus_earned, last_earned_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error

    // Create record if doesn't exist
    if (!data) {
      const newRecord = {
        user_id: userId,
        points: 0,
        lifetime_points: 0,
        tier: 'Bronze',
        referral_bonus_earned: 0,
        last_earned_at: null,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('loyalty_points')
        .insert(newRecord)
        .select()
        .single()

      if (insertError) throw insertError
      return inserted
    }

    return data
  }, { maxRetries: 3, baseDelay: 1000 }),

  /**
   * Award points to a user (e.g., after order delivery)
   */
  awardPoints: withRetry(async (userId, points, reason, orderId = null, metadata = {}) => {
    if (points <= 0) throw new Error('Points must be positive')

    const currentBalance = await loyaltyApi.getPointsBalance(userId)
    const nextBalance = toInteger(currentBalance.points) + toInteger(points)
    const nextLifetimePoints = toInteger(currentBalance.lifetime_points) + toInteger(points)
    const nextTier = loyaltyApi.getTier(nextBalance).name
    const lastEarnedAt = new Date().toISOString()

    await writePointsBalance({
      userId,
      points: nextBalance,
      lifetimePoints: nextLifetimePoints,
      tier: nextTier,
      referralBonusEarned: currentBalance.referral_bonus_earned || 0,
      lastEarnedAt,
    })

    const data = await insertLoyaltyTransaction({
      userId,
      pointsChange: toInteger(points),
      reason,
      orderId,
      balanceAfter: nextBalance,
      metadata,
      createdAt: lastEarnedAt,
    })

    return {
      ...data,
      newBalance: nextBalance,
      lifetimePoints: nextLifetimePoints,
      tier: nextTier,
    }
  }, { maxRetries: 2, baseDelay: 1000 }),

  /**
   * Deduct points from a user (e.g., for reward redemption)
   */
  deductPoints: withRetry(async (userId, points, reason, metadata = {}) => {
    if (points <= 0) throw new Error('Points must be positive')

    const currentBalance = await loyaltyApi.getPointsBalance(userId)

    if (currentBalance.points < points) {
      throw new Error('Insufficient points')
    }

    const nextBalance = toInteger(currentBalance.points) - toInteger(points)
    const currentTier = loyaltyApi.getTier(nextBalance).name

    await writePointsBalance({
      userId,
      points: nextBalance,
      lifetimePoints: currentBalance.lifetime_points || 0,
      tier: currentTier,
      referralBonusEarned: currentBalance.referral_bonus_earned || 0,
      lastEarnedAt: currentBalance.last_earned_at || null,
    })

    const data = await insertLoyaltyTransaction({
      userId,
      pointsChange: -toInteger(points),
      reason,
      balanceAfter: nextBalance,
      metadata,
      createdAt: new Date().toISOString(),
    })

    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  // ============================================
  // Tier operations
  // ============================================

  /**
   * Get user's current tier
   */
  getTier: (points) => {
    return [...LOYALTY_TIERS].reverse().find(t => points >= t.minPoints) || LOYALTY_TIERS[0]
  },

  /**
   * Check and upgrade user tier if eligible
   */
  checkTierUpgrade: withRetry(async (userId, points) => {
    const currentTier = loyaltyApi.getTier(points)

    const { data, error } = await supabase
      .from('loyalty_points')
      .update({ tier: currentTier.name })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }, { maxRetries: 2, baseDelay: 500 }),

  /**
   * Get tier progress (points to next tier)
   */
  getTierProgress: (points) => {
    const currentTier = [...LOYALTY_TIERS].reverse().find(t => points >= t.minPoints) || LOYALTY_TIERS[0]
    const nextTier = LOYALTY_TIERS.find(t => t.minPoints > points)

    if (!nextTier) {
      return { currentTier, nextTier: null, progress: 100 }
    }

    const progress = Math.round(
      ((points - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100
    )

    return {
      currentTier,
      nextTier,
      progress: Math.min(100, progress),
      pointsNeeded: nextTier.minPoints - points,
    }
  },

  // ============================================
  // History & analytics
  // ============================================

  /**
   * Get user's loyalty transaction history
   */
  getTransactionHistory: withRetry(async (userId, limit = 50) => {
    const { data, error } = await supabase
      .from('loyalty_transactions')
      .select(`
        *,
        order:orders(order_number, total, status)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }, { maxRetries: 3, baseDelay: 1000 }),

  /**
   * Get user's loyalty dashboard stats - Optimized: SUM aggregate + parallel queries
   */
  getLoyaltyStats: withRetry(async (userId) => {
    const pointsData = await loyaltyApi.getPointsBalance(userId)

    // Use database-side SUM instead of fetching all orders
    const { data: spendingResult } = await supabase
      .from('orders')
      .select('total')
      .eq('buyer_id', userId)
      .eq('status', 'delivered')

    const lifetimeSpent = spendingResult?.reduce((sum, o) => sum + (o.total || 0), 0) || 0

    const tierInfo = loyaltyApi.getTier(pointsData.points)
    const progress = loyaltyApi.getTierProgress(pointsData.points)

    return {
      points: pointsData.points,
      lifetimePoints: pointsData.lifetime_points || 0,
      lifetimeSpent,
      tier: tierInfo.name,
      tierIcon: tierInfo.icon,
      tierProgress: progress.progress,
      nextTier: progress.nextTier?.name,
      pointsToNextTier: progress.pointsNeeded || 0,
      referralBonusEarned: pointsData.referral_bonus_earned || 0,
    }
  }, { maxRetries: 3, baseDelay: 1000 }),

  // ============================================
  // Rewards (future feature placeholder)
  // ============================================

  /**
   * Get available loyalty rewards
   */
  getAvailableRewards: withRetry(async () => {
    const { data, error } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('is_active', true)
      .order('points_cost', { ascending: true })

    if (error) throw error
    return data || []
  }, { maxRetries: 3, baseDelay: 1000 }),

  /**
   * Get referral dashboard data for the current buyer
   */
  getReferralDashboard: withRetry(async (userId) => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, referral_code, referred_by, referral_completed_at')
      .eq('id', userId)
      .single()

    if (profileError) throw profileError

    const [{ data: referrals, error: referralsError }, referredByResult] = await Promise.all([
      supabase
        .from('referrals')
        .select(`
          *,
          referred_user:profiles!referrals_referred_user_id_fkey(id, first_name, last_name, email, referral_completed_at),
          first_order:orders(id, order_number, status, total)
        `)
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false }),
      profile.referred_by
        ? supabase
            .from('profiles')
            .select('id, first_name, last_name, referral_code')
            .eq('id', profile.referred_by)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (referralsError) throw referralsError
    if (referredByResult.error) throw referredByResult.error

    const referralList = referrals || []

    return {
      profile,
      referredBy: referredByResult.data || null,
      referralCode: profile.referral_code || '',
      referralLink: buildReferralLink(profile.referral_code),
      referrals: referralList,
      summary: {
        total: referralList.length,
        earned: referralList.filter((entry) => entry.reward_status === 'earned').length,
        pending: referralList.filter((entry) => entry.reward_status === 'pending').length,
      },
    }
  }, { maxRetries: 2, baseDelay: 500 }),

  /**
   * Attach a referral code to the current user and create a pending referral relationship.
   */
  attachReferralCode: withRetry(async ({ userId, referralCode }) => {
    const normalizedCode = (referralCode || '').trim().toUpperCase()
    if (!normalizedCode) {
      throw new Error('رمز الإحالة مطلوب')
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, referral_code, referred_by')
      .eq('id', userId)
      .single()

    if (profileError) throw profileError
    if (profile.referred_by) {
      return { alreadyLinked: true, referrerId: profile.referred_by }
    }
    if ((profile.referral_code || '').toUpperCase() === normalizedCode) {
      throw new Error('لا يمكنك استخدام رمز الإحالة الخاص بك')
    }

    const { data: referrer, error: referrerError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, referral_code')
      .eq('referral_code', normalizedCode)
      .maybeSingle()

    if (referrerError) throw referrerError
    if (!referrer) {
      throw new Error('رمز الإحالة غير صالح')
    }

    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({ referred_by: referrer.id })
      .eq('id', userId)

    if (updateProfileError) throw updateProfileError

    const { error: referralError } = await supabase
      .from('referrals')
      .upsert({
        referrer_id: referrer.id,
        referred_user_id: userId,
        referral_code: referrer.referral_code,
        reward_points: REFERRAL_REWARD_POINTS,
        reward_status: 'pending',
      }, { onConflict: 'referrer_id,referred_user_id' })

    if (referralError) throw referralError

    return {
      applied: true,
      referrer,
    }
  }, { maxRetries: 2, baseDelay: 500 }),

  /**
   * Sync loyalty points for delivered orders that haven't yet generated an order_completed transaction.
   */
  syncDeliveredOrderBenefits: withRetry(async (userId) => {
    const [currentBalance, profileResult, deliveredOrdersResult, existingTransactions] = await Promise.all([
      loyaltyApi.getPointsBalance(userId),
      supabase
        .from('profiles')
        .select('referred_by, referral_completed_at')
        .eq('id', userId)
        .single(),
      supabase
        .from('orders')
        .select('id, subtotal, discount_total, total, delivered_at, created_at, status')
        .eq('buyer_id', userId)
        .eq('status', 'delivered')
        .order('delivered_at', { ascending: true }),
      fetchProcessedOrderTransactions(userId),
    ])

    if (profileResult.error) throw profileResult.error
    if (deliveredOrdersResult.error) throw deliveredOrdersResult.error

    const processedOrderIds = new Set((existingTransactions || []).map((entry) => entry.order_id).filter(Boolean))
    const eligibleOrders = (deliveredOrdersResult.data || []).filter((order) => !processedOrderIds.has(order.id))

    const summary = {
      ordersProcessed: 0,
      pointsAwarded: 0,
      referralCompleted: false,
    }

    let balanceSnapshot = currentBalance

    for (const order of eligibleOrders) {
      const qualifyingTotal = Math.max(
        toAmount(order.subtotal || order.total || 0) - toAmount(order.discount_total || 0),
        0
      )
      const earnedPoints = calculateLoyaltyPointsForOrder({
        orderTotal: qualifyingTotal,
        tierName: balanceSnapshot.tier,
      })

      if (earnedPoints <= 0) {
        continue
      }

      const awarded = await loyaltyApi.awardPoints(
        userId,
        earnedPoints,
        'order_completed',
        order.id,
        {
          qualifying_total: qualifyingTotal,
          delivered_at: order.delivered_at || order.created_at || new Date().toISOString(),
        }
      )

      balanceSnapshot = {
        ...balanceSnapshot,
        points: awarded.newBalance,
        lifetime_points: awarded.lifetimePoints,
        tier: awarded.tier,
      }

      summary.ordersProcessed += 1
      summary.pointsAwarded += earnedPoints
    }

    const firstDeliveredOrder = (deliveredOrdersResult.data || [])[0]
    const referralProfile = profileResult.data

    if (referralProfile?.referred_by && !referralProfile.referral_completed_at && firstDeliveredOrder) {
      const { data: referrer, error: referrerError } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', referralProfile.referred_by)
        .single()

      if (referrerError) throw referrerError

      const completedAt = firstDeliveredOrder.delivered_at || new Date().toISOString()

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ referral_completed_at: completedAt })
        .eq('id', userId)

      if (profileUpdateError) throw profileUpdateError

      const { error: referralUpdateError } = await supabase
        .from('referrals')
        .upsert({
          referrer_id: referralProfile.referred_by,
          referred_user_id: userId,
          referral_code: referrer.referral_code,
          reward_points: REFERRAL_REWARD_POINTS,
          reward_status: 'earned',
          first_order_id: firstDeliveredOrder.id,
          first_order_completed_at: completedAt,
        }, { onConflict: 'referrer_id,referred_user_id' })

      if (referralUpdateError) throw referralUpdateError
      summary.referralCompleted = true
    }

    return summary
  }, { maxRetries: 1, baseDelay: 250 }),

  /**
   * Credit referral bonuses that became eligible through completed first orders.
   */
  syncReferralBonuses: withRetry(async (userId) => {
    const [currentBalance, referralsResult, transactions] = await Promise.all([
      loyaltyApi.getPointsBalance(userId),
      supabase
        .from('referrals')
        .select('id, referred_user_id, reward_points, first_order_completed_at')
        .eq('referrer_id', userId)
        .eq('reward_status', 'earned')
        .order('first_order_completed_at', { ascending: true }),
      fetchReferralBonusTransactions(userId),
    ])

    if (referralsResult.error) throw referralsResult.error

    const creditedReferralIds = new Set(
      (transactions || [])
        .map((entry) => entry.metadata?.referral_id)
        .filter(Boolean)
    )

    const summary = {
      referralsProcessed: 0,
      pointsAwarded: 0,
    }

    let runningBalance = currentBalance.points || 0
    let runningLifetimePoints = currentBalance.lifetime_points || 0
    let runningReferralBonus = currentBalance.referral_bonus_earned || 0
    let runningTier = currentBalance.tier || 'Bronze'

    for (const referral of referralsResult.data || []) {
      if (creditedReferralIds.has(referral.id)) {
        continue
      }

      const bonusPoints = toInteger(referral.reward_points || REFERRAL_REWARD_POINTS)
      if (bonusPoints <= 0) continue

      runningBalance += bonusPoints
      runningLifetimePoints += bonusPoints
      runningReferralBonus += bonusPoints
      runningTier = loyaltyApi.getTier(runningBalance).name

      await writePointsBalance({
        userId,
        points: runningBalance,
        lifetimePoints: runningLifetimePoints,
        tier: runningTier,
        referralBonusEarned: runningReferralBonus,
        lastEarnedAt: new Date().toISOString(),
      })

      await insertLoyaltyTransaction({
        userId,
        pointsChange: bonusPoints,
        reason: 'referral_bonus',
        balanceAfter: runningBalance,
        metadata: {
          referral_id: referral.id,
          referred_user_id: referral.referred_user_id,
          completed_at: referral.first_order_completed_at,
        },
        createdAt: new Date().toISOString(),
      })

      summary.referralsProcessed += 1
      summary.pointsAwarded += bonusPoints

      await insertNotification({
        userId,
        type: 'loyalty',
        title: 'تمت إضافة مكافأة الإحالة',
        message: `أضيفت ${bonusPoints} نقطة إلى رصيدك بعد اكتمال أول طلب لأحد المدعوين.`,
        data: { referral_id: referral.id, points: bonusPoints },
      })
    }

    return summary
  }, { maxRetries: 1, baseDelay: 250 }),

  /**
   * Get a complete buyer loyalty dashboard payload after syncing pending benefits.
   */
  getLoyaltyDashboard: withRetry(async (userId) => {
    const syncSummary = await loyaltyApi.syncDeliveredOrderBenefits(userId)
    const referralSyncSummary = await loyaltyApi.syncReferralBonuses(userId)

    const [stats, history, rewards, referralData] = await Promise.all([
      loyaltyApi.getLoyaltyStats(userId),
      loyaltyApi.getTransactionHistory(userId, 20),
      loyaltyApi.getAvailableRewards(),
      loyaltyApi.getReferralDashboard(userId),
    ])

    return {
      stats,
      history,
      rewards,
      referralData,
      syncSummary,
      referralSyncSummary,
    }
  }, { maxRetries: 2, baseDelay: 500 }),

  /**
   * Redeem a loyalty reward into a personal one-time coupon.
   */
  redeemReward: withRetry(async (userId, rewardId) => {
    const { data: reward, error: rewardError } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('id', rewardId)
      .eq('is_active', true)
      .single()

    if (rewardError || !reward) {
      throw new Error('Reward not found')
    }

    if (!['coupon', 'points_discount'].includes(reward.reward_type)) {
      throw new Error('هذه المكافأة غير مدعومة حالياً')
    }

    const balance = await loyaltyApi.getPointsBalance(userId)
    if (balance.points < reward.points_cost) {
      throw new Error('Insufficient points')
    }

    const generatedCode = `LOYALTY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    const discountValue = calculateRewardDiscountAmount({
      reward,
      subtotal: reward.reward_value || 0,
    })

    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .insert({
        vendor_id: null,
        code: reward.coupon_code || generatedCode,
        title: reward.title,
        description: reward.description || 'Loyalty reward coupon',
        discount_type: 'fixed',
        discount_value: discountValue,
        min_order_amount: 0,
        max_uses: 1,
        max_uses_per_user: 1,
        applies_to: 'order',
        starts_at: new Date().toISOString(),
        is_active: true,
        metadata: {
          source: 'loyalty_reward',
          assigned_user_id: userId,
          reward_id: reward.id,
        },
      })
      .select()
      .single()

    if (couponError) throw couponError

    await loyaltyApi.deductPoints(userId, reward.points_cost, 'reward_redeemed', {
      reward_id: reward.id,
      coupon_id: coupon.id,
      coupon_code: coupon.code,
      reward_type: reward.reward_type,
    })

    await insertNotification({
      userId,
      type: 'loyalty',
      title: 'تم إنشاء كوبون المكافأة',
      message: `تم تحويل نقاطك إلى كوبون شخصي بالرمز ${coupon.code}.`,
      data: { coupon_id: coupon.id, reward_id: reward.id },
    })

    return {
      reward,
      coupon,
    }
  }, { maxRetries: 2, baseDelay: 1000 }),
}

export const addLoyaltyPoints = async (userId, event, points) => {
  return loyaltyApi.awardPoints(userId, Number(points || 0), event)
}

export const generateReferralCode = async (userId) => {
  const { data: existingProfile, error: readError } = await supabase
    .from('profiles')
    .select('id, referral_code')
    .eq('id', userId)
    .single()

  if (readError) throw readError
  if (existingProfile?.referral_code) return existingProfile.referral_code

  const code = `QOTOOF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ referral_code: code })
    .eq('id', userId)

  if (updateError) throw updateError
  return code
}

export const processReferral = async (referralCode, newUserId) => {
  return loyaltyApi.attachReferralCode({
    userId: newUserId,
    referralCode,
  })
}

export default loyaltyApi
