import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorBoundary from '../../../components/ErrorBoundary';

export default function AdminProducts() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-products', searchTerm, filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: searchTerm,
        category: filterCategory !== 'all' ? filterCategory : undefined,
        limit: 20,
      });
      const response = await fetch(`/api/admin/products?${params}`);
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('admin.productsManagement')}</h1>
            <Button variant="primary">{t('admin.addProduct')} ➕</Button>
          </div>
          <Card className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input placeholder={t('common.search')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-4 py-2 border dark:bg-gray-800 rounded">
                <option value="all">All Categories</option>
                <option value="electronics">Electronics</option>
                <option value="fashion">Fashion</option>
              </select>
            </div>
          </Card>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b dark:border-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4">{t('common.name')}</th>
                    <th className="text-left py-3 px-4">{t('common.category')}</th>
                    <th className="text-left py-3 px-4">{t('common.price')}</th>
                    <th className="text-left py-3 px-4">{t('common.stock')}</th>
                    <th className="text-center py-3 px-4">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b dark:border-gray-700">
                      <td className="py-3 px-4 font-medium">{product.name}</td>
                      <td className="py-3 px-4">{product.category}</td>
                      <td className="py-3 px-4 font-bold">{product.price.toFixed(2)} DH</td>
                      <td className="py-3 px-4"><Badge label={product.stock > 0 ? 'In stock' : 'Out'} /></td>
                      <td className="py-3 px-4 text-center"><Button size="sm">{t('common.edit')}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}
