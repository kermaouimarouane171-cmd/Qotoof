import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { fetchProfile, updateProfile } from '@/modules/users'
import { Card, Input, LoadingSpinner } from '@/components/ui'
import { PhoneVerificationDialog } from '@/components/auth/PhoneVerification'
import ErrorBoundary from '@/components/ErrorBoundary'
import {
  UserIcon,
  CameraIcon,
  BuildingStorefrontIcon,
  EyeIcon,
  MapPinIcon,
  ClockIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { auditLogger } from '@/services/auditLogger'

// Sub-tabs rendered as full embedded components
import LocationTab from './LocationSetup'
import HoursTab from './Schedules'
import SecurityTab from './Security'
import PreferencesTab from './Settings'

// ============================================
// Tab definitions
// ============================================
const TABS = [
  { id: 'store-info', labelKey: 'vendor.profile.tabs.storeInfo', fallback: 'Store Info', icon: BuildingStorefrontIcon },
  { id: 'location', labelKey: 'vendor.profile.tabs.location', fallback: 'Location', icon: MapPinIcon },
  { id: 'hours', labelKey: 'vendor.profile.tabs.hours', fallback: 'Hours', icon: ClockIcon },
  { id: 'security', labelKey: 'vendor.profile.tabs.security', fallback: 'Security', icon: ShieldCheckIcon },
  { id: 'preferences', labelKey: 'vendor.profile.tabs.preferences', fallback: 'Preferences', icon: Cog6ToothIcon },
]

// ============================================
// Store Info Tab (existing Profile form)
// ============================================
const StoreInfoTab = () => {
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const [errors, setErrors] = useState({})
  const [hasChanges, setHasChanges] = useState(false)
  const [showPhoneVerification, setShowPhoneVerification] = useState(false)
  const [pendingSavePayload, setPendingSavePayload] = useState(null)
  const logoInputRef = useRef(null)
  const bannerInputRef = useRef(null)

  const [formData, setFormData] = useState({
    store_name: profile?.store_name || '',
    description: profile?.description || '',
    phone: profile?.phone || '',
    city: profile?.city || '',
    address: profile?.address || '',
  })
  const [storeLogo, setStoreLogo] = useState(profile?.store_logo || null)
  const [storeBanner, setStoreBanner] = useState(profile?.store_banner || null)

  useEffect(() => {
    if (hasChanges) {
      const handle = (e) => { e.preventDefault(); e.returnValue = '' }
      window.addEventListener('beforeunload', handle)
      return () => window.removeEventListener('beforeunload', handle)
    }
  }, [hasChanges])

  useEffect(() => {
    const handle = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, storeLogo, storeBanner])

  const validateForm = () => {
    const errs = {}
    if (!formData.store_name.trim()) errs.store_name = t('vendor.profile.errors.storeNameRequired', 'Store name is required')
    else if (formData.store_name.length < 3) errs.store_name = t('vendor.profile.errors.storeNameShort', 'Store name must be at least 3 characters')
    else if (formData.store_name.length > 100) errs.store_name = t('vendor.profile.errors.storeNameLong', 'Store name must be less than 100 characters')
    if (formData.phone && !/^[+]?[\d\s()-]{8,15}$/.test(formData.phone)) errs.phone = t('vendor.profile.errors.invalidPhone', 'Please enter a valid phone number')
    if (formData.city && formData.city.length > 50) errs.city = t('vendor.profile.errors.cityLong', 'City must be less than 50 characters')
    if (formData.description && formData.description.length > 500) errs.description = t('vendor.profile.errors.descriptionLong', 'Description must be less than 500 characters')
    return errs
  }

  const handleImageUpload = async (file, type) => {
    if (!file || !user) return
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) { toast.error(t('vendor.profile.errors.invalidImageType', 'Only JPEG, PNG, and WebP images are allowed')); return }
    const maxSize = type === 'logo' ? 2 * 1024 * 1024 : 5 * 1024 * 1024
    if (file.size > maxSize) { toast.error(t('vendor.profile.errors.imageTooLarge', 'Image must be less than {{size}}MB', { size: type === 'logo' ? 2 : 5 })); return }
    const setUploading = type === 'logo' ? setLogoUploading : setBannerUploading
    const setUrl = type === 'logo' ? setStoreLogo : setStoreBanner
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `store-logos/${user.id}-${type}-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('store-logos').upload(filePath, file, { cacheControl: '3600', upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('store-logos').getPublicUrl(filePath)
      setUrl(publicUrl)
      const updateField = type === 'logo' ? 'store_logo' : 'store_banner'
      await updateProfile(user.id, { [updateField]: publicUrl })
      await auditLogger.logProfileAction('PROFILE_IMAGE_UPDATED', { ...profile, [updateField]: publicUrl }, profile)
      toast.success(t('vendor.profile.imageUpdated', '{{type}} updated!', { type: type === 'logo' ? 'Store logo' : 'Store banner' }))
      setHasChanges(true)
    } catch (error) {
      logger.error(`${type} upload error:`, error)
      toast.error(t('vendor.profile.errors.uploadFailed', 'Failed to upload {{type}}', { type }))
    } finally {
      setUploading(false)
    }
  }

  const persistStoreInfo = async (payload) => {
    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); toast.error(t('vendor.profile.errors.fixErrors', 'Please fix the errors before saving')); return }
    setLoading(true); setErrors({})
    try {
      const oldProfile = await fetchProfile(user.id)
      const updatedProfile = await updateProfile(user.id, payload)
      useAuthStore.setState((state) => ({
        ...state,
        profile: state.profile ? { ...state.profile, ...updatedProfile } : state.profile,
      }))
      await auditLogger.logProfileAction('UPDATE', { ...oldProfile, ...updatedProfile }, oldProfile)
      toast.success(t('vendor.profile.saved', 'Profile updated successfully!'))
      setHasChanges(false)
    } catch (error) {
      logger.error('Profile update error:', error)
      toast.error(t('vendor.profile.errors.saveFailed', 'Failed to update profile'))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const updatePayload = { ...formData, store_logo: storeLogo, store_banner: storeBanner }
    const phoneChanged = (formData.phone || '').trim() !== (profile?.phone || '').trim()

    if (phoneChanged) {
      if (!formData.phone.trim()) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          phone: 'أدخل رقم الهاتف الجديد للتحقق منه أولاً',
        }))
        return
      }

      setPendingSavePayload(updatePayload)
      setShowPhoneVerification(true)
      return
    }

    await persistStoreInfo(updatePayload)
  }

  const handlePhoneVerified = async () => {
    const payload = pendingSavePayload

    setShowPhoneVerification(false)
    setPendingSavePayload(null)

    if (payload) {
      await persistStoreInfo(payload)
    }
  }

  const handleFieldChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
    setHasChanges(true)
    if (errors[field]) setErrors({ ...errors, [field]: null })
  }

  return (
    <Card className="p-6">
      {/* Store Banner */}
      <div className="relative w-full h-48 bg-gray-100 rounded-xl overflow-hidden mb-6">
        {storeBanner ? (
          <img src={storeBanner} alt={t('vendor.profile.bannerAlt', 'بانر المتجر')} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-600">
            <BuildingStorefrontIcon className="w-16 h-16 text-white/50" />
          </div>
        )}
        <button type="button" onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading}
          className="absolute bottom-3 right-3 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:bg-white disabled:opacity-50 transition-colors">
          {bannerUploading ? <div className="animate-spin h-5 w-5 border-2 border-gray-400 border-t-transparent rounded-full" /> : <CameraIcon className="w-5 h-5 text-gray-600" />}
        </button>
        <input ref={bannerInputRef} type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner')} className="hidden" />
      </div>

      {/* Store Logo */}
      <div className="relative -mt-16 ml-6 w-24 h-24 bg-white rounded-xl overflow-hidden shadow-lg border-4 border-white">
        {storeLogo ? (
          <img src={storeLogo} alt={t('vendor.profile.logoAlt', 'شعار المتجر')} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <BuildingStorefrontIcon className="w-10 h-10 text-gray-400" />
          </div>
        )}
        <button type="button" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
          className="absolute bottom-1 right-1 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow hover:bg-white disabled:opacity-50 transition-colors">
          {logoUploading ? <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full" /> : <CameraIcon className="w-4 h-4 text-gray-600" />}
        </button>
        <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo')} className="hidden" />
      </div>

      {/* Profile Info */}
      <div className="flex items-center gap-4 mb-6 mt-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <UserIcon className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h2 className="font-semibold">{profile?.first_name} {profile?.last_name}</h2>
          <p className="text-sm text-gray-500">{profile?.email}</p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label={t('vendor.profile.storeName', 'Store Name')} value={formData.store_name}
          onChange={(e) => handleFieldChange('store_name', e.target.value)} error={errors.store_name} required />
        <Input label={t('vendor.profile.city', 'City')} value={formData.city}
          onChange={(e) => handleFieldChange('city', e.target.value)} error={errors.city} />
        <Input label={t('vendor.profile.phone', 'Phone')} value={formData.phone}
          onChange={(e) => handleFieldChange('phone', e.target.value)} error={errors.phone} placeholder="+212 6XX-XXXXXX" />
        <Input label={t('vendor.profile.address', 'Address')} value={formData.address}
          onChange={(e) => handleFieldChange('address', e.target.value)} error={errors.address} />
        <div className="col-span-1 sm:col-span-2">
          <label className="input-label">{t('vendor.profile.description', 'Description')}</label>
          <textarea value={formData.description} onChange={(e) => handleFieldChange('description', e.target.value)}
            className={`input h-24 resize-none ${errors.description ? 'border-red-300' : ''}`} maxLength={500} />
          {errors.description && <p className="text-sm text-red-600 mt-1">{errors.description}</p>}
          <p className="text-xs text-gray-400 mt-1 text-right">{(formData.description || '').length}/500</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4">
        <button onClick={handleSave} className="btn-primary" disabled={loading || !hasChanges}>
          {loading ? <LoadingSpinner size="sm" /> : t('vendor.profile.saveChanges', 'Save Changes')}
        </button>
        {hasChanges && !loading && (
          <p className="text-sm text-amber-600 flex items-center gap-1">
            <span className="w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
            {t('vendor.profile.unsavedChanges', 'You have unsaved changes')}
          </p>
        )}
        <p className="text-xs text-gray-400">{t('vendor.profile.keyboardShortcut', 'Press Ctrl+S to save')}</p>
      </div>

      <PhoneVerificationDialog
        open={showPhoneVerification}
        onClose={() => {
          setShowPhoneVerification(false)
          setPendingSavePayload(null)
        }}
        userId={user?.id}
        phone={formData.phone}
        purpose="change_phone"
        title="📱 تأكيد رقم هاتف المتجر"
        description="تغيير رقم الهاتف يتطلب رمز تحقق SMS قبل حفظ البيانات التجارية."
        onVerified={handlePhoneVerified}
      />
    </Card>
  )
}

// ============================================
// Main Profile Component with Tabs
// ============================================
const VendorProfile = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'store-info'

  const setTab = (id) => setSearchParams({ tab: id }, { replace: true })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('vendor.profile.title', 'Vendor Profile')}</h1>
        <a href={`/stores/${user?.id}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-green-600 hover:underline">
          <EyeIcon className="w-4 h-4" />
          {t('vendor.profile.previewStore', 'Preview Store')}
        </a>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {t(tab.labelKey, tab.fallback)}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'store-info' && <StoreInfoTab />}
      {activeTab === 'location' && <LocationTab onComplete={() => setTab('store-info')} />}
      {activeTab === 'hours' && <HoursTab />}
      {activeTab === 'security' && <SecurityTab />}
      {activeTab === 'preferences' && <PreferencesTab />}
    </div>
  )
}

const VendorProfileWithErrorBoundary = () => (
  <ErrorBoundary componentName="VendorProfile">
    <VendorProfile />
  </ErrorBoundary>
)

export default VendorProfileWithErrorBoundary
