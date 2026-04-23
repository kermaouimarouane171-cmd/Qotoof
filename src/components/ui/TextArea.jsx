import { clsx } from 'clsx';

export default function TextArea({ label, error, className, id, rows = 4, ...props }) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label htmlFor={textareaId} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        className={clsx(
          'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors resize-y',
          'bg-white dark:bg-gray-800 text-gray-900 dark:text-white',
          'focus:outline-none focus:ring-2 focus:ring-green-500',
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 dark:border-gray-600'
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
