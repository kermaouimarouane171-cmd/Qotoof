import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import Button from '../../../components/ui/Button';
import Alert from '../../../components/ui/Alert';
import Card from '../../../components/ui/Card';
import ErrorBoundary from '../../../components/ErrorBoundary';

/**
 * VerifyEmail Component - Email verification form
 * 
 * Features:
 * - OTP/Code input with auto-focus
 * - Auto-submit on complete
 * - Resend email option with countdown
 * - Error handling
 * - Success redirect
 * - Multi-language support
 * - Accessible input fields
 * 
 * @component
 */
function VerifyEmailContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resendCountdown, setResendCountdown] = useState(0);
  const inputRefs = useRef([]);
  const email = location.state?.email || '';

  // Verify email mutation
  const { mutate: verifyEmail, isPending, error: apiError } = useMutation({
    mutationFn: async (verificationCode) => {
      const response = await fetch('/api/auth/verify-email', {
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
        throw new Error(error.message || t('auth.verifyEmail.error'));
      }

      return response.json();
    },
    onSuccess: () => {
      setTimeout(() => {
        navigate('/auth/login', {
          replace: true,
          state: { verified: true },
        });
      }, 2000);
    },
  });

  // Resend email mutation
  const { mutate: resendEmail, isPending: resendPending } = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/resend-verification-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('auth.verifyEmail.resendError'));
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
    if (!/^\d*$/.test(value)) return; // Only digits

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Only last character

    setCode(newCode);

    // Auto-focus to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are entered
    if (newCode.every((digit) => digit) && newCode.length === 6) {
      verifyEmail(newCode.join(''));
    }
  }, [code, verifyEmail]);

  // Handle backspace
  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [code]);

  // Auto-calculate digits provided
  useEffect(() => {
    if (code.every((digit) => digit)) {
      const fullCode = code.join('');
      verifyEmail(fullCode);
    }
  }, [code, verifyEmail]);

  const handleResend = useCallback(() => {
    if (resendCountdown === 0) {
      resendEmail();
    }
  }, [resendCountdown, resendEmail]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('auth.verifyEmail.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {t('auth.verifyEmail.subtitle')}
          </p>
          {email && (
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {email}
            </p>
          )}
        </div>

        {apiError && (
          <Alert 
            type="error" 
            message={apiError.message}
            className="mb-6"
          />
        )}

        <div className="space-y-6">
          {/* Code Input Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('auth.verifyEmail.enterCode')}
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
              message={t('auth.verifyEmail.verifying')}
            />
          )}

          {/* Resend Code */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {t('auth.verifyEmail.noCode')}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={resendCountdown > 0 || resendPending || isPending}
              onClick={handleResend}
              className="w-full"
            >
              {resendCountdown > 0 
                ? `${t('auth.verifyEmail.resendIn')} ${resendCountdown}s`
                : t('auth.verifyEmail.resend')
              }
            </Button>
          </div>

          {/* Help Text */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <p className="text-xs text-gray-700 dark:text-gray-300">
              {t('auth.verifyEmail.checkSpam')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <ErrorBoundary>
      <VerifyEmailContent />
    </ErrorBoundary>
  );
}

VerifyEmail.propTypes = {};
