import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Modal from '../../../components/ui/Modal';

export default function DeliveryTracker() {
  const { t } = useTranslation();
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const { data: deliveries = [], refetch } = useQuery({
    queryKey: ['driver-deliveries'],
    queryFn: async () => {
      const response = await fetch('/api/driver/deliveries');
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  const updateDeliveryMutation = useMutation({
    mutationFn: async ({ deliveryId, status }) => {
      const response = await fetch(`/api/driver/deliveries/${deliveryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
    onSuccess: () => {
      refetch();
      setShowModal(false);
    },
  });

  const handleStatusUpdate = (deliveryId, newStatus) => {
    updateDeliveryMutation.mutate({ deliveryId, status: newStatus });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100';
  };

  return (
    <>
      <Card title={t('driver.myDeliveries') || 'My Deliveries'} className="mb-8">
        <div className="space-y-4">
          {deliveries.map((delivery) => (
            <div key={delivery.id} className="border dark:border-gray-700 p-4 rounded-lg hover:shadow-md transition">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h4 className="font-bold text-lg">Order #{delivery.orderId}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{delivery.customerName}</p>
                </div>
                <Badge label={delivery.status.toUpperCase()} className={getStatusColor(delivery.status)} />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">From</p>
                  <p className="font-medium">{delivery.pickupLocation}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">To</p>
                  <p className="font-medium">{delivery.deliveryLocation}</p>
                </div>
              </div>

              <div className="flex gap-4 justify-between items-center">
                <div className="text-sm">
                  <p className="text-gray-600">Payment</p>
                  <p className="font-bold text-lg">{delivery.amount.toFixed(2)} DH</p>
                </div>
                <div className="flex gap-2">
                  {delivery.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedDelivery(delivery);
                        setShowModal(true);
                      }}
                    >
                      Start Delivery 🚗
                    </Button>
                  )}
                  {delivery.status === 'in_progress' && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => handleStatusUpdate(delivery.id, 'completed')}
                    >
                      Mark Complete ✅
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedDelivery(delivery);
                      setShowModal(true);
                    }}
                  >
                    Details 👁️
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {deliveries.length === 0 && (
            <p className="text-center py-8 text-gray-500 dark:text-gray-400">
              No deliveries available. Check back soon!
            </p>
          )}
        </div>
      </Card>

      {selectedDelivery && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={`Delivery Details - Order #${selectedDelivery.orderId}`}
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Customer</p>
              <p className="text-lg font-semibold">{selectedDelivery.customerName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pickup Location</p>
              <p className="text-lg font-semibold">{selectedDelivery.pickupLocation}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Delivery Location</p>
              <p className="text-lg font-semibold">{selectedDelivery.deliveryLocation}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Amount</p>
              <p className="text-lg font-semibold">{selectedDelivery.amount.toFixed(2)} DH</p>
            </div>
            <Button variant="primary" className="w-full" onClick={() => setShowModal(false)}>
              Close
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
