import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Button, Input, CINInput, TrustBadges, VehiclePhotoUpload, MoroccoNotice } from '@/components/ui'
import Recaptcha, { isRecaptchaSiteKeyConfigured } from '@/components/ui/Recaptcha'
import { EyeIcon, EyeSlashIcon, ShieldCheckIcon, LockClosedIcon, TruckIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { validateCIN } from '@/utils/cinValidation'
import { sanitizeText, sanitizeEmail } from '@/utils/sanitization'
import { checkSignupRate } from '@/utils/rateLimiter'
import { registerSchema } from '@/utils/validationSchemas'
import { getOnboardingPathForRole } from '@/services/onboardingService'
import { setPendingPhoneVerification } from '@/services/phoneOtpService'

const RegisterPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signUp, loading } = useAuthStore()
  const defaultRole = searchParams.get('role') || 'buyer'

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    referralCode: (searchParams.get('ref') || '').toUpperCase(),
    cin: '',
    password: '',
    confirmPassword: '',
    role: defaultRole,
    vehicleType: 'van',
    vehiclePlate: '',
    vehiclePhoto: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [cinError, setCINError] = useState('')
  const [vehiclePhotoError, setVehiclePhotoError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const recaptchaRef = useRef(null)
  const recaptchaSiteKey = typeof import.meta.env.VITE_RECAPTCHA_SITE_KEY === 'string'
    ? import.meta.env.VITE_RECAPTCHA_SITE_KEY.trim()
    : ''
  const captchaRequired = isRecaptchaSiteKeyConfigured(recaptchaSiteKey)
  
  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  // Password strength checker
  const getPasswordStrength = (password) => {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    }
    const score = Object.values(checks).filter(Boolean).length
    const labels = ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'قوية', 'قوية جداً']
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500']
    const idx = Math.min(score, 5)
    return {
      checks,
      score,
      label: labels[idx - 1] || '',
      color: colors[idx - 1] || 'bg-gray-200',
    }
  }

  const passwordStrength = getPasswordStrength(formData.password)

  const resetCaptcha = () => {
    setCaptchaToken(null)
    recaptchaRef.current?.reset?.()
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    // Clear field error on change
    if (fieldErrors[e.target.name]) {
      setFieldErrors({ ...fieldErrors, [e.target.name]: null })
    }
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setCINError('')
    setVehiclePhotoError('')
    setFieldErrors({})

    // 1. Check rate limit
    const rateResult = checkSignupRate(formData.email.toLowerCase())
    if (!rateResult.allowed) {
      const minutes = Math.ceil(rateResult.retryAfter / 60000)
      setError(t('auth.register.errors.tooManyAttempts', 'Too many signup attempts. Please wait {{minutes}} minute(s) before trying again.', { minutes }))
      return
    }

    // 2. Validate with Zod schema (strong password, name format, etc.)
    const validationResult = registerSchema.safeParse({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      role: formData.role,
      phone: formData.phone || undefined,
    })

    if (!validationResult.success) {
      console.error('[REGISTER VALIDATION ERROR]', validationResult.error)
      const fieldErrMap = {}
      const errors = validationResult.error.errors || []
      const firstError = errors[0]
      if (firstError && firstError.path && firstError.path.length > 0) {
        fieldErrMap[firstError.path[0]] = firstError.message
      }
      setFieldErrors(fieldErrMap)
      setError(firstError?.message || t('auth.register.errors.validation', 'Validation failed. Please check your input.'))
      return
    }

    // 3. Sanitize all inputs
    const sanitizedData = {
      firstName: sanitizeText(formData.firstName, { maxLength: 50 }),
      lastName: sanitizeText(formData.lastName, { maxLength: 50 }),
      email: sanitizeEmail(formData.email),
      phone: formData.phone ? sanitizeText(formData.phone, { maxLength: 20 }) : '',
      referralCode: formData.role === 'buyer' && formData.referralCode
        ? sanitizeText(formData.referralCode.toUpperCase(), { maxLength: 16 })
        : '',
      cin: sanitizeText(formData.cin, { maxLength: 10 }),
      role: formData.role,
      vehicleType: formData.vehicleType,
      vehiclePlate: formData.vehiclePlate ? sanitizeText(formData.vehiclePlate, { maxLength: 20 }) : '',
      vehiclePhoto: formData.vehiclePhoto,
    }

    // 4. Validate CIN
    const cinResult = validateCIN(sanitizedData.cin)
    if (!cinResult.valid) {
      setCINError(cinResult.error)
      return
    }

    // 5. Validate vehicle photo for drivers
    if (sanitizedData.role === 'driver' && !sanitizedData.vehiclePhoto) {
      setVehiclePhotoError(t('auth.register.errors.vehiclePhotoRequired', 'Vehicle photo is required for driver registration'))
      return
    }

    // 6. Terms acceptance
    if (!agreeTerms) {
      setError(t('auth.register.errors.termsRequired', 'You must accept the Terms of Service and Privacy Policy to create an account'))
      return
    }

    if (captchaRequired && !captchaToken) {
      setError(t('auth.errors.captchaRequired', 'Please complete the security verification before continuing.'))
      return
    }

    // 7. Submit with sanitized data
    const result = await signUp(sanitizedData.email, formData.password, {
      ...sanitizedData,
      cin: cinResult.cin,
    }, captchaToken)

    if (!result.success && captchaRequired) {
      resetCaptcha()
    }

    if (result.success) {
      if (result.requiresPhoneVerification && result.userId && result.phone) {
        setPendingPhoneVerification({
          userId: result.userId,
          phone: result.phone,
          purpose: 'registration',
          successPath: getOnboardingPathForRole(result.role || sanitizedData.role),
        })
      }

      if (result.needsEmailVerification) {
        sessionStorage.setItem('pendingVerificationEmail', sanitizedData.email)
        navigate('/verify-email')
      } else if (result.requiresPhoneVerification && result.userId && result.phone) {
        navigate('/verify-phone')
      } else {
        navigate(result.redirect || '/marketplace')
      }
    }
  }
  
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.register.createAccount', 'Create Account')}</h2>
      <p className="text-gray-500 mb-4">
        {t('auth.register.signInLink', 'Already have an account?')}{' '}
        <Link to="/login" className="text-green-600 font-semibold hover:underline">
          {t('auth.register.signIn', 'Sign in')}
        </Link>
      </p>

      {/* Morocco Availability Notice */}
      <div className="mb-6">
        <MoroccoNotice variant="default" />
      </div>
      
      {error && (
        <div className="alert-error mb-6">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Input
              label={t('auth.register.firstName', 'First Name')}
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder={t('auth.register.firstNamePlaceholder', 'First name')}
              required
            />
            {fieldErrors.firstName && <p className="text-red-500 text-xs mt-1">{fieldErrors.firstName}</p>}
          </div>
          <div>
            <Input
              label={t('auth.register.lastName', 'Last Name')}
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder={t('auth.register.lastNamePlaceholder', 'Last name')}
              required
            />
            {fieldErrors.lastName && <p className="text-red-500 text-xs mt-1">{fieldErrors.lastName}</p>}
          </div>
        </div>

        <div>
          <Input
            label={t('auth.register.emailAddress', 'Email address')}
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder={t('auth.register.emailPlaceholder', 'Enter your email address')}
            required
          />
          {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
        </div>

        <Input
          label={t('auth.register.phoneNumber', 'Phone Number')}
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          placeholder={t('auth.register.phonePlaceholder', '+212 674 841 248')}
        />

        {formData.role === 'buyer' && (
          <Input
            label={t('auth.register.referralCode', 'Referral Code (optional)')}
            name="referralCode"
            value={formData.referralCode}
            onChange={(event) => setFormData({
              ...formData,
              referralCode: event.target.value.toUpperCase(),
            })}
            placeholder={t('auth.register.referralCodePlaceholder', 'Enter invitation code if you have one')}
          />
        )}

        {/* National ID (CIN) */}
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheckIcon className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-800">{t('auth.register.identityVerification', 'Identity Verification')}</h3>
          </div>
          <p className="text-xs text-green-700 mb-3">
            {t('auth.register.cinDescription', 'Your National ID (CIN) is required by Moroccan law for B2B transactions. It\'s encrypted and never shared with third parties.')}
          </p>
          <CINInput
            value={formData.cin}
            onChange={(value) => { setFormData({ ...formData, cin: value }); setCINError('') }}
            error={cinError}
            showHelp={false}
          />
        </div>

        <div>
          <Input
            label={t('auth.register.password', 'Password')}
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={handleChange}
            placeholder={t('auth.register.passwordPlaceholder', 'At least 8 characters')}
            required
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            }
          />
          {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}

          {/* Password Strength Indicator */}
          {formData.password && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">{t('auth.register.passwordStrength', 'Password Strength')}</span>
                <span className={`text-xs font-semibold ${
                  passwordStrength.score >= 4 ? 'text-green-600' :
                  passwordStrength.score >= 3 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {passwordStrength.label}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                  style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { key: 'length', label: '8+ chars' },
                  { key: 'uppercase', label: 'Uppercase' },
                  { key: 'lowercase', label: 'Lowercase' },
                  { key: 'number', label: 'Number' },
                  { key: 'special', label: 'Special char' },
                ].map(({ key, label }) => (
                  <div key={key} className={`flex items-center gap-1 text-xs ${
                    passwordStrength.checks[key] ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {passwordStrength.checks[key] ? (
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                    ) : (
                      <XCircleIcon className="w-3.5 h-3.5" />
                    )}
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <Input
            label={t('auth.register.confirmPassword', 'Confirm Password')}
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder={t('auth.register.confirmPasswordPlaceholder', 'Repeat your password')}
            required
          />
          {fieldErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{fieldErrors.confirmPassword}</p>}
        </div>
        
        {/* Role Selection */}
        <div>
          <label className="input-label">{t('auth.register.roleLabel', 'I am a...')}</label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, role: 'buyer' })}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                formData.role === 'buyer'
                  ? 'border-green-500 bg-green-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">🛒</div>
              <div className="font-semibold text-gray-900">{t('auth.register.buyer.label', 'Buyer')}</div>
              <div className="text-xs text-gray-500 mt-1">{t('auth.register.buyer.description', 'Buy wholesale products')}</div>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, role: 'vendor' })}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                formData.role === 'vendor'
                  ? 'border-green-500 bg-green-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">🌱</div>
              <div className="font-semibold text-gray-900">{t('auth.register.vendor.label', 'Vendor')}</div>
              <div className="text-xs text-gray-500 mt-1">{t('auth.register.vendor.description', 'Sell your products')}</div>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, role: 'driver' })}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                formData.role === 'driver'
                  ? 'border-green-500 bg-green-50 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-3xl mb-2">🚚</div>
              <div className="font-semibold text-gray-900">{t('auth.register.driver.label', 'Driver')}</div>
              <div className="text-xs text-gray-500 mt-1">{t('auth.register.driver.description', 'Deliver orders')}</div>
            </button>
          </div>
        </div>
        
        {/* Driver-specific fields */}
        {formData.role === 'driver' && (
          <div className="space-y-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <TruckIcon className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-blue-800">{t('auth.register.driverInfo.title', 'Driver Information')}</h3>
            </div>

            <div>
              <label className="input-label">{t('auth.register.driverInfo.vehicleType', 'Vehicle Type')}</label>
              <select
                value={formData.vehicleType}
                onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                className="input"
              >
                <option value="motorcycle">{t('auth.register.vehicleTypes.motorcycle', 'Motorcycle')}</option>
                <option value="car">{t('auth.register.vehicleTypes.car', 'Car')}</option>
                <option value="van">{t('auth.register.vehicleTypes.van', 'Van')}</option>
                <option value="truck">{t('auth.register.vehicleTypes.truck', 'Truck')}</option>
              </select>
            </div>

            <Input
              label={t('auth.register.driverInfo.vehiclePlate', 'Vehicle Plate Number')}
              name="vehiclePlate"
              value={formData.vehiclePlate}
              onChange={handleChange}
              placeholder={t('auth.register.driverInfo.vehiclePlatePlaceholder', 'ABC-1234')}
            />

            <VehiclePhotoUpload
              value={formData.vehiclePhoto}
              onChange={(url) => { setFormData({ ...formData, vehiclePhoto: url }); setVehiclePhotoError('') }}
              error={vehiclePhotoError}
            />
          </div>
        )}
        
        {captchaRequired && (
          <div className="flex justify-center pt-2">
            <Recaptcha
              ref={recaptchaRef}
              siteKey={recaptchaSiteKey}
              onChange={setCaptchaToken}
            />
          </div>
        )}

        <Button type="submit" variant="primary" className="w-full py-3" isLoading={loading}>
          {t('auth.register.createAccountButton', 'Create Account')}
        </Button>
        {/* Terms & Conditions Checkbox */}
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1 w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
            />
            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-900 mb-1">
                {t('auth.register.termsAgreement', 'I agree to the')}{' '}
                <Link to="/terms" target="_blank" className="text-green-600 hover:underline font-semibold">
                  {t('auth.register.termsOfService', 'Terms of Service')}
                </Link>
                {' '}and{' '}
                <Link to="/privacy" target="_blank" className="text-green-600 hover:underline font-semibold">
                  {t('auth.register.privacyPolicy', 'Privacy Policy')}
                </Link>
              </p>
              <p className="text-gray-500">
                {t('auth.register.termsDescription', 'By creating an account, you commit to providing accurate information and complying with all platform rules and Moroccan laws.')}
              </p>
            </div>
          </label>
        </div>

        {/* Trust Badges */}
        <div className="pt-4 border-t border-gray-200">
          <TrustBadges variant="compact" />
        </div>
      </form>
    </div>
  )
}

export default RegisterPage
