import { useState, useRef, useEffect } from 'react'

const Tooltip = ({ title = '', content = null, children = null }) => {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef(null)
  const tooltipRef = useRef(null)

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (event) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50"
        aria-label={title || 'Show help'}
      >
        ?
      </button>

      {open && (
        <div
          ref={tooltipRef}
          className="absolute right-0 top-8 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700 shadow-xl sm:w-72"
        >
          {title ? <p className="mb-2 font-semibold text-gray-900">{title}</p> : null}
          <div className="space-y-2 leading-6">{content}</div>
          {children}
        </div>
      )}
    </div>
  )
}

export default Tooltip
