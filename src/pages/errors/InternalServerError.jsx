import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const InternalServerError = () => {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-xl text-center">
        <h1 className="text-6xl font-extrabold text-gray-900">500</h1>
        <p className="mt-4 text-2xl font-semibold text-gray-800">{t('internalServerError.title', 'Internal Server Error')}</p>
        <p className="mt-2 text-gray-600">{t('internalServerError.description', 'An unexpected problem occurred. Please try again shortly or return to the home page.')}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={() => window.location.reload()} className="btn-primary">{t('internalServerError.retry', 'Try Again')}</button>
          <Link to="/" className="btn-outline">{t('internalServerError.backHome', 'Back to Home')}</Link>
        </div>
      </div>
    </div>
  )
}

export default InternalServerError