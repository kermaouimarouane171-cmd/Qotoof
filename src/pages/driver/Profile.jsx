import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Input, VehiclePhotoUpload } from '@/components/ui'
import { PhoneVerificationDialog } from '@/components/auth/PhoneVerification'
import DriverVerification from '@/components/driver/DriverVerification'
import { UserIcon, TruckIcon, DocumentCheckIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

const DriverProfile = () => {
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [formData, setFormData] = useState({
    phone: profile?.phone || '',
    vehicle_type: profile?.vehicle_type || 'van',
    vehicle_plate: profile?.vehicle_plate || '',
    vehicle_photo: profile?.vehicle_photo || '',
  })
  const [showPhoneVerification, setShowPhoneVerification] = useState(false)
  const [pendingSavePayload, setPendingSavePayload] = useState(null)

  const persistProfile = async (payload) => {
    setLoading(true)
    try {
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        .select()
        .single()

      if (error) throw error
      useAuthStore.setState((state) => ({
        ...state,
        profile: state.profile ? { ...state.profile, ...updatedProfile } : state.profile,
      }))
      toast.success(t('driver.profile.saveSuccess', 'Profile updated successfully'))
    } catch (error) {
      logger.error('Update error:', error)
      toast.error(t('driver.profile.saveFailed', 'Failed to update profile'))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    const payload = {
      phone: formData.phone,
      vehicle_type: formData.vehicle_type,
      vehicle_plate: formData.vehicle_plate,
      vehicle_photo: formData.vehicle_photo,
    }
    const phoneChanged = (formData.phone || '').trim() !== (profile?.phone || '').trim()

    if (phoneChanged) {
      if (!formData.phone.trim()) {
        toast.error('أدخل رقم الهاتف الجديد للتحقق منه أولاً')
        return
      }

      setPendingSavePayload(payload)
      setShowPhoneVerification(true)
      return
    }

    await persistProfile(payload)
  }

  const handlePhoneVerified = async () => {
    const payload = pendingSavePayload

    setShowPhoneVerification(false)
    setPendingSavePayload(null)

    if (payload) {
      await persistProfile(payload)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('driver.profile.title', 'Driver Profile')}</h1>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <UserIcon className="w-4 h-4" />
            {t('driver.profile.profileTab', 'Profile & Vehicle')}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('verification')}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'verification'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <DocumentCheckIcon className="w-4 h-4" />
            {t('driver.profile.verificationTab', 'Documents & Verification')}
          </span>
        </button>
      </div>

      {activeTab === 'profile' ? (
        <div className="space-y-6">
          {/* Personal Info */}
          <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{profile?.first_name} {profile?.last_name}</h2>
              <p className="text-sm text-gray-500">{profile?.email}</p>
            </div>
          </div>

          <Input
            label={t('driver.profile.phone', 'Phone')}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder={t('driver.profile.phonePlaceholder', '+212 6XX XXX XXX')}
          />
        </Card>

        {/* Vehicle Info */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <TruckIcon className="w-6 h-6 text-blue-600" />
            <h2 className="font-semibold text-lg">{t('driver.profile.vehicleInfo', 'Vehicle Information')}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="input-label">{t('driver.profile.vehicleType', 'Vehicle Type')}</label>
              <select
                value={formData.vehicle_type}
                onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                className="input"
              >
                <option value="motorcycle">{t('driver.profile.motorcycle', 'Motorcycle')}</option>
                <option value="car">{t('driver.profile.car', 'Car')}</option>
                <option value="van">{t('driver.profile.van', 'Van')}</option>
                <option value="truck">{t('driver.profile.truck', 'Truck')}</option>
              </select>
            </div>

            <Input
              label={t('driver.profile.licensePlate', 'License Plate')}
              value={formData.vehicle_plate}
              onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
              placeholder={t('driver.profile.licensePlatePlaceholder', 'ABC-1234')}
            />

            <VehiclePhotoUpload
              value={formData.vehicle_photo}
              onChange={(url) => setFormData({ ...formData, vehicle_photo: url })}
            />
          </div>
        </Card>

        <button onClick={handleSave} className="btn-primary w-full sm:w-auto" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              {t('driver.profile.saving', 'Saving...')}
            </span>
          ) : t('driver.profile.saveChanges', 'Save Changes')}
        </button>

        <PhoneVerificationDialog
          open={showPhoneVerification}
          onClose={() => {
            setShowPhoneVerification(false)
            setPendingSavePayload(null)
          }}
          userId={user?.id}
          phone={formData.phone}
          purpose="change_phone"
          title="📱 تأكيد رقم هاتف السائق"
          description="قبل حفظ رقم الهاتف الجديد للسائق، أدخل رمز التحقق المرسل إلى هذا الرقم."
          onVerified={handlePhoneVerified}
        />
        </div>
      ) : (
        <DriverVerification />
      )}
    </div>
  )
}

export default DriverProfile
