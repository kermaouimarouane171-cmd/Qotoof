/**
 * صفحة العقد الرقمي للبائع (إلزامية قبل البيع).
 * لا يمكن متابعة لوحة البائع قبل التوقيع وحفظ بيانات العقد.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ClockIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  PencilSquareIcon,
  PhoneIcon,
  ShieldCheckIcon,
  TruckIcon,
  UserIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { Card, Input, StateSkeleton as Skeleton, ErrorState } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import { MOROCCAN_BANKS } from '@/constants/banks'
import { APP_CONFIG, getWhatsappUrl } from '@/config/appConfig'
import toast from 'react-hot-toast'
import { hasValidPayPalEmail } from '@/utils/paypalEligibility'
import { completeOnboarding } from '@/services/onboardingService'

const COMMISSION_PERCENT = (APP_CONFIG.commissionRate * 100).toFixed(0)

const CONTRACT_SUMMARY_ITEMS = [
  {
    key: 'commission',
    title: 'العمولة',
    description: `تقتطع المنصة عمولة بنسبة ${COMMISSION_PERCENT}% من قيمة كل طلب مكتمل داخل التطبيق.`,
    Icon: DocumentTextIcon,
  },
  {
    key: 'payment',
    title: 'موعد الدفع',
    description: 'يجب سداد العمولة خلال 7 أيام من نهاية كل شهر ميلادي.',
    Icon: ClockIcon,
  },
  {
    key: 'freeze',
    title: 'عواقب عدم الدفع',
    description: 'في حال عدم السداد خلال المهلة، يحق للتطبيق تجميد الحساب حتى إتمام الدفع.',
    Icon: ShieldCheckIcon,
  },
  {
    key: 'transfer',
    title: 'مدة التحويل',
    description: 'يتم تحويل المستحقات إلى حساب PayPal خلال 7 أيام عمل بعد تأكيد الطلبات.',
    Icon: ClockIcon,
  },
  {
    key: 'shipping',
    title: 'شروط التوصيل',
    description: 'يلتزم البائع بشحن الطلبات في المدة المحددة وتوفير معلومات التتبع عند الحاجة.',
    Icon: TruckIcon,
  },
]

const buildFullContractText = (fullName) => `أنا ${fullName || '[اسم البائع]'}، أوافق على الشروط التالية:

1. عمولة التطبيق: ${COMMISSION_PERCENT}% من إجمالي مبيعاتي المؤكدة داخل التطبيق خلال كل شهر ميلادي.

2. موعد الدفع: يجب سداد العمولة خلال 7 أيام من نهاية كل شهر.

3. عواقب عدم الدفع: في حال عدم السداد خلال المهلة المحددة، يحق للتطبيق تجميد حسابي فوراً حتى إتمام الدفع.

4. الديون المتراكمة: حذف الحساب لا يلغي العمولات المستحقة. تظل البيانات محفوظة لدى التطبيق لأغراض التحصيل القانوني.

5. المعاملات المحسوبة: تُحسب العمولة فقط على المعاملات التي تم تأكيدها داخل التطبيق بضغط زر «تم استلام الدفع».

6. قنوات تحويل المستحقات: أوافق أن جميع تحويلات مستحقاتي من المنصة تتم عبر PayPal فقط، وأتعهد بالحفاظ على بريد PayPal صحيح ومفعل.

7. إعادة ضبط شهرية: يبدأ عداد العمولة من الصفر في أول كل شهر ميلادي جديد بعد دفع الضريبة السابقة.`

const DigitalContractLoading = () => (
  <div
    className="max-w-lg mx-auto w-full min-w-0 overflow-x-hidden space-y-4 pb-20"
    data-testid="digital-contract-loading"
  >
    <Skeleton className="h-10 w-40 mx-auto" />
    <Skeleton.Card />
    <Skeleton.Card />
    <Skeleton.Card />
    <Skeleton className="h-12 w-full rounded-2xl" />
  </div>
)

const InfoRow = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
      <Icon className="w-5 h-5 text-green-600" aria-hidden="true" />
    </div>
    <div className="flex-1 min-w-0 text-right">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="text-sm font-medium text-gray-900 break-words">{children}</div>
    </div>
  </div>
)

const DigitalContract = () => {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showFullContract, setShowFullContract] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreeData, setAgreeData] = useState(false)
  const [agreePaypal, setAgreePaypal] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    cin: '',
    phone: '',
    email: '',
    paypal_email: '',
    bank_name: '',
    bank_iban: '',
    bank_account_holder: '',
  })

  const storeName = profile?.store_name?.trim() || 'متجري على قوتوف'

  const canSubmit = useMemo(() => {
    return (
      form.full_name.trim() &&
      form.cin.trim() &&
      form.phone.trim() &&
      form.email.trim() &&
      hasValidPayPalEmail(form.paypal_email) &&
      form.bank_name.trim() &&
      form.bank_iban.trim() &&
      form.bank_account_holder.trim() &&
      agreeTerms &&
      agreeData &&
      agreePaypal
    )
  }, [form, agreeTerms, agreeData, agreePaypal])

  const loadContractData = useCallback(async () => {
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

    setLoading(true)
    setLoadError(null)

    try {
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
        paypal_email: profile?.paypal_email || profile?.email || user?.email || '',
        bank_account_holder: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
      }))
    } catch (error) {
      setLoadError(error)
    } finally {
      setLoading(false)
    }
  }, [user, profile, navigate])

  useEffect(() => {
    loadContractData()
  }, [loadContractData])

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

  const handleCancel = () => {
    const confirmed = window.confirm('هل تريد إلغاء التوقيع والخروج من الحساب؟')
    if (!confirmed) return
    signOut?.()
    navigate('/login', { replace: true })
  }

  const handleSubmit = async () => {
    if (!user || !canSubmit) return

    const confirmed = window.confirm('هل أنت متأكد من توقيع العقد الرقمي؟ لا يمكن التراجع بعد التوقيع.')
    if (!confirmed) return

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

      await completeOnboarding(user.id)

      useAuthStore.setState((state) => ({
        ...state,
        profile: {
          ...state.profile,
          agreement_accepted: true,
          agreement_accepted_at: nowIso,
          is_active: true,
          onboarding_completed: true,
          onboarding_step: 100,
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
    return <DigitalContractLoading />
  }

  if (loadError) {
    return (
      <div className="max-w-lg mx-auto w-full min-w-0 overflow-x-hidden pb-20" data-testid="digital-contract-page">
        <ErrorState
          title="تعذر تحميل العقد"
          description={loadError.message || 'حدث خطأ أثناء جلب بيانات العقد. حاول مرة أخرى.'}
          onRetry={loadContractData}
          retryLabel="إعادة المحاولة"
          className="mt-4"
        />
      </div>
    )
  }

  return (
    <div
      className="max-w-lg mx-auto w-full min-w-0 overflow-x-hidden space-y-4 pb-20"
      data-testid="digital-contract-page"
      dir="rtl"
    >
      <header className="text-center space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 rounded-xl text-gray-600 hover:bg-gray-100"
            aria-label="رجوع"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <span className="w-9" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-gray-900" data-testid="digital-contract-title">
          تفعيل حساب البائع
        </h1>
        <div className="flex items-center justify-center gap-2" role="list" aria-label="خطوات إعداد المتجر">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">١</span>
            معلوماتك
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-400 text-white text-[10px] font-bold">٢</span>
            بيانات البنك
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-400 text-white text-[10px] font-bold">٣</span>
            الموافقات
          </span>
        </div>
      </header>

      <Card className="p-4 bg-green-50 border-green-200 rounded-2xl">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-bold text-gray-900">لماذا هذه الخطوة مطلوبة؟</p>
            <p className="text-sm text-gray-600 mt-1 leading-6">
              هذه الخطوة إلزامية لتفعيل حسابك كبائع قبل الوصول إلى لوحة البائع والمنتجات والطلبات.
            </p>
            <p className="text-sm text-gray-600 mt-2 leading-6">
              توقيع العقد الرقمي يحمي حقوقك ويضمن تجربة آمنة وموثوقة لك ولمتسوقيك.
            </p>
            <p className="text-sm text-gray-600 mt-2 leading-6">
              بعد التوقيع مباشرةً ستتمكن من إضافة المنتجات واستقبال الطلبات وتلقي مستحقاتك.
            </p>
            <p className="text-sm text-gray-600 mt-2 leading-6">
              البيانات البنكية وبريد PayPal مطلوبة لتلقي مستحقاتك المالية من المبيعات.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">معلومات البائع</h2>
        </div>

        <InfoRow icon={BuildingStorefrontIcon} label="اسم المتجر">
          {storeName}
        </InfoRow>

        <InfoRow icon={UserIcon} label="الاسم الكامل">
          <Input
            aria-label="الاسم الكامل"
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
            required
            className="!mt-0"
          />
        </InfoRow>

        <InfoRow icon={EnvelopeIcon} label="البريد الإلكتروني">
          <Input
            aria-label="البريد الإلكتروني"
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
            className="!mt-0"
          />
        </InfoRow>

        <InfoRow icon={PhoneIcon} label="رقم الهاتف">
          <Input
            aria-label="رقم الهاتف"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            required
            className="!mt-0"
          />
        </InfoRow>

        <InfoRow icon={EnvelopeIcon} label="بريد PayPal (إلزامي)">
          <Input
            aria-label="بريد PayPal"
            type="email"
            value={form.paypal_email}
            onChange={(e) => setForm((p) => ({ ...p, paypal_email: e.target.value }))}
            required
            className="!mt-0"
          />
          <p className="text-xs text-amber-700 mt-2 flex items-start gap-1">
            <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>سيتم استخدامه لاستلام مستحقاتك المالية</span>
          </p>
        </InfoRow>

        {form.paypal_email && !hasValidPayPalEmail(form.paypal_email) && (
          <p className="text-sm text-red-600 mt-1">يرجى إدخال بريد PayPal إلكتروني صالح قبل التوقيع.</p>
        )}
      </Card>

      <Card className="p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
            <BanknotesIcon className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">بيانات الهوية والبنك</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3 leading-5">
          هذه البيانات مطلوبة لتفعيل حسابك واستلام مستحقاتك المالية من المبيعات.
        </p>

        <InfoRow icon={DocumentTextIcon} label="رقم بطاقة التعريف الوطنية (CIN)">
          <Input
            aria-label="رقم بطاقة التعريف الوطنية"
            value={form.cin}
            onChange={(e) => setForm((p) => ({ ...p, cin: e.target.value }))}
            required
            className="!mt-0"
          />
        </InfoRow>

        <InfoRow icon={BanknotesIcon} label="اسم البنك">
          <div>
            <select
              className="input w-full"
              value={form.bank_name}
              onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
              required
              aria-label="اسم البنك"
            >
              <option value="">اختر البنك</option>
              {MOROCCAN_BANKS.map((bank) => (
                <option key={bank.code} value={bank.name}>{bank.name}</option>
              ))}
            </select>
          </div>
        </InfoRow>

        <InfoRow icon={BanknotesIcon} label="رقم IBAN">
          <Input
            aria-label="رقم IBAN"
            value={form.bank_iban}
            onChange={(e) => setForm((p) => ({ ...p, bank_iban: e.target.value }))}
            required
            className="!mt-0"
          />
        </InfoRow>

        <InfoRow icon={UserIcon} label="اسم صاحب الحساب">
          <Input
            aria-label="اسم صاحب الحساب"
            value={form.bank_account_holder}
            onChange={(e) => setForm((p) => ({ ...p, bank_account_holder: e.target.value }))}
            required
            className="!mt-0"
          />
        </InfoRow>
      </Card>

      <Card className="p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
            <DocumentTextIcon className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">أهم بنود العقد</h2>
        </div>

        <ul className="space-y-3">
          {CONTRACT_SUMMARY_ITEMS.map(({ key, title, description, Icon }) => (
            <li key={key} className="flex items-start gap-3 text-sm">
              <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-green-600" aria-hidden="true" />
              </div>
              <div className="min-w-0 text-right">
                <p className="font-semibold text-gray-900">{title}</p>
                <p className="text-gray-600 leading-6 mt-0.5">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <button
        type="button"
        onClick={() => setShowFullContract((open) => !open)}
        className="w-full flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50"
        aria-expanded={showFullContract}
        data-testid="toggle-full-contract"
      >
        <ChevronLeftIcon
          className={`w-5 h-5 text-green-600 transition-transform ${showFullContract ? '-rotate-90' : ''}`}
          aria-hidden="true"
        />
        <span className="flex items-center gap-2">
          <DocumentTextIcon className="w-5 h-5 text-green-600" />
          عرض العقد الكامل
        </span>
      </button>

      {showFullContract && (
        <Card className="p-4 rounded-2xl border border-gray-200 space-y-4" data-testid="full-contract-panel">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 leading-8 text-gray-800 text-sm whitespace-pre-line">
            {buildFullContractText(form.full_name)}
          </div>
        </Card>
      )}

      <Card className="p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
            <ShieldCheckIcon className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">الموافقات</h2>
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeData}
              onChange={(e) => setAgreeData(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-gray-800">أقر بأن المعلومات المدخلة صحيحة</span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-gray-800">
              أوافق على{' '}
              <a href="/terms" className="text-green-600 font-semibold hover:underline">
                شروط وأحكام المنصة
              </a>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreePaypal}
              onChange={(e) => setAgreePaypal(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-gray-800">أوافق على استخدام بريد PayPal للتحويلات</span>
          </label>
        </div>
      </Card>

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-2">
        <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-amber-900 leading-6">
          بعد التوقيع، سيتم تفعيل متجرك بعد مراجعة الإدارة عند الحاجة.
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          data-testid="sign-contract-button"
        >
          {submitting ? (
            <>
              <ArrowPathIcon className="w-5 h-5 animate-spin" aria-hidden="true" />
              جاري التوقيع...
            </>
          ) : (
            <>
              <PencilSquareIcon className="w-5 h-5" aria-hidden="true" />
              توقيع العقد
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleCancel}
          className="w-full rounded-2xl border-2 border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
          data-testid="cancel-contract-button"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" aria-hidden="true" />
          تسجيل الخروج والمتابعة لاحقًا
        </button>
      </div>

      <a
        href={getWhatsappUrl('مرحباً، أحتاج مساعدة بخصوص العقد الرقمي للبائع')}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 text-sm text-green-700 font-medium py-2"
      >
        <ChatBubbleLeftRightIcon className="w-5 h-5" aria-hidden="true" />
        تحتاج مساعدة؟ تواصل مع الدعم
      </a>
    </div>
  )
}

export default DigitalContract
