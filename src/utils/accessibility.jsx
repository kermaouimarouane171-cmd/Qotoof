/**
 * ♿ Accessibility Utilities
 * Improves ARIA labels, keyboard navigation, and screen reader support
 */

import { useState, useEffect, useRef } from 'react'

// ============================================
// 1. ARIA LABEL HELPERS
// ============================================

/**
 * Generate descriptive aria-label for product cards
 */
export const getProductAriaLabel = (product) => {
  const parts = [
    product.name,
    product.price_per_unit && `${product.price_per_unit} ${product.unit_type || 'per unit'}`,
    product.is_available ? 'In stock' : 'Out of stock',
  ]

  return parts.filter(Boolean).join(', ')
}

/**
 * Generate aria-label for order items
 */
export const getOrderAriaLabel = (order) => {
  return `Order ${order.order_number || order.id}, Status: ${order.status}, Total: ${order.total}`
}

/**
 * Generate aria-label for navigation links
 */
export const getNavAriaLabel = (label, isActive = false) => {
  return isActive ? `${label} (current page)` : label
}

/**
 * Generate aria-label for buttons with icons
 */
export const getButtonAriaLabel = (action, target = '') => {
  const parts = [action, target].filter(Boolean)
  return parts.join(' ')
}

/**
 * Generate aria-label for form fields with errors
 */
export const getFieldAriaLabel = (label, hasError = false, errorMessage = '') => {
  if (hasError && errorMessage) {
    return `${label}. Error: ${errorMessage}`
  }
  return label
}

// ============================================
// 2. KEYBOARD NAVIGATION
// ============================================

/**
 * Handle keyboard navigation for lists
 */
export const useKeyboardNavigation = (items, currentIndex, onSelect) => {
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        onSelect(Math.min(currentIndex + 1, items.length - 1))
        break

      case 'ArrowUp':
        e.preventDefault()
        onSelect(Math.max(currentIndex - 1, 0))
        break

      case 'Home':
        e.preventDefault()
        onSelect(0)
        break

      case 'End':
        e.preventDefault()
        onSelect(items.length - 1)
        break

      case 'Enter':
      case ' ':
        e.preventDefault()
        if (currentIndex >= 0 && currentIndex < items.length) {
          onSelect(currentIndex, true)
        }
        break

      default:
        break
    }
  }

  return handleKeyDown
}

/**
 * Handle keyboard navigation for grids
 */
export const useGridNavigation = (columns, currentIndex, totalItems, onSelect) => {
  const handleKeyDown = (e) => {
    const row = Math.floor(currentIndex / columns)
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        if (currentIndex < totalItems - 1) {
          onSelect(currentIndex + 1)
        }
        break

      case 'ArrowLeft':
        e.preventDefault()
        if (currentIndex > 0) {
          onSelect(currentIndex - 1)
        }
        break

      case 'ArrowDown':
        e.preventDefault()
        if (row + 1 < Math.ceil(totalItems / columns)) {
          onSelect(Math.min(currentIndex + columns, totalItems - 1))
        }
        break

      case 'ArrowUp':
        e.preventDefault()
        if (row > 0) {
          onSelect(currentIndex - columns)
        }
        break

      case 'Enter':
      case ' ':
        e.preventDefault()
        onSelect(currentIndex, true)
        break

      default:
        break
    }
  }

  return handleKeyDown
}

// ============================================
// 3. FOCUS MANAGEMENT
// ============================================

/**
 * Trap focus within a container (for modals, dialogs)
 */
export const createFocusTrap = (container) => {
  if (!container) return null

  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )

  const firstFocusable = focusableElements[0]
  const lastFocusable = focusableElements[focusableElements.length - 1]

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault()
        lastFocusable.focus()
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault()
        firstFocusable.focus()
      }
    }
  }

  container.addEventListener('keydown', handleKeyDown)

  // Focus first element
  firstFocusable?.focus()

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown)
  }
}

/**
 * Save and restore focus
 */
