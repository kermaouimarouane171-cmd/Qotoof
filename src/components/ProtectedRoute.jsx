import React, { Suspense } from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
const LoadingFallback = () => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
        <p className="mt-4 text-gray-600">{t('common.loading', 'Loading...')}</p>
      </div>
    </div>
  );
};

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
  const { user, profile, loading, mfaRequired, mfaPending } = useAuthStore();
  const location = useLocation();

  const redirectTarget = `${location.pathname}${location.search}${location.hash}`;

  if (loading) {
    return <LoadingFallback />;
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: redirectTarget }} replace />;
  }

  if (mfaRequired && mfaPending) {
    return <Navigate to="/mfa-verify" state={{ from: redirectTarget }} replace />;
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
  const { t } = useTranslation();

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <a id="main-content" className="sr-only" href="#main" tabIndex={-1} aria-hidden="true">{t('layout.main.skipToContent', 'Skip to main content')}</a>
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
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('home.footer.description', "Morocco's leading B2B wholesale marketplace for fresh produce.")}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">{t('layout.main.quickLinks', 'Quick Links')}</h4>
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li><Link to="/marketplace" className="hover:text-green-600">{t('nav.marketplace', 'Marketplace')}</Link></li>
                <li><Link to="/stores" className="hover:text-green-600">{t('nav.stores', 'Stores')}</Link></li>
                <li><Link to="/cart" className="hover:text-green-600">{t('nav.cart', 'Cart')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">{t('layout.main.forVendors', 'For Vendors')}</h4>
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li><Link to="/register?role=vendor" className="hover:text-green-600">{t('home.footer.becomeVendor', 'Become a Vendor')}</Link></li>
                <li><Link to="/vendor/dashboard" className="hover:text-green-600">{t('nav.dashboard', 'Dashboard')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">{t('home.footer.support', 'Support')}</h4>
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li><a href="/help" className="hover:text-green-600">{t('home.footer.helpCenter', 'Help Center')}</a></li>
                <li><a href="/contact" className="hover:text-green-600">{t('layout.main.contactUs', 'Contact Us')}</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('home.footer.copyright', { year: new Date().getFullYear() })}</p>
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
  const { t } = useTranslation();

  const adminLinks = [
    { to: '/admin/dashboard', icon: HomeIcon, label: t('layout.admin.links.dashboard', 'Dashboard') },
    { to: '/admin/users', icon: UsersIcon, label: t('layout.admin.links.users', 'Users') },
    { to: '/admin/vendors', icon: ShoppingBagIcon, label: t('layout.admin.links.vendors', 'Vendors') },
    { to: '/admin/drivers', icon: TruckIcon, label: t('layout.admin.links.drivers', 'Drivers') },
    { to: '/admin/products', icon: ShoppingBagIcon, label: t('layout.admin.links.products', 'Products') },
    { to: '/admin/orders', icon: ClipboardDocumentListIcon, label: t('layout.admin.links.orders', 'Orders') },
    { to: '/admin/analytics', icon: ChartBarIcon, label: t('layout.admin.links.analytics', 'Analytics') },
    { to: '/admin/reports', icon: DocumentChartBarIcon, label: t('layout.admin.links.reports', 'Reports') },
    { to: '/admin/moderation', icon: ShieldCheckIcon, label: t('layout.admin.links.moderation', 'Moderation') },
    { to: '/admin/fraud-reports', icon: FlagIcon, label: t('layout.admin.links.fraudReports', 'Fraud Reports') },
    { to: '/admin/commissions', icon: CurrencyDollarIcon, label: t('layout.admin.links.commissions', 'Commissions') },
    { to: '/admin/commission-management', icon: CurrencyDollarIcon, label: t('layout.admin.links.commissionManagement', 'Commission Management') },
    { to: '/admin/disputes', icon: ExclamationTriangleIcon, label: t('layout.admin.links.disputes', 'Payment Disputes') },
    { to: '/admin/payouts', icon: CurrencyDollarIcon, label: t('layout.admin.links.payouts', 'Payouts') },
    { to: '/admin/reviews', icon: StarIcon, label: t('layout.admin.links.reviews', 'Reviews') },
    { to: '/admin/support-tickets', icon: ChatBubbleLeftRightIcon, label: t('layout.admin.links.supportTickets', 'Support Tickets') },
    { to: '/admin/security', icon: ShieldCheckIcon, label: t('layout.admin.links.security', 'Security') },
    { to: '/admin/settings', icon: Cog6ToothIcon, label: t('layout.admin.links.settings', 'Settings') },
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
            <span className="font-bold text-gray-900 dark:text-white">{t('layout.admin.panelTitle', 'Admin')}</span>
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
            {t('nav.logout', 'Sign Out')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {adminLinks.find((link) => pathname.startsWith(link.to))?.label || t('layout.admin.defaultTitle', 'Admin')}
          </h1>
          <div className="flex items-center gap-3">
            <NotificationLink ariaLabel={t('nav.notifications', 'Notifications')} />
            <Link to="/" className="text-sm text-gray-500 hover:text-green-600">{t('layout.shared.backToSite', 'Back to Site')}</Link>
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
  const { t } = useTranslation();

  const hasAcceptedContract = Boolean(profile?.agreement_accepted);
  const isDigitalContractPath = pathname.startsWith('/vendor/digital-contract');

  if (!hasAcceptedContract && !isDigitalContractPath) {
    return <Navigate to="/vendor/digital-contract" replace />;
  }

  const vendorLinks = [
    { to: '/vendor/dashboard', icon: HomeIcon, label: t('layout.vendor.links.dashboard', 'Dashboard') },
    { to: '/vendor/products', icon: ShoppingBagIcon, label: t('layout.vendor.links.products', 'My Products') },
    { to: '/vendor/orders', icon: ClipboardDocumentListIcon, label: t('layout.vendor.links.orders', 'Orders') },
    { to: '/vendor/delivery-options', icon: TruckIcon, label: t('layout.vendor.links.deliveryOptions', 'Delivery Options') },
    { to: '/vendor/driver-preferences', icon: TruckIcon, label: t('layout.vendor.links.driverPreferences', 'Preferred Driver') },
    { to: '/vendor/find-driver', icon: UsersIcon, label: t('layout.vendor.links.findDriver', 'Find a Driver') },
    { to: '/vendor/analytics', icon: ChartBarIcon, label: t('layout.vendor.links.analytics', 'Analytics') },
    { to: '/vendor/reviews', icon: StarIcon, label: t('layout.vendor.links.reviews', 'Reviews') },
    { to: '/vendor/coupons', icon: CurrencyDollarIcon, label: t('layout.vendor.links.coupons', 'Coupons') },
    { to: '/vendor/schedules', icon: MapIcon, label: t('layout.vendor.links.schedules', 'Schedules') },
    { to: '/vendor/location', icon: MapIcon, label: t('layout.vendor.links.location', 'Location') },
    { to: '/vendor/profile', icon: Cog6ToothIcon, label: t('layout.vendor.links.profile', 'Profile') },
    { to: '/vendor/settings', icon: Cog6ToothIcon, label: t('layout.vendor.links.settings', 'Settings') },
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
            <span className="font-bold text-gray-900 dark:text-white">{t('layout.vendor.panelTitle', 'My Store')}</span>
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
            {t('layout.shared.backToSite', 'Back to Site')}
          </Link>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            {t('nav.logout', 'Sign Out')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {vendorLinks.find((link) => pathname.startsWith(link.to))?.label || t('layout.vendor.defaultTitle', 'Vendor')}
          </h1>
          <NotificationLink ariaLabel={t('nav.notifications', 'Notifications')} />
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
  const { t } = useTranslation();

  const driverLinks = [
    { to: '/driver/dashboard', icon: HomeIcon, label: t('layout.driver.links.dashboard', 'Dashboard') },
    { to: '/driver/active', icon: TruckIcon, label: t('layout.driver.links.active', 'Active Deliveries') },
    { to: '/driver/available', icon: MapIcon, label: t('layout.driver.links.available', 'Available Orders') },
    { to: '/driver/vendor-preferences', icon: ShoppingBagIcon, label: t('layout.driver.links.vendorPreferences', 'Preferred Vendor') },
    { to: '/driver/find-vendor', icon: UsersIcon, label: t('layout.driver.links.findVendor', 'Find a Vendor') },
    { to: '/driver/history', icon: ClipboardDocumentListIcon, label: t('layout.driver.links.history', 'History') },
    { to: '/driver/earnings', icon: CurrencyDollarIcon, label: t('layout.driver.links.earnings', 'Earnings') },
    { to: '/driver/profile', icon: Cog6ToothIcon, label: t('layout.driver.links.profile', 'Profile') },
    { to: '/driver/settings', icon: Cog6ToothIcon, label: t('layout.driver.links.settings', 'Settings') },
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
            <span className="font-bold text-gray-900 dark:text-white">{t('layout.driver.panelTitle', 'Driver')}</span>
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
            {t('nav.logout', 'Sign Out')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {driverLinks.find((link) => pathname.startsWith(link.to))?.label || t('layout.driver.defaultTitle', 'Driver')}
          </h1>
          <NotificationLink ariaLabel={t('nav.notifications', 'Notifications')} />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ProtectedRoute;
