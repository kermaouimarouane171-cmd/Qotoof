import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner, Input, VendorGuidelines } from '@/components/ui'
import { BuildingStorefrontIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { emailService } from '@/services/emailService'
import { logger } from '@/utils/logger'

// Moroccan phone validation
const MOROCCAN_PHONE_REGEX = /^(\+212|0)([5-7]\d{8})$/

const validatePhone = (phone, t) => {
  if (!phone || phone.trim().length < 9) return t('becomeVendor.errors.phoneRequired', 'Phone number is required')
  if (!MOROCCAN_PHONE_REGEX.test(phone.trim())) return t('becomeVendor.errors.phoneInvalid', 'Enter a valid Moroccan phone number (+212 or 06/07...)')
  return ''
}

const validateStoreName = (name, t) => {
  if (!name || name.trim().length < 3) return t('becomeVendor.errors.storeNameShort', 'Store name must be at least 3 characters')
  if (name.trim().length > 100) return t('becomeVendor.errors.storeNameLong', 'Store name must be less than 100 characters')
  return ''
}

const validateDescription = (desc, t) => {
  if (desc && desc.trim().length > 2000) return t('becomeVendor.errors.descLong', 'Description must be less than 2000 characters')
  return ''
}

const validateExperience = (exp, t) => {
  if (!exp) return '' // optional
  const num = parseInt(exp)
  if (isNaN(num) || num < 0) return t('becomeVendor.errors.expInvalid', 'Experience must be a positive number')
  if (num > 80) return t('becomeVendor.errors.expUnrealistic', 'Experience seems unrealistic (max 80 years)')
  return ''
}

const BecomeVendor = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [errors, setErrors] = useState({})
  const [guidelinesAccepted, setGuidelinesAccepted] = useState(false)
  const [formData, setFormData] = useState({
    storeName: profile?.store_name || '',
    description: profile?.description || '',
    businessType: profile?.business_type || '',
    experience: profile?.experience_years || '',
    city: profile?.city || '',
    phone: profile?.phone || '',
  })

  // Handle auth check with loading state
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/login', { state: { from: '/become-vendor' } })
      } else if (profile?.role === 'vendor') {
        navigate('/vendor/dashboard')
      } else {
        setChecking(false)
      }
    }
  }, [user, profile, authLoading, navigate])

  // Show loading while checking auth
  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Guard: redirect if not authenticated or already vendor
  if (!user) return null
  if (profile?.role === 'vendor') return null

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate all fields
    const newErrors = {}

    const storeNameErr = validateStoreName(formData.storeName, t)
    if (storeNameErr) newErrors.storeName = storeNameErr

    const descErr = validateDescription(formData.description, t)
    if (descErr) newErrors.description = descErr

    const phoneErr = validatePhone(formData.phone, t)
    if (phoneErr) newErrors.phone = phoneErr

    const expErr = validateExperience(formData.experience, t)
    if (expErr) newErrors.experience = expErr

    if (!formData.city || formData.city.trim().length < 2) {
      newErrors.city = t('becomeVendor.errors.cityRequired', 'City is required')
    }
    if (formData.city && formData.city.trim().length > 100) {
      newErrors.city = t('becomeVendor.errors.cityLong', 'City name is too long')
    }

    if (!guidelinesAccepted) {
      toast.error(t('becomeVendor.errors.guidelinesRequired', 'Please accept the Vendor Guidelines to continue'))
      return
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error(t('becomeVendor.errors.fixErrors', 'Please fix the errors in the form'))
      return
    }

    setErrors({})
    setLoading(true)
    try {
      // Check if store name is already taken
      const { data: existingStore } = await supabase
        .from('profiles')
        .select('id, store_name')
        .eq('store_name', formData.storeName.trim())
        .neq('id', user.id)
        .maybeSingle()

      if (existingStore) {
        toast.error(t('becomeVendor.errors.storeNameTaken', 'Store name is already taken. Please choose a different name.'))
        setErrors({ storeName: t('becomeVendor.errors.storeNameTakenShort', 'This store name is already in use') })
        setLoading(false)
        return
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          role: 'vendor',
          store_name: formData.storeName.trim(),
          description: formData.description?.trim() || null,
          business_type: formData.businessType || null,
          experience_years: formData.experience ? parseInt(formData.experience) : null,
          city: formData.city.trim(),
          phone: formData.phone.trim(),
        })
        .eq('id', user.id)

      if (error) throw error

      // Send welcome email to new vendor
      try {
        await emailService.sendWelcomeEmail({
          name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Vendor',
          email: profile?.email || user.email,
        })
      } catch (emailErr) {
        // Don't fail the upgrade if email fails
        logger.error('Vendor welcome email failed:', emailErr)
      }

      toast.success(t('becomeVendor.success', "Welcome! Your account has been upgraded to vendor"))
      navigate('/vendor/dashboard')
    } catch (error) {
      logger.error('Error upgrading to vendor:', error)
      toast.error(error.message || t('becomeVendor.errors.upgradeFailed', 'Failed to upgrade account'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <BuildingStorefrontIcon className="w-8 h-8 text-green-500" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('becomeVendor.title', 'Become a Vendor')}</h1>
        <p className="text-gray-600">{t('becomeVendor.subtitle', 'Start selling on Qotoof')}</p>
      </div>

      {/* Benefits */}
      <Card className="p-6 mb-8 bg-green-50 border-green-200">
        <h2 className="font-semibold text-green-800 mb-3">{t('becomeVendor.benefits.title', 'Vendor Benefits')}</h2>
        <ul className="space-y-2 text-sm text-green-700">
          <li className="flex items-center gap-2">✓ {t('becomeVendor.benefits.unlimited', 'Unlimited product listings')}</li>
          <li className="flex items-center gap-2">✓ {t('becomeVendor.benefits.storePage', 'Dedicated store page')}</li>
          <li className="flex items-center gap-2">✓ {t('becomeVendor.benefits.dashboard', 'Order management dashboard')}</li>
          <li className="flex items-center gap-2">✓ {t('becomeVendor.benefits.analytics', 'Sales analytics & reports')}</li>
          <li className="flex items-center gap-2">✓ {t('becomeVendor.benefits.communication', 'Direct customer communication')}</li>
        </ul>
      </Card>

      {/* Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              label={t('becomeVendor.form.storeName', 'Store Name')}
              value={formData.storeName}
              onChange={(e) => { setFormData({ ...formData, storeName: e.target.value }); if (errors.storeName) setErrors({...errors, storeName: null}) }}
              placeholder={t('becomeVendor.form.storeNamePlaceholder', 'e.g., Fresh Organic Farm')}
              required
            />
            {errors.storeName && <p className="text-red-500 text-xs mt-1">{errors.storeName}</p>}
          </div>

          <div>
            <label className="input-label">{t('becomeVendor.form.description', 'Store Description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => { setFormData({ ...formData, description: e.target.value }); if (errors.description) setErrors({...errors, description: null}) }}
              className="input h-24 resize-none"
              placeholder={t('becomeVendor.form.descriptionPlaceholder', 'Tell customers about your business...')}
              maxLength={2000}
            />
            <p className="text-xs text-gray-400 mt-1">{formData.description?.length || 0}/2000</p>
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="input-label">{t('becomeVendor.form.businessType', 'Business Type')}</label>
              <select
                value={formData.businessType}
                onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                className="input"
              >
                <option value="">{t('becomeVendor.form.selectType', 'Select type')}</option>
                <option value="farmer">{t('becomeVendor.form.types.farmer', 'Farmer')}</option>
                <option value="wholesaler">{t('becomeVendor.form.types.wholesaler', 'Wholesaler')}</option>
                <option value="retailer">{t('becomeVendor.form.types.retailer', 'Retailer')}</option>
                <option value="cooperative">{t('becomeVendor.form.types.cooperative', 'Cooperative')}</option>
              </select>
            </div>
            <div>
              <Input
                label={t('becomeVendor.form.experience', 'Years of Experience')}
                type="number"
                min="0"
                max="80"
                value={formData.experience}
                onChange={(e) => { setFormData({ ...formData, experience: e.target.value }); if (errors.experience) setErrors({...errors, experience: null}) }}
                placeholder="5"
              />
              {errors.experience && <p className="text-red-500 text-xs mt-1">{errors.experience}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label={t('becomeVendor.form.city', 'City')}
                value={formData.city}
                onChange={(e) => { setFormData({ ...formData, city: e.target.value }); if (errors.city) setErrors({...errors, city: null}) }}
                placeholder={t('becomeVendor.form.cityPlaceholder', 'Casablanca')}
                required
              />
              {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
            </div>
            <div>
              <Input
                label={t('becomeVendor.form.phone', 'Phone')}
                type="tel"
                value={formData.phone}
                onChange={(e) => { setFormData({ ...formData, phone: e.target.value }); if (errors.phone) setErrors({...errors, phone: null}) }}
                placeholder={t('becomeVendor.form.phonePlaceholder', '+212 6XX XXX XXX')}
                required
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
          </div>

          {/* Vendor Guidelines */}
          <VendorGuidelines
            onAccept={() => setGuidelinesAccepted(true)}
            alreadyAccepted={profile?.vendor_guidelines_accepted || false}
          />

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => navigate(-1)} className="btn-outline flex-1">
              {t('common.cancel', 'Cancel')}
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : t('becomeVendor.submit', 'Become a Vendor')}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default BecomeVendor
