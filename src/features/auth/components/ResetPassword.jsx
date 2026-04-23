import { useTranslation } from 'react-i18next';
import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Alert from '../../../components/ui/Alert';
import Card from '../../../components/ui/Card';
import ErrorBoundary from '../../../components/ErrorBoundary';

// Password reset validation
const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),

  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

/**
 * ResetPassword Component - Password reset form
 * 
 * Features:
 * - Token validation from URL
 * - Password strength indicator
 * - Show/hide password toggle
 * - Error handling
 * - Success message
 * - Redirect to login
 * - Multi-language support
 * 
 * @component
 */
function ResetPasswordContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onBlur',
  });

  const password = watch('password');

  // Calculate password strength
  const calculatePasswordStrength = useCallback((pwd) => {
    let strength = 0;
    if (pwd.length >= 8) strength += 20;
    if (pwd.length >= 12) strength += 20;
    if (/[A-Z]/.test(pwd)) strength += 15;
    if (/[a-z]/.test(pwd)) strength += 15;
    if (/[0-9]/.test(pwd)) strength += 15;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 15;
    return Math.min(strength, 100);
  }, []);

  const handlePasswordChange = useCallback((e) => {
    const pwd = e.target.value;
    setPasswordStrength(calculatePasswordStrength(pwd));
  }, [calculatePasswordStrength]);

  // Reset password mutation
  const { mutate: resetPassword, isPending, error: apiError } = useMutation({
    mutationFn: async (data) => {
      if (!token) throw new Error('Invalid reset token');

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          email,
          password: data.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('auth.resetPassword.error'));
      }

      return response.json();
    },
    onSuccess: () => {
      setResetSuccess(true);
      reset();
      setTimeout(() => {
        navigate('/auth/login');
      }, 3000);
    },
  });

  const onSubmit = (data) => {
    resetPassword(data);
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 30) return 'bg-red-500';
    if (passwordStrength < 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <Alert type="error" message={t('auth.resetPassword.invalidToken')} />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('auth.resetPassword.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('auth.resetPassword.subtitle')}
          </p>
        </div>

        {apiError && (
          <Alert 
            type="error" 
            message={apiError.message}
            className="mb-6"
          />
        )}

        {resetSuccess && (
          <div className="space-y-4">
            <Alert 
              type="success" 
              message={t('auth.resetPassword.success')}
            />
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              {t('auth.resetPassword.redirecting')}
            </p>
          </div>
        )}

        {!resetSuccess && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* New Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.resetPassword.password')}
              </label>
              <div className="relative">
                <Input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.resetPassword.passwordPlaceholder')}
                  error={errors.password?.message}
                  disabled={isPending}
                  onChange={(e) => {
                    register('password').onChange(e);
                    handlePasswordChange(e);
                  }}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  tabIndex="-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '👁️‍🗨️' : '👁️'}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {t('auth.resetPassword.strength')}
                    </span>
                    <span className="text-xs font-medium">
                      {passwordStrength}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getPasswordStrengthColor()} transition-all duration-300`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('auth.resetPassword.confirmPassword')}
              </label>
              <Input
                {...register('confirmPassword')}
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
                error={errors.confirmPassword?.message}
                disabled={isPending}
                required
                autoComplete="new-password"
              />
            </div>

            {/* Password Requirements */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('auth.resetPassword.requirements')}
              </p>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li>• {t('auth.resetPassword.requirement1')}</li>
                <li>• {t('auth.resetPassword.requirement2')}</li>
                <li>• {t('auth.resetPassword.requirement3')}</li>
                <li>• {t('auth.resetPassword.requirement4')}</li>
              </ul>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isPending}
              loading={isPending}
              className="w-full mt-6"
            >
              {t('auth.resetPassword.button')}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <ErrorBoundary>
      <ResetPasswordContent />
    </ErrorBoundary>
  );
}

ResetPassword.propTypes = {};
