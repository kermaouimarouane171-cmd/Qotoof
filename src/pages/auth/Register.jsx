import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import Recaptcha from '@/components/ui/Recaptcha'
import TrustBadges from '@/components/ui/TrustBadges'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import CINInput from '@/components/ui/CINInput'
import CityAutocomplete from '@/components/ui/CityAutocomplete'
import { useAuthStore } from '@/store/authStore'
import { checkSignupRate } from '@/utils/rateLimiter'
import { MOROCCAN_CITIES_221 } from '@/constants/moroccanCities'
import {
  registerSchema,
  registerBuyerProfileSchema,
  registerVendorProfileSchema,
  registerDriverProfileSchema,
} from '@/utils/validationSchemas'
import { formatSupabaseError } from '@/utils/errorFormatter'
import { validateCIN as validateMoroccanCIN } from '@/utils/cinValidation'
import { logger } from '@/utils/logger'

const TOTAL_STEPS = 4

const STEP_LABELS = [
  'auth.register.steps.role',
  'auth.register.steps.basicInfo',
  'auth.register.steps.profile',
  'auth.register.steps.confirm',
]

const emptyErrors = {
  role: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  deliveryAddress: '',
  preferredPaymentMethod: '',
  storeName: '',
  storeType: '',
  city: '',
  cin: '',
  vehicleType: '',
  vehiclePlate: '',
  terms: '',
  general: '',
}

