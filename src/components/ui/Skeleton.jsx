import React from 'react'

const baseClass = 'animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700'

const Skeleton = ({ className = '', as: Component = 'div', ...props }) => (
  <Component className={`${baseClass} ${className}`} {...props} />
)

Skeleton.Text = ({ lines = 1, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: lines }).map((_, index) => (
      <div
        key={index}
        className={`${baseClass} h-4 ${index === lines - 1 && lines > 1 ? 'w-4/5' : 'w-full'}`}
      />
    ))}
  </div>
)

Skeleton.Card = ({ className = '' }) => (
  <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>
    <div className="space-y-4">
      <div className={`${baseClass} h-4 w-1/3`} />
      <div className={`${baseClass} h-8 w-1/2`} />
      <div className={`${baseClass} h-4 w-2/3`} />
    </div>
  </div>
)

Skeleton.Table = ({ rows = 5, columns = 4, className = '' }) => (
  <div className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}>
    <div className="grid gap-4 border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/60" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }).map((_, index) => <div key={index} className={`${baseClass} h-4 w-full`} />)}
    </div>
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, columnIndex) => <div key={columnIndex} className={`${baseClass} h-4 w-full`} />)}
        </div>
      ))}
    </div>
  </div>
)

Skeleton.Avatar = ({ size = 'md', className = '' }) => {
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-20 w-20',
  }

  return <div className={`${baseClass} rounded-full ${sizeMap[size] || sizeMap.md} ${className}`} />
}

export default Skeleton