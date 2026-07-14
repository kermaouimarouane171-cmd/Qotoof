import React, { Suspense, useEffect, useState } from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { USER_ROLES } from '@/constants/roles';
import { Logo } from '@/components/ui';
import Navbar from '@/components/Navbar';
import NotificationLink from '@/components/notifications/NotificationLink';
import {
  ChartBarIcon,
  ShoppingBagIcon,
  ClipboardDocumentListIcon,
  BuildingStorefrontIcon,
  UsersIcon,
  Cog6ToothIcon,
  TruckIcon,
  StarIcon,
  CurrencyDollarIcon,
  MapIcon,
  HomeIcon,
  DocumentChartBarIcon,
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  UserCircleIcon,
  FlagIcon,
  ExclamationTriangleIcon,
  HeartIcon,
  ShoppingCartIcon,
  MoonIcon,
  SunIcon,
  BanknotesIcon,
  ArrowUturnLeftIcon,
  WrenchScrewdriverIcon,
  ClockIcon,
  DocumentCheckIcon,
  CalculatorIcon,
} from '@heroicons/react/24/outline';
import { ShoppingCartIcon as ShoppingCartSolid } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/modules/cart';
import { useLanguageStore } from '@/store/languageStore';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useOnboardingGate } from '@/orchestrators/OnboardingOrchestrator';
import { usePaymentGuard } from '@/contexts/PaymentGuard';
import { CartAbandonmentRecovery } from '@/components/ui';
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
          className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          onClick={onRetry}
        >
          {t('auth.timeout.retry', 'Retry')}
        </button>
      </div>
    </div>
  )
}

const ProfileErrorFallback = ({ onRetry }) => {
  const { t } = useTranslation();
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <ExclamationTriangleIcon className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {t('auth.profileError.title', 'Profile could not be loaded')}
        </h2>
        <p className="text-gray-600 mb-6">
          {t('auth.profileError.description', 'Your account was created but we could not load your profile. This may be a temporary issue. Please try again or log out and log back in.')}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            onClick={onRetry}
          >
            {t('auth.timeout.retry', 'Retry')}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            onClick={() => signOut()}
          >
            {t('auth.logout', 'Log out')}
          </button>
        </div>
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
  // Use individual selectors to avoid re-rendering on unrelated store changes
  // (e.g. deviceFingerprint, session, autoLogoutWarning) that cause the entire
  // ProtectedRoute to re-render and potentially trigger redirect loops.
  const user           = useAuthStore((s) => s.user);
  const profile        = useAuthStore((s) => s.profile);
  const loading        = useAuthStore((s) => s.loading);
  const profileLoading = useAuthStore((s) => s.profileLoading);
  const profileError   = useAuthStore((s) => s.profileError);
  const mfaRequired    = useAuthStore((s) => s.mfaRequired);
  const mfaPending     = useAuthStore((s) => s.mfaPending);
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
  const buyerNeedsOnboarding = profile?.role === USER_ROLES.BUYER && profile?.onboarding_completed === false
  const buyerPublicPaths = isOnboardingPath
    || /^\/(marketplace|cart|checkout|product|products|stores|favorites|search)(\/|$)/.test(location.pathname)

  if (buyerNeedsOnboarding && !buyerPublicPaths && requiredRole === USER_ROLES.BUYER) {
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
    // Profile is null. If profileError is true, the profile fetch has permanently
    // failed — show an error state with retry/logout instead of spinning forever.
    if (profileError) {
      return <ProfileErrorFallback onRetry={handleRetry} />;
    }
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
 * MainLayout - Full public layout with Navbar + Footer
 * Adds role-aware mobile bottom nav + mobile header for buyers on mobile.
 */
export const MainLayout = () => {
  const { t, i18n } = useTranslation();
  const user    = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const cartItems = useCartStore((s) => s.items);
  const cartCount = cartItems.length;
  const { language, setLanguage } = useLanguageStore();
  const { isDark: dark, toggle: toggleDark } = useDarkMode();
  useMobileKeyboardGuard();

  const isBuyer = profile?.role === USER_ROLES.BUYER;
  const isGuest = !user;
  const isAuthenticated = Boolean(user || profile);
  const role = profile?.role || USER_ROLES.GUEST;

  const roleProfilePath = {
    [USER_ROLES.BUYER]: '/buyer/settings',
    [USER_ROLES.VENDOR]: '/vendor/profile',
    [USER_ROLES.DRIVER]: '/driver/profile',
    [USER_ROLES.ADMIN]: '/admin/settings',
  }[role] || '/login';

  const roleDashboardPath = {
    [USER_ROLES.BUYER]: '/marketplace',
    [USER_ROLES.VENDOR]: '/vendor/dashboard',
    [USER_ROLES.DRIVER]: '/driver/dashboard',
    [USER_ROLES.ADMIN]: '/admin/dashboard',
  }[role] || null;

  const mainTabs = isBuyer
    ? [
        { to: '/marketplace', icon: ShoppingBagIcon, label: t('layout.buyer.mobileTabs.marketplace', 'السوق') },
        { to: '/cart', icon: ShoppingCartIcon, label: t('layout.buyer.mobileTabs.cart', 'السلة') },
        { to: '/buyer/orders', icon: ClipboardDocumentListIcon, label: t('layout.buyer.mobileTabs.orders', 'طلباتي') },
        { to: '/buyer/tracking', icon: TruckIcon, label: t('layout.buyer.mobileTabs.tracking', 'تتبع') },
        { to: '/buyer/settings', icon: Cog6ToothIcon, label: t('layout.buyer.mobileTabs.settings', 'الإعدادات') },
      ]
    : isGuest
    ? [
        { to: '/', icon: HomeIcon, label: t('layout.buyer.mobileTabs.home', 'Home') },
        { to: '/marketplace', icon: ShoppingBagIcon, label: t('layout.buyer.mobileTabs.marketplace', 'Market') },
        { to: '/stores', icon: BuildingStorefrontIcon, label: t('layout.buyer.mobileTabs.stores', 'المتاجر') },
        { to: '/tracking', icon: TruckIcon, label: t('layout.buyer.mobileTabs.tracking', 'تتبع') },
      ]
    : [
        { to: '/', icon: HomeIcon, label: t('layout.buyer.mobileTabs.home', 'Home') },
        { to: '/marketplace', icon: ShoppingBagIcon, label: t('layout.buyer.mobileTabs.marketplace', 'Market') },
        { to: '/stores', icon: BuildingStorefrontIcon, label: t('layout.buyer.mobileTabs.stores', 'المتاجر') },
      ];

  const mainMobileActions = (
    <div className="flex items-center gap-1">
      <Link
          to="/favorites"
          className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={t('nav.favorites', 'المفضلة')}
        >
          <HeartIcon className="w-5.5 h-5.5" style={{ width: '22px', height: '22px' }} />
        </Link>

      <Link
        to="/cart"
        className="relative inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={t('nav.cart', 'السلة')}
      >
        {cartCount > 0 ? (
          <ShoppingCartSolid className="text-primary-600" style={{ width: '22px', height: '22px' }} />
        ) : (
          <ShoppingCartIcon style={{ width: '22px', height: '22px' }} />
        )}
        {cartCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-primary-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </Link>

      {/* Notifications — only for authenticated users */}
      {isAuthenticated && (
        <NotificationLink
          ariaLabel={t('nav.notifications', 'الإشعارات')}
          className="relative inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          iconClassName="w-[22px] h-[22px]"
          badgeClassName="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none"
        />
      )}

      {isAuthenticated ? (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={t('layout.shared.profile', 'الحساب')}
        >
          <UserCircleIcon style={{ width: '24px', height: '24px' }} />
        </button>
      ) : (
        <Link
          to="/login"
          className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={t('auth.login.signIn', 'Sign In')}
        >
          <UserCircleIcon style={{ width: '24px', height: '24px' }} />
        </Link>
      )}

      <button
        onClick={toggleDark}
        className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={dark ? t('nav.lightMode', 'Light mode') : t('nav.darkMode', 'Dark mode')}
      >
        {dark ? <SunIcon style={{ width: '22px', height: '22px' }} /> : <MoonIcon style={{ width: '22px', height: '22px' }} />}
      </button>

      <button
        onClick={() => {
          const langs = ['ar', 'fr', 'en'];
          const currentIdx = langs.indexOf(language || i18n.language || 'ar');
          const nextLang = langs[(currentIdx + 1) % langs.length];
          setLanguage(nextLang);
        }}
        className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-[11px] font-bold"
        aria-label={t('nav.changeLanguage', 'Change language')}
      >
        {(language || i18n.language || 'ar').toUpperCase().slice(0, 2)}
      </button>
    </div>
  );

  const buyerMainLinks = [
    { to: '/buyer/dashboard', icon: ChartBarIcon, label: t('layout.buyer.links.dashboard', 'لوحة التحكم') },
    { to: '/buyer/orders', icon: ClipboardDocumentListIcon, label: t('layout.buyer.links.orders', 'طلباتي') },
    { to: '/buyer/addresses', icon: MapIcon, label: t('layout.buyer.links.addresses', 'العناوين') },
    { to: '/buyer/coupons', icon: CurrencyDollarIcon, label: t('layout.buyer.links.coupons', 'الكوبونات') },
    { to: '/buyer/loyalty', icon: StarIcon, label: t('layout.buyer.links.loyalty', 'نقاط الولاء') },
    { to: '/buyer/shopping-lists', icon: ShoppingBagIcon, label: t('layout.buyer.links.shoppingLists', 'قوائم التسوق') },
    { to: '/buyer/rfq', icon: DocumentChartBarIcon, label: t('layout.buyer.links.rfq', 'طلب عروض') },
    { to: '/buyer/security', icon: ShieldCheckIcon, label: t('layout.buyer.links.security', 'الأمان') },
    { to: '/buyer/settings', icon: Cog6ToothIcon, label: t('layout.buyer.links.settings', 'الإعدادات') },
    { to: '/profile', icon: UserCircleIcon, label: t('layout.buyer.links.profile', 'الملف الشخصي') },
  ];

  const nonBuyerMainLinks = [
    ...(roleDashboardPath ? [{ to: roleDashboardPath, icon: ChartBarIcon, label: t('nav.dashboard', 'لوحة التحكم') }] : []),
    { to: '/profile', icon: UserCircleIcon, label: t('layout.buyer.links.profile', 'الملف الشخصي') },
    { to: roleProfilePath, icon: Cog6ToothIcon, label: t('layout.buyer.links.settings', 'الإعدادات') },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-950">
      <Navbar />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 focus:z-50 focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg">
        {t('layout.main.skipToContent', 'Skip to main content')}
      </a>
      <main id="main" className="flex-1 mobile-safe-top-offset mobile-safe-bottom-offset">
        <Outlet />
      </main>
      <footer className="hidden md:block bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-6">
            <div>
              <Logo size="sm" showText={true} textClass="text-gray-900 dark:text-white" className="mb-3" />
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('home.footer.description', "Morocco's leading B2B wholesale marketplace for fresh produce.")}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">{t('layout.main.quickLinks', 'Quick Links')}</h4>
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li><Link to="/marketplace" className="hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">{t('nav.marketplace', 'Marketplace')}</Link></li>
                <li><Link to="/stores" className="hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">{t('nav.stores', 'Stores')}</Link></li>
                <li><Link to="/cart" className="hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">{t('nav.cart', 'Cart')}</Link></li>
                <li><Link to="/help" className="hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">{t('home.footer.helpCenter', 'Help Center')}</Link></li>
                <li><Link to="/contact" className="hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">{t('layout.main.contactUs', 'Contact Us')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">{t('home.footer.forBuyers', 'For Buyers')}</h4>
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li><Link to="/marketplace" className="hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">{t('home.footer.browseMarketplace', 'Browse Marketplace')}</Link></li>
                <li><Link to="/register?role=buyer" className="hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">{t('home.footer.registerAsBuyer', 'Register as Buyer')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">{t('layout.main.forVendors', 'For Vendors')}</h4>
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li><Link to="/register?role=vendor" className="hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">{t('home.footer.becomeVendor', 'Become a Vendor')}</Link></li>
                <li><Link to={isAuthenticated && role === USER_ROLES.VENDOR ? '/vendor/dashboard' : '/register?role=vendor'} className="hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">{t('nav.dashboard', 'Dashboard')}</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">{t('home.footer.forDrivers', 'For Drivers')}</h4>
              <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
                <li><Link to="/become-driver" className="hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">{t('home.footer.becomeDriver', 'Become a Driver')}</Link></li>
                <li><Link to="/register?role=driver" className="hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">{t('home.footer.registerAsDriver', 'Register as Driver')}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('home.footer.copyright', { year: new Date().getFullYear() })}</p>
          </div>
        </div>
      </footer>

      <RoleMobileHeader
        title={t('layout.buyer.panelTitle', 'Qotoof')}
        onToggleDrawer={() => setDrawerOpen(true)}
        profilePath={isAuthenticated ? roleProfilePath : '/login'}
        t={t}
        extraMobileActions={mainMobileActions}
        isAuthenticated={isAuthenticated}
      />

      {isAuthenticated && (
        <RoleMobileDrawer
          isOpen={drawerOpen}
          closeDrawer={() => setDrawerOpen(false)}
          panelTitle={isBuyer ? t('layout.buyer.panelTitle', 'Buyer') : t('layout.shared.account', 'حسابي')}
          panelHome={roleDashboardPath || '/marketplace'}
          panelIcon={(
            <img src="/icon-192x192.png" alt="Qotoof" className="w-8 h-8 rounded-lg object-cover" aria-hidden="true" />
          )}
          links={isBuyer ? buyerMainLinks : nonBuyerMainLinks}
          extraDrawerLinks={[
            { to: '/', icon: HomeIcon, label: t('layout.shared.backToSite', 'Back to Site') },
          ]}
          onSignOut={() => signOut()}
          t={t}
        />
      )}

      <RoleMobileBottomNav
        tabs={mainTabs}
        roleName={role}
        badgeCounts={{ '/cart': cartCount }}
      />

      <CartAbandonmentRecovery />
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
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
        active
          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
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
      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
        active
          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
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

const RoleMobileHeader = ({ title, onToggleDrawer, profilePath: _profilePath, t, extraMobileActions, isAuthenticated: headerIsAuthenticated }) => {
  const showAuthActions = headerIsAuthenticated !== false;
  return (
    <header
      dir="ltr"
      className="md:hidden fixed top-0 inset-x-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-3 flex items-center mobile-top-header"
      data-testid="role-mobile-header"
    >
      <div className="w-1/3 flex items-center justify-start gap-1">
        <Link to="/" className="inline-flex items-center justify-center w-8 h-8 rounded-lg overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label={t('nav.home', 'Home')}>
          <img src="/icon-192x192.png" alt="Qotoof" className="w-full h-full object-cover" aria-hidden="true" />
        </Link>
      </div>

      <div className="w-1/3 text-center px-2 truncate" style={{ direction: 'rtl' }}>
        <h1
          className="text-sm truncate text-gray-900 dark:text-white"
          style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}
        >
          {title}
        </h1>
      </div>

      <div className="w-1/3 flex items-center justify-end gap-1">
        {extraMobileActions ? (
          extraMobileActions
        ) : (
          <>
            {showAuthActions && (
              <NotificationLink
                ariaLabel={t('nav.notifications', 'Notifications')}
                className="relative p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                iconClassName="w-6 h-6"
              />
            )}
            <button
              type="button"
              onClick={onToggleDrawer}
              className="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label={t('layout.shared.profile', 'Profile')}
            >
              <UserCircleIcon className="w-7 h-7" />
            </button>
          </>
        )}
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
        data-testid="role-mobile-drawer"
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

const RoleMobileBottomNav = ({ tabs, roleName, onMoreTab, badgeCounts }) => {
  const { pathname } = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mobile-bottom-nav"
      dir="rtl"
      data-testid="role-mobile-bottom-nav"
      data-role={roleName}
    >
      <div className="h-15 grid" style={{ height: '60px', gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const isActive = tab.to && (pathname === tab.to || pathname.startsWith(tab.to + '/'));
          const isMore = tab.action === 'more';
          const badge = badgeCounts?.[tab.to] || 0;

          const content = (
            <div className="relative flex flex-col items-center justify-center gap-0.5">
              <tab.icon className="w-5 h-5" />
              {badge > 0 && (
                <span className="absolute -top-1 right-2 min-w-[16px] h-4 px-1 bg-primary-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              <span className="text-[11px] leading-none">{tab.label}</span>
            </div>
          );

          const className = `h-full flex items-center justify-center px-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
            isActive
              ? 'text-primary-700 border-t-2 border-primary-600'
              : 'text-slate-400 dark:text-slate-500 border-t-2 border-transparent'
          }`;

          if (isMore) {
            return (
              <button
                key={tab.to || 'more'}
                type="button"
                onClick={onMoreTab}
                className={className}
                style={{ fontFamily: 'Tajawal, sans-serif' }}
                data-route="more"
                aria-label={tab.label}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={className}
              style={{ fontFamily: 'Tajawal, sans-serif' }}
              data-route={tab.to}
              aria-current={isActive ? 'page' : undefined}
            >
              {content}
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
  extraMobileActions = null,
  children,
  mobileBottomNavMoreTab = false,
}) => {
  const { t } = useTranslation();
  useMobileKeyboardGuard();

  // Close drawer on every navigation (title is derived from pathname).
  // setDrawerOpen is a stable useState setter — intentionally not in deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDrawerOpen(false); }, [desktopHeaderTitle]);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950" dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif' }}>
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

      <div className="flex-1 flex flex-col min-w-0">
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
              className="inline-flex items-center justify-center p-1.5 rounded-lg text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label={t('layout.shared.profile', 'Profile')}
            >
              <UserCircleIcon className="w-6 h-6" />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 md:pt-6 md:pb-6 mobile-safe-top-offset mobile-safe-bottom-offset" data-testid="role-layout-main">
          {children}
        </main>
      </div>

      <RoleMobileHeader
        title={desktopHeaderTitle}
        onToggleDrawer={() => setDrawerOpen(true)}
        profilePath={mobileProfilePath}
        t={t}
        extraMobileActions={extraMobileActions}
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

      <RoleMobileBottomNav
        tabs={tabs}
        roleName={roleName}
        onMoreTab={mobileBottomNavMoreTab ? () => setDrawerOpen(true) : undefined}
      />
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
    { to: '/admin/driver-verification', icon: DocumentCheckIcon, label: t('layout.admin.links.driverVerification', 'Driver Verification') },
    { to: '/admin/settings-audit', icon: ClockIcon, label: t('layout.admin.links.settingsAudit', 'Settings Audit Log') },
    { to: '/admin/system-health', icon: WrenchScrewdriverIcon, label: t('layout.admin.links.systemHealth', 'System Health') },
  ];

  const desktopHeaderTitle = resolveActiveTitle(pathname, adminLinks, t('layout.admin.defaultTitle', 'Admin'));

  const adminTabs = [
    { to: '/admin/dashboard', icon: HomeIcon, label: t('layout.admin.mobileTabs.home', 'Home') },
    { to: '/admin/users', icon: UsersIcon, label: t('layout.admin.mobileTabs.users', 'Users') },
    { to: '/admin/products', icon: ShoppingBagIcon, label: t('layout.admin.mobileTabs.products', 'Products') },
    { to: '/admin/settings', icon: Cog6ToothIcon, label: t('layout.admin.mobileTabs.settings', 'Settings') },
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
        <Link to="/" className="text-sm text-gray-500 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">{t('layout.shared.backToSite', 'Back to Site')}</Link>
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
    { to: '/vendor/rfqs', icon: DocumentCheckIcon, label: t('layout.vendor.links.rfqs', 'RFQs') },
    { to: '/vendor/delivery-options', icon: TruckIcon, label: t('layout.vendor.links.deliveryOptions', 'Delivery Options') },
    { to: '/vendor/driver-preferences', icon: TruckIcon, label: t('layout.vendor.links.driverPreferences', 'Preferred Driver') },
    { to: '/vendor/find-driver', icon: UsersIcon, label: t('layout.vendor.links.findDriver', 'Find a Driver') },
    { to: '/vendor/analytics', icon: ChartBarIcon, label: t('layout.vendor.links.analytics', 'Analytics') },
    { to: '/vendor/reviews', icon: StarIcon, label: t('layout.vendor.links.reviews', 'Reviews') },
    { to: '/vendor/wallet', icon: BanknotesIcon, label: t('layout.vendor.links.wallet', 'Wallet') },
    { to: '/vendor/returns', icon: ArrowUturnLeftIcon, label: t('layout.vendor.links.returns', 'Returns') },
    { to: '/vendor/tax', icon: CalculatorIcon, label: t('layout.vendor.links.tax', 'Tax') },
    { to: '/vendor/coupons', icon: CurrencyDollarIcon, label: t('layout.vendor.links.coupons', 'Coupons') },
    { to: '/vendor/schedules', icon: ClockIcon, label: t('layout.vendor.links.schedules', 'Schedules') },
    { to: '/vendor/location', icon: MapIcon, label: t('layout.vendor.links.location', 'Location') },
    { to: '/vendor/subscription', icon: CurrencyDollarIcon, label: t('layout.vendor.links.subscription', 'Subscription') },
    { to: '/vendor/profile', icon: Cog6ToothIcon, label: t('layout.vendor.links.profile', 'Profile') },
    { to: '/vendor/security', icon: ShieldCheckIcon, label: t('layout.vendor.links.security', 'Security') },
    { to: '/vendor/settings', icon: Cog6ToothIcon, label: t('layout.vendor.links.settings', 'Settings') },
  ];

  const desktopHeaderTitle = resolveActiveTitle(pathname, vendorLinks, t('layout.vendor.defaultTitle', 'Vendor'));

  const vendorTabs = [
    { to: '/vendor/dashboard', icon: HomeIcon, label: t('layout.vendor.mobileTabs.home', 'Home') },
    { to: '/vendor/products', icon: ShoppingBagIcon, label: t('layout.vendor.mobileTabs.products', 'Products') },
    { to: '/vendor/orders', icon: ClipboardDocumentListIcon, label: t('layout.vendor.mobileTabs.orders', 'Orders') },
    { to: '/vendor/subscription', icon: CurrencyDollarIcon, label: t('layout.vendor.mobileTabs.subscription', 'Plan') },
    { to: '/vendor/profile', icon: UserCircleIcon, label: t('layout.vendor.mobileTabs.profile', 'Profile') },
  ];

  return (
    <RoleLayoutShell
      panelHome="/vendor/dashboard"
      panelTitle={t('layout.vendor.panelTitle', 'My Store')}
      panelIcon={(
        <img src="/icon-192x192.png" alt="Qotoof" className="w-8 h-8 rounded-lg object-cover" />
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
    { to: '/driver/wallet', icon: BanknotesIcon, label: t('layout.driver.links.wallet', 'Wallet') },
    { to: '/driver/performance', icon: ChartBarIcon, label: t('layout.driver.links.performance', 'Performance') },
    { to: '/driver/profile', icon: UserCircleIcon, label: t('layout.driver.links.profile', 'Profile') },
    { to: '/driver/settings', icon: Cog6ToothIcon, label: t('layout.driver.links.settings', 'Settings') },
    { to: '/driver/security', icon: ShieldCheckIcon, label: t('layout.driver.links.security', 'Security') },
  ];

  const desktopHeaderTitle = resolveActiveTitle(pathname, driverLinks, t('layout.driver.defaultTitle', 'Driver'));

  const driverTabs = [
    { to: '/driver/dashboard', icon: HomeIcon, label: t('layout.driver.mobileTabs.home', 'Home') },
    { to: '/driver/active', icon: TruckIcon, label: t('layout.driver.mobileTabs.active', 'Deliveries') },
    { to: '/driver/available', icon: MapIcon, label: t('layout.driver.mobileTabs.map', 'Map') },
    { to: '/driver/profile', icon: UserCircleIcon, label: t('layout.driver.mobileTabs.profile', 'Profile') },
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

export default ProtectedRoute;
