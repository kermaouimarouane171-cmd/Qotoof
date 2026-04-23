/**
 * 🛒 Checkout Component
 * Multi-step checkout form with cart review, shipping, payment & order confirmation
 * Features: Step indicator, address validation, payment method selection, error handling
 * 
 * @component
 * @returns {React.ReactElement} Multi-step checkout form
 */

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import clsx from 'clsx';

// Store & UI imports
import { useCartStore } from '../../../store/cartStore';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';
import Alert from '../../../components/ui/Alert';
import Modal from '../../../components/ui/Modal';
import ErrorBoundary from '../../../components/ErrorBoundary';
import LocationPicker from '../../../components/ui/LocationPicker';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const addressSchema = z.object({
  fullName: z
    .string()
    .min(3, 'Full name must be at least 3 characters')
    .max(100, 'Full name must be less than 100 characters'),

  phone: z
    .string()
    .regex(
      /^\+?212[5-9]\d{8}$|^0[5-7]\d{8}$/,
      'Invalid Moroccan phone number'
    ),

  street: z
    .string()
    .min(5, 'Street address is required')
    .max(200, 'Street address must be less than 200 characters'),

  city: z
    .string()
    .min(2, 'City is required')
    .max(50, 'City must be less than 50 characters'),

  zipCode: z
    .string()
    .regex(/^\d{5}$/, 'Zip code must be 5 digits')
    .optional(),

  country: z
    .string()
    .default('Morocco'),
});

const deliverySchema = z.object({
  deliveryDate: z
    .string()
    .min(1, 'Please select a delivery date'),

  deliveryTime: z
    .string()
    .min(1, 'Please select a delivery time slot'),
});

const paymentSchema = z.object({
  paymentMethod: z
    .enum(['cmi', 'cod', 'bank'], {
      errorMap: () => ({ message: 'Please select a payment method' }),
    }),

  cardNumber: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{13,19}$/.test(val), 'Invalid card number'),

  cardExpiry: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{2}\/\d{2}$/.test(val), 'Invalid expiry date (MM/YY)'),

  cardCVC: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{3,4}$/.test(val), 'Invalid CVC'),
});

// ============================================
// CHECKOUT COMPONENT
// ============================================

/**
 * Checkout - Multi-step checkout form component
 * @param {Object} props
 */
export default function Checkout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);

  // Local state
  const [currentStep, setCurrentStep] = useState(1);
  const [savedFormData, setSavedFormData] = useState({});
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState(null);

  // Form hooks for each step
  const addressForm = useForm({
    resolver: zodResolver(addressSchema),
    mode: 'onBlur',
    defaultValues: savedFormData.address || {},
  });

  const deliveryForm = useForm({
    resolver: zodResolver(deliverySchema),
    mode: 'onBlur',
    defaultValues: savedFormData.delivery || {},
  });

  const paymentForm = useForm({
    resolver: zodResolver(paymentSchema),
    mode: 'onBlur',
    defaultValues: savedFormData.payment || { paymentMethod: 'cod' },
  });

  // Create order mutation
  const { mutate: createOrder, isPending: isCreating, error: createError } = useMutation({
    mutationFn: async (orderData) => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create order');
      }

      return response.json();
    },

    onSuccess: (data) => {
      // Clear cart after successful order
      clearCart();
      
      // Redirect to order confirmation
      navigate(`/checkout/confirmation/${data.orderId}`, {
        state: { orderData: data },
      });
    },
  });

  // ============================================
  // HANDLERS
  // ============================================

  const handleAddressSubmit = useCallback(async (data) => {
    setSavedFormData((prev) => ({ ...prev, address: { ...data, deliveryLocation } }));
    setCurrentStep(3);
  }, [deliveryLocation]);

  const handleDeliverySubmit = useCallback(async (data) => {
    setSavedFormData((prev) => ({ ...prev, delivery: data }));
    setCurrentStep(3);
  }, []);

  const handlePaymentSubmit = useCallback(async (data) => {
    setSavedFormData((prev) => ({ ...prev, payment: data }));
    setSelectedPaymentMethod(data.paymentMethod);
    
    // If payment method requires card details, show modal
    if (data.paymentMethod === 'cmi') {
      setShowPaymentModal(true);
    } else {
      // Direct to order review
      setCurrentStep(4);
    }
  }, []);

  const handleFinalSubmit = useCallback(() => {
    const orderData = {
      items: items.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.price,
      })),
      shipping: savedFormData.address,      deliveryLocation,      delivery: savedFormData.delivery,
      payment: savedFormData.payment,
      total: calculateTotal(),
      timestamp: new Date().toISOString(),
    };

    createOrder(orderData);
  }, [items, savedFormData, createOrder, calculateTotal]);

  const handlePreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // ============================================
  // CALCULATIONS
  // ============================================

  const calculateSubtotal = useCallback(() => {
    return items.reduce((total, item) => {
      const price = item.discount 
        ? item.price * (1 - item.discount / 100) 
        : item.price;
      return total + price * item.quantity;
    }, 0);
  }, [items]);

  const calculateTax = useCallback(() => {
    return calculateSubtotal() * 0.1; // 10% tax
  }, [calculateSubtotal]);

  const calculateShipping = useCallback(() => {
    return calculateSubtotal() > 500 ? 0 : 50; // Free shipping over 500 DH
  }, [calculateSubtotal]);

  const calculateTotal = useCallback(() => {
    return (calculateSubtotal() + calculateTax() + calculateShipping()).toFixed(2);
  }, [calculateSubtotal, calculateTax, calculateShipping]);

  // ============================================
  // EARLY RETURNS
  // ============================================

  if (!items || items.length === 0) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
          <div className="max-w-2xl mx-auto px-4">
            <Card>
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {t('checkout.cartEmpty')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {t('checkout.addItemsMessage')}
                </p>
                <Button
                  onClick={() => navigate('/marketplace')}
                  variant="primary"
                >
                  {t('common.continueShopping')}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // ============================================
  // RENDER STEPS
  // ============================================

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Step Indicator */}
          <StepIndicator currentStep={currentStep} />

          {/* Main Content */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Section */}
            <div className="lg:col-span-2">
              {currentStep === 1 && (
                <CartReviewStep
                  items={items}
                  subtotal={calculateSubtotal()}
                  tax={calculateTax()}
                  shipping={calculateShipping()}
                  onNext={() => setCurrentStep(2)}
                />
              )}

              {currentStep === 2 && (
                <AddressStep
                  form={addressForm}
                  onSubmit={handleAddressSubmit}
                  onPrevious={handlePreviousStep}
                  isLoading={false}
                  deliveryLocation={deliveryLocation}
                  onDeliveryLocationChange={setDeliveryLocation}
                />
              )}

              {currentStep === 3 && (
                <DeliveryStep
                  form={deliveryForm}
                  onSubmit={handleDeliverySubmit}
                  onPrevious={handlePreviousStep}
                  isLoading={false}
                />
              )}

              {currentStep === 4 && (
                <PaymentStep
                  form={paymentForm}
                  onSubmit={handlePaymentSubmit}
                  onPrevious={handlePreviousStep}
                  isLoading={false}
                />
              )}

              {currentStep === 5 && (
                <OrderReviewStep
                  formData={savedFormData}
                  items={items}
                  total={calculateTotal()}
                  onSubmit={handleFinalSubmit}
                  onPrevious={handlePreviousStep}
                  isLoading={isCreating}
                  error={createError}
                />
              )}
            </div>

            {/* Summary Sidebar */}
            <OrderSummary
              items={items}
              subtotal={calculateSubtotal()}
              tax={calculateTax()}
              shipping={calculateShipping()}
              total={calculateTotal()}
            />
          </div>

          {/* Payment Modal */}
          {showPaymentModal && (
            <PaymentModalComponent
              method={selectedPaymentMethod}
              form={paymentForm}
              onClose={() => setShowPaymentModal(false)}
              onConfirm={() => {
                setShowPaymentModal(false);
                setCurrentStep(4);
              }}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function StepIndicator({ currentStep }) {
  const steps = [
    { number: 1, label: 'Cart' },
    { number: 2, label: 'Address' },
    { number: 3, label: 'Delivery' },
    { number: 4, label: 'Payment' },
    { number: 5, label: 'Review' },
  ];

  return (
    <div className="flex justify-between items-center mb-8">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center flex-1">
          <div
            className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm',
              currentStep >= step.number
                ? 'bg-blue-600 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
            )}
          >
            {step.number}
          </div>
          <span
            className={clsx(
              'text-sm font-medium ml-2',
              currentStep >= step.number
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500'
            )}
          >
            {step.label}
          </span>
          {index < steps.length - 1 && (
            <div
              className={clsx(
                'flex-1 h-1 mx-2',
                currentStep > step.number
                  ? 'bg-blue-600'
                  : 'bg-gray-300 dark:bg-gray-600'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CartReviewStep({ items, subtotal, tax, shipping, onNext }) {
  const { t } = useTranslation();

  return (
    <Card title="Order Summary">
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between items-center pb-2 border-b dark:border-gray-700">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('common.quantity')}: {item.quantity}
              </p>
            </div>
            <p className="font-medium text-gray-900 dark:text-white">
              {(item.price * item.quantity).toFixed(2)} DH
            </p>
          </div>
        ))}

        {/* Totals */}
        <div className="space-y-2 pt-4">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>{t('checkout.subtotal')}</span>
            <span>{subtotal.toFixed(2)} DH</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>{t('checkout.tax')}</span>
            <span>{tax.toFixed(2)} DH</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>{t('checkout.shipping')}</span>
            <span>{shipping.toFixed(2)} DH</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-4 border-t dark:border-gray-700">
            <span>{t('checkout.total')}</span>
            <span>{(subtotal + tax + shipping).toFixed(2)} DH</span>
          </div>
        </div>

        <Button onClick={onNext} variant="primary" className="w-full mt-6">
          {t('checkout.proceedToShipping')}
        </Button>
      </div>
    </Card>
  );
}

function AddressStep({ form, onSubmit, onPrevious, isLoading, deliveryLocation, onDeliveryLocationChange }) {
  const { t } = useTranslation();
  const { register, handleSubmit, watch, formState: { errors } } = form;
  const watchedCity = watch('city');

  return (
    <Card title={t('checkout.shippingAddress')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('checkout.fullName')}
          {...register('fullName')}
          error={errors.fullName?.message}
          disabled={isLoading}
          className="w-full"
        />

        <Input
          label={t('checkout.phone')}
          {...register('phone')}
          error={errors.phone?.message}
          placeholder="+212 6XX XXX XXX"
          disabled={isLoading}
          className="w-full"
        />

        <Input
          label={t('checkout.street')}
          {...register('street')}
          error={errors.street?.message}
          disabled={isLoading}
          className="w-full"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('checkout.city')}
            {...register('city')}
            error={errors.city?.message}
            disabled={isLoading}
          />
          <Input
            label={t('checkout.zipCode')}
            {...register('zipCode')}
            error={errors.zipCode?.message}
            disabled={isLoading}
          />
        </div>

        {/* Precise delivery location picker */}
        <div className="pt-2">
          <LocationPicker
            value={deliveryLocation || {}}
            onChange={onDeliveryLocationChange}
            city={watchedCity}
            required={false}
          />
        </div>

        <div className="flex gap-4 pt-4">
          <Button onClick={onPrevious} variant="secondary" className="flex-1">
            {t('common.previous')}
          </Button>
          <Button type="submit" variant="primary" className="flex-1" loading={isLoading}>
            {t('checkout.nextToDelivery')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function DeliveryStep({ form, onSubmit, onPrevious, isLoading }) {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors } } = form;

  const timeSlots = [
    '08:00 - 12:00',
    '12:00 - 16:00',
    '16:00 - 20:00',
  ];

  return (
    <Card title={t('checkout.deliveryOptions')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('checkout.deliveryDate')}
          type="date"
          {...register('deliveryDate')}
          error={errors.deliveryDate?.message}
          disabled={isLoading}
          className="w-full"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('checkout.timeSlot')}
          </label>
          <select
            {...register('deliveryTime')}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">{t('checkout.selectTimeSlot')}</option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
          {errors.deliveryTime && (
            <p className="text-red-500 text-sm mt-1">{errors.deliveryTime.message}</p>
          )}
        </div>

        <div className="flex gap-4 pt-4">
          <Button onClick={onPrevious} variant="secondary" className="flex-1">
            {t('common.previous')}
          </Button>
          <Button type="submit" variant="primary" className="flex-1" loading={isLoading}>
            {t('checkout.nextToPayment')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PaymentStep({ form, onSubmit, onPrevious, isLoading }) {
  const { t } = useTranslation();
  const { register, handleSubmit, watch, formState: { errors } } = form;
  const paymentMethod = watch('paymentMethod');

  return (
    <Card title={t('checkout.paymentMethod')}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-3">
          {['cmi', 'cod', 'bank'].map((method) => (
            <label key={method} className="flex items-center p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400"
              style={{ borderColor: paymentMethod === method ? '#3b82f6' : '' }}>
              <input
                type="radio"
                value={method}
                {...register('paymentMethod')}
                className="w-4 h-4"
              />
              <span className="ml-3 font-medium text-gray-900 dark:text-white">
                {t(`checkout.payment.${method}`)}
              </span>
            </label>
          ))}
        </div>

        {errors.paymentMethod && (
          <Alert type="error" message={errors.paymentMethod.message} />
        )}

        <div className="flex gap-4 pt-4">
          <Button onClick={onPrevious} variant="secondary" className="flex-1">
            {t('common.previous')}
          </Button>
          <Button type="submit" variant="primary" className="flex-1" loading={isLoading}>
            {t('checkout.review')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function OrderReviewStep({ formData, items, total, onSubmit, onPrevious, isLoading, error }) {
  const { t } = useTranslation();

  return (
    <Card title={t('checkout.orderReview')}>
      <div className="space-y-6">
        {error && <Alert type="error" message={error.message} />}

        {/* Order Items */}
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">{t('checkout.items')}</h3>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-gray-700 dark:text-gray-400">
                <span>{item.name} x {item.quantity}</span>
                <span>{(item.price * item.quantity).toFixed(2)} DH</span>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping Address */}
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">{t('checkout.shippingAddress')}</h3>
          <p className="text-gray-700 dark:text-gray-400">
            {formData.address?.fullName}<br />
            {formData.address?.street}<br />
            {formData.address?.city} {formData.address?.zipCode}
          </p>
        </div>

        {/* Delivery */}
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">{t('checkout.delivery')}</h3>
          <p className="text-gray-700 dark:text-gray-400">
            {formData.delivery?.deliveryDate}<br />
            {formData.delivery?.deliveryTime}
          </p>
        </div>

        {/* Payment */}
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">{t('checkout.payment')}</h3>
          <p className="text-gray-700 dark:text-gray-400">
            {t(`checkout.payment.${formData.payment?.paymentMethod}`)}
          </p>
        </div>

        {/* Total */}
        <div className="pt-4 border-t dark:border-gray-700">
          <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white">
            <span>{t('checkout.total')}</span>
            <span>{total} DH</span>
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button onClick={onPrevious} variant="secondary" className="flex-1" disabled={isLoading}>
            {t('common.previous')}
          </Button>
          <Button onClick={onSubmit} variant="primary" className="flex-1" loading={isLoading}>
            {t('checkout.confirmOrder')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function OrderSummary({ items, subtotal, tax, shipping, total }) {
  const { t } = useTranslation();

  return (
    <Card className="h-fit sticky top-4">
      <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">
        {t('checkout.orderSummary')}
      </h3>
      
      <div className="space-y-2 mb-4 pb-4 border-b dark:border-gray-700">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm text-gray-700 dark:text-gray-400">
            <span>{item.name} x {item.quantity}</span>
            <span>{(item.price * item.quantity).toFixed(2)} DH</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>{t('checkout.subtotal')}</span>
          <span>{subtotal.toFixed(2)} DH</span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>{t('checkout.tax')}</span>
          <span>{tax.toFixed(2)} DH</span>
        </div>
        <div className="flex justify-between text-gray-600 dark:text-gray-400">
          <span>{t('checkout.shipping')}</span>
          <span>{shipping.toFixed(2)} DH</span>
        </div>
        <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-4 border-t dark:border-gray-700">
          <span>{t('checkout.total')}</span>
          <span>{total} DH</span>
        </div>
      </div>
    </Card>
  );
}

function PaymentModalComponent({ method, form, onClose, onConfirm }) {
  const { t } = useTranslation();
  const { register, formState: { errors } } = form;

  return (
    <Modal isOpen onClose={onClose}>
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {t(`checkout.payment.${method}`)}
        </h2>

        {method === 'stripe' && (
          <div className="space-y-4">
            <Input
              label={t('checkout.cardNumber')}
              {...register('cardNumber')}
              error={errors.cardNumber?.message}
              placeholder="1234 5678 9012 3456"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('checkout.expiry')}
                {...register('cardExpiry')}
                error={errors.cardExpiry?.message}
                placeholder="MM/YY"
              />
              <Input
                label={t('checkout.cvc')}
                {...register('cardCVC')}
                error={errors.cardCVC?.message}
                placeholder="123"
              />
            </div>
          </div>
        )}

        {method === 'cmi' && (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              {t('checkout.cmiDescription')}
            </p>
            <Input
              label={t('checkout.cardNumber')}
              {...register('cardNumber')}
              error={errors.cardNumber?.message}
            />
          </div>
        )}

        <div className="flex gap-4 mt-6">
          <Button onClick={onClose} variant="secondary" className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button onClick={onConfirm} variant="primary" className="flex-1">
            {t('common.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

Checkout.propTypes = {
  // No required props
};

