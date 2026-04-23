import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { useCartStore } from '../../../store/cartStore';
import Input from '../../../components/ui/Input';
import ErrorBoundary from '../../../components/ErrorBoundary';

/**
 * CartItem Component - Individual cart item display
 * 
 * Features:
 * - Product info (image, name, price)
 * - Quantity selector with +/- buttons
 * - Item total calculation
 * - Remove item button
 * - Responsive design
 * - Accessibility
 * 
 * @component
 * @param {Object} props
 * @param {Object} props.item - Cart item
 */
function CartItemContent({ item }) {
  const { t } = useTranslation();
  const updateItem = useCartStore((state) => state.updateItem);
  const removeItem = useCartStore((state) => state.removeItem);

  const discountedPrice = item.discount
    ? item.price * (1 - item.discount / 100)
    : item.price;

  const itemTotal = discountedPrice * item.quantity;

  const handleQuantityChange = useCallback((newQuantity) => {
    if (newQuantity > 0) {
      updateItem(item.id, newQuantity);
    }
  }, [item.id, updateItem]);

  const handleRemove = useCallback(() => {
    if (confirm(t('cart.confirmRemove'))) {
      removeItem(item.id);
    }
  }, [item.id, removeItem, t]);

  return (
    <div className="flex gap-4 py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      {/* Image */}
      <div className="w-24 h-24 flex-shrink-0 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content */}
      <div className="flex-1">
        {/* Name and Price */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {item.name}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                ${discountedPrice.toFixed(2)}
              </span>
              {item.discount && (
                <span className="text-sm text-gray-500 line-through">
                  ${item.price.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Item Total */}
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            ${itemTotal.toFixed(2)}
          </span>
        </div>

        {/* Quantity and Remove */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleQuantityChange(item.quantity - 1)}
              className="w-7 h-7 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              aria-label={t('cart.decrease')}
            >
              −
            </button>
            <Input
              type="number"
              min="1"
              max="999"
              value={item.quantity}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value))}
              className="w-14 text-center"
            />
            <button
              onClick={() => handleQuantityChange(item.quantity + 1)}
              className="w-7 h-7 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              aria-label={t('cart.increase')}
            >
              +
            </button>
          </div>

          {/* Remove Button */}
          <button
            onClick={handleRemove}
            className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm font-medium"
            aria-label={t('cart.remove')}
          >
            {t('cart.remove')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CartItem({ item }) {
  return (
    <ErrorBoundary>
      <CartItemContent item={item} />
    </ErrorBoundary>
  );
}

CartItem.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    discount: PropTypes.number,
    quantity: PropTypes.number.isRequired,
  }).isRequired,
};
