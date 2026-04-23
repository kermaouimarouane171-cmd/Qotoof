import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Badge from '../../../components/ui/Badge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorBoundary from '../../../components/ErrorBoundary';

export default function DriverDashboard() {
  const { t } = useTranslation();

  const { data: metrics = {}, isLoading } = useQuery({
    queryKey: ['driver-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/driver/metrics');
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  const { data: availableDeliveries = [] } = useQuery({
    queryKey: ['driver-available-deliveries'],
    queryFn: async () => {
      const response = await fetch('/api/driver/deliveries/available');
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  if (isLoading) return <LoadingSpinner />;

  const acceptDelivery = async (deliveryId) => {
    await fetch(`/api/driver/deliveries/${deliveryId}/accept`, {
      method: 'POST',
    });
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">{t('driver.dashboard')}</h1>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard title="Today's Earnings" value={`${(metrics.todayEarnings || 0).toFixed(2)} DH`} icon="💰" />
            <MetricCard title="Completed Today" value={metrics.completedToday || 0} icon="✅" />
            <MetricCard title="Pending Deliveries" value={metrics.pendingDeliveries || 0} icon="📦" />
            <MetricCard title="Your Rating" value={`${(metrics.rating || 0).toFixed(1)}⭐`} icon="⭐" />
          </div>

          {/* Active Delivery */}
          {metrics.activeDelivery && (
            <Card title="Active Delivery" className="mb-8 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-lg">Order #{metrics.activeDelivery.orderId}</span>
                  <Badge label="In Progress" className="bg-blue-100" />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Pickup</p>
                    <p className="font-medium">{metrics.activeDelivery.pickupLocation}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Delivery</p>
                    <p className="font-medium">{metrics.activeDelivery.deliveryLocation}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button variant="primary" className="flex-1">View Map 🗺️</Button>
                  <Button variant="secondary" className="flex-1">Complete ✅</Button>
                </div>
              </div>
            </Card>
          )}

          {/* Available Deliveries */}
          <Card title="Available Deliveries">
            <div className="space-y-4">
              {availableDeliveries.map((delivery) => (
                <div key={delivery.id} className="border dark:border-gray-700 p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-bold">{delivery.address}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Distance: {delivery.distance}km | Pay: {delivery.pay.toFixed(2)} DH
                      </p>
                    </div>
                    <Button onClick={() => acceptDelivery(delivery.id)} size="sm">
                      {t('driver.accept')} ✓
                    </Button>
                  </div>
                </div>
              ))}
              {availableDeliveries.length === 0 && (
                <p className="text-center text-gray-600 dark:text-gray-400">{t('driver.noDeliveries')}</p>
              )}
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

DriverDashboard.propTypes = {};
