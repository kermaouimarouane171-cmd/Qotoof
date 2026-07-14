import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui'
import { LockClosedIcon } from '@heroicons/react/24/outline'

/**
 * AuthGate — reusable prompt shown when an authenticated-only action or page
 * is accessed by a guest/visitor. Supports card, fullscreen, and modal variants.
 */
const AuthGate = ({
  variant = 'card', // 'card' | 'fullscreen' | 'modal'
  title,
  message,
  from = '/login',
  loginTo = '/login',
  registerTo = '/register',
  showRegister = false,
  onCancel,
  icon: Icon = LockClosedIcon,
  className = '',
}) => {
  const { t } = useTranslation()

  const defaultTitle = title ?? t('authGate.title', 'Sign in required')
  const defaultMessage = message ?? t('authGate.message', 'You need to be signed in to continue.')
  const loginLabel = t('authGate.signIn', 'Sign In')
  const registerLabel = t('authGate.createAccount', 'Create Account')
  const cancelLabel = t('common.cancel', 'Cancel')

  const content = (
    <div className={`text-center ${className}`}>
      {Icon && (
        <div className={`mx-auto mb-4 flex items-center justify-center ${variant === 'fullscreen' ? 'w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg shadow-green-200/50 dark:shadow-green-900/30' : 'w-16 h-16 text-gray-300'}`}>
          <Icon className={`${variant === 'fullscreen' ? 'w-10 h-10 text-white' : 'w-16 h-16'}`} />
        </div>
      )}
      <h3 className={`font-semibold text-gray-900 dark:text-white ${variant === 'fullscreen' ? 'text-2xl mb-2' : 'text-lg mb-2'}`}>
        {defaultTitle}
      </h3>
      <p className={`${variant === 'fullscreen' ? 'text-gray-500 dark:text-gray-400 text-sm mb-8 max-w-xs mx-auto' : 'text-gray-500 mb-6'}`}>
        {defaultMessage}
      </p>
      <div className={`flex ${variant === 'fullscreen' ? 'flex-col gap-3 max-w-xs mx-auto' : 'gap-3'} ${showRegister ? '' : 'justify-center'}`}>
        <Link
          to={loginTo}
          state={{ from }}
          className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${variant === 'fullscreen' ? 'w-full py-3.5 px-4 bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-800 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 dark:hover:from-green-600 dark:hover:to-emerald-700 min-h-[52px]' : 'btn-primary'}`}
        >
          {loginLabel}
        </Link>
        {showRegister && (
          <Link
            to={registerTo}
            state={{ from }}
            className={`inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${variant === 'fullscreen' ? 'w-full py-3.5 px-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[52px]' : 'btn-outline'}`}
          >
            {registerLabel}
          </Link>
        )}
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600"
        >
          {cancelLabel}
        </button>
      )}
    </div>
  )

  if (variant === 'modal') {
    return (
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label={defaultTitle}
      >
        <Card className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
          {content}
        </Card>
      </div>
    )
  }

  if (variant === 'fullscreen') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-gray-50 dark:bg-gradient-to-b dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" dir="auto">
        <div className="max-w-md mx-auto px-4 sm:px-6 py-10 sm:py-16">
          {content}
        </div>
      </div>
    )
  }

  return (
    <Card className="p-12 text-center">
      {content}
    </Card>
  )
}

export default AuthGate
