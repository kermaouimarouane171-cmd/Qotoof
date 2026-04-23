import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  TruckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

const DriverPreferenceSetup = () => {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const [choice, setChoice] = useState(
    typeof profile?.has_own_driver === 'boolean' ? profile.has_own_driver : null
  )
  const [saving, setSaving] = useState(false)
  const [loadingPartner, setLoadingPartner] = useState(false)
  const [preferredDriver, setPreferredDriver] = useState(null)

  useEffect(() => {
    setChoice(typeof profile?.has_own_driver === 'boolean' ? profile.has_own_driver : null)
  }, [profile?.has_own_driver])

  useEffect(() => {
    const loadPreferredDriver = async () => {
      if (!profile?.preferred_driver_id) {
        setPreferredDriver(null)
        return
      }

      setLoadingPartner(true)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone, city, vehicle_type, vehicle_plate, rating, is_available_for_delivery')
          .eq('id', profile.preferred_driver_id)
          .maybeSingle()

        if (error) throw error
        setPreferredDriver(data)
      } catch {
        setPreferredDriver(null)
      } finally {
        setLoadingPartner(false)
      }
    }

    loadPreferredDriver()
  }, [profile?.preferred_driver_id])

  const handleSave = async () => {
    if (choice === null) {
      toast.error('يرجى اختيار ما إذا كنت تريد سائقاً مفضلاً أم لا')
      return
    }

    if (!profile?.id) {
      toast.error('تعذر تحديد حساب البائع الحالي')
      return
    }

    const updates = {
      has_own_driver: choice,
      driver_search_done: true,
      partnership_status: choice
        ? profile?.preferred_driver_id
          ? 'accepted'
          : 'searching'
        : 'open',
    }

    if (!choice) {
      updates.preferred_driver_id = null
      updates.preferred_driver_linked_at = null
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)

      if (error) throw error

      if (!choice && profile.preferred_driver_id) {
        const { error: unlinkError } = await supabase
          .from('profiles')
          .update({
            preferred_vendor_id: null,
            has_preferred_vendor: false,
            partnership_status: 'open',
            preferred_vendor_linked_at: null,
          })
          .eq('id', profile.preferred_driver_id)

        if (unlinkError) throw unlinkError
      }

      useAuthStore.setState((state) => ({
        profile: state.profile ? { ...state.profile, ...updates } : state.profile,
      }))

      toast.success(
        choice
          ? 'تم حفظ تفضيلك. يمكنك الآن البحث عن سائق مناسب أو مراجعة الطلبات.'
          : 'تم حفظ اختيارك. سيبقى الطلب متاحاً للتعيين اليدوي أو التوزيع العام.'
      )

      navigate(choice ? '/vendor/find-driver' : '/vendor/dashboard')
    } catch (error) {
      toast.error(error.message || 'تعذر حفظ تفضيلات السائق')
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
        <h1 className="text-2xl font-bold text-gray-900">إعداد السائق المفضل</h1>
        <p className="text-sm text-gray-500 mt-2 leading-6">
          اختر ما إذا كنت تريد ربط متجرك بسائق مفضل ثابت أو تفضّل إبقاء التوصيل متاحاً للتعيين حسب كل طلب.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setChoice(true)}
          className={`rounded-2xl border p-5 text-right transition-all ${
            choice === true
              ? 'border-green-500 bg-green-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-green-300'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
              <TruckIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">نعم، أريد سائقاً مفضلاً</h2>
              <p className="text-xs text-gray-500">مناسب للطلبات المتكررة والشحنات المستمرة.</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-6">
            سيتم إرسال طلبات شراكة إلى السائقين، وعند القبول سيتم تعيين السائق المفضل تلقائياً في دورة الطلب.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setChoice(false)}
          className={`rounded-2xl border p-5 text-right transition-all ${
            choice === false
              ? 'border-blue-500 bg-blue-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-blue-300'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <UserGroupIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">لا، أريد سائقين متاحين حسب الطلب</h2>
              <p className="text-xs text-gray-500">مرن أكثر عندما تختلف المدن أو الأحجام.</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 leading-6">
            لن يتم تثبيت سائق واحد، وسيظل التعيين عبر السائقين المتاحين أو التوزيع اليدوي من لوحة الطلبات.
          </p>
        </button>
      </div>

      <Card className="p-5 bg-amber-50 border border-amber-200">
        <p className="text-sm text-amber-900 leading-6">
          إذا غيّرت هذا الاختيار لاحقاً فسيتم تطبيقه على الطلبات الجديدة فقط. الطلبات النشطة الحالية ستبقى على حالها حتى تكتمل.
        </p>
      </Card>

      {(loadingPartner || preferredDriver) && (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">السائق المرتبط حالياً</h3>
          </div>

          {loadingPartner ? (
            <div className="py-6 flex justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : preferredDriver ? (
            <div className="rounded-2xl border border-gray-200 p-4 bg-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">
                    {preferredDriver.first_name} {preferredDriver.last_name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {preferredDriver.city || 'مدينة غير محددة'}
                    {preferredDriver.vehicle_type ? ` • ${preferredDriver.vehicle_type}` : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {preferredDriver.vehicle_plate || 'بدون لوحة مسجلة'}
                    {preferredDriver.phone ? ` • ${preferredDriver.phone}` : ''}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  preferredDriver.is_available_for_delivery
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {preferredDriver.is_available_for_delivery ? 'متاح الآن' : 'غير متاح الآن'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">لا يوجد سائق مرتبط حالياً بهذا المتجر.</p>
          )}
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'جارٍ الحفظ...' : 'حفظ ومتابعة'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/vendor/dashboard')}
          className="btn-outline"
        >
          العودة للوحة التحكم
        </button>
      </div>
    </div>
  )
}

export default DriverPreferenceSetup