import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner } from '@/components/ui'
import { supabase } from '@/services/supabase'
import {
  MapPinIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  HomeIcon,
  BuildingOfficeIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { useTranslation } from 'react-i18next'

const ADDRESS_TYPES = (t) => [
  { id: 'home', label: t('buyerAddresses.addressTypes.home', 'Home'), icon: HomeIcon },
  { id: 'work', label: t('buyerAddresses.addressTypes.work', 'Work'), icon: BuildingOfficeIcon },
  { id: 'other', label: t('buyerAddresses.addressTypes.other', 'Other'), icon: MapPinIcon },
]

const BuyerAddresses = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [formData, setFormData] = useState({
    label: '',
    type: 'home',
    address: '',
    city: '',
    region: '',
    postal_code: '',
    country: 'Morocco',
    latitude: null,
    longitude: null,
    is_default: false,
    delivery_instructions: '',
  })

  const loadAddresses = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setAddresses(data || [])
    } catch (error) {
      logger.error('Error loading addresses:', error)
      toast.error(t('buyerAddresses.notifications.loadFailed', 'Failed to load addresses'))
    } finally {
      setLoading(false)
    }
  }, [t, user.id])

  useEffect(() => {
    loadAddresses()
  }, [loadAddresses])

  const resetForm = () => {
    setFormData({
      label: '',
      type: 'home',
      address: '',
      city: '',
      region: '',
      postal_code: '',
      country: 'Morocco',
      latitude: null,
      longitude: null,
      is_default: false,
      delivery_instructions: '',
    })
    setShowForm(false)
    setEditingId(null)
  }

  const handleEdit = (addr) => {
    setFormData({
      label: addr.label || '',
      type: addr.type || 'home',
      address: addr.address || '',
      city: addr.city || '',
      region: addr.region || '',
      postal_code: addr.postal_code || '',
      country: addr.country || 'Morocco',
      latitude: addr.latitude || null,
      longitude: addr.longitude || null,
      is_default: addr.is_default || false,
      delivery_instructions: addr.delivery_instructions || '',
    })
    setEditingId(addr.id)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.address.trim() || !formData.city.trim()) {
      toast.error(t('buyerAddresses.notifications.fillRequired', 'Please fill in address and city'))
      return
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('addresses')
          .update(formData)
          .eq('id', editingId)
          .eq('user_id', user.id)

        if (error) throw error
        toast.success(t('buyerAddresses.notifications.updated', 'Address updated successfully'))
      } else {
        const { error } = await supabase
          .from('addresses')
          .insert({ ...formData, user_id: user.id })

        if (error) throw error
        toast.success(t('buyerAddresses.notifications.added', 'Address added successfully'))
      }

      resetForm()
      await loadAddresses()
    } catch (error) {
      logger.error('Error saving address:', error)
      toast.error(t('buyerAddresses.notifications.saveFailed', 'Failed to save address'))
    }
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      toast.success(t('buyerAddresses.notifications.deleted', 'Address deleted'))
      setAddresses(prev => prev.filter(a => a.id !== id))
    } catch (error) {
      logger.error('Error deleting address:', error)
      toast.error(t('buyerAddresses.notifications.deleteFailed', 'Failed to delete address'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleSetDefault = async (id) => {
    try {
      // Unset all defaults first
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('user_id', user.id)

      // Set this one as default
      const { error } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
      toast.success(t('buyerAddresses.notifications.defaultUpdated', 'Default address updated'))
      await loadAddresses()
    } catch (error) {
      logger.error('Error setting default address:', error)
      toast.error(t('buyerAddresses.notifications.defaultFailed', 'Failed to update default address'))
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/buyer/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t('buyerAddresses.backToDashboard', 'Back to dashboard')}
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('buyerAddresses.title', 'My Addresses')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('buyerAddresses.subtitle', '{{count}} address(es) saved', { count: addresses.length })}
            </p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          {t('buyerAddresses.addAddress', 'Add Address')}
        </button>
      </div>

      {/* Address Form Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label={t('common.close', 'Close')}
            className="absolute inset-0"
            onClick={resetForm}
          />
          <div
            className="relative z-10 bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? t('buyerAddresses.form.editTitle', 'Edit Address') : t('buyerAddresses.form.addTitle', 'Add New Address')}
              </h2>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded-lg" aria-label="Close">
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Address Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('buyerAddresses.form.type', 'Address Type')}</label>
                <div className="flex gap-3">
                  {ADDRESS_TYPES(t).map(type => {
                    const Icon = type.icon
                    const isSelected = formData.type === type.id
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: type.id }))}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                          isSelected
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{type.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('buyerAddresses.form.label', 'Label (optional)')}</label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder={t('buyerAddresses.form.labelPlaceholder', "e.g., Mom's house")}
                  className="input"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('buyerAddresses.form.street', 'Street Address')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder={t('buyerAddresses.form.streetPlaceholder', 'Street name, building number')}
                  className="input"
                  required
                />
              </div>

              {/* City & Region */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('buyerAddresses.form.city', 'City')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder={t('buyerAddresses.form.cityPlaceholder', 'Casablanca')}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('buyerAddresses.form.region', 'Region')}</label>
                  <input
                    type="text"
                    value={formData.region}
                    onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                    placeholder={t('buyerAddresses.form.regionPlaceholder', 'Grand Casablanca')}
                    className="input"
                  />
                </div>
              </div>

              {/* Postal Code & Country */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('buyerAddresses.form.postalCode', 'Postal Code')}</label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                    placeholder={t('buyerAddresses.form.postalCodePlaceholder', '20000')}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('buyerAddresses.form.country', 'Country')}</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>

              {/* Delivery Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('buyerAddresses.form.deliveryInstructions', 'Delivery Instructions (optional)')}</label>
                <textarea
                  value={formData.delivery_instructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_instructions: e.target.value }))}
                  rows={2}
                  placeholder={t('buyerAddresses.form.deliveryInstructionsPlaceholder', 'e.g., Ring the doorbell, 3rd floor')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Default Address */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">{t('buyerAddresses.form.setDefault', 'Set as default address')}</span>
              </label>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="btn-outline flex-1">
                  {t('buyerAddresses.form.cancel', 'Cancel')}
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingId ? t('buyerAddresses.form.update', 'Update Address') : t('buyerAddresses.form.save', 'Save Address')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Addresses List */}
      {addresses.length === 0 ? (
        <Card className="p-12 text-center">
          <MapPinIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('buyerAddresses.emptyTitle', 'No addresses saved')}</h3>
          <p className="text-gray-500 mb-6">{t('buyerAddresses.emptyDesc', 'Add your first delivery address for faster checkout')}</p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            {t('buyerAddresses.addAddress', 'Add Address')}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => {
            const typeInfo = ADDRESS_TYPES(t).find(type => type.id === addr.type) || ADDRESS_TYPES(t)[2]
            const TypeIcon = typeInfo.icon

            return (
              <Card
                key={addr.id}
                className={`p-5 border-2 transition-all hover:shadow-md ${
                  addr.is_default ? 'border-green-300 bg-green-50/30' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      addr.is_default ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {addr.label || typeInfo.label}
                      </h3>
                      {addr.is_default && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckIcon className="w-3 h-3" />
                          {t('buyerAddresses.default', 'Default')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-1">{addr.address}</p>
                <p className="text-sm text-gray-500">
                  {addr.city}{addr.region ? `, ${addr.region}` : ''}{addr.postal_code ? ` ${addr.postal_code}` : ''}
                </p>
                {addr.delivery_instructions && (
                  <p className="text-xs text-gray-400 mt-2 italic">📝 {addr.delivery_instructions}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                  {!addr.is_default && (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      className="text-xs text-green-600 hover:underline font-medium"
                    >
                      {t('buyerAddresses.setDefault', 'Set as Default')}
                    </button>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => handleEdit(addr)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    aria-label="Edit address"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    disabled={deletingId === addr.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    aria-label="Delete address"
                  >
                    {deletingId === addr.id ? (
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <TrashIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default BuyerAddresses
