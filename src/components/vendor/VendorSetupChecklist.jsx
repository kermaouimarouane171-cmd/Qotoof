import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui'
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

const VendorSetupChecklist = ({
  items,
  title = 'إعداد المتجر',
  subtitle,
  progress,
  nextAction,
}) => {
  const navigate = useNavigate()
  const completedCount = items.filter((i) => i.complete).length
  const totalCount = items.length
  const progressValue =
    progress !== undefined ? progress : Math.round((completedCount / totalCount) * 100)

  return (
    <Card className="mb-4 p-4 rounded-2xl border border-gray-200 shadow-sm" data-testid="vendor-setup-checklist">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <span className="text-sm font-semibold text-green-700">
            {progressValue}%
          </span>
        </div>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}

        {/* Progress bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500 ease-out"
            style={{ width: `${progressValue}%` }}
            aria-valuenow={progressValue}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
      </div>

      {/* Highlighted next action */}
      {nextAction && (
        <div className="mb-3 rounded-xl border border-green-200 bg-green-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-right">
              <p className="text-sm font-semibold text-gray-900">{nextAction.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{nextAction.subtitle || 'أكمل هذه الخطوة لتفعيل متجرك.'}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(nextAction.path)}
              className="inline-flex flex-shrink-0 items-center justify-center rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
            >
              {nextAction.label}
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item) => {
          const isComplete = Boolean(item.complete)
          const isPending = Boolean(item.pending)
          const statusLabel = isComplete ? 'مكتمل' : isPending ? 'قيد الانتظار' : 'غير مكتمل'

          const rowContent = (
            <>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                    isComplete ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircleIcon className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <ClockIcon className="w-5 h-5" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 text-right">
                  <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isComplete
                      ? 'bg-green-100 text-green-700'
                      : isPending
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {statusLabel}
                </span>
                {item.path && (
                  <ChevronLeftIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
                )}
              </div>
            </>
          )

          if (item.path) {
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-right hover:bg-green-50/60 transition-colors"
                >
                  {rowContent}
                </button>
              </li>
            )
          }

          return (
            <li
              key={item.key}
              className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 p-3"
            >
              {rowContent}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

export default VendorSetupChecklist
