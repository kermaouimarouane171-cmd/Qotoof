import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const ServiceUnavailable = () => {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-xl text-center">
        <h1 className="text-6xl font-extrabold text-gray-900">503</h1>
        <p className="mt-4 text-2xl font-semibold text-gray-800">{t('serviceUnavailable.title', 'Service Unavailable')}</p>
        <p className="mt-2 text-gray-600">{t('serviceUnavailable.description', 'The platform may be under maintenance or experiencing high traffic. Please try again in a few minutes.')}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={() => window.location.reload()} className="btn-primary">{t('serviceUnavailable.retry', 'Try Again')}</button>
          <Link to="/" className="btn-outline">{t('serviceUnavailable.backHome', 'Back to Home')}</Link>
        </div>
      </div>
    </div>
  )
}

export default ServiceUnavailable