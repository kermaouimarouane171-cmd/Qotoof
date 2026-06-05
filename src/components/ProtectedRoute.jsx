import React, { Suspense, useEffect, useState } from 'react';
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
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useOnboardingGate } from '@/orchestrators/OnboardingOrchestrator';
import { usePaymentGuard } from '@/contexts/PaymentGuard';
import { useMobileKeyboardGuard } from '@/hooks/useMobileKeyboardGuard';

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

const AuthTimeoutFallback = ({ onRetry }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-md px-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {t('auth.timeout.title', 'Authentication is taking longer than expected')}
        </h2>
        <p className="text-gray-600 mb-4">
          {t('auth.timeout.description', 'Please refresh the page and try again.')}
        </p>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          onClick={onRetry}
        >
          {t('auth.timeout.retry', 'Retry')}
        </button>
      </div>
    </div>
  )
}

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
  const { user, profile, loading, profileLoading, profileError, mfaRequired, mfaPending } = useAuthStore();
  const { isBlocking } = useOnboardingGate();
  const { shouldRedirect, redirectTo, message } = usePaymentGuard();
  const location = useLocation();
  const [authLoadingTimedOut, setAuthLoadingTimedOut] = useState(false);

  const redirectTarget = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (!loading && !profileLoading) {
      setAuthLoadingTimedOut(false)
      return undefined
    }

    const timeoutId = setTimeout(() => {
      setAuthLoadingTimedOut(true)
    }, 10000)

    return () => clearTimeout(timeoutId)
  }, [loading, profileLoading])

  const isOnboardingPath = location.pathname.startsWith('/onboarding')
  // profileNotYetLoaded only blocks while the profile is genuinely loading.
  // If fetchProfile permanently failed (profileError=true) we must NOT block
  // forever — let the route proceed so the user sees a sensible fallback.
  const profileNotYetLoaded = Boolean(user && !profile && !profileLoading && !loading && !profileError)

  const handleRetry = () => {
    if (user && !profile) {
      useAuthStore.getState().refreshProfile?.().catch(() => {})
    }
    window.location.reload()
  }

  if (loading || profileLoading || isBlocking || profileNotYetLoaded) {
    if (authLoadingTimedOut) {
      return <AuthTimeoutFallback onRetry={handleRetry} />
    }
    return <LoadingFallback />;
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: redirectTarget }} replace />;
  }

  if (mfaRequired && mfaPending) {
    return <Navigate to="/mfa-verify" state={{ from: redirectTarget }} replace />;
  }

  // Incomplete buyer profile: allow onboarding + public marketplace paths (avoid login/dashboard loops).
  const buyerNeedsOnboarding = profile?.role === 'buyer' && profile?.onboarding_completed === false
  const buyerPublicPaths = isOnboardingPath
    || /^\/(marketplace|cart|checkout|product|products|stores|favorites|search)(\/|$)/.test(location.pathname)

  if (buyerNeedsOnboarding && !buyerPublicPaths && requiredRole === 'buyer') {
    return <Navigate to="/onboarding/buyer" replace />;
  }

  // Role check: allowedRoles takes precedence; requiredRole is a single-role shorthand.
  if (profile?.role) {
    if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
      return <Navigate to="/unauthorized" replace />;
    }
    if (!allowedRoles.length && requiredRole && profile.role !== requiredRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  } else if (requiredRole || allowedRoles.length > 0) {
    return <LoadingFallback />;
  }

  if (shouldRedirect && redirectTo) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{
          paypalSetupRequired: true,
          paypalSetupMessage: message,
          from: redirectTarget,
        }}
      />
    );
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

const MobileSideNavLink = ({ to, icon: Icon, label, onClick }) => {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(to + '/');

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-base transition-colors ${
        active
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      style={{ fontFamily: 'Tajawal, sans-serif' }}
    >
      <Icon className="w-6 h-6 flex-shrink-0" />
      <span>{label}</span>
    </Link>
  );
};

