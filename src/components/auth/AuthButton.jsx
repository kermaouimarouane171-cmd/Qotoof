import clsx from 'clsx'

const AuthButton = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  ...props
}) => {
  const variants = {
    primary:
      'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-600/20 hover:shadow-xl hover:shadow-green-600/30 focus:ring-green-500/30',
    secondary:
      'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 focus:ring-gray-400/20',
    ghost:
      'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-400/20',
    danger:
      'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 focus:ring-red-500/30',
  }

  const sizes = {
    sm: 'h-10 px-4 text-sm rounded-xl',
    md: 'h-12 px-6 text-sm rounded-2xl',
    lg: 'h-14 px-8 text-base rounded-2xl',
  }

  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-semibold transition-all duration-200 outline-none focus:ring-4 active:scale-[0.98]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2.5 h-5 w-5 currentColor"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}

export default AuthButton
