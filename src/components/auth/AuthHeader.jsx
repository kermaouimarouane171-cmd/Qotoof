const AuthHeader = ({ icon, title, subtitle, email }) => {
  return (
    <div className="text-center mb-8">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center mx-auto mb-5 shadow-sm">
          {icon}
        </div>
      )}
      <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
          {subtitle}
        </p>
      )}
      {email && (
        <p
          className="mt-3 text-sm font-semibold text-green-700 bg-green-50 inline-block px-4 py-1.5 rounded-full"
          data-cy="verify-email-address"
          data-testid="verify-email-address"
        >
          {email}
        </p>
      )}
    </div>
  )
}

export default AuthHeader