const resolveActiveTitle = (pathname, links, fallback) => {
  const exact = links.find((link) => pathname === link.to);
  if (exact) return exact.label;

  const startsWithMatch = links.find((link) => pathname.startsWith(link.to + '/'));
  if (startsWithMatch) return startsWithMatch.label;

  const segmentMatch = links.find((link) => pathname.startsWith(link.to));
  return segmentMatch?.label || fallback;
};

const RoleMobileHeader = ({ title, onToggleDrawer, profilePath, t }) => {
  return (
    <header
      dir="ltr"
      className="md:hidden fixed top-0 inset-x-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-3 flex items-center mobile-top-header"
      data-testid="role-mobile-header"
    >
      <div className="w-1/3 flex items-center justify-start gap-1.5">
        <button
          type="button"
          onClick={onToggleDrawer}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={t('layout.shared.openMenu', 'Open menu')}
        >
          <Bars3Icon className="w-6 h-6" />
        </button>
        <Link to="/" className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-green-700 text-white">
          <span className="text-base font-extrabold" style={{ fontFamily: 'Cairo, sans-serif' }}>ق</span>
        </Link>
      </div>

      <div className="w-1/3 text-center px-2 truncate" style={{ direction: 'rtl' }}>
        <h1
          className="text-base truncate text-gray-900 dark:text-white"
          style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}
        >
          {title}
        </h1>
      </div>

      <div className="w-1/3 flex items-center justify-end gap-1">
        <NotificationLink
          ariaLabel={t('nav.notifications', 'Notifications')}
          className="relative p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          iconClassName="w-6 h-6"
        />
        <Link
          to={profilePath}
          className="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label={t('layout.shared.profile', 'Profile')}
        >
          <UserCircleIcon className="w-7 h-7" />
        </Link>
      </div>
    </header>
  );
};

const RoleMobileDrawer = ({
  isOpen,
  closeDrawer,
  panelTitle,
  panelHome,
  panelIcon,
  links,
  extraDrawerLinks = [],
  onSignOut,
  t,
}) => {
  return (
    <>
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={closeDrawer}
        aria-hidden="true"
      />

      <aside
        className={`md:hidden fixed top-0 right-0 bottom-0 z-50 w-[80vw] max-w-[320px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        dir="rtl"
      >
        <div className="h-16 px-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            type="button"
            onClick={closeDrawer}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={t('layout.shared.closeMenu', 'Close menu')}
          >
            <XMarkIcon className="w-6 h-6" />
          </button>

          <Link to={panelHome} onClick={closeDrawer} className="flex items-center gap-2.5">
            {panelIcon}
            <span className="text-gray-900 dark:text-white" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
              {panelTitle}
            </span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          {links.map((link) => (
            <MobileSideNavLink key={link.to} {...link} onClick={closeDrawer} />
          ))}

          {extraDrawerLinks.map((extra) => (
            <Link
              key={extra.to}
              to={extra.to}
              onClick={closeDrawer}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-base text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              style={{ fontFamily: 'Tajawal, sans-serif' }}
            >
              <extra.icon className="w-6 h-6" />
              <span>{extra.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onSignOut}
            className="flex items-center gap-3 px-3 py-3 rounded-xl text-base text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
            style={{ fontFamily: 'Tajawal, sans-serif' }}
          >
            <ArrowRightOnRectangleIcon className="w-6 h-6" />
            {t('nav.logout', 'Sign Out')}
          </button>
        </div>
      </aside>
    </>
  );
};

const RoleMobileBottomNav = ({ tabs, roleName }) => {
  const { pathname } = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mobile-bottom-nav"
      dir="rtl"
      data-testid="role-mobile-bottom-nav"
      data-role={roleName}
    >
      <div className="h-16 grid grid-cols-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.to || pathname.startsWith(tab.to + '/');

          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`h-full flex flex-col items-center justify-center gap-0.5 px-1 ${
                isActive
                  ? 'text-green-700 bg-green-50 dark:bg-green-900/20'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
              style={{ fontFamily: 'Tajawal, sans-serif' }}
              data-route={tab.to}
              aria-current={isActive ? 'page' : undefined}
            >
              <tab.icon className="w-6 h-6" />
              <span className="text-[10px] leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

const RoleLayoutShell = ({
  panelHome,
  panelTitle,
  panelIcon,
  links,
  desktopHeaderTitle,
  desktopProfilePath,
  mobileProfilePath,
  tabs,
  roleName,
  onSignOut,
  drawerOpen,
  setDrawerOpen,
  extraDrawerLinks = [],
  extraDesktopActions = null,
  children,
}) => {
  const { t } = useTranslation();
  useMobileKeyboardGuard();

  // Close drawer on every navigation (title is derived from pathname).
  // setDrawerOpen is a stable useState setter — intentionally not in deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDrawerOpen(false); }, [desktopHeaderTitle]);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 overflow-x-hidden" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <aside className="hidden md:flex w-64 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <Link to={panelHome} className="flex items-center gap-2">
            {panelIcon}
            <span className="text-gray-900 dark:text-white" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
              {panelTitle}
            </span>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <SideNavLink key={link.to} {...link} />
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 w-full"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            {t('nav.logout', 'Sign Out')}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="hidden md:flex bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 items-center justify-between">
          <h1
            className="text-lg text-gray-900 dark:text-white"
            style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}
          >
            {desktopHeaderTitle}
          </h1>

          <div className="flex items-center gap-2">
            {extraDesktopActions}
            <NotificationLink ariaLabel={t('nav.notifications', 'Notifications')} />
            <Link
              to={desktopProfilePath}
              className="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-500 hover:text-green-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={t('layout.shared.profile', 'Profile')}
            >
              <UserCircleIcon className="w-6 h-6" />
            </Link>
          </div>
        </header>

        <RoleMobileHeader
          title={desktopHeaderTitle}
          onToggleDrawer={() => setDrawerOpen(true)}
          profilePath={mobileProfilePath}
          t={t}
        />

        <RoleMobileDrawer
          isOpen={drawerOpen}
          closeDrawer={() => setDrawerOpen(false)}
          panelTitle={panelTitle}
          panelHome={panelHome}
          panelIcon={panelIcon}
          links={links}
          extraDrawerLinks={extraDrawerLinks}
          onSignOut={onSignOut}
          t={t}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 md:pt-6 md:pb-6 mobile-safe-top-offset mobile-safe-bottom-offset" data-testid="role-layout-main">
          {children}
        </main>

        <RoleMobileBottomNav tabs={tabs} roleName={roleName} />
      </div>
    </div>
  );
};

/**
 * AdminLayout - Sidebar layout for admin panel
 */
export const AdminLayout = () => {
  const { signOut } = useAuthStore();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const desktopHeaderTitle = resolveActiveTitle(pathname, adminLinks, t('layout.admin.defaultTitle', 'Admin'));

  const adminTabs = [
    { to: '/admin/dashboard', icon: HomeIcon, label: 'الرئيسية' },
    { to: '/admin/users', icon: UsersIcon, label: 'المستخدمون' },
    { to: '/admin/products', icon: ShoppingBagIcon, label: 'المنتجات' },
    { to: '/admin/settings', icon: Cog6ToothIcon, label: 'الإعدادات' },
  ];

  return (
    <RoleLayoutShell
      panelHome="/admin/dashboard"
      panelTitle={t('layout.admin.panelTitle', 'Admin')}
      panelIcon={(
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <ShieldCheckIcon className="w-5 h-5 text-white" />
        </div>
      )}
      links={adminLinks}
      desktopHeaderTitle={desktopHeaderTitle}
      desktopProfilePath="/admin/settings"
      mobileProfilePath="/admin/settings"
      tabs={adminTabs}
      roleName="admin"
      onSignOut={() => signOut()}
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      extraDesktopActions={(
        <Link to="/" className="text-sm text-gray-500 hover:text-green-600">{t('layout.shared.backToSite', 'Back to Site')}</Link>
      )}
    >
      <Outlet />
    </RoleLayoutShell>
  );
};

/**
 * VendorLayout - Sidebar layout for vendor panel
 */
export const VendorLayout = () => {
  const { signOut, profile } = useAuthStore();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const hasAcceptedContract = Boolean(profile?.agreement_accepted);
  const isDigitalContractPath = pathname.startsWith('/vendor/digital-contract');

  // Only redirect when the profile has actually loaded (profile !== null).
  // If profile is null (still loading or fetch failed) we must not redirect —
  // otherwise a transient fetch failure causes an infinite redirect loop to
  // /vendor/digital-contract even for vendors who already signed the contract.
  const mustSignContract = profile !== null && !hasAcceptedContract && !isDigitalContractPath;

  // UX: explain the silent redirect so the vendor understands why other pages
  // are unavailable. A fixed toast id de-duplicates the message across re-renders
  // and route changes, so this never spams or causes a redirect loop.
  useEffect(() => {
    if (mustSignContract) {
      toast(
        t(
          'layout.vendor.contractGate',
          'لإكمال تفعيل حسابك كبائع، يجب توقيع العقد الرقمي أولًا. بعد التوقيع ستتمكن من استخدام لوحة البائع والمنتجات والطلبات.'
        ),
        { id: 'vendor-contract-gate', icon: 'ℹ️', duration: 5000 }
      );
    }
  }, [mustSignContract, t]);

  if (mustSignContract) {
    return <Navigate to="/vendor/digital-contract" replace />;
  }

  // UX: when the vendor is on the digital-contract page and has not yet
  // signed, render a minimal standalone experience so the vendor does not
  // see the full dashboard sidebar/bottom-nav with disabled links.
  const isPreActivation = !hasAcceptedContract && isDigitalContractPath;
  if (isPreActivation) {
    return (
      <div className="min-h-screen bg-gray-50" dir="rtl">
        <Outlet />
      </div>
    );
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

  const desktopHeaderTitle = resolveActiveTitle(pathname, vendorLinks, t('layout.vendor.defaultTitle', 'Vendor'));

  const vendorTabs = [
    { to: '/vendor/dashboard', icon: HomeIcon, label: 'الرئيسية' },
    { to: '/vendor/products', icon: ShoppingBagIcon, label: 'منتجاتي' },
    { to: '/vendor/orders', icon: ClipboardDocumentListIcon, label: 'الطلبات' },
    { to: '/vendor/profile', icon: UserCircleIcon, label: 'ملفي' },
  ];

  return (
    <RoleLayoutShell
      panelHome="/vendor/dashboard"
      panelTitle={t('layout.vendor.panelTitle', 'My Store')}
      panelIcon={(
        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm" style={{ fontFamily: 'Cairo, sans-serif' }}>ق</span>
        </div>
      )}
      links={vendorLinks}
      desktopHeaderTitle={desktopHeaderTitle}
      desktopProfilePath="/vendor/profile"
      mobileProfilePath="/vendor/profile"
      tabs={vendorTabs}
      roleName="vendor"
      onSignOut={() => signOut()}
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      extraDrawerLinks={[
        { to: '/', icon: HomeIcon, label: t('layout.shared.backToSite', 'Back to Site') },
      ]}
    >
      <Outlet />
    </RoleLayoutShell>
  );
};

/**
 * DriverLayout - Sidebar layout for driver panel
 */
export const DriverLayout = () => {
  const { signOut } = useAuthStore();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const desktopHeaderTitle = resolveActiveTitle(pathname, driverLinks, t('layout.driver.defaultTitle', 'Driver'));

  const driverTabs = [
    { to: '/driver/dashboard', icon: HomeIcon, label: 'الرئيسية' },
    { to: '/driver/active', icon: TruckIcon, label: 'توصيلاتي' },
    { to: '/driver/available', icon: MapIcon, label: 'الخريطة' },
    { to: '/driver/profile', icon: UserCircleIcon, label: 'ملفي' },
  ];

  return (
    <RoleLayoutShell
      panelHome="/driver/dashboard"
      panelTitle={t('layout.driver.panelTitle', 'Driver')}
      panelIcon={(
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <TruckIcon className="w-5 h-5 text-white" />
        </div>
      )}
      links={driverLinks}
      desktopHeaderTitle={desktopHeaderTitle}
      desktopProfilePath="/driver/profile"
      mobileProfilePath="/driver/profile"
      tabs={driverTabs}
      roleName="driver"
      onSignOut={() => signOut()}
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
    >
      <Outlet />
    </RoleLayoutShell>
  );
};

/**
 * BuyerLayout - Sidebar layout for buyer panel
 */
export const BuyerLayout = () => {
  const { signOut } = useAuthStore();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const buyerLinks = [
    { to: '/buyer/dashboard', icon: HomeIcon, label: t('layout.buyer.links.dashboard', 'Dashboard') },
    { to: '/marketplace', icon: ShoppingBagIcon, label: t('layout.buyer.links.marketplace', 'Marketplace') },
    { to: '/buyer/orders', icon: ClipboardDocumentListIcon, label: t('layout.buyer.links.orders', 'My Orders') },
    { to: '/buyer/addresses', icon: MapIcon, label: t('layout.buyer.links.addresses', 'Addresses') },
    { to: '/buyer/coupons', icon: CurrencyDollarIcon, label: t('layout.buyer.links.coupons', 'Coupons') },
    { to: '/buyer/loyalty', icon: StarIcon, label: t('layout.buyer.links.loyalty', 'Loyalty') },
    { to: '/buyer/shopping-lists', icon: ShoppingBagIcon, label: t('layout.buyer.links.shoppingLists', 'Shopping Lists') },
    { to: '/buyer/rfq', icon: DocumentChartBarIcon, label: t('layout.buyer.links.rfq', 'RFQ') },
    { to: '/buyer/security', icon: ShieldCheckIcon, label: t('layout.buyer.links.security', 'Security') },
    { to: '/buyer/settings', icon: Cog6ToothIcon, label: t('layout.buyer.links.settings', 'Settings') },
  ];

  const desktopHeaderTitle = resolveActiveTitle(pathname, buyerLinks, t('layout.buyer.defaultTitle', 'Buyer'));

  const buyerTabs = [
    { to: '/buyer/dashboard', icon: HomeIcon, label: 'الرئيسية' },
    { to: '/marketplace', icon: ShoppingBagIcon, label: 'السوق' },
    { to: '/buyer/orders', icon: ClipboardDocumentListIcon, label: 'طلباتي' },
    { to: '/buyer/settings', icon: UserCircleIcon, label: 'ملفي' },
  ];

  return (
    <RoleLayoutShell
      panelHome="/buyer/dashboard"
      panelTitle={t('layout.buyer.panelTitle', 'Buyer')}
      panelIcon={(
        <div className="w-8 h-8 bg-green-700 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm" style={{ fontFamily: 'Cairo, sans-serif' }}>ق</span>
        </div>
      )}
      links={buyerLinks}
      desktopHeaderTitle={desktopHeaderTitle}
      desktopProfilePath="/buyer/settings"
      mobileProfilePath="/buyer/settings"
      tabs={buyerTabs}
      roleName="buyer"
      onSignOut={() => signOut()}
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
    >
      <Outlet />
    </RoleLayoutShell>
  );
};

export default ProtectedRoute;
