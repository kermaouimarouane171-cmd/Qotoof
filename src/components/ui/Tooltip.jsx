import { useState } from 'react'

const Tooltip = ({ title = '', content = null, children = null }) => {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50"
        aria-label={title || 'Show help'}
      >
        ?
      </button>

      {open && (
        <div className="absolute left-0 top-8 z-20 w-80 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-xl">
          {title ? <p className="mb-2 font-semibold text-gray-900">{title}</p> : null}
          <div className="space-y-2 leading-6">{content}</div>
          {children}
        </div>
      )}
    </div>
  )
}

export default Tooltip
