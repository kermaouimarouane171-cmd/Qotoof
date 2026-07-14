/**
 * React Query (TanStack Query) Configuration
 * 
 * هذا الملف يحتوي على إعدادات TanStack Query محسنة للـ Production
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * إنشء QueryClient مع الإعدادات المحسنة
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    // === Queries Default Options ===
    queries: {
      // المدة التي يعتبر فيها الـ Query "fresh" (لا يحتاج تحديث)
      // 5 دقائق = 5 * 60 * 1000
      staleTime: 5 * 60 * 1000,

      // المدة التي يبقى الـ Query في الـ cache بعد فقدان اهتمام المراجع الدوري (useQuery hooks)
      // 10 دقائق = 10 * 60 * 1000
      // ملاحظة: في TanStack Query v5 تم استبدال cacheTime بـ gcTime.
      gcTime: 10 * 60 * 1000,

      // عدد محاولات إعادة المحاولة عند الفشل
      // دالة: لا تعيد محاولة للأخطاء 4xx (ما عدا 429 Too Many Requests)
      // ملاحظة: shouldRetryOnError ليس خياراً معترفاً به في TanStack Query v5 —
      //         يجب استخدام retry كدالة بدلاً منه.
      retry: (failureCount, error) => {
        const status = error?.status ?? error?.statusCode ?? error?.response?.status
        if (status >= 400 && status < 500 && status !== 429) return false
        return failureCount < 2
      },

      // التأخير بين محاولات إعادة المحاولة (milliseconds)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // السماح بتحديث الـ Query في الخلفية حتى لو كان user يستخدم التطبيق
      refetchOnWindowFocus: true,

      // تحديث الـ Query عند إعادة الاتصال بالإنترنت
      refetchOnReconnect: true,

      // تحديث الـ Query عند إعادة تثبيت المكون
      refetchOnMount: true,

      // معامل الإعادة في الحسابات - لا نستخدمه الآن
      throwOnError: false,
    },

    // === Mutations Default Options ===
    mutations: {
      // عدد محاولات إعادة المحاولة للـ Mutation
      retry: 1,

      // التأخير بين محاولات إعادة المحاولة
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

export default queryClient;
