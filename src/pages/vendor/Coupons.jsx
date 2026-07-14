import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { formatPrice } from '@/utils/currency'
import {
  TagIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  SparklesIcon,
  QrCodeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import vendorSubscriptionService from '@/services/vendorSubscriptionService'

const VendorCoupons = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [subscriptionOk, setSubscriptionOk] = useState(null) // null=loading, true/false=result
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    applies_to: 'order',
    discount_type: 'percentage',
    discount_value: '',
    min_order_amount: '',
    minimum_quantity: '',
    max_uses: '',
    max_uses_per_user: '',
    starts_at: '',
    expires_at: '',
    is_active: true,
  })

  const loadCoupons = useCallback(async () => {
    if (!user?.id) {
      setCoupons([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const couponIds = (data || []).map((coupon) => coupon.id)
      let redemptionCounts = new Map()

      if (couponIds.length > 0) {
        const { data: redemptionRows, error: redemptionError } = await supabase
          .from('coupon_redemptions')
          .select('coupon_id')
          .in('coupon_id', couponIds)

        if (redemptionError) throw redemptionError

        redemptionCounts = (redemptionRows || []).reduce((counts, redemption) => {
          const key = redemption.coupon_id
          counts.set(key, (counts.get(key) || 0) + 1)
          return counts
        }, new Map())
      }

      const couponsWithStats = (data || []).map((coupon) => ({
        ...coupon,
        total_uses: redemptionCounts.get(coupon.id) || 0,
        is_expired: coupon.expires_at ? new Date(coupon.expires_at) < new Date() : false,
      }))

      setCoupons(couponsWithStats)
    } catch (error) {
      logger.error('Error loading coupons:', error)
      toast.error(t('vendor.coupons.loadFailed', 'Failed to load coupons'))
    } finally {
      setLoading(false)
    }
  }, [t, user?.id])

  useEffect(() => {
    loadCoupons()
  }, [loadCoupons])

  // Feature gate: coupons require Basic plan or higher
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user?.id) return
      try {
        const hasAccess = await vendorSubscriptionService.hasFeatureAccess(user.id, 'basic')
        setSubscriptionOk(hasAccess)
      } catch (error) {
        logger.warn('[Coupons] Subscription check failed, allowing access:', error?.message)
        setSubscriptionOk(true) // Fail open — don't block if check fails
      }
    }
    checkSubscription()
  }, [user?.id])

  const resetForm = () => {
    setFormData({
      code: generateCode(),
      title: '',
      description: '',
      applies_to: 'order',
      discount_type: 'percentage',
      discount_value: '',
      min_order_amount: '',
      minimum_quantity: '',
      max_uses: '',
      max_uses_per_user: '',
      starts_at: '',
      expires_at: '',
      is_active: true,
    })
    setShowForm(false)
    setEditingId(null)
  }

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  const handleEdit = (coupon) => {
    setFormData({
      code: coupon.code || '',
      title: coupon.title || '',
      description: coupon.description || '',
      applies_to: coupon.applies_to || 'order',
      discount_type: coupon.discount_type || 'percentage',
      discount_value: coupon.discount_value || '',
      min_order_amount: coupon.min_order_amount || '',
      minimum_quantity: coupon.minimum_quantity || '',
      max_uses: coupon.max_uses || '',
      max_uses_per_user: coupon.max_uses_per_user || '',
      starts_at: coupon.starts_at ? coupon.starts_at.split('T')[0] : '',
      expires_at: coupon.expires_at ? coupon.expires_at.split('T')[0] : '',
      is_active: coupon.is_active ?? true,
    })
    setEditingId(coupon.id)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.code.trim() || !formData.discount_value) {
      toast.error(t('vendor.coupons.fillRequired', 'Please fill in code and discount value'))
      return
    }

    if (formData.applies_to === 'bulk' && !formData.minimum_quantity) {
      toast.error(t('vendor.coupons.minQuantityRequired', 'أدخل الحد الأدنى للكمية لتفعيل عرض الكميات'))
      return
    }

    const payload = {
      ...formData,
      vendor_id: user.id,
      applies_to: formData.applies_to,
      discount_value: parseFloat(formData.discount_value),
      min_order_amount: formData.min_order_amount ? parseFloat(formData.min_order_amount) : null,
      minimum_quantity: formData.minimum_quantity ? parseFloat(formData.minimum_quantity) : null,
      max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
      max_uses_per_user: formData.max_uses_per_user ? parseInt(formData.max_uses_per_user) : null,
      starts_at: formData.starts_at || null,
      expires_at: formData.expires_at || null,
      metadata: formData.applies_to === 'bulk' ? { auto_apply: true } : {},
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('coupons')
          .update(payload)
          .eq('id', editingId)
          .eq('vendor_id', user.id)

        if (error) throw error
        toast.success(t('vendor.coupons.updated', 'Coupon updated'))
      } else {
        const { error } = await supabase
          .from('coupons')
          .insert(payload)

        if (error) throw error
        toast.success(t('vendor.coupons.created', 'Coupon created'))
      }

      resetForm()
      await loadCoupons()
    } catch (error) {
      logger.error('Error saving coupon:', error)
      toast.error(t('vendor.coupons.saveFailed', 'Failed to save coupon'))
    }
  }

  const handleToggleActive = async (coupon) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: !coupon.is_active })
        .eq('id', coupon.id)
        .eq('vendor_id', user.id)

      if (error) throw error
      await loadCoupons()
      toast.success(coupon.is_active ? t('vendor.coupons.deactivated', 'Coupon deactivated') : t('vendor.coupons.activated', 'Coupon activated'))
    } catch (error) {
      logger.error('Error toggling coupon:', error)
      toast.error(t('vendor.coupons.updateFailed', 'Failed to update coupon'))
    }
  }

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id)
        .eq('vendor_id', user.id)

      if (error) throw error
      setCoupons(prev => prev.filter(c => c.id !== id))
      toast.success(t('vendor.coupons.deleted', 'Coupon deleted'))
    } catch (error) {
      logger.error('Error deleting coupon:', error)
      toast.error(t('vendor.coupons.deleteFailed', 'Failed to delete coupon'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      {/* Subscription Gate: Coupons require Basic plan or higher */}
      {subscriptionOk === false && (
        <Card className="p-8 mb-6 border-2 border-amber-200 bg-amber-50">
          <div className="flex flex-col items-center text-center gap-4">
            <SparklesIcon className="w-12 h-12 text-amber-500" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {t('vendor.coupons.upgradeRequired', 'ترقية مطلوبة')}
              </h2>
              <p className="text-sm text-gray-600 max-w-md">
                {t('vendor.coupons.upgradeMessage', 'كوبونات والتخفيضات متاحة فقط للبائعين المشتركين في خطة أساسي أو أعلى. قم بترقية خطتك لإنشاء وإدارة الكوبونات.')}
              </p>
            </div>
            <button
              onClick={() => navigate('/vendor/subscription')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition-colors"
            >
              <SparklesIcon className="w-4 h-4" />
              {t('vendor.coupons.upgradeNow', 'ترقية الآن')}
            </button>
          </div>
        </Card>
      )}

      {/* Subscription Gate: Show full page block when not subscribed */}
      {subscriptionOk === false ? (
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/vendor/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={t('vendor.coupons.aria.back', 'العودة إلى لوحة التحكم')}
            >
              <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <TagIcon className="w-7 h-7 text-green-600" />
                {t('vendor.coupons.title', 'Coupon Manager')}
              </h1>
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/vendor/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t('vendor.coupons.aria.back', 'العودة إلى لوحة التحكم')}
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TagIcon className="w-7 h-7 text-green-600" />
              {t('vendor.coupons.title', 'Coupon Manager')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('vendor.coupons.couponCount', '{{count}} coupon created', { count: coupons.length })}
            </p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          {t('vendor.coupons.createCoupon', 'Create Coupon')}
        </button>
      </div>

      {/* Coupon Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label={t('common.close', 'Close')}
            className="absolute inset-0"
            onClick={resetForm}
          />
          <div
            className="relative z-10 bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? t('vendor.coupons.editCoupon', 'Edit Coupon') : t('vendor.coupons.createNewCoupon', 'Create New Coupon')}
              </h2>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg" aria-label={t('common.close', 'إغلاق')}>
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor.coupons.couponCode', 'Coupon Code')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder={t('vendor.coupons.codePlaceholder', 'SUMMER2025')}
                    className="input font-mono font-bold uppercase flex-1"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, code: generateCode() }))}
                    className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                    aria-label={t('vendor.coupons.generateCode', 'Generate random code')}
                  >
                    <QrCodeIcon className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor.coupons.titleLabel', 'Title')}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={t('vendor.coupons.titlePlaceholder', 'Summer Sale')}
                  className="input"
                />
              </div>

              <div>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع العرض</label>
                <select
                  value={formData.applies_to}
                  onChange={(e) => setFormData(prev => ({ ...prev, applies_to: e.target.value }))}
                  className="input"
                >
                  <option value="order">كوبون يدوي للطلب</option>
                  <option value="bulk">خصم تلقائي على الكميات</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.applies_to === 'bulk'
                    ? 'سيُطبّق هذا العرض تلقائياً في checkout عند تحقق حد الكمية.'
                    : 'يدخل المشتري الرمز يدوياً أثناء إتمام الطلب.'}
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor.coupons.description', 'Description')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  placeholder={t('vendor.coupons.descriptionPlaceholder', 'Get 20% off on all products')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Discount Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor.coupons.discountType', 'Discount Type')}</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value }))}
                    className="input"
                  >
                    <option value="percentage">{t('vendor.coupons.percentage', 'Percentage (%)')}</option>
                    <option value="fixed">{t('vendor.coupons.fixed', 'Fixed Amount (MAD)')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('vendor.coupons.discountValue', 'Discount Value')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.discount_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, discount_value: e.target.value }))}
                    placeholder={formData.discount_type === 'percentage' ? '20' : '50'}
                    min="0"
                    className="input"
                    required
                  />
                </div>
              </div>

              {/* Min Order & Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor.coupons.minOrder', 'Min Order (MAD)')}</label>
                  <input
                    type="number"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, min_order_amount: e.target.value }))}
                    placeholder="100"
                    min="0"
                    className="input"
                  />
                </div>
                <div>
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأدنى للكمية</label>
                  <input
                    type="number"
                    value={formData.minimum_quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, minimum_quantity: e.target.value }))}
                    placeholder="10"
                    min="0"
                    className="input"
                    disabled={formData.applies_to !== 'bulk'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor.coupons.maxUses', 'Max Uses')}</label>
                  <input
                    type="number"
                    value={formData.max_uses}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_uses: e.target.value }))}
                    placeholder="100"
                    min="1"
                    className="input"
                  />
                </div>
                <div>
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label className="block text-sm font-medium text-gray-700 mb-1">الحد الأقصى لكل مشتري</label>
                  <input
                    type="number"
                    value={formData.max_uses_per_user}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_uses_per_user: e.target.value }))}
                    placeholder="1"
                    min="1"
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البداية</label>
                  <input
                    type="date"
                    value={formData.starts_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, starts_at: e.target.value }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('vendor.coupons.expiryDate', 'Expiry Date')}</label>
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>

              {/* Active */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">{t('vendor.coupons.activeLabel', 'Active (visible to buyers)')}</span>
              </label>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="btn-outline flex-1">
                  {t('vendor.coupons.cancel', 'Cancel')}
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingId ? t('vendor.coupons.updateCoupon', 'Update Coupon') : t('vendor.coupons.createCoupon', 'Create Coupon')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coupons List */}
      {coupons.length === 0 ? (
        <Card className="p-12 text-center">
          <TagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('vendor.coupons.noCoupons', 'No coupons created')}</h3>
          <p className="text-gray-500 mb-6">{t('vendor.coupons.noCouponsDesc', 'Create your first coupon to attract more buyers')}</p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <SparklesIcon className="w-5 h-5" />
            {t('vendor.coupons.createCoupon', 'Create Coupon')}
          </button>
        </Card>
      ) : (
        <div className="space-y-3">
          {coupons.map(coupon => (
            <Card key={coupon.id} className="p-4 flex items-center gap-4">
              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                coupon.is_active && !coupon.is_expired
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                <TagIcon className="w-6 h-6" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">{coupon.code}</h3>
                  {coupon.is_expired && (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">{t('vendor.coupons.expired', 'Expired')}</span>
                  )}
                  {!coupon.is_active && !coupon.is_expired && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">{t('vendor.coupons.inactive', 'Inactive')}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {coupon.title || t('vendor.coupons.noTitle', 'No title')}
                  {coupon.applies_to === 'bulk' ? ' — خصم كميات تلقائي' : ''}
                  {coupon.discount_type === 'percentage'
                    ? ` — ${coupon.discount_value}% ${t('vendor.coupons.off', 'off')}`
                    : ` — ${formatPrice(coupon.discount_value)} ${t('vendor.coupons.off', 'off')}`}
                  {coupon.min_order_amount && ` (${t('vendor.coupons.min', 'min')} ${formatPrice(coupon.min_order_amount)})`}
                  {coupon.applies_to === 'bulk' && coupon.minimum_quantity && ` · يبدأ من ${Number(coupon.minimum_quantity).toFixed(0)} وحدات`}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t('vendor.coupons.used', 'Used')} {coupon.total_uses} {t('vendor.coupons.times', 'times', { count: coupon.total_uses })}
                  {coupon.max_uses && ` / ${coupon.max_uses}`}
                  {coupon.max_uses_per_user && ` · لكل مشتري ${coupon.max_uses_per_user}`}
                  {coupon.starts_at && ` · يبدأ ${new Date(coupon.starts_at).toLocaleDateString()}`}
                  {coupon.expires_at && ` · ${t('vendor.coupons.expires', 'Expires')} ${new Date(coupon.expires_at).toLocaleDateString()}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleToggleActive(coupon)}
                  className={`p-2 rounded-lg transition-colors ${
                    coupon.is_active
                      ? 'text-green-600 hover:bg-green-50'
                      : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  aria-label={coupon.is_active ? t('vendor.coupons.deactivate', 'Deactivate') : t('vendor.coupons.activate', 'Activate')}
                  title={coupon.is_active ? t('vendor.coupons.deactivate', 'Deactivate') : t('vendor.coupons.activate', 'Activate')}
                >
                  {coupon.is_active ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => handleEdit(coupon)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  aria-label={t('vendor.coupons.edit', 'Edit')}
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(coupon.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label={t('vendor.coupons.delete', 'Delete')}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  )
}

export default VendorCoupons
