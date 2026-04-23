import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  MagnifyingGlassIcon,
  ShoppingBagIcon,
  ClockIcon,
  CheckCircleIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  ChevronRightIcon,
  MapPinIcon,
  CalendarIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'
import { supabase } from '@/services/supabase'
import { Card } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import { formatPrice } from '@/utils/currency'
import { sanitizeText, sanitizePhone, detectXSS, detectSQLInjection } from '@/utils/sanitization'
import { orderTrackingSchema } from '@/utils/validationSchemas'
import { checkOrderTrackingRate, RateLimitError } from '@/utils/rateLimiter'
import { generateDeviceFingerprint } from '@/utils/encryption'
import { logger } from '@/utils/logger'
import { APP_CONFIG } from '@/config/appConfig'
import toast from 'react-hot-toast'

// ============================================================
// STATUS CONFIGURATION
// ============================================================
const STATUS_CONFIG = {
  pending: {
    label: 'orderTracking.status.pending',
    labelDefault: 'Order Placed',
    color: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    icon: ShoppingBagIcon,
  },
  confirmed: {
    label: 'orderTracking.status.confirmed',
    labelDefault: 'Confirmed',
    color: 'bg-blue-100 text-blue-800 border border-blue-200',
    icon: CheckCircleIcon,
  },
  preparing: {
    label: 'orderTracking.status.preparing',
    labelDefault: 'Preparing',
    color: 'bg-purple-100 text-purple-800 border border-purple-200',
    icon: ClockIcon,
  },
  shipped: {
    label: 'orderTracking.status.shipped',
    labelDefault: 'On the Way',
    color: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    icon: TruckIcon,
  },
  on_the_way: {
    label: 'orderTracking.status.shipped',
    labelDefault: 'On the Way',
    color: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    icon: TruckIcon,
  },
  delivered: {
    label: 'orderTracking.status.delivered',
    labelDefault: 'Delivered',
    color: 'bg-green-100 text-green-800 border border-green-200',
    icon: CheckCircleSolid,
  },
  cancelled: {
    label: 'orderTracking.status.cancelled',
    labelDefault: 'Cancelled',
    color: 'bg-red-100 text-red-800 border border-red-200',
    icon: XMarkIcon,
  },
  vendor_accepted: {
    label: 'orderTracking.status.vendor_accepted',
    labelDefault: 'Accepted',
    color: 'bg-blue-100 text-blue-800 border border-blue-200',
    icon: CheckCircleIcon,
  },
  vendor_rejected: {
    label: 'orderTracking.status.vendor_rejected',
    labelDefault: 'Rejected',
    color: 'bg-red-100 text-red-800 border border-red-200',
    icon: XMarkIcon,
  },
  driver_assigned: {
    label: 'orderTracking.status.driver_assigned',
    labelDefault: 'Driver Assigned',
    color: 'bg-purple-100 text-purple-800 border border-purple-200',
    icon: TruckIcon,
  },
  driver_accepted: {
    label: 'orderTracking.status.driver_accepted',
    labelDefault: 'Driver Accepted',
    color: 'bg-purple-100 text-purple-800 border border-purple-200',
    icon: CheckCircleIcon,
  },
  driver_picked_up: {
    label: 'orderTracking.status.driver_picked_up',
    labelDefault: 'Picked Up',
    color: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    icon: TruckIcon,
  },
  awaiting_driver: {
    label: 'orderTracking.status.awaiting_driver',
    labelDefault: 'Awaiting Driver',
    color: 'bg-orange-100 text-orange-800 border border-orange-200',
    icon: ClockIcon,
  },
}

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================
const SEARCH_HISTORY_KEY = 'qotoof_tracking_history'
const MAX_HISTORY = 5

const getSearchHistory = () => {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const saveToHistory = (entry) => {
  try {
    const history = getSearchHistory()
    // Mask phone number before storing for privacy
    const maskedEntry = {
      ...entry,
      phone: entry.phone ? maskPhone(entry.phone) : null,
      timestamp: Date.now(),
    }
    // Remove duplicate
    const filtered = history.filter(
      (h) => !(h.orderNumber === entry.orderNumber && h.phone === entry.phone)
    )
    // Add to front
    filtered.unshift(maskedEntry)
    // Keep only last N
    const trimmed = filtered.slice(0, MAX_HISTORY)
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed))
  } catch (err) {
    logger.warn('Failed to save search history:', err)
  }
}

