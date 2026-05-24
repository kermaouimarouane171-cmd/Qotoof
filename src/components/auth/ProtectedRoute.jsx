import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const LoadingFallback = () => <LoadingSpinner />;

/**
 * مكون الحماية بناءً على الدور
 * @param {React.ReactNode} children - العناصر التي سيتم عرضها إذا كانت الحماية تسمح
 * @param {string} requiredRole - الدور المطلوب للوصول
 * @param {string[]} allowedRoles - الأدوار المسموح لها بالوصول (اختياري)
 * @param {boolean} redirectToDefault - إعادة التوجيه إلى المسار الافتراضي إذا لم يكن لدى المستخدم إذن
 */
export const ProtectedRoute = ({ children, requiredRole, allowedRoles, redirectToDefault = true }) => {
  const { user, profile, loading } = useAuthStore();
  const location = useLocation();
  const [profileLoadTimedOut, setProfileLoadTimedOut] = useState(false);

  useEffect(() => {
    setProfileLoadTimedOut(false);

    // Start timeout while authenticated user exists but profile is still missing.
    if (!user || profile) return;

    const timeoutId = window.setTimeout(() => {
      setProfileLoadTimedOut(true);
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [user, profile, loading]);

  // If profile fails to load in a safe time window, force re-auth with context.
  if (user && !profile && profileLoadTimedOut) {
    return (
      <Navigate
        to="/login"
        state={{ from: location, error: 'Session verification timed out. Please sign in again.' }}
        replace
      />
    );
  }

  // Required wait states: loading or user exists while profile is still unresolved.
  if (loading || (user && !profile)) {
    return <LoadingFallback />;
  }

  // Not authenticated.
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = profile.role;
  const hasRequiredRole = requiredRole ? userRole === requiredRole : true;
  const hasAllowedRole = Array.isArray(allowedRoles) && allowedRoles.length > 0
    ? allowedRoles.includes(userRole)
    : true;

  const hasPermission = hasRequiredRole && hasAllowedRole;

  if (!hasPermission) {
    const unauthorizedPath = redirectToDefault ? '/unauthorized' : '/unauthorized';
    return <Navigate to={unauthorizedPath} state={{ from: location }} replace />;
  }

  // إذا كان لديه إذن، عرض المحتوى
  return children;
};

/**
 * مكون للتحقق من المصادقة فقط (بدون التحقق من الدور)
 * @param {React.ReactNode} children - العناصر التي سيتم عرضها إذا كانت الحماية تسمح
 */
export const AuthenticatedRoute = ({ children }) => {
  const { user, profile, loading } = useAuthStore();
  const location = useLocation();

  if (loading || (user && !profile)) {
    return <LoadingFallback />;
  }

  if (!user || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * مكون للتحقق من عدم تسجيل الدخول (لصفحات مثل تسجيل الدخول)
 * @param {React.ReactNode} children - العناصر التي سيتم عرضها إذا كانت الحماية تسمح
 */
export const UnauthenticatedRoute = ({ children }) => {
  const { user, profile, loading } = useAuthStore();

  if (loading || (user && !profile)) {
    return <LoadingFallback />;
  }

  if (profile) {
    // إذا كان مسجلاً، أعد توجيهه إلى لوحة التحكم الافتراضية
    const redirectPath = useAuthStore.getState().getRedirectPath(profile.role);
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};