import { useTranslation } from 'react-i18next';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../../store/cartStore';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import CartItem from './CartItem';
import ErrorBoundary from '../../../components/ErrorBoundary';

/**
 * Cart Component - Shopping cart display
 * 
 * Features:
 * - List of cart items
 * - Cart summary (subtotal, tax, total)
 * - Coupon code application
 * - Continue shopping link
 * - Checkout button
 * - Empty cart state
 * - Responsive design
 * 
 * @component
 */
function CartContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [applyCouponLoading, setApplyCouponLoading] = useState(false);

  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);

  // Calculate totals
  const subtotal = items.reduce((total, item) => {
    const price = item.discount
      ? item.price * (1 - item.discount / 100)
      : item.price;
    return total + price * item.quantity;
  }, 0);

  const tax = subtotal * 0.1; // 10% tax
  const discountAmount = subtotal * (couponDiscount / 100);
  const total = subtotal + tax - discountAmount;

  const handleApplyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return;

    setApplyCouponLoading(true);
    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode }),
      });

      if (response.ok) {
        const data = await response.json();
        setCouponDiscount(data.discount);
        alert(t('cart.couponApplied'));
      } else {
        alert(t('cart.invalidCoupon'));
      }
    } catch {
      alert(t('cart.couponError'));
    } finally {
      setApplyCouponLoading(false);
    }
  }, [couponCode, t]);

  const handleCheckout = useCallback(() => {
    navigate('/checkout');
  }, [navigate]);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-6xl mb-4">🛒</div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('cart.empty')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('cart.emptyMessage')}
          </p>
          <Button onClick={() => navigate('/marketplace')} size="lg">
            {t('cart.continueShopping')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          {t('cart.title')}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              {items.length} {t('cart.items')}
            </h2>

            <div>
              {items.map((item) => (
                <CartItem key={item.id} item={item} />
              ))}
            </div>

            {/* Continue Shopping */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => navigate('/marketplace')}
                className="w-full"
              >
                {t('cart.continueShopping')}
              </Button>
            </div>
          </div>

          {/* Cart Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 sticky top-4">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                {t('cart.summary')}
              </h3>

              <div className="space-y-4 mb-6">
                {/* Lines */}
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>{t('cart.subtotal')}</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>{t('cart.tax')}</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>{t('cart.discount')}</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-white">
                    <span>{t('cart.total')}</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Coupon Code */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('cart.couponCode')}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder={t('cart.enterCoupon')}
                    disabled={applyCouponLoading}
                  />
                  <Button
                    onClick={handleApplyCoupon}
                    loading={applyCouponLoading}
                    disabled={!couponCode.trim() || applyCouponLoading}
                    size="sm"
                  >
                    {t('cart.apply')}
                  </Button>
                </div>
              </div>

              {/* Checkout Button */}
              <Button
                onClick={handleCheckout}
                className="w-full mb-3"
                size="lg"
              >
                {t('cart.checkout')}
              </Button>

              {/* Clear Cart */}
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm(t('cart.confirmClear'))) {
                    clearCart();
                  }
                }}
                className="w-full"
              >
                {t('cart.clear')}
              </Button>

              {/* Security Badge */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                  🔒 {t('cart.secure')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Cart() {
  return (
    <ErrorBoundary>
      <CartContent />
    </ErrorBoundary>
  );
}

Cart.propTypes = {};
