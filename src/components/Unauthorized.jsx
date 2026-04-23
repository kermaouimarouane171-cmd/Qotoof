/**
 * Unauthorized - صفحة الخطأ 403
 */

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">403</h1>
        <p className="mt-4 text-2xl font-semibold text-gray-700">
          وصول مرفوض
        </p>
        <p className="mt-2 text-gray-600">
          عذراً، ليس لديك صلاحيات للوصول إلى هذه الصفحة.
        </p>
        <div className="mt-6 flex gap-4 justify-center">
          <a
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            العودة للرئيسية
          </a>
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            تسجيل الدخول
          </a>
        </div>
      </div>
    </div>
  );
}
