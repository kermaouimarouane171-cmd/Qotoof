import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';

export const useDriverMetrics = () => {
  return useQuery({
    queryKey: ['driver-metrics'],
    queryFn: async () => {
      const response = await fetch('/api/driver/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const useDeliveries = () => {
  return useQuery({
    queryKey: ['driver-deliveries'],
    queryFn: async () => {
      const response = await fetch('/api/driver/deliveries');
      if (!response.ok) throw new Error('Failed to fetch deliveries');
      return response.json();
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

export const useAvailableDeliveries = () => {
  return useQuery({
    queryKey: ['available-deliveries'],
    queryFn: async () => {
      const response = await fetch('/api/driver/deliveries/available');
      if (!response.ok) throw new Error('Failed to fetch available deliveries');
      return response.json();
    },
    refetchInterval: 15000, // Refetch every 15 seconds
  });
};

export const useAcceptDelivery = () => {
  return useMutation({
    mutationFn: async (deliveryId) => {
      const response = await fetch(`/api/driver/deliveries/${deliveryId}/accept`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to accept delivery');
      return response.json();
    },
  });
};

export const useUpdateDeliveryStatus = () => {
  return useMutation({
    mutationFn: async ({ deliveryId, status }) => {
      const response = await fetch(`/api/driver/deliveries/${deliveryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Failed to update delivery status');
      return response.json();
    },
  });
};

export const useDriverStats = () => {
  return useQuery({
    queryKey: ['driver-stats'],
    queryFn: async () => {
      const response = await fetch('/api/driver/stats');
      if (!response.ok) throw new Error('Failed to fetch driver stats');
      return response.json();
    },
  });
};

export const useDriverAuth = () => {
  const { user } = useAuthStore();
  return {
    isDriver: user?.role === 'driver',
    user,
  };
};

export const useDriverProfile = () => {
  return useQuery({
    queryKey: ['driver-profile'],
    queryFn: async () => {
      const response = await fetch('/api/driver/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    },
  });
};

export const useUpdateDriverProfile = () => {
  return useMutation({
    mutationFn: async (profileData) => {
      const response = await fetch('/api/driver/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
  });
};
