import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/modules/auth'
import { profilesService } from '@/modules/users'
import { Card, Input, LoadingSpinner, Tooltip } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import DeliveryPreferences from '@/components/driver/DeliveryPreferences'
import DeliveryPaymentPolicy from '@/components/driver/DeliveryPaymentPolicy'
import {
  BellIcon,
  TruckIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { auditLogger } from '@/services/auditLogger'
import { MOROCCAN_BANKS } from '@/constants/banks'

const normalizeDistanceValue = (value, fallback) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const DriverSettings = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [vehicleType, setVehicleType] = useState('')
  const [vehiclePlate, setVehiclePlate] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [isAvailableForDelivery, setIsAvailableForDelivery] = useState(false)
  const [notifyNewDeliveries, setNotifyNewDeliveries] = useState(true)
  const [notifyOrderUpdates, setNotifyOrderUpdates] = useState(true)
  const [notifyCustomerMessages, setNotifyCustomerMessages] = useState(true)
  const [minDeliveryDistanceKm, setMinDeliveryDistanceKm] = useState(0)
  const [maxDeliveryDistanceKm, setMaxDeliveryDistanceKm] = useState(50)
  const [acceptedCargoSizes, setAcceptedCargoSizes] = useState(['small', 'medium'])
  const [driverDeliveryPaymentCash, setDriverDeliveryPaymentCash] = useState(true)
  const [driverDeliveryPaymentTransfer, setDriverDeliveryPaymentTransfer] = useState(true)
  const [driverDeliveryPaymentNotes, setDriverDeliveryPaymentNotes] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankAccountIban, setBankAccountIban] = useState('')
  const [bankName, setBankName] = useState('')
  const [errors, setErrors] = useState({})

  const handleFieldChange = (setter, value) => {
    setter(value)
    setHasChanges(true)
  }

  const toggleCargoSize = useCallback((cargoSize) => {
    setAcceptedCargoSizes((currentCargoSizes) => {
      const nextCargoSizes = currentCargoSizes.includes(cargoSize)
        ? currentCargoSizes.filter((currentCargoSize) => currentCargoSize !== cargoSize)
        : [...currentCargoSizes, cargoSize]

      return nextCargoSizes
    })
    setHasChanges(true)
  }, [])

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await profilesService.fetchDriverProfile(user.id)

      if (error) throw error

      setVehicleType(data?.vehicle_type || '')
      setVehiclePlate(data?.vehicle_plate || '')
      setLicenseNumber(data?.license_number || '')
      setIsAvailableForDelivery(data?.is_available_for_delivery ?? false)
      setNotifyNewDeliveries(data?.notify_new_deliveries ?? true)
      setNotifyOrderUpdates(data?.notify_order_updates ?? true)
      setNotifyCustomerMessages(data?.notify_customer_messages ?? true)
      setMinDeliveryDistanceKm(normalizeDistanceValue(data?.min_delivery_distance_km, 0))
      setMaxDeliveryDistanceKm(normalizeDistanceValue(data?.max_delivery_distance_km, 50))
      setAcceptedCargoSizes(Array.isArray(data?.accepted_cargo_sizes) && data.accepted_cargo_sizes.length > 0 ? data.accepted_cargo_sizes : ['small', 'medium'])
      setDriverDeliveryPaymentCash(data?.driver_delivery_payment_cash ?? true)
      setDriverDeliveryPaymentTransfer(data?.driver_delivery_payment_transfer ?? true)
      setDriverDeliveryPaymentNotes(data?.driver_delivery_payment_notes || '')
      setBankAccountName(data?.bank_account_name || '')
      setBankAccountIban(data?.bank_account_iban || '')
      setBankName(data?.bank_name || '')
      setHasChanges(false)
    } catch (error) {
      logger.error('Error loading driver settings:', error)
      toast.error(t('driver.settings.errors.loadFailed', 'Failed to load settings'))
    } finally {
      setLoading(false)
    }
  }, [t, user.id])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const validateForm = useCallback(() => {
    const nextErrors = {}
    const normalizedMinDistance = normalizeDistanceValue(minDeliveryDistanceKm, 0)
    const normalizedMaxDistance = normalizeDistanceValue(maxDeliveryDistanceKm, 0)

    if (vehiclePlate && vehiclePlate.length > 20) {
      nextErrors.vehiclePlate = t('driver.settings.errors.plateLong', 'Vehicle plate must be less than 20 characters')
    }

    if (licenseNumber && licenseNumber.length > 50) {
      nextErrors.licenseNumber = t('driver.settings.errors.licenseLong', 'License number must be less than 50 characters')
    }

    if (normalizedMinDistance < 0) {
      nextErrors.minDeliveryDistanceKm = 'المسافة الدنيا يجب أن تكون صفراً أو أكثر.'
    }

    if (normalizedMaxDistance <= 0) {
      nextErrors.maxDeliveryDistanceKm = 'المسافة القصوى يجب أن تكون أكبر من صفر.'
    }

    if (normalizedMaxDistance < normalizedMinDistance) {
      nextErrors.maxDeliveryDistanceKm = 'المسافة القصوى يجب أن تكون أكبر من أو تساوي المسافة الدنيا.'
    }

    if (!acceptedCargoSizes.length) {
      nextErrors.acceptedCargoSizes = 'اختر حجماً واحداً على الأقل للحمولة المقبولة.'
    }

    if (!driverDeliveryPaymentCash && !driverDeliveryPaymentTransfer) {
      nextErrors.driverDeliveryPaymentMethod = 'اختر طريقة واحدة على الأقل لتحصيل رسم التوصيل.'
    }

    if (!bankAccountName.trim()) {
      nextErrors.bankAccountName = 'اسم صاحب الحساب البنكي إلزامي.'
    }
    if (!bankAccountIban.trim()) {
      nextErrors.bankAccountIban = 'رقم الحساب البنكي (RIB/IBAN) إلزامي.'
    } else if (bankAccountIban.replace(/\s/g, '').length < 24) {
      nextErrors.bankAccountIban = 'رقم الحساب البنكي يجب أن يكون 24 رقماً على الأقل.'
    }
    if (!bankName.trim()) {
      nextErrors.bankName = 'اسم البنك إلزامي.'
    }

    return nextErrors
  }, [acceptedCargoSizes, driverDeliveryPaymentCash, driverDeliveryPaymentTransfer, licenseNumber, maxDeliveryDistanceKm, minDeliveryDistanceKm, bankAccountName, bankAccountIban, bankName, t, vehiclePlate])

  const handleSave = useCallback(async () => {
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      toast.error(t('driver.settings.errors.fixErrors', 'Please fix the errors before saving'))
      return
    }

    setSaving(true)
    setErrors({})

    try {
      const { data: previousProfile, error: previousProfileError } = await profilesService.fetchDriverProfile(user.id)
      if (previousProfileError) throw previousProfileError

      const oldData = previousProfile
        ? {
            vehicle_type: previousProfile.vehicle_type,
            vehicle_plate: previousProfile.vehicle_plate,
            license_number: previousProfile.license_number,
            is_available_for_delivery: previousProfile.is_available_for_delivery,
            notify_new_deliveries: previousProfile.notify_new_deliveries,
            notify_order_updates: previousProfile.notify_order_updates,
            notify_customer_messages: previousProfile.notify_customer_messages,
            min_delivery_distance_km: previousProfile.min_delivery_distance_km,
            max_delivery_distance_km: previousProfile.max_delivery_distance_km,
            accepted_cargo_sizes: previousProfile.accepted_cargo_sizes,
            driver_delivery_payment_cash: previousProfile.driver_delivery_payment_cash,
            driver_delivery_payment_transfer: previousProfile.driver_delivery_payment_transfer,
            driver_delivery_payment_notes: previousProfile.driver_delivery_payment_notes,
            bank_account_name: previousProfile.bank_account_name,
            bank_account_iban: previousProfile.bank_account_iban,
            bank_name: previousProfile.bank_name,
          }
        : null

      const updatePayload = {
        vehicle_type: vehicleType || null,
        vehicle_plate: vehiclePlate || null,
        license_number: licenseNumber || null,
        is_available_for_delivery: isAvailableForDelivery,
        notify_new_deliveries: notifyNewDeliveries,
        notify_order_updates: notifyOrderUpdates,
        notify_customer_messages: notifyCustomerMessages,
        min_delivery_distance_km: normalizeDistanceValue(minDeliveryDistanceKm, 0),
        max_delivery_distance_km: normalizeDistanceValue(maxDeliveryDistanceKm, 50),
        accepted_cargo_sizes: acceptedCargoSizes,
        driver_delivery_payment_cash: driverDeliveryPaymentCash,
        driver_delivery_payment_transfer: driverDeliveryPaymentTransfer,
        driver_delivery_payment_notes: driverDeliveryPaymentNotes || null,
        bank_account_name: bankAccountName.trim() || null,
        bank_account_iban: bankAccountIban.replace(/\s/g, '') || null,
        bank_name: bankName.trim() || null,
        payout_method: 'bank',
      }

      const { error } = await profilesService.updateProfile(user.id, updatePayload)

      if (error) throw error

      useAuthStore.setState({
        profile: {
          ...profile,
          ...updatePayload,
        },
      })

      await auditLogger.logProfileAction('DRIVER_SETTINGS_UPDATED', updatePayload, oldData)

      toast.success('تم حفظ تفضيلات السائق بنجاح')
      setHasChanges(false)
    } catch (error) {
      logger.error('Error saving driver settings:', error)
      toast.error(t('driver.settings.errors.saveFailed', 'Failed to save settings'))
    } finally {
      setSaving(false)
    }
  }, [
    acceptedCargoSizes,
    driverDeliveryPaymentCash,
    driverDeliveryPaymentNotes,
    driverDeliveryPaymentTransfer,
    isAvailableForDelivery,
    licenseNumber,
    maxDeliveryDistanceKm,
    minDeliveryDistanceKm,
    notifyCustomerMessages,
    notifyNewDeliveries,
    notifyOrderUpdates,
    bankAccountName,
    bankAccountIban,
    bankName,
    profile,
    t,
    user.id,
    validateForm,
    vehiclePlate,
    vehicleType,
  ])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        if (hasChanges && !saving) {
          handleSave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, hasChanges, saving])

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
          {location.state?.paypalSetupMessage || 'يجب إكمال إعداد الحساب البنكي للمتابعة.'}
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('driver.settings.title', 'Driver Settings')}
        </h1>
        {hasChanges && !saving && (
          <p className="text-sm text-amber-600 flex items-center gap-1">
            <span className="w-2 h-2 bg-amber-600 rounded-full animate-pulse"></span>
            {t('driver.settings.unsavedChanges', 'You have unsaved changes')}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BanknotesIcon className="w-5 h-5 text-gray-600" />
            {t('driver.settings.bankSetup', 'بيانات الحساب البنكي')}
            <Tooltip
              title="لماذا نحتاج بياناتك البنكية؟"
              content={(
                <>
                  <p>نحتاج بيانات حسابك البنكي لتحويل مستحقات التوصيل الخاصة بك.</p>
                  <p>يتم تحويل الأرباح مباشرة إلى حسابك البنكي المغربي.</p>
                </>
              )}
            />
          </h2>
          <div className="space-y-4">
            <Input
              label={t('driver.settings.bankAccountName', 'اسم صاحب الحساب')}
              value={bankAccountName}
              onChange={(event) => handleFieldChange(setBankAccountName, event.target.value)}
              error={errors.bankAccountName}
              required
              placeholder="الاسم الكامل كما هو في البنك"
            />
            <div>
              <label className="input-label">
                {t('driver.settings.bankName', 'اسم البنك')}
                <span className="text-red-500 mr-1">*</span>
              </label>
              <select
                value={bankName}
                onChange={(event) => handleFieldChange(setBankName, event.target.value)}
                className="input"
              >
                <option value="">{t('driver.settings.selectBank', 'اختر البنك')}</option>
                {MOROCCAN_BANKS.map((bank) => (
                  <option key={bank.code} value={bank.name}>
                    {bank.name}
                  </option>
                ))}
              </select>
              {errors.bankName && (
                <p className="mt-1 text-sm text-red-600">{errors.bankName}</p>
              )}
            </div>
            <Input
              label={t('driver.settings.bankIban', 'رقم الحساب البنكي (RIB / IBAN)')}
              value={bankAccountIban}
              onChange={(event) => handleFieldChange(setBankAccountIban, event.target.value)}
              error={errors.bankAccountIban}
              required
              placeholder="011 780 0000123456789012 34"
              maxLength={34}
            />
            <p className="text-xs text-gray-500">
              {t('driver.settings.bankHint', 'أدخل رقم الحساب البنكي كما هو في دفتر الصياغة أو RIB البنكي. سيتم تحويل أرباحك إلى هذا الحساب.')}
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TruckIcon className="w-5 h-5 text-gray-600" />
            {t('driver.settings.vehicleSettings', 'Vehicle Settings')}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="input-label">{t('driver.settings.vehicleType', 'Vehicle Type')}</label>
              <select
                value={vehicleType}
                onChange={(event) => handleFieldChange(setVehicleType, event.target.value)}
                className="input"
              >
                <option value="">{t('driver.settings.selectVehicleType', 'Select vehicle type')}</option>
                <option value="motorcycle">{t('driver.settings.vehicleTypes.motorcycle', 'Motorcycle')}</option>
                <option value="car">{t('driver.settings.vehicleTypes.car', 'Car')}</option>
                <option value="van">{t('driver.settings.vehicleTypes.van', 'Van')}</option>
                <option value="truck">{t('driver.settings.vehicleTypes.truck', 'Truck')}</option>
                <option value="bicycle">{t('driver.settings.vehicleTypes.bicycle', 'Bicycle')}</option>
              </select>
            </div>
            <Input
              label={t('driver.settings.vehiclePlate', 'Vehicle Plate Number')}
              value={vehiclePlate}
              onChange={(event) => handleFieldChange(setVehiclePlate, event.target.value.toUpperCase())}
              error={errors.vehiclePlate}
              placeholder="ABC-1234"
              maxLength={20}
            />
            <Input
              label={t('driver.settings.licenseNumber', 'Driver License Number')}
              value={licenseNumber}
              onChange={(event) => handleFieldChange(setLicenseNumber, event.target.value)}
              error={errors.licenseNumber}
              placeholder="DL-123456"
              maxLength={50}
            />
            <p className="text-xs text-gray-500">
              {t('driver.settings.vehicleHint', 'Ensure your vehicle information is accurate for delivery assignments')}
            </p>
          </div>
        </Card>

        <DeliveryPreferences
          minDeliveryDistanceKm={minDeliveryDistanceKm}
          maxDeliveryDistanceKm={maxDeliveryDistanceKm}
          acceptedCargoSizes={acceptedCargoSizes}
          errors={errors}
          onMinDistanceChange={(value) => handleFieldChange(setMinDeliveryDistanceKm, value)}
          onMaxDistanceChange={(value) => handleFieldChange(setMaxDeliveryDistanceKm, value)}
          onCargoSizeToggle={toggleCargoSize}
        />

        <DeliveryPaymentPolicy
          driverDeliveryPaymentCash={driverDeliveryPaymentCash}
          driverDeliveryPaymentTransfer={driverDeliveryPaymentTransfer}
          driverDeliveryPaymentNotes={driverDeliveryPaymentNotes}
          errors={errors}
          onCashChange={(value) => handleFieldChange(setDriverDeliveryPaymentCash, value)}
          onTransferChange={(value) => handleFieldChange(setDriverDeliveryPaymentTransfer, value)}
          onNotesChange={(value) => handleFieldChange(setDriverDeliveryPaymentNotes, value)}
        />

        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-gray-600" />
            {t('driver.settings.availabilitySettings', 'Availability Settings')}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                id="driver-available-for-delivery"
                type="checkbox"
                checked={isAvailableForDelivery}
                onChange={(event) => handleFieldChange(setIsAvailableForDelivery, event.target.checked)}
                className="w-5 h-5 rounded text-green-500 focus:ring-green-500"
              />
              <label htmlFor="driver-available-for-delivery" className="cursor-pointer">
                <span className="font-medium text-gray-900">{t('driver.settings.availableForDeliveries', 'Available for Deliveries')}</span>
                <p className="text-xs text-gray-500">{t('driver.settings.availableForDeliveriesDesc', 'When enabled, you will receive new delivery requests')}</p>
              </label>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-gray-600" />
            {t('driver.settings.notifications', 'Notifications')}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                id="driver-notify-new-deliveries"
                type="checkbox"
                checked={notifyNewDeliveries}
                onChange={(event) => handleFieldChange(setNotifyNewDeliveries, event.target.checked)}
                className="w-5 h-5 rounded text-green-500 focus:ring-green-500"
              />
              <label htmlFor="driver-notify-new-deliveries" className="cursor-pointer">
                <span className="font-medium text-gray-900">{t('driver.settings.notifyNewDeliveries', 'New Delivery Requests')}</span>
                <p className="text-xs text-gray-500">{t('driver.settings.notifyNewDeliveriesDesc', 'When a new delivery is assigned to you')}</p>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="driver-notify-order-updates"
                type="checkbox"
                checked={notifyOrderUpdates}
                onChange={(event) => handleFieldChange(setNotifyOrderUpdates, event.target.checked)}
                className="w-5 h-5 rounded text-green-500 focus:ring-green-500"
              />
              <label htmlFor="driver-notify-order-updates" className="cursor-pointer">
                <span className="font-medium text-gray-900">{t('driver.settings.notifyOrderUpdates', 'Order Status Updates')}</span>
                <p className="text-xs text-gray-500">{t('driver.settings.notifyOrderUpdatesDesc', 'When delivery status changes')}</p>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="driver-notify-customer-messages"
                type="checkbox"
                checked={notifyCustomerMessages}
                onChange={(event) => handleFieldChange(setNotifyCustomerMessages, event.target.checked)}
                className="w-5 h-5 rounded text-green-500 focus:ring-green-500"
              />
              <label htmlFor="driver-notify-customer-messages" className="cursor-pointer">
                <span className="font-medium text-gray-900">{t('driver.settings.notifyCustomerMessages', 'Customer Messages')}</span>
                <p className="text-xs text-gray-500">{t('driver.settings.notifyCustomerMessagesDesc', 'When a customer sends you a message')}</p>
              </label>
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            className="btn-primary inline-flex items-center gap-2"
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" />
                {t('driver.settings.saving', 'Saving...')}
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-5 h-5" />
                {t('driver.settings.saveChanges', 'Save Settings')}
              </>
            )}
          </button>
          {hasChanges && !saving && (
            <p className="text-xs text-gray-500">
              {t('driver.settings.keyboardShortcut', 'Press Ctrl+S to save')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const DriverSettingsWithErrorBoundary = () => (
  <ErrorBoundary componentName="DriverSettings">
    <DriverSettings />
  </ErrorBoundary>
)

export default DriverSettingsWithErrorBoundary
