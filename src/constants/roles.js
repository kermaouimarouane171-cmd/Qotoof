/**
 * تعريف الأدوار المختلفة في النظام
 * Role-Based Access Control (RBAC)
 */

export const USER_ROLES = {
  ADMIN: 'admin',
  VENDOR: 'vendor',
  BUYER: 'buyer', // Customer/User
  DRIVER: 'driver',
  GUEST: 'guest',
};

/**
 * تعريف الأدوار على أساس الموديول
 * كل أدوار يمكنها الوصول إلى موديولات معينة
 *
 * NOTE: This object is referenced only by the legacy authMiddleware.js.
 * The actual route-level access control is done in ProtectedRoute.jsx
 * using `allowedRoles` / `requiredRole` props — NOT this map.
 * ROLE_PERMISSIONS.guest is intentionally kept for documentation purposes
 * but is NOT used in any runtime auth check.
 */
export const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: {
    modules: ['admin', 'marketplace', 'auth'],
    canAccessAll: true,
  },
  [USER_ROLES.VENDOR]: {
    modules: ['vendor', 'marketplace', 'auth'],
    canAccessAll: false,
  },
  [USER_ROLES.BUYER]: {
    modules: ['marketplace', 'auth'],
    canAccessAll: false,
  },
  [USER_ROLES.DRIVER]: {
    modules: ['driver', 'auth'],
    canAccessAll: false,
  },
  // GUEST: unauthenticated users — access controlled via !user check in ProtectedRoute
  [USER_ROLES.GUEST]: {
    modules: ['auth', 'marketplace'],
    canAccessAll: false,
  },
};

/**
 * تحديد المسارات العامة التي لا تحتاج تحقق من الصلاحيات
 *
 * NOTE: Used only by the legacy src/middleware/authMiddleware.js (isPublicPath).
 * The actual public route definitions live in src/router/AppRouter.jsx as
 * routes outside <ProtectedRoute>. Keep in sync if adding new public routes.
 */
export const PUBLIC_PATHS = [
  '/',
  '/marketplace',
  '/product/:id',
  '/products/:id',
  '/stores',
  '/stores/:id',
  '/cart',
  '/search',
  '/favorites',
  '/orders',
  '/tracking',
  '/about',
  '/contact',
  '/help',
  '/terms',
  '/privacy',
  '/shipping',
  '/returns',
  '/marketplace/seasonal',
  '/become-vendor',
  '/become-driver',
  '/vendor/public/:id',
  '/login',
  '/register',
  '/forgot-password',
  '/verify-email',
  '/verify-phone',
  '/mfa-verify',
  '/auth/callback',
  '/unauthorized',
  '/500',
  '/503',
  '/404',
];

