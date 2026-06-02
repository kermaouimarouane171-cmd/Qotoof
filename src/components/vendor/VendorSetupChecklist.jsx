import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui'
import {
  CheckCircleIcon,
  ChevronLeftIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

const VendorSetupChecklist = ({ items, title = 'إعداد المتجر', subtitle }) => {
  const navigate = useNavigate()

  return (
    <Card className="mb-4 p-4 rounded-2xl border border-gray-200 shadow-sm" data-testid="vendor-setup-checklist">
      <div className="mb-3">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>

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
