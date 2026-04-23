/**
 * 🎣 Common Custom Hooks
 * Reusable hooks for common operations across the application
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

// ============================================
// 1. DATA FETCHING HOOKS
// ============================================

/**
 * useFetch - Generic data fetching hook
 */
export const useFetch = (queryFn, options = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const {
    enabled = true,
    refetchOnMount = true,
    staleTime = 60000,
  } = options

  const lastFetchTime = useRef(0)

  const execute = useCallback(async (force = false) => {
    if (!enabled) return

    const now = Date.now()
    if (!force && now - lastFetchTime.current < staleTime && data) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await queryFn()
      setData(result)
      lastFetchTime.current = now
    } catch (err) {
      setError(err)
      logger.error('useFetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [queryFn, enabled, staleTime, data])

  useEffect(() => {
    if (refetchOnMount || !data) {
      execute()
    }
  }, [refetchOnMount, data, execute])

  const refetch = useCallback(() => execute(true), [execute])

  return { data, loading, error, refetch }
}

/**
 * useSupabaseQuery - Hook for Supabase queries
 */
export const useSupabaseQuery = (table, queryBuilder, options = {}) => {
  const { enabled = true, select = '*' } = options

  const queryFn = useCallback(async () => {
    let query = supabase.from(table).select(select)
    
    if (queryBuilder) {
      query = queryBuilder(query)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  }, [table, select, queryBuilder])

  return useFetch(queryFn, { enabled })
}

/**
 * useSupabaseSingle - Hook for single record fetch
 */
export const useSupabaseSingle = (table, id, select = '*') => {
  const queryFn = useCallback(async () => {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }, [table, id, select])

  return useFetch(queryFn, { enabled: !!id })
}

// ============================================
// 2. PAGINATION HOOK
// ============================================

/**
 * usePagination - Hook for paginated data
 */
export const usePagination = (fetchFn, options = {}) => {
  const {
    initialPage = 1,
    pageSize = 20,
  } = options

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(initialPage)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)

  const loadData = useCallback(async (pageNum = page) => {
    try {
      setLoading(true)
      setError(null)

      const result = await fetchFn({
        page: pageNum,
        limit: pageSize,
      })

      if (pageNum === 1) {
        setData(result.data || [])
      } else {
        setData(prev => [...prev, ...(result.data || [])])
      }

      setHasMore(result.pagination?.hasMore ?? result.data?.length === pageSize)
      setTotal(result.count || result.pagination?.total || 0)
      setPage(pageNum)
    } catch (err) {
      setError(err)
      logger.error('usePagination error:', err)
    } finally {
      setLoading(false)
    }
  }, [fetchFn, page, pageSize])

  useEffect(() => {
    loadData(1)
  }, [loadData])

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadData(page + 1)
    }
  }, [loadData, page, loading, hasMore])

  const refresh = useCallback(() => {
    loadData(1)
  }, [loadData])

  return {
    data,
    loading,
    error,
    hasMore,
    total,
    page,
    loadMore,
    refresh,
  }
}

// ============================================
// 3. FORM HOOK
// ============================================

/**
 * useForm - Hook for form state and validation
 */
export const useForm = (initialValues = {}, validationSchema = null) => {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form
  const reset = useCallback((newValues = initialValues) => {
    setValues(newValues)
    setErrors({})
    setTouched({})
    setIsSubmitting(false)
  }, [initialValues])

  // Set field value
  const setValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  // Set field error
  const setError = useCallback((name, error) => {
    setErrors(prev => ({ ...prev, [name]: error }))
  }, [])

  // Touch field
  const touch = useCallback((name) => {
    setTouched(prev => ({ ...prev, [name]: true }))
  }, [])

  // Handle change
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target
    const finalValue = type === 'checkbox' ? checked : value
    setValues(prev => ({ ...prev, [name]: finalValue }))
    setTouched(prev => ({ ...prev, [name]: true }))
  }, [])

  // Validate form
  const validate = useCallback(() => {
    if (!validationSchema) return true

    try {
      validationSchema.parse(values)
      setErrors({})
      return true
    } catch (error) {
      if (error.errors) {
        const newErrors = {}
        error.errors.forEach(err => {
          newErrors[err.path.join('.')] = err.message
        })
        setErrors(newErrors)
      }
      return false
    }
  }, [values, validationSchema])

  // Submit form
  const handleSubmit = useCallback(async (onSubmit) => {
    if (!validate()) return false

    setIsSubmitting(true)
    try {
      await onSubmit(values)
      return true
    } catch (error) {
      if (error.errors) {
        const newErrors = {}
        error.errors.forEach(err => {
          newErrors[err.path?.join('.') || 'form'] = err.message
        })
        setErrors(newErrors)
      } else {
        setErrors({ form: error.message || 'Submission failed' })
      }
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [values, validate])

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setValue,
    setError,
    touch,
    handleChange,
    handleSubmit,
    reset,
    validate,
  }
}

