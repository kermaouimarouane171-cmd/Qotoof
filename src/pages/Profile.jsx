import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Button, Input, Card, Map, CINInput, TrustBadges, LoadingSpinner } from '@/components/ui'
import { PhoneVerificationDialog } from '@/components/auth/PhoneVerification'
import ErrorBoundary from '@/components/ErrorBoundary'
import { UserCircleIcon, ShieldCheckIcon, CheckCircleIcon, ClockIcon, XCircleIcon, CameraIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { formatCIN, maskCIN, getVerificationStatus, validateCIN } from '@/utils/cinValidation'
import { logger } from '@/utils/logger'

// ============================================================
// FIELD VALIDATION
// ============================================================
const validateField = (name, value) => {
  switch (name) {
    case 'firstName':
      if (!value.trim()) return 'First name is required'
      if (value.trim().length < 2) return 'First name must be at least 2 characters'
      if (value.trim().length > 50) return 'First name must be less than 50 characters'
      if (!/^[a-zA-Z\u0600-\u06FF\s'-]+$/.test(value)) return 'First name can only contain letters'
      return ''
    case 'lastName':
      if (!value.trim()) return 'Last name is required'
      if (value.trim().length < 2) return 'Last name must be at least 2 characters'
      if (value.trim().length > 50) return 'Last name must be less than 50 characters'
      if (!/^[a-zA-Z\u0600-\u06FF\s'-]+$/.test(value)) return 'Last name can only contain letters'
      return ''
    case 'phone':
      if (value && !/^[+]?[\d\s()-]{8,15}$/.test(value)) return 'Please enter a valid phone number'
      return ''
    case 'address':
      if (value && value.length > 200) return 'Address must be less than 200 characters'
      return ''
    case 'city':
      if (value && value.length > 50) return 'City must be less than 50 characters'
      return ''
    case 'storeName':
      if (value && value.length < 3) return 'Store name must be at least 3 characters'
      if (value && value.length > 100) return 'Store name must be less than 100 characters'
      return ''
    case 'storeDescription':
      if (value && value.length > 500) return 'Store description must be less than 500 characters'
      return ''
    default:
      return ''
  }
}

const ProfilePage = () => {
  const { t } = useTranslation()
  const { profile, updateProfile, user } = useAuthStore()
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    cin: profile?.cin || '',
    storeName: profile?.store_name || '',
    storeDescription: profile?.store_description || '',
    address: profile?.address || '',
    city: profile?.city || '',
    country: profile?.country || 'Morocco',
    latitude: profile?.latitude || null,
    longitude: profile?.longitude || null,
  })

  const [errors, setErrors] = useState({})
  const [cinError, setCINError] = useState('')
  const [showFullCIN, setShowFullCIN] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null)
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showPhoneVerification, setShowPhoneVerification] = useState(false)
  const [pendingProfilePayload, setPendingProfilePayload] = useState(null)

  // Check for unsaved changes
  useEffect(() => {
    const originalData = {
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      phone: profile?.phone || '',
      cin: profile?.cin || '',
      storeName: profile?.store_name || '',
      storeDescription: profile?.store_description || '',
      address: profile?.address || '',
      city: profile?.city || '',
      country: profile?.country || 'Morocco',
    }
    setHasChanges(JSON.stringify(formData) !== JSON.stringify(originalData))
  }, [formData, profile])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    setAvatarLoadFailed(false)
  }, [avatarUrl])

  useEffect(() => {
    if (hasChanges && !submitting) {
      const handleBeforeUnload = (e) => {
        e.preventDefault()
        e.returnValue = ''
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasChanges, submitting])

  const handleFieldChange = (name, value) => {
    setFormData({ ...formData, [name]: value })
    const error = validateField(name, value)
    setErrors({ ...errors, [name]: error })
  }

  // ============================================================
  // AVATAR UPLOAD
  // ============================================================
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('profile.errors.invalidImageType', 'Only JPEG, PNG, WebP, and GIF images are allowed'))
      return
    }

    // Validate file size (max 2MB)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      toast.error(t('profile.errors.imageTooLarge', 'Image must be less than 2MB'))
      return
    }

    setAvatarUploading(true)
    try {
      // Generate unique file name
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `profile-photos/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath)

      setAvatarUrl(publicUrl)

      // Update profile with avatar URL
      await updateProfile({ avatar_url: publicUrl })
      toast.success(t('profile.avatarUpdated', 'Profile photo updated!'))
    } catch (error) {
      logger.error('Avatar upload error:', error)
      toast.error(t('profile.errors.avatarUploadFailed', 'Failed to upload photo'))
    } finally {
      setAvatarUploading(false)
    }
  }

  // ============================================================
  // FORM SUBMISSION
  // ============================================================
  const persistProfile = async (profileUpdates) => {
    setSubmitting(true)
    try {
      const result = await updateProfile(profileUpdates)

      if (result.success) {
        toast.success(t('profile.updated', 'Profile updated successfully'))
        setHasChanges(false)
      } else {
        toast.error(result.error || t('profile.errors.updateFailed', 'Failed to update profile'))
      }
    } catch (error) {
      logger.error('Profile update error:', error)
      toast.error(t('profile.errors.updateFailed', 'Failed to update profile'))
    } finally {
      setSubmitting(false)
    }
  }

  const handlePhoneVerified = async () => {
    const profileUpdates = pendingProfilePayload

    setShowPhoneVerification(false)
    setPendingProfilePayload(null)

    if (profileUpdates) {
      await persistProfile(profileUpdates)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate all fields
    const newErrors = {}
    Object.keys(formData).forEach(key => {
      if (['email', 'latitude', 'longitude'].includes(key)) return // Skip email and coordinates
      const error = validateField(key, formData[key])
      if (error) newErrors[key] = error
    })

    // Validate CIN if it changed
    if (formData.cin && formData.cin !== profile?.cin) {
      const cinResult = validateCIN(formData.cin)
      if (!cinResult.valid) {
        setCINError(cinResult.error)
        newErrors.cin = cinResult.error
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error(t('profile.errors.fixErrors', 'Please fix the errors before submitting'))
      return
    }

    const profileUpdates = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      phone: formData.phone,
      cin: formData.cin || null,
      store_name: formData.storeName,
      store_description: formData.storeDescription,
      address: formData.address,
      city: formData.city,
      country: formData.country,
      latitude: formData.latitude,
      longitude: formData.longitude,
    }

    const phoneChanged = (formData.phone || '').trim() !== (profile?.phone || '').trim()

    if (phoneChanged) {
      if (!formData.phone.trim()) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          phone: 'أدخل رقم الهاتف الجديد للتحقق منه أولاً',
        }))
        return
      }

      setPendingProfilePayload(profileUpdates)
      setShowPhoneVerification(true)
      return
    }

    await persistProfile(profileUpdates)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('profile.title', 'Profile')}</h1>

      {/* Profile Header with Avatar */}
      <Card className="p-6 mb-8">
        <div className="flex items-center gap-4">
          {/* Avatar with Upload Button */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
              {avatarUrl && !avatarLoadFailed ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                <UserCircleIcon className="w-12 h-12 text-gray-400" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              aria-label={t('profile.uploadPhoto', 'Upload profile photo')}
            >
              {avatarUploading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <CameraIcon className="w-4 h-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarUpload}
              className="hidden"
              aria-label={t('profile.uploadPhoto', 'Profile photo upload')}
            />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {profile?.first_name} {profile?.last_name}
            </h2>
            <p className="text-gray-500 capitalize">{profile?.role}</p>
          </div>
        </div>
      </Card>

      {/* Profile Form */}
      <form onSubmit={handleSubmit}>
        {/* Personal Information */}
        <Card className="p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">{t('profile.personalInfo', 'Personal Information')}</h3>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('auth.firstName', 'First Name')}
                value={formData.firstName}
                onChange={(e) => handleFieldChange('firstName', e.target.value)}
                error={errors.firstName}
                required
              />
              <Input
                label={t('auth.lastName', 'Last Name')}
                value={formData.lastName}
                onChange={(e) => handleFieldChange('lastName', e.target.value)}
                error={errors.lastName}
                required
              />
            </div>

            <div>
              <Input
                label={t('auth.email', 'Email')}
                type="email"
                value={formData.email}
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('profile.emailChangeNote', 'To change your email, go to')}{' '}
                <Link to="/settings" className="text-green-600 hover:underline">{t('profile.accountSettings', 'Account Settings')}</Link>
              </p>
            </div>

            <Input
              label={t('auth.phone', 'Phone')}
              value={formData.phone}
              onChange={(e) => handleFieldChange('phone', e.target.value)}
              error={errors.phone}
              placeholder="+212 6XX-XXXXXX"
            />

            {/* National ID Section */}
            <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">{t('profile.cin.title', 'National ID (CIN)')}</h3>
                </div>
                {profile?.cin && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    profile.cin_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {profile.cin_verified ? (
                      <span className="flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> {t('profile.cin.verified', 'Verified')}</span>
                    ) : (
                      <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3" /> {t('profile.cin.pending', 'Pending')}</span>
                    )}
                  </span>
                )}
              </div>

              {profile?.cin ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg tracking-wider text-gray-900">
                        {showFullCIN ? formatCIN(profile.cin) : maskCIN(profile.cin)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFullCIN(!showFullCIN)}
                        className="text-xs text-green-600 hover:underline"
                      >
                        {showFullCIN ? t('profile.cin.hide', 'Hide') : t('profile.cin.show', 'Show')}
                      </button>
                    </div>
                  </div>
                  {!profile.cin_verified && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                      <ClockIcon className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-yellow-700">
                        <p className="font-medium mb-1">{t('profile.cin.verifying', 'Verification in progress')}</p>
                        <p>{t('profile.cin.verifyingDesc', 'Your identity is being verified. This usually takes 24-48 hours.')}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <CINInput
                  value={formData.cin}
                  onChange={(value) => { setFormData({ ...formData, cin: value }); setCINError(''); handleFieldChange('cin', value) }}
                  error={cinError || errors.cin}
                  showHelp
                />
              )}
            </div>
          </div>
        </Card>

        {/* Store Information (Vendors Only) */}
        {profile?.role === 'vendor' && (
          <Card className="p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">{t('profile.storeInfo', 'Store Information')}</h3>

            <div className="space-y-4">
              <Input
                label={t('profile.storeName', 'Store Name')}
                value={formData.storeName}
                onChange={(e) => handleFieldChange('storeName', e.target.value)}
                error={errors.storeName}
              />

              <div>
                <label className="input-label">{t('profile.storeDescription', 'Store Description')}</label>
                <textarea
                  value={formData.storeDescription}
                  onChange={(e) => handleFieldChange('storeDescription', e.target.value)}
                  className={`input h-24 resize-none ${errors.storeDescription ? 'border-red-300' : ''}`}
                  maxLength={500}
                />
                {errors.storeDescription && (
                  <p className="text-sm text-red-600 mt-1">{errors.storeDescription}</p>
                )}
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {(formData.storeDescription || '').length}/500
                </p>
              </div>

              <Input
                label={t('profile.address', 'Address')}
                value={formData.address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                error={errors.address}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('profile.city', 'City')}
                  value={formData.city}
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                  error={errors.city}
                />
                <Input
                  label={t('profile.country', 'Country')}
                  value={formData.country}
                  onChange={(e) => handleFieldChange('country', e.target.value)}
                />
              </div>

              {/* Store Location Map */}
              <div>
                <label className="input-label">{t('profile.storeLocation', 'Store Location')}</label>
                <p className="text-xs text-gray-500 mb-2">{t('profile.storeLocationHint', 'Click on the map to set your store location')}</p>
                <Map
                  center={[
                    formData.latitude || 33.5731,
                    formData.longitude || -7.5898
                  ]}
                  zoom={12}
                  markers={
                    formData.latitude && formData.longitude
                      ? [{
                          lat: formData.latitude,
                          lng: formData.longitude,
                          popup: formData.storeName || 'Store Location',
                        }]
                      : []
                  }
                  height="250px"
                  onLocationSelect={(lat, lng) => {
                    setFormData({ ...formData, latitude: lat, longitude: lng })
                  }}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Submit Button */}
        <Button type="submit" variant="primary" size="lg" isLoading={submitting} disabled={submitting || !hasChanges}>
          {submitting ? t('profile.updating', 'Updating...') : t('profile.updateProfile', 'Update Profile')}
        </Button>

        {/* Unsaved Changes Indicator */}
        {hasChanges && !submitting && (
          <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            {t('profile.unsavedChanges', 'You have unsaved changes')}
          </p>
        )}

        {/* Trust Badges */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <TrustBadges variant="compact" />
        </div>
      </form>

      <PhoneVerificationDialog
        open={showPhoneVerification}
        onClose={() => {
          setShowPhoneVerification(false)
          setPendingProfilePayload(null)
        }}
        userId={user?.id}
        phone={formData.phone}
        purpose="change_phone"
        title="📱 تأكيد رقم الهاتف الجديد"
        description="قبل حفظ رقم الهاتف الجديد، نحتاج إلى تأكيده عبر رمز SMS لمرة واحدة."
        onVerified={handlePhoneVerified}
      />
    </div>
  )
}

// Wrap with Error Boundary
const ProfileWithErrorBoundary = () => (
  <ErrorBoundary componentName="ProfilePage">
    <ProfilePage />
  </ErrorBoundary>
)

export default ProfileWithErrorBoundary
