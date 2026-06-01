/**
 * AppRouter — all route definitions for the Qotoof application.
 *
 * Every page is lazily imported for route-level code-splitting.
 * All protected route segments use <ProtectedRoute> with RBAC.
 */

import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { ProtectedRoute, MainLayout, AdminLayout, VendorLayout, DriverLayout, BuyerLayout } from '@/components/ProtectedRoute';
import { USER_ROLES } from '@/constants/roles';

const BuyerIndexRedirect = () => {
  const { profile, loading, profileLoading } = useAuthStore();
  if (loading || profileLoading) return null;
  if (profile?.role === USER_ROLES.BUYER && profile?.onboarding_completed === false) {
    return <Navigate to="/onboarding/buyer" replace />;
  }
  return <Navigate to="/buyer/dashboard" replace />;
};

// ── Loading fallback ──────────────────────────────────────────────────────────
const LoadingFallback = () => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="inline-block">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
        <p className="mt-4 text-gray-600">{t('common.loading', 'Loading...')}</p>
      </div>
    </div>
  );
};

const SuspenseRoute = ({ children }) => (
  <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
);

/**
 * RoleOrdersRedirect — send each role to their own orders page.
 * Unauthenticated users are redirected to login (ProtectedRoute handles that
 * for inner routes; here we cover the bare /orders path).
 */
const RoleOrdersRedirect = () => {
  const { profile, loading, profileLoading } = useAuthStore();
  if (loading || profileLoading) return null;
  if (!profile) return <Navigate to="/login" replace />;
  const destinations = {
    buyer:  '/buyer/orders',
    vendor: '/vendor/orders',
    driver: '/driver/active',
    admin:  '/admin/orders',
  };
  return <Navigate to={destinations[profile.role] || '/marketplace'} replace />;
};

// ── Auth pages ────────────────────────────────────────────────────────────────
const LoginPage             = lazy(() => import('@/pages/auth/Login'));
const RegisterPage          = lazy(() => import('@/pages/auth/Register'));
const ForgotPasswordPage    = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPasswordPage     = lazy(() => import('@/pages/auth/ResetPassword'));
const VerifyEmailPage       = lazy(() => import('@/pages/auth/VerifyEmail'));
const TwoFactorPage         = lazy(() => import('@/features/auth/components/TwoFactor'));
const PhoneVerificationPage = lazy(() => import('@/components/auth/PhoneVerification'));
const AuthCallbackPage      = lazy(() => import('@/pages/auth/AuthCallback'));

// ── Onboarding pages ──────────────────────────────────────────────────────────
const BuyerOnboardingPage  = lazy(() => import('@/pages/onboarding/BuyerOnboarding'));
const VendorOnboardingPage = lazy(() => import('@/pages/onboarding/VendorOnboarding'));
const DriverOnboardingPage = lazy(() => import('@/pages/onboarding/DriverOnboarding'));

// ── Marketplace pages ─────────────────────────────────────────────────────────
const HomePage             = lazy(() => import('@/pages/Home'));
const MarketplacePage      = lazy(() => import('@/pages/Marketplace'));
const ProductDetailPage    = lazy(() => import('@/pages/ProductDetail'));
const StoresPage           = lazy(() => import('@/pages/Stores'));
const StoreDetailPage      = lazy(() => import('@/pages/StoreDetail'));
const OrderDetailPage      = lazy(() => import('@/pages/OrderDetail'));
const CartPage             = lazy(() => import('@/pages/Cart'));
const CheckoutPage         = lazy(() => import('@/pages/CheckoutSimplified'));
const FavoritesPage        = lazy(() => import('@/pages/Favorites'));
const NotificationsPage    = lazy(() => import('@/pages/Notifications'));
const ProfilePage          = lazy(() => import('@/pages/Profile'));
const OrderConfirmationPage = lazy(() => import('@/pages/OrderConfirmation'));
const OrderTrackingPage    = lazy(() => import('@/pages/OrderTracking'));
const ProductConditionPage = lazy(() => import('@/pages/orders/ProductCondition'));
const SearchResultsPage    = lazy(() => import('@/pages/SearchResults'));
const SeasonalPage         = lazy(() => import('@/pages/Seasonal'));
const MessagesPage         = lazy(() => import('@/pages/Messages'));
const ChatPage             = lazy(() => import('@/pages/Chat'));
const BankAccountPage      = lazy(() => import('@/pages/BankAccount'));
const ActivityLogPage      = lazy(() => import('@/pages/ActivityLog'));

// ── Static / info pages ───────────────────────────────────────────────────────
const AboutPage            = lazy(() => import('@/pages/About'));
const ContactPage          = lazy(() => import('@/pages/Contact'));
const HelpCenterPage       = lazy(() => import('@/pages/HelpCenter'));
const TermsPage            = lazy(() => import('@/pages/Terms'));
const PrivacyPage          = lazy(() => import('@/pages/Privacy'));
const BecomeVendorPage     = lazy(() => import('@/pages/BecomeVendor'));
const ReturnsPage          = lazy(() => import('@/pages/Returns'));
const ShippingPage         = lazy(() => import('@/pages/Shipping'));
const TrackingPage         = lazy(() => import('@/pages/Tracking'));

// ── Buyer pages ───────────────────────────────────────────────────────────────
const BuyerDashboard       = lazy(() => import('@/pages/buyer/Dashboard'));
const BuyerOrders          = lazy(() => import('@/pages/buyer/Orders'));
const BuyerAddresses       = lazy(() => import('@/pages/buyer/Addresses'));
const BuyerSettings        = lazy(() => import('@/pages/buyer/Settings'));
const BuyerCoupons         = lazy(() => import('@/pages/buyer/Coupons'));
const BuyerLoyalty         = lazy(() => import('@/pages/buyer/Loyalty'));
const BuyerSecurity        = lazy(() => import('@/pages/buyer/Security'));
const BuyerShoppingLists   = lazy(() => import('@/pages/buyer/ShoppingLists'));
const BuyerRFQ             = lazy(() => import('@/pages/buyer/RFQ'));

// ── Vendor pages ──────────────────────────────────────────────────────────────
const VendorDashboard           = lazy(() => import('@/pages/vendor/Dashboard'));
const VendorProducts            = lazy(() => import('@/pages/vendor/Products'));
const VendorOrders              = lazy(() => import('@/pages/vendor/Orders'));
const VendorAnalytics           = lazy(() => import('@/pages/vendor/Analytics'));
const VendorProfile             = lazy(() => import('@/pages/vendor/Profile'));
const VendorReviews             = lazy(() => import('@/pages/vendor/Reviews'));
const VendorSettings            = lazy(() => import('@/pages/vendor/Settings'));
const VendorCoupons             = lazy(() => import('@/pages/vendor/Coupons'));
const VendorSchedules           = lazy(() => import('@/pages/vendor/Schedules'));
const VendorSecurity            = lazy(() => import('@/pages/vendor/Security'));
const VendorLocation            = lazy(() => import('@/pages/vendor/LocationSetup'));
const VendorDigitalContract     = lazy(() => import('@/pages/vendor/DigitalContract'));
const VendorPublicProfile       = lazy(() => import('@/pages/vendor/VendorProfile'));
const VendorDriverPreferenceSetup = lazy(() => import('@/pages/vendor/DriverPreferenceSetup'));
const VendorFindDriver          = lazy(() => import('@/pages/vendor/FindDriver'));
const VendorDeliveryOptionSetup = lazy(() => import('@/pages/vendor/DeliveryOptionSetup'));
const VendorSubscription        = lazy(() => import('@/pages/vendor/Subscription'));
const VendorRFQs                = lazy(() => import('@/pages/vendor/RFQs'));

// ── Driver pages ──────────────────────────────────────────────────────────────
const DriverDashboard          = lazy(() => import('@/pages/driver/Dashboard'));
const DriverActive             = lazy(() => import('@/pages/driver/Active'));
const DriverAvailable          = lazy(() => import('@/pages/driver/Available'));
const DriverHistory            = lazy(() => import('@/pages/driver/History'));
const DriverEarnings           = lazy(() => import('@/pages/driver/Earnings'));
const DriverProfile            = lazy(() => import('@/pages/driver/Profile'));
const DriverSettings           = lazy(() => import('@/pages/driver/Settings'));
const DriverSecurity           = lazy(() => import('@/pages/driver/Security'));
const DriverVendorPreferenceSetup = lazy(() => import('@/pages/driver/VendorPreferenceSetup'));
const DriverFindVendor         = lazy(() => import('@/pages/driver/FindVendor'));
const DriverDeliveryTracking   = lazy(() => import('@/pages/driver/DeliveryTracking'));
const DriverDeliveryPickup     = lazy(() => import('@/pages/driver/DeliveryPickup'));
const DriverDeliveryComplete   = lazy(() => import('@/pages/driver/DeliveryComplete'));

// ── Admin pages ───────────────────────────────────────────────────────────────
const AdminDashboard           = lazy(() => import('@/pages/admin/Dashboard'));
const AdminUsers               = lazy(() => import('@/pages/admin/Users'));
const AdminProducts            = lazy(() => import('@/pages/admin/Products'));
const AdminOrders              = lazy(() => import('@/pages/admin/Orders'));
const AdminAnalytics           = lazy(() => import('@/pages/admin/Analytics'));
const AdminSettings            = lazy(() => import('@/pages/admin/Settings'));
const AdminReports             = lazy(() => import('@/pages/admin/Reports'));
const AdminVendors             = lazy(() => import('@/pages/admin/Vendors'));
const AdminDrivers             = lazy(() => import('@/pages/admin/Drivers'));
const AdminModeration          = lazy(() => import('@/pages/admin/Moderation'));
const AdminCommissions         = lazy(() => import('@/pages/admin/Commissions'));
const AdminPayouts             = lazy(() => import('@/pages/admin/Payouts'));
const AdminReviews             = lazy(() => import('@/pages/admin/Reviews'));
const AdminSecurity            = lazy(() => import('@/pages/admin/Security'));
const AdminCommissionManagement = lazy(() => import('@/pages/admin/CommissionManagement'));
const AdminVerification        = lazy(() => import('@/pages/admin/Verification'));
const AdminDisputeManagement   = lazy(() => import('@/pages/admin/DisputeManagement'));
const AdminFraudReports        = lazy(() => import('@/pages/admin/FraudReports'));
const AdminSupportTickets      = lazy(() => import('@/pages/admin/SupportTickets'));

// ── Error pages ───────────────────────────────────────────────────────────────
const NotFoundPage             = lazy(() => import('@/components/NotFound'));
const UnauthorizedPage         = lazy(() => import('@/components/Unauthorized'));
const InternalServerErrorPage  = lazy(() => import('@/pages/errors/InternalServerError'));
const ServiceUnavailablePage   = lazy(() => import('@/pages/errors/ServiceUnavailable'));

// ─────────────────────────────────────────────────────────────────────────────
export function AppRouter() {
  return (
    <Routes>
      {/* ── Auth ─────────────────────────────────────────────────────────── */}
      <Route path="/login"           element={<SuspenseRoute><LoginPage /></SuspenseRoute>} />
      <Route path="/register"        element={<SuspenseRoute><RegisterPage /></SuspenseRoute>} />
      <Route path="/forgot-password" element={<SuspenseRoute><ForgotPasswordPage /></SuspenseRoute>} />
      <Route path="/reset-password"  element={<SuspenseRoute><ResetPasswordPage /></SuspenseRoute>} />
      <Route path="/verify-email"    element={<SuspenseRoute><VerifyEmailPage /></SuspenseRoute>} />
      <Route path="/mfa-verify"      element={<SuspenseRoute><TwoFactorPage /></SuspenseRoute>} />
      <Route path="/verify-phone"    element={<SuspenseRoute><PhoneVerificationPage /></SuspenseRoute>} />
      <Route path="/auth/callback"   element={<SuspenseRoute><AuthCallbackPage /></SuspenseRoute>} />

      {/* ── Onboarding ───────────────────────────────────────────────────── */}
      {/* Require authentication: unauthenticated users must log in first.    */}
      {/* Role restriction intentionally omitted – OnboardingOrchestrator     */}
      {/* enforces the correct role/path mapping after auth is verified.      */}
      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding/buyer"  element={<SuspenseRoute><BuyerOnboardingPage /></SuspenseRoute>} />
        <Route path="/onboarding/vendor" element={<SuspenseRoute><VendorOnboardingPage /></SuspenseRoute>} />
        <Route path="/onboarding/driver" element={<SuspenseRoute><DriverOnboardingPage /></SuspenseRoute>} />
      </Route>

      {/* ── Main (public + auth-gated) ───────────────────────────────────── */}
      <Route path="/" element={<MainLayout />}>
        <Route index element={<SuspenseRoute><HomePage /></SuspenseRoute>} />
        <Route path="marketplace"          element={<SuspenseRoute><MarketplacePage /></SuspenseRoute>} />
        <Route path="product/:id"          element={<SuspenseRoute><ProductDetailPage /></SuspenseRoute>} />
        <Route path="products/:id"         element={<SuspenseRoute><ProductDetailPage /></SuspenseRoute>} />
        <Route path="stores"               element={<SuspenseRoute><StoresPage /></SuspenseRoute>} />
        <Route path="stores/:id"           element={<SuspenseRoute><StoreDetailPage /></SuspenseRoute>} />
        <Route path="cart"                 element={<SuspenseRoute><CartPage /></SuspenseRoute>} />
        <Route path="search"               element={<SuspenseRoute><SearchResultsPage /></SuspenseRoute>} />
        <Route path="orders"               element={<RoleOrdersRedirect />} />
        <Route path="about"                element={<SuspenseRoute><AboutPage /></SuspenseRoute>} />
        <Route path="contact"              element={<SuspenseRoute><ContactPage /></SuspenseRoute>} />
        <Route path="help"                 element={<SuspenseRoute><HelpCenterPage /></SuspenseRoute>} />
        <Route path="terms"                element={<SuspenseRoute><TermsPage /></SuspenseRoute>} />
        <Route path="privacy"              element={<SuspenseRoute><PrivacyPage /></SuspenseRoute>} />
        <Route path="become-vendor"        element={<SuspenseRoute><BecomeVendorPage /></SuspenseRoute>} />
        <Route path="returns"              element={<SuspenseRoute><ReturnsPage /></SuspenseRoute>} />
        <Route path="shipping"             element={<SuspenseRoute><ShippingPage /></SuspenseRoute>} />
        <Route path="tracking"             element={<SuspenseRoute><TrackingPage /></SuspenseRoute>} />
        <Route path="marketplace/seasonal" element={<SuspenseRoute><SeasonalPage /></SuspenseRoute>} />
        <Route path="vendor/public/:id"    element={<SuspenseRoute><VendorPublicProfile /></SuspenseRoute>} />

        {/* authenticated, any role */}
        <Route element={<ProtectedRoute />}>
          <Route path="orders/:id"                element={<SuspenseRoute><OrderDetailPage /></SuspenseRoute>} />
          <Route path="orders/:id/tracking"       element={<SuspenseRoute><OrderTrackingPage /></SuspenseRoute>} />
          <Route path="orders/:id/condition"      element={<SuspenseRoute><ProductConditionPage /></SuspenseRoute>} />
          <Route path="order-confirmation"        element={<SuspenseRoute><OrderConfirmationPage /></SuspenseRoute>} />
          <Route path="order-confirmation/:id"    element={<SuspenseRoute><OrderConfirmationPage /></SuspenseRoute>} />
          <Route path="order-tracking/:id"        element={<SuspenseRoute><OrderTrackingPage /></SuspenseRoute>} />
          <Route path="tracking/:id"              element={<SuspenseRoute><OrderTrackingPage /></SuspenseRoute>} />
          <Route path="favorites"                 element={<SuspenseRoute><FavoritesPage /></SuspenseRoute>} />
          <Route path="notifications"             element={<SuspenseRoute><NotificationsPage /></SuspenseRoute>} />
          <Route path="profile"                   element={<SuspenseRoute><ProfilePage /></SuspenseRoute>} />
          {/* checkout: buyer only – vendors/drivers have no checkout flow */}
          <Route path="chat"                      element={<SuspenseRoute><ChatPage /></SuspenseRoute>} />
          <Route path="messages"                  element={<SuspenseRoute><MessagesPage /></SuspenseRoute>} />
          <Route path="bank-account"              element={<SuspenseRoute><BankAccountPage /></SuspenseRoute>} />
          <Route path="activity-log"              element={<SuspenseRoute><ActivityLogPage /></SuspenseRoute>} />
        </Route>

        {/* buyer-only routes inside MainLayout */}
        <Route element={<ProtectedRoute allowedRoles={[USER_ROLES.BUYER]} requiredRole={USER_ROLES.BUYER} />}>
          <Route path="checkout"                  element={<SuspenseRoute><CheckoutPage /></SuspenseRoute>} />
        </Route>

      </Route>

      {/* ── Buyer ────────────────────────────────────────────────────────── */}
      <Route
        path="/buyer"
        element={
          <SuspenseRoute>
            <ProtectedRoute
              Layout={BuyerLayout}
              requiredRole={USER_ROLES.BUYER}
              allowedRoles={[USER_ROLES.BUYER]}
            />
          </SuspenseRoute>
        }
      >
        <Route index                    element={<BuyerIndexRedirect />} />
        <Route path="dashboard"        element={<SuspenseRoute><BuyerDashboard /></SuspenseRoute>} />
        <Route path="orders"           element={<SuspenseRoute><BuyerOrders /></SuspenseRoute>} />
        <Route path="addresses"        element={<SuspenseRoute><BuyerAddresses /></SuspenseRoute>} />
        <Route path="settings"         element={<SuspenseRoute><BuyerSettings /></SuspenseRoute>} />
        <Route path="coupons"          element={<SuspenseRoute><BuyerCoupons /></SuspenseRoute>} />
        <Route path="loyalty"          element={<SuspenseRoute><BuyerLoyalty /></SuspenseRoute>} />
        <Route path="security"         element={<SuspenseRoute><BuyerSecurity /></SuspenseRoute>} />
        <Route path="shopping-lists"   element={<SuspenseRoute><BuyerShoppingLists /></SuspenseRoute>} />
        <Route path="rfq"              element={<SuspenseRoute><BuyerRFQ /></SuspenseRoute>} />
      </Route>

      {/* ── Vendor ───────────────────────────────────────────────────────── */}
      <Route
        path="/vendor"
        element={
          <SuspenseRoute>
            <ProtectedRoute
              Layout={VendorLayout}
              requiredRole={USER_ROLES.VENDOR}
              allowedRoles={[USER_ROLES.VENDOR]}
            />
          </SuspenseRoute>
        }
      >
        <Route index                      element={<Navigate to="/vendor/dashboard" replace />} />
        <Route path="dashboard"           element={<SuspenseRoute><VendorDashboard /></SuspenseRoute>} />
        <Route path="products"            element={<SuspenseRoute><VendorProducts /></SuspenseRoute>} />
        <Route path="orders"              element={<SuspenseRoute><VendorOrders /></SuspenseRoute>} />
        <Route path="delivery-options"    element={<SuspenseRoute><VendorDeliveryOptionSetup /></SuspenseRoute>} />
        <Route path="analytics"           element={<SuspenseRoute><VendorAnalytics /></SuspenseRoute>} />
        <Route path="profile"             element={<SuspenseRoute><VendorProfile /></SuspenseRoute>} />
        <Route path="reviews"             element={<SuspenseRoute><VendorReviews /></SuspenseRoute>} />
        <Route path="settings"            element={<SuspenseRoute><VendorSettings /></SuspenseRoute>} />
        <Route path="coupons"             element={<SuspenseRoute><VendorCoupons /></SuspenseRoute>} />
        <Route path="subscription"        element={<SuspenseRoute><VendorSubscription /></SuspenseRoute>} />
        <Route path="schedules"           element={<SuspenseRoute><VendorSchedules /></SuspenseRoute>} />
        <Route path="security"            element={<SuspenseRoute><VendorSecurity /></SuspenseRoute>} />
        <Route path="location"            element={<SuspenseRoute><VendorLocation /></SuspenseRoute>} />
        <Route path="driver-preferences"  element={<SuspenseRoute><VendorDriverPreferenceSetup /></SuspenseRoute>} />
        <Route path="find-driver"         element={<SuspenseRoute><VendorFindDriver /></SuspenseRoute>} />
        <Route path="digital-contract"    element={<SuspenseRoute><VendorDigitalContract /></SuspenseRoute>} />
        <Route path="rfqs"                element={<SuspenseRoute><VendorRFQs /></SuspenseRoute>} />
      </Route>

      {/* ── Driver ───────────────────────────────────────────────────────── */}
      <Route
        path="/driver"
        element={
          <SuspenseRoute>
            <ProtectedRoute
              Layout={DriverLayout}
              requiredRole={USER_ROLES.DRIVER}
              allowedRoles={[USER_ROLES.DRIVER]}
            />
          </SuspenseRoute>
        }
      >
        <Route index                           element={<Navigate to="/driver/dashboard" replace />} />
        <Route path="dashboard"                element={<SuspenseRoute><DriverDashboard /></SuspenseRoute>} />
        <Route path="active"                   element={<SuspenseRoute><DriverActive /></SuspenseRoute>} />
        <Route path="available"                element={<SuspenseRoute><DriverAvailable /></SuspenseRoute>} />
        <Route path="history"                  element={<SuspenseRoute><DriverHistory /></SuspenseRoute>} />
        <Route path="earnings"                 element={<SuspenseRoute><DriverEarnings /></SuspenseRoute>} />
        <Route path="profile"                  element={<SuspenseRoute><DriverProfile /></SuspenseRoute>} />
        <Route path="settings"                 element={<SuspenseRoute><DriverSettings /></SuspenseRoute>} />
        <Route path="security"                 element={<SuspenseRoute><DriverSecurity /></SuspenseRoute>} />
        <Route path="vendor-preferences"       element={<SuspenseRoute><DriverVendorPreferenceSetup /></SuspenseRoute>} />
        <Route path="find-vendor"              element={<SuspenseRoute><DriverFindVendor /></SuspenseRoute>} />
        <Route path="delivery/:id/pickup"      element={<SuspenseRoute><DriverDeliveryPickup /></SuspenseRoute>} />
        <Route path="delivery/:id/deliver"     element={<SuspenseRoute><DriverDeliveryTracking /></SuspenseRoute>} />
        <Route path="delivery/:id/tracking"    element={<SuspenseRoute><DriverDeliveryTracking /></SuspenseRoute>} />
        <Route path="delivery/:id/complete"    element={<SuspenseRoute><DriverDeliveryComplete /></SuspenseRoute>} />
      </Route>

      {/* ── Admin ────────────────────────────────────────────────────────── */}
      <Route
        path="/admin"
        element={
          <SuspenseRoute>
            <ProtectedRoute
              Layout={AdminLayout}
              requiredRole={USER_ROLES.ADMIN}
              allowedRoles={[USER_ROLES.ADMIN]}
            />
          </SuspenseRoute>
        }
      >
        <Route index                          element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard"               element={<SuspenseRoute><AdminDashboard /></SuspenseRoute>} />
        <Route path="users"                   element={<SuspenseRoute><AdminUsers /></SuspenseRoute>} />
        <Route path="products"                element={<SuspenseRoute><AdminProducts /></SuspenseRoute>} />
        <Route path="orders"                  element={<SuspenseRoute><AdminOrders /></SuspenseRoute>} />
        <Route path="analytics"               element={<SuspenseRoute><AdminAnalytics /></SuspenseRoute>} />
        <Route path="settings"                element={<SuspenseRoute><AdminSettings /></SuspenseRoute>} />
        <Route path="reports"                 element={<SuspenseRoute><AdminReports /></SuspenseRoute>} />
        <Route path="vendors"                 element={<SuspenseRoute><AdminVendors /></SuspenseRoute>} />
        <Route path="drivers"                 element={<SuspenseRoute><AdminDrivers /></SuspenseRoute>} />
        <Route path="moderation"              element={<SuspenseRoute><AdminModeration /></SuspenseRoute>} />
        <Route path="commissions"             element={<SuspenseRoute><AdminCommissions /></SuspenseRoute>} />
        <Route path="payouts"                 element={<SuspenseRoute><AdminPayouts /></SuspenseRoute>} />
        <Route path="reviews"                 element={<SuspenseRoute><AdminReviews /></SuspenseRoute>} />
        <Route path="security"                element={<SuspenseRoute><AdminSecurity /></SuspenseRoute>} />
        <Route path="commission-management"   element={<SuspenseRoute><AdminCommissionManagement /></SuspenseRoute>} />
        <Route path="verification"            element={<SuspenseRoute><AdminVerification /></SuspenseRoute>} />
        <Route path="disputes"                element={<SuspenseRoute><AdminDisputeManagement /></SuspenseRoute>} />
        <Route path="fraud-reports"           element={<SuspenseRoute><AdminFraudReports /></SuspenseRoute>} />
        <Route path="support-tickets"         element={<SuspenseRoute><AdminSupportTickets /></SuspenseRoute>} />
        <Route path="support"                 element={<Navigate to="/admin/support-tickets" replace />} />
      </Route>

      {/* ── Error pages ──────────────────────────────────────────────────── */}
      <Route path="/unauthorized" element={<SuspenseRoute><UnauthorizedPage /></SuspenseRoute>} />
      <Route path="/500"          element={<SuspenseRoute><InternalServerErrorPage /></SuspenseRoute>} />
      <Route path="/503"          element={<SuspenseRoute><ServiceUnavailablePage /></SuspenseRoute>} />
      <Route path="/404"          element={<SuspenseRoute><NotFoundPage /></SuspenseRoute>} />
      <Route path="*"             element={<SuspenseRoute><NotFoundPage /></SuspenseRoute>} />
    </Routes>
  );
}