// ============================================
// 4. MODAL HOOK
// ============================================

/**
 * useModal - Hook for modal state management
 */
export const useModal = (initialState = false) => {
  const [isOpen, setIsOpen] = useState(initialState)
  const [modalData, setModalData] = useState(null)

  const open = useCallback((data = null) => {
    setModalData(data)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setModalData(null)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  return {
    isOpen,
    modalData,
    open,
    close,
    toggle,
  }
}

// ============================================
// 5. TOAST HOOK
// ============================================

/**
 * useToast - Hook for toast notifications
 */
export const useToast = () => {
  const showToast = useCallback(async (promise, options = {}) => {
    const {
      loading = 'Loading...',
      success = 'Success!',
      error = 'Error occurred',
    } = options

    const toast = await import('react-hot-toast')

    return toast.default.promise(
      promise,
      {
        loading,
        success,
        error: (err) => error || err?.message || 'Error occurred',
      }
    )
  }, [])

  const success = useCallback(async (message) => {
    const toast = await import('react-hot-toast')
    toast.default.success(message)
  }, [])

  const error = useCallback(async (message) => {
    const toast = await import('react-hot-toast')
    toast.default.error(message)
  }, [])

  const warning = useCallback(async (message) => {
    const toast = await import('react-hot-toast')
    toast.default(message, {
      icon: '⚠️',
      duration: 3500,
    })
  }, [])

  return {
    showToast,
    success,
    error,
    warning,
  }
}

// ============================================
// 6. COPY TO CLIPBOARD HOOK
// ============================================

/**
 * useClipboard - Hook for clipboard operations
 */
export const useClipboard = () => {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setError(null)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setError(err)
      logger.error('Clipboard error:', err)
    }
  }, [])

  return { copied, error, copy }
}

// ============================================
// 7. LOCAL STORAGE HOOK
// ============================================

/**
 * useLocalStorage - Hook for persistent state
 */
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      logger.error('useLocalStorage read error:', error)
      return initialValue
    }
  })

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      logger.error('useLocalStorage write error:', error)
    }
  }, [key, storedValue])

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
      setStoredValue(initialValue)
    } catch (error) {
      logger.error('useLocalStorage remove error:', error)
    }
  }, [key, initialValue])

  return [storedValue, setValue, removeValue]
}

// ============================================
// 8. MEDIA QUERY HOOK
// ============================================

/**
 * useMediaQuery - Hook for responsive breakpoints
 */
export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches
    }
    return false
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    
    const handleChange = (e) => {
      setMatches(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [query])

  return matches
}

/**
 * useBreakpoint - Hook for Tailwind breakpoints
 */
export const useBreakpoint = (breakpoint) => {
  const breakpoints = {
    sm: '(min-width: 640px)',
    md: '(min-width: 768px)',
    lg: '(min-width: 1024px)',
    xl: '(min-width: 1280px)',
    '2xl': '(min-width: 1536px)',
  }

  return useMediaQuery(breakpoints[breakpoint])
}

// ============================================
// 9. INTERVAL HOOK
// ============================================

/**
 * useInterval - Hook for recurring tasks
 */
export const useInterval = (callback, delay = null) => {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (delay === null) return

    const id = setInterval(() => savedCallback.current(), delay)
    return () => clearInterval(id)
  }, [delay])
}

// ============================================
// 10. DOCUMENT TITLE HOOK
// ============================================

/**
 * useDocumentTitle - Hook for page titles
 */
export const useDocumentTitle = (title) => {
  useEffect(() => {
    const baseTitle = import.meta.env.VITE_APP_NAME || 'قطوف - Qotoof'
    document.title = title ? `${title} - ${baseTitle}` : baseTitle
  }, [title])
}

// ============================================
// 11. CONFIRMATION DIALOG HOOK
// ============================================

/**
 * useConfirmation - Hook for confirmation dialogs
 */
export const useConfirmation = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState({})
  const resolveRef = useRef(null)

  const confirm = useCallback((config = {}) => {
    setConfig(config)
    setIsOpen(true)

    return new Promise((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const handleResponse = useCallback((response) => {
    if (resolveRef.current) {
      resolveRef.current(response)
      resolveRef.current = null
    }
    setIsOpen(false)
  }, [])

  return {
    isOpen,
    config,
    confirm,
    handleResponse,
  }
}

// ============================================
// Default export
// ============================================
export default {
  useFetch,
  useSupabaseQuery,
  useSupabaseSingle,
  usePagination,
  useForm,
  useModal,
  useToast,
  useClipboard,
  useLocalStorage,
  useMediaQuery,
  useBreakpoint,
  useInterval,
  useDocumentTitle,
  useConfirmation,
}
