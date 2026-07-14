import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner, Input } from '@/components/ui'
import { TruckIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

/**
 * Calls the upgrade-role Edge Function instead of writing to profiles directly.
 * Server-side validation prevents client-side role forgery (SEC-007 fix).
 */
const upgradeToDriverViaEdgeFunction = async (payload) => {
  const { data, error } = await supabase.functions.invoke('upgrade-role', {
    body: payload,
  })
  if (error) throw error
  if (!data?.success) throw new Error(data?.error || 'Upgrade failed')
  return data
}

const MOROCCAN_PHONE_REGEX = /^(\+212|0)([5-7]\d{8})$/

const validatePhone = (phone, t) => {
  if (!phone || phone.trim().length < 9) return t('becomeDriver.errors.phoneRequired', 'Phone number is required')
  if (!MOROCCAN_PHONE_REGEX.test(phone.trim())) return t('becomeDriver.errors.phoneInvalid', 'Enter a valid Moroccan phone number (+212 or 06/07...)')
  return ''
}

const validatePlate = (plate, t) => {
  if (!plate || plate.trim().length < 3) return t('becomeDriver.errors.plateRequired', 'Vehicle plate is required')
  if (plate.trim().length > 20) return t('becomeDriver.errors.plateLong', 'Plate number is too long')
  return ''
}

const BecomeDriver = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [errors, setErrors] = useState({})
  const [formData, setFormData] = useState({
    vehicleType: 'motorcycle',
    vehiclePlate: '',
    city: profile?.city || '',
    phone: profile?.phone || '',
  })

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/login', { state: { from: '/become-driver' } })
      } else if (profile?.role === 'driver') {
        navigate('/driver/dashboard')
      } else {
        setChecking(false)
      }
    }
  }, [user, profile, authLoading, navigate])

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) return null
  if (profile?.role === 'driver') return null

  const handleSubmit = async (e) => {
    e.preventDefault()

    const newErrors = {}

    const phoneErr = validatePhone(formData.phone, t)
    if (phoneErr) newErrors.phone = phoneErr

    const plateErr = validatePlate(formData.vehiclePlate, t)
    if (plateErr) newErrors.vehiclePlate = plateErr

    if (!formData.city || formData.city.trim().length < 2) {
      newErrors.city = t('becomeDriver.errors.cityRequired', 'City is required')
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error(t('becomeDriver.errors.fixErrors', 'Please fix the errors in the form'))
      return
    }

    setErrors({})
    setLoading(true)
    try {
      // Upgrade via Edge Function (server-side role change — SEC-007 fix)
      await upgradeToDriverViaEdgeFunction({
        target_role:   'driver',
        vehicle_type:  formData.vehicleType,
        vehicle_plate: formData.vehiclePlate.trim(),
        city:          formData.city.trim(),
        phone:         formData.phone.trim(),
      })

      // Refresh local profile so the store reflects the new role immediately
      await useAuthStore.getState().refreshProfile?.()

      toast.success(t('becomeDriver.success', 'Welcome! Your account has been upgraded to driver'))
      navigate('/driver/dashboard')
    } catch (error) {
      logger.error('Error upgrading to driver:', error)
      if (error?.message?.includes("Only users with role 'buyer'")) {
        toast.error(t('becomeDriver.errors.notBuyer', 'Only buyer accounts can apply to become a driver'))
      } else {
        toast.error(error.message || t('becomeDriver.errors.upgradeFailed', 'Failed to upgrade account'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <TruckIcon className="w-8 h-8 text-cyan-600" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('becomeDriver.title', 'Become a Driver')}</h1>
        <p className="text-gray-600">{t('becomeDriver.subtitle', 'Start delivering on Qotoof')}</p>
      </div>

      {/* Benefits */}
      <Card className="p-6 mb-8 bg-cyan-50 border-cyan-200">
        <h2 className="font-semibold text-cyan-800 mb-3">{t('becomeDriver.benefits.title', 'Driver Benefits')}</h2>
        <ul className="space-y-2 text-sm text-cyan-700">
          <li className="flex items-center gap-2">✓ {t('becomeDriver.benefits.flexible', 'Flexible schedule — work when you want')}</li>
          <li className="flex items-center gap-2">✓ {t('becomeDriver.benefits.competitive', 'Competitive earnings per delivery')}</li>
          <li className="flex items-center gap-2">✓ {t('becomeDriver.benefits.tracking', 'Real-time delivery tracking')}</li>
          <li className="flex items-center gap-2">✓ {t('becomeDriver.benefits.ratings', 'Build your reputation with ratings')}</li>
        </ul>
      </Card>

      {/* Form */}
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="input-label">{t('becomeDriver.form.vehicleType', 'Vehicle Type')}</label>
            <select
              value={formData.vehicleType}
              onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
              className="input"
            >
              <option value="motorcycle">{t('becomeDriver.form.types.motorcycle', 'Motorcycle')}</option>
              <option value="car">{t('becomeDriver.form.types.car', 'Car')}</option>
              <option value="van">{t('becomeDriver.form.types.van', 'Van')}</option>
              <option value="truck">{t('becomeDriver.form.types.truck', 'Truck')}</option>
            </select>
          </div>

          <div>
            <Input
              label={t('becomeDriver.form.vehiclePlate', 'Vehicle Plate Number')}
              value={formData.vehiclePlate}
              onChange={(e) => { setFormData({ ...formData, vehiclePlate: e.target.value }); if (errors.vehiclePlate) setErrors({ ...errors, vehiclePlate: null }) }}
              placeholder={t('becomeDriver.form.platePlaceholder', 'e.g., 12345-A-6')}
              required
            />
            {errors.vehiclePlate && <p className="text-red-500 text-xs mt-1">{errors.vehiclePlate}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label={t('becomeDriver.form.city', 'City')}
                value={formData.city}
                onChange={(e) => { setFormData({ ...formData, city: e.target.value }); if (errors.city) setErrors({ ...errors, city: null }) }}
                placeholder={t('becomeDriver.form.cityPlaceholder', 'Casablanca')}
                required
              />
              {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
            </div>
            <div>
              <Input
                label={t('becomeDriver.form.phone', 'Phone')}
                type="tel"
                value={formData.phone}
                onChange={(e) => { setFormData({ ...formData, phone: e.target.value }); if (errors.phone) setErrors({ ...errors, phone: null }) }}
                placeholder={t('becomeDriver.form.phonePlaceholder', '+212 6XX XXX XXX')}
                required
              />
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => navigate(-1)} className="btn-outline flex-1">
              {t('common.cancel', 'Cancel')}
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : t('becomeDriver.submit', 'Become a Driver')}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}

export default BecomeDriver
