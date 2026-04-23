import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useCartStore } from '../../../store/cartStore';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import ErrorBoundary from '../../../components/ErrorBoundary';

/**
 * ProductCard Component - Displays product summary in grid
 * 
 * Features:
 * - Product image with hover zoom
 * - Price with discount calculation
 * - Rating and review count
 * - Stock status badge
 * - Add to cart functionality
 * - Quick view button
 * - Responsive grid layout
 * - Accessibility compliant
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.product - Product data
 * @param {string} props.product.id - Product ID
 * @param {string} props.product.name - Product name
 * @param {string} props.product.image - Product image URL
 * @param {number} props.product.price - Product price
 * @param {number} props.product.discount - Discount percentage (optional)
 * @param {number} props.product.rating - Average rating (0-5)
 * @param {number} props.product.reviewCount - Number of reviews
 * @param {number} props.product.stock - Stock quantity
 * @param {function} props.onQuickView - Callback for quick view
 */
function ProductCardContent({ product, onQuickView }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const addToCart = useCartStore((state) => state.addItem);

  // Mutation for adding to cart
  const { mutate: handleAddToCart, isPending } = useMutation({
    mutationFn: async () => {
      // Call API to validate product availability
      const response = await fetch(`/api/products/${product.id}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(t('common.error'));
      }

      return response.json();
    },
    onSuccess: () => {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        discount: product.discount,
        image: product.image,
        quantity: 1,
      });
      // Show toast notification
      alert(t('cart.addedSuccess'));
    },
    onError: () => {
      alert(t('cart.addError'));
    },
  });

  const discountedPrice = product.discount
    ? product.price * (1 - product.discount / 100)
    : product.price;

  const handleProductClick = useCallback(() => {
    navigate(`/marketplace/product/${product.id}`);
  }, [navigate, product.id]);

  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock < 10;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300">
      {/* Image Container */}
      <div
        className="relative overflow-hidden bg-gray-200 dark:bg-gray-700 aspect-square cursor-pointer group"
        onClick={handleProductClick}
        role="button"
        tabIndex="0"
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleProductClick();
        }}
      >
        {/* Product Image */}
        <img
          src={product.image}
          alt={product.name}
          onLoad={() => setIsImageLoaded(true)}
          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 ${
            isImageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Loading Skeleton */}
        {!isImageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-600 animate-pulse" />
        )}

        {/* Discount Badge */}
        {product.discount && (
          <div className="absolute top-2 right-2">
            <Badge variant="danger" className="text-white font-bold">
              -{product.discount}%
            </Badge>
          </div>
        )}

        {/* Stock Status Badge */}
        {isOutOfStock ? (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            {t('products.outOfStock')}
          </div>
        ) : isLowStock ? (
          <div className="absolute top-2 left-2 bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-medium">
            {t('products.lowStock')}
          </div>
        ) : null}

        {/* Quick View Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickView?.(product);
          }}
          className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
          aria-label={t('products.quickView')}
        >
          <span className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium">
            {t('products.quickView')}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Product Name */}
        <button
          type="button"
          onClick={handleProductClick}
          className="w-full text-left font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors bg-transparent p-0"
        >
          {product.name}
        </button>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className={i < Math.floor(product.rating) ? 'text-yellow-400' : 'text-gray-300'}
              >
                ★
              </span>
            ))}
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            ({product.reviewCount})
          </span>
        </div>

        {/* Price */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            ${discountedPrice.toFixed(2)}
          </span>
          {product.discount && (
            <span className="text-sm text-gray-500 line-through">
              ${product.price.toFixed(2)}
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <Button
          onClick={() => handleAddToCart()}
          disabled={isPending || isOutOfStock}
          loading={isPending}
          variant={isOutOfStock ? 'disabled' : 'primary'}
          size="sm"
          className="w-full"
          aria-label={isOutOfStock ? t('products.outOfStock') : t('cart.addToCart')}
        >
          {isOutOfStock ? t('products.outOfStock') : t('cart.addToCart')}
        </Button>
      </div>
    </div>
  );
}

export default function ProductCard({ product, onQuickView }) {
  return (
    <ErrorBoundary>
      <ProductCardContent product={product} onQuickView={onQuickView} />
    </ErrorBoundary>
  );
}

ProductCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    discount: PropTypes.number,
    rating: PropTypes.number,
    reviewCount: PropTypes.number,
    stock: PropTypes.number.isRequired,
  }).isRequired,
  onQuickView: PropTypes.func,
};

ProductCard.defaultProps = {
  onQuickView: null,
};
