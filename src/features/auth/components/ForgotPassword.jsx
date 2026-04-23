import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { passwordResetSchema } from '../../../utils/validationSchemas';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Alert from '../../../components/ui/Alert';
import Card from '../../../components/ui/Card';
import ErrorBoundary from '../../../components/ErrorBoundary';

/**
 * ForgotPassword Component - Password recovery form
 * 
 * Features:
 * - Email verification
 * - Resend email option
 * - Loading state
 * - Error handling
 * - Success message
 * - Multi-language support
 * - Accessibility compliant
 * 
 * @component
 */
function ForgotPasswordContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [resendCountdown, setResendCountdown] = useState(0);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(passwordResetSchema),
    mode: 'onBlur',
  });

  const email = watch('email');

  // Forgot password mutation
  const { mutate: sendResetEmail, isPending, error: apiError } = useMutation({
    mutationFn: async (data) => {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('auth.forgotPassword.error'));
      }

      return response.json();
    },
    onSuccess: () => {
      setEmailSent(true);
      // Start countdown for resend button
      setResendCountdown(60);
      const interval = setInterval(() => {
        setResendCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      reset();
    },
  });

  const onSubmit = (data) => {
    sendResetEmail(data);
  };

  const handleResend = useCallback(() => {
    if (email && resendCountdown === 0) {
      sendResetEmail({ email });
    }
  }, [email, resendCountdown, sendResetEmail]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('auth.forgotPassword.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('auth.forgotPassword.subtitle')}
          </p>
        </div>

        {apiError && (
          <Alert 
            type="error" 
            message={apiError.message}
            className="mb-6"
          />
        )}

        {emailSent ? (
          <div className="space-y-6">
            <Alert 
              type="success" 
              message={t('auth.forgotPassword.emailSent')}
            />
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                {t('auth.forgotPassword.checkEmail')}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {t('auth.forgotPassword.checkSpam')}
              </p>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={resendCountdown > 0 || isPending}
              >
                {resendCountdown > 0 
                  ? `${t('auth.forgotPassword.resendIn')} ${resendCountdown}s`
                  : t('auth.forgotPassword.resend')
                }
              </Button>

              <Link to="/auth/login" className="block">
                <Button
                  type="button"
                  className="w-full"
                >
                  {t('auth.forgotPassword.backToLogin')}
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('auth.forgotPassword.email')}
              </label>
              <Input
                {...register('email')}
                id="email"
                type="email"
                placeholder={t('auth.forgotPassword.emailPlaceholder')}
                error={errors.email?.message}
                disabled={isPending}
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {t('auth.forgotPassword.instructions')}
              </p>
            </div>

            <Button
              type="submit"
              disabled={isPending}
              loading={isPending}
              className="w-full"
            >
              {t('auth.forgotPassword.button')}
            </Button>
          </form>
        )}

        {/* Back to Login Link */}
        {!emailSent && (
          <p className="text-center mt-6 text-gray-600 dark:text-gray-400">
            {t('auth.forgotPassword.rememberPassword')}{' '}
            <Link to="/auth/login" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium">
              {t('auth.forgotPassword.loginLink')}
            </Link>
          </p>
        )}
      </Card>
    </div>
  );
}

export default function ForgotPassword() {
  return (
    <ErrorBoundary>
      <ForgotPasswordContent />
    </ErrorBoundary>
  );
}

ForgotPassword.propTypes = {};
