import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorBoundary from '../../../components/ErrorBoundary';

export default function AdminAnalytics() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState('month');

  const { data: analytics = {}, isLoading } = useQuery({
    queryKey: ['admin-analytics', dateRange],
    queryFn: async () => {
      const response = await fetch(`/api/admin/analytics?range=${dateRange}`);
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('admin.analytics')}</h1>
            <div className="flex gap-2">
              {['week', 'month', 'year'].map((range) => (
                <Button key={range} onClick={() => setDateRange(range)} variant={dateRange === range ? 'primary' : 'secondary'}>
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card title="Sales Trend">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.salesTrend || []}>
                  <CartesianGrid />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="sales" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Orders by Status">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.orderStatus || []}>
                  <CartesianGrid />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Metrics */}
          <Card title="Key Metrics">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <MetricDisplay label="Total Revenue" value={`${(analytics.totalRevenue || 0).toFixed(0)} DH`} />
              <MetricDisplay label="Total Orders" value={analytics.totalOrders || 0} />
              <MetricDisplay label="Avg Order Value" value={`${(analytics.avgOrderValue || 0).toFixed(2)} DH`} />
              <MetricDisplay label="Conversion Rate" value={`${(analytics.conversionRate || 0).toFixed(1)}%`} />
            </div>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function MetricDisplay({ label, value }) {
  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
    </div>
  );
}

AdminAnalytics.propTypes = {};
