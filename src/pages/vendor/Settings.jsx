import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { profilesService } from '@/services/profilesService'
import storeTypeService from '@/services/storeTypeService'
import { Card, Input, LoadingSpinner, Tooltip } from '@/components/ui'
import LocationPicker from '@/components/ui/LocationPicker'
import PaymentPolicySettings from '@/components/vendor/PaymentPolicySettings'
import CancellationPolicy from '@/components/vendor/CancellationPolicy'
import RefundPolicySettings from '@/components/vendor/RefundPolicySettings'
import ErrorBoundary from '@/components/ErrorBoundary'
import storeEmergencyService from '@/services/storeEmergencyService'
import cancellationService, { DEFAULT_VENDOR_CANCELLATION_POLICY, normalizeCancellationPolicy } from '@/services/cancellationService'
import refundPolicyService, { DEFAULT_REFUND_POLICY } from '@/services/refundPolicyService'
import {
  Cog6ToothIcon,
  BellIcon,
  CheckCircleIcon,
  MapPinIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { auditLogger } from '@/services/auditLogger'
import { hasValidPayPalEmail } from '@/utils/paypalEligibility'

const VendorSettings = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [storeSetupSummary, setStoreSetupSummary] = useState(null)
  const [storePaused, setStorePaused] = useState(false)
  const [storePauseReason, setStorePauseReason] = useState('')
  const [pausingStore, setPausingStore] = useState(false)

  // Store settings
  const [storeName, setStoreName] = useState('')
  const [minOrderAmount, setMinOrderAmount] = useState('')
  const [currency, setCurrency] = useState('MAD')
  const [lowStockThreshold, setLowStockThreshold] = useState('10')
  const [paymentPolicies, setPaymentPolicies] = useState({
    full: true,
    split: true,
    cod: false,
  })
  const [paypalEmail, setPaypalEmail] = useState('')
  const [paypalVerified, setPaypalVerified] = useState(false)
  const [cancellationPolicy, setCancellationPolicy] = useState({ ...DEFAULT_VENDOR_CANCELLATION_POLICY })
  const [refundPolicy, setRefundPolicy] = useState({ ...DEFAULT_REFUND_POLICY })

  // Notification settings
  const [notifyNewOrders, setNotifyNewOrders] = useState(true)
  const [notifyOrderUpdates, setNotifyOrderUpdates] = useState(true)
  const [notifyCustomerMessages, setNotifyCustomerMessages] = useState(true)
  const [notifyLowStock, setNotifyLowStock] = useState(true)
  const [notifyReviews, setNotifyReviews] = useState(true)

  // Errors
  const [errors, setErrors] = useState({})

  // Store location
  const [storeLocation, setStoreLocation] = useState(null)

  // Load current settings
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadSettings()
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  const loadSettings = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data, error } = await profilesService.fetchVendorProfile(user.id)
      if (error) throw error

      const vendorCancellationPolicy = await cancellationService.getVendorCancellationPolicy(user.id)
      const vendorRefundPolicy = await refundPolicyService.getVendorRefundPolicy(user.id)

      setStoreName(data?.store_name || '')
      setMinOrderAmount(data?.min_order_amount?.toString() || '50')
      setCurrency(data?.currency || 'MAD')
      setLowStockThreshold(data?.low_stock_threshold?.toString() || '10')
      setPaymentPolicies({
        full: data?.payment_policy_full ?? true,
        split: data?.payment_policy_split ?? true,
        cod: data?.payment_policy_cod ?? false,
      })
      setPaypalEmail(data?.paypal_email || '')
      setPaypalVerified(data?.paypal_verified === true)
      setCancellationPolicy(vendorCancellationPolicy)
      setRefundPolicy(vendorRefundPolicy)
      setNotifyNewOrders(data?.notify_new_orders ?? true)
      setNotifyOrderUpdates(data?.notify_order_updates ?? true)
      setNotifyCustomerMessages(data?.notify_customer_messages ?? true)
      setNotifyLowStock(data?.notify_low_stock ?? true)
      setNotifyReviews(data?.notify_reviews ?? true)
      setStorePaused(Boolean(data?.store_paused))
      setStorePauseReason(data?.store_paused_reason || '')
      setStoreSetupSummary(storeTypeService.decorateStoreProfile(data))
      if (data?.latitude && data?.longitude) {
        setStoreLocation({ lat: data.latitude, lng: data.longitude, address: data.store_address || '' })
      }
    } catch (error) {
      logger.error('Error loading settings:', error)
      toast.error(t('vendor.settings.errors.loadFailed', 'Failed to load settings'))
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const errors = {}

    if (!storeName.trim()) {
      errors.storeName = t('vendor.settings.errors.storeNameRequired', 'Store name is required')
    } else if (storeName.length < 3) {
      errors.storeName = t('vendor.settings.errors.storeNameShort', 'Store name must be at least 3 characters')
    } else if (storeName.length > 100) {
      errors.storeName = t('vendor.settings.errors.storeNameLong', 'Store name must be less than 100 characters')
    }

    const minAmount = parseFloat(minOrderAmount)
    if (isNaN(minAmount) || minAmount < 0) {
      errors.minOrderAmount = t('vendor.settings.errors.invalidMinOrder', 'Minimum order amount must be a valid number')
    }

    const threshold = parseInt(lowStockThreshold)
    if (isNaN(threshold) || threshold < 1) {
      errors.lowStockThreshold = t('vendor.settings.errors.invalidThreshold', 'Low stock threshold must be at least 1')
    }

    if (!paymentPolicies.full && !paymentPolicies.split && !paymentPolicies.cod) {
      errors.paymentPolicies = 'يجب تفعيل سياسة دفع واحدة على الأقل.'
    }

    if (!paypalEmail.trim()) {
      errors.paypalEmail = 'بريد PayPal الإلكتروني إلزامي للبائع.'
    } else if (!hasValidPayPalEmail(paypalEmail)) {
      errors.paypalEmail = 'أدخل بريد PayPal إلكترونيًا صالحًا.'
    }

    const normalizedCancellationPolicy = normalizeCancellationPolicy(cancellationPolicy)

    if (normalizedCancellationPolicy.free_cancellation_window_minutes < 0) {
      errors.cancellationPolicy = 'نافذة الإلغاء المجاني يجب أن تكون صفراً أو أكثر.'
    } else if (
      normalizedCancellationPolicy.cancellation_fee_type === 'percentage' &&
      normalizedCancellationPolicy.cancellation_fee_value > 100
    ) {
      errors.cancellationPolicy = 'رسوم الإلغاء بالنسبة المئوية يجب ألا تتجاوز 100%.'
    } else if (
      normalizedCancellationPolicy.refund_percentage < 0 ||
      normalizedCancellationPolicy.refund_percentage > 100
    ) {
      errors.cancellationPolicy = 'نسبة الاسترداد يجب أن تكون بين 0% و100%.'
    }

    if (Number(refundPolicy.return_window_days || 0) < 1 || Number(refundPolicy.return_window_days || 0) > 30) {
      errors.refundPolicy = 'نافذة الإرجاع يجب أن تكون بين 1 و30 يومًا.'
    }

    if (!refundPolicy.policy_text?.trim()) {
      errors.refundPolicy = 'أضف نصًا واضحًا لسياسة الاسترجاع.'
    }

    return errors
  }

  const handleSave = async () => {
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      toast.error(t('vendor.settings.errors.fixErrors', 'Please fix the errors before saving'))
      return
    }

    setSaving(true)
    setErrors({})

    try {
      // Get old settings for audit logging
      const { data: previousProfile, error: previousProfileError } = await profilesService.fetchVendorProfile(user.id)
      if (previousProfileError) throw previousProfileError

      const oldData = previousProfile
        ? {
            store_name: previousProfile.store_name,
            min_order_amount: previousProfile.min_order_amount,
            currency: previousProfile.currency,
            low_stock_threshold: previousProfile.low_stock_threshold,
            payment_policy_full: previousProfile.payment_policy_full,
            payment_policy_split: previousProfile.payment_policy_split,
            payment_policy_cod: previousProfile.payment_policy_cod,
            notify_new_orders: previousProfile.notify_new_orders,
            notify_order_updates: previousProfile.notify_order_updates,
            notify_customer_messages: previousProfile.notify_customer_messages,
            notify_low_stock: previousProfile.notify_low_stock,
            notify_reviews: previousProfile.notify_reviews,
            paypal_email: previousProfile.paypal_email,
            paypal_verified: previousProfile.paypal_verified,
          }
        : null

      const oldCancellationPolicy = await cancellationService.getVendorCancellationPolicy(user.id)
      const oldRefundPolicy = await refundPolicyService.getVendorRefundPolicy(user.id)

      const { error } = await profilesService.updateProfile(user.id, {
        store_name: storeName,
        min_order_amount: parseFloat(minOrderAmount),
        currency,
        low_stock_threshold: parseInt(lowStockThreshold),
        payment_policy_full: paymentPolicies.full,
        payment_policy_split: paymentPolicies.split,
        payment_policy_cod: paymentPolicies.cod,
        notify_new_orders: notifyNewOrders,
        notify_order_updates: notifyOrderUpdates,
        notify_customer_messages: notifyCustomerMessages,
        notify_low_stock: notifyLowStock,
        notify_reviews: notifyReviews,
        ...(storeLocation?.lat ? {
          latitude: storeLocation.lat,
          longitude: storeLocation.lng,
          store_address: storeLocation.address || null,
        } : {}),
        paypal_email: paypalEmail.trim().toLowerCase(),
        payout_method: 'paypal',
      })

      if (error) throw error

      const savedCancellationPolicy = await cancellationService.upsertVendorCancellationPolicy({
        vendorId: user.id,
        policy: cancellationPolicy,
      })
      const savedRefundPolicy = await refundPolicyService.upsertVendorRefundPolicy({
        vendorId: user.id,
        policy: refundPolicy,
      })

      // Update local auth store
      useAuthStore.setState({
        profile: {
          ...profile,
          store_name: storeName,
          min_order_amount: parseFloat(minOrderAmount),
          currency,
          low_stock_threshold: parseInt(lowStockThreshold),
          payment_policy_full: paymentPolicies.full,
          payment_policy_split: paymentPolicies.split,
          payment_policy_cod: paymentPolicies.cod,
          paypal_email: paypalEmail.trim().toLowerCase(),
          payout_method: 'paypal',
        }
      })
      setCancellationPolicy(savedCancellationPolicy)
      setRefundPolicy(savedRefundPolicy)

      // Log settings update
      await auditLogger.logProfileAction('SETTINGS_UPDATED', {
        ...oldData,
        store_name: storeName,
        min_order_amount: parseFloat(minOrderAmount),
        currency,
        low_stock_threshold: parseInt(lowStockThreshold),
        payment_policy_full: paymentPolicies.full,
        payment_policy_split: paymentPolicies.split,
        payment_policy_cod: paymentPolicies.cod,
        notify_new_orders: notifyNewOrders,
        notify_order_updates: notifyOrderUpdates,
        notify_customer_messages: notifyCustomerMessages,
        notify_low_stock: notifyLowStock,
        notify_reviews: notifyReviews,
        paypal_email: paypalEmail.trim().toLowerCase(),
        paypal_verified: paypalVerified,
        cancellation_policy: savedCancellationPolicy,
        refund_policy: savedRefundPolicy,
      }, {
        ...oldData,
        cancellation_policy: oldCancellationPolicy,
        refund_policy: oldRefundPolicy,
      })

      toast.success(t('vendor.settings.saved', 'Settings saved successfully!'))
      setHasChanges(false)
    } catch (error) {
      logger.error('Error saving settings:', error)
      toast.error(t('vendor.settings.errors.saveFailed', 'Failed to save settings'))
    } finally {
      setSaving(false)
    }
  }

  const handleFieldChange = (setter, value) => {
    setter(value)
    setHasChanges(true)
  }

  const handlePaymentPoliciesChange = (nextPolicies) => {
    setPaymentPolicies(nextPolicies)
    setHasChanges(true)
    setErrors((prev) => {
      if (!prev.paymentPolicies) return prev
      const { paymentPolicies: _paymentPolicies, ...rest } = prev
      return rest
    })
  }

  const handleCancellationPolicyChange = (nextPolicy) => {
    setCancellationPolicy(nextPolicy)
    setHasChanges(true)
    setErrors((prev) => {
      if (!prev.cancellationPolicy) return prev
      const { cancellationPolicy: _cancellationPolicy, ...rest } = prev
      return rest
    })
  }

  const handleRefundPolicyChange = (nextPolicy) => {
    setRefundPolicy(nextPolicy)
    setHasChanges(true)
    setErrors((prev) => {
      if (!prev.refundPolicy) return prev
      const { refundPolicy: _refundPolicy, ...rest } = prev
      return rest
    })
  }

  const handlePauseStore = async () => {
    if (!user?.id) return

    setPausingStore(true)
    try {
      const result = await storeEmergencyService.pauseStore({
        vendorId: user.id,
        reason: storePauseReason,
      })

      setStorePaused(true)
      useAuthStore.setState((state) => ({
        ...state,
        profile: state.profile
          ? {
              ...state.profile,
              store_paused: true,
              store_paused_reason: storePauseReason,
              store_paused_at: result.pausedAt,
            }
          : state.profile,
      }))

      toast.success(`تم إيقاف المتجر مؤقتًا وتعطيل ${result.pausedProductsCount} منتج نشط`)
    } catch (error) {
      logger.error('Pause store error:', error)
      toast.error('تعذر تفعيل وضع الطوارئ للمتجر')
    } finally {
      setPausingStore(false)
    }
  }

  const handleResumeStore = async () => {
    if (!user?.id) return

    setPausingStore(true)
    try {
      const result = await storeEmergencyService.resumeStore({ vendorId: user.id })

      setStorePaused(false)
      setStorePauseReason('')
      useAuthStore.setState((state) => ({
        ...state,
        profile: state.profile
          ? {
              ...state.profile,
              store_paused: false,
              store_paused_reason: null,
              store_paused_at: null,
              store_resume_at: result.resumedAt,
            }
          : state.profile,
      }))

      toast.success(`تمت إعادة تشغيل المتجر واستعادة ${result.resumedProductsCount} منتج`) 
    } catch (error) {
      logger.error('Resume store error:', error)
      toast.error('تعذر إلغاء وضع الطوارئ')
    } finally {
      setPausingStore(false)
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
      {location.state?.paypalSetupRequired && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {location.state?.paypalSetupMessage || 'يجب إكمال إعداد PayPal للمتابعة.'}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('vendor.settings.title', 'Vendor Settings')}
        </h1>
        {hasChanges && !saving && (
          <p className="text-sm text-amber-600 flex items-center gap-1">
            <span className="w-2 h-2 bg-amber-600 rounded-full animate-pulse"></span>
            {t('vendor.settings.unsavedChanges', 'You have unsaved changes')}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <Card className={`p-6 border-2 ${storePaused ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/40'}`}>
          <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <ExclamationTriangleIcon className={`w-5 h-5 ${storePaused ? 'text-red-600' : 'text-amber-600'}`} />
            وضع الطوارئ للمتجر
          </h2>
          <p className="text-sm text-gray-600 mb-4 leading-6">
            عند التفعيل يتم إخفاء المنتجات النشطة مؤقتًا من السوق لتجنب استقبال طلبات جديدة أثناء الانقطاع أو الطوارئ.
          </p>

          <div className="space-y-3">
            <textarea
              value={storePauseReason}
              onChange={(event) => {
                setStorePauseReason(event.target.value)
                setHasChanges(true)
              }}
              className="input min-h-[96px]"
              placeholder="سبب الإيقاف (مثال: توقف التوريد المؤقت / صيانة مفاجئة)"
              disabled={storePaused || pausingStore}
            />

            <div className="flex flex-wrap items-center gap-3">
              {storePaused ? (
                <button
                  type="button"
                  className="btn-primary inline-flex items-center gap-2"
                  disabled={pausingStore}
                  onClick={handleResumeStore}
                >
                  <PlayIcon className="w-4 h-4" />
                  {pausingStore ? 'جاري إعادة التشغيل...' : 'إلغاء وضع الطوارئ'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-outline text-red-700 border-red-300 hover:bg-red-50 inline-flex items-center gap-2"
                  disabled={pausingStore}
                  onClick={handlePauseStore}
                >
                  <PauseIcon className="w-4 h-4" />
                  {pausingStore ? 'جاري التفعيل...' : 'تفعيل وضع الطوارئ'}
                </button>
              )}

              <span className={`text-xs font-medium px-3 py-1 rounded-full ${storePaused ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {storePaused ? 'المتجر متوقف مؤقتًا' : 'المتجر يعمل بشكل طبيعي'}
              </span>
            </div>
          </div>
        </Card>

        {/* Store Settings */}
        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            PayPal Setup
            <Tooltip
              title="ما هو PayPal؟"
              content={(
                <>
                  <p>PayPal خدمة دفع إلكتروني آمنة لاستلام مستحقاتك من المبيعات.</p>
                  <p>نحتاجه لتحويل أرباحك من المنصة بسرعة وبشكل موثوق.</p>
                  <p>يجب إدخال بريد مرتبط بحساب PayPal نشط.</p>
                  <a className="text-blue-600 underline" href="https://www.paypal.com/ma/webapps/mpp/account-selection" target="_blank" rel="noreferrer">إنشاء حساب PayPal مجاني</a>
                </>
              )}
            />
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="PayPal Email"
              type="email"
              value={paypalEmail}
              onChange={(event) => handleFieldChange(setPaypalEmail, event.target.value)}
              error={errors.paypalEmail}
              required
              placeholder="name@example.com"
            />
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-800">حالة التحقق</p>
              <p className={`mt-2 text-sm ${paypalVerified ? 'text-green-700' : 'text-amber-700'}`}>
                {paypalVerified ? 'تم التحقق من حساب PayPal' : 'بانتظار التحقق الإداري من PayPal'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Cog6ToothIcon className="w-5 h-5 text-gray-600" />
            {t('vendor.settings.storeSettings', 'Store Settings')}
          </h2>
          <div className="space-y-4">
            <Input
              label={t('vendor.settings.storeName', 'Store Name')}
              value={storeName}
              onChange={(e) => handleFieldChange(setStoreName, e.target.value)}
              error={errors.storeName}
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('vendor.settings.minOrderAmount', 'Minimum Order Amount')}
                type="number"
                value={minOrderAmount}
                onChange={(e) => handleFieldChange(setMinOrderAmount, e.target.value)}
                error={errors.minOrderAmount}
                min="0"
                step="0.01"
              />
              <div>
                <label className="input-label">{t('vendor.settings.currency', 'Currency')}</label>
                <select
                  value={currency}
                  onChange={() => handleFieldChange(setCurrency, 'MAD')}
                  className="input"
                >
                  <option value="MAD">MAD - {t('vendor.settings.currencies.mad', 'Moroccan Dirham')}</option>
                </select>
              </div>
            </div>
            <Input
              label={t('vendor.settings.lowStockThreshold', 'Low Stock Alert Threshold')}
              type="number"
              value={lowStockThreshold}
              onChange={(e) => handleFieldChange(setLowStockThreshold, e.target.value)}
              error={errors.lowStockThreshold}
              min="1"
              step="1"
            />
            <p className="text-xs text-gray-500">
              {t('vendor.settings.lowStockHint', 'Get alerted when product stock falls below this number')}
            </p>
          </div>
        </Card>

        {/* Store Location */}
        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <MapPinIcon className="w-5 h-5 text-gray-600" />
            {t('vendor.settings.storeLocation', 'موقع المتجر')}
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {t('vendor.settings.storeLocationDesc', 'حدد موقع متجرك حتى يتمكن المشترون من رؤية مسار التوصيل من متجرك إليهم.')}
          </p>
          <LocationPicker
            value={storeLocation || {}}
            onChange={(loc) => { setStoreLocation(loc); setHasChanges(true) }}
            required={false}
          />
        </Card>

        <Card className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <TruckIcon className="w-5 h-5 text-gray-600" />
                إعداد خيار التوصيل
              </h2>
              <p className="text-xs text-gray-500 leading-6">
                حدّث طريقة التوصيل المناسبة حسب نوع متجرك وعدد منتجاتك النشطة.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/vendor/delivery-options')}
              className="btn-outline"
            >
              فتح إعدادات التوصيل
            </button>
          </div>

          {storeSetupSummary && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">نوع المتجر</p>
                <p className="font-semibold text-gray-900">{storeSetupSummary.storeTypeLabel}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">خيار التوصيل الحالي</p>
                <p className="font-semibold text-gray-900">{storeSetupSummary.deliveryOptionMeta?.label || 'غير محدد'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">المنتجات النشطة</p>
                <p className="font-semibold text-gray-900">{storeSetupSummary.activeProductsCountLabel}</p>
              </div>
            </div>
          )}
        </Card>

        <PaymentPolicySettings
          value={paymentPolicies}
          onChange={handlePaymentPoliciesChange}
          disabled={saving}
          error={errors.paymentPolicies}
        />

        <CancellationPolicy
          value={cancellationPolicy}
          onChange={handleCancellationPolicyChange}
          disabled={saving}
          error={errors.cancellationPolicy}
        />

        <RefundPolicySettings
          value={refundPolicy}
          onChange={handleRefundPolicyChange}
          disabled={saving}
          error={errors.refundPolicy}
        />

        {/* Notification Settings */}
        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-gray-600" />
            {t('vendor.settings.notifications', 'Notifications')}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={notifyNewOrders}
                onChange={(e) => handleFieldChange(setNotifyNewOrders, e.target.checked)}
                className="w-5 h-5 rounded text-green-500 focus:ring-green-500"
                aria-label={t('vendor.settings.notifyNewOrders', 'New Orders')}
              />
              <div>
                <span className="font-medium text-gray-900">{t('vendor.settings.notifyNewOrders', 'New Orders')}</span>
                <p className="text-xs text-gray-500">{t('vendor.settings.notifyNewOrdersDesc', 'When a customer places a new order')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={notifyOrderUpdates}
                onChange={(e) => handleFieldChange(setNotifyOrderUpdates, e.target.checked)}
                className="w-5 h-5 rounded text-green-500 focus:ring-green-500"
                aria-label={t('vendor.settings.notifyOrderUpdates', 'Order Updates')}
              />
              <div>
                <span className="font-medium text-gray-900">{t('vendor.settings.notifyOrderUpdates', 'Order Updates')}</span>
                <p className="text-xs text-gray-500">{t('vendor.settings.notifyOrderUpdatesDesc', 'When order status changes')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={notifyCustomerMessages}
                onChange={(e) => handleFieldChange(setNotifyCustomerMessages, e.target.checked)}
                className="w-5 h-5 rounded text-green-500 focus:ring-green-500"
                aria-label={t('vendor.settings.notifyCustomerMessages', 'Customer Messages')}
              />
              <div>
                <span className="font-medium text-gray-900">{t('vendor.settings.notifyCustomerMessages', 'Customer Messages')}</span>
                <p className="text-xs text-gray-500">{t('vendor.settings.notifyCustomerMessagesDesc', 'When a customer sends a message')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={notifyLowStock}
                onChange={(e) => handleFieldChange(setNotifyLowStock, e.target.checked)}
                className="w-5 h-5 rounded text-green-500 focus:ring-green-500"
                aria-label={t('vendor.settings.notifyLowStock', 'Low Stock Alerts')}
              />
              <div>
                <span className="font-medium text-gray-900">{t('vendor.settings.notifyLowStock', 'Low Stock Alerts')}</span>
                <p className="text-xs text-gray-500">{t('vendor.settings.notifyLowStockDesc', 'When product stock falls below threshold')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={notifyReviews}
                onChange={(e) => handleFieldChange(setNotifyReviews, e.target.checked)}
                className="w-5 h-5 rounded text-green-500 focus:ring-green-500"
                aria-label={t('vendor.settings.notifyReviews', 'New Reviews')}
              />
              <div>
                <span className="font-medium text-gray-900">{t('vendor.settings.notifyReviews', 'New Reviews')}</span>
                <p className="text-xs text-gray-500">{t('vendor.settings.notifyReviewsDesc', 'When a customer leaves a review')}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            className="btn-primary inline-flex items-center gap-2"
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" />
                {t('vendor.settings.saving', 'Saving...')}
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-5 h-5" />
                {t('vendor.settings.saveChanges', 'Save Settings')}
              </>
            )}
          </button>
          {hasChanges && !saving && (
            <p className="text-xs text-gray-500">
              {t('vendor.settings.keyboardShortcut', 'Press Ctrl+S to save')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Wrap with Error Boundary
const VendorSettingsWithErrorBoundary = () => (
  <ErrorBoundary componentName="VendorSettings">
    <VendorSettings />
  </ErrorBoundary>
)

export default VendorSettingsWithErrorBoundary
