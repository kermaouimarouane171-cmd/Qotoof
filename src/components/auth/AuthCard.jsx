import clsx from 'clsx'

const AuthCard = ({ children, className, maxWidth = 'max-w-md' }) => {
  return (
    <div
      className={clsx(
        'w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-white/60 p-8 sm:p-10',
        maxWidth,
        className
      )}
    >
      {children}
    </div>
  )
}

export default AuthCard
