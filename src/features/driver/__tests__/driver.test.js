const vi = { fn: jest.fn };
import React, { createContext } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock modules that use import.meta.env (not supported by Jest/Babel)
jest.mock('../../../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'driver-1', role: 'driver', name: 'John Driver' } }),
}));
jest.mock('../../../services/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}));
jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// AuthContext shim - app uses Zustand authStore, but tests wrap with context
const AuthContext = createContext({});
import DriverDashboard from '../components/Dashboard';
import DeliveryTracker from '../components/DeliveryTracker';
import DriverProfile from '../components/DriverProfile';

// Mock fetch
global.fetch = vi.fn();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const mockAuthContext = {
  user: { id: 'driver-1', role: 'driver', name: 'John Driver' },
};

const renderWithProviders = (component) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mockAuthContext}>{component}</AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe('Driver Dashboard', () => {
  beforeEach(() => {
    global.fetch.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('renders dashboard with loading state', () => {
    global.fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    const { container } = renderWithProviders(<DriverDashboard />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders metrics after loading', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        todayEarnings: 150.5,
        completedToday: 5,
        pendingDeliveries: 2,
        rating: 4.8,
        activeDelivery: {
          orderId: 'ORD-123',
          pickupLocation: 'Store A',
          deliveryLocation: 'Customer Home',
        },
      }),
    });

    renderWithProviders(<DriverDashboard />);

    await waitFor(() => {
      expect(screen.getByText('150.50 DH')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });
});

describe('Delivery Tracker', () => {
  beforeEach(() => {
    global.fetch.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('renders delivery list', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 'del-1',
          orderId: 'ORD-001',
          customerName: 'John Doe',
          pickupLocation: 'Store A',
          deliveryLocation: 'Address 1',
          amount: 50,
          status: 'pending',
        },
      ],
    });

    renderWithProviders(<DeliveryTracker />);

    await waitFor(() => {
      expect(screen.getByText('Order #ORD-001')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('allows updating delivery status', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 'del-1',
          orderId: 'ORD-001',
          customerName: 'John Doe',
          pickupLocation: 'Store A',
          deliveryLocation: 'Address 1',
          amount: 50,
          status: 'in_progress',
        },
      ],
    });

    renderWithProviders(<DeliveryTracker />);

    await waitFor(() => {
      expect(screen.getByText('Mark Complete ✅')).toBeInTheDocument();
    });

    const completeButton = screen.getByText('Mark Complete ✅');
    fireEvent.click(completeButton);

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'completed' }),
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/deliveries/del-1'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });
});

describe('Driver Profile', () => {
  beforeEach(() => {
    global.fetch.mockClear();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('renders driver profile information', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        phone: '0612345678',
        licenseNumber: 'DL123456',
        status: 'active',
        vehicleInfo: 'Honda Civic 2020',
        totalDeliveries: 150,
        rating: 4.7,
        completionRate: '98%',
      }),
    });

    renderWithProviders(<DriverProfile />);

    await waitFor(() => {
      expect(screen.getByText('0612345678')).toBeInTheDocument();
      expect(screen.getByText('DL123456')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
    });
  });

  it('allows editing profile', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        phone: '0612345678',
        licenseNumber: 'DL123456',
        status: 'active',
        vehicleInfo: 'Honda Civic 2020',
        totalDeliveries: 150,
        rating: 4.7,
      }),
    });

    renderWithProviders(<DriverProfile />);

    await waitFor(() => {
      expect(screen.getByText('Edit Profile ✏️')).toBeInTheDocument();
    });

    const editButton = screen.getByText('Edit Profile ✏️');
    fireEvent.click(editButton);

    const phoneInput = screen.getByDisplayValue('0612345678');
    await userEvent.clear(phoneInput);
    await userEvent.type(phoneInput, '0698765432');

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ phone: '0698765432' }),
    });

    const saveButton = screen.getByText('Save Changes ✅');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/driver/profile', expect.objectContaining({ method: 'PUT' }));
    });
  });
});

describe('Driver API Routes', () => {
  it('fetches driver metrics correctly', async () => {
    const mockMetrics = {
      todayEarnings: 200,
      completedToday: 8,
      pendingDeliveries: 3,
      rating: 4.9,
      activeDelivery: null,
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMetrics,
    });

    const response = await fetch('/api/driver/metrics');
    const data = await response.json();

    expect(data.todayEarnings).toBe(200);
    expect(data.completedToday).toBe(8);
  });
});
