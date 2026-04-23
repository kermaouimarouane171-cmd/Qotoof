/**
 * Authentication Middleware
 * 
 * يقوم بـ:
 * 1. التحقق من وجود JWT Token (HttpOnly Cookie أو localStorage)
 * 2. التحقق من صحة التوكن
 * 3. التحقق من أن الدور يطابق الأدوار المسموحة
 * 4. رفع أخطاء مناسبة في حالة الفشل
 */

import { USER_ROLES, PUBLIC_PATHS } from '@/constants/roles';
import { getAuthToken } from '@/services/axiosInstance';

/**
 * فئة مخصصة لأخطاء الوثوق (Authentication/Authorization)
 */
export class AuthenticationError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
  }
}

/**
 * التحقق من وجود التوكن والدور
 * 
 * @param {string} token - الـ JWT Token
 * @param {string} expectedRole - الدور المتوقع
 * @returns {object} - بيانات المستخدم المفك من التوكن
 * @throws {AuthenticationError} - في حالة الفشل
 */
export const validateToken = (token, expectedRole) => {
  // === التحقق من وجود التوكن ===
  if (!token) {
    throw new AuthenticationError('Token not found', 401);
  }

  try {
    // تفكيك التوكن (بدون التحقق من التوقيع - هذا يتم على الـ Server)
    // في بيئة الـ Production، يجب التحقق من التوقيع على الـ Server
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // فك تشفير ال payload
    const payload = JSON.parse(atob(parts[1]));

    // === التحقق من انتهاء صلاحية التوكن ===
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new AuthenticationError('Token expired', 401);
    }

    // === التحقق من أن الدور يطابق المتوقع ===
    // Supabase tokens store the app role in user_metadata.role, not payload.role
    const userRole = payload.user_metadata?.role || payload.role;
    if (expectedRole && userRole !== expectedRole) {
      throw new AuthenticationError(
        `Access denied. Required role: ${expectedRole}, but got: ${userRole}`,
        403
      );
    }

    // Include the effective role in the returned payload
    return { ...payload, role: userRole };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Invalid or malformed token', 401);
  }
};

/**
 * التحقق من الصلاحيات بناءً على الدور والمسار
 * 
 * @param {string} userRole - دور المستخدم
 * @param {string} requiredRole - الدور المطلوب
 * @returns {boolean} - هل المستخدم مصرح بالوصول
 */
export const checkRoleAuthorization = (userRole, requiredRole) => {
  // إذا لم يكن هناك دور مطلوب، يمكن لأي مستخدم الوصول
  if (!requiredRole) {
    return true;
  }

  // تحقق من تطابق الأدوار
  return userRole === requiredRole;
};

/**
 * التحقق من أن المسار عام (لا يحتاج وثوق)
 * 
 * @param {string} path - المسار المراد التحقق منه
 * @returns {boolean} - هل المسار عام
 */
export const isPublicPath = (path) => {
  return PUBLIC_PATHS.some((publicPath) => {
    // دعم Regex patterns في المسارات العامة
    if (publicPath instanceof RegExp) {
      return publicPath.test(path);
    }
    return path.startsWith(publicPath);
  });
};

/**
 * الحصول على بيانات المستخدم الحالي من التوكن
 * 
 * @returns {object|null} - بيانات المستخدم أو null
 */
export const getCurrentUser = () => {
  try {
    const token = getAuthToken();
    if (!token) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));

    // تحقق من أن التوكن لم ينتهي
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return {
      id: payload.id || payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      avatar: payload.avatar,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (error) {
    return null;
  }
};

/**
 * Middleware للتحقق من الوثوق والصلاحيات
 * 
 * @param {object} options - الخيارات
 * @returns {Function} - دالة middleware
 */
export const createAuthMiddleware = (options = {}) => {
  return (pathname) => {
    const { requiredRole = null, redirectTo = '/login' } = options;

    // إذا كان المسار عام، لا تحتاج للتحقق
    if (isPublicPath(pathname)) {
      return { authorized: true };
    }

    // الحصول على التوكن الحالي
    const token = getAuthToken();

    // === التحقق من وجود التوكن ===
    if (!token) {
      return {
        authorized: false,
        error: 'No authentication token found',
        redirectTo,
      };
    }

    try {
      // === التحقق من صحة التوكن ===
      const userData = validateToken(token, requiredRole);

      // === التحقق من الصلاحيات ===
      if (requiredRole && !checkRoleAuthorization(userData.role, requiredRole)) {
        return {
          authorized: false,
          error: `Access denied. Required role: ${requiredRole}`,
          redirectTo: '/unauthorized',
        };
      }

      return {
        authorized: true,
        user: userData,
      };
    } catch (error) {
      return {
        authorized: false,
        error: error.message,
        redirectTo: error.statusCode === 403 ? '/unauthorized' : redirectTo,
      };
    }
  };
};

/**
 * Hook للاستخدام في المكونات - للتحقق من الوثوق والصلاحيات
 * استخدام:
 * ```jsx
 * const { authorized, user, error } = useAuthMiddleware({ requiredRole: USER_ROLES.ADMIN });
 * ```
 */
export const useAuthMiddleware = (options = {}) => {
  const middleware = createAuthMiddleware(options);
  const pathname = window.location.pathname;
  return middleware(pathname);
};

export default createAuthMiddleware;
