import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Button, Input, Card, Map, CINInput, TrustBadges } from '@/components/ui'
import { useMapCenter } from '@/hooks/useMapCenter'
import ErrorBoundary from '@/components/ErrorBoundary'
import {
  UserCircleIcon, ShieldCheckIcon, CheckCircleIcon, ClockIcon, CameraIcon,
  MapPinIcon, ShoppingBagIcon, HeartIcon, StarIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { formatCIN, maskCIN, validateCIN } from '@/utils/cinValidation'
import { logger } from '@/utils/logger'
import { profileFormSchema } from '@/lib/validationSchemas'

const validateField = (name, value, state) => {
  const parsed = profileFormSchema.safeParse({ ...state, [name]: value })
  if (parsed.success) return ''
  return parsed.error.issues.find((i) => i.path?.[0] === name)?.message || ''
}

const ProfilePage = () => {
  const { t } = useTranslation()
  const { profile, updateProfile, user } = useAuthStore()
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '', lastName: profile?.last_name || '',
    email: profile?.email || '', phone: profile?.phone || '', cin: profile?.cin_number || profile?.cin || '',
    storeName: profile?.store_name || '', storeDescription: profile?.store_description || '',
    address: profile?.address || '', city: profile?.city || '', country: profile?.country || 'Morocco',
    latitude: profile?.latitude || null, longitude: profile?.longitude || null,
  })
  const [errors, setErrors] = useState({})
  const profileMapCenter = useMapCenter({
    lat: formData.latitude,
    lng: formData.longitude,
    city: formData.city,
  })
  const [cinError, setCINError] = useState('')
  const [showFullCIN, setShowFullCIN] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null)
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')
  const [stats, setStats] = useState({ orders: 0, favorites: 0, loyaltyPoints: 0 })

  useEffect(() => {
    const orig = { firstName: profile?.first_name || '', lastName: profile?.last_name || '', phone: profile?.phone || '', cin: profile?.cin_number || profile?.cin || '', storeName: profile?.store_name || '', storeDescription: profile?.store_description || '', address: profile?.address || '', city: profile?.city || '', country: profile?.country || 'Morocco' }
    setHasChanges(JSON.stringify(formData) !== JSON.stringify(orig))
  }, [formData, profile])

  useEffect(() => { setAvatarLoadFailed(false) }, [avatarUrl])

  useEffect(() => {
    if (!hasChanges || submitting) return
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [hasChanges, submitting])

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id),
      supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]).then(([o, f]) => setStats({ orders: o.count || 0, favorites: f.count || 0, loyaltyPoints: profile?.loyalty_points || 0 })).catch(() => {})
  }, [user?.id, profile?.loyalty_points])

  const handleFieldChange = (name, value) => {
    setFormData({ ...formData, [name]: value })
    setErrors({ ...errors, [name]: validateField(name, value, formData) })
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { toast.error(t('profile.errors.invalidImageType', 'Invalid image type')); return }
    if (file.size > 2 * 1024 * 1024) { toast.error(t('profile.errors.imageTooLarge', 'Image too large')); return }
    setAvatarUploading(true)
    try {
      const fp = `profile-photos/${user.id}-${Date.now()}.${file.name.split('.').pop()}`
      const { error: ue } = await supabase.storage.from('profile-photos').upload(fp, file, { cacheControl: '3600', upsert: true })
      if (ue) throw ue
      const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(fp)
      setAvatarUrl(publicUrl)
      await updateProfile({ avatar_url: publicUrl })
      toast.success(t('profile.avatarUpdated', 'Photo updated!'))
    } catch (err) { logger.error('Avatar upload:', err); toast.error(t('profile.errors.avatarUploadFailed', 'Upload failed')) }
    finally { setAvatarUploading(false) }
  }

  const persistProfile = async (updates) => {
    setSubmitting(true)
    try {
      const r = await updateProfile(updates)
      if (r.success) { toast.success(t('profile.updated', 'Profile updated')); setHasChanges(false) }
      else toast.error(r.error || t('profile.errors.updateFailed', 'Update failed'))
    } catch (err) { logger.error('Profile update:', err); toast.error(t('profile.errors.updateFailed', 'Update failed')) }
    finally { setSubmitting(false) }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ne = {}
    const parsed = profileFormSchema.safeParse(formData)
    if (!parsed.success) parsed.error.issues.forEach((i) => { const f = i.path?.[0]; if (typeof f === 'string') ne[f] = i.message })
    if (formData.cin && formData.cin !== profile?.cin_number) { const cr = validateCIN(formData.cin); if (!cr.valid) { setCINError(cr.error); ne.cin = cr.error } }
    if (Object.keys(ne).length > 0) { setErrors(ne); toast.error(t('profile.errors.fixErrors', 'Fix errors')); return }
    await persistProfile({
      first_name: formData.firstName, last_name: formData.lastName, phone: formData.phone,
      cin: formData.cin || null, store_name: formData.storeName, store_description: formData.storeDescription,
      address: formData.address, city: formData.city, country: formData.country,
      latitude: formData.latitude, longitude: formData.longitude,
    })
  }

  const isVendor = profile?.role === 'vendor'
  const isBuyer = profile?.role === 'buyer'
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || t('profile.guest', 'Guest')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 mb-6 shadow-xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white" />
          <div className="absolute top-20 -left-12 w-32 h-32 rounded-full bg-white" />
        </div>
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-white/20 backdrop-blur ring-4 ring-white/30 flex items-center justify-center">
              {avatarUrl && !avatarLoadFailed ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" onError={() => setAvatarLoadFailed(true)} /> : <UserCircleIcon className="w-16 h-16 text-white/80" />}
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={avatarUploading} className="absolute -bottom-1 -right-1 w-9 h-9 bg-white rounded-full flex items-center justify-center text-green-700 hover:bg-gray-100 disabled:opacity-50 transition-colors shadow-lg" aria-label={t('profile.uploadPhoto', 'Upload photo')}>
              {avatarUploading ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <CameraIcon className="w-4 h-4" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAvatarUpload} className="hidden" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">{fullName}</h1>
            <p className="text-green-100 text-sm mt-1">{profile?.email || '—'}</p>
            <div className="mt-3 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold text-white capitalize">{profile?.role || 'buyer'}</span>
              {profile?.is_verified && <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold text-white"><CheckCircleIcon className="w-3.5 h-3.5" /> {t('profile.verified', 'موثق')}</span>}
              {profile?.city && <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold text-white"><MapPinIcon className="w-3.5 h-3.5" /> {profile.city}</span>}
            </div>
          </div>
        </div>
        <div className="relative grid grid-cols-3 border-t border-white/20 bg-black/10 backdrop-blur-sm">
          {[{ to: '/buyer/orders', icon: ShoppingBagIcon, count: stats.orders, label: t('profile.quickLinks.orders', 'طلباتي') }, { to: '/favorites', icon: HeartIcon, count: stats.favorites, label: t('profile.quickLinks.favorites', 'المفضلة') }, { to: '/buyer/loyalty', icon: StarIcon, count: stats.loyaltyPoints, label: t('profile.quickLinks.loyalty', 'نقاط') }].map((s) => (
            <Link key={s.to} to={s.to} className="flex flex-col items-center py-3 px-2 hover:bg-white/10 transition-colors group">
              <s.icon className="w-5 h-5 text-white/80 group-hover:text-white" /><span className="text-lg font-bold text-white mt-1">{s.count}</span><span className="text-[10px] text-green-100">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[{ to: '/buyer/orders', icon: ShoppingBagIcon, label: t('profile.actions.orders', 'طلباتي'), color: 'bg-blue-50 text-blue-600' }, { to: '/favorites', icon: HeartIcon, label: t('profile.actions.favorites', 'المفضلة'), color: 'bg-red-50 text-red-600' }, { to: '/buyer/addresses', icon: MapPinIcon, label: t('profile.actions.addresses', 'العناوين'), color: 'bg-purple-50 text-purple-600' }, { to: '/buyer/security', icon: ShieldCheckIcon, label: t('profile.actions.security', 'الأمان'), color: 'bg-green-50 text-green-600' }].map((a) => (
          <Link key={a.to} to={a.to} className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-gray-100 hover:shadow-md transition-all group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.color}`}><a.icon className="w-5 h-5" /></div>
            <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
        <button onClick={() => setActiveTab('personal')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'personal' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('profile.tabs.personal', 'المعلومات الشخصية')}</button>
        {isVendor && <button onClick={() => setActiveTab('store')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'store' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('profile.tabs.store', 'معلومات المتجر')}</button>}
        {isBuyer && <button onClick={() => setActiveTab('delivery')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'delivery' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('profile.tabs.delivery', 'عنوان التوصيل')}</button>}
        <button onClick={() => setActiveTab('security')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'security' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>{t('profile.tabs.security', 'الأمان')}</button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {activeTab === 'personal' && (
          <Card className="p-6 mb-6">
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label={t('auth.firstName', 'First Name')} value={formData.firstName} onChange={(e) => handleFieldChange('firstName', e.target.value)} error={errors.firstName} required />
                <Input label={t('auth.lastName', 'Last Name')} value={formData.lastName} onChange={(e) => handleFieldChange('lastName', e.target.value)} error={errors.lastName} required />
              </div>
              <div>
                <Input label={t('auth.email', 'Email')} type="email" value={formData.email} disabled />
                <p className="text-xs text-gray-500 mt-1">{t('profile.emailChangeNote', 'To change email, go to')} <Link to="/buyer/settings" className="text-green-600 hover:underline">{t('profile.accountSettings', 'Settings')}</Link></p>
              </div>
              <Input label={t('auth.phone', 'Phone')} value={formData.phone} onChange={(e) => handleFieldChange('phone', e.target.value)} error={errors.phone} placeholder="+212 6XX-XXXXXX" />
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><ShieldCheckIcon className="w-5 h-5 text-green-600" /><h3 className="font-semibold text-green-800">{t('profile.cin.title', 'National ID (CIN)')}</h3></div>
                  {profile?.cin_number && <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${profile.cin_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{profile.cin_verified ? <span className="flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> {t('profile.cin.verified', 'Verified')}</span> : <span className="flex items-center gap-1"><ClockIcon className="w-3 h-3" /> {t('profile.cin.pending', 'Pending')}</span>}</span>}
                </div>
                {profile?.cin_number ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg tracking-wider text-gray-900">{showFullCIN ? formatCIN(profile.cin_number) : maskCIN(profile.cin_number)}</span>
                      <button type="button" onClick={() => setShowFullCIN(!showFullCIN)} className="text-xs text-green-600 hover:underline">{showFullCIN ? t('profile.cin.hide', 'Hide') : t('profile.cin.show', 'Show')}</button>
                    </div>
                    {!profile.cin_verified && <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg"><ClockIcon className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" /><div className="text-xs text-yellow-700"><p className="font-medium">{t('profile.cin.verifying', 'Verifying')}</p><p>{t('profile.cin.verifyingDesc', 'Usually takes 24-48 hours.')}</p></div></div>}
                  </div>
                ) : <CINInput value={formData.cin} onChange={(v) => { setFormData({ ...formData, cin: v }); setCINError(''); handleFieldChange('cin', v) }} error={cinError || errors.cin} showHelp />}
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'store' && isVendor && (
          <Card className="p-6 mb-6">
            <div className="space-y-4">
              <Input label={t('profile.storeName', 'Store Name')} value={formData.storeName} onChange={(e) => handleFieldChange('storeName', e.target.value)} error={errors.storeName} />
              <div>
                <label className="input-label">{t('profile.storeDescription', 'Store Description')}</label>
                <textarea value={formData.storeDescription} onChange={(e) => handleFieldChange('storeDescription', e.target.value)} className="input h-24 resize-none" maxLength={500} />
                <p className="text-xs text-gray-400 mt-1 text-right">{(formData.storeDescription || '').length}/500</p>
              </div>
              <Input label={t('profile.address', 'Address')} value={formData.address} onChange={(e) => handleFieldChange('address', e.target.value)} error={errors.address} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label={t('profile.city', 'City')} value={formData.city} onChange={(e) => handleFieldChange('city', e.target.value)} error={errors.city} />
                <Input label={t('profile.country', 'Country')} value={formData.country} onChange={(e) => handleFieldChange('country', e.target.value)} />
              </div>
              <div>
                <label className="input-label">{t('profile.storeLocation', 'Store Location')}</label>
                <p className="text-xs text-gray-500 mb-2">{t('profile.storeLocationHint', 'Click on map to set location')}</p>
                <Map center={profileMapCenter} zoom={12} markers={formData.latitude && formData.longitude ? [{ lat: formData.latitude, lng: formData.longitude, popup: formData.storeName || 'Store' }] : []} height="250px" onLocationSelect={(lat, lng) => setFormData({ ...formData, latitude: lat, longitude: lng })} />
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'delivery' && isBuyer && (
          <Card className="p-6 mb-6">
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl mb-4">
                <div className="flex items-start gap-3">
                  <MapPinIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold">{t('profile.delivery.infoTitle', 'عنوان التوصيل الرئيسي')}</p>
                    <p className="text-xs mt-1">{t('profile.delivery.infoDesc', 'هذا العنوان سيُعرض للبائع عند إنشاء الطلب ويُستخدم كعنوان افتراضي للشحن.')}</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="input-label">{t('profile.delivery.address', 'عنوان التوصيل')}</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  className="input h-24 resize-none"
                  maxLength={200}
                  placeholder={t('profile.delivery.addressPlaceholder', 'المدينة، الحي، الشارع، رقم الباب')}
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{(formData.address || '').length}/200</p>
                {errors.address && <p className="text-sm text-red-600 mt-1">{errors.address}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label={t('profile.delivery.city', 'المدينة')} value={formData.city} onChange={(e) => handleFieldChange('city', e.target.value)} error={errors.city} placeholder={t('profile.delivery.cityPlaceholder', 'اختر المدينة')} />
                <Input label={t('profile.delivery.country', 'البلد')} value={formData.country} onChange={(e) => handleFieldChange('country', e.target.value)} disabled />
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'security' && (
          <Card className="p-6 mb-6">
            <div className="space-y-3">
              <Link to="/buyer/security" className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
                <div className="flex items-center gap-3"><ShieldCheckIcon className="w-5 h-5 text-green-600" /><div><p className="text-sm font-medium text-gray-900">{t('profile.security.settings', 'إعدادات الأمان')}</p><p className="text-xs text-gray-500">{t('profile.security.settingsDesc', 'كلمة المرور، 2FA، الجلسات')}</p></div></div>
                <span className="text-gray-400">←</span>
              </Link>
              <Link to="/buyer/settings" className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100">
                <div className="flex items-center gap-3"><ClockIcon className="w-5 h-5 text-blue-600" /><div><p className="text-sm font-medium text-gray-900">{t('profile.security.privacy', 'الخصوصية والإشعارات')}</p><p className="text-xs text-gray-500">{t('profile.security.privacyDesc', 'تحكم في الإشعارات والبيانات')}</p></div></div>
                <span className="text-gray-400">←</span>
              </Link>
            </div>
          </Card>
        )}

        {/* Submit */}
        {(activeTab === 'personal' || (activeTab === 'store' && isVendor) || (activeTab === 'delivery' && isBuyer)) && (
          <>
            <Button type="submit" variant="primary" size="lg" isLoading={submitting} disabled={submitting || !hasChanges}>
              {submitting ? t('profile.updating', 'Updating...') : t('profile.updateProfile', 'Update Profile')}
            </Button>
            {hasChanges && !submitting && (
              <p className="text-sm text-amber-600 mt-2 flex items-center gap-1"><ClockIcon className="w-4 h-4" /> {t('profile.unsavedChanges', 'Unsaved changes')}</p>
            )}
          </>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <TrustBadges variant="compact" />
        </div>
      </form>
    </div>
  )
}

const ProfileWithErrorBoundary = () => (
  <ErrorBoundary componentName="ProfilePage">
    <ProfilePage />
  </ErrorBoundary>
)

export default ProfileWithErrorBoundary
