/**
 * صفحة العقد الرقمي للبائع (إلزامية قبل البيع).
 * لا يمكن متابعة لوحة البائع قبل التوقيع وحفظ بيانات العقد.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Input, LoadingSpinner } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import { MOROCCAN_BANKS } from '@/constants/banks'
import { APP_CONFIG } from '@/config/appConfig'
import toast from 'react-hot-toast'

const DigitalContract = () => {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeData, setAgreeData] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    cin: '',
    phone: '',
    email: '',
    bank_name: '',
    bank_iban: '',
    bank_account_holder: '',
  })

  const canSubmit = useMemo(() => {
    return (
      form.full_name.trim() &&
      form.cin.trim() &&
      form.phone.trim() &&
      form.email.trim() &&
      form.bank_name.trim() &&
      form.bank_iban.trim() &&
      form.bank_account_holder.trim() &&
      agreeTerms &&
      agreeData
    )
  }, [form, agreeTerms, agreeData])

  useEffect(() => {
    const load = async () => {
      if (!user) {
        navigate('/login')
        return
      }

      if (profile?.role !== 'vendor') {
        navigate('/unauthorized')
        return
      }

      if (profile?.agreement_accepted) {
        navigate('/vendor/dashboard', { replace: true })
        return
      }

      const { data: existingContracts, error: existingContractError } = await supabase
        .from('vendor_contracts')
        .select('id')
        .eq('vendor_id', user.id)
        .eq('is_active', true)
        .limit(1)

      if (existingContractError) {
        throw existingContractError
      }

      const existingContract = existingContracts?.[0] || null

      if (existingContract?.id) {
        useAuthStore.setState((state) => ({
          ...state,
          profile: {
            ...state.profile,
            agreement_accepted: true,
            agreement_accepted_at: new Date().toISOString(),
          },
        }))

        await supabase
          .from('profiles')
          .update({
            agreement_accepted: true,
            agreement_accepted_at: new Date().toISOString(),
          })
          .eq('id', user.id)

        toast.success('تم العثور على عقد سابق وتم تفعيل حسابك')
        navigate('/vendor/dashboard', { replace: true })
        return
      }

      setForm((prev) => ({
        ...prev,
        full_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
        phone: profile?.phone || '',
        email: profile?.email || user?.email || '',
        bank_account_holder: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
      }))

      setLoading(false)
    }

    load()
  }, [user, profile, navigate])

  const getIpAddress = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      if (!response.ok) return 'غير متاح'
      const data = await response.json()
      return data.ip || 'غير متاح'
    } catch {
      return 'غير متاح'
    }
  }

  const handleSubmit = async () => {
    if (!user || !canSubmit) return

    setSubmitting(true)
    try {
      const ip = await getIpAddress()
      const deviceFingerprint = `${navigator.platform} | ${navigator.userAgent}`
      const nowIso = new Date().toISOString()

      const { error: insertError } = await supabase
        .from('vendor_contracts')
        .insert({
          vendor_id: user.id,
          full_name: form.full_name.trim(),
          cin: form.cin.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          bank_name: form.bank_name,
          bank_iban: form.bank_iban.trim(),
          bank_account_holder: form.bank_account_holder.trim(),
          agreed_commission_rate: 0.03,
          agreed_payment_deadline: 7,
          agreed_account_freeze: true,
          agreed_debt_survives_deletion: true,
          ip_address: ip,
          device_fingerprint: deviceFingerprint,
          signed_at: nowIso,
          contract_version: 'v1.0',
          is_active: true,
        })

      if (insertError) throw insertError

      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({
          agreement_accepted: true,
          agreement_accepted_at: nowIso,
          is_active: true,
        })
        .eq('id', user.id)

      if (updateProfileError) throw updateProfileError

      useAuthStore.setState((state) => ({
        ...state,
        profile: {
          ...state.profile,
          agreement_accepted: true,
          agreement_accepted_at: nowIso,
          is_active: true,
        },
      }))

      toast.success('تم توقيع العقد بنجاح، يمكنك الآن البدء في البيع')
      navigate('/vendor/dashboard', { replace: true })
    } catch (error) {
      toast.error(`فشل حفظ العقد: ${error.message || 'حدث خطأ غير متوقع'}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">العقد الرقمي للبائع</h1>
          <p className="text-gray-600">هذه الخطوة إلزامية قبل استخدام لوحة البائع.</p>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">قسم 1 — معلومات البائع</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="الاسم الكامل" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} required />
            <Input label="رقم بطاقة الهوية (CIN)" value={form.cin} onChange={(e) => setForm((p) => ({ ...p, cin: e.target.value }))} required />
            <Input label="رقم الهاتف" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required />
            <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />

            <div>
              <label className="input-label">اسم البنك</label>
              <select
                className="input"
                value={form.bank_name}
                onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
                required
              >
                <option value="">اختر البنك</option>
                {MOROCCAN_BANKS.map((bank) => (
                  <option key={bank.code} value={bank.name}>{bank.name}</option>
                ))}
              </select>
            </div>

            <Input label="رقم IBAN" value={form.bank_iban} onChange={(e) => setForm((p) => ({ ...p, bank_iban: e.target.value }))} required />
            <Input label="اسم صاحب الحساب" value={form.bank_account_holder} onChange={(e) => setForm((p) => ({ ...p, bank_account_holder: e.target.value }))} required />
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">قسم 2 — بنود العقد</h2>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 leading-8 text-gray-800 text-sm sm:text-base whitespace-pre-line">
{`أنا ${form.full_name || '[اسم البائع]'}، أوافق على الشروط التالية:

1. عمولة التطبيق: ${(APP_CONFIG.commissionRate * 100).toFixed(0)}% من إجمالي مبيعاتي المؤكدة داخل التطبيق خلال كل شهر ميلادي.

2. موعد الدفع: يجب سداد العمولة خلال 7 أيام من نهاية كل شهر.

3. عواقب عدم الدفع: في حال عدم السداد خلال المهلة المحددة، يحق للتطبيق تجميد حسابي فوراً حتى إتمام الدفع.

4. الديون المتراكمة: حذف الحساب لا يلغي العمولات المستحقة. تظل البيانات محفوظة لدى التطبيق لأغراض التحصيل القانوني.

5. المعاملات المحسوبة: تُحسب العمولة فقط على المعاملات التي تم تأكيدها داخل التطبيق بضغط زر 'تم استلام الدفع'.

6. إعادة ضبط شهرية: يبدأ عداد العمولة من الصفر في أول كل شهر ميلادي جديد بعد دفع الضريبة السابقة.`}
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">قسم 3 — الموافقة</h2>

          <div className="space-y-3">
            <label className="flex items-start gap-3">
              <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-1" />
              <span className="text-gray-800">قرأت وأوافق على جميع البنود أعلاه</span>
            </label>

            <label className="flex items-start gap-3">
              <input type="checkbox" checked={agreeData} onChange={(e) => setAgreeData(e.target.checked)} className="mt-1" />
              <span className="text-gray-800">أقر بصحة البيانات التي أدخلتها</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="btn-primary mt-6 w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'جاري التوقيع...' : 'توقيع العقد والبدء في البيع'}
          </button>
        </Card>
      </div>
    </div>
  )
}

export default DigitalContract
