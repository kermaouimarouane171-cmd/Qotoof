import { clsx } from 'clsx';

const variants = {
  info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  success: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300',
  error: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300',
};

export default function Alert({ children, variant = 'info', className, onClose }) {
  return (
    <div
      role="alert"
      className={clsx(
        'rounded-lg border p-4 text-sm',
        variants[variant] || variants.info,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>{children}</div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-4 inline-flex shrink-0 rounded-lg p-1.5 hover:bg-black/10 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
