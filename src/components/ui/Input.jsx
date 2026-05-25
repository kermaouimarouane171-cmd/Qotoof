import { forwardRef, useId } from 'react'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

const cn = (...inputs) => twMerge(clsx(inputs))

const Input = forwardRef(({
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
}, ref) => {
  const generatedId = useId()
  const inputId = id || generatedId
  const errorId = error ? `${inputId}-error` : undefined
  const helperId = helperText && !error ? `${inputId}-helper` : undefined
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined

  return (
    <div className="w-full">
      {label && (
        <label className="input-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={cn(
            'input',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            error && 'input-error',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p id={helperId} className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
