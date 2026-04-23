import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorBoundary from '../../../components/ErrorBoundary';

export default function VendorDashboard() {
  const { t } = useTranslation();

  const { data: metrics = {}, isLoading } = useQuery({
    queryKey: ['vendor-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/vendor/metrics');
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['vendor-recent-orders'],
    queryFn: async () => {
      const response = await fetch('/api/vendor/orders?limit=5');
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('vendor.dashboard')}</h1>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard title="Today's Revenue" value={`${(metrics.todayRevenue || 0).toFixed(2)} DH`} icon="📈" />
            <MetricCard title="Pending Orders" value={metrics.pendingOrders || 0} icon="📦" />
            <MetricCard title="Total Products" value={metrics.totalProducts || 0} icon="🛍️" />
            <MetricCard title="Average Rating" value={`${(metrics.avgRating || 0).toFixed(1)}⭐`} icon="⭐" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card title="Sales Trend">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.salesChart || []}>
                  <CartesianGrid />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Top Products">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.topProducts || []}>
                  <CartesianGrid />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sales" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Recent Orders */}
          <Card title="Recent Orders">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b dark:border-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4">{t('common.orderId')}</th>
                    <th className="text-left py-3 px-4">{t('common.amount')}</th>
                    <th className="text-left py-3 px-4">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b dark:border-gray-700">
                      <td className="py-3 px-4">#{order.id}</td>
                      <td className="py-3 px-4 font-bold">{order.amount.toFixed(2)} DH</td>
                      <td className="py-3 px-4">
                        <Badge label={order.status} className="bg-blue-100" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="mt-6" title="Quick Actions">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button className="h-20 flex flex-col items-center justify-center">{t('vendor.addProduct')} ➕</Button>
              <Button variant="secondary" className="h-20 flex flex-col items-center justify-center">{t('vendor.viewOrders')} 📦</Button>
              <Button variant="secondary" className="h-20 flex flex-col items-center justify-center">{t('vendor.analytics')} 📊</Button>
              <Button variant="secondary" className="h-20 flex flex-col items-center justify-center">{t('vendor.settings')} ⚙️</Button>
            </div>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function MetricCard({ title, value, icon }) {
  return (
    <Card>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{value}</h3>
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </Card>
  );
}

VendorDashboard.propTypes = {};
