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
  [USER_ROLES.GUEST]: {
    modules: ['auth'],
    canAccessAll: false,
  },
};

/**
 * تحديد المسارات العامة التي لا تحتاج تحقق من الصلاحيات
 */
export const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/verify-email',
  '/unauthorized',
  '/404',
];

/**
 * تحديد المسارات المحمية لكل دور
 */
export const PROTECTED_ROUTES_BY_ROLE = {
  [USER_ROLES.ADMIN]: /^\/admin/,
  [USER_ROLES.VENDOR]: /^\/vendor/,
  [USER_ROLES.BUYER]: /^\/marketplace/,
  [USER_ROLES.DRIVER]: /^\/driver/,
};
