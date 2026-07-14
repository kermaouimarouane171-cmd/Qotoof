import React from 'react'
import {
  ArrowPathIcon,
  BellIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  InboxIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  TruckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

const ICONS = {
  inbox: InboxIcon,
  search: MagnifyingGlassIcon,
  orders: ClipboardDocumentListIcon,
  products: CubeIcon,
  shopping: ShoppingBagIcon,
  truck: TruckIcon,
  users: UserGroupIcon,
  alert: ExclamationTriangleIcon,
  refresh: ArrowPathIcon,
  bell: BellIcon,
}

const resolveIcon = (icon) => {
  if (React.isValidElement(icon)) return icon
  if (typeof icon === 'function') return React.createElement(icon, { className: 'w-10 h-10' })
  if (typeof icon === 'string' && ICONS[icon]) {
    const Icon = ICONS[icon]
    return <Icon className="w-10 h-10" />
  }
  const DefaultIcon = ICONS.inbox
  return <DefaultIcon className="w-10 h-10" />
}

const EmptyState = ({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <div className={`rounded-2xl border border-dashed border-gray-300 bg-white/80 px-6 py-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900/60 ${className}`}>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300">
        {resolveIcon(icon)}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>}
      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {actionLabel && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default EmptyState