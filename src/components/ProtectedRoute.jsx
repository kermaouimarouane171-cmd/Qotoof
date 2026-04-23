import React, { Suspense } from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import NotificationLink from '@/components/notifications/NotificationLink';
import {
  ChartBarIcon,
  ShoppingBagIcon,
  ClipboardDocumentListIcon,
  UsersIcon,
  Cog6ToothIcon,
  TruckIcon,
  StarIcon,
  CurrencyDollarIcon,
  MapIcon,
  HomeIcon,
  DocumentChartBarIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  FlagIcon,
  ArrowRightOnRectangleIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/authStore';

/**
 * مكون Loading Fallback للـ Suspense
 */
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="text-center">
      <div className="inline-block">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
      <p className="mt-4 text-gray-600">جاري التحميل...</p>
    </div>
  </div>
);

/**
 * ProtectedRoute Component
 * 
 * @param {object} props
 * @param {React.Component} props.Layout - مكون Layout (Optional)
 * @param {string} props.requiredRole - الدور المطلوب (Optional)
 * @param {string[]} props.allowedRoles - قائمة الأدوار المسموحة (Optional)
 * @returns {React.ReactElement}
 */
export const ProtectedRoute = ({
  Layout = DefaultLayout,
  requiredRole = null,
  allowedRoles = [],
}) => {
  // Use Supabase-based auth store instead of broken custom middleware
  const { user, profile, loading } = useAuthStore();

  if (loading) {
    return <LoadingFallback />;
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check role authorization using profile.role (from Supabase profiles table)
  const userRole = profile?.role;
  if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return <Navigate to="/unauthorized" replace />;
  }
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Layout />
    </Suspense>
  );
};

/**
 * DefaultLayout - Layout افتراضي بسيط
 */
export const DefaultLayout = () => <Outlet />;

/**
/**
 * MainLayout - Full public layout with Navbar + Footer
 */
export const MainLayout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <a id="main-content" className="sr-only" href="#main" tabIndex={-1} aria-hidden="true">skip</a>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-emerald-600 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-xs">ق</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white">قطوف</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">سوق الجملة الأول في المغرب للنباتات والخضروات والفواكه</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">روابط سريعة</h4>
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li><Link to="/marketplace" className="hover:text-green-600">السوق</Link></li>
                <li><Link to="/stores" className="hover:text-green-600">المتاجر</Link></li>
                <li><Link to="/cart" className="hover:text-green-600">السلة</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">للبائعين</h4>
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li><Link to="/register?role=vendor" className="hover:text-green-600">انضم كبائع</Link></li>
                <li><Link to="/vendor/dashboard" className="hover:text-green-600">لوحة التحكم</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">الدعم</h4>
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li><a href="/help" className="hover:text-green-600">مركز المساعدة</a></li>
                <li><a href="/contact" className="hover:text-green-600">تواصل معنا</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">© 2024 قطوف - Qotoof. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// ── Shared sidebar nav link ────────────────────────────────
const SideNavLink = ({ to, icon: Icon, label }) => {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(to + '/');
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {label}
    </Link>
  );
};

/**
 * AdminLayout - Sidebar layout for admin panel
 */
export const AdminLayout = () => {
  const { signOut } = useAuthStore();
  const { pathname } = useLocation();

  const adminLinks = [
    { to: '/admin/dashboard', icon: HomeIcon, label: 'لوحة التحكم' },
    { to: '/admin/users', icon: UsersIcon, label: 'المستخدمون' },
    { to: '/admin/vendors', icon: ShoppingBagIcon, label: 'البائعون' },
    { to: '/admin/drivers', icon: TruckIcon, label: 'السائقون' },
    { to: '/admin/products', icon: ShoppingBagIcon, label: 'المنتجات' },
    { to: '/admin/orders', icon: ClipboardDocumentListIcon, label: 'الطلبات' },
    { to: '/admin/analytics', icon: ChartBarIcon, label: 'التحليلات' },
    { to: '/admin/reports', icon: DocumentChartBarIcon, label: 'التقارير' },
    { to: '/admin/moderation', icon: ShieldCheckIcon, label: 'الإشراف' },
    { to: '/admin/fraud-reports', icon: FlagIcon, label: 'بلاغات الاحتيال' },
    { to: '/admin/commissions', icon: CurrencyDollarIcon, label: 'العمولات' },
    { to: '/admin/commission-management', icon: CurrencyDollarIcon, label: 'إدارة عمولات 3%' },
    { to: '/admin/disputes', icon: ExclamationTriangleIcon, label: 'نزاعات الدفع' },
    { to: '/admin/payouts', icon: CurrencyDollarIcon, label: 'المدفوعات' },
    { to: '/admin/reviews', icon: StarIcon, label: 'التقييمات' },
    { to: '/admin/support-tickets', icon: ChatBubbleLeftRightIcon, label: 'تذاكر الدعم' },
    { to: '/admin/security', icon: ShieldCheckIcon, label: 'الأمن' },
    { to: '/admin/settings', icon: Cog6ToothIcon, label: 'الإعدادات' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <Link to="/admin/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <ShieldCheckIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white">الإدارة</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {adminLinks.map((link) => (
            <SideNavLink key={link.to} {...link} />
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {adminLinks.find(l => pathname.startsWith(l.to))?.label || 'الإدارة'}
          </h1>
          <div className="flex items-center gap-3">
            <NotificationLink ariaLabel="الإشعارات" />
            <Link to="/" className="text-sm text-gray-500 hover:text-green-600">العودة للموقع</Link>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

/**
 * VendorLayout - Sidebar layout for vendor panel
 */
export const VendorLayout = () => {
  const { signOut, profile } = useAuthStore();
  const { pathname } = useLocation();

  const hasAcceptedContract = Boolean(profile?.agreement_accepted);
  const isDigitalContractPath = pathname.startsWith('/vendor/digital-contract');

  if (!hasAcceptedContract && !isDigitalContractPath) {
    return <Navigate to="/vendor/digital-contract" replace />;
  }

  const vendorLinks = [
    { to: '/vendor/dashboard', icon: HomeIcon, label: 'لوحة التحكم' },
    { to: '/vendor/products', icon: ShoppingBagIcon, label: 'منتجاتي' },
    { to: '/vendor/orders', icon: ClipboardDocumentListIcon, label: 'الطلبات' },
    { to: '/vendor/delivery-options', icon: TruckIcon, label: 'خيار التوصيل' },
    { to: '/vendor/driver-preferences', icon: TruckIcon, label: 'السائق المفضل' },
    { to: '/vendor/find-driver', icon: UsersIcon, label: 'البحث عن سائق' },
    { to: '/vendor/analytics', icon: ChartBarIcon, label: 'التحليلات' },
    { to: '/vendor/reviews', icon: StarIcon, label: 'التقييمات' },
    { to: '/vendor/coupons', icon: CurrencyDollarIcon, label: 'الكوبونات' },
    { to: '/vendor/schedules', icon: MapIcon, label: 'المواعيد' },
    { to: '/vendor/location', icon: MapIcon, label: 'الموقع' },
    { to: '/vendor/profile', icon: Cog6ToothIcon, label: 'الملف الشخصي' },
    { to: '/vendor/settings', icon: Cog6ToothIcon, label: 'الإعدادات' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <Link to="/vendor/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">ق</span>
            </div>
            <span className="font-bold text-gray-900 dark:text-white">متجري</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {vendorLinks.map((link) => (
            <SideNavLink key={link.to} {...link} />
          ))}
        </nav>
        <div className="p-3 space-y-1 border-t border-gray-200 dark:border-gray-700">
          <Link to="/" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <HomeIcon className="w-5 h-5" />
            العودة للموقع
          </Link>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {vendorLinks.find(l => pathname.startsWith(l.to))?.label || 'البائع'}
          </h1>
          <NotificationLink ariaLabel="الإشعارات" />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

/**
 * DriverLayout - Sidebar layout for driver panel
 */
export const DriverLayout = () => {
  const { signOut } = useAuthStore();
  const { pathname } = useLocation();

  const driverLinks = [
    { to: '/driver/dashboard', icon: HomeIcon, label: 'لوحة التحكم' },
    { to: '/driver/active', icon: TruckIcon, label: 'التوصيلات النشطة' },
    { to: '/driver/available', icon: MapIcon, label: 'الطلبات المتاحة' },
    { to: '/driver/vendor-preferences', icon: ShoppingBagIcon, label: 'البائع المفضل' },
    { to: '/driver/find-vendor', icon: UsersIcon, label: 'البحث عن بائع' },
    { to: '/driver/history', icon: ClipboardDocumentListIcon, label: 'السجل' },
    { to: '/driver/earnings', icon: CurrencyDollarIcon, label: 'الأرباح' },
    { to: '/driver/profile', icon: Cog6ToothIcon, label: 'الملف الشخصي' },
    { to: '/driver/settings', icon: Cog6ToothIcon, label: 'الإعدادات' },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <Link to="/driver/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <TruckIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white">السائق</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {driverLinks.map((link) => (
            <SideNavLink key={link.to} {...link} />
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {driverLinks.find(l => pathname.startsWith(l.to))?.label || 'السائق'}
          </h1>
          <NotificationLink ariaLabel="الإشعارات" />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ProtectedRoute;