function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const recaptchaRef = useRef(null)
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [captchaRequired, setCaptchaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [errors, setErrors] = useState(emptyErrors)

  const signUp = useAuthStore((s) => s.signUp)
  const setPendingPhoneVerification = useAuthStore((s) => s.setPendingPhoneVerification)
  const setPostVerifyRedirect = useAuthStore((s) => s.setPostVerifyRedirect)
  const getRedirectPath = useAuthStore((s) => s.getRedirectPath)

  const [formData, setFormData] = useState({
    role: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    deliveryAddress: '',
    preferredPaymentMethod: 'cash',
    storeName: '',
    storeType: '',
    city: '',
    cin: '',
    vehicleType: 'motorcycle',
    vehiclePlate: '',
  })

  const roleLabel = useMemo(() => {
    if (formData.role === 'buyer') return t('auth.register.role.buyer', 'مشتري')
    if (formData.role === 'vendor') return t('auth.register.role.vendor', 'بائع')
    if (formData.role === 'driver') return t('auth.register.role.driver', 'سائق')
    return t('auth.register.role.none', 'غير محدد')
  }, [formData.role, t])

  const setFieldError = (field, message) => {
    setErrors((prev) => ({ ...prev, [field]: message }))
  }

  const clearFieldError = (field) => {
    if (!errors[field]) return
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    clearFieldError(name)
  }

  const handleRoleChange = (role) => {
    setFormData((prev) => ({ ...prev, role }))
    clearFieldError('role')
  }

  const validateCIN = (cin) => {
    const result = validateMoroccanCIN(cin)

    if (!result.valid) {
      return {
        valid: false,
        error: t('auth.register.validation.cin.invalid', result.error),
      }
    }

    return { valid: true, cleaned: result.cin }
  }

  const validateStep1 = () => {
    if (formData.role) return true
    setFieldError('role', t('auth.register.validation.role.required', 'يرجى اختيار نوع الحساب'))
    return false
  }

  const validateStep2 = () => {
    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      role: formData.role,
      phone: formData.phone || undefined,
    }

    const result = registerSchema.safeParse(payload)
    const nextErrors = { ...emptyErrors }

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path?.[0]
        if (typeof field === 'string' && field in nextErrors) {
          nextErrors[field] = issue.message
        }
      })
    }

    if (!formData.phone.trim()) {
      nextErrors.phone = t('auth.register.validation.phone.required', 'رقم الهاتف مطلوب')
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }))
    return Object.values(nextErrors).every((value) => !value)
  }

  const validateBuyerStep = () => {
    const result = registerBuyerProfileSchema.safeParse({
      deliveryAddress: formData.deliveryAddress,
      preferredPaymentMethod: formData.preferredPaymentMethod,
    })
    const nextErrors = { ...emptyErrors }

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path?.[0]
        if (typeof field === 'string' && field in nextErrors) {
          nextErrors[field] = issue.message
        }
      })
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }))
    return Object.values(nextErrors).every((value) => !value)
  }

  const validateVendorStep = () => {
    const result = registerVendorProfileSchema.safeParse({
      storeName: formData.storeName,
      city: formData.city,
      storeType: formData.storeType,
      cin: formData.cin,
    })

    const nextErrors = { ...emptyErrors }

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path?.[0]
        if (typeof field === 'string' && field in nextErrors) {
          nextErrors[field] = issue.message
        }
      })
    }

    const cinValidation = validateCIN(formData.cin)
    if (!cinValidation.valid) {
      nextErrors.cin = cinValidation.error
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }))
    return Object.values(nextErrors).every((value) => !value)
  }

  const validateDriverStep = () => {
    const result = registerDriverProfileSchema.safeParse({
      vehicleType: formData.vehicleType,
      vehiclePlate: formData.vehiclePlate,
      cin: formData.cin,
    })

    const nextErrors = { ...emptyErrors }

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        const field = issue.path?.[0]
        if (typeof field === 'string' && field in nextErrors) {
          nextErrors[field] = issue.message
        }
      })
    }

    const cinValidation = validateCIN(formData.cin)
    if (!cinValidation.valid) {
      nextErrors.cin = cinValidation.error
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }))
    return Object.values(nextErrors).every((value) => !value)
  }

  const validateStep3 = () => {
    if (formData.role === 'buyer') return validateBuyerStep()
    if (formData.role === 'vendor') return validateVendorStep()
    if (formData.role === 'driver') return validateDriverStep()
    return false
  }

  const goNext = () => {
    let valid = false

    if (step === 1) valid = validateStep1()
    if (step === 2) valid = validateStep2()
    if (step === 3) valid = validateStep3()

    if (!valid) return
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS))
  }

  const goBack = () => {
    setStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (step !== 4) {
      goNext()
      return
    }

    if (!agreeTerms) {
      setFieldError('terms', t('auth.register.validation.terms.required', 'يرجى الموافقة على الشروط والأحكام'))
      return
    }

    setFieldError('terms', '')

    const rateLimit = checkSignupRate(formData.email)
    if (!rateLimit.allowed) {
      setCaptchaRequired(true)
      setFieldError('general', t('auth.register.validation.rateLimit', 'تم تجاوز عدد المحاولات، يرجى حل التحقق أولاً'))
      return
    }

    setLoading(true)

    try {
      const cleanedCin = formData.role === 'buyer' ? null : validateCIN(formData.cin).cleaned

      const signupPayload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role,
        phone: formData.phone,
        cin: cleanedCin,
        storeName: formData.role === 'vendor' ? formData.storeName : null,
        storeType: formData.role === 'vendor' ? formData.storeType : null,
        city: formData.role === 'vendor' ? formData.city : null,
        deliveryAddress: formData.role === 'buyer' ? formData.deliveryAddress : null,
        preferredPaymentMethod: formData.role === 'buyer' ? formData.preferredPaymentMethod : null,
        vehicleType: formData.role === 'driver' ? formData.vehicleType : null,
        vehiclePlate: formData.role === 'driver' ? formData.vehiclePlate : null,
      }

      const result = await signUp(formData.email, formData.password, signupPayload, captchaToken)

      if (!result.success) {
        throw new Error(result.error || t('auth.register.error.default', 'تعذر إنشاء الحساب، حاول مرة أخرى'))
      }

      if (result.needsEmailVerification) {
        setPostVerifyRedirect(getRedirectPath(formData.role))
        navigate('/verify-email', {
          state: {
            email: formData.email,
            role: formData.role,
            message: t('auth.register.verifyEmail.notice', 'تم إنشاء الحساب، يرجى تأكيد بريدك الإلكتروني للمتابعة'),
          },
        })
        return
      }

      if (result.requiresPhoneVerification) {
        setPendingPhoneVerification({
          userId: result.userId,
          phone: result.phone,
          role: result.role,
        })

        navigate('/verify-phone', {
          state: {
            userId: result.userId,
            phone: result.phone,
            role: result.role,
          },
        })
        return
      }

      navigate(result.redirect || '/dashboard')
    } catch (error) {
      logger.error('Registration failed:', error)
      const formattedError = formatSupabaseError(error, t('auth.register.error.default', 'تعذر إنشاء الحساب، حاول مرة أخرى'))
      setFieldError('general', formattedError)
      toast.error(formattedError)
      recaptchaRef.current?.reset()
      setCaptchaToken(null)
    } finally {
      setLoading(false)
    }
  }

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100)

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6" dir="rtl" data-testid="register-page">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5 sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {t('auth.register.title', 'إنشاء حساب جديد')}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {t('auth.register.subtitle', 'أكمل الخطوات التالية للانضمام إلى منصة قطوف')}
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600 mb-2">
            <span>{t('auth.register.progress.label', 'التقدم')}</span>
            <span>
              {t('auth.register.progress.step', 'الخطوة')} {step} / {TOTAL_STEPS}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-green-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STEP_LABELS.map((label, index) => {
              const current = index + 1
              const isActive = step === current
              const isDone = step > current

              return (
                <div
                  key={label}
                  className={`text-center rounded-lg px-2 py-1.5 text-xs border ${
                    isDone
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : isActive
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}
                >
                  {t(label, `خطوة ${current}`)}
                </div>
              )
            })}
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit} data-testid="register-form">
          {errors.general && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">
              {errors.general}
            </div>
          )}

          {step === 1 && (
            <section className="space-y-4" data-testid="register-step-1">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('auth.register.step1.title', 'اختر نوع حسابك')}
              </h2>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => handleRoleChange('buyer')}
                  data-testid="register-role-buyer"
                  className={`rounded-xl border-2 p-4 text-right transition ${
                    formData.role === 'buyer'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">🛒</div>
                  <div className="font-semibold text-gray-900">{t('auth.register.role.buyer', 'مشتري')}</div>
                  <div className="text-xs text-gray-500">{t('auth.register.role.buyerDesc', 'شراء المنتجات بالجملة')}</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('vendor')}
                  data-testid="register-role-vendor"
                  className={`rounded-xl border-2 p-4 text-right transition ${
                    formData.role === 'vendor'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">🏪</div>
                  <div className="font-semibold text-gray-900">{t('auth.register.role.vendor', 'بائع')}</div>
                  <div className="text-xs text-gray-500">{t('auth.register.role.vendorDesc', 'عرض منتجاتك وإدارة متجرك')}</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleRoleChange('driver')}
                  data-testid="register-role-driver"
                  className={`rounded-xl border-2 p-4 text-right transition ${
                    formData.role === 'driver'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">🚚</div>
                  <div className="font-semibold text-gray-900">{t('auth.register.role.driver', 'سائق')}</div>
                  <div className="text-xs text-gray-500">{t('auth.register.role.driverDesc', 'توصيل الطلبات للعملاء')}</div>
                </button>
              </div>

              {errors.role && <p className="text-sm text-red-600">{errors.role}</p>}
            </section>
          )}

          {step === 2 && (
            <section className="space-y-4" data-testid="register-step-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('auth.register.step2.title', 'المعلومات الأساسية')}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label={t('auth.register.firstName', 'الاسم الشخصي')}
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  error={errors.firstName}
                  placeholder={t('auth.register.firstNamePlaceholder', 'أدخل الاسم الشخصي')}
                  data-testid="register-first-name-input"
                />

                <Input
                  label={t('auth.register.lastName', 'الاسم العائلي')}
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  error={errors.lastName}
                  placeholder={t('auth.register.lastNamePlaceholder', 'أدخل الاسم العائلي')}
                  data-testid="register-last-name-input"
                />
              </div>

              <Input
                type="email"
                label={t('auth.register.email', 'البريد الإلكتروني')}
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder={t('auth.register.emailPlaceholder', 'example@email.com')}
                data-testid="register-email-input"
              />

              <Input
                type="tel"
                label={t('auth.register.phone', 'رقم الهاتف')}
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                error={errors.phone}
                placeholder={t('auth.register.phonePlaceholder', '+212600000000')}
                data-testid="register-phone-input"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  type="password"
                  label={t('auth.register.password', 'كلمة المرور')}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  error={errors.password}
                  placeholder={t('auth.register.passwordPlaceholder', 'أدخل كلمة المرور')}
                  data-testid="register-password-input"
                />

                <Input
                  type="password"
                  label={t('auth.register.confirmPassword', 'تأكيد كلمة المرور')}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  error={errors.confirmPassword}
                  placeholder={t('auth.register.confirmPasswordPlaceholder', 'أعد إدخال كلمة المرور')}
                  data-testid="register-confirm-password-input"
                />
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4" data-testid="register-step-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('auth.register.step3.title', 'معلومات الملف الشخصي')}
              </h2>

              {formData.role === 'buyer' && (
                <>
                  <Input
                    label={t('auth.register.deliveryAddress', 'عنوان التوصيل')}
                    name="deliveryAddress"
                    value={formData.deliveryAddress}
                    onChange={handleChange}
                    error={errors.deliveryAddress}
                    placeholder={t('auth.register.deliveryAddressPlaceholder', 'المدينة، الحي، الشارع، رقم الباب')}
                    data-testid="register-delivery-address-input"
                  />

                  <div>
                    <label className="input-label">
                      {t('auth.register.preferredPaymentMethod', 'طريقة الدفع المفضلة')}
                    </label>
                    <select
                      name="preferredPaymentMethod"
                      value={formData.preferredPaymentMethod}
                      onChange={handleChange}
                      className="input"
                      data-testid="register-payment-method-select"
                    >
                      <option value="cash">{t('auth.register.payment.cash', 'الدفع عند الاستلام')}</option>
                      <option value="bank_transfer">{t('auth.register.payment.bankTransfer', 'تحويل بنكي')}</option>
                      <option value="paypal">{t('auth.register.payment.paypal', 'بايبال')}</option>
                    </select>
                    {errors.preferredPaymentMethod && (
                      <p className="mt-1 text-sm text-red-600">{errors.preferredPaymentMethod}</p>
                    )}
                  </div>
                </>
              )}

              {formData.role === 'vendor' && (
                <>
                  <Input
                    label={t('auth.register.storeName', 'اسم المتجر')}
                    name="storeName"
                    value={formData.storeName}
                    onChange={handleChange}
                    error={errors.storeName}
                    placeholder={t('auth.register.storeNamePlaceholder', 'أدخل اسم المتجر')}
                    data-testid="register-store-name-input"
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="input-label">{t('auth.register.storeType', 'نوع المتجر')}</label>
                      <select name="storeType" value={formData.storeType} onChange={handleChange} className="input" data-testid="register-store-type-select">
                        <option value="">{t('auth.register.storeType.placeholder', 'اختر نوع المتجر')}</option>
                        <option value="farm">{t('auth.register.storeType.farm', 'مزرعة')}</option>
                        <option value="cooperative">{t('auth.register.storeType.cooperative', 'تعاونية')}</option>
                        <option value="wholesale">{t('auth.register.storeType.wholesale', 'جملة')}</option>
                        <option value="retail">{t('auth.register.storeType.retail', 'تجزئة')}</option>
                      </select>
                      {errors.storeType && <p className="mt-1 text-sm text-red-600">{errors.storeType}</p>}
                    </div>

                    <div>
                      <label className="input-label">{t('auth.register.city', 'المدينة')}</label>
                      <CityAutocomplete
                        value={formData.city}
                        onChange={(cityValue) => {
                          setFormData((prev) => ({ ...prev, city: cityValue }))
                          clearFieldError('city')
                        }}
                        cities={MOROCCAN_CITIES_221}
                        name="city"
                        required
                        dataTestId="register-city-input"
                        placeholder={t('auth.register.city.placeholder', 'ابحث عن المدينة أو اخترها')}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {t('auth.register.city.totalCitiesHint', 'تضم القائمة 221 مدينة مغربية مع بحث سريع.')}
                      </p>
                      {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
                    </div>
                  </div>

                  <CINInput
                    value={formData.cin}
                    onChange={(cinValue) => {
                      setFormData((prev) => ({ ...prev, cin: cinValue }))
                      clearFieldError('cin')
                    }}
                    error={errors.cin}
                    required
                    inputTestId="register-cin-input"
                  />
                </>
              )}

              {formData.role === 'driver' && (
                <>
                  <div>
                    <label className="input-label">{t('auth.register.vehicleType', 'نوع المركبة')}</label>
                    <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} className="input" data-testid="register-vehicle-type-select">
                      <option value="motorcycle">{t('auth.register.vehicle.motorcycle', 'دراجة نارية')}</option>
                      <option value="car">{t('auth.register.vehicle.car', 'سيارة')}</option>
                      <option value="van">{t('auth.register.vehicle.van', 'شاحنة صغيرة')}</option>
                      <option value="truck">{t('auth.register.vehicle.truck', 'شاحنة')}</option>
                    </select>
                    {errors.vehicleType && <p className="mt-1 text-sm text-red-600">{errors.vehicleType}</p>}
                  </div>

                  <Input
                    label={t('auth.register.vehiclePlate', 'رقم لوحة المركبة')}
                    name="vehiclePlate"
                    value={formData.vehiclePlate}
                    onChange={handleChange}
                    error={errors.vehiclePlate}
                    placeholder={t('auth.register.vehiclePlatePlaceholder', '123-أ-45')}
                    data-testid="register-vehicle-plate-input"
                  />

                  <CINInput
                    value={formData.cin}
                    onChange={(cinValue) => {
                      setFormData((prev) => ({ ...prev, cin: cinValue }))
                      clearFieldError('cin')
                    }}
                    error={errors.cin}
                    required
                    inputTestId="register-cin-input"
                  />
                </>
              )}
            </section>
          )}

          {step === 4 && (
            <section className="space-y-4" data-testid="register-step-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {t('auth.register.step4.title', 'تأكيد البيانات')}
              </h2>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-2">
                <p>
                  <span className="font-semibold">{t('auth.register.summary.role', 'نوع الحساب')}:</span> {roleLabel}
                </p>
                <p>
                  <span className="font-semibold">{t('auth.register.summary.name', 'الاسم')}:</span>{' '}
                  {formData.firstName} {formData.lastName}
                </p>
                <p>
                  <span className="font-semibold">{t('auth.register.summary.email', 'البريد الإلكتروني')}:</span> {formData.email}
                </p>
                <p>
                  <span className="font-semibold">{t('auth.register.summary.phone', 'رقم الهاتف')}:</span> {formData.phone}
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                {t(
                  'auth.register.verifyEmail.notice',
                  'بعد إنشاء الحساب ستتلقى رسالة تأكيد عبر البريد الإلكتروني. يرجى تأكيد البريد لتفعيل الحساب.'
                )}
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => {
                      setAgreeTerms(e.target.checked)
                      clearFieldError('terms')
                    }}
                    data-testid="register-terms-checkbox"
                    className="mt-1 w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <div className="text-sm text-gray-700">
                    <p className="font-medium text-gray-900 mb-1">
                      {t('auth.register.termsAgreement', 'أوافق على')}{' '}
                      <Link to="/terms" target="_blank" className="text-green-600 hover:underline font-semibold">
                        {t('auth.register.termsOfService', 'شروط الاستخدام')}
                      </Link>{' '}
                      {t('auth.register.and', 'و')}{' '}
                      <Link to="/privacy" target="_blank" className="text-green-600 hover:underline font-semibold">
                        {t('auth.register.privacyPolicy', 'سياسة الخصوصية')}
                      </Link>
                    </p>
                    <p className="text-gray-500">
                      {t('auth.register.termsDescription', 'أتعهد بتقديم معلومات صحيحة والالتزام بقواعد المنصة والقوانين المغربية.')}
                    </p>
                  </div>
                </label>
                {errors.terms && <p className="mt-2 text-sm text-red-600">{errors.terms}</p>}
              </div>

              {captchaRequired && (
                <div className="flex justify-center pt-2">
                  <Recaptcha ref={recaptchaRef} siteKey={recaptchaSiteKey} onChange={setCaptchaToken} />
                </div>
              )}
            </section>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={goBack} disabled={step === 1 || loading} data-testid="register-back-button">
              {t('auth.register.actions.back', 'السابق')}
            </Button>

            {step < TOTAL_STEPS ? (
              <Button type="button" variant="primary" onClick={goNext} data-testid="register-next-button">
                {t('auth.register.actions.next', 'التالي')}
              </Button>
            ) : (
              <Button type="submit" variant="primary" isLoading={loading} data-testid="register-submit-button">
                {t('auth.register.actions.submit', 'إنشاء الحساب')}
              </Button>
            )}
          </div>

          <p className="text-sm text-gray-600 text-center pt-2">
            {t('auth.register.haveAccount', 'لديك حساب بالفعل؟')}{' '}
            <Link to="/login" className="text-green-600 hover:underline font-semibold">
              {t('auth.register.loginLink', 'تسجيل الدخول')}
            </Link>
          </p>

          <div className="pt-2 border-t border-gray-200">
            <TrustBadges variant="compact" />
          </div>
        </form>
      </div>
    </div>
  )
}

export default RegisterPage
