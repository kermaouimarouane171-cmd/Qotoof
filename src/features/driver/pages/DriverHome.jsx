import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import DarkModeToggle from '../../../components/ui/DarkModeToggle';
import DriverDashboard from '../components/Dashboard';

export default function DriverHome() {
  const { user } = useAuthStore();

  if (!user || user.role !== 'driver') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-green-600">GreenMarket Driver</h1>
          <DarkModeToggle />
        </div>
      </nav>
      <DriverDashboard />
    </div>
  );
}
