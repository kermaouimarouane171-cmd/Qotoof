import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { HomeIcon } from '@heroicons/react/24/outline'

const NotFoundPage = () => {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <div className="text-9xl font-bold text-primary-600 mb-4">404</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('notFound.title', 'Page Not Found')}</h1>
        <p className="text-gray-600 mb-8">
          {t('notFound.description', "The page you're looking for doesn't exist or has been moved.")}
        </p>
        <Link to="/" className="btn-primary inline-flex items-center gap-2">
          <HomeIcon className="w-5 h-5" />
          {t('notFound.backHome', 'Back to Home')}
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage
