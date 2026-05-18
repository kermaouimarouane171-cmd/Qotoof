/**
 * Unauthorized - صفحة الخطأ 403
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Unauthorized() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">403</h1>
        <p className="mt-4 text-2xl font-semibold text-gray-700">
          {t('unauthorized.title', 'Access Denied')}
        </p>
        <p className="mt-2 text-gray-600">
          {t('unauthorized.description', 'You don\'t have permission to access this page.')}
        </p>
        <div className="mt-6 flex gap-4 justify-center">
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('unauthorized.backHome', 'Back to Home')}
          </Link>
          <Link
            to="/login"
            className="inline-block px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            {t('auth.signIn', 'Sign In')}
          </Link>
        </div>
      </div>
    </div>
  );
}
