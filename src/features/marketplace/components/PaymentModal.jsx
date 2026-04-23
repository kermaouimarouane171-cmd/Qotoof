/**
 * 💳 PaymentModal Component
 * Modal for processing card payments (Stripe, CMI, etc.)
 * Features: Card input, billing address, payment processing, error handling
 * 
 * @component
 * @returns {React.ReactElement} Payment processing modal
 */

import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

// UI imports
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import Alert from '../../../components/ui/Alert';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorBoundary from '../../../components/ErrorBoundary';

// ============================================
// VALIDATION SCHEMA
// ============================================

const cardPaymentSchema = z.object({
  cardNumber: z
    .string()
    .regex(/^\d{13,19}$/, 'Card number must be 13-19 digits')
    .transform((val) => val.replace(/\s/g, '')),

  cardholderName: z
    .string()
    .min(3, 'Cardholder name must be at least 3 characters')
    .max(100, 'Cardholder name must be less than 100 characters'),

  expiryDate: z
    .string()
    .regex(/^\d{2}\/\d{2}$/, 'Expiry date must be MM/YY format'),

  cvc: z
    .string()
    .regex(/^\d{3,4}$/, 'CVC must be 3 or 4 digits'),

  billingAddress: z
    .string()
    .min(5, 'Billing address is required')
    .optional(),

  savCard: z.boolean().default(false),
});

// ============================================
// PAYMENT MODAL COMPONENT
// ============================================

/**
 * PaymentModal - Card payment processing modal
 * @param {Object} props
 * @param {string} props.paymentMethod - Payment method (cmi, cod, bank)
 * @param {number} props.amount - Payment amount
 * @param {Function} props.onClose - Close modal handler
 * @param {Function} props.onSuccess - Success callback
 * @param {string} props.orderId - Order ID for reference
 */
