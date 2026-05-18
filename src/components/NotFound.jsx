/**
 * NotFound - صفحة الخطأ 404
 */

import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-2xl font-semibold text-gray-700">
          {t('notFound.title', 'Page Not Found')}
        </p>
        <p className="mt-2 text-gray-600">
          {t('notFound.description', 'The page you\'re looking for doesn\'t exist or has been moved.')}
        </p>
        <a
          href="/"
          className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t('notFound.backHome', 'Back to Home')}
        </a>
      </div>
    </div>
  );
}
