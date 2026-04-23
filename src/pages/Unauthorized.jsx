import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui'
import { HomeIcon, ArrowLeftIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline'

const UnauthorizedPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldExclamationIcon className="w-10 h-10 text-red-500" />
        </div>

        {/* Error Code */}
        <div className="text-6xl font-bold text-red-600 mb-4">403</div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('unauthorized.title', 'Access Denied')}</h1>

        {/* Description */}
        <p className="text-gray-600 mb-2">
          {t('unauthorized.description', "You don't have permission to access this page.")}
        </p>
        <p className="text-sm text-gray-500 mb-8">
          {t('unauthorized.details', 'This area requires different permissions or a different user role.')}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            {t('unauthorized.goBack', 'Go Back')}
          </Button>
          <Link to="/" className="btn-primary inline-flex items-center gap-2">
            <HomeIcon className="w-5 h-5" />
            {t('unauthorized.backHome', 'Back to Home')}
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          <p className="font-medium mb-1">{t('unauthorized.needHelp', 'Need help?')}</p>
          <p>
            {t('unauthorized.helpText', 'If you believe this is an error, please')}{' '}
            <Link to="/contact" className="underline font-medium hover:text-blue-900">
              {t('unauthorized.contactSupport', 'contact support')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default UnauthorizedPage
