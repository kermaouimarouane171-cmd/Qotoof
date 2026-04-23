/**
 * 📊 Admin Dashboard Component
 * Main admin dashboard with key metrics, charts, recent orders, users
 * Features: Key metrics cards, sales chart, analytics, quick actions
 * 
 * @component
 * @returns {React.ReactElement} Admin dashboard page
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// UI imports
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorBoundary from '../../../components/ErrorBoundary';

// ============================================
// ADMIN DASHBOARD COMPONENT
// ============================================

/**
 * AdminDashboard - Main admin dashboard with metrics and analytics
 */
export default function AdminDashboard() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState('week'); // week, month, year

  // Fetch dashboard metrics
  const {
    data: metrics,
    isLoading: metricsLoading,
  } = useQuery({
    queryKey: ['admin-metrics', dateRange],
    queryFn: async () => {
      const response = await fetch(`/api/admin/metrics?range=${dateRange}`);
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  // Fetch sales data for chart
  const { data: salesData = [] } = useQuery({
    queryKey: ['admin-sales-chart', dateRange],
    queryFn: async () => {
      const response = await fetch(`/api/admin/sales-chart?range=${dateRange}`);
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  // Fetch recent orders
  const { data: recentOrders = [] } = useQuery({
    queryKey: ['admin-recent-orders'],
    queryFn: async () => {
      const response = await fetch('/api/admin/orders?limit=5');
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  // Fetch recent users
  const { data: recentUsers = [] } = useQuery({
    queryKey: ['admin-recent-users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users?limit=5');
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  // ============================================
  // RENDER
  // ============================================

  if (metricsLoading) {
    return (
      <ErrorBoundary>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {t('admin.dashboard')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {t('admin.welcomeMessage')}
              </p>
            </div>
            <div className="flex gap-2">
              {['week', 'month', 'year'].map((range) => (
                <Button
                  key={range}
                  onClick={() => setDateRange(range)}
                  variant={dateRange === range ? 'primary' : 'secondary'}
                >
                  {t(`admin.${range}`)}
                </Button>
              ))}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title={t('admin.totalRevenue')}
              value={`${metrics?.totalRevenue?.toFixed(2) || '0'} DH`}
              trend="+12.5%"
              icon="📈"
              color="blue"
            />
            <MetricCard
              title={t('admin.totalOrders')}
              value={metrics?.totalOrders || 0}
              trend="+8.2%"
              icon="📦"
              color="green"
            />
            <MetricCard
              title={t('admin.totalUsers')}
              value={metrics?.totalUsers || 0}
              trend="+5.1%"
              icon="👥"
              color="purple"
            />
            <MetricCard
              title={t('admin.activeVendors')}
              value={metrics?.activeVendors || 0}
              trend="+3.4%"
              icon="🏪"
              color="orange"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Sales Chart */}
            <div className="lg:col-span-2">
              <Card title={t('admin.salesTrend')}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: 'none',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Order Status Breakdown */}
            <Card title={t('admin.orderStatus')}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Pending', value: metrics?.pendingOrders || 0 },
                      { name: 'Processing', value: metrics?.processingOrders || 0 },
                      { name: 'Shipped', value: metrics?.shippedOrders || 0 },
                      { name: 'Delivered', value: metrics?.deliveredOrders || 0 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#8b5cf6" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <Card title={t('admin.recentOrders')}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b dark:border-gray-700">
                    <tr>
                      <th className="text-left py-3 px-2 font-semibold">
                        {t('common.id')}
                      </th>
                      <th className="text-left py-3 px-2 font-semibold">
                        {t('common.customer')}
                      </th>
                      <th className="text-left py-3 px-2 font-semibold">
                        {t('common.amount')}
                      </th>
                      <th className="text-left py-3 px-2 font-semibold">
                        {t('common.status')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="py-3 px-2 font-mono text-xs">
                          #{order.id}
                        </td>
                        <td className="py-3 px-2">{order.customer}</td>
                        <td className="py-3 px-2 font-bold">
                          {order.amount.toFixed(2)} DH
                        </td>
                        <td className="py-3 px-2">
                          <Badge
                            label={order.status}
                            className={`
                              ${
                                order.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : order.status === 'delivered'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800'
                              }
                            `}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Recent Users */}
            <Card title={t('admin.recentUsers')}>
              <div className="space-y-4">
                {recentUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between py-3 border-b dark:border-gray-700 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <Badge label={user.role} className="bg-blue-100 text-blue-800" />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="mt-8" title={t('admin.quickActions')}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <QuickActionButton
                icon="👤"
                label={t('admin.addUser')}
                onClick={() => {}}
              />
              <QuickActionButton
                icon="📦"
                label={t('admin.addProduct')}
                onClick={() => {}}
              />
              <QuickActionButton
                icon="📊"
                label={t('admin.viewReports')}
                onClick={() => {}}
              />
              <QuickActionButton
                icon="⚙️"
                label={t('admin.settings')}
                onClick={() => {}}
              />
            </div>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function MetricCard({ title, value, trend, icon, color }) {
  const colorMap = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200',
    green: 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-200',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-200',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200',
  };

  return (
    <Card>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {value}
          </h3>
          <p className="text-sm text-green-600 dark:text-green-400 mt-2">
            {trend}
          </p>
        </div>
        <div className={`text-3xl p-3 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function QuickActionButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20
                 transition-colors text-center"
    >
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        {label}
      </p>
    </button>
  );
}

AdminDashboard.propTypes = {
  // No required props
};

