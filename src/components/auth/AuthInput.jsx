import { useId } from 'react'
import clsx from 'clsx'

const AuthInput = ({
  label,
  error,
  type = 'text',
  className,
  leftIcon,
  rightIcon,
  helperText,
  id,
  required,
  ...props
}) => {
  const generatedId = useId()
  const inputId = id || generatedId
  const errorId = error ? `${inputId}-error` : undefined
  const helperId = helperText && !error ? `${inputId}-helper` : undefined
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-gray-700 mb-2"
        >
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          type={type}
          ref={props.ref}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={clsx(
            'w-full h-12 px-4 text-sm border rounded-2xl transition-all duration-200 outline-none',
            'bg-gray-50/50 border-gray-200 text-gray-900 placeholder-gray-400',
            'hover:border-gray-300 hover:bg-white',
            'focus:ring-4 focus:ring-green-500/10 focus:border-green-500 focus:bg-white',
            'disabled:bg-gray-100 disabled:cursor-not-allowed',
            leftIcon && 'pl-11',
            rightIcon && 'pr-11',
            error && 'border-red-300 focus:ring-red-500/10 focus:border-red-500 bg-red-50/30',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={helperId} className="mt-1.5 text-xs text-gray-500">
          {helperText}
        </p>
      )}
    </div>
  )
}

export default AuthInput