const maskPhone = (phone) => {
  if (!phone || phone.length < 6) return phone
  return phone.slice(0, 3) + '***' + phone.slice(-2)
}

const clearSearchHistory = () => {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY)
  } catch {
    // ignore
  }
}

// ============================================================
// DEBOUNCE HOOK
// ============================================================
const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// ============================================================
// MAIN COMPONENT
// ============================================================
const Tracking = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  // Form state
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState({ orderNumber: '', phone: '', general: '' })
  const [touched, setTouched] = useState({ orderNumber: false, phone: false })

  // Search state
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState(null)
  const [searchPerformed, setSearchPerformed] = useState(false)

  // History state
  const [searchHistory, setSearchHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  // Refs
  const formRef = useRef(null)
  const orderInputRef = useRef(null)
  const phoneInputRef = useRef(null)

  // Load search history on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory())
  }, [])

  // ============================================================
  // REAL-TIME VALIDATION (debounced)
  // ============================================================
  const debouncedOrderNumber = useDebounce(orderNumber, 400)
  const debouncedPhone = useDebounce(phone, 400)

  useEffect(() => {
    if (!touched.orderNumber || !debouncedOrderNumber) {
      if (!touched.orderNumber) return
      setErrors((prev) => ({ ...prev, orderNumber: '' }))
      return
    }

    // Security checks
    if (detectXSS(debouncedOrderNumber)) {
      setErrors((prev) => ({
        ...prev,
        orderNumber: t('orderTracking.validation.xssDetected', 'Invalid characters detected'),
      }))
      return
    }
    if (detectSQLInjection(debouncedOrderNumber)) {
      setErrors((prev) => ({
        ...prev,
        orderNumber: t('orderTracking.validation.sqlDetected', 'Invalid characters detected'),
      }))
      return
    }

    // Format validation
    const cleaned = sanitizeText(debouncedOrderNumber, { maxLength: 30 }).toUpperCase()
    if (cleaned.length < 3) {
      setErrors((prev) => ({
        ...prev,
        orderNumber: t('orderTracking.validation.orderNumber.min', 'Order number is too short'),
      }))
    } else if (!/^[A-Z0-9-]+$/.test(cleaned)) {
      setErrors((prev) => ({
        ...prev,
        orderNumber: t('orderTracking.validation.orderNumber.format', 'Order number can only contain letters, numbers, and hyphens'),
      }))
    } else {
      setErrors((prev) => ({ ...prev, orderNumber: '' }))
    }
  }, [debouncedOrderNumber, touched.orderNumber, t])

  useEffect(() => {
    if (!touched.phone || !debouncedPhone) {
      if (!touched.phone) return
      setErrors((prev) => ({ ...prev, phone: '' }))
      return
    }

    const cleaned = sanitizePhone(debouncedPhone)
    if (!cleaned && debouncedPhone.trim()) {
      setErrors((prev) => ({
        ...prev,
        phone: t('orderTracking.validation.phone.format', 'Enter a valid Moroccan phone number (e.g., +212612345678)'),
      }))
    } else {
      setErrors((prev) => ({ ...prev, phone: '' }))
    }
  }, [debouncedPhone, touched.phone, t])

  // ============================================================
  // FIELD HANDLERS
  // ============================================================
  const handleOrderNumberChange = (e) => {
    const value = e.target.value
    setOrderNumber(value)
    setTouched((prev) => ({ ...prev, orderNumber: true }))
    if (errors.orderNumber) setErrors((prev) => ({ ...prev, orderNumber: '' }))
  }

  const handlePhoneChange = (e) => {
    const value = e.target.value
    setPhone(value)
    setTouched((prev) => ({ ...prev, phone: true }))
    if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }))
  }

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  // ============================================================
  // SEARCH HANDLER
  // ============================================================
  const handleSearch = useCallback(async (e) => {
    e?.preventDefault()
    setErrors({ orderNumber: '', phone: '', general: '' })
    setResult(null)

    // Sanitize inputs
    const sanitizedOrderNumber = sanitizeText(orderNumber, { maxLength: 30 }).toUpperCase()
    const sanitizedPhone = sanitizePhone(phone)

    // Validate with Zod
    const validationResult = orderTrackingSchema.safeParse({
      orderNumber: sanitizedOrderNumber,
      phone: sanitizedPhone,
    })

    if (!validationResult.success) {
      const errors = validationResult.error.errors || []
      const fieldErrors = errors.reduce((acc, err) => {
        const field = err.path[0]
        if (!acc[field]) acc[field] = err.message
        return acc
      }, {})

      setErrors((prev) => ({ ...prev, ...fieldErrors }))
      return
    }

    const { orderNumber: validatedOrder, phone: validatedPhone } = validationResult.data

    // RATE LIMITING CHECK FIRST - before any API calls
    try {
      const deviceFingerprint = generateDeviceFingerprint()
      const rateResult = checkOrderTrackingRate(deviceFingerprint)

      if (!rateResult.allowed) {
        const retryMinutes = Math.ceil(rateResult.retryAfter / 60000)
        setErrors((prev) => ({
          ...prev,
          general: t('orderTracking.errors.rateLimited', 'Too many attempts. Please wait {{minutes}} minutes before trying again.', {
            minutes: retryMinutes,
          }),
        }))
        return
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        setErrors((prev) => ({
          ...prev,
          general: t('orderTracking.errors.rateLimited', 'Too many attempts. Please wait before trying again.'),
        }))
        return
      }
    }

    // SECURITY: Phone search requires BOTH order number AND phone for verification
    // This prevents anyone from tracking orders by knowing just a phone number
    if (validatedPhone && !validatedOrder) {
      setErrors((prev) => ({
        ...prev,
        general: t('orderTracking.errors.phoneAlone', 'Please enter both order number and phone number for security.'),
      }))
      return
    }

    // Perform search
    setSearching(true)
    setSearchPerformed(true)

    try {
      let buyerId = null

      // If both provided, verify they match
      if (validatedPhone && validatedOrder) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', validatedPhone)
          .maybeSingle()

        if (profileData) {
          buyerId = profileData.id
        } else {
          // No profile found with this phone number
          setResult({ type: 'not_found', searchedOrder: validatedOrder, searchedPhone: validatedPhone })
          saveToHistory({ orderNumber: validatedOrder, phone: validatedPhone })
          setSearching(false)
          return
        }
      }

      // MINIMAL DATA QUERY: Only return essential tracking info
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          buyer_total,
          created_at,
          shipping_city
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(10)

      if (validatedOrder) {
        query = query.eq('order_number', validatedOrder)
      }

      // If phone provided, require BOTH order number AND buyer_id match
      if (buyerId && validatedOrder) {
        query = query.eq('buyer_id', buyerId)
      }

      const { data, error: supabaseError } = await query

      if (supabaseError) throw supabaseError

      if (data && data.length > 0) {
        // Found order(s) - get minimal item count only
        const order = data[0]

        // Get item count without full product details
        const { count: itemCount } = await supabase
          .from('order_items')
          .select('*', { count: 'exact', head: true })
          .eq('order_id', order.id)

        // Attach minimal item info
        order.item_count = itemCount || 0

        setResult({ type: 'found', order })
        saveToHistory({ orderNumber: validatedOrder, phone: validatedPhone })
        toast.success(t('orderTracking.notifications.found', 'Order found!'))
      } else {
        // Not found
        setResult({ type: 'not_found', searchedOrder: validatedOrder, searchedPhone: validatedPhone })
        saveToHistory({ orderNumber: validatedOrder, phone: validatedPhone })
      }
    } catch (err) {
      logger.error('Order tracking search error:', err)
      setResult({ type: 'error' })
      setErrors((prev) => ({
        ...prev,
        general: t('orderTracking.errors.searchFailed', 'Failed to search. Please try again.'),
      }))
    } finally {
      setSearching(false)
    }
  }, [orderNumber, phone, t])

  // ============================================================
  // HISTORY CLICK HANDLER
  // ============================================================
  const handleHistoryClick = useCallback((entry) => {
    if (entry.orderNumber) setOrderNumber(entry.orderNumber)
    if (entry.phone) setPhone(entry.phone)
    setShowHistory(false)
    // Auto-submit
    setTimeout(() => {
      handleSearch()
    }, 100)
  }, [handleSearch])

  // ============================================================
  // TRACK ANOTHER ORDER
  // ============================================================
  const handleTrackAnother = useCallback(() => {
    setResult(null)
    setSearchPerformed(false)
    setOrderNumber('')
    setPhone('')
    setErrors({ orderNumber: '', phone: '', general: '' })
    setTouched({ orderNumber: false, phone: false })
    setTimeout(() => orderInputRef.current?.focus(), 100)
  }, [])

  // ============================================================
  // VIEW FULL TRACKING
  // ============================================================
  const handleViewFullTracking = useCallback((orderId) => {
    navigate(`/orders/${orderId}/tracking`)
  }, [navigate])

  // ============================================================
  // FORMAT DATE
  // ============================================================
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString(i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'fr' ? 'fr-MA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-gray-50" dir={i18n.dir()}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* ============================================================
            HEADER
            ============================================================ */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg shadow-green-200 mb-4">
            <MagnifyingGlassIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            {t('orderTracking.title', 'Track Your Order')}
          </h1>
          <p className="text-gray-500 text-sm sm:text-base max-w-md mx-auto">
            {t(
              'orderTracking.subtitle',
              'Enter your order number or registered phone number to check the status of your delivery.'
            )}
          </p>
        </div>

        {/* ============================================================
            SEARCH FORM
            ============================================================ */}
        <Card className="p-5 sm:p-7 bg-white shadow-xl shadow-gray-100/50 border border-gray-100 rounded-2xl mb-6">
          <form ref={formRef} onSubmit={handleSearch} noValidate>
            {/* Order Number Field */}
            <div className="mb-5">
              <label
                htmlFor="orderNumber"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                {t('orderTracking.form.orderNumber.label', 'Order Number')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <ShoppingBagIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  ref={orderInputRef}
                  id="orderNumber"
                  type="text"
                  inputMode="text"
                  value={orderNumber}
                  onChange={handleOrderNumberChange}
                  onBlur={() => handleBlur('orderNumber')}
                  placeholder={t('orderTracking.form.orderNumber.placeholder', 'e.g., ORD-20240101-00001')}
                  className={`w-full pl-12 pr-4 py-3.5 text-base border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-0 min-h-[56px] ${
                    errors.orderNumber && touched.orderNumber
                      ? 'border-red-300 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 bg-gray-50 focus:border-green-500 focus:bg-white'
                  }`}
                  autoComplete="off"
                  aria-describedby={errors.orderNumber ? 'orderNumber-error' : 'orderNumber-hint'}
                  aria-invalid={!!errors.orderNumber}
                />
              </div>
              {errors.orderNumber && touched.orderNumber ? (
                <p id="orderNumber-error" className="mt-2 text-sm text-red-600 flex items-center gap-1.5" role="alert">
                  <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                  {errors.orderNumber}
                </p>
              ) : (
                <p id="orderNumber-hint" className="mt-2 text-xs text-gray-400 flex items-center gap-1.5">
                  <InformationCircleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  {t('orderTracking.form.orderNumber.hint', 'Find your order number in the confirmation email')}
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {t('orderTracking.form.or', 'OR')}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Phone Field */}
            <div className="mb-6">
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-gray-700 mb-2"
              >
                {t('orderTracking.form.phone.label', 'Phone Number')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <PhoneIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  ref={phoneInputRef}
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  onBlur={() => handleBlur('phone')}
                  placeholder={t('orderTracking.form.phone.placeholder', '+212 6XX-XXXXXX')}
                  className={`w-full pl-12 pr-4 py-3.5 text-base border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-0 min-h-[56px] ${
                    errors.phone && touched.phone
                      ? 'border-red-300 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 bg-gray-50 focus:border-green-500 focus:bg-white'
                  }`}
                  autoComplete="tel"
                  aria-describedby={errors.phone ? 'phone-error' : 'phone-hint'}
                  aria-invalid={!!errors.phone}
                />
              </div>
              {errors.phone && touched.phone ? (
                <p id="phone-error" className="mt-2 text-sm text-red-600 flex items-center gap-1.5" role="alert">
                  <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                  {errors.phone}
                </p>
              ) : (
                <p id="phone-hint" className="mt-2 text-xs text-gray-400 flex items-center gap-1.5">
                  <InformationCircleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  {t('orderTracking.form.phone.hint', 'Use the same phone number you registered with')}
                </p>
              )}
            </div>

            {/* General Error */}
            {errors.general && (
              <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl" role="alert">
                <div className="flex items-start gap-2.5">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{errors.general}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={searching}
              className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-base rounded-xl hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-4 focus:ring-green-200 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-green-200/50 hover:shadow-xl hover:shadow-green-300/50 min-h-[56px]"
            >
              {searching ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('orderTracking.form.searching', 'Searching...')}
                </>
              ) : (
                <>
                  <MagnifyingGlassIcon className="w-5 h-5" />
                  {t('orderTracking.form.submit', 'Track Order')}
                </>
              )}
            </button>
          </form>

          {/* Search History */}
          {searchHistory.length > 0 && !searchPerformed && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ClockIcon className="w-3.5 h-3.5" />
                {t('orderTracking.form.recentSearches', 'Recent searches')}
                {showHistory ? (
                  <ChevronRightIcon className="w-3 h-3 rotate-90 transition-transform" />
                ) : (
                  <ChevronRightIcon className="w-3 h-3 -rotate-90 transition-transform" />
                )}
              </button>
              {showHistory && (
                <div className="mt-3 space-y-2">
                  {searchHistory.map((entry, index) => (
                    <button
                      key={index}
                      onClick={() => handleHistoryClick(entry)}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                    >
                      <div className="min-w-0">
                        {entry.orderNumber && (
                          <p className="text-sm font-medium text-gray-700 truncate">{entry.orderNumber}</p>
                        )}
                        {entry.phone && (
                          <p className="text-xs text-gray-400">{entry.phone}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {new Date(entry.timestamp).toLocaleDateString(i18n.language === 'ar' ? 'ar-MA' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </button>
                  ))}
                  <button
                    onClick={clearSearchHistory}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors py-1"
                  >
                    {t('orderTracking.form.clearHistory', 'Clear history')}
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ============================================================
            RESULTS AREA
            ============================================================ */}
        {searching && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-green-200 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-green-600 rounded-full border-t-transparent animate-spin" />
            </div>
            <p className="mt-4 text-gray-500 text-sm">
              {t('orderTracking.results.searching', 'Looking for your order...')}
            </p>
          </div>
        )}

        {/* ============================================================
            ORDER FOUND
            ============================================================ */}
        {!searching && result?.type === 'found' && result.order && (
          <div className="animate-fade-in">
            {/* Success Header */}
            <Card className="bg-white shadow-xl shadow-gray-100/50 border border-gray-100 rounded-2xl overflow-hidden mb-6">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-5 sm:p-6 text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <CheckCircleSolid className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">
                      {t('orderTracking.results.found.title', 'Order Found!')}
                    </h2>
                    <p className="text-green-100 text-sm">
                      {result.order.order_number || result.order.id?.slice(0, 8)}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const config = STATUS_CONFIG[result.order.status] || STATUS_CONFIG.pending
                    const Icon = config.icon
                    return (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold">
                        <Icon className="w-4 h-4" />
                        {t(config.label, config.labelDefault)}
                      </span>
                    )
                  })()}
                </div>
              </div>

              {/* Order Summary */}
              <div className="p-5 sm:p-6">
                {/* Quick Info Grid */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {t('orderTracking.results.found.orderDate', 'Order Date')}
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {formatDate(result.order.created_at)}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <BanknotesIcon className="w-3.5 h-3.5" />
                      {t('orderTracking.results.found.total', 'Total')}
                    </div>
                    <p className="text-sm font-bold text-green-600">
                      {formatPrice(result.order.buyer_total || result.order.total)}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl col-span-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <MapPinIcon className="w-3.5 h-3.5" />
                      {t('orderTracking.results.found.city', 'City')}
                    </div>
                    <p className="text-sm font-semibold text-gray-900">
                      {result.order.shipping_city || '—'}
                    </p>
                  </div>
                </div>

                {/* Item Count (instead of full item details) */}
                {result.order.item_count > 0 && (
                  <div className="mb-5 p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <ShoppingBagIcon className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">
                        {t('orderTracking.results.found.itemCount', '{{count}} item(s) in order', {
                          count: result.order.item_count,
                        })}
                      </span>
                    </div>
                  </div>
                )}

                {/* View Full Tracking Button */}
                <button
                  onClick={() => handleViewFullTracking(result.order.id)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-base rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg shadow-green-200/50 hover:shadow-xl hover:shadow-green-300/50 min-h-[56px]"
                >
                  {t('orderTracking.results.found.viewFull', 'View Full Tracking')}
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
            </Card>

            {/* Track Another Order */}
            <div className="text-center">
              <button
                onClick={handleTrackAnother}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-colors min-h-[48px]"
              >
                <ArrowPathIcon className="w-4 h-4" />
                {t('orderTracking.actions.trackAnother', 'Track Another Order')}
              </button>
            </div>
          </div>
        )}

        {/* ============================================================
            ORDER NOT FOUND
            ============================================================ */}
        {!searching && result?.type === 'not_found' && (
          <div className="animate-fade-in">
            <Card className="bg-white shadow-xl shadow-gray-100/50 border border-gray-100 rounded-2xl overflow-hidden mb-6">
              <div className="p-6 sm:p-8 text-center">
                {/* Warning Icon */}
                <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
                  <ExclamationTriangleIcon className="w-8 h-8 text-yellow-600" />
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {t('orderTracking.results.notFound.title', 'Order Not Found')}
                </h2>
                <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                  {t(
                    'orderTracking.results.notFound.desc',
                    'We couldn\'t find an order matching your search. Please check the details and try again.'
                  )}
                </p>

                {/* Search Summary */}
                {(result.searchedOrder || result.searchedPhone) && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-xl text-left">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {t('orderTracking.results.notFound.searchedFor', 'Searched For')}
                    </p>
                    {result.searchedOrder && (
                      <p className="text-sm text-gray-700 flex items-center gap-2">
                        <ShoppingBagIcon className="w-4 h-4 text-gray-400" />
                        {result.searchedOrder}
                      </p>
                    )}
                    {result.searchedPhone && (
                      <p className="text-sm text-gray-700 flex items-center gap-2 mt-1">
                        <PhoneIcon className="w-4 h-4 text-gray-400" />
                        {result.searchedPhone}
                      </p>
                    )}
                  </div>
                )}

                {/* Suggestions */}
                <div className="mb-6 text-left">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    {t('orderTracking.results.notFound.suggestions', 'What you can try')}
                  </h3>
                  <ul className="space-y-2.5">
                    <li className="flex items-start gap-2.5 text-sm text-gray-600">
                      <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {t('orderTracking.results.notFound.tips.orderNumber', 'Double-check your order number from the confirmation email')}
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-gray-600">
                      <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {t('orderTracking.results.notFound.tips.phone', 'Make sure you\'re using the same phone number you registered with')}
                    </li>
                    <li className="flex items-start gap-2.5 text-sm text-gray-600">
                      <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {t('orderTracking.results.notFound.tips.email', 'Check your email inbox for the order confirmation')}
                    </li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleTrackAnother}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-200/50 min-h-[48px]"
                  >
                    <MagnifyingGlassIcon className="w-5 h-5" />
                    {t('orderTracking.actions.tryAgain', 'Try Again')}
                  </button>
                  <a
                    href={`mailto:${APP_CONFIG.supportEmail}`}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors min-h-[48px]"
                  >
                    <EnvelopeIcon className="w-5 h-5" />
                    {t('orderTracking.actions.contactSupport', 'Contact Support')}
                  </a>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ============================================================
            SEARCH ERROR
            ============================================================ */}
        {!searching && result?.type === 'error' && (
          <div className="animate-fade-in">
            <Card className="bg-white shadow-xl shadow-gray-100/50 border border-red-200 rounded-2xl overflow-hidden mb-6">
              <div className="p-6 sm:p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                  <XMarkIcon className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {t('orderTracking.results.error.title', 'Search Failed')}
                </h2>
                <p className="text-gray-500 mb-6">
                  {t('orderTracking.results.error.desc', 'An error occurred while searching for your order. Please try again later.')}
                </p>
                <button
                  onClick={handleTrackAnother}
                  className="inline-flex items-center gap-2 px-6 py-3.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors min-h-[48px]"
                >
                  <ArrowPathIcon className="w-5 h-5" />
                  {t('common.tryAgain', 'Try Again')}
                </button>
              </div>
            </Card>
          </div>
        )}

        {/* ============================================================
            HELP SECTION (shown when no results)
            ============================================================ */}
        {!searchPerformed && !searching && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5 bg-white border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                <ShoppingBagIcon className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                {t('orderTracking.help.step1.title', 'Enter Order Number')}
              </h3>
              <p className="text-xs text-gray-500">
                {t('orderTracking.help.step1.desc', 'Find it in your confirmation email or account order history')}
              </p>
            </Card>

            <Card className="p-5 bg-white border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                <PhoneIcon className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                {t('orderTracking.help.step2.title', 'Or Use Phone Number')}
              </h3>
              <p className="text-xs text-gray-500">
                {t('orderTracking.help.step2.desc', 'Enter the Moroccan phone number you used when placing the order')}
              </p>
            </Card>

            <Card className="p-5 bg-white border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                <TruckIcon className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1">
                {t('orderTracking.help.step3.title', 'Track Delivery')}
              </h3>
              <p className="text-xs text-gray-500">
                {t('orderTracking.help.step3.desc', 'View real-time status and full tracking details of your order')}
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const TrackingWithErrorBoundary = () => (
  <ErrorBoundary componentName="TrackingPage">
    <Tracking />
  </ErrorBoundary>
)

export default TrackingWithErrorBoundary