export const createFocusManager = () => {
  let previouslyFocused = null

  return {
    saveFocus: () => {
      previouslyFocused = document.activeElement
    },

    restoreFocus: () => {
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    },

    focusFirst: (container) => {
      if (!container) return

      const focusable = container.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      focusable?.focus()
    },
  }
}

// ============================================
// 4. SCREEN READER ANNOUNCEMENTS
// ============================================

/**
 * Announce message to screen readers
 */
export const announceToScreenReader = (message, priority = 'polite') => {
  const announcer = document.createElement('div')
  announcer.setAttribute('aria-live', priority)
  announcer.setAttribute('aria-atomic', 'true')
  announcer.className = 'sr-only'
  announcer.textContent = message

  document.body.appendChild(announcer)

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcer)
  }, 1000)
}

/**
 * Announce page change
 */
export const announcePageChange = (pageTitle) => {
  announceToScreenReader(`Page loaded: ${pageTitle}`, 'assertive')
}

/**
 * Announce form error
 */
export const announceFormError = (errorMessage) => {
  announceToScreenReader(`Form error: ${errorMessage}`, 'assertive')
}

/**
 * Announce success
 */
export const announceSuccess = (message) => {
  announceToScreenReader(message, 'polite')
}

// ============================================
// 5. ACCESSIBLE MODAL
// ============================================

/**
 * useAccessibleModal - Hook for accessible modal behavior
 */
export const useAccessibleModal = (isOpen, onClose) => {
  const modalRef = useRef(null)
  const focusManagerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    // Save focus
    focusManagerRef.current = createFocusManager()
    focusManagerRef.current.saveFocus()

    // Prevent body scroll
    document.body.style.overflow = 'hidden'

    // Focus trap
    if (modalRef.current) {
      createFocusTrap(modalRef.current)
    }

    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)

    // Cleanup
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleEscape)
      focusManagerRef.current?.restoreFocus()
    }
  }, [isOpen, onClose])

  return modalRef
}

// ============================================
// 6. ACCESSIBLE TOOLTIP
// ============================================

/**
 * Accessible tooltip component
 */
export const AccessibleTooltip = ({
  children,
  content,
  id,
  position = 'top',
}) => {
  const tooltipId = `tooltip-${id}`

  return (
    <div className="relative group">
      {children}
      <div
        id={tooltipId}
        role="tooltip"
        className={`absolute ${getPositionClasses(position)} invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all bg-gray-900 text-white text-sm px-3 py-2 rounded whitespace-nowrap z-50`}
      >
        {content}
        <div className={`absolute ${getArrowClasses(position)} w-2 h-2 bg-gray-900 transform rotate-45`} />
      </div>
    </div>
  )
}

const getPositionClasses = (position) => {
  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }
  return positions[position] || positions.top
}

const getArrowClasses = (position) => {
  const arrows = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
    left: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
    right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2',
  }
  return arrows[position] || arrows.top
}

// ============================================
// 7. ACCESSIBLE TABS
// ============================================

/**
 * AccessibleTabs component
 */
