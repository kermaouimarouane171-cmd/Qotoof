import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner, Input, formatPrice } from '@/modules/shared'
import { useTranslation } from 'react-i18next'
import loyaltyApi, { LOYALTY_TIERS, calculateRewardDiscountAmount } from '@/modules/loyalty'
import {
  TrophyIcon,
  ArrowTrendingUpIcon,
  GiftIcon,
  ArrowLeftIcon,
  ClipboardDocumentIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const reasonLabelMap = (t) => ({
  order_completed: t('buyer.loyalty.reasons.orderCompleted', 'Points earned from completed order'),
  referral_bonus: t('buyer.loyalty.reasons.referralBonus', 'Referral bonus'),
  reward_redeemed: t('buyer.loyalty.reasons.rewardRedeemed', 'Points redeemed for reward'),
})

const LOYALTY_QUERY_KEY = (userId) => ['buyer-loyalty', userId]

const BuyerLoyalty = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [redeemingRewardId, setRedeemingRewardId] = useState(null)
  const [referralCodeInput, setReferralCodeInput] = useState('')
  const [applyingReferralCode, setApplyingReferralCode] = useState(false)

  const { data: dashboard = null, isLoading: loading } = useQuery({
    queryKey: LOYALTY_QUERY_KEY(user?.id),
    queryFn: async () => {
      const data = await loyaltyApi.getLoyaltyDashboard(user.id)
      return data
    },
    enabled: Boolean(user?.id),
    staleTime: 60 * 1000,
  })

  const invalidateLoyalty = () => queryClient.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY(user?.id) })

  const stats = dashboard?.stats || {
    points: 0,
    lifetimePoints: 0,
    lifetimeSpent: 0,
    tier: 'Bronze',
    tierProgress: 0,
    pointsToNextTier: 0,
    nextTier: null,
    referralBonusEarned: 0,
  }
  const rewards = dashboard?.rewards || []
  const history = dashboard?.history || []
  const referralData = dashboard?.referralData || null

  const currentTier = useMemo(
    () => LOYALTY_TIERS.find((tier) => tier.name === stats.tier) || LOYALTY_TIERS[0],
    [stats.tier]
  )

  const handleCopy = async (value, successMessage) => {
    if (!value) return

    try {
      await navigator.clipboard.writeText(value)
      toast.success(successMessage)
    } catch {
      toast.error(t('buyer.loyalty.errors.copyFailed', 'Failed to copy'))
    }
  }

  const handleRedeemReward = async (reward) => {
    if (!user?.id) return

    setRedeemingRewardId(reward.id)
    try {
      const result = await loyaltyApi.redeemReward(user.id, reward.id)
      toast.success(t('buyer.loyalty.success.couponCreated', 'Your personal coupon has been created: {{code}}', { code: result.coupon.code }))
      invalidateLoyalty()
    } catch (error) {
      logger.error('Reward redemption failed:', error)
      toast.error(error.message || t('buyer.loyalty.errors.redeemFailed', 'Failed to redeem reward'))
    } finally {
      setRedeemingRewardId(null)
    }
  }

  const handleApplyReferralCode = async () => {
    if (!user?.id || !referralCodeInput.trim()) return

    setApplyingReferralCode(true)
    try {
      const result = await loyaltyApi.attachReferralCode({
        userId: user.id,
        referralCode: referralCodeInput,
      })

      if (result?.alreadyLinked) {
        toast.success(t('buyer.loyalty.success.referralAlreadyLinked', 'Your account is already linked to a referral'))
      } else {
        toast.success(t('buyer.loyalty.success.referralLinked', 'Referral code linked successfully'))
      }

      setReferralCodeInput('')
      invalidateLoyalty()
    } catch (error) {
      logger.error('Failed to apply referral code:', error)
      toast.error(error.message || t('buyer.loyalty.errors.referralFailed', 'Failed to apply referral code'))
    } finally {
      setApplyingReferralCode(false)
    }
  }

  const getRewardValueLabel = (reward) => {
    const rewardValue = calculateRewardDiscountAmount({ reward, subtotal: reward.reward_value })
    return `${Number(rewardValue || 0).toFixed(2)} ${t('buyer.loyalty.currency', 'MAD')}`
  }

  const formatHistoryReason = (entry) => (reasonLabelMap(t)[entry.reason] || entry.reason || t('buyer.loyalty.reasons.default', 'Points transaction'))

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/marketplace')} className="p-2 hover:bg-gray-100 rounded-lg" aria-label={t('buyer.loyalty.backToMarketplace', 'Back to marketplace')}>
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrophyIcon className="w-7 h-7 text-amber-500" />
            {t('buyer.loyalty.title', 'Loyalty Program')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('buyer.loyalty.subtitle', 'Earn points with every purchase')}</p>
        </div>
      </div>

      <Card className={`p-8 mb-8 bg-gradient-to-r ${currentTier.color} text-white`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <p className="text-white/80 text-sm mb-1">{t('buyer.loyalty.pointsBalance', 'Your Points Balance')}</p>
            <p className="text-5xl font-bold">{Number(stats.points || 0).toLocaleString()}</p>
            <p className="text-white/70 text-sm mt-1">
              {t('buyer.loyalty.lifetimeSpent', 'Lifetime spent')}: {formatPrice(stats.lifetimeSpent || 0)}
            </p>
          </div>
          <div className="text-center sm:text-right">
            <span className="text-4xl">{currentTier.icon}</span>
            <p className="text-white font-semibold text-lg mt-1">{t('buyer.loyalty.tierMember', '{{tier}} Member', { tier: currentTier.name })}</p>
          </div>
        </div>

        {stats.nextTier && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm text-white/80 mb-2">
              <span>{currentTier.name}</span>
              <span>
                {t('buyer.loyalty.pointsToNext', '{{points}} / {{nextMin}} points to {{nextTier}}', {
                  points: stats.points,
                  nextMin: (LOYALTY_TIERS.find((tier) => tier.name === stats.nextTier)?.minPoints) || stats.points,
                  nextTier: stats.nextTier,
                })}
              </span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, stats.tierProgress || 0)}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-5">
          <p className="text-sm text-gray-500 mb-1">{t('buyer.loyalty.lifetimePoints', 'Lifetime Points')}</p>
          <p className="text-2xl font-bold text-gray-900">{Number(stats.lifetimePoints || 0).toLocaleString()}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500 mb-1">{t('buyer.loyalty.referralBonus', 'Referral Bonus')}</p>
          <p className="text-2xl font-bold text-gray-900">{Number(stats.referralBonusEarned || 0).toLocaleString()}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500 mb-1">{t('buyer.loyalty.registeredReferrals', 'Registered Referrals')}</p>
          <p className="text-2xl font-bold text-gray-900">{referralData?.summary?.total || 0}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-gray-500 mb-1">{t('buyer.loyalty.activeRewards', 'Active Rewards')}</p>
          <p className="text-2xl font-bold text-gray-900">{rewards.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {LOYALTY_TIERS.map((tier) => (
          <Card key={tier.name} className={`p-4 text-center border-2 ${
            tier.name === currentTier.name ? 'border-green-400 shadow-lg' : 'border-gray-100'
          }`}>
            <span className="text-3xl">{tier.icon}</span>
            <h3 className={`font-semibold mt-2 ${tier.name === currentTier.name ? 'text-green-600' : 'text-gray-900'}`}>
              {t(`buyer.loyalty.tiers.${tier.name.toLowerCase()}`, tier.name)}
            </h3>
            <p className="text-xs text-gray-500 mt-1">{tier.minPoints}+ points</p>
            {tier.name === currentTier.name && (
              <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                {t('buyer.loyalty.currentBadge', 'Current')}
              </span>
            )}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">{t('buyer.loyalty.referralProgram', 'Referral Program')}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('buyer.loyalty.referralDesc', 'Share your link or link your account with a valid referral code')}</p>
            </div>
            <TagIcon className="w-6 h-6 text-green-600" />
          </div>

          <div className="rounded-2xl border border-dashed border-green-300 bg-green-50 px-4 py-4 mb-4">
            <p className="text-xs text-green-700 mb-1">{t('buyer.loyalty.yourReferralCode', 'Your Referral Code')}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-xl bg-white px-4 py-3 text-lg font-bold tracking-[0.25em] text-green-700 text-center">
                {referralData?.referralCode || '--------'}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(referralData?.referralCode, t('buyer.loyalty.success.codeCopied', 'Referral code copied'))}
                className="p-3 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                <ClipboardDocumentIcon className="w-5 h-5" />
              </button>
            </div>
            {referralData?.referralLink && (
              <button
                type="button"
                onClick={() => handleCopy(referralData.referralLink, t('buyer.loyalty.success.linkCopied', 'Referral link copied'))}
                className="mt-3 text-sm font-medium text-green-700 hover:text-green-800"
              >
                {t('buyer.loyalty.copyReferralLink', 'Copy referral registration link')}
              </button>
            )}
          </div>

          {referralData?.referredBy ? (
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 mb-4">
              {t('buyer.loyalty.referredBy', 'Your account was referred by')}
              {' '}
              <span className="font-semibold">{`${referralData.referredBy.first_name || ''} ${referralData.referredBy.last_name || ''}`.trim()}</span>
              {referralData.profile?.referral_completed_at && (
                <span className="block text-xs text-green-700 mt-1">{t('buyer.loyalty.firstOrderCompleted', 'First order linked to this referral has been completed and the bonus has been awarded.')}</span>
              )}
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              <Input
                label={t('buyer.loyalty.haveReferralCode', 'Have a referral code?')}
                value={referralCodeInput}
                onChange={(event) => setReferralCodeInput(event.target.value.toUpperCase())}
                placeholder={t('buyer.loyalty.enterReferralCode', 'Enter referral code')}
              />
              <button
                type="button"
                onClick={handleApplyReferralCode}
                disabled={applyingReferralCode || !referralCodeInput.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applyingReferralCode ? t('buyer.loyalty.linking', 'Linking...') : t('buyer.loyalty.linkCode', 'Link Referral Code')}
              </button>
            </div>
          )}

          <div className="space-y-3">
            {(referralData?.referrals || []).length === 0 ? (
              <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                {t('buyer.loyalty.noReferralsYet', 'No referrals yet. Share your code with new buyers.')}
              </div>
            ) : (
              referralData.referrals.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {entry.referred_user?.first_name || t('buyer.loyalty.newUser', 'New User')} {entry.referred_user?.last_name || ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {entry.reward_status === 'earned' ? t('buyer.loyalty.referralEarned', 'First order completed and referral bonus prepared') : t('buyer.loyalty.referralPending', 'Awaiting first completed order')}
                    </p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                    entry.reward_status === 'earned' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {entry.reward_status === 'earned' ? t('buyer.loyalty.statusEarned', 'Earned') : t('buyer.loyalty.statusPending', 'Pending')}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">{t('buyer.loyalty.rewardsTitle', 'Points Rewards')}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('buyer.loyalty.rewardsDesc', 'Convert your points into personal coupons usable for purchases')}</p>
            </div>
            <GiftIcon className="w-6 h-6 text-amber-500" />
          </div>

          <div className="space-y-3">
            {rewards.length === 0 ? (
              <div className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                {t('buyer.loyalty.noRewardsAvailable', 'No rewards available currently.')}
              </div>
            ) : (
              rewards.map((reward) => {
                const canRedeem = Number(stats.points || 0) >= Number(reward.points_cost || 0)

                return (
                  <div key={reward.id} className="rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{reward.title}</h3>
                        {reward.description && <p className="text-sm text-gray-500 mt-1">{reward.description}</p>}
                      </div>
                      <span className="text-xs font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                        {Number(reward.points_cost || 0)} {t('buyer.loyalty.points', 'points')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                      <span>{t('buyer.loyalty.rewardValue', 'Reward Value')}</span>
                      <span className="font-medium text-gray-900">{getRewardValueLabel(reward)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRedeemReward(reward)}
                      disabled={!canRedeem || redeemingRewardId === reward.id}
                      className="w-full rounded-xl bg-gray-900 text-white py-2.5 font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {redeemingRewardId === reward.id ? t('buyer.loyalty.creatingCoupon', 'Creating coupon...') : canRedeem ? t('buyer.loyalty.convertToCoupon', 'Convert to personal coupon') : t('buyer.loyalty.insufficientPoints', 'Insufficient points')}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ArrowTrendingUpIcon className="w-5 h-5 text-green-600" />
            {t('buyer.loyalty.historyTitle', 'Points History')}
          </h2>
        </div>
        {history.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <GiftIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>{t('buyer.loyalty.emptyHistory', 'No points earned yet. Start shopping to earn loyalty points!')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{formatHistoryReason(tx)}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-1">
                    <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                    {tx.order?.order_number && <span>{t('buyer.loyalty.order', 'Order')} #{tx.order.order_number}</span>}
                    {tx.metadata?.coupon_code && <span>{t('buyer.loyalty.coupon', 'Coupon')} {tx.metadata.coupon_code}</span>}
                  </div>
                </div>
                <span className={`font-semibold ${tx.points_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.points_change > 0 ? '+' : ''}{tx.points_change}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default BuyerLoyalty
