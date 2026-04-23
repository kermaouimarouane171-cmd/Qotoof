import { useTranslation } from 'react-i18next';
import { useCallback, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '../../../utils/validationSchemas';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Alert from '../../../components/ui/Alert';
import Card from '../../../components/ui/Card';
import ErrorBoundary from '../../../components/ErrorBoundary';

/**
 * Register Component - User registration form
 * 
 * Features:
 * - Full form validation with Zod
 * - Role selection (Buyer, Vendor, Driver)
 * - Password strength indicator
 * - Email verification link
 * - Terms & conditions checkbox
 * - Loading state
 * - Error handling
 * - Multi-language support with RTL
 * - Accessibility compliant
 * 
 * @component
 */
function RegisterContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(registerSchema),
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

  // Monitor password strength
  const handlePasswordChange = useCallback((e) => {
    const pwd = e.target.value;
    setPasswordStrength(calculatePasswordStrength(pwd));
  }, [calculatePasswordStrength]);

  // Register mutation
  const { mutate: registerUser, isPending, error: apiError } = useMutation({
    mutationFn: async (data) => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
          role: data.role,
          phone: data.phone,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('auth.register.error'));
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Store token if provided
      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      // Show success message and redirect
      navigate('/auth/verify-email', { 
        state: { email: data.email } 
      });
      reset();
    },
  });

  const onSubmit = (data) => {
    if (!agreeTerms) {
      alert(t('auth.register.termsRequired'));
      return;
    }
    registerUser(data);
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 30) return 'bg-red-500';
    if (passwordStrength < 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('auth.register.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('auth.register.subtitle')}
          </p>
        </div>

        {apiError && (
          <Alert 
            type="error" 
            message={apiError.message}
            className="mb-6"
          />
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.register.firstName')}
            </label>
            <Input
              {...register('firstName')}
              id="firstName"
              type="text"
              placeholder={t('auth.register.firstNamePlaceholder')}
              error={errors.firstName?.message}
              disabled={isPending}
              required
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.register.lastName')}
            </label>
            <Input
              {...register('lastName')}
              id="lastName"
              type="text"
              placeholder={t('auth.register.lastNamePlaceholder')}
              error={errors.lastName?.message}
              disabled={isPending}
              required
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.register.email')}
            </label>
            <Input
              {...register('email')}
              id="email"
              type="email"
              placeholder={t('auth.register.emailPlaceholder')}
              error={errors.email?.message}
              disabled={isPending}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.register.password')}
            </label>
            <div className="relative">
              <Input
                {...register('password')}
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.register.passwordPlaceholder')}
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
                    {t('auth.register.passwordStrength')}
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
              {t('auth.register.confirmPassword')}
            </label>
            <Input
              {...register('confirmPassword')}
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('auth.register.confirmPasswordPlaceholder')}
              error={errors.confirmPassword?.message}
              disabled={isPending}
              required
              autoComplete="new-password"
            />
          </div>

          {/* Phone (Optional) */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.register.phone')} ({t('auth.register.optional')})
            </label>
            <Input
              {...register('phone')}
              id="phone"
              type="tel"
              placeholder={t('auth.register.phonePlaceholder')}
              error={errors.phone?.message}
              disabled={isPending}
            />
          </div>

          {/* Role Selection */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('auth.register.role')}
            </label>
            <Select
              {...register('role')}
              id="role"
              error={errors.role?.message}
              disabled={isPending}
              required
            >
              <option value="">{t('auth.register.selectRole')}</option>
              <option value="buyer">{t('auth.register.buyerRole')}</option>
              <option value="vendor">{t('auth.register.vendorRole')}</option>
              <option value="driver">{t('auth.register.driverRole')}</option>
            </Select>
          </div>

          {/* Terms & Conditions */}
          <div className="flex items-start">
            <input
              type="checkbox"
              id="agreeTerms"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1 mr-2 rounded"
              disabled={isPending}
              required
            />
            <label htmlFor="agreeTerms" className="text-sm text-gray-700 dark:text-gray-300">
              {t('auth.register.agreeTerms')}{' '}
              <Link to="/terms" className="text-blue-600 hover:text-blue-800 dark:text-blue-400">
                {t('auth.register.termsLink')}
              </Link>
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isPending}
            loading={isPending}
            className="w-full mt-6"
          >
            {t('auth.register.button')}
          </Button>
        </form>

        {/* Login Link */}
        <p className="text-center mt-6 text-gray-600 dark:text-gray-400">
          {t('auth.register.haveAccount')}{' '}
          <Link to="/auth/login" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium">
            {t('auth.register.loginLink')}
          </Link>
        </p>
      </Card>
    </div>
  );
}

export default function Register() {
  return (
    <ErrorBoundary>
      <RegisterContent />
    </ErrorBoundary>
  );
}

Register.propTypes = {};
