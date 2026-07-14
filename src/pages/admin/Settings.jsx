import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { platformSettings } from '@/modules/admin'
import { Card, LoadingSpinner, Input, Toggle } from '@/components/ui'
import {
  Cog6ToothIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  TruckIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { APP_CONFIG } from '@/config/appConfig'

const AdminSettings = () => {
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({})
  const [originalSettings, setOriginalSettings] = useState({})
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  // ============================================
  // Load Settings
  // ============================================

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const data = await platformSettings.getSettings()
      setSettings(data)
      setOriginalSettings({ ...data })
      setHasChanges(false)
    } catch (error) {
      logger.error('Load settings error:', error)
      toast.error(t('admin.settings.errors.loadFailed', 'Failed to load settings'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadSettings()

    // Subscribe to real-time changes (invalidate cache if another admin changes settings)
    const subscription = platformSettings.subscribeToSettingsChanges(() => {
      toast.info(t('admin.settings.notifications.settingsUpdatedByOther', 'Settings were updated by another admin. Reloading...'))
      loadSettings()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [loadSettings, t])

  // ============================================
  // Handle Changes
  // ============================================

  const updateField = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!hasChanges) {
      toast.info(t('admin.settings.notifications.noChanges', 'No changes to save'))
      return
    }

    setSaving(true)
    try {
      const adminName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        : 'Unknown Admin'

      const result = await platformSettings.updateSettings(
        settings,
        user.id,
        adminName
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to save')
      }

      setOriginalSettings({ ...settings })
      setHasChanges(false)
      toast.success(t('admin.settings.notifications.savedSuccess', 'Settings saved successfully!'))
      logger.info(`Settings updated by ${adminName} (${user.id})`)
    } catch (error) {
      logger.error('Save settings error:', error)
      toast.error(t('admin.settings.errors.saveFailed', 'Failed to save settings'))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setSettings({ ...originalSettings })
    setHasChanges(false)
    toast.info(t('admin.settings.notifications.changesDiscarded', 'Changes discarded'))
  }

  // ============================================
  // Loading State
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // ============================================
  // Tabs Configuration
  // ============================================

  const tabs = [
    { key: 'general', labelKey: 'admin.settings.tabs.general', icon: BuildingOfficeIcon },
    { key: 'features', labelKey: 'admin.settings.tabs.features', icon: Cog6ToothIcon },
    { key: 'financial', labelKey: 'admin.settings.tabs.financial', icon: CurrencyDollarIcon },
    { key: 'orders', labelKey: 'admin.settings.tabs.orders', icon: TruckIcon },
    { key: 'maintenance', labelKey: 'admin.settings.tabs.maintenance', icon: ExclamationTriangleIcon },
  ]

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('admin.settings.title', 'Platform Settings')}</h1>
          <p className="text-gray-600">{t('admin.settings.subtitle', 'Manage global platform configuration')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadSettings}
            className="btn-outline text-sm flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            {t('admin.settings.actions.reload', 'Reload')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto border-b border-gray-200 pb-2">
        {tabs.map(({ key, labelKey, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === key
                ? 'bg-white text-green-600 border-b-2 border-green-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {t(labelKey, key)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* General Tab */}
        {activeTab === 'general' && (
          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <BuildingOfficeIcon className="w-5 h-5 text-green-600" />
              {t('admin.settings.general.title', 'General Settings')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={t('admin.settings.general.platformName', 'Platform Name')}
                value={settings.platform_name || ''}
                onChange={(e) => updateField('platform_name', e.target.value)}
                placeholder="Qotoof"
              />
              <Input
                label={t('admin.settings.general.supportEmail', 'Support Email')}
                type="email"
                value={settings.support_email || ''}
                onChange={(e) => updateField('support_email', e.target.value)}
                placeholder={APP_CONFIG.supportEmail}
              />
              <Input
                label={t('admin.settings.general.supportPhone', 'Support Phone')}
                type="tel"
                value={settings.support_phone || ''}
                onChange={(e) => updateField('support_phone', e.target.value)}
                placeholder={APP_CONFIG.supportPhoneDisplay}
              />
              <div>
                <label className="input-label">{t('admin.settings.general.language', 'Language')}</label>
                <select
                  value={settings.language || 'ar'}
                  onChange={(e) => updateField('language', e.target.value)}
                  className="input"
                >
                  <option value="ar">{t('common.arabic', 'العربية')}</option>
                  <option value="en">{t('common.english', 'English')}</option>
                  <option value="fr">{t('common.french', 'Français')}</option>
                </select>
              </div>
              <div>
                <label className="input-label">{t('admin.settings.general.currency', 'Currency')}</label>
                <select
                  value={settings.currency || 'MAD'}
                  onChange={() => updateField('currency', 'MAD')}
                  className="input"
                >
                  <option value="MAD">MAD - {t('admin.settings.general.currencyMAD', 'Moroccan Dirham')}</option>
                </select>
              </div>
              <div>
                <label className="input-label">{t('admin.settings.general.timezone', 'Timezone')}</label>
                <select
                  value={settings.timezone || 'Africa/Casablanca'}
                  onChange={(e) => updateField('timezone', e.target.value)}
                  className="input"
                >
                  <option value="Africa/Casablanca">Africa/Casablanca</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* Features Tab */}
        {activeTab === 'features' && (
          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <Cog6ToothIcon className="w-5 h-5 text-green-600" />
              {t('admin.settings.features.title', 'Feature Toggles')}
            </h2>
            <div className="space-y-4">
              {[
                { key: 'feature_vendor_registration', labelKey: 'admin.settings.features.vendorRegistration' },
                { key: 'feature_buyer_orders', labelKey: 'admin.settings.features.buyerOrders' },
                { key: 'feature_driver_deliveries', labelKey: 'admin.settings.features.driverDeliveries' },
                { key: 'feature_reviews', labelKey: 'admin.settings.features.reviews' },
                { key: 'feature_returns', labelKey: 'admin.settings.features.returns' },
                { key: 'feature_chat', labelKey: 'admin.settings.features.chat' },
              ].map(({ key, labelKey }) => (
                <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{t(labelKey, key)}</span>
                  </div>
                  <Toggle
                    checked={settings[key] ?? true}
                    onChange={(checked) => updateField(key, checked)}
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Financial Tab */}
        {activeTab === 'financial' && (
          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
              {t('admin.settings.financial.title', 'Financial Settings')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={t('admin.settings.financial.commissionRate', 'Commission Rate (%)')}
                type="number"
                min="0"
                max="100"
                value={settings.commission_rate ?? 10}
                onChange={(e) => updateField('commission_rate', parseFloat(e.target.value))}
                help={t('admin.settings.financial.commissionRateHelp', 'Percentage taken from each vendor sale')}
              />
              <Input
                label={t('admin.settings.financial.minWithdrawal', 'Min Withdrawal Amount (MAD)')}
                type="number"
                min="0"
                value={settings.min_withdrawal_amount ?? 100}
                onChange={(e) => updateField('min_withdrawal_amount', parseFloat(e.target.value))}
                help={t('admin.settings.financial.minWithdrawalHelp', 'Minimum amount vendors can withdraw')}
              />
              <Input
                label={t('admin.settings.financial.maxOrderAmount', 'Max Order Amount (MAD)')}
                type="number"
                min="0"
                value={settings.max_order_amount ?? 10000}
                onChange={(e) => updateField('max_order_amount', parseFloat(e.target.value))}
                help={t('admin.settings.financial.maxOrderAmountHelp', 'Maximum value for a single order')}
              />
            </div>
          </Card>
        )}

        {/* Orders & Delivery Tab */}
        {activeTab === 'orders' && (
          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <TruckIcon className="w-5 h-5 text-green-600" />
              {t('admin.settings.orders.title', 'Orders & Delivery Settings')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={t('admin.settings.orders.autoCancelHours', 'Auto-Cancel After (hours)')}
                type="number"
                min="1"
                value={settings.order_auto_cancel_hours ?? 24}
                onChange={(e) => updateField('order_auto_cancel_hours', parseInt(e.target.value))}
                help={t('admin.settings.orders.autoCancelHelp', 'Orders auto-cancelled if not confirmed')}
              />
              <Input
                label={t('admin.settings.orders.deliveryRadius', 'Delivery Radius (km)')}
                type="number"
                min="1"
                value={settings.delivery_radius_km ?? 50}
                onChange={(e) => updateField('delivery_radius_km', parseInt(e.target.value))}
                help={t('admin.settings.orders.deliveryRadiusHelp', 'Maximum delivery distance')}
              />
            </div>
          </Card>
        )}

        {/* Maintenance Tab */}
        {activeTab === 'maintenance' && (
          <Card className="p-6">
            <h2 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
              {t('admin.settings.maintenance.title', 'Maintenance Mode')}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <ShieldCheckIcon className="w-6 h-6 text-yellow-600" />
                  <div>
                    <p className="font-medium text-gray-900">{t('admin.settings.maintenance.modeLabel', 'Maintenance Mode')}</p>
                    <p className="text-sm text-gray-600">{t('admin.settings.maintenance.modeDesc', 'Put the platform in maintenance mode')}</p>
                  </div>
                </div>
                <Toggle
                  checked={settings.maintenance_mode ?? false}
                  onChange={(checked) => updateField('maintenance_mode', checked)}
                />
              </div>
              {settings.maintenance_mode && (
                <div>
                  <label className="input-label">{t('admin.settings.maintenance.messageLabel', 'Maintenance Message')}</label>
                  <textarea
                    value={settings.maintenance_message || ''}
                    onChange={(e) => updateField('maintenance_message', e.target.value)}
                    className="input h-24 resize-none"
                    placeholder={t('admin.settings.maintenance.messagePlaceholder', "We're currently performing maintenance. Please check back later...")}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('admin.settings.maintenance.messageHint', 'This message will be shown to all users when maintenance mode is active.')}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Save/Reset Buttons */}
        {hasChanges && (
          <div className="sticky bottom-4 bg-white p-4 rounded-xl shadow-lg border border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircleIcon className="w-4 h-4 text-green-600" />
              {t('admin.settings.unsavedChanges', 'You have unsaved changes')}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                disabled={saving}
                className="btn-outline text-sm"
              >
                {t('admin.settings.actions.discardChanges', 'Discard Changes')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" />
                    {t('admin.settings.actions.saving', 'Saving...')}
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-4 h-4" />
                    {t('admin.settings.actions.saveSettings', 'Save Settings')}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminSettings
