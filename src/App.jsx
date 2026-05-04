/**
 * App.jsx - نقطة الدخول الرئيسية للتطبيق
 * 
 * هذا الملف يحتوي على:
 * 1. تعريف جميع المسارات (Routes) بناءً على Feature-based Architecture
 * 2. تطبيق نظام حماية المسارات (ProtectedRoute) مع RBAC
 * 3. تجميع جميع الـ Layouts والـ Pages
 * 4. تطبيق Error Boundary عام
 * 5. إعداد React Query (TanStack Query) للبيانات من السيرفر
 */

import { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

// === Imports ===
import ErrorBoundary from '@/components/ErrorBoundary';
import { ProtectedRoute, MainLayout, AdminLayout, VendorLayout, DriverLayout } from '@/components/ProtectedRoute';
import queryClient from '@/services/queryClient';
import { USER_ROLES } from '@/constants/roles';
import {
  checkOnboardingNeeded,
  getOnboardingPathForRole,
  getPostOnboardingPath,
} from '@/services/onboardingService';
import {
  clearPendingPhoneVerification,
  getPendingPhoneVerification,
  PHONE_VERIFICATION_EVENT,
} from '@/services/phoneOtpService';
import { useAuthStore } from '@/store/authStore';

// === Loading Fallback Component ===
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
 * === LAZY LOADED PAGES ===
 * 
 * Route-level code splitting لتحسين الأداء:
 * - تحميل فقط الكود المطلوب للمستخدم الحالي
 * - تقليل حجم Bundle الأساسي
 */

// Auth Pages
const LoginPage = lazy(() => import('@/pages/auth/Login'));
const RegisterPage = lazy(() => import('@/pages/auth/Register'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPassword'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmail'));
const PhoneVerificationPage = lazy(() => import('@/components/auth/PhoneVerification'));

// Onboarding Pages
const BuyerOnboardingPage = lazy(() => import('@/pages/onboarding/BuyerOnboarding'));
const VendorOnboardingPage = lazy(() => import('@/pages/onboarding/VendorOnboarding'));
const DriverOnboardingPage = lazy(() => import('@/pages/onboarding/DriverOnboarding'));

// Marketplace Pages
const HomePage = lazy(() => import('@/pages/Home'));
const MarketplacePage = lazy(() => import('@/pages/Marketplace'));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetail'));
const StoresPage = lazy(() => import('@/pages/Stores'));
const StoreDetailPage = lazy(() => import('@/pages/StoreDetail'));
const OrdersPage = lazy(() => import('@/pages/Orders'));
const OrderDetailPage = lazy(() => import('@/pages/OrderDetail'));
const CartPage = lazy(() => import('@/pages/Cart'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutSimplified'));

// Marketplace extras
const FavoritesPage = lazy(() => import('@/pages/Favorites'));
const NotificationsPage = lazy(() => import('@/pages/Notifications'));
const ProfilePage = lazy(() => import('@/pages/Profile'));
const OrderConfirmationPage = lazy(() => import('@/pages/OrderConfirmation'));
const OrderTrackingPage = lazy(() => import('@/pages/OrderTracking'));
const ProductConditionPage = lazy(() => import('@/pages/orders/ProductCondition'));

// Vendor Pages
const VendorDashboard = lazy(() => import('@/pages/vendor/Dashboard'));
const VendorProducts = lazy(() => import('@/pages/vendor/Products'));
const VendorOrders = lazy(() => import('@/pages/vendor/Orders'));
const VendorAnalytics = lazy(() => import('@/pages/vendor/Analytics'));
const VendorProfile = lazy(() => import('@/pages/vendor/Profile'));

// Admin Pages
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/Users'));
const AdminProducts = lazy(() => import('@/pages/admin/Products'));
const AdminOrders = lazy(() => import('@/pages/admin/Orders'));
const AdminAnalytics = lazy(() => import('@/pages/admin/Analytics'));
const AdminSettings = lazy(() => import('@/pages/admin/Settings'));
const AdminReports = lazy(() => import('@/pages/admin/Reports'));

// Driver Pages
const DriverDashboard = lazy(() => import('@/pages/driver/Dashboard'));
const DriverActive = lazy(() => import('@/pages/driver/Active'));
const DriverHistory = lazy(() => import('@/pages/driver/History'));
const DriverEarnings = lazy(() => import('@/pages/driver/Earnings'));
const DriverProfile = lazy(() => import('@/pages/driver/Profile'));

// Public Pages
const AboutPage = lazy(() => import('@/pages/About'));
const ContactPage = lazy(() => import('@/pages/Contact'));
const HelpCenterPage = lazy(() => import('@/pages/HelpCenter'));
const TermsPage = lazy(() => import('@/pages/Terms'));
const PrivacyPage = lazy(() => import('@/pages/Privacy'));
const BecomeVendorPage = lazy(() => import('@/pages/BecomeVendor'));
const MessagesPage = lazy(() => import('@/pages/Messages'));
const ReturnsPage = lazy(() => import('@/pages/Returns'));
const ShippingPage = lazy(() => import('@/pages/Shipping'));
const TrackingPage = lazy(() => import('@/pages/Tracking'));
const BankAccountPage = lazy(() => import('@/pages/BankAccount'));
const ChatPage = lazy(() => import('@/pages/Chat'));
const SearchResultsPage = lazy(() => import('@/pages/SearchResults'));
const ActivityLogPage = lazy(() => import('@/pages/ActivityLog'));
const SeasonalPage = lazy(() => import('@/pages/Seasonal'));

// Auth Callback
const AuthCallbackPage = lazy(() => import('@/pages/auth/AuthCallback'));

// Buyer Pages
const BuyerDashboard = lazy(() => import('@/pages/buyer/Dashboard'));
const BuyerOrders = lazy(() => import('@/pages/buyer/Orders'));
const BuyerAddresses = lazy(() => import('@/pages/buyer/Addresses'));
const BuyerSettings = lazy(() => import('@/pages/buyer/Settings'));
const BuyerCoupons = lazy(() => import('@/pages/buyer/Coupons'));
const BuyerLoyalty = lazy(() => import('@/pages/buyer/Loyalty'));
const BuyerSecurity = lazy(() => import('@/pages/buyer/Security'));
const BuyerShoppingLists = lazy(() => import('@/pages/buyer/ShoppingLists'));
const BuyerRFQ = lazy(() => import('@/pages/buyer/RFQ'));

// Vendor Extra Pages
const VendorReviews = lazy(() => import('@/pages/vendor/Reviews'));
const VendorSettings = lazy(() => import('@/pages/vendor/Settings'));
const VendorCoupons = lazy(() => import('@/pages/vendor/Coupons'));
const VendorSchedules = lazy(() => import('@/pages/vendor/Schedules'));
const VendorSecurity = lazy(() => import('@/pages/vendor/Security'));
const VendorLocation = lazy(() => import('@/pages/vendor/LocationSetup'));
const VendorDigitalContract = lazy(() => import('@/pages/vendor/DigitalContract'));
const VendorPublicProfile = lazy(() => import('@/pages/vendor/VendorProfile'));
const VendorDriverPreferenceSetup = lazy(() => import('@/pages/vendor/DriverPreferenceSetup'));
const VendorFindDriver = lazy(() => import('@/pages/vendor/FindDriver'));
const VendorDeliveryOptionSetup = lazy(() => import('@/pages/vendor/DeliveryOptionSetup'));
const VendorSubscription = lazy(() => import('@/pages/vendor/Subscription'));
const VendorRFQs = lazy(() => import('@/pages/vendor/RFQs'));

// Admin Extra Pages
const AdminVendors = lazy(() => import('@/pages/admin/Vendors'));
const AdminDrivers = lazy(() => import('@/pages/admin/Drivers'));
const AdminModeration = lazy(() => import('@/pages/admin/Moderation'));
const AdminCommissions = lazy(() => import('@/pages/admin/Commissions'));
const AdminPayouts = lazy(() => import('@/pages/admin/Payouts'));
const AdminReviews = lazy(() => import('@/pages/admin/Reviews'));
const AdminSecurity = lazy(() => import('@/pages/admin/Security'));
const AdminCommissionManagement = lazy(() => import('@/pages/admin/CommissionManagement'));
const AdminVerification = lazy(() => import('@/pages/admin/Verification'));
const AdminDisputeManagement = lazy(() => import('@/pages/admin/DisputeManagement'));
const AdminFraudReports = lazy(() => import('@/pages/admin/FraudReports'));
const AdminSupportTickets = lazy(() => import('@/pages/admin/SupportTickets'));

// Driver Extra Pages
const DriverAvailable = lazy(() => import('@/pages/driver/Available'));
const DriverSettings = lazy(() => import('@/pages/driver/Settings'));
const DriverSecurity = lazy(() => import('@/pages/driver/Security'));
const DriverVendorPreferenceSetup = lazy(() => import('@/pages/driver/VendorPreferenceSetup'));
const DriverFindVendor = lazy(() => import('@/pages/driver/FindVendor'));
const DriverDeliveryTracking = lazy(() => import('@/pages/driver/DeliveryTracking'));
const DriverDeliveryPickup = lazy(() => import('@/pages/driver/DeliveryPickup'));
const DriverDeliveryComplete = lazy(() => import('@/pages/driver/DeliveryComplete'));

// Error Pages
const NotFoundPage = lazy(() => import('@/components/NotFound'));
const UnauthorizedPage = lazy(() => import('@/components/Unauthorized'));
const InternalServerErrorPage = lazy(() => import('@/pages/errors/InternalServerError'));
const ServiceUnavailablePage = lazy(() => import('@/pages/errors/ServiceUnavailable'));

// === SuspenseRoute Wrapper ===
const SuspenseRoute = ({ children }) => (
  <Suspense fallback={<LoadingFallback />}>
    {children}
  </Suspense>
);

/**
 * === APP COMPONENT ===
 * 
 * البناء الهرمي للمسارات:
 * 1. مسارات عامة (Authentication)
 * 2. مسارات مشتركة (Marketplace)
 * 3. مسارات محمية حسب الدور (Admin, Vendor, Driver, Buyer)
 */
function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading } = useAuthStore();
  const [onboardingResolved, setOnboardingResolved] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [pendingPhoneVerification, setPendingPhoneVerification] = useState(() => getPendingPhoneVerification());

  useEffect(() => {
    let cleanup;
    const { initialize, setupAuthListener } = useAuthStore.getState();
    // Initialize first, then set up auth listener after initial session is checked
    initialize().then(() => {
      cleanup = setupAuthListener();
    });
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, []);

  useEffect(() => {
    const syncPhoneVerification = () => {
      setPendingPhoneVerification(getPendingPhoneVerification());
    };

    window.addEventListener(PHONE_VERIFICATION_EVENT, syncPhoneVerification);

    return () => {
      window.removeEventListener(PHONE_VERIFICATION_EVENT, syncPhoneVerification);
    };
  }, []);

  useEffect(() => {
    if (
      user?.id &&
      pendingPhoneVerification?.userId === user.id &&
      profile?.phone_verified
    ) {
      clearPendingPhoneVerification();
    }
  }, [pendingPhoneVerification?.userId, profile?.phone_verified, user?.id]);

  const requiresPhoneVerification = Boolean(
    user?.id &&
    pendingPhoneVerification?.userId === user.id &&
    profile?.phone_verified !== true
  );

  useEffect(() => {
    if (!requiresPhoneVerification) {
      return;
    }

    if (location.pathname !== '/verify-phone') {
      navigate('/verify-phone', { replace: true });
    }
  }, [location.pathname, navigate, requiresPhoneVerification]);

  useEffect(() => {
    const role = profile?.role;
    const supportsOnboarding = [
      USER_ROLES.BUYER,
      USER_ROLES.VENDOR,
      USER_ROLES.DRIVER,
    ].includes(role);

    if (loading) {
      setOnboardingResolved(false);
      return;
    }

    if (!user?.id || !supportsOnboarding) {
      setNeedsOnboarding(false);
      setOnboardingResolved(true);
      return;
    }

    let cancelled = false;

    setOnboardingResolved(false);

    checkOnboardingNeeded(user.id, role)
      .then((required) => {
        if (cancelled) return;

        setNeedsOnboarding(required);
      })
      .catch(() => {
        if (cancelled) return;

        setNeedsOnboarding(Boolean(profile && !profile.onboarding_completed));
      })
      .finally(() => {
        if (!cancelled) {
          setOnboardingResolved(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loading, profile?.onboarding_completed, profile?.role, user?.id]);

  useEffect(() => {
    const role = profile?.role;
    const supportsOnboarding = [
      USER_ROLES.BUYER,
      USER_ROLES.VENDOR,
      USER_ROLES.DRIVER,
    ].includes(role);

    if (!user?.id || !supportsOnboarding || !onboardingResolved) {
      return;
    }

    const isOnboardingPath = location.pathname.startsWith('/onboarding');

    if (needsOnboarding) {
      const targetPath = getOnboardingPathForRole(role);

      if (targetPath && location.pathname !== targetPath) {
        navigate(targetPath, { replace: true });
      }

      return;
    }

    if (!needsOnboarding && isOnboardingPath) {
      navigate(getPostOnboardingPath(role), { replace: true });
    }
  }, [location.pathname, navigate, needsOnboarding, onboardingResolved, profile?.role, user?.id]);

  const shouldBlockForOnboarding = Boolean(
    user?.id &&
    [USER_ROLES.BUYER, USER_ROLES.VENDOR, USER_ROLES.DRIVER].includes(profile?.role) &&
    (
      !onboardingResolved ||
      (needsOnboarding && !location.pathname.startsWith('/onboarding')) ||
      (!needsOnboarding && location.pathname.startsWith('/onboarding'))
    )
  );

  const shouldBlockForPhoneVerification = requiresPhoneVerification && location.pathname !== '/verify-phone';

  return (
    // === Error Boundary عام لالتقاط أخطاء المكونات ===
    <ErrorBoundary>
      {/* === TanStack Query Provider === */}
      <QueryClientProvider client={queryClient}>
        {shouldBlockForPhoneVerification || shouldBlockForOnboarding ? <LoadingFallback /> : (
        <Routes>
          {/* ============================================ */}
          {/* مسارات المصادقة (Authentication Routes) */}
          {/* ============================================ */}
          <Route path="/login" element={<SuspenseRoute><LoginPage /></SuspenseRoute>} />
          <Route path="/register" element={<SuspenseRoute><RegisterPage /></SuspenseRoute>} />
          <Route path="/forgot-password" element={<SuspenseRoute><ForgotPasswordPage /></SuspenseRoute>} />
          <Route path="/reset-password" element={<SuspenseRoute><ResetPasswordPage /></SuspenseRoute>} />
          <Route path="/verify-email" element={<SuspenseRoute><VerifyEmailPage /></SuspenseRoute>} />
          <Route path="/verify-phone" element={<SuspenseRoute><PhoneVerificationPage /></SuspenseRoute>} />
          <Route path="/auth/callback" element={<SuspenseRoute><AuthCallbackPage /></SuspenseRoute>} />

          {/* ============================================ */}
          {/* مسارات الـ Onboarding */}
          {/* ============================================ */}
          <Route path="/onboarding/buyer" element={<SuspenseRoute><BuyerOnboardingPage /></SuspenseRoute>} />
          <Route path="/onboarding/vendor" element={<SuspenseRoute><VendorOnboardingPage /></SuspenseRoute>} />
          <Route path="/onboarding/driver" element={<SuspenseRoute><DriverOnboardingPage /></SuspenseRoute>} />

          {/* ============================================ */}
          {/* مسارات Marketplace العامة */}
          {/* ============================================ */}
          <Route path="/" element={<MainLayout />}>
            <Route index element={<SuspenseRoute><HomePage /></SuspenseRoute>} />
            <Route path="marketplace" element={<SuspenseRoute><MarketplacePage /></SuspenseRoute>} />
            <Route path="product/:id" element={<SuspenseRoute><ProductDetailPage /></SuspenseRoute>} />
            <Route path="stores" element={<SuspenseRoute><StoresPage /></SuspenseRoute>} />
            <Route path="stores/:id" element={<SuspenseRoute><StoreDetailPage /></SuspenseRoute>} />
            <Route path="cart" element={<SuspenseRoute><CartPage /></SuspenseRoute>} />
            <Route path="search" element={<SuspenseRoute><SearchResultsPage /></SuspenseRoute>} />
            <Route path="orders" element={<SuspenseRoute><OrdersPage /></SuspenseRoute>} />
            <Route path="orders/:id" element={<SuspenseRoute><OrderDetailPage /></SuspenseRoute>} />
            <Route path="orders/:id/condition" element={<SuspenseRoute><ProductConditionPage /></SuspenseRoute>} />
            <Route path="order-confirmation" element={<SuspenseRoute><OrderConfirmationPage /></SuspenseRoute>} />
            <Route path="order-confirmation/:id" element={<SuspenseRoute><OrderConfirmationPage /></SuspenseRoute>} />
            <Route path="tracking/:id" element={<SuspenseRoute><OrderTrackingPage /></SuspenseRoute>} />
            <Route path="favorites" element={<SuspenseRoute><FavoritesPage /></SuspenseRoute>} />
            <Route path="notifications" element={<SuspenseRoute><NotificationsPage /></SuspenseRoute>} />
            <Route path="profile" element={<SuspenseRoute><ProfilePage /></SuspenseRoute>} />
            <Route path="checkout" element={<SuspenseRoute><CheckoutPage /></SuspenseRoute>} />
            <Route path="chat" element={<SuspenseRoute><ChatPage /></SuspenseRoute>} />
            <Route path="messages" element={<SuspenseRoute><MessagesPage /></SuspenseRoute>} />
            <Route path="bank-account" element={<SuspenseRoute><BankAccountPage /></SuspenseRoute>} />
            {/* Static / Info Pages */}
            <Route path="about" element={<SuspenseRoute><AboutPage /></SuspenseRoute>} />
            <Route path="contact" element={<SuspenseRoute><ContactPage /></SuspenseRoute>} />
            <Route path="help" element={<SuspenseRoute><HelpCenterPage /></SuspenseRoute>} />
            <Route path="terms" element={<SuspenseRoute><TermsPage /></SuspenseRoute>} />
            <Route path="privacy" element={<SuspenseRoute><PrivacyPage /></SuspenseRoute>} />
            <Route path="become-vendor" element={<SuspenseRoute><BecomeVendorPage /></SuspenseRoute>} />
            <Route path="returns" element={<SuspenseRoute><ReturnsPage /></SuspenseRoute>} />
            <Route path="shipping" element={<SuspenseRoute><ShippingPage /></SuspenseRoute>} />
            <Route path="tracking" element={<SuspenseRoute><TrackingPage /></SuspenseRoute>} />
            <Route path="activity-log" element={<SuspenseRoute><ActivityLogPage /></SuspenseRoute>} />
            <Route path="marketplace/seasonal" element={<SuspenseRoute><SeasonalPage /></SuspenseRoute>} />
            <Route path="vendor/public/:id" element={<SuspenseRoute><VendorPublicProfile /></SuspenseRoute>} />
            {/* Buyer Dashboard */}
            <Route element={<ProtectedRoute allowedRoles={[USER_ROLES.BUYER]} />}>
              <Route path="buyer/dashboard" element={<SuspenseRoute><BuyerDashboard /></SuspenseRoute>} />
              <Route path="buyer/orders" element={<SuspenseRoute><BuyerOrders /></SuspenseRoute>} />
              <Route path="buyer/addresses" element={<SuspenseRoute><BuyerAddresses /></SuspenseRoute>} />
              <Route path="buyer/settings" element={<SuspenseRoute><BuyerSettings /></SuspenseRoute>} />
              <Route path="buyer/coupons" element={<SuspenseRoute><BuyerCoupons /></SuspenseRoute>} />
              <Route path="buyer/loyalty" element={<SuspenseRoute><BuyerLoyalty /></SuspenseRoute>} />
              <Route path="buyer/security" element={<SuspenseRoute><BuyerSecurity /></SuspenseRoute>} />
              <Route path="buyer/shopping-lists" element={<SuspenseRoute><BuyerShoppingLists /></SuspenseRoute>} />
              <Route path="buyer/rfq" element={<SuspenseRoute><BuyerRFQ /></SuspenseRoute>} />
            </Route>
          </Route>

          {/* ============================================ */}
          {/* مسارات البائع (Vendor Routes) */}
          {/* ============================================ */}
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
            <Route index element={<Navigate to="/vendor/dashboard" replace />} />
            <Route path="dashboard" element={<SuspenseRoute><VendorDashboard /></SuspenseRoute>} />
            <Route path="products" element={<SuspenseRoute><VendorProducts /></SuspenseRoute>} />
            <Route path="orders" element={<SuspenseRoute><VendorOrders /></SuspenseRoute>} />
            <Route path="delivery-options" element={<SuspenseRoute><VendorDeliveryOptionSetup /></SuspenseRoute>} />
            <Route path="analytics" element={<SuspenseRoute><VendorAnalytics /></SuspenseRoute>} />
            <Route path="profile" element={<SuspenseRoute><VendorProfile /></SuspenseRoute>} />
            <Route path="reviews" element={<SuspenseRoute><VendorReviews /></SuspenseRoute>} />
            <Route path="settings" element={<SuspenseRoute><VendorSettings /></SuspenseRoute>} />
            <Route path="coupons" element={<SuspenseRoute><VendorCoupons /></SuspenseRoute>} />
            <Route path="subscription" element={<SuspenseRoute><VendorSubscription /></SuspenseRoute>} />
            <Route path="schedules" element={<SuspenseRoute><VendorSchedules /></SuspenseRoute>} />
            <Route path="security" element={<SuspenseRoute><VendorSecurity /></SuspenseRoute>} />
            <Route path="location" element={<SuspenseRoute><VendorLocation /></SuspenseRoute>} />
            <Route path="driver-preferences" element={<SuspenseRoute><VendorDriverPreferenceSetup /></SuspenseRoute>} />
            <Route path="find-driver" element={<SuspenseRoute><VendorFindDriver /></SuspenseRoute>} />
            <Route path="digital-contract" element={<SuspenseRoute><VendorDigitalContract /></SuspenseRoute>} />
            <Route path="rfqs" element={<SuspenseRoute><VendorRFQs /></SuspenseRoute>} />
          </Route>

          {/* ============================================ */}
          {/* مسارات السائق (Driver Routes) */}
          {/* ============================================ */}
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
            <Route index element={<Navigate to="/driver/dashboard" replace />} />
            <Route path="dashboard" element={<SuspenseRoute><DriverDashboard /></SuspenseRoute>} />
            <Route path="active" element={<SuspenseRoute><DriverActive /></SuspenseRoute>} />
            <Route path="available" element={<SuspenseRoute><DriverAvailable /></SuspenseRoute>} />
            <Route path="history" element={<SuspenseRoute><DriverHistory /></SuspenseRoute>} />
            <Route path="earnings" element={<SuspenseRoute><DriverEarnings /></SuspenseRoute>} />
            <Route path="profile" element={<SuspenseRoute><DriverProfile /></SuspenseRoute>} />
            <Route path="settings" element={<SuspenseRoute><DriverSettings /></SuspenseRoute>} />
            <Route path="security" element={<SuspenseRoute><DriverSecurity /></SuspenseRoute>} />
            <Route path="vendor-preferences" element={<SuspenseRoute><DriverVendorPreferenceSetup /></SuspenseRoute>} />
            <Route path="find-vendor" element={<SuspenseRoute><DriverFindVendor /></SuspenseRoute>} />
            <Route path="delivery/:id/pickup" element={<SuspenseRoute><DriverDeliveryPickup /></SuspenseRoute>} />
            <Route path="delivery/:id/deliver" element={<SuspenseRoute><DriverDeliveryTracking /></SuspenseRoute>} />
            <Route path="delivery/:id/tracking" element={<SuspenseRoute><DriverDeliveryTracking /></SuspenseRoute>} />
            <Route path="delivery/:id/complete" element={<SuspenseRoute><DriverDeliveryComplete /></SuspenseRoute>} />
          </Route>

          {/* ============================================ */}
          {/* مسارات المدير (Admin Routes) */}
          {/* ============================================ */}
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
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<SuspenseRoute><AdminDashboard /></SuspenseRoute>} />
            <Route path="users" element={<SuspenseRoute><AdminUsers /></SuspenseRoute>} />
            <Route path="products" element={<SuspenseRoute><AdminProducts /></SuspenseRoute>} />
            <Route path="orders" element={<SuspenseRoute><AdminOrders /></SuspenseRoute>} />
            <Route path="analytics" element={<SuspenseRoute><AdminAnalytics /></SuspenseRoute>} />
            <Route path="settings" element={<SuspenseRoute><AdminSettings /></SuspenseRoute>} />
            <Route path="reports" element={<SuspenseRoute><AdminReports /></SuspenseRoute>} />
            <Route path="vendors" element={<SuspenseRoute><AdminVendors /></SuspenseRoute>} />
            <Route path="drivers" element={<SuspenseRoute><AdminDrivers /></SuspenseRoute>} />
            <Route path="moderation" element={<SuspenseRoute><AdminModeration /></SuspenseRoute>} />
            <Route path="commissions" element={<SuspenseRoute><AdminCommissions /></SuspenseRoute>} />
            <Route path="payouts" element={<SuspenseRoute><AdminPayouts /></SuspenseRoute>} />
            <Route path="reviews" element={<SuspenseRoute><AdminReviews /></SuspenseRoute>} />
            <Route path="security" element={<SuspenseRoute><AdminSecurity /></SuspenseRoute>} />
            <Route path="commission-management" element={<SuspenseRoute><AdminCommissionManagement /></SuspenseRoute>} />
            <Route path="verification" element={<SuspenseRoute><AdminVerification /></SuspenseRoute>} />
            <Route path="disputes" element={<SuspenseRoute><AdminDisputeManagement /></SuspenseRoute>} />
            <Route path="fraud-reports" element={<SuspenseRoute><AdminFraudReports /></SuspenseRoute>} />
            <Route path="support-tickets" element={<SuspenseRoute><AdminSupportTickets /></SuspenseRoute>} />
            <Route path="support" element={<Navigate to="/admin/support-tickets" replace />} />
          </Route>

          {/* ============================================ */}
          {/* صفحات الأخطاء */}
          {/* ============================================ */}

          <Route path="/unauthorized" element={<SuspenseRoute><UnauthorizedPage /></SuspenseRoute>} />
          <Route path="/500" element={<SuspenseRoute><InternalServerErrorPage /></SuspenseRoute>} />
          <Route path="/503" element={<SuspenseRoute><ServiceUnavailablePage /></SuspenseRoute>} />
          <Route path="/404" element={<SuspenseRoute><NotFoundPage /></SuspenseRoute>} />
          <Route path="*" element={<SuspenseRoute><NotFoundPage /></SuspenseRoute>} />
        </Routes>
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
