import { useTranslation } from 'react-i18next'
import { ClockIcon, TruckIcon, XMarkIcon, PhoneIcon } from '@heroicons/react/24/outline'
import { Card } from '@/components/ui'

/**
 * OrderProgressTimeline
 *
 * Displays the horizontal (desktop) + vertical (mobile) order progress timeline
 * and, when a driver is assigned, the driver info card below the timeline.
 *
 * Props:
 *  steps            - array of { key, label, labelDefault, icon }
 *  currentStepIndex - 0-based index of the active step
 *  isCancelled      - boolean
 *  timeline         - array of { status, created_at } from order_timeline table
 *  driver           - order.driver object (or null)
 */
export default function OrderProgressTimeline({ steps, currentStepIndex, isCancelled, timeline = [], driver }) {
  const { t, i18n } = useTranslation()

  return (
    <Card className="p-4 sm:p-6 bg-white mb-6">
      <h2 className="font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
        <ClockIcon className="w-5 h-5 text-green-600" />
        {t('orderDetail.orderProgress', 'Order Progress')}
      </h2>

      {/* Desktop: Horizontal Timeline */}
      <div className="hidden sm:block">
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${(Math.max(currentStepIndex, 0) / (steps.length - 1)) * 100}%` }}
            />
          </div>

          {/* Steps */}
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isCompleted = index <= currentStepIndex && !isCancelled
              const isCurrent = index === currentStepIndex && !isCancelled
              return (
                <div key={step.key} className="flex flex-col items-center flex-1">
                  <div
                    className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCancelled && index > 0
                        ? 'bg-gray-200 text-gray-400'
                        : isCompleted
                        ? 'bg-green-500 text-white shadow-md shadow-green-200'
                        : isCurrent
                        ? 'bg-white border-2 border-green-500 text-green-600 ring-4 ring-green-100'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isCancelled && index === 0 ? (
                      <XMarkIcon className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium text-center ${
                      isCurrent ? 'text-green-600' : isCompleted ? 'text-gray-700' : 'text-gray-400'
                    }`}
                  >
                    {t(step.label, step.labelDefault)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile: Vertical Timeline */}
      <div className="sm:hidden space-y-0">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isCompleted = index <= currentStepIndex && !isCancelled
          const isCurrent = index === currentStepIndex && !isCancelled
          const timelineEntry = timeline.find((tl) => tl.status === step.key)
          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    isCancelled && index > 0
                      ? 'bg-gray-200 text-gray-400'
                      : isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-white border-2 border-green-500 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCancelled && index === 0 ? (
                    <XMarkIcon className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-0.5 h-10 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
              <div className="pt-1 pb-4">
                <p
                  className={`font-medium text-sm ${
                    isCurrent ? 'text-green-600' : isCompleted ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {t(step.label, step.labelDefault)}
                </p>
                {timelineEntry && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(timelineEntry.created_at).toLocaleString(
                      i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'fr' ? 'fr-MA' : 'en-US',
                      { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                    )}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Driver Info (if assigned) */}
      {driver && (
        <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              {driver.avatar_url ? (
                <img
                  src={driver.avatar_url}
                  alt={driver.first_name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <TruckIcon className="w-5 h-5 text-indigo-600" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 text-sm">
                {driver.first_name} {driver.last_name}
              </p>
              <p className="text-xs text-gray-500">
                {driver.vehicle_type && `${driver.vehicle_type}`}
                {driver.vehicle_plate && ` • ${driver.vehicle_plate}`}
              </p>
            </div>
            {driver.phone && (
              <a
                href={`tel:${driver.phone}`}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 hover:bg-indigo-50 transition-colors min-h-[40px]"
              >
                <PhoneIcon className="w-3.5 h-3.5" />
                {t('orderDetail.actions.call', 'Call')}
              </a>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}