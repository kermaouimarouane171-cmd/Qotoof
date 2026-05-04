/**
 * 📋 OrderConfirmation Component
 * Order confirmation page with receipt, tracking info, and action buttons
 * Features: Order details, tracking link, receipt download, next steps
 * 
 * @component
 * @returns {React.ReactElement} Order confirmation page
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '../../../store/cartStore';

// UI imports
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Alert from '../../../components/ui/Alert';
import Badge from '../../../components/ui/Badge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorBoundary from '../../../components/ErrorBoundary';

// ============================================
// ORDER CONFIRMATION COMPONENT
// ============================================

/**
 * OrderConfirmation - Order confirmation and receipt page
 */
export default function OrderConfirmation() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const clearCart = useCartStore((state) => state.clearCart);

  // Fetch order details
  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const response = await fetch(`/api/orders/${orderId}`);
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  // Clear cart on mount (order completed)
  useEffect(() => {
    clearCart();
  }, [clearCart]);

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

  if (error || !order) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
          <div className="max-w-2xl mx-auto px-4">
            <Card>
              <Alert
                type="error"
                title={t('order.notFound')}
                message={error?.message || t('common.error')}
                className="mb-4"
              />
              <Button
                onClick={() => navigate('/marketplace')}
                variant="primary"
                className="w-full"
              >
                {t('common.continueShopping')}
              </Button>
            </Card>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  const estimatedDelivery = new Date(order.deliveryDate);
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 3); // +3 days estimate

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="inline-block w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">✓</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {t('order.confirmation')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t('order.thankYou')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Number */}
              <Card>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('order.orderNumber')}
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      #{order.id}
                    </p>
                  </div>
                  <Badge label="Confirmed" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" />
                </div>
              </Card>

              {/* Order Status Timeline */}
              <Card title={t('order.status')}>
                <OrderTimeline status={order.status} />
              </Card>

              {/* Order Items */}
              <Card title={t('order.items')}>
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between pb-4 border-b dark:border-gray-700 last:border-b-0"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t('common.quantity')}: {item.quantity}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-white">
                          {(item.price * item.quantity).toFixed(2)} DH
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Shipping Address */}
              <Card title={t('order.shippingAddress')}>
                <div className="text-gray-700 dark:text-gray-300">
                  <p className="font-medium mb-2">{order.shippingAddress.fullName}</p>
                  <p>{order.shippingAddress.street}</p>
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.zipCode}
                  </p>
                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                    📞 {order.shippingAddress.phone}
                  </p>
                </div>
              </Card>

              {/* Delivery Info */}
              <Card title={t('order.deliveryInfo')}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('order.deliveryDate')}
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {new Date(order.deliveryDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('order.estimatedArrival')}
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {estimatedDelivery.toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('order.timeSlot')}
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {order.deliveryTime}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('order.trackingNumber')}
                    </p>
                    <p className="font-mono font-medium text-gray-900 dark:text-white">
                      {order.trackingNumber || 'Pending'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Order Summary */}
              <Card title={t('order.summary')}>
                <div className="space-y-3">
                  <SummaryRow
                    label={t('checkout.subtotal')}
                    value={`${order.subtotal.toFixed(2)} DH`}
                  />
                  <SummaryRow
                    label={t('checkout.tax')}
                    value={`${order.tax.toFixed(2)} DH`}
                  />
                  <SummaryRow
                    label={t('checkout.shipping')}
                    value={`${order.shipping.toFixed(2)} DH`}
                  />
                  <div className="pt-3 border-t dark:border-gray-700">
                    <SummaryRow
                      label={t('checkout.total')}
                      value={`${order.total.toFixed(2)} DH`}
                      bold
                    />
                  </div>
                </div>
              </Card>

              {/* Payment Info */}
              <Card title={t('order.payment')}>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('payment.method')}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {order.paymentMethod}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('payment.status')}
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      Completed
                    </span>
                  </div>
                  {order.transactionId && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        {t('payment.transactionId')}
                      </span>
                      <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                        {order.transactionId.substring(0, 8)}...
                      </code>
                    </div>
                  )}
                </div>
              </Card>

              {/* Next Steps */}
              <Card className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-4">
                  {t('order.nextSteps')}
                </h3>
                <ol className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800">
                      1
                    </span>
                    <span>{t('order.confirmationEmailSent')}</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800">
                      2
                    </span>
                    <span>{t('order.preparingForDelivery')}</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800">
                      3
                    </span>
                    <span>{t('order.trackingUpdates')}</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800">
                      4
                    </span>
                    <span>{t('order.receivePackage')}</span>
                  </li>
                </ol>
              </Card>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={() => navigate(`/order-tracking/${orderId}`)}
                  variant="primary"
                  className="w-full"
                >
                  {t('order.trackOrder')} 📦
                </Button>
                <Button
                  onClick={() => downloadReceipt(order)}
                  variant="secondary"
                  className="w-full"
                >
                  {t('order.downloadReceipt')} 📥
                </Button>
                <Button
                  onClick={() => navigate('/marketplace')}
                  variant="secondary"
                  className="w-full"
                >
                  {t('common.continueShopping')} 🛒
                </Button>
              </div>

              {/* Support */}
              <Card className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {t('order.needHelp')}
                </p>
                <Button
                  onClick={() => navigate('/support')}
                  variant="secondary"
                  className="w-full"
                >
                  {t('order.contactSupport')} 💬
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function OrderTimeline({ status }) {
  const { t } = useTranslation();

  const statuses = [
    { key: 'confirmed', label: t('order.status.confirmed') },
    { key: 'processing', label: t('order.status.processing') },
    { key: 'shipped', label: t('order.status.shipped') },
    { key: 'delivered', label: t('order.status.delivered') },
  ];

  const currentIndex = statuses.findIndex((s) => s.key === status);

  return (
    <div className="space-y-4">
      {statuses.map((st, index) => (
        <div key={st.key} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
              index <= currentIndex
                ? 'bg-blue-600 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
            }`}
          >
            {index < currentIndex ? '✓' : index + 1}
          </div>
          <div className="ml-4">
            <p className="font-medium text-gray-900 dark:text-white">{st.label}</p>
            {index === currentIndex && (
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {t('order.inProgress')}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryRow({ label, value, bold = false }) {
  return (
    <div className="flex justify-between">
      <span
        className={`text-gray-700 dark:text-gray-300 ${bold ? 'font-bold' : ''}`}
      >
        {label}
      </span>
      <span className={`text-gray-900 dark:text-white ${bold ? 'font-bold text-lg' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function downloadReceipt(order) {
  const receipt = `
╔════════════════════════════════════════╗
║          QOTOOF - ORDER RECEIPT        ║
╚════════════════════════════════════════╝

Order Number: #${order.id}
Date: ${new Date(order.createdAt).toLocaleString()}
Status: ${order.status}

════════════════════════════════════════
ITEMS
════════════════════════════════════════
${order.items
  .map(
    (item) =>
      `${item.name}
Qty: ${item.quantity} × ${item.price.toFixed(2)} DH = ${(item.price * item.quantity).toFixed(2)} DH`
  )
  .join('\n\n')}

════════════════════════════════════════
TOTAL
════════════════════════════════════════
Subtotal:        ${order.subtotal.toFixed(2)} DH
Tax (10%):       ${order.tax.toFixed(2)} DH
Shipping:        ${order.shipping.toFixed(2)} DH
─────────────────────────────────────
TOTAL:           ${order.total.toFixed(2)} DH

════════════════════════════════════════
DELIVERY TO
════════════════════════════════════════
${order.shippingAddress.fullName}
${order.shippingAddress.street}
${order.shippingAddress.city} ${order.shippingAddress.zipCode}
Phone: ${order.shippingAddress.phone}

Delivery Date: ${new Date(order.deliveryDate).toLocaleDateString()}
Time Slot: ${order.deliveryTime}
${order.trackingNumber ? `Tracking: ${order.trackingNumber}` : ''}

════════════════════════════════════════
PAYMENT
════════════════════════════════════════
Method: ${order.paymentMethod}
Status: Paid
${order.transactionId ? `Transaction ID: ${order.transactionId}` : ''}

════════════════════════════════════════
Thank you for shopping at QOTOOF!
Support: support@qotoof.ma
Website: www.qotoof.com
════════════════════════════════════════
  `;

  const element = document.createElement('a');
  element.setAttribute(
    'href',
    'data:text/plain;charset=utf-8,' + encodeURIComponent(receipt)
  );
  element.setAttribute('download', `receipt-${order.id}.txt`);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

OrderConfirmation.propTypes = {
  // No required props
};
