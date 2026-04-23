import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorBoundary from '../../../components/ErrorBoundary';

export default function AdminUsers() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users', searchTerm, filterRole],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: searchTerm,
        role: filterRole !== 'all' ? filterRole : undefined,
        limit: 20,
      });
      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('admin.usersManagement')}</h1>
          <Card className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input placeholder={t('common.search')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="px-4 py-2 border dark:bg-gray-800 rounded">
                <option value="all">All Roles</option>
                <option value="buyer">Buyer</option>
                <option value="vendor">Vendor</option>
                <option value="driver">Driver</option>
              </select>
            </div>
          </Card>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b dark:border-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4">{t('common.name')}</th>
                    <th className="text-left py-3 px-4">{t('common.email')}</th>
                    <th className="text-left py-3 px-4">{t('common.role')}</th>
                    <th className="text-center py-3 px-4">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b dark:border-gray-700">
                      <td className="py-3 px-4 font-medium">{user.name}</td>
                      <td className="py-3 px-4">{user.email}</td>
                      <td className="py-3 px-4"><Badge label={user.role} /></td>
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