export const AccessibleTabs = ({ tabs, activeTab, onChange }) => {
  const tabListRef = useRef(null)

  const handleKeyDown = (e, index) => {
    let newIndex = index

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        newIndex = (index + 1) % tabs.length
        break

      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        newIndex = (index - 1 + tabs.length) % tabs.length
        break

      case 'Home':
        e.preventDefault()
        newIndex = 0
        break

      case 'End':
        e.preventDefault()
        newIndex = tabs.length - 1
        break

      default:
        return
    }

    onChange(newIndex)
    // Focus the new tab
    setTimeout(() => {
      tabListRef.current?.querySelectorAll('[role="tab"]')[newIndex]?.focus()
    }, 0)
  }

  return (
    <div>
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Section tabs"
        className="flex border-b border-gray-200"
      >
        {tabs.map((tab, index) => (
          <button
            key={index}
            role="tab"
            aria-selected={activeTab === index}
            aria-controls={`tabpanel-${index}`}
            id={`tab-${index}`}
            tabIndex={activeTab === index ? 0 : -1}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === index
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => onChange(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={index}
          role="tabpanel"
          id={`tabpanel-${index}`}
          aria-labelledby={`tab-${index}`}
          className={`p-4 ${activeTab === index ? '' : 'hidden'}`}
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}

// ============================================
// 8. ACCESSIBLE ACCORDION
// ============================================

/**
 * AccessibleAccordion component
 */
export const AccessibleAccordion = ({ items }) => {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="border rounded-lg">
          <button
            aria-expanded={openIndex === index}
            aria-controls={`accordion-panel-${index}`}
            id={`accordion-header-${index}`}
            className="w-full px-4 py-3 text-left font-medium flex items-center justify-between"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setOpenIndex(openIndex === index ? null : index)
              }
            }}
          >
            <span>{item.title}</span>
            <svg
              className={`w-5 h-5 transform transition-transform ${openIndex === index ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div
            role="region"
            id={`accordion-panel-${index}`}
            aria-labelledby={`accordion-header-${index}`}
            className={`overflow-hidden transition-all ${openIndex === index ? 'max-h-96' : 'max-h-0'}`}
          >
            <div className="p-4 border-t">
              {item.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================
// 9. SKIP LINK
// ============================================

/**
 * SkipLink - Allow keyboard users to skip to main content
 */
export const SkipLink = ({ target = '#main-content' }) => {
  return (
    <a
      href={target}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-green-500 focus:text-white focus:rounded-lg focus:outline-none focus:shadow-lg"
    >
      Skip to main content
    </a>
  )
}

// ============================================
// 10. ACCESSIBLE FORM FIELD
// ============================================

/**
 * AccessibleFormField - Form field with proper ARIA attributes
 */
export const AccessibleFormField = ({
  label,
  id,
  type = 'text',
  value,
  onChange,
  error,
  required = false,
  description,
  autoComplete,
  ...props
}) => {
  const fieldId = id || `field-${label.toLowerCase().replace(/\s+/g, '-')}`
  const errorId = `${fieldId}-error`
  const descId = `${fieldId}-description`

  return (
    <div className="space-y-2">
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>

      {description && (
        <p id={descId} className="text-sm text-gray-500">
          {description}
        </p>
      )}

      <input
        id={fieldId}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={[
          error && errorId,
          description && descId,
        ].filter(Boolean).join(' ') || undefined}
        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
        {...props}
      />

      {error && (
        <p id={errorId} className="text-sm text-red-600 flex items-center gap-1" role="alert">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}

// ============================================
// 11. LIVE REGION
// ============================================

/**
 * LiveRegion - Announces dynamic content changes to screen readers
 */
export const LiveRegion = ({ message, priority = 'polite' }) => {
  if (!message) return null

  return (
    <div
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  )
}

// ============================================
// 12. ACCESSIBILITY HOOKS
// ============================================

/**
 * useReducedMotion - Check if user prefers reduced motion
 */
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (e) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}

/**
 * useHighContrast - Check if user prefers high contrast
 */
export const useHighContrast = () => {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: more)')
    setPrefersHighContrast(mediaQuery.matches)

    const handleChange = (e) => {
      setPrefersHighContrast(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersHighContrast
}

// ============================================
// Default export
// ============================================
export default {
  getProductAriaLabel,
  getOrderAriaLabel,
  getNavAriaLabel,
  getButtonAriaLabel,
  getFieldAriaLabel,
  useKeyboardNavigation,
  useGridNavigation,
  createFocusTrap,
  createFocusManager,
  announceToScreenReader,
  announcePageChange,
  announceFormError,
  announceSuccess,
  useAccessibleModal,
  AccessibleTooltip,
  AccessibleTabs,
  AccessibleAccordion,
  SkipLink,
  AccessibleFormField,
  LiveRegion,
  useReducedMotion,
  useHighContrast,
}
