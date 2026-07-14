import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import toast from 'react-hot-toast'
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

const VendorPreferenceSetup = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [choice, setChoice] = useState(
    typeof profile?.has_preferred_vendor === 'boolean' ? profile.has_preferred_vendor : null
  )
  const [saving, setSaving] = useState(false)
  const [loadingPartner, setLoadingPartner] = useState(false)
  const [preferredVendor, setPreferredVendor] = useState(null)

  useEffect(() => {
    setChoice(typeof profile?.has_preferred_vendor === 'boolean' ? profile.has_preferred_vendor : null)
  }, [profile?.has_preferred_vendor])

  useEffect(() => {
    const loadPreferredVendor = async () => {
      if (!profile?.preferred_vendor_id) {
        setPreferredVendor(null)
        return
      }

      setLoadingPartner(true)
      try {
        const { data, error } = await supabase
          .from('public_profiles')
          .select('id, store_name, first_name, last_name, phone, city, rating, has_own_driver')
          .eq('id', profile.preferred_vendor_id)
          .maybeSingle()

        if (error) throw error
        setPreferredVendor(data)
      } catch {
        setPreferredVendor(null)
      } finally {
        setLoadingPartner(false)
      }
    }

    loadPreferredVendor()
  }, [profile?.preferred_vendor_id])

  const handleSave = async () => {
    if (choice === null) {
      toast.error(t('driver.vendorPrefs.errorChooseRequired', 'Please select whether you want a preferred vendor'))
      return
    }

    if (!profile?.id) {
      toast.error(t('driver.vendorPrefs.errorNoProfile', 'Could not identify the current driver account'))
      return
    }

    const updates = {
      has_preferred_vendor: choice,
      vendor_search_done: true,
      partnership_status: choice
        ? profile?.preferred_vendor_id
          ? 'accepted'
          : 'searching'
        : 'open',
    }

    if (!choice) {
      updates.preferred_vendor_id = null
      updates.preferred_vendor_linked_at = null
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)

      if (error) throw error

      if (!choice && profile.preferred_vendor_id) {
        const { error: unlinkError } = await supabase
          .from('profiles')
          .update({
            preferred_driver_id: null,
            has_own_driver: false,
            partnership_status: 'open',
            preferred_driver_linked_at: null,
          })
          .eq('id', profile.preferred_vendor_id)

        if (unlinkError) throw unlinkError
      }

      useAuthStore.setState((state) => ({
        profile: state.profile ? { ...state.profile, ...updates } : state.profile,
      }))

      toast.success(
        choice
          ? t('driver.vendorPrefs.savedWithVendor', 'Preference saved. You can now search for a vendor.')
          : t('driver.vendorPrefs.savedOpen', 'Preference saved. You will receive available open orders.')
      )

      navigate(choice ? '/driver/find-vendor' : '/driver/dashboard')
    } catch (error) {
      toast.error(error.message || t('driver.vendorPrefs.saveFailed', 'Failed to save vendor preferences'))
    } finally {
      setSaving(false)
    }
  }

  if (!profile) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('driver.vendorPrefs.title', 'Preferred Vendor Setup')}</h1>
        <p className="text-sm text-gray-500 mt-2 leading-6">
          {t('driver.vendorPrefs.subtitle', 'Choose whether you want to work with a fixed vendor or receive orders from multiple stores.')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setChoice(true)}
          className={`rounded-2xl border p-5 text-right transition-all ${
            choice === true
              ? 'border-blue-500 bg-blue-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-blue-300'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <BuildingStorefrontIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{t('driver.vendorPrefs.yesVendor', 'Yes, I want a preferred vendor')}</h2>
              <p className="text-xs text-gray-500">{t('driver.vendorPrefs.yesVendorDesc', 'Stable relationship for daily or recurring orders.')}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-6">
            {t('driver.vendorPrefs.yesVendorHint', 'Partnership requests will be sent to vendors. Once accepted, you will be linked automatically.')}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setChoice(false)}
          className={`rounded-2xl border p-5 text-right transition-all ${
            choice === false
              ? 'border-green-500 bg-green-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-green-300'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
              <UserGroupIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{t('driver.vendorPrefs.noVendor', 'No, I prefer receiving available orders')}</h2>
              <p className="text-xs text-gray-500">{t('driver.vendorPrefs.noVendorDesc', 'Useful if you work across multiple areas or delivery types.')}</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-6">
            {t('driver.vendorPrefs.noVendorHint', 'You will not be locked to one vendor. Orders are matched by distance, availability, and cargo size.')}
          </p>
        </button>
      </div>

      {(loadingPartner || preferredVendor) && (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">{t('driver.vendorPrefs.linkedVendor', 'Currently Linked Vendor')}</h3>
          </div>

          {loadingPartner ? (
            <div className="py-6 flex justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : preferredVendor ? (
            <div className="rounded-2xl border border-gray-200 p-4 bg-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">
                    {preferredVendor.store_name || `${preferredVendor.first_name || ''} ${preferredVendor.last_name || ''}`.trim()}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{preferredVendor.city || t('driver.vendorPrefs.unknownCity', 'Unknown city')}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {preferredVendor.phone || t('driver.vendorPrefs.noPhone', 'No phone')} • {t('driver.vendorPrefs.rating', 'Rating')} {Number(preferredVendor.rating || 0).toFixed(1)}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  preferredVendor.has_own_driver
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {preferredVendor.has_own_driver ? t('driver.vendorPrefs.hasDriver', 'Has a preferred driver') : t('driver.vendorPrefs.seekingDriver', 'Seeking a driver')}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">{t('driver.vendorPrefs.noLinkedVendor', 'No vendor is currently linked to this account.')}</p>
          )}
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? t('driver.vendorPrefs.saving', 'Saving...') : t('driver.vendorPrefs.saveAndContinue', 'Save & Continue')}
        </button>
        <button type="button" onClick={() => navigate('/driver/dashboard')} className="btn-outline">
          {t('driver.vendorPrefs.backToDashboard', 'Back to Dashboard')}
        </button>
      </div>
    </div>
  )
}

export default VendorPreferenceSetup