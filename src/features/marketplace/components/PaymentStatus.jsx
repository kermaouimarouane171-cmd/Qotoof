/**
 * ✅ PaymentStatus Component
 * Displays payment status and order confirmation details
 * Features: Status indicator, transaction info, order details, receipt download
 * 
 * @component
 * @returns {React.ReactElement} Payment status page
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

// UI imports
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Alert from '../../../components/ui/Alert';
import Badge from '../../../components/ui/Badge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorBoundary from '../../../components/ErrorBoundary';

// ============================================
// PAYMENT STATUS COMPONENT
// ============================================

/**
 * PaymentStatus - Payment status and confirmation page
 */
export default function PaymentStatus() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [autoRedirect, setAutoRedirect] = useState(false);

  // Fetch payment/order status
  const {
    data: paymentData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['payment-status', orderId],
    queryFn: async () => {
      const response = await fetch(`/api/payments/status/${orderId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error(t('payment.notFound'));
        throw new Error(t('common.error'));
      }
      return response.json();
    },
    refetchInterval: paymentData?.status === 'pending' ? 3000 : false,
  });

  // Auto-redirect after success
  useEffect(() => {
    if (paymentData?.status === 'succeeded' && !autoRedirect) {
      setAutoRedirect(true);
      const timer = setTimeout(() => {
        navigate(`/order/confirmation/${orderId}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [paymentData, orderId, navigate, autoRedirect]);

  // ============================================
  // RENDER STATES
  // ============================================

  if (isLoading) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </ErrorBoundary>
    );
  }

  if (error || !paymentData) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
          <div className="max-w-2xl mx-auto px-4">
            <Card>
              <Alert
                type="error"
                title={t('payment.failed')}
                message={error?.message || t('common.error')}
                className="mb-4"
              />
              <div className="flex gap-4">
                <Button
                  onClick={() => navigate('/marketplace')}
                  variant="secondary"
                  className="flex-1"
                >
                  {t('common.continueShopping')}
                </Button>
                <Button
                  onClick={() => navigate(-1)}
                  variant="primary"
                  className="flex-1"
                >
                  {t('common.tryAgain')}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-2xl mx-auto px-4">
          {/* Status Card */}
          <StatusIndicator status={paymentData.status} />

          <div className="mt-6 space-y-6">
            {/* Payment Details */}
            <Card title={t('payment.paymentDetails')}>
              <div className="space-y-4">
                <DetailRow label={t('payment.method')}>
                  {t(`payment.method.${paymentData.paymentMethod}`)}
                </DetailRow>

                <DetailRow label={t('payment.transactionId')}>
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">
                    {paymentData.transactionId}
                  </code>
                </DetailRow>

                <DetailRow label={t('payment.amount')}>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    {paymentData.amount.toFixed(2)} DH
                  </span>
                </DetailRow>

                <DetailRow label={t('payment.status')}>
                  <StatusBadge status={paymentData.status} />
                </DetailRow>

                <DetailRow label={t('payment.timestamp')}>
                  {new Date(paymentData.timestamp).toLocaleString()}
                </DetailRow>

                {paymentData.lastFour && (
                  <DetailRow label={t('payment.card')}>
                    •••• •••• •••• {paymentData.lastFour}
                  </DetailRow>
                )}
              </div>
            </Card>

            {/* Order Summary */}
            {paymentData.orderDetails && (
              <Card title={t('payment.orderSummary')}>
                <div className="space-y-4">
                  <DetailRow label={t('payment.orderId')}>
                    {paymentData.orderDetails.orderId}
                  </DetailRow>

                  <DetailRow label={t('payment.items')}>
                    {paymentData.orderDetails.itemCount} {t('payment.itemsLabel')}
                  </DetailRow>

                  <DetailRow label={t('payment.subtotal')}>
                    {paymentData.orderDetails.subtotal.toFixed(2)} DH
                  </DetailRow>

                  <DetailRow label={t('payment.tax')}>
                    {paymentData.orderDetails.tax.toFixed(2)} DH
                  </DetailRow>

                  {paymentData.orderDetails.shipping > 0 && (
                    <DetailRow label={t('payment.shipping')}>
                      {paymentData.orderDetails.shipping.toFixed(2)} DH
                    </DetailRow>
                  )}

                  <div className="border-t dark:border-gray-700 pt-4">
                    <DetailRow label={t('payment.total')}>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {paymentData.orderDetails.total.toFixed(2)} DH
                      </span>
                    </DetailRow>
                  </div>
                </div>
              </Card>
            )}

            {/* Shipping Address */}
            {paymentData.shippingAddress && (
              <Card title={t('payment.shippingAddress')}>
                <div className="text-gray-700 dark:text-gray-300 space-y-1">
                  <p className="font-medium">{paymentData.shippingAddress.fullName}</p>
                  <p>{paymentData.shippingAddress.street}</p>
                  <p>
                    {paymentData.shippingAddress.city},{' '}
                    {paymentData.shippingAddress.zipCode}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {paymentData.shippingAddress.phone}
                  </p>
                </div>
              </Card>
            )}

            {/* Status Messages */}
            {paymentData.status === 'succeeded' && (
              <Alert
                type="success"
                title={t('payment.success')}
                message={t('payment.successMessage')}
              />
            )}

            {paymentData.status === 'pending' && (
              <Alert
                type="warning"
                title={t('payment.pending')}
                message={t('payment.pendingMessage')}
              />
            )}

            {paymentData.status === 'failed' && (
              <Alert
                type="error"
                title={t('payment.failed')}
                message={paymentData.failureReason || t('payment.genericError')}
              />
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              {paymentData.status === 'succeeded' && (
                <>
                  <Button
                    onClick={() => downloadReceipt(paymentData)}
                    variant="secondary"
                    className="flex-1"
                  >
                    {t('payment.downloadReceipt')} 📥
                  </Button>
                  <Button
                    onClick={() => navigate(`/order-tracking/${orderId}`)}
                    variant="primary"
                    className="flex-1"
                  >
                    {t('payment.trackOrder')} 📦
                  </Button>
                </>
              )}

              {paymentData.status === 'failed' && (
                <>
                  <Button
                    onClick={() => navigate('/checkout')}
                    variant="primary"
                    className="flex-1"
                  >
                    {t('payment.retryPayment')}
                  </Button>
                  <Button
                    onClick={() => navigate('/marketplace')}
                    variant="secondary"
                    className="flex-1"
                  >
                    {t('common.continueShopping')}
                  </Button>
                </>
              )}

              {paymentData.status === 'pending' && (
                <Button
                  onClick={() => window.location.reload()}
                  variant="primary"
                  className="flex-1"
                >
                  {t('payment.checkStatus')} 🔄
                </Button>
              )}
            </div>

            {/* Help Section */}
            <Card className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-2">
                {t('payment.needHelp')}
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                {t('payment.contactSupport')}
              </p>
              <Button
                onClick={() => navigate('/support')}
                variant="secondary"
                className="w-full"
              >
                {t('payment.contactUs')} 💬
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function StatusIndicator({ status }) {
  const { t } = useTranslation();

  const statusConfig = {
    succeeded: {
      icon: '✓',
      title: t('payment.success'),
      color: 'green',
      bgColor: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-600 dark:text-green-400',
      borderColor: 'border-green-300 dark:border-green-700',
    },
    pending: {
      icon: '⏳',
      title: t('payment.processing'),
      color: 'blue',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      textColor: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-300 dark:border-blue-700',
    },
    failed: {
      icon: '✕',
      title: t('payment.failed'),
      color: 'red',
      bgColor: 'bg-red-100 dark:bg-red-900',
      textColor: 'text-red-600 dark:text-red-400',
      borderColor: 'border-red-300 dark:border-red-700',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <div
      className={clsx(
        'border-2 rounded-lg p-6 text-center',
        config.bgColor,
        config.borderColor
      )}
    >
      <div
        className={clsx(
          'text-5xl mb-3 font-bold',
          config.textColor
        )}
      >
        {config.icon}
      </div>
      <h1 className={clsx('text-2xl font-bold mb-2', config.textColor)}>
        {config.title}
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        {t(`payment.${status}Message`)}
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const { t } = useTranslation();

  const colors = {
    succeeded: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <Badge
      label={t(`payment.status.${status}`)}
      className={colors[status] || colors.pending}
    />
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="flex justify-between items-start py-2 border-b dark:border-gray-700 last:border-b-0">
      <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <span className="text-right text-gray-900 dark:text-white">{children}</span>
    </div>
  );
}

function downloadReceipt(paymentData) {
  // Simple receipt download logic
  // In a real app, this would generate PDF or send to backend
  const receipt = `
QOTOOF - PAYMENT RECEIPT
===========================
Order ID: ${paymentData.orderDetails.orderId}
Transaction ID: ${paymentData.transactionId}
Date: ${new Date(paymentData.timestamp).toLocaleString()}

PAYMENT DETAILS
Amount: ${paymentData.amount.toFixed(2)} DH
Method: ${paymentData.paymentMethod}
Status: ${paymentData.status}
Card: •••• •••• •••• ${paymentData.lastFour}

ITEMS: ${paymentData.orderDetails.itemCount}
Subtotal: ${paymentData.orderDetails.subtotal.toFixed(2)} DH
Tax: ${paymentData.orderDetails.tax.toFixed(2)} DH
Shipping: ${paymentData.orderDetails.shipping.toFixed(2)} DH
TOTAL: ${paymentData.orderDetails.total.toFixed(2)} DH

SHIPPING TO:
${paymentData.shippingAddress.fullName}
${paymentData.shippingAddress.street}
${paymentData.shippingAddress.city} ${paymentData.shippingAddress.zipCode}
Phone: ${paymentData.shippingAddress.phone}

Thank you for your purchase!
www.qotoof.com
  `;

  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(receipt));
  element.setAttribute('download', `receipt-${paymentData.orderDetails.orderId}.txt`);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

PaymentStatus.propTypes = {
  // No required props
};
