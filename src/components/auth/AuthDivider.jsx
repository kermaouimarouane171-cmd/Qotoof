const AuthDivider = ({ label }) => {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-gray-200" />
      </div>
      {label && (
        <div className="relative flex justify-center">
          <span className="bg-white/80 backdrop-blur-xl px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
            {label}
          </span>
        </div>
      )}
    </div>
  )
}

export default AuthDivider
