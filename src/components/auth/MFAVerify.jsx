import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useLanguageStore } from '@/store/languageStore'
import { mfaService } from '@/services/authServices'
import { Logo } from '@/components/ui'
import {
  ShieldCheckIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  LockClosedIcon,
  QuestionMarkCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { useDarkMode } from '@/hooks/useDarkMode'

const LANGS = [
  { code: 'ar', label: 'عربي' },
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
]

const TOTP_PERIOD = 30

const MFAVerify = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, signOut, verifyMFA, profile } = useAuthStore()
  const { language, setLanguage } = useLanguageStore()
  const { isDark, toggle: toggleDark } = useDarkMode()

  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingMFA, setCheckingMFA] = useState(true)
  const [mfaSettings, setMfaSettings] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  const [attemptsRemaining, setAttemptsRemaining] = useState(null)
  const [locked, setLocked] = useState(false)
  const [retryAfter, setRetryAfter] = useState(null)
  const mfaCheckRef = useRef(false)

  // ── Countdown ticker ────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const secs = TOTP_PERIOD - (Math.floor(Date.now() / 1000) % TOTP_PERIOD)
      setCountdown(secs)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // ── MFA settings check ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    if (mfaCheckRef.current) return
    mfaCheckRef.current = true

    const checkMFAMethod = async () => {
      try {
        const settings = await mfaService.getSettings()
        setMfaSettings(settings)

        if (!settings?.is_enabled) {
          navigate('/login')
          return
        }

        if (settings?.locked_until && new Date(settings.locked_until).getTime() > Date.now()) {
          setLocked(true)
          setRetryAfter(Math.max(0, Math.floor((new Date(settings.locked_until).getTime() - Date.now()) / 1000)))
          return
        }
      } catch (err) {
        logger.error('Error checking MFA status:', err)
      } finally {
        setCheckingMFA(false)
      }
    }

    checkMFAMethod()
  }, [user, navigate])

  // ── Auto-focus first input ──────────────────────────────────────────────────
  useEffect(() => {
    if (!checkingMFA) {
      document.getElementById('mfa-code-0')?.focus()
    }
  }, [checkingMFA])

  // ── Input handlers ───────────────────────────────────────────────────────
  const handleCodeChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return
    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)
    setError('')
    setAttemptsRemaining(null)
    if (value && index < 5) {
      document.getElementById(`mfa-code-${index + 1}`)?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      document.getElementById(`mfa-code-${index - 1}`)?.focus()
    }
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then(text => {
        const digits = text.replace(/\D/g, '').slice(0, 6)
        if (digits.length === 6) {
          setCode(digits.split(''))
          document.getElementById('mfa-code-5')?.focus()
        }
      })
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const digits = text.replace(/\D/g, '').slice(0, 6)
    if (digits.length === 6) {
      setCode(digits.split(''))
      setError('')
      setAttemptsRemaining(null)
      document.getElementById('mfa-code-5')?.focus()
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    const codeString = code.join('')
    if (codeString.length !== 6) {
      setError(t('auth.mfa.errors.incompleteCode', 'Please enter all 6 digits'))
      return
    }
    if (!mfaSettings?.is_enabled) {
      setError(t('auth.mfa.errors.noFactors', 'No MFA factors found. Please set up MFA first.'))
      return
    }

    try {
      setLoading(true)
      setError('')
      setLocked(false)
      setRetryAfter(null)
      setAttemptsRemaining(null)

      const result = await verifyMFA(codeString, mfaSettings.method)

      if (!result.success) {
        setLocked(Boolean(result.locked))
        setRetryAfter(result.retryAfter || null)
        setAttemptsRemaining(result.attemptsRemaining !== undefined ? result.attemptsRemaining : null)

        if (result.locked) {
          setError(result.error || t('auth.mfa.errors.accountLocked', 'Account locked. Please try again later.'))
        } else if (result.error?.toLowerCase().includes('expired')) {
          setError(t('auth.mfa.errors.expiredCode', 'Code has expired. Please request a new one.'))
        } else {
          setError(result.error || t('auth.mfa.errors.invalidCode', 'Invalid code'))
        }

        setCode(['', '', '', '', '', ''])
        document.getElementById('mfa-code-0')?.focus()
        return
      }

      toast.success(t('auth.mfa.success', 'Authentication verified!'))
      const redirect = result.redirect || (profile?.role === 'vendor' ? '/vendor/dashboard' : '/marketplace')
      navigate(redirect)
    } catch (err) {
      logger.error('MFA verification error:', err)
      setError(t('auth.mfa.errors.verificationFailed', 'Failed to verify code'))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    await signOut()
    navigate('/login')
  }

  const isLocked = locked || (mfaSettings?.locked_until && new Date(mfaSettings.locked_until).getTime() > Date.now())

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (checkingMFA) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
        <div className="text-center auth-fade-in">
          <div className="w-16 h-16 border-4 border-green-200 dark:border-green-800 rounded-full animate-spin border-t-green-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('auth.mfa.checkingMFA', 'Checking MFA status...')}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const codeComplete = code.join('').length === 6
  const countdownPct = countdown !== null ? (countdown / TOTP_PERIOD) * 100 : 100
  const countdownUrgent = countdown !== null && countdown <= 8

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/40 to-emerald-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-start justify-center p-4 pt-8 pb-16">

      {/* ── Top bar: lang switcher + dark mode ── */}
      <div className="fixed top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-white/70 dark:bg-gray-950/70 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50">
        {/* Logo */}
        <Logo size="sm" showText={true} textClass="text-gray-900 dark:text-white hidden sm:inline" />

        {/* Language switcher */}
        <div className="flex items-center gap-2">
          {LANGS.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                i18n.changeLanguage(lang.code)
                setLanguage(lang.code)
              }}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                (language || i18n.language || 'ar').startsWith(lang.code)
                  ? 'bg-green-100 text-green-800'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {lang.label}
            </button>
          ))}

          <button
            onClick={toggleDark}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Main card ── */}
      <div className="w-full max-w-md mt-16 auth-fade-in">
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-white/60 dark:border-gray-800/60">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <ShieldCheckIcon className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('auth.mfa.title', 'Two-Factor Authentication')}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {t('auth.mfa.totpDescription', 'Open your authenticator app and enter the current code')}
            </p>
          </div>

          {/* User info */}
          <div className="flex items-center gap-3 p-4 bg-gray-50/80 dark:bg-gray-800/50 rounded-2xl mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <DevicePhoneMobileIcon className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user?.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('auth.mfa.secureLogin', 'Secure login required')}
              </p>
            </div>
          </div>

          {/* Lockout message */}
          {isLocked && (
            <div className="mb-6 p-4 bg-red-50/80 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl flex items-start gap-3">
              <LockClosedIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  {t('auth.mfa.errors.accountLocked', 'Account locked')}
                </p>
                {retryAfter !== null && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {t('auth.mfa.retryAfter', 'Try again in {{seconds}} seconds', { seconds: retryAfter })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TOTP countdown */}
          {mfaSettings?.method === 'totp' && !isLocked && (
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                <span className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  {t('auth.mfa.codeExpiresIn', 'Code expires in')}
                </span>
                <span className={countdownUrgent ? 'text-red-600 font-medium' : ''}>{countdown}s</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 rounded-full ${
                    countdownUrgent ? 'bg-red-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${countdownPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Code form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
                {t('auth.mfa.enterCode', 'Enter the 6-digit code')}
              </label>
              <div className="flex justify-center gap-2 sm:gap-3" dir="ltr">
                {code.map((digit, index) => (
                  <input
                    key={`mfa-code-${index}`}
                    id={`mfa-code-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={isLocked || loading}
                    className="w-12 h-14 sm:w-14 sm:h-16 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-center text-2xl font-bold text-gray-900 dark:text-white outline-none transition-all duration-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 focus:bg-white dark:focus:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                ))}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div role="alert" className="p-4 bg-red-50/80 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl">
                <p className="text-sm text-red-700 dark:text-red-300 text-center">{error}</p>
                {attemptsRemaining !== null && attemptsRemaining > 0 && !isLocked && (
                  <p className="text-xs text-red-600 dark:text-red-400 text-center mt-1">
                    {t('auth.mfa.attemptsRemaining', 'Attempts remaining: {{count}}', { count: attemptsRemaining })}
                  </p>
                )}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={!codeComplete || loading || isLocked}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg shadow-green-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('auth.mfa.verifying', 'Verifying...')}
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-5 h-5" />
                  {t('auth.mfa.verifyCode', 'Verify Code')}
                </>
              )}
            </button>
          </form>

          {/* Help section */}
          <div className="mt-6 border-t border-gray-100 dark:border-gray-800 pt-4">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center justify-center gap-2 w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <QuestionMarkCircleIcon className="w-4 h-4" />
              {t('auth.mfa.needHelp.title', 'Need help?')}
              {showHelp ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
            </button>

            {showHelp && (
              <div className="mt-3 p-4 bg-gray-50/80 dark:bg-gray-800/50 rounded-2xl text-sm text-gray-600 dark:text-gray-400">
                <p className="mb-2">
                  {t('auth.mfa.helpText', 'If you cannot access your MFA method, please contact support.')}
                </p>
              </div>
            )}
          </div>

          {/* Cancel / Sign out */}
          <button
            onClick={handleCancel}
            className="w-full mt-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('auth.mfa.cancelAndSignOut', 'Cancel and sign out')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default MFAVerify
