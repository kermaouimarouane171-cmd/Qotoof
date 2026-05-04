import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner } from '@/components/ui'
import { PhoneVerificationDialog } from '@/components/auth/PhoneVerification'
import { supabase } from '@/services/supabase'
import {
  ArrowLeftIcon,
  BellIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  EyeIcon,
  CheckIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  CircleStackIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const BuyerSettings = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, deleteAccount } = useAuthStore()

  // ── Notification settings ──────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    order_updates: true,
    promotional_emails: false,
    delivery_updates: true,
    show_phone_to_vendors: true,
    show_email_to_vendors: false,
  })

  // ── Privacy / data state ───────────────────────────────────────
  const [privacySaving, setPrivacySaving] = useState(false)
  const [dataExporting, setDataExporting] = useState(false)
  const [showUserData, setShowUserData] = useState(false)
  const [userData, setUserData] = useState(null)
  const [privacyPrefs, setPrivacyPrefs] = useState({
    email_notifications: true,
    order_updates: true,
    marketing_emails: false,
    data_sharing: false,
  })

  // ── Delete account state ───────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteStep, setDeleteStep] = useState(1)
  const [deleteError, setDeleteError] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeletePhoneVerification, setShowDeletePhoneVerification] = useState(false)

  // ── Load both settings on mount ────────────────────────────────
  const loadSettings = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setSettings({
          email_notifications: data.email_notifications ?? true,
          sms_notifications: data.sms_notifications ?? false,
          push_notifications: data.push_notifications ?? true,
          order_updates: data.order_updates ?? true,
          promotional_emails: data.promotional_emails ?? false,
          delivery_updates: data.delivery_updates ?? true,
          show_phone_to_vendors: data.show_phone_to_vendors ?? true,
          show_email_to_vendors: data.show_email_to_vendors ?? false,
        })
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  const loadPrivacyPrefs = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email_notifications, order_updates, marketing_emails, data_sharing')
        .eq('id', user.id)
        .maybeSingle()

      if (error?.code === '42703') return // columns not yet in schema
      if (data) {
        setPrivacyPrefs({
          email_notifications: data.email_notifications ?? true,
          order_updates: data.order_updates ?? true,
          marketing_emails: data.marketing_emails ?? false,
          data_sharing: data.data_sharing ?? false,
        })
      }
    } catch (error) {
      logger.error('Error loading privacy preferences:', error)
    }
  }, [user?.id])

  useEffect(() => {
    loadSettings()
    loadPrivacyPrefs()
  }, [loadPrivacyPrefs, loadSettings])

  // ── Save notification settings ────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, ...settings }, { onConflict: 'user_id' })

      if (error) throw error
      toast.success(t('buyerSettings.notifications.saved', 'Settings saved successfully'))
    } catch (error) {
      logger.error('Error saving settings:', error)
      toast.error(t('buyerSettings.notifications.failed', 'Failed to save settings'))
    } finally {
      setSaving(false)
    }
  }

  // ── Save privacy preferences ──────────────────────────────────
  const handleSavePrivacy = async () => {
    setPrivacySaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update(privacyPrefs)
        .eq('id', user.id)

      if (error?.code === '42703') {
        toast.error(t('privacySettings.preferencesNotAvailable', 'Privacy preferences will be available in the next update'))
        return
      }
      if (error) throw error
      toast.success(t('privacySettings.preferencesSaved', 'Privacy preferences saved!'))
    } catch (error) {
      logger.error('Error saving privacy preferences:', error)
      toast.error(t('privacySettings.savePreferencesFailed', 'Failed to save preferences'))
    } finally {
      setPrivacySaving(false)
    }
  }

  // ── Data export ───────────────────────────────────────────────
  const handleExportData = async () => {
    setDataExporting(true)
    try {
      const [{ data: orders }, { data: profileData }, { data: favorites }] = await Promise.all([
        supabase.from('orders').select('*').eq('buyer_id', user.id),
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('favorites').select('*').eq('user_id', user.id),
      ])

      const exportData = {
        profile: profileData,
        orders: orders || [],
        favorites: favorites || [],
        exported_at: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `qotoof-data-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(t('privacySettings.dataExported', 'Data exported successfully!'))
    } catch (error) {
      logger.error('Export error:', error)
      toast.error(t('privacySettings.exportFailed', 'Failed to export data'))
    } finally {
      setDataExporting(false)
    }
  }

  const handleViewData = async () => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setUserData(data)
      setShowUserData(true)
    } catch {
      toast.error(t('privacySettings.loadDataFailed', 'Failed to load data'))
    }
  }

  // ── Cookie reset ──────────────────────────────────────────────
  const handleResetCookies = () => {
    localStorage.removeItem('cookie_consent')
    toast.success(t('privacySettings.cookieConsentReset', 'Cookie consent reset. Refresh to see the banner again.'))
  }

  // ── Account deletion ──────────────────────────────────────────
  const openDeleteModal = () => {
    setShowDeleteModal(true)
    setDeleteStep(1)
    setDeleteConfirmation('')
    setDeleteError('')
  }

  const handleDeleteNext = () => {
    setDeleteError('')
    if (deleteStep === 1) {
      setDeleteStep(2)
    } else if (deleteStep === 2) {
      if (deleteConfirmation !== 'DELETE') {
        setDeleteError(t('privacySettings.typeDeleteConfirm', 'Please type exactly "DELETE" (all caps) to confirm'))
        return
      }
      setDeleteStep(3)
    }
  }

  const executeDeleteAccount = async () => {
    setDeleteError('')
    setDeleteLoading(true)
    try {
      const result = await deleteAccount(deleteConfirmation)
      if (result.success) {
        toast.success(t('privacySettings.accountDeleted', 'Your account has been permanently deleted'))
        setShowDeleteModal(false)
        navigate('/login', { replace: true })
      } else {
        setDeleteError(result.error || t('privacySettings.deleteAccountFailed', 'Failed to delete account'))
      }
    } catch (error) {
      logger.error('Account deletion error:', error)
      setDeleteError(error.message || t('privacySettings.deleteAccountFailed', 'Failed to delete account'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!profile?.phone) {
      setDeleteError('أضف رقم هاتف إلى الحساب قبل طلب حذفه')
      return
    }

    setShowDeletePhoneVerification(true)
  }

  // ── Toggle component ──────────────────────────────────────────
  const Toggle = ({ checked, onChange, label, description }) => (
    <label className="flex items-center justify-between cursor-pointer py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-gray-300'}`}
        role="switch"
        aria-checked={checked}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </label>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div data-testid="settings-form">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/buyer/dashboard')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label={t('buyerSettings.backToDashboard', 'Back to dashboard')}
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('buyerSettings.title', 'Settings')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('buyerSettings.subtitle', 'Manage your notification and privacy preferences')}</p>
        </div>
      </div>

      {/* ── Notification Settings ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Notifications */}
        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-green-600" />
            {t('buyerSettings.notifications.title', 'Notifications')}
          </h2>
          <div className="divide-y divide-gray-100">
            <Toggle
              checked={settings.email_notifications}
              onChange={(v) => setSettings(prev => ({ ...prev, email_notifications: v }))}
              label={t('buyerSettings.notifications.email', 'Email Notifications')}
              description={t('buyerSettings.notifications.emailDesc', 'Receive order updates via email')}
            />
            <Toggle
              checked={settings.sms_notifications}
              onChange={(v) => setSettings(prev => ({ ...prev, sms_notifications: v }))}
              label={t('buyerSettings.notifications.sms', 'SMS Notifications')}
              description={t('buyerSettings.notifications.smsDesc', 'Receive order updates via SMS')}
            />
            <Toggle
              checked={settings.push_notifications}
              onChange={(v) => setSettings(prev => ({ ...prev, push_notifications: v }))}
              label={t('buyerSettings.notifications.push', 'Push Notifications')}
              description={t('buyerSettings.notifications.pushDesc', 'Browser push notifications')}
            />
          </div>
        </Card>

        {/* Notification Types */}
        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <EnvelopeIcon className="w-5 h-5 text-blue-600" />
            {t('buyerSettings.whatToNotify.title', 'What to Notify')}
          </h2>
          <div className="divide-y divide-gray-100">
            <Toggle
              checked={settings.order_updates}
              onChange={(v) => setSettings(prev => ({ ...prev, order_updates: v }))}
              label={t('buyerSettings.whatToNotify.orderUpdates', 'Order Updates')}
              description={t('buyerSettings.whatToNotify.orderUpdatesDesc', 'Status changes for your orders')}
            />
            <Toggle
              checked={settings.delivery_updates}
              onChange={(v) => setSettings(prev => ({ ...prev, delivery_updates: v }))}
              label={t('buyerSettings.whatToNotify.deliveryUpdates', 'Delivery Updates')}
              description={t('buyerSettings.whatToNotify.deliveryUpdatesDesc', 'Driver location and ETA updates')}
            />
            <Toggle
              checked={settings.promotional_emails}
              onChange={(v) => setSettings(prev => ({ ...prev, promotional_emails: v }))}
              label={t('buyerSettings.whatToNotify.promotional', 'Promotional Offers')}
              description={t('buyerSettings.whatToNotify.promotionalDesc', 'Coupons and seasonal offers')}
            />
          </div>
        </Card>
      </div>

      {/* Save notification settings */}
      <div className="flex justify-end mb-10">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('buyerSettings.save.saving', 'Saving...')}</>
          ) : (
            <><CheckIcon className="w-4 h-4" />{t('buyerSettings.save.saved', 'Save Settings')}</>
          )}
        </button>
      </div>

      {/* ── Privacy & Data ── */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <ShieldCheckIcon className="w-5 h-5 text-purple-600" />
        {t('privacySettings.title', 'Privacy & Data')}
      </h2>

      <div className="space-y-6 mb-10">
        {/* Visibility toggles + communication prefs */}
        <Card className="p-6">
          <h3 className="font-medium text-gray-900 mb-4">{t('buyerSettings.privacy.title', 'Visibility')}</h3>
          <div className="divide-y divide-gray-100">
            <Toggle
              checked={settings.show_phone_to_vendors}
              onChange={(v) => setSettings(prev => ({ ...prev, show_phone_to_vendors: v }))}
              label={t('buyerSettings.privacy.showPhone', 'Show Phone to Vendors')}
              description={t('buyerSettings.privacy.showPhoneDesc', 'Vendors can see your phone number')}
            />
            <Toggle
              checked={settings.show_email_to_vendors}
              onChange={(v) => setSettings(prev => ({ ...prev, show_email_to_vendors: v }))}
              label={t('buyerSettings.privacy.showEmail', 'Show Email to Vendors')}
              description={t('buyerSettings.privacy.showEmailDesc', 'Vendors can see your email address')}
            />
          </div>

          <h3 className="font-medium text-gray-900 mt-6 mb-4">{t('privacySettings.communicationPreferences', 'Communication Preferences')}</h3>
          <div className="divide-y divide-gray-100">
            <Toggle
              checked={privacyPrefs.marketing_emails}
              onChange={(v) => setPrivacyPrefs(prev => ({ ...prev, marketing_emails: v }))}
              label={t('privacySettings.marketingEmails', 'Marketing Emails')}
              description={t('privacySettings.marketingEmailsDesc', 'Receive promotional offers and news')}
            />
            <Toggle
              checked={privacyPrefs.data_sharing}
              onChange={(v) => setPrivacyPrefs(prev => ({ ...prev, data_sharing: v }))}
              label={t('privacySettings.dataSharing', 'Anonymous Analytics')}
              description={t('privacySettings.dataSharingDesc', 'Allow anonymous usage analytics to improve the platform')}
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSavePrivacy}
              disabled={privacySaving}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            >
              {privacySaving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('privacySettings.saving', 'Saving...')}</>
              ) : (
                <><CheckIcon className="w-4 h-4" />{t('privacySettings.savePreferences', 'Save Privacy Preferences')}</>
              )}
            </button>
          </div>
        </Card>

        {/* Your Data */}
        <Card className="p-6">
          <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <EyeIcon className="w-5 h-5 text-blue-600" />
            {t('privacySettings.yourData', 'Your Data')}
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleViewData}
              className="btn-outline flex items-center gap-2"
            >
              <EyeIcon className="w-4 h-4" />
              {t('privacySettings.viewMyData', 'View My Data')}
            </button>
            <button
              onClick={handleExportData}
              disabled={dataExporting}
              className="btn-outline flex items-center gap-2 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              {dataExporting ? t('privacySettings.exporting', 'Exporting...') : t('privacySettings.exportMyData', 'Export My Data (JSON)')}
            </button>
          </div>
          {showUserData && userData && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(userData, null, 2)}
              </pre>
            </div>
          )}
        </Card>

        {/* Cookie Settings */}
        <Card className="p-6">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <CircleStackIcon className="w-5 h-5 text-orange-600" />
            {t('privacySettings.cookieSettings', 'Cookie Settings')}
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            {t('privacySettings.cookieSettingsDesc', 'Manage your cookie preferences at any time using the cookie banner at the bottom of the page.')}
          </p>
          <button onClick={handleResetCookies} className="btn-outline">
            {t('privacySettings.resetCookieConsent', 'Reset Cookie Consent')}
          </button>
        </Card>

        {/* GDPR Rights */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-blue-600" />
            {t('privacySettings.gdprRights', 'Your GDPR Rights')}
          </h3>
          <ul className="space-y-1.5 text-sm text-blue-800">
            {[
              t('privacySettings.gdprRight1', 'Right to access your personal data'),
              t('privacySettings.gdprRight2', 'Right to rectification (correction)'),
              t('privacySettings.gdprRight3', 'Right to erasure (deletion)'),
              t('privacySettings.gdprRight4', 'Right to data portability (export)'),
              t('privacySettings.gdprRight5', 'Right to object to processing'),
              t('privacySettings.gdprRight6', 'Right to withdraw consent'),
            ].map((right) => (
              <li key={right} className="flex items-start gap-2">
                <CheckCircleIcon className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                {right}
              </li>
            ))}
          </ul>
          <p className="text-xs text-blue-700 mt-4">
            {t('privacySettings.gdprContact', 'To exercise any of these rights, contact us at support@qotoof.ma')}
          </p>
        </Card>

        {/* Danger Zone — Delete Account */}
        <Card className="p-6 border-2 border-red-200">
          <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
            <TrashIcon className="w-5 h-5 text-red-600" />
            {t('privacySettings.deleteAccount', 'Delete Account')}
          </h3>
          <p className="text-sm text-red-700 mb-3">
            {t('privacySettings.deleteAccountDesc', 'Permanently delete your account and all associated data. This action cannot be undone.')}
          </p>
          <ul className="text-xs text-red-600 space-y-1 ml-4 list-disc mb-4">
            <li>{t('privacySettings.deleteWarning1', 'All your personal data will be erased')}</li>
            <li>{t('privacySettings.deleteWarning2', 'Your orders will be anonymized')}</li>
            <li>{t('privacySettings.deleteWarning3', 'Your favorites will be deleted')}</li>
            <li>{t('privacySettings.deleteWarning4', 'All active sessions will be terminated')}</li>
          </ul>
          <button
            onClick={openDeleteModal}
            className="btn-outline text-red-600 border-red-200 hover:bg-red-50 inline-flex items-center gap-2"
          >
            <TrashIcon className="w-4 h-4" />
            {t('privacySettings.deleteMyAccount', 'Delete My Account')}
          </button>
        </Card>

        {/* Quick Links */}
        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t('buyerSettings.quickLinks.title', 'Quick Links')}</h2>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/buyer/addresses')}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">{t('buyerSettings.quickLinks.addresses', 'Manage Addresses')}</span>
              <span className="text-xs text-gray-400">→</span>
            </button>
            <button
              onClick={() => navigate('/buyer/security')}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">{t('buyerSettings.quickLinks.security', 'Security Settings')}</span>
              <span className="text-xs text-gray-400">→</span>
            </button>
            <button
              onClick={() => navigate('/buyer/coupons')}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">{t('buyerSettings.quickLinks.coupons', 'My Coupons')}</span>
              <span className="text-xs text-gray-400">→</span>
            </button>
          </div>
        </Card>
      </div>

      {/* ── Delete Account Modal ── */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <button
            type="button"
            aria-label={t('common.close', 'Close')}
            className="absolute inset-0"
            onClick={() => setShowDeleteModal(false)}
          />
          <div
            className="relative z-10 bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
          >
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${step <= deleteStep ? 'bg-red-500' : 'bg-gray-200'}`}
                />
              ))}
            </div>

            {deleteStep === 1 && (
              <>
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ExclamationTriangleIcon className="w-7 h-7 text-red-600" />
                </div>
                <h3 id="delete-dialog-title" className="text-xl font-bold text-gray-900 mb-2 text-center">
                  {t('privacySettings.deleteAccountQuestion', 'Delete Your Account?')}
                </h3>
                <p className="text-sm text-gray-600 mb-6 text-center">
                  {t('privacySettings.deleteAccountWarning1', 'This will')} <strong>{t('privacySettings.permanently', 'permanently')}</strong> {t('privacySettings.deleteAccountWarning2', 'delete your account and all associated data. This action')} <strong>{t('privacySettings.cannotBeUndone', 'cannot be undone')}</strong>.
                </p>
              </>
            )}

            {deleteStep === 2 && (
              <>
                <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheckIcon className="w-7 h-7 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                  {t('privacySettings.confirmDeletion', 'Confirm Deletion')}
                </h3>
                <p className="text-sm text-gray-600 mb-4 text-center">
                  {t('privacySettings.typeToDelete', 'Type')} <code className="px-2 py-0.5 bg-gray-100 rounded font-mono font-bold text-red-600">DELETE</code> {t('privacySettings.toConfirm', 'to confirm')}
                </p>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => { setDeleteConfirmation(e.target.value); setDeleteError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleDeleteNext()}
                  placeholder={t('privacySettings.typeDeletePlaceholder', 'Type "DELETE" here')}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-center font-mono text-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  autoComplete="off"
                />
                {deleteError && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                    <XMarkIcon className="w-4 h-4" />{deleteError}
                  </p>
                )}
              </>
            )}

            {deleteStep === 3 && (
              <>
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrashIcon className="w-7 h-7 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">
                  {t('privacySettings.finalConfirmation', 'Final Confirmation')}
                </h3>
                <p className="text-sm text-gray-600 mb-4 text-center">
                  {t('privacySettings.aboutToDelete', 'You are about to permanently delete your account')} <strong>{profile?.email || user.email}</strong>.
                </p>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                  <p className="text-xs text-red-700 font-semibold mb-2">{t('privacySettings.whatWillBeDeleted', 'What will be deleted:')}</p>
                  <ul className="text-xs text-red-600 space-y-1 ml-4 list-disc">
                    <li>{t('privacySettings.deleteItem1', 'Profile and personal data')}</li>
                    <li>{t('privacySettings.deleteItem2', 'Order history (anonymized)')}</li>
                    <li>{t('privacySettings.deleteItem3', 'Favorites and preferences')}</li>
                    <li>{t('privacySettings.deleteItem4', 'Active sessions and MFA settings')}</li>
                    <li>{t('privacySettings.deleteItem5', 'Messages and conversations')}</li>
                  </ul>
                </div>
              </>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (deleteStep > 1) { setDeleteStep(deleteStep - 1); setDeleteError('') }
                  else setShowDeleteModal(false)
                }}
                className="btn-outline flex-1"
                disabled={deleteLoading}
              >
                {deleteStep === 1 ? t('common.cancel', 'Cancel') : t('common.back', 'Back')}
              </button>
              <button
                onClick={deleteStep === 3 ? handleConfirmDelete : handleDeleteNext}
                disabled={deleteLoading || (deleteStep === 2 && deleteConfirmation !== 'DELETE')}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('privacySettings.deleting', 'Deleting...')}</>
                ) : deleteStep === 3 ? (
                  <><TrashIcon className="w-4 h-4" />{t('privacySettings.deleteForever', 'Delete Forever')}</>
                ) : (
                  t('common.next', 'Continue')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <PhoneVerificationDialog
        open={showDeletePhoneVerification}
        onClose={() => setShowDeletePhoneVerification(false)}
        userId={user?.id}
        phone={profile?.phone}
        purpose="sensitive_action"
        title="📱 تأكيد حذف الحساب"
        description="حذف الحساب إجراء نهائي، لذلك نحتاج رمز تحقق SMS قبل تنفيذ الطلب."
        onVerified={async () => {
          setShowDeletePhoneVerification(false)
          await executeDeleteAccount()
        }}
      />
    </div>
  )
}

export default BuyerSettings
