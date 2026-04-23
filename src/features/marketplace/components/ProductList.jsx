import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import ProductCard from './ProductCard';
import ErrorBoundary from '../../../components/ErrorBoundary';

/**
 * ProductList Component - Display and filter products
 * 
 * Features:
 * - Grid/List view toggle
 * - Advanced filtering (price, rating, stock)
 * - Sorting options (newest, price, rating)
 * - Search functionality
 * - Category navigation
 * - Pagination
 * - Loading states
 * - Empty states
 * - Responsive design
 * 
 * @component
 */
function ProductListContent({ categoryId, onProductSelect }) {
  const { t } = useTranslation();
  const [viewType, setViewType] = useState('grid');
  const [sortBy, setSortBy] = useState('newest');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 1000 });
  const [minRating, setMinRating] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [inStockOnly, setInStockOnly] = useState(false);

  // Fetch products with filters
  const { data, isLoading, error } = useQuery({
    queryKey: [
      'products',
      categoryId,
      sortBy,
      priceRange,
      minRating,
      searchQuery,
      currentPage,
      inStockOnly,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        category: categoryId || '',
        sortBy,
        minPrice: priceRange.min,
        maxPrice: priceRange.max,
        minRating,
        search: searchQuery,
        page: currentPage,
        inStock: inStockOnly,
      });

      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  const products = data?.data || [];
  const totalPages = data?.pagination?.totalPages || 1;

  const handleResetFilters = useCallback(() => {
    setPriceRange({ min: 0, max: 1000 });
    setMinRating(0);
    setSearchQuery('');
    setSortBy('newest');
    setInStockOnly(false);
    setCurrentPage(1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {t('products.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {products.length} {t('products.found')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Filters */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 sticky top-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {t('products.filters')}
                </h3>
                <button
                  onClick={handleResetFilters}
                  className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
                >
                  {t('products.reset')}
                </button>
              </div>

              <div className="space-y-6">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('products.search')}
                  </label>
                  <Input
                    type="text"
                    placeholder={t('products.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('products.priceRange')}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder={t('products.min')}
                      value={priceRange.min}
                      onChange={(e) => setPriceRange({ ...priceRange, min: parseInt(e.target.value) })}
                    />
                    <Input
                      type="number"
                      placeholder={t('products.max')}
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({ ...priceRange, max: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Rating Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('products.minRating')}
                  </label>
                  <Select
                    value={minRating}
                    onChange={(e) => setMinRating(parseInt(e.target.value))}
                  >
                    <option value="0">{t('products.anyRating')}</option>
                    <option value="4">4★+</option>
                    <option value="3">3★+</option>
                    <option value="2">2★+</option>
                    <option value="1">1★+</option>
                  </Select>
                </div>

                {/* Stock Filter */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => setInStockOnly(e.target.checked)}
                      className="rounded mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('products.inStockOnly')}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="lg:col-span-3">
            {/* Toolbar */}
            <div className="flex justify-between items-center mb-6">
              {/* View Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setViewType('grid')}
                  className={`p-2 rounded ${
                    viewType === 'grid'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  aria-label={t('products.gridView')}
                >
                  ⊞
                </button>
                <button
                  onClick={() => setViewType('list')}
                  className={`p-2 rounded ${
                    viewType === 'list'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  aria-label={t('products.listView')}
                >
                  ☰
                </button>
              </div>

              {/* Sort */}
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="newest">{t('products.newest')}</option>
                <option value="price_asc">{t('products.priceLowToHigh')}</option>
                <option value="price_desc">{t('products.priceHighToLow')}</option>
                <option value="rating">{t('products.topRated')}</option>
              </Select>
            </div>

            {/* Products Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg h-64 animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  {t('products.noProducts')}
                </p>
              </div>
            ) : (
              <>
                <div
                  className={
                    viewType === 'grid'
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                      : 'space-y-4'
                  }
                >
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onQuickView={onProductSelect}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border rounded disabled:opacity-50"
                    >
                      {t('common.prev')}
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`px-4 py-2 border rounded ${
                          currentPage === i + 1
                            ? 'bg-blue-500 text-white'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border rounded disabled:opacity-50"
                    >
                      {t('common.next')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductList({ categoryId, onProductSelect }) {
  return (
    <ErrorBoundary>
      <ProductListContent categoryId={categoryId} onProductSelect={onProductSelect} />
    </ErrorBoundary>
  );
}

ProductList.propTypes = {
  categoryId: PropTypes.string,
  onProductSelect: PropTypes.func,
};

ProductList.defaultProps = {
  categoryId: null,
  onProductSelect: null,
};
