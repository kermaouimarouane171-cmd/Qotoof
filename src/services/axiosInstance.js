/**
 * axiosInstance - طبقة الخدمات (API Layer)
 * 
 * هذا الملف يحتوي على إعدادات axios مع:
 * 1. Interceptors للتعامل مع 401 Unauthorized
 * 2. تجديد الـ Token (Token Refresh)
 * 3. إضافة Authorization Header تلقائياً
 * 4. معالجة شاملة للأخطاء
 */

import axios from 'axios';

// === إعدادات API الأساسية ===
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

/**
 * إنشء instance من axios مع الإعدادات الأساسية
 */
export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  // اسمح بإرسال الـ Cookies مع الطلبات (للـ HttpOnly Cookies)
  withCredentials: true,
});

/**
 * === REQUEST INTERCEPTOR ===
 * 
 * يقوم بـ:
 * 1. إضافة Authorization Header من localStorage/sessionStorage
 * 2. إضافة معلومات أخرى مثل User-Agent
 */
axiosInstance.interceptors.request.use(
  (config) => {
    // الحصول على الـ Token من localStorage أو sessionStorage
    const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);

    // إضافة Authorization Header إذا كان التوكن موجوداً
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // إضافة معلومات إضافية إذا لزم الأمر
    config.headers['X-Requested-With'] = 'XMLHttpRequest';

    return config;
  },
  (error) => {
    // معالجة أخطاء الطلب
    return Promise.reject(error);
  }
);

/**
 * === RESPONSE INTERCEPTOR ===
 * 
 * يقوم بـ:
 * 1. التعامل مع 401 Unauthorized - تجديد الـ Token
 * 2. التعامل مع 403 Forbidden - إعادة التوجيه إلى /unauthorized
 * 3. إرجاع البيانات أو رفع الأخطاء
 */
let isRefreshing = false;
let failedQueue = [];

/**
 * معالجة قائمة الطلبات المعلقة بعد تجديد الـ Token
 */
const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.response.use(
  // الاستجابة الناجحة (2xx)
  (response) => response.data,

  // معالجة الأخطاء
  async (error) => {
    const originalRequest = error.config;

    // === معالجة 401 Unauthorized ===
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // إذا كان جاري تجديد الـ Token، أضف الطلب إلى قائمة الانتظار
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      // ابدأ عملية تجديد الـ Token
      isRefreshing = true;
      originalRequest._retry = true;

      try {
        // محاولة تحديث الـ Token
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY) || 
                           sessionStorage.getItem(REFRESH_TOKEN_KEY);

        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // اطلب token جديد من السيرفر
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // حفظ الـ Tokens الجديد
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

        // تحديث Headers للطلب الأصلي
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        // معالجة الطلبات المعلقة
        processQueue(null, accessToken);

        // إعادة محاولة الطلب الأصلي
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // فشل تجديد الـ Token - قم بتسجيل الخروج
        processQueue(refreshError, null);

        // حذف الـ Tokens
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(REFRESH_TOKEN_KEY);

        // إعادة التوجيه إلى صفحة تسجيل الدخول
        window.location.href = '/login';

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // === معالجة 403 Forbidden ===
    if (error.response?.status === 403) {
      window.location.href = '/unauthorized';
      return Promise.reject(error);
    }

    // === معالجة الأخطاء الأخرى ===
    if (error.response) {
      // السيرفر أرجع استجابة بخطأ (4xx, 5xx)
      const errorResponse = {
        status: error.response.status,
        message: error.response.data?.message || 'An error occurred',
        data: error.response.data,
      };
      return Promise.reject(errorResponse);
    }

    if (error.request) {
      // تم إرسال الطلب لكن لم يتم استقبال استجابة
      return Promise.reject({
        status: 0,
        message: 'No response from server',
        data: null,
      });
    }

    // خطأ في إعداد الطلب
    return Promise.reject({
      status: 0,
      message: error.message,
      data: null,
    });
  }
);

/**
 * تصدير دالة لحذف الـ Tokens (استخدام في عملية تسجيل الخروج)
 */
export const clearAuthTokens = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
};

/**
 * تصدير دالة للحصول على الـ Token الحالي
 */
export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
};

export default axiosInstance;
