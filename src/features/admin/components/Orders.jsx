import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import Modal from '../../../components/ui/Modal';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorBoundary from '../../../components/ErrorBoundary';

export default function AdminOrders() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-orders', searchTerm, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: searchTerm,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        limit: 20,
      });
      const response = await fetch(`/api/admin/orders?${params}`);
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  const { mutate: updateStatus, isPending } = useMutation({
    mutationFn: async ({ orderId, status }) => {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
    onSuccess: () => { setShowModal(false); refetch(); },
  });

  const handleUpdate = () => {
    if (selectedOrder && newStatus !== selectedOrder.status) {
      updateStatus({ orderId: selectedOrder.id, status: newStatus });
    }
  };

  if (isLoading) return <LoadingSpinner />;

  const statusColors = { pending: 'bg-yellow-100', processing: 'bg-blue-100', shipped: 'bg-purple-100', delivered: 'bg-green-100' };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('admin.ordersManagement')}</h1>
          <Card className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input placeholder={t('common.search')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border dark:bg-gray-800 rounded">
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
          </Card>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b dark:border-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4">{t('common.orderId')}</th>
                    <th className="text-left py-3 px-4">{t('common.customer')}</th>
                    <th className="text-left py-3 px-4">{t('common.amount')}</th>
                    <th className="text-left py-3 px-4">{t('common.status')}</th>
                    <th className="text-center py-3 px-4">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b dark:border-gray-700">
                      <td className="py-3 px-4 font-mono">#{order.id}</td>
                      <td className="py-3 px-4">{order.customerName}</td>
                      <td className="py-3 px-4 font-bold">{order.total.toFixed(2)} DH</td>
                      <td className="py-3 px-4"><Badge label={order.status} className={statusColors[order.status]} /></td>
                      <td className="py-3 px-4 text-center">
                        <Button size="sm" onClick={() => { setSelectedOrder(order); setNewStatus(order.status); setShowModal(true); }}>{t('common.details')}</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {showModal && selectedOrder && (
            <Modal isOpen onClose={() => setShowModal(false)}>
              <div className="p-6 space-y-4">
                <h2 className="text-xl font-bold">Order #{selectedOrder.id}</h2>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full px-4 py-2 border dark:bg-gray-800 rounded">
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
                <div className="flex gap-4">
                  <Button onClick={() => setShowModal(false)} variant="secondary" className="flex-1">{t('common.cancel')}</Button>
                  <Button onClick={handleUpdate} variant="primary" className="flex-1" loading={isPending}>{t('common.update')}</Button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}
