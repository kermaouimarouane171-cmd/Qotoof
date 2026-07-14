import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Input, Button, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { newPasswordSchema } from '@/utils/validationSchemas'
import { ExclamationCircleIcon, KeyIcon } from '@heroicons/react/24/outline'
import AuthCard from '@/components/auth/AuthCard'
import AuthHeader from '@/components/auth/AuthHeader'

// How long to wait for the PASSWORD_RECOVERY event before declaring the link invalid
const RECOVERY_TIMEOUT_MS = 8000

const ResetPasswordPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const storeLoading = useAuthStore((s) => s.loading)
  const storePasswordRecoveryMode = useAuthStore((s) => s.passwordRecoveryMode)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState('')

  // Track whether a valid PASSWORD_RECOVERY session has been established
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [linkInvalid, setLinkInvalid] = useState(false)
  const recoveryTimeoutRef = useRef(null)

  useEffect(() => {
    // If the store already has passwordRecoveryMode set (e.g. from a prior navigation),
    // mark ready immediately.
    if (storePasswordRecoveryMode) {
      setRecoveryReady(true)
      return
    }

    // Otherwise, listen for the Supabase PASSWORD_RECOVERY event directly.
    // This fires when Supabase SDK picks up the recovery token from the URL hash/code.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryReady(true)
        setLinkInvalid(false)
        if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current)
      }
    })

    // After timeout, if still not ready (and store auth init is done), mark invalid
    recoveryTimeoutRef.current = setTimeout(() => {
      setRecoveryReady((ready) => {
        if (!ready) setLinkInvalid(true)
        return ready
      })
    }, RECOVERY_TIMEOUT_MS)

    return () => {
      subscription.unsubscribe()
      if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If store's passwordRecoveryMode becomes true later (set by onAuthStateChange handler
  // in authSessionStore), sync local state
  useEffect(() => {
    if (storePasswordRecoveryMode) {
      setRecoveryReady(true)
      setLinkInvalid(false)
      if (recoveryTimeoutRef.current) clearTimeout(recoveryTimeoutRef.current)
    }
  }, [storePasswordRecoveryMode])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const parsed = newPasswordSchema.safeParse({
      password,
      confirmPassword,
    })

    if (!parsed.success) {
      setError(parsed.error.issues?.[0]?.message || t('auth.resetPassword.validation.default', 'تحقق من المدخلات'))
      return
    }

    setSubmitLoading(true)
    const result = await updatePassword(parsed.data.password)
    setSubmitLoading(false)

    if (!result.success) {
      setError(result.error || t('auth.resetPassword.error.default', 'تعذر تحديث كلمة المرور'))
      return
    }

    navigate('/login', {
      replace: true,
      state: {
        message: t('auth.resetPassword.success', 'تم تحديث كلمة المرور بنجاح. سجل الدخول الآن.'),
      },
    })
  }

  // ── Loading state: waiting for auth init or PASSWORD_RECOVERY event ──────────

  if (storeLoading || (!recoveryReady && !linkInvalid)) {
    return (
      <AuthCard>
        <div className="text-center py-8" dir="rtl">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-gray-500">
            {t('auth.resetPassword.verifying', 'جارٍ التحقق من الرابط...')}
          </p>
        </div>
      </AuthCard>
    )
  }

  // ── Invalid / expired link ───────────────────────────────────────────────────

  if (linkInvalid) {
    return (
      <AuthCard>
        <div className="text-center py-4" dir="rtl">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
            <ExclamationCircleIcon className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {t('auth.resetPassword.linkInvalid.title', 'الرابط غير صالح أو منتهي الصلاحية')}
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            {t('auth.resetPassword.linkInvalid.message', 'انتهت صلاحية رابط إعادة تعيين كلمة المرور. يُرجى طلب رابط جديد.')}
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center justify-center h-12 px-6 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-sm hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-600/20"
            data-cy="reset-request-new-link"
          >
            {t('auth.resetPassword.linkInvalid.requestNew', 'طلب رابط جديد')}
          </Link>
        </div>
      </AuthCard>
    )
  }

  // ── Password form (valid recovery session present) ───────────────────────────

  return (
    <AuthCard>
      <AuthHeader
        icon={<KeyIcon className="w-8 h-8 text-green-600" />}
        title={t('auth.resetPassword.title', 'إعادة تعيين كلمة المرور')}
        subtitle={t('auth.resetPassword.subtitle', 'أدخل كلمة المرور الجديدة ثم أكدها')}
      />

      {error && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700" data-cy="reset-password-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" data-cy="reset-password-form">
        <Input
          type="password"
          name="password"
          label={t('auth.resetPassword.newPassword', 'كلمة المرور الجديدة')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.resetPassword.newPasswordPlaceholder', 'أدخل كلمة المرور الجديدة')}
          data-cy="reset-password-input"
        />

        <Input
          type="password"
          name="confirmPassword"
          label={t('auth.resetPassword.confirmPassword', 'تأكيد كلمة المرور')}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('auth.resetPassword.confirmPasswordPlaceholder', 'أعد إدخال كلمة المرور')}
          data-cy="reset-confirm-password-input"
        />

        <Button type="submit" variant="primary" className="w-full" isLoading={submitLoading} data-cy="reset-password-submit-button">
          {t('auth.resetPassword.submit', 'تحديث كلمة المرور')}
        </Button>
      </form>
    </AuthCard>
  )
}

export default ResetPasswordPage
