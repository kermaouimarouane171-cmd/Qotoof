import { useTranslation } from 'react-i18next';
import { useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import Button from '../../../components/ui/Button';
import Alert from '../../../components/ui/Alert';
import Card from '../../../components/ui/Card';
import ErrorBoundary from '../../../components/ErrorBoundary';

/**
 * TwoFactor Component - Two-factor authentication verification
 * 
 * Features:
 * - OTP input with auto-focus
 * - SMS/Email selection
 * - Resend code option with countdown
 * - Error handling
 * - Success redirect
 * - Multi-language support
 * - Accessible design
 * 
 * @component
 */
function TwoFactorContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [deliveryMethod, setDeliveryMethod] = useState(location.state?.deliveryMethod || 'sms');
  const inputRefs = useRef([]);
  const email = location.state?.email || '';

  // Verify 2FA code mutation
  const { mutate: verifyCode, isPending, error: apiError } = useMutation({
    mutationFn: async (verificationCode) => {
      const response = await fetch('/api/auth/verify-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: verificationCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('auth.twoFactor.error'));
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
    },
  });

  // Resend code mutation
  const { mutate: resendCode, isPending: resendPending } = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/resend-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          method: deliveryMethod,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('auth.twoFactor.resendError'));
      }

      return response.json();
    },
    onSuccess: () => {
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
    },
  });

  // Handle code input
  const handleCodeChange = useCallback((index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);

    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every((digit) => digit) && newCode.length === 6) {
      verifyCode(newCode.join(''));
    }
  }, [code, verifyCode]);

  // Handle backspace
  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [code]);

  const handleResend = useCallback(() => {
    if (resendCountdown === 0) {
      resendCode();
    }
  }, [resendCountdown, resendCode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full mb-4">
            <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('auth.twoFactor.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('auth.twoFactor.subtitle')}
          </p>
        </div>

        {apiError && (
          <Alert 
            type="error" 
            message={apiError.message}
            className="mb-6"
          />
        )}

        <div className="space-y-6">
          {/* Delivery Method Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('auth.twoFactor.deliveryMethod')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['sms', 'email'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setDeliveryMethod(method)}
                  className={`py-2 px-3 rounded-lg border-2 transition-all ${
                    deliveryMethod === method
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                  disabled={isPending}
                >
                  <span className="text-sm font-medium">
                    {method === 'sms' ? '📱 SMS' : '📧 Email'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Code Input Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('auth.twoFactor.enterCode')}
            </label>
            <div className="flex gap-2 justify-center">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={isPending}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Loading Message */}
          {isPending && (
            <Alert 
              type="info" 
              message={t('auth.twoFactor.verifying')}
            />
          )}

          {/* Resend Code */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {t('auth.twoFactor.noCode')}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={resendCountdown > 0 || resendPending || isPending}
              onClick={handleResend}
              className="w-full"
            >
              {resendCountdown > 0 
                ? `${t('auth.twoFactor.resendIn')} ${resendCountdown}s`
                : t('auth.twoFactor.resend')
              }
            </Button>
          </div>

          {/* Help Text */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <p className="text-xs text-gray-700 dark:text-gray-300">
              {t('auth.twoFactor.instructions')}
            </p>
          </div>

          {/* Backup Code Option */}
          <div className="text-center">
            <button
              type="button"
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
              onClick={() => navigate('/auth/backup-codes')}
            >
              {t('auth.twoFactor.useBackupCode')}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function TwoFactor() {
  return (
    <ErrorBoundary>
      <TwoFactorContent />
    </ErrorBoundary>
  );
}

TwoFactor.propTypes = {};
