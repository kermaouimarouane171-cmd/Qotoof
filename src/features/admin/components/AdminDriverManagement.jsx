import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Input from '../../../components/ui/Input';

export default function AdminDriverManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: drivers = [], refetch } = useQuery({
    queryKey: ['admin-drivers', searchTerm, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterStatus !== 'all') params.append('status', filterStatus);

      const response = await fetch(`/api/admin/drivers?${params}`);
      if (!response.ok) throw new Error('Failed to fetch drivers');
      return response.json();
    },
  });

  const suspendDriverMutation = useMutation({
    mutationFn: async (driverId) => {
      const response = await fetch(`/api/admin/drivers/${driverId}/suspend`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to suspend driver');
      return response.json();
    },
    onSuccess: () => refetch(),
  });

  const activateDriverMutation = useMutation({
    mutationFn: async (driverId) => {
      const response = await fetch(`/api/admin/drivers/${driverId}/activate`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to activate driver');
      return response.json();
    },
    onSuccess: () => refetch(),
  });

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
      on_break: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'bg-gray-100';
  };

  return (
    <Card title="Driver Management" className="mb-8">
      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <Input
          placeholder="Search drivers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border dark:border-gray-700 rounded-lg dark:bg-gray-800"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="on_break">On Break</option>
        </select>
      </div>

      {/* Drivers Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="text-left py-2 px-4">Driver Name</th>
              <th className="text-left py-2 px-4">Phone</th>
              <th className="text-left py-2 px-4">Status</th>
              <th className="text-left py-2 px-4">Deliveries</th>
              <th className="text-left py-2 px-4">Rating</th>
              <th className="text-left py-2 px-4">Earnings (This Month)</th>
              <th className="text-left py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => (
              <tr key={driver.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium">{driver.name}</p>
                    <p className="text-xs text-gray-500">{driver.licenseNumber}</p>
                  </div>
                </td>
                <td className="py-3 px-4">{driver.phone}</td>
                <td className="py-3 px-4">
                  <Badge label={driver.status.toUpperCase()} className={getStatusColor(driver.status)} />
                </td>
                <td className="py-3 px-4">
                  <div className="text-center">
                    <p className="font-semibold">{driver.totalDeliveries}</p>
                    <p className="text-xs text-gray-500">Done today: {driver.completedToday || 0}</p>
                  </div>
                </td>
                <td className="py-3 px-4">{(driver.rating || 0).toFixed(1)} ⭐</td>
                <td className="py-3 px-4">{driver.earningsThisMonth?.toFixed(2) || '0.00'} DH</td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    {driver.status === 'active' ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => suspendDriverMutation.mutate(driver.id)}
                        disabled={suspendDriverMutation.isPending}
                      >
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => activateDriverMutation.mutate(driver.id)}
                        disabled={activateDriverMutation.isPending}
                      >
                        Activate
                      </Button>
                    )}
                    <Button size="sm" variant="secondary">
                      View Details
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drivers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No drivers found</p>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t dark:border-gray-700">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Drivers</p>
          <p className="text-2xl font-bold">{drivers.length}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
          <p className="text-2xl font-bold text-green-600">{drivers.filter((d) => d.status === 'active').length}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Suspended</p>
          <p className="text-2xl font-bold text-red-600">{drivers.filter((d) => d.status === 'suspended').length}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Avg Rating</p>
          <p className="text-2xl font-bold">
            {(drivers.reduce((sum, d) => sum + (d.rating || 0), 0) / drivers.length || 0).toFixed(1)} ⭐
          </p>
        </div>
      </div>
    </Card>
  );
}
