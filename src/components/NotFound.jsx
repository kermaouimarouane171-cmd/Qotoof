/**
 * NotFound - صفحة الخطأ 404
 */

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-2xl font-semibold text-gray-700">
          الصفحة غير موجودة
        </p>
        <p className="mt-2 text-gray-600">
          عذراً، الصفحة التي تبحث عنها غير موجودة.
        </p>
        <a
          href="/"
          className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          العودة للرئيسية
        </a>
      </div>
    </div>
  );
}
