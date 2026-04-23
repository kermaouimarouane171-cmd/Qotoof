/**
 * 📸 ProductDetail Component
 * Full product page with images, specs, reviews, ratings and purchase options
 * Features: Image zoom, gallery, reviews form, related products, stock management
 * 
 * @component
 * @returns {React.ReactElement} Product detail page
 */

import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

// Store & UI imports
import { useCartStore } from '../../../store/cartStore';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';
import Alert from '../../../components/ui/Alert';
import StarRating from '../../../components/ui/StarRating';
import Badge from '../../../components/ui/Badge';
import SkeletonLoaders from '../../../components/ui/SkeletonLoaders';
import ErrorBoundary from '../../../components/ErrorBoundary';

// ============================================
// PRODUCT DETAIL COMPONENT
// ============================================

/**
 * ProductDetail - Full product details page component
 */
export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const addItem = useCartStore((state) => state.addItem);

  // Local state
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Fetch product details
  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const response = await fetch(`/api/products/${id}`);
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  // Fetch reviews
  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', id],
    queryFn: async () => {
      const response = await fetch(`/api/products/${id}/reviews`);
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  // Fetch related products
  const { data: relatedProducts = [] } = useQuery({
    queryKey: ['relatedProducts', product?.category],
    queryFn: async () => {
      const response = await fetch(
        `/api/products?category=${product?.category}&limit=4`
      );
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
    enabled: !!product?.category,
  });

  // Add to cart mutation
  const { mutate: addToCart, isPending: isAdding } = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          quantity,
        }),
      });

      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },

    onSuccess: () => {
      // Add to local store
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        discount: product.discount,
        quantity,
        image: product.images[0],
      });
    },
  });

  // ============================================
  // HANDLERS
  // ============================================

  const handleQuantityChange = useCallback((value) => {
    const quantity = parseInt(value, 10);
    if (quantity > 0 && quantity <= product?.stock) {
      setQuantity(quantity);
    }
  }, [product?.stock]);

  const handleAddToCart = useCallback(() => {
    if (product) {
      addToCart();
    }
  }, [product, addToCart]);

  const handleBuyNow = useCallback(() => {
    if (product) {
      addToCart();
      // Mutation will handle adding to store, then navigate
      setTimeout(() => navigate('/checkout'), 500);
    }
  }, [product, addToCart, navigate]);

  // ============================================
  // CALCULATIONS
  // ============================================

  const discountedPrice = product
    ? product.price * (1 - (product.discount || 0) / 100)
    : 0;

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  // ============================================
  // RENDER STATES
  // ============================================

  if (isLoading) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
          <div className="max-w-6xl mx-auto px-4">
            <SkeletonLoaders.Product />
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (error || !product) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
          <div className="max-w-6xl mx-auto px-4">
            <Alert type="error" message={t('product.notFound')} />
            <Button
              onClick={() => navigate('/marketplace')}
              variant="primary"
              className="mt-4"
            >
              {t('common.backToStore')}
            </Button>
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
        <div className="max-w-6xl mx-auto px-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-6">
            <button
              onClick={() => navigate('/marketplace')}
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              {t('common.marketplace')}
            </button>
            <span>/</span>
            <button
              onClick={() => navigate(`/marketplace?category=${product.category}`)}
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              {product.category}
            </button>
            <span>/</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {product.name}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Image Section */}
            <div className="lg:col-span-2">
              <ImageGallery
                images={product.images}
                selectedImage={selectedImage}
                onSelectImage={setSelectedImage}
                productName={product.name}
                discount={product.discount}
                stock={product.stock}
              />
            </div>

            {/* Details Section */}
            <div>
              <ProductInfo
                product={product}
                quantity={quantity}
                onQuantityChange={handleQuantityChange}
                discountedPrice={discountedPrice}
                onAddToCart={handleAddToCart}
                onBuyNow={handleBuyNow}
                isAdding={isAdding}
                stock={product.stock}
                rating={averageRating}
                reviewCount={reviews.length}
              />
            </div>
          </div>

          {/* Tabs Section */}
          <div className="mt-12">
            <TabsSection
              product={product}
              reviews={reviews}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onShowReviewForm={() => setShowReviewForm(true)}
              averageRating={averageRating}
            />
          </div>

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                {t('product.relatedProducts')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {relatedProducts.map((relProduct) => (
                  <ProductCardMini
                    key={relProduct.id}
                    product={relProduct}
                    onSelect={() => navigate(`/marketplace/product/${relProduct.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Review Form Modal */}
          {showReviewForm && (
            <ReviewFormModal
              productId={product.id}
              onClose={() => setShowReviewForm(false)}
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

function ImageGallery({
  images,
  selectedImage,
  onSelectImage,
  productName,
  discount,
  stock,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
      {/* Main Image */}
      <div className="relative bg-gray-100 dark:bg-gray-700 aspect-square overflow-hidden">
        <img
          src={images[selectedImage]}
          alt={productName}
          className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
        />

        {/* Discount Badge */}
        {discount > 0 && (
          <Badge
            className="absolute top-4 right-4 bg-red-500 text-white"
            label={`-${discount}%`}
          />
        )}

        {/* Stock Status */}
        {stock === 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-lg font-bold">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Thumbnail Gallery */}
      {images.length > 1 && (
        <div className="flex gap-4 p-4 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => onSelectImage(index)}
              className={clsx(
                'flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2',
                selectedImage === index
                  ? 'border-blue-500'
                  : 'border-gray-300 dark:border-gray-600'
              )}
            >
              <img
                src={image}
                alt={`${productName}-${index}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductInfo({
  product,
  quantity,
  onQuantityChange,
  discountedPrice,
  onAddToCart,
  onBuyNow,
  isAdding,
  stock,
  rating,
  reviewCount,
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <div className="space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {product.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
            {t('product.vendor')}: {product.vendor}
          </p>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2">
          <StarRating rating={parseFloat(rating)} size="sm" />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {rating} ({reviewCount} {t('product.reviews')})
          </span>
        </div>

        {/* Stock Status */}
        <div className="flex items-center gap-2">
          <div
            className={clsx(
              'w-3 h-3 rounded-full',
              stock > 10
                ? 'bg-green-500'
                : stock > 0
                ? 'bg-yellow-500'
                : 'bg-red-500'
            )}
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {stock > 0
              ? `${stock} ${t('product.inStock')}`
              : t('product.outOfStock')}
          </span>
        </div>

        {/* Price */}
        <div className="py-4 border-y dark:border-gray-700">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {discountedPrice.toFixed(2)} DH
            </span>
            {product.discount > 0 && (
              <span className="text-lg text-gray-500 dark:text-gray-400 line-through">
                {product.price.toFixed(2)} DH
              </span>
            )}
          </div>
          {product.discount > 0 && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
              {t('product.savings')}: {(product.price - discountedPrice).toFixed(2)} DH
            </p>
          )}
        </div>

        {/* Quantity Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('product.quantity')}
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onQuantityChange(quantity - 1)}
              disabled={quantity <= 1}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              −
            </button>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => onQuantityChange(e.target.value)}
              min="1"
              max={stock}
              className="w-16 text-center"
            />
            <button
              onClick={() => onQuantityChange(quantity + 1)}
              disabled={quantity >= stock}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={onAddToCart}
            variant="secondary"
            className="w-full"
            disabled={stock === 0 || isAdding}
            loading={isAdding}
          >
            {t('product.addToCart')} 🛒
          </Button>
          <Button
            onClick={onBuyNow}
            variant="primary"
            className="w-full"
            disabled={stock === 0 || isAdding}
          >
            {t('product.buyNow')} ⚡
          </Button>
        </div>

        {/* Description */}
        <div className="pt-4 border-t dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white mb-2">
            {t('product.description')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Security Badge */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 p-3 rounded">
          <span>🔒</span>
          <span>{t('product.securePayment')}</span>
        </div>
      </div>
    </Card>
  );
}

function TabsSection({
  product,
  reviews,
  activeTab,
  onTabChange,
  onShowReviewForm,
  averageRating,
}) {
  const { t } = useTranslation();

  const tabs = ['description', 'specifications', 'reviews'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
      {/* Tab Headers */}
      <div className="flex border-b dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={clsx(
              'px-6 py-4 font-medium text-sm border-b-2 transition-colors',
              activeTab === tab
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            {t(`product.tab.${tab}`)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'description' && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {product.description}
            </p>
          </div>
        )}

        {activeTab === 'specifications' && (
          <div className="space-y-3">
            {product.specifications?.map((spec, index) => (
              <div key={index} className="border-b dark:border-gray-700 pb-3">
                <p className="font-medium text-gray-900 dark:text-white">
                  {spec.key}
                </p>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {spec.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reviews' && (
          <ReviewsSection
            reviews={reviews}
            productId={product.id}
            averageRating={averageRating}
            onShowForm={onShowReviewForm}
          />
        )}
      </div>
    </div>
  );
}

function ReviewsSection({ reviews, averageRating, onShowForm }) {
  const { t } = useTranslation();

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('product.noReviews')}
        </p>
        <Button onClick={onShowForm} variant="primary">
          {t('product.writeReview')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rating Summary */}
      <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {averageRating}
          </p>
          <StarRating rating={parseFloat(averageRating)} />
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {t('product.basedOn')} {reviews.length} {t('product.reviews')}
          </p>
        </div>
        <Button onClick={onShowForm} variant="primary">
          {t('product.writeReview')}
        </Button>
      </div>

      {/* Individual Reviews */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="border-b dark:border-gray-700 pb-4 last:border-b-0"
          >
            <div className="flex items-start justify-between mb-2">
              <p className="font-medium text-gray-900 dark:text-white">
                {review.author}
              </p>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(review.createdAt).toLocaleDateString()}
              </span>
            </div>
            <StarRating rating={review.rating} size="sm" />
            <p className="text-gray-700 dark:text-gray-300 text-sm mt-2">
              {review.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductCardMini({ product, onSelect }) {
  const discountedPrice = product.price * (1 - (product.discount || 0) / 100);

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onSelect}
    >
      <div className="relative bg-gray-100 dark:bg-gray-700 aspect-square mb-3 rounded overflow-hidden">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>
      <h3 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2">
        {product.name}
      </h3>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-lg font-bold text-gray-900 dark:text-white">
          {discountedPrice.toFixed(2)} DH
        </span>
        {product.discount > 0 && (
          <span className="text-sm text-gray-500 line-through">
            {product.price.toFixed(2)} DH
          </span>
        )}
      </div>
    </Card>
  );
}

function ReviewFormModal({ productId, onClose }) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');

  const { mutate: submitReview, isPending } = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, text, author }),
      });

      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },

    onSuccess: () => {
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {t('product.writeReview')}
        </h2>

        <div className="space-y-4">
          <Input
            label={t('product.name')}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('product.rating')}
            </label>
            <StarRating rating={rating} onRate={setRating} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('product.comment')}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-white"
              placeholder={t('product.enterComment')}
            />
          </div>

          <div className="flex gap-4">
            <Button onClick={onClose} variant="secondary" className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => submitReview()}
              variant="primary"
              className="flex-1"
              loading={isPending}
            >
              {t('common.submit')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

ProductDetail.propTypes = {
  // No required props
};

