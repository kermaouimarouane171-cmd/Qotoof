import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

/**
 * مكون الحماية بناءً على الدور
 * @param {React.ReactNode} children - العناصر التي سيتم عرضها إذا كانت الحماية تسمح
 * @param {string} requiredRole - الدور المطلوب للوصول
 * @param {string[]} allowedRoles - الأدوار المسموح لها بالوصول (اختياري)
 * @param {boolean} redirectToDefault - إعادة التوجيه إلى المسار الافتراضي إذا لم يكن لدى المستخدم إذن
 */
export const ProtectedRoute = ({ children, requiredRole, allowedRoles, redirectToDefault = true }) => {
  const { profile, loading } = useAuthStore();
  const location = useLocation();
  const [hasPermission, setHasPermission] = useState(null);

  useEffect(() => {
    // التحقق من التحميل
    if (loading) {
      setHasPermission(null);
      return;
    }

    // التحقق من تسجيل الدخول
    if (!profile) {
      setHasPermission(false);
      return;
    }

    // التحقق من الدور
    if (requiredRole) {
      // إذا كان المستخدم لا يملك الدور المطلوب
      if (profile.role !== requiredRole) {
        setHasPermission(false);
        return;
      }
    }

    // التحقق من الأدوار المسموح بها
    if (allowedRoles) {
      if (!allowedRoles.includes(profile.role)) {
        setHasPermission(false);
        return;
      }
    }

    // إذا اجتاز جميع الشروط
    setHasPermission(true);
  }, [profile, loading, requiredRole, allowedRoles]);

  // أثناء التحقق
  if (hasPermission === null) {
    return <LoadingSpinner />;
  }

  // إذا لم يكن مسجلاً أو ليس لديه إذن
  if (!hasPermission) {
    if (redirectToDefault) {
      // إعادة التوجيه إلى المسار الافتراضي بناءً على الدور
      const redirectPath = useAuthStore.getState().getRedirectPath(profile?.role || null);
      return <Navigate to={redirectPath} state={{ from: location }} replace />;
    } else {
      // إعادة التوجيه إلى صفحة تسجيل الدخول
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
  }

  // إذا كان لديه إذن، عرض المحتوى
  return children;
};

/**
 * مكون للتحقق من المصادقة فقط (بدون التحقق من الدور)
 * @param {React.ReactNode} children - العناصر التي سيتم عرضها إذا كانت الحماية تسمح
 */
export const AuthenticatedRoute = ({ children }) => {
  const { profile, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * مكون للتحقق من عدم تسجيل الدخول (لصفحات مثل تسجيل الدخول)
 * @param {React.ReactNode} children - العناصر التي سيتم عرضها إذا كانت الحماية تسمح
 */
export const UnauthenticatedRoute = ({ children }) => {
  const { profile, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (profile) {
    // إذا كان مسجلاً، أعد توجيهه إلى لوحة التحكم الافتراضية
    const redirectPath = useAuthStore.getState().getRedirectPath(profile.role);
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};