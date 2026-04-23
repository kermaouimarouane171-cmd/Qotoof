import { forwardRef } from 'react';
import { clsx } from 'clsx';

const Select = forwardRef(function Select({ label, options = [], error, className, id, ...props }, ref) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={clsx(
          'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
          'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
          'focus:outline-none focus:ring-2 focus:ring-green-500',
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 dark:border-gray-600'
        )}
        {...props}
      >
        {options.map((opt) => {
          const value = typeof opt === 'string' ? opt : opt.value;
          const optLabel = typeof opt === 'string' ? opt : opt.label;
          return (
            <option key={value} value={value}>
              {optLabel}
            </option>
          );
        })}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
