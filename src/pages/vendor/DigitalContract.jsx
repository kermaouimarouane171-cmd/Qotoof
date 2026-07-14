/**
 * صفحة العقد الرقمي للبائع (إلزامية قبل البيع).
 * لا يمكن متابعة لوحة البائع قبل التوقيع وحفظ بيانات العقد.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import vendorSubscriptionService from '@/services/vendorSubscriptionService'

const CONTRACT_SUMMARY_ITEMS = [
  {
    key: 'commission',
    title: 'العمولة',
    description: 'تقتطع المنصة عمولة بالنسبة المحددة وفقاً للاشتراك الذي يختاره البائع من قيمة كل طلب مكتمل داخل التطبيق.',
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
    description: 'يتم تحويل المستحقات إلى حسابك البنكي تلقائياً بعد تأكيد الطلبات.',
    Icon: ClockIcon,
  },
  {
    key: 'shipping',
    title: 'شروط التوصيل',
    description: 'يلتزم البائع بشحن الطلبات في المدة المحددة وتوفير معلومات التتبع عند الحاجة.',
    Icon: TruckIcon,
  },
]

const buildFullContractText = (fullName, t) =>
  t(
    'vendor.digitalContract.fullText',
    `أنا {{fullName}}، أوافق على الشروط التالية:

1. عمولة التطبيق: تُقتطع المنصة عمولة بالنسبة المحددة وفقاً للاشتراك الذي أختاره من إجمالي مبيعاتي المؤكدة داخل التطبيق خلال كل شهر ميلادي.

2. موعد الدفع: يجب سداد العمولة خلال 7 أيام من نهاية كل شهر.

3. عواقب عدم الدفع: في حال عدم السداد خلال المهلة المحددة، يحق للتطبيق تجميد حسابي فوراً حتى إتمام الدفع.

4. الديون المتراكمة: حذف الحساب لا يلغي العمولات المستحقة. تظل البيانات محفوظة لدى التطبيق لأغراض التحصيل القانوني.

5. المعاملات المحسوبة: تُحسب العمولة فقط على المعاملات التي تم تأكيدها داخل التطبيق بضغط زر «تم استلام الدفع».

6. قنوات تحويل المستحقات: أوافق أن جميع تحويلات مستحقاتي من المنصة تتم إلى حسابي البنكي المسجل في هذا العقد تلقائياً بعد تأكيد الطلبات.

7. إعادة ضبط شهرية: يبدأ عداد العمولة من الصفر في أول كل شهر ميلادي جديد بعد دفع الضريبة السابقة.`,
    {
      fullName: fullName || t('vendor.digitalContract.defaultName', '[اسم البائع]'),
    }
  )

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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuthStore()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showFullContract, setShowFullContract] = useState(false)
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

  const storeName = profile?.store_name?.trim() || t('vendor.digitalContract.defaultStoreName', 'متجري على قوتوف')

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

  const loadContractData = useCallback(async () => {
    if (!user) {
      navigate('/login')
      return
    }

    if (profile?.role !== 'vendor') {
      navigate('/unauthorized')
      return
    }

    if (profile?.agreement_accepted && profile?.onboarding_completed) {
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
        const nowIso = new Date().toISOString()

        // Start 14-day Pro trial if vendor doesn't have a paid plan yet
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('subscription_plan, trial_ends_at')
          .eq('id', user.id)
          .single()

        const needsTrial =
          !currentProfile?.subscription_plan ||
          currentProfile.subscription_plan === 'free' ||
          (currentProfile.trial_ends_at && new Date(currentProfile.trial_ends_at) < new Date())

        if (needsTrial) {
          try {
            await vendorSubscriptionService.startFreeTrial(user.id)
          } catch (trialError) {
            console.warn('[DigitalContract] Failed to start free trial:', trialError?.message)
          }
        }

        useAuthStore.setState((state) => ({
          ...state,
          profile: {
            ...state.profile,
            agreement_accepted: true,
            agreement_accepted_at: nowIso,
            onboarding_completed: true,
            onboarding_step: 100,
            ...(needsTrial
              ? {
                  subscription_plan: 'pro',
                  subscription_status: 'active',
                  subscription_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                  trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                }
              : {}),
          },
        }))

        await supabase
          .from('profiles')
          .update({
            agreement_accepted: true,
            agreement_accepted_at: nowIso,
            onboarding_completed: true,
            onboarding_step: 100,
          })
          .eq('id', user.id)

        toast.success(t('vendor.digitalContract.success.existingContractFound', 'تم العثور على عقد سابق وتم تفعيل حسابك'))
        if (needsTrial) {
          toast.success(t('vendor.subscription.trialStarted', 'تم تفعيل تجربتك المجانية لخطة الاحترافي لمدة 14 يوماً'))
        }
        navigate('/vendor/dashboard', { replace: true })
        return
      }

      setForm((prev) => ({
        ...prev,
        full_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
        cin: profile?.cin_number || profile?.cin || '',
        phone: profile?.phone || '',
        email: profile?.email || user?.email || '',
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
      if (!response.ok) return t('vendor.digitalContract.notAvailable', 'غير متاح')
      const data = await response.json()
      return data.ip || t('vendor.digitalContract.notAvailable', 'غير متاح')
    } catch {
      return t('vendor.digitalContract.notAvailable', 'غير متاح')
    }
  }

  const handleCancel = () => {
    const confirmed = window.confirm(t('vendor.digitalContract.confirm.cancel', 'هل تريد إلغاء التوقيع والخروج من الحساب؟'))
    if (!confirmed) return
    signOut?.()
    navigate('/login', { replace: true })
  }

  const handleSubmit = async () => {
    if (!user || !canSubmit) return

    const confirmed = window.confirm(t('vendor.digitalContract.confirm.sign', 'هل أنت متأكد من توقيع العقد الرقمي؟ لا يمكن التراجع بعد التوقيع.'))
    if (!confirmed) return

    setSubmitting(true)
    try {
      const ip = await getIpAddress()
      const deviceFingerprint = `${navigator.platform} | ${navigator.userAgent}`
      const nowIso = new Date().toISOString()

      // Fetch the vendor's current commission rate from their subscription plan
      let commissionRate = APP_CONFIG.commissionRate
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('subscription_plan')
          .eq('id', user.id)
          .single()

        if (profileData?.subscription_plan) {
          const { data: planData } = await supabase
            .from('subscription_plans')
            .select('commission_rate')
            .eq('id', profileData.subscription_plan)
            .eq('is_active', true)
            .single()

          if (planData?.commission_rate != null) {
            commissionRate = Number(planData.commission_rate) / 100
          }
        }
      } catch {
        // Fall back to default commission rate
      }

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
          agreed_commission_rate: commissionRate,
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
          onboarding_completed: true,
          onboarding_step: 100,
        })
        .eq('id', user.id)

      if (updateProfileError) throw updateProfileError

      // Start 14-day Pro trial automatically for new vendors
      try {
        await vendorSubscriptionService.startFreeTrial(user.id)
      } catch (trialError) {
        // Trial failure should not block onboarding — vendor can start it later
        console.warn('[DigitalContract] Failed to start free trial:', trialError?.message)
      }

      useAuthStore.setState((state) => ({
        ...state,
        profile: {
          ...state.profile,
          agreement_accepted: true,
          agreement_accepted_at: nowIso,
          is_active: true,
          onboarding_completed: true,
          onboarding_step: 100,
          subscription_plan: 'pro',
          subscription_status: 'active',
          subscription_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
      }))

      toast.success(t('vendor.digitalContract.success.signed', 'تم توقيع العقد بنجاح، يمكنك الآن البدء في البيع'))
      toast.success(t('vendor.subscription.trialStarted', 'تم تفعيل تجربتك المجانية لخطة الاحترافي لمدة 14 يوماً'))

      // After signing, guide the vendor to set up their store location
      // if they haven't already — this is part of the onboarding flow.
      const hasLocation = Boolean(profile?.latitude != null && profile?.longitude != null)
      if (!hasLocation) {
        navigate('/vendor/location', { replace: true })
      } else {
        navigate('/vendor/dashboard', { replace: true })
      }
    } catch (error) {
      toast.error(
        t('vendor.digitalContract.errors.saveFailed', 'فشل حفظ العقد: {{message}}', {
          message: error.message || t('vendor.digitalContract.errors.unexpectedError', 'حدث خطأ غير متوقع'),
        })
      )
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
          title={t('vendor.digitalContract.errors.loadTitle', 'تعذر تحميل العقد')}
          description={loadError.message || t('vendor.digitalContract.errors.loadDescription', 'حدث خطأ أثناء جلب بيانات العقد. حاول مرة أخرى.')}
          onRetry={loadContractData}
          retryLabel={t('vendor.digitalContract.retry', 'إعادة المحاولة')}
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
            aria-label={t('vendor.digitalContract.back', 'رجوع')}
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <span className="w-9" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-gray-900" data-testid="digital-contract-title">
          {t('vendor.digitalContract.title', 'تفعيل حساب البائع')}
        </h1>
        <div className="flex items-center justify-center gap-2" role="list" aria-label={t('vendor.digitalContract.setupSteps', 'خطوات إعداد المتجر')}>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">١</span>
            {t('vendor.digitalContract.steps.yourInfo', 'معلوماتك')}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-400 text-white text-[10px] font-bold">٢</span>
            {t('vendor.digitalContract.steps.bankData', 'بيانات البنك')}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-400 text-white text-[10px] font-bold">٣</span>
            {t('vendor.digitalContract.steps.approvals', 'الموافقات')}
          </span>
        </div>
      </header>

      <Card className="p-4 bg-green-50 border-green-200 rounded-2xl">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-bold text-gray-900">{t('vendor.digitalContract.whyRequired.title', 'لماذا هذه الخطوة مطلوبة؟')}</p>
            <p className="text-sm text-gray-600 mt-1 leading-6">
              {t('vendor.digitalContract.whyRequired.reason1', 'هذه الخطوة إلزامية لتفعيل حسابك كبائع قبل الوصول إلى لوحة البائع والمنتجات والطلبات.')}
            </p>
            <p className="text-sm text-gray-600 mt-2 leading-6">
              {t('vendor.digitalContract.whyRequired.reason2', 'توقيع العقد الرقمي يحمي حقوقك ويضمن تجربة آمنة وموثوقة لك ولمتسوقيك.')}
            </p>
            <p className="text-sm text-gray-600 mt-2 leading-6">
              {t('vendor.digitalContract.whyRequired.reason3', 'بعد التوقيع مباشرةً ستتمكن من إضافة المنتجات واستقبال الطلبات وتلقي مستحقاتك.')}
            </p>
            <p className="text-sm text-gray-600 mt-2 leading-6">
              {t('vendor.digitalContract.whyRequired.reason4', 'البيانات البنكية مطلوبة لتلقي مستحقاتك المالية من المبيعات تلقائياً بعد تأكيد الطلبات.')}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">{t('vendor.digitalContract.vendorInfo.title', 'معلومات البائع')}</h2>
        </div>

        <InfoRow icon={BuildingStorefrontIcon} label={t('vendor.digitalContract.fields.storeName', 'اسم المتجر')}>
          {storeName}
        </InfoRow>

        <InfoRow icon={UserIcon} label={t('vendor.digitalContract.fields.fullName', 'الاسم الكامل')}>
          <Input
            aria-label={t('vendor.digitalContract.fields.fullName', 'الاسم الكامل')}
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
            required
            className="!mt-0"
          />
        </InfoRow>

        <InfoRow icon={EnvelopeIcon} label={t('vendor.digitalContract.fields.email', 'البريد الإلكتروني')}>
          <Input
            aria-label={t('vendor.digitalContract.fields.email', 'البريد الإلكتروني')}
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
            className="!mt-0"
          />
        </InfoRow>

        <InfoRow icon={PhoneIcon} label={t('vendor.digitalContract.fields.phone', 'رقم الهاتف')}>
          <Input
            aria-label={t('vendor.digitalContract.fields.phone', 'رقم الهاتف')}
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            required
            className="!mt-0"
          />
        </InfoRow>

      </Card>

      <Card className="p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
            <BanknotesIcon className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">{t('vendor.digitalContract.bankInfo.title', 'بيانات الهوية والبنك')}</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3 leading-5">
          {t('vendor.digitalContract.bankInfo.subtitle', 'هذه البيانات مطلوبة لتفعيل حسابك واستلام مستحقاتك المالية من المبيعات.')}
        </p>

        <InfoRow icon={DocumentTextIcon} label={t('vendor.digitalContract.fields.cin', 'رقم بطاقة التعريف الوطنية (CIN)')}>
          <Input
            aria-label={t('vendor.digitalContract.fields.cinAria', 'رقم بطاقة التعريف الوطنية')}
            value={form.cin}
            onChange={(e) => setForm((p) => ({ ...p, cin: e.target.value }))}
            required
            className="!mt-0"
          />
        </InfoRow>

        <InfoRow icon={BanknotesIcon} label={t('vendor.digitalContract.fields.bankName', 'اسم البنك')}>
          <div>
            <select
              className="input w-full"
              value={form.bank_name}
              onChange={(e) => setForm((p) => ({ ...p, bank_name: e.target.value }))}
              required
              aria-label={t('vendor.digitalContract.fields.bankName', 'اسم البنك')}
            >
              <option value="">{t('vendor.digitalContract.fields.selectBank', 'اختر البنك')}</option>
              {MOROCCAN_BANKS.map((bank) => (
                <option key={bank.code} value={bank.name}>{bank.name}</option>
              ))}
            </select>
          </div>
        </InfoRow>

        <InfoRow icon={BanknotesIcon} label={t('vendor.digitalContract.fields.iban', 'رقم IBAN')}>
          <Input
            aria-label={t('vendor.digitalContract.fields.iban', 'رقم IBAN')}
            value={form.bank_iban}
            onChange={(e) => setForm((p) => ({ ...p, bank_iban: e.target.value }))}
            required
            className="!mt-0"
          />
        </InfoRow>

        <InfoRow icon={UserIcon} label={t('vendor.digitalContract.fields.accountHolder', 'اسم صاحب الحساب')}>
          <Input
            aria-label={t('vendor.digitalContract.fields.accountHolder', 'اسم صاحب الحساب')}
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
          <h2 className="text-base font-bold text-gray-900">{t('vendor.digitalContract.terms.title', 'أهم بنود العقد')}</h2>
        </div>

        <ul className="space-y-3">
          {CONTRACT_SUMMARY_ITEMS.map(({ key, title, description, Icon }) => (
            <li key={key} className="flex items-start gap-3 text-sm">
              <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-green-600" aria-hidden="true" />
              </div>
              <div className="min-w-0 text-right">
                <p className="font-semibold text-gray-900">
                  {t(`vendor.digitalContract.summary.${key}.title`, title)}
                </p>
                <p className="text-gray-600 leading-6 mt-0.5">
                  {t(`vendor.digitalContract.summary.${key}.description`, description)}
                </p>
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
          {t('vendor.digitalContract.viewFullContract', 'عرض العقد الكامل')}
        </span>
      </button>

      {showFullContract && (
        <Card className="p-4 rounded-2xl border border-gray-200 space-y-4" data-testid="full-contract-panel">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 leading-8 text-gray-800 text-sm whitespace-pre-line">
            {buildFullContractText(form.full_name, t)}
          </div>
        </Card>
      )}

      <Card className="p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
            <ShieldCheckIcon className="w-5 h-5 text-green-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">{t('vendor.digitalContract.approvals.title', 'الموافقات')}</h2>
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeData}
              onChange={(e) => setAgreeData(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-gray-800">{t('vendor.digitalContract.approvals.confirmData', 'أقر بأن المعلومات المدخلة صحيحة')}</span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-gray-800">
              {t('vendor.digitalContract.approvals.agreeTermsPrefix', 'أوافق على')}{' '}
              <a href="/terms" className="text-green-600 font-semibold hover:underline">
                {t('vendor.digitalContract.approvals.termsLink', 'شروط وأحكام المنصة')}
              </a>
            </span>
          </label>

        </div>
      </Card>

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-2">
        <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-amber-900 leading-6">
          {t('vendor.digitalContract.reviewWarning', 'بعد التوقيع، سيتم تفعيل متجرك بعد مراجعة الإدارة عند الحاجة.')}
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
              {t('vendor.digitalContract.signing', 'جاري التوقيع...')}
            </>
          ) : (
            <>
              <PencilSquareIcon className="w-5 h-5" aria-hidden="true" />
              {t('vendor.digitalContract.signContract', 'توقيع العقد')}
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
          {t('vendor.digitalContract.logoutLater', 'تسجيل الخروج والمتابعة لاحقًا')}
        </button>
      </div>

      <a
        href={getWhatsappUrl(t('vendor.digitalContract.help.whatsappMessage', 'مرحباً، أحتاج مساعدة بخصوص العقد الرقمي للبائع'))}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 text-sm text-green-700 font-medium py-2"
      >
        <ChatBubbleLeftRightIcon className="w-5 h-5" aria-hidden="true" />
        {t('vendor.digitalContract.help.title', 'تحتاج مساعدة؟ تواصل مع الدعم')}
      </a>
    </div>
  )
}

export default DigitalContract