export default function PaymentModal({
  paymentMethod = 'cmi',
  amount = 0,
  onClose = () => {},
  onSuccess = () => {},
  orderId = '',
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState('details'); // details, processing, success, error

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(cardPaymentSchema),
    mode: 'onBlur',
    defaultValues: {
      cardNumber: '',
      cardholderName: '',
      expiryDate: '',
      cvc: '',
      billingAddress: '',
      savCard: false,
    },
  });

  // Card number for formatting display
  const cardNumber = watch('cardNumber');

  // Process payment mutation
  const { mutate: processPayment, isPending: isProcessing, error: paymentError } = useMutation({
    mutationFn: async (paymentData) => {
      setStep('processing');

      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount,
          method: paymentMethod,
          ...paymentData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Payment processing failed');
      }

      return response.json();
    },

    onSuccess: (data) => {
      setStep('success');
      setTimeout(() => {
        onSuccess(data);
        onClose();
      }, 2000);
    },

    onError: () => {
      setStep('error');
    },
  });

  // ============================================
  // HANDLERS
  // ============================================

  const handlePaymentSubmit = useCallback(
    (data) => {
      processPayment(data);
    },
    [processPayment]
  );

  // ============================================
  // RENDER STATES
  // ============================================

  return (
    <ErrorBoundary>
      <Modal isOpen onClose={onClose} size="lg">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t(`payment.method.${paymentMethod}`)} {t('payment.payment')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('payment.amount')}: {amount.toFixed(2)} DH
            </p>
          </div>

          {step === 'details' && (
            <PaymentDetailsForm
              register={register}
              handleSubmit={handleSubmit}
              onSubmit={handlePaymentSubmit}
              errors={errors}
              cardNumber={cardNumber}
              paymentMethod={paymentMethod}
              isLoading={isProcessing}
              onCancel={onClose}
            />
          )}

          {step === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner size="lg" className="mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {t('payment.processing')}...
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <span className="text-3xl">✓</span>
              </div>
              <h3 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">
                {t('payment.success')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('payment.redirecting')}...
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Alert
                type="error"
                title={t('payment.failed')}
                message={paymentError?.message || t('payment.genericError')}
                className="mb-4 w-full"
              />
              <Button onClick={() => setStep('details')} variant="primary">
                {t('payment.tryAgain')}
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </ErrorBoundary>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function PaymentDetailsForm({
  register,
  handleSubmit,
  onSubmit,
  errors,
  cardNumber,
  isLoading,
  onCancel,
}) {
  const { t } = useTranslation();

  // Get card type from number
  const getCardType = (number) => {
    const cleaned = number.replace(/\D/g, '');
    if (/^4/.test(cleaned)) return 'Visa';
    if (/^5[1-5]/.test(cleaned)) return 'Mastercard';
    if (/^3[47]/.test(cleaned)) return 'Amex';
    return 'Card';
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Card Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('payment.cardNumber')}
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="1234 5678 9012 3456"
            maxLength="19"
            {...register('cardNumber')}
            onChange={(e) => {
              // Format input with spaces
              const formatted = e.target.value
                .replace(/\D/g, '')
                .replace(/(\d{4})(?=\d)/g, '$1 ');
              e.target.value = formatted;
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
          />
          {cardNumber && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              {getCardType(cardNumber)}
            </span>
          )}
        </div>
        {errors.cardNumber && (
          <p className="text-red-500 text-sm mt-1">{errors.cardNumber.message}</p>
        )}
      </div>

      {/* Cardholder Name */}
      <Input
        label={t('payment.cardholderName')}
        placeholder="Full name as shown on the card"
        {...register('cardholderName')}
        error={errors.cardholderName?.message}
        disabled={isLoading}
      />

      {/* Expiry & CVC */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="payment-expiry-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('payment.expiryDate')}
          </label>
          <input
            id="payment-expiry-date"
            type="text"
            placeholder="MM/YY"
            maxLength="5"
            {...register('expiryDate')}
            onChange={(e) => {
              const value = e.target.value
                .replace(/\D/g, '')
                .substring(0, 4);
              if (value.length >= 2) {
                e.target.value = value.substring(0, 2) + '/' + value.substring(2);
              } else {
                e.target.value = value;
              }
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
          />
          {errors.expiryDate && (
            <p className="text-red-500 text-sm mt-1">{errors.expiryDate.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="payment-cvc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            CVV/CVC
          </label>
          <input
            id="payment-cvc"
            type="text"
            placeholder="123"
            maxLength="4"
            {...register('cvc')}
            onChange={(e) => {
              e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
          />
          {errors.cvc && (
            <p className="text-red-500 text-sm mt-1">{errors.cvc.message}</p>
          )}
        </div>
      </div>

      {/* Billing Address */}
      <Input
        label={t('payment.billingAddress')}
        {...register('billingAddress')}
        error={errors.billingAddress?.message}
        placeholder="123 Street Address, City, State 12345"
        disabled={isLoading}
      />

      {/* Save Card Checkbox */}
      <label htmlFor="save-card-checkbox" className="flex items-center">
        <input
          id="save-card-checkbox"
          type="checkbox"
          {...register('savCard')}
          className="w-4 h-4 rounded border-gray-300"
        />
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
          {t('payment.saveCard')}
        </span>
      </label>

      {/* Security Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-700 dark:text-blue-400">
          🔒 {t('payment.secureMessage')}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 pt-4">
        <Button
          type="button"
          onClick={onCancel}
          variant="secondary"
          className="flex-1"
          disabled={isLoading}
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          loading={isLoading}
        >
          {t('payment.pay')} {/* Amount shown in parent */}
        </Button>
      </div>
    </form>
  );
}

PaymentModal.propTypes = {
  paymentMethod: PropTypes.oneOf(['cmi', 'cod', 'bank']),
  amount: PropTypes.number,
  onClose: PropTypes.func,
  onSuccess: PropTypes.func,
  orderId: PropTypes.string,
};
