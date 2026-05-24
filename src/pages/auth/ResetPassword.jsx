import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Input, Button } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { newPasswordSchema } from '@/utils/validationSchemas'

const ResetPasswordPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const updatePassword = useAuthStore((s) => s.updatePassword)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

    setLoading(true)
    const result = await updatePassword(parsed.data.password)
    setLoading(false)

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

  return (
    <div className="max-w-md mx-auto" dir="rtl" data-cy="reset-password-page">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {t('auth.resetPassword.title', 'إعادة تعيين كلمة المرور')}
      </h2>
      <p className="text-gray-600 mb-6">
        {t('auth.resetPassword.subtitle', 'أدخل كلمة المرور الجديدة ثم أكدها')}
      </p>

      {error && (
        <div className="alert-error mb-4" data-cy="reset-password-error">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" data-cy="reset-password-form">
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

        <Button type="submit" variant="primary" className="w-full" isLoading={loading} data-cy="reset-password-submit-button">
          {t('auth.resetPassword.submit', 'تحديث كلمة المرور')}
        </Button>
      </form>
    </div>
  )
}

export default ResetPasswordPage
