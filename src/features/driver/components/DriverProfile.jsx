import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Badge from '../../../components/ui/Badge';

export default function DriverProfile() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  const { data: profile = {}, refetch } = useQuery({
    queryKey: ['driver-profile'],
    queryFn: async () => {
      const response = await fetch('/api/driver/profile');
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch('/api/driver/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(t('common.error'));
      return response.json();
    },
    onSuccess: () => {
      refetch();
      setIsEditing(false);
    },
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      on_break: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'bg-gray-100';
  };

  return (
    <Card title={t('driver.profile') || 'Driver Profile'}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Name</p>
            <p className="text-lg font-semibold">{user?.name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone</p>
            {isEditing ? (
              <Input
                placeholder="Phone number"
                value={formData.phone || profile.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            ) : (
              <p className="text-lg font-semibold">{profile.phone || 'N/A'}</p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">License Number</p>
            {isEditing ? (
              <Input
                placeholder="License number"
                value={formData.licenseNumber || profile.licenseNumber || ''}
                onChange={(e) => handleChange('licenseNumber', e.target.value)}
              />
            ) : (
              <p className="text-lg font-semibold">{profile.licenseNumber || 'N/A'}</p>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</p>
            <Badge label={profile.status?.toUpperCase() || 'INACTIVE'} className={getStatusBadge(profile.status)} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Vehicle Info</p>
            {isEditing ? (
              <Input
                placeholder="Vehicle information"
                value={formData.vehicleInfo || profile.vehicleInfo || ''}
                onChange={(e) => handleChange('vehicleInfo', e.target.value)}
              />
            ) : (
              <p className="text-lg font-semibold">{profile.vehicleInfo || 'N/A'}</p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Deliveries</p>
            <p className="text-lg font-semibold">{profile.totalDeliveries || 0}</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t dark:border-gray-700">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Rating</p>
          <p className="text-2xl font-bold">{(profile.rating || 0).toFixed(1)} ⭐</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Joined</p>
          <p className="text-lg font-semibold">{new Date(profile.createdAt).toLocaleDateString()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Completion Rate</p>
          <p className="text-lg font-semibold">{profile.completionRate || '0%'}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">On Break</p>
          <p className="text-lg font-semibold">{profile.status === 'on_break' ? 'Yes' : 'No'}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mt-6">
        {!isEditing ? (
          <>
            <Button
              variant="primary"
              onClick={() => {
                setFormData(profile);
                setIsEditing(true);
              }}
            >
              Edit Profile ✏️
            </Button>
            <Button variant="secondary">Download Earnings Report 📄</Button>
          </>
        ) : (
          <>
            <Button variant="success" onClick={handleSave}>
              Save Changes ✅
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditing(false);
                setFormData({});
              }}
            >
              Cancel ❌
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
