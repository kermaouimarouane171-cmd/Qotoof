import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner, Input, DriverSelection, NoDriverAvailable, LocationPicker } from '@/components/ui'
import PaymentTypeSelector from '@/components/checkout/PaymentTypeSelector'
import OrderSummary from '@/components/checkout/OrderSummary'
import { TruckIcon, ChevronRightIcon, MapPinIcon, ClockIcon, BanknotesIcon, BuildingLibraryIcon, CheckIcon } from '@heroicons/react/24/outline'
import { formatPrice } from '@/utils/currency'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { couponsApi, calculateBulkDiscountBreakdown, calculateCouponDiscountAmount } from '@/services/coupons'
import deliveryScheduleService, { buildDeliveryScheduleSnapshot } from '@/services/deliveryScheduleService'
import { platformSettings } from '@/services/platformSettings'
import { calculateShippingCost, getEstimatedDeliveryTime } from '@/services/shippingCalculator'
import deliveryMatchingService, { DRIVER_SELECT, getDriverSupportedPaymentMethods } from '@/services/deliveryMatchingService'
import storeTypeService from '@/services/storeTypeService'
import trustScoreService from '@/services/trustScoreService'
import { logger } from '@/utils/logger'
import { buildMinimumOrderMessage, evaluateVendorMinimumOrders } from '@/services/minimumOrderService'
import { getPayPalClientId } from '@/lib/config'
import { emailService } from '@/services/emailService'

const toAmount = (value) => Number(Number(value || 0).toFixed(2))
const todayDateValue = () => new Date().toISOString().slice(0, 10)

const CheckoutSimplified = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { items, getSubtotal, clearCart } = useCartStore()

  // Calculate totals using useMemo for performance
  const subtotal = useMemo(() => getSubtotal(), [getSubtotal])
  const [shippingCost, setShippingCost] = useState(0)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shippingInfo_data, setShippingInfoData] = useState(null)
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState(todayDateValue)
  const [availableDeliverySlots, setAvailableDeliverySlots] = useState([])
  const [selectedDeliverySlotId, setSelectedDeliverySlotId] = useState(null)
  const [loadingDeliverySlots, setLoadingDeliverySlots] = useState(false)
  const [paymentType, setPaymentType] = useState('full')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(getPayPalClientId() ? 'paypal' : 'bank')
  const [selectedBank, setSelectedBank] = useState(null)
  const [paymentTermsAccepted, setPaymentTermsAccepted] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [availableDrivers, setAvailableDrivers] = useState([])
  const [preferredDriverProfile, setPreferredDriverProfile] = useState(null)
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [noDriversAvailable, setNoDriversAvailable] = useState(false)
  const [vendorLocation, setVendorLocation] = useState(null)
  const [vendorStoreProfile, setVendorStoreProfile] = useState(null)
  const [cartVendorMinimumProfiles, setCartVendorMinimumProfiles] = useState([])
  const [platformCommissionRate, setPlatformCommissionRate] = useState(2.0)
  const [cartVendorPaymentPolicies, setCartVendorPaymentPolicies] = useState([])
  const [codEligibility, setCodEligibility] = useState({ eligible: false, reason: '' })
  const [cargoSize, setCargoSize] = useState('medium')
  const [driverDeliveryPaymentMethod, setDriverDeliveryPaymentMethod] = useState('cash')
  const [shippingInfo, setShippingInfo] = useState({
    fullName: profile?.first_name ? `${profile.first_name} ${profile.last_name}` : '',
    phone: profile?.phone || '',
    address: profile?.address || '',
    city: profile?.city || '',
    notes: '',
  })
  const [deliveryLocation, setDeliveryLocation] = useState({
    lat: profile?.latitude || null,
    lng: profile?.longitude || null,
  })
  const [errors, setErrors] = useState({})

  const hasSingleVendorCart = useMemo(() => new Set(items.map((item) => item.vendor_id)).size === 1, [items])
  const paypalEnabled = useMemo(
    () => Boolean(getPayPalClientId()) && hasSingleVendorCart,
    [hasSingleVendorCart]
  )
  const paypalUnavailableReason = useMemo(() => {
    if (paypalEnabled) return ''
    if (!getPayPalClientId()) return 'PayPal غير مفعّل بعد في إعدادات البيئة.'
    if (!hasSingleVendorCart) return 'PayPal متاح حالياً لطلبات متجر واحد فقط.'
    return 'PayPal غير متاح حالياً.'
  }, [hasSingleVendorCart, paypalEnabled])

  const vendorStoreSetup = useMemo(
    () => storeTypeService.decorateStoreProfile(vendorStoreProfile),
    [vendorStoreProfile]
  )

  const vendorDeliveryStrategy = useMemo(
    () => storeTypeService.resolveOrderDeliveryStrategy(vendorStoreProfile, hasSingleVendorCart ? selectedDriver : null),
    [hasSingleVendorCart, selectedDriver, vendorStoreProfile]
  )

  const hasPreferredDriverAutoAssignment = useMemo(
    () => Boolean(
      hasSingleVendorCart &&
      vendorDeliveryStrategy?.deliveryOption === 'own_driver' &&
      vendorDeliveryStrategy?.assignedDriverId
    ),
    [hasSingleVendorCart, vendorDeliveryStrategy?.assignedDriverId, vendorDeliveryStrategy?.deliveryOption]
  )

  const canManuallySelectDriver = hasSingleVendorCart && vendorDeliveryStrategy?.deliveryOption === 'find_driver'

  // Coupon state
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [bulkDiscountCandidates, setBulkDiscountCandidates] = useState([])
  const [couponLoading, setCouponLoading] = useState(false)
  const cartVendorIds = useMemo(
    () => Array.from(new Set(items.map((item) => item.vendor_id).filter(Boolean))),
    [items]
  )
  const vendorMinimumStatus = useMemo(
    () => evaluateVendorMinimumOrders({ items, vendorProfiles: cartVendorMinimumProfiles }),
    [cartVendorMinimumProfiles, items]
  )
  const selectedDeliverySlot = useMemo(
    () => availableDeliverySlots.find((slot) => slot.id === selectedDeliverySlotId) || null,
    [availableDeliverySlots, selectedDeliverySlotId]
  )
  const bulkDiscountBreakdown = useMemo(
    () => calculateBulkDiscountBreakdown({ coupons: bulkDiscountCandidates, items }),
    [bulkDiscountCandidates, items]
  )
  const bulkDiscount = useMemo(
    () => toAmount(bulkDiscountBreakdown.totalDiscount),
    [bulkDiscountBreakdown.totalDiscount]
  )
  const discountedSubtotal = useMemo(
    () => Math.max(toAmount(subtotal - bulkDiscount), 0),
    [bulkDiscount, subtotal]
  )
  const couponDiscount = useMemo(() => {
    if (!appliedCoupon) return 0
    return calculateCouponDiscountAmount({
      coupon: appliedCoupon,
      subtotal: discountedSubtotal,
    })
  }, [appliedCoupon, discountedSubtotal])
  const netSubtotal = useMemo(
    () => Math.max(toAmount(subtotal - bulkDiscount - couponDiscount), 0),
    [bulkDiscount, couponDiscount, subtotal]
  )
  const activeBulkOffers = useMemo(
    () => Object.values(bulkDiscountBreakdown.offersByVendor || {}),
    [bulkDiscountBreakdown.offersByVendor]
  )
  const platformFee = useMemo(
    () => toAmount(netSubtotal * (platformCommissionRate / 100)),
    [netSubtotal, platformCommissionRate]
  )
  const productPaymentTotal = useMemo(
    () => toAmount(netSubtotal + platformFee),
    [netSubtotal, platformFee]
  )
  const total = useMemo(
    () => toAmount(productPaymentTotal + shippingCost),
    [productPaymentTotal, shippingCost]
  )
  const isShippingUnavailable = shippingInfo_data?.available === false
  const shippingBlockingReason = shippingInfo_data?.blockingReason || 'هذا العنوان خارج نطاق التوصيل الحالي.'
  const canContinueToPayment = !vendorMinimumStatus.hasViolations && !shippingLoading && !!shippingInfo_data && !isShippingUnavailable
  const availablePaymentTypes = useMemo(
    () => trustScoreService.resolveAvailablePaymentTypes({
      vendorPolicies: cartVendorPaymentPolicies,
      codEligibility,
    }),
    [cartVendorPaymentPolicies, codEligibility]
  )
  const selectedDriverProfile = useMemo(
    () => availableDrivers.find((driver) => driver.id === selectedDriver) || null,
    [availableDrivers, selectedDriver]
  )
  const activeDeliveryDriverProfile = useMemo(
    () => (canManuallySelectDriver ? selectedDriverProfile : preferredDriverProfile),
    [canManuallySelectDriver, preferredDriverProfile, selectedDriverProfile]
  )
  const activeDriverSupportedPaymentMethods = useMemo(
    () => activeDeliveryDriverProfile ? getDriverSupportedPaymentMethods(activeDeliveryDriverProfile) : ['cash', 'bank_transfer'],
    [activeDeliveryDriverProfile]
  )

  // Load available drivers when reaching step 2
  useEffect(() => {
    if (step === 2 && items.length > 0 && canManuallySelectDriver) {
      loadAvailableDrivers()
      return
    }

    setAvailableDrivers([])
    setLoadingDrivers(false)
    setNoDriversAvailable(false)
  }, [canManuallySelectDriver, cargoSize, deliveryLocation.lat, deliveryLocation.lng, driverDeliveryPaymentMethod, items.length, step, vendorLocation?.lat, vendorLocation?.lon])

  useEffect(() => {
    let isMounted = true

    const loadBulkDiscounts = async () => {
      if (!cartVendorIds.length) {
        if (isMounted) setBulkDiscountCandidates([])
        return
      }

      try {
        const coupons = await couponsApi.getBulkDiscountCandidates(cartVendorIds)
        if (isMounted) {
          setBulkDiscountCandidates(coupons)
        }
      } catch (error) {
        logger.error('Failed to load bulk discount candidates:', error)
        if (isMounted) {
          setBulkDiscountCandidates([])
        }
      }
    }

    loadBulkDiscounts()

    return () => {
      isMounted = false
    }
  }, [cartVendorIds])

  // Load vendor location when items change
  useEffect(() => {
    if (items.length > 0 && items[0]?.vendor_id) {
      loadVendorLocation(items[0].vendor_id)
    }
  }, [items])

  useEffect(() => {
    let cancelled = false

    const loadDeliverySlots = async () => {
      if (!hasSingleVendorCart || !items[0]?.vendor_id || !requestedDeliveryDate) {
        if (!cancelled) {
          setAvailableDeliverySlots([])
          setSelectedDeliverySlotId(null)
        }
        return
      }

      try {
        setLoadingDeliverySlots(true)
        const slots = await deliveryScheduleService.getAvailableDeliverySlots({
          vendorId: items[0].vendor_id,
          requestedDate: requestedDeliveryDate,
        })

        if (!cancelled) {
          setAvailableDeliverySlots(slots)
          setSelectedDeliverySlotId((currentSlotId) => (
            slots.some((slot) => slot.id === currentSlotId && slot.available)
              ? currentSlotId
              : null
          ))
        }
      } catch (error) {
        logger.error('Failed to load delivery slots:', error)
        if (!cancelled) {
          setAvailableDeliverySlots([])
          setSelectedDeliverySlotId(null)
        }
      } finally {
        if (!cancelled) {
          setLoadingDeliverySlots(false)
        }
      }
    }

    loadDeliverySlots()

    return () => {
      cancelled = true
    }
  }, [hasSingleVendorCart, items, requestedDeliveryDate])

  useEffect(() => {
    let active = true

    const loadPaymentContext = async () => {
      if (!user?.id || cartVendorIds.length === 0) {
        if (active) {
          setCartVendorPaymentPolicies([])
          setCodEligibility({ eligible: false, reason: '' })
        }
        return
      }

      try {
        const [settings, vendorPolicies, buyerCodEligibility] = await Promise.all([
          platformSettings.getSettings(),
          trustScoreService.getVendorPaymentPolicies(cartVendorIds),
          trustScoreService.checkCodEligibility(user.id),
        ])

        if (!active) return

        setPlatformCommissionRate(settings?.commission_rate ?? 2.0)
        setCartVendorPaymentPolicies(vendorPolicies)
        setCodEligibility(buyerCodEligibility)
      } catch (error) {
        logger.error('Error loading checkout payment context:', error)

        if (active) {
          setCartVendorPaymentPolicies([])
          setCodEligibility({
            eligible: false,
            reason: 'تعذر تحميل أهلية الدفع عند الاستلام حالياً.',
          })
        }
      }
    }

    loadPaymentContext()

    return () => {
      active = false
    }
  }, [cartVendorIds, user?.id])

  useEffect(() => {
    let active = true

    const loadVendorMinimumProfiles = async () => {
      if (cartVendorIds.length === 0) {
        if (active) setCartVendorMinimumProfiles([])
        return
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, store_name, min_order_amount')
          .in('id', cartVendorIds)

        if (error) throw error
        if (active) setCartVendorMinimumProfiles(data || [])
      } catch (error) {
        logger.error('Error loading vendor minimum-order profiles:', error)
        if (active) setCartVendorMinimumProfiles([])
      }
    }

    loadVendorMinimumProfiles()

    return () => {
      active = false
    }
  }, [cartVendorIds])

  useEffect(() => {
    const nextPaymentType = ['full', 'split', 'cod'].find((type) => availablePaymentTypes[type])

    if (!nextPaymentType) {
      setPaymentType('')
      return
    }

    if (!availablePaymentTypes[paymentType]) {
      setPaymentType(nextPaymentType)
    }
  }, [availablePaymentTypes, paymentType])

  useEffect(() => {
    if (paymentType === 'cod') {
      setSelectedBank(null)
    }
  }, [paymentType])

  useEffect(() => {
    if (paymentType === 'cod') {
      return
    }

    if (selectedPaymentMethod === 'paypal' && !paypalEnabled) {
      setSelectedPaymentMethod('bank')
    }
  }, [paymentType, paypalEnabled, selectedPaymentMethod])

  useEffect(() => {
    if (selectedDriver && !availableDrivers.some((driver) => driver.id === selectedDriver)) {
      setSelectedDriver(null)
    }
  }, [availableDrivers, selectedDriver])

  useEffect(() => {
    if (!activeDeliveryDriverProfile || activeDriverSupportedPaymentMethods.length === 0) return
    if (!activeDriverSupportedPaymentMethods.includes(driverDeliveryPaymentMethod)) {
      setDriverDeliveryPaymentMethod(activeDriverSupportedPaymentMethods[0])
    }
  }, [activeDeliveryDriverProfile, activeDriverSupportedPaymentMethods, driverDeliveryPaymentMethod])

  const loadVendorLocation = async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('city, latitude, longitude, store_name, store_type, delivery_option, active_products_count, has_own_driver, preferred_driver_id, partnership_status')
        .eq('id', vendorId)
        .maybeSingle()

      if (error) throw error

      if (data) {
        setVendorStoreProfile(data)
        setVendorLocation({
          storeName: data.store_name,
          city: data.city,
          lat: data.latitude,
          lon: data.longitude,
          hasOwnDriver: Boolean(data.has_own_driver),
          preferredDriverId: data.preferred_driver_id || null,
          partnershipStatus: data.partnership_status || null,
        })

        if (data.preferred_driver_id) {
          const { data: preferredDriverData, error: preferredDriverError } = await supabase
            .from('profiles')
            .select(DRIVER_SELECT)
            .eq('id', data.preferred_driver_id)
            .maybeSingle()

          if (preferredDriverError) throw preferredDriverError
          setPreferredDriverProfile(preferredDriverData || null)
        } else {
          setPreferredDriverProfile(null)
        }

        if (data.delivery_option !== 'find_driver') {
          setSelectedDriver(null)
        }
      }
    } catch (error) {
      logger.error('Error loading vendor location:', error)
    }
  }

  const recalculateShipping = useCallback(async () => {
    if (!shippingInfo.city || items.length === 0) {
      setShippingCost(0)
      setShippingInfoData(null)
      setEstimatedDeliveryTime(null)
      return
    }

    setShippingLoading(true)

    try {
      // Use delivery location coordinates (from GPS or map picker)
      const buyerLat = deliveryLocation?.lat || null
      const buyerLon = deliveryLocation?.lng || null

      const result = await calculateShippingCost({
        vendorCity: vendorLocation?.city,
        vendorLat: vendorLocation?.lat,
        vendorLon: vendorLocation?.lon,
        buyerCity: shippingInfo.city,
        buyerLat,
        buyerLon,
        driverId: canManuallySelectDriver ? selectedDriver : null,
      })

      setShippingCost(result.cost)
      setShippingInfoData(result)
      setErrors((prev) => ({
        ...prev,
        shipping: result.available === false ? (result.blockingReason || 'هذا العنوان خارج نطاق التوصيل الحالي.') : null,
      }))

      // Calculate estimated delivery time
      if (result.available === false) {
        setEstimatedDeliveryTime(null)
      } else if (result.distance) {
        const estTime = getEstimatedDeliveryTime(result.distance)
        setEstimatedDeliveryTime(estTime)
      } else {
        setEstimatedDeliveryTime('45-60 min')
      }
    } catch (error) {
      logger.error('Error calculating shipping:', error)
      setShippingCost(0)
      setShippingInfoData({
        available: false,
        cost: 0,
        blockingReason: 'تعذر حساب رسوم التوصيل حالياً. يرجى إعادة تحديد العنوان أو المحاولة بعد قليل.',
      })
      setEstimatedDeliveryTime(null)
      setErrors((prev) => ({
        ...prev,
        shipping: 'تعذر حساب رسوم التوصيل حالياً. يرجى إعادة تحديد العنوان أو المحاولة بعد قليل.',
      }))
    } finally {
      setShippingLoading(false)
    }
  }, [canManuallySelectDriver, deliveryLocation?.lat, deliveryLocation?.lng, items, selectedDriver, shippingInfo.city, vendorLocation?.city, vendorLocation?.lat, vendorLocation?.lon])

  // Recalculate shipping when driver, city, or delivery location changes
  useEffect(() => {
    if (step >= 2 && shippingInfo.city && items.length > 0 && deliveryLocation.lat && deliveryLocation.lng) {
      recalculateShipping()
    }
  }, [recalculateShipping, step, shippingInfo.city, items.length, deliveryLocation.lat, deliveryLocation.lng])

  const loadAvailableDrivers = async () => {
    setLoadingDrivers(true)
    setNoDriversAvailable(false)
    try {
      const drivers = await deliveryMatchingService.getAvailableDriversForCheckout({
        vendorLocation,
        deliveryLocation,
        cargoSize,
        deliveryPaymentMethod: driverDeliveryPaymentMethod,
      })

      setAvailableDrivers(drivers)
      setNoDriversAvailable(drivers.length === 0)
    } catch (error) {
      logger.error('Error loading drivers:', error)
      setAvailableDrivers([])
      setNoDriversAvailable(true)
    } finally {
      setLoadingDrivers(false)
    }
  }

  // ============================================
  // Coupon Validation
  // ============================================

  const validateCoupon = async (code) => {
    if (!code.trim()) return
    setCouponLoading(true)
    try {
      const validation = await couponsApi.validateCoupon(
        code.toUpperCase().trim(),
        user.id,
        discountedSubtotal
      )

      if (!validation.valid) {
        toast.error(validation.error || 'تعذر التحقق من الكوبون')
        return
      }

      const coupon = validation.coupon
      setAppliedCoupon(coupon)
      toast.success(
        `تم تطبيق الكوبون ${coupon.code} بخصم ${coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `${Number(coupon.discount_value || 0).toFixed(2)} درهم`}`
      )
    } catch (err) {
      logger.error('Coupon validation error:', err)
      toast.error('فشل التحقق من الكوبون')
    } finally {
      setCouponLoading(false)
    }
  }

  if (!user) {
    navigate('/login', { state: { from: '/checkout' } })
    return null
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <TruckIcon className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{t('checkout.emptyCart')}</h2>
        <p className="text-gray-500 mb-6">{t('checkout.addProductsFirst')}</p>
        <button onClick={() => navigate('/marketplace')} className="btn-primary">
          {t('checkout.browseProducts')}
        </button>
      </div>
    )
  }

  const validateStep1 = () => {
    const newErrors = {}
    if (!shippingInfo.fullName.trim()) newErrors.fullName = 'الاسم مطلوب'
    if (!shippingInfo.phone.trim()) newErrors.phone = 'رقم الهاتف مطلوب'
    if (!shippingInfo.city.trim()) newErrors.city = 'المدينة مطلوبة'
    if (!shippingInfo.address.trim()) newErrors.address = 'العنوان مطلوب'
    if (!deliveryLocation.lat || !deliveryLocation.lng) {
      newErrors.location = 'يرجى تحديد موقعك الدقيق على الخريطة'
    }
    if (vendorMinimumStatus.hasViolations) {
      newErrors.minimumOrder = buildMinimumOrderMessage(vendorMinimumStatus.firstViolation)
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
    }
  }

  const handleContinueToPayment = () => {
    if (shippingLoading) {
      setErrors((prev) => ({
        ...prev,
        shipping: 'جاري حساب رسوم التوصيل. انتظر لحظة ثم أعد المحاولة.',
      }))
      return
    }

    if (!shippingInfo_data) {
      setErrors((prev) => ({
        ...prev,
        shipping: 'لم يتم تأكيد رسوم التوصيل بعد. يرجى الانتظار قليلاً.',
      }))
      return
    }

    if (shippingInfo_data.available === false) {
      setErrors((prev) => ({
        ...prev,
        shipping: shippingBlockingReason,
      }))
      return
    }

    setErrors((prev) => ({
      ...prev,
      shipping: null,
    }))
    setStep(3)
  }

  const handlePaymentTypeChange = (nextPaymentType) => {
    setPaymentType(nextPaymentType)
    setPaymentTermsAccepted(false)
    setErrors((prev) => ({
      ...prev,
      paymentType: null,
      paymentMethod: null,
      paymentTerms: null,
    }))
  }

  const handlePaymentMethodChange = (method) => {
    setSelectedPaymentMethod(method)
    if (method === 'paypal') {
      setSelectedBank(null)
    }
    setErrors((prev) => ({
      ...prev,
      paymentMethod: null,
      selectedBank: null,
    }))
  }

  const handleBankSelection = (bankName) => {
    setSelectedBank(bankName)
    setErrors((prev) => ({
      ...prev,
      selectedBank: null,
    }))
  }

  const handlePaymentTermsChange = (accepted) => {
    setPaymentTermsAccepted(accepted)
    setErrors((prev) => ({
      ...prev,
      paymentTerms: null,
    }))
  }

  const validatePaymentStep = () => {
    const paymentErrors = {}

    if (shippingLoading) {
      paymentErrors.shipping = 'جاري حساب رسوم التوصيل. انتظر لحظة قبل تأكيد الطلب.'
    } else if (!shippingInfo_data) {
      paymentErrors.shipping = 'لم يتم تأكيد رسوم التوصيل بعد لهذا العنوان.'
    } else if (shippingInfo_data.available === false) {
      paymentErrors.shipping = shippingBlockingReason
    }

    if (!availablePaymentTypes.hasAny) {
      paymentErrors.paymentType = 'لا توجد طريقة دفع مشتركة متاحة لهذه السلة حالياً.'
    } else if (!paymentType || !availablePaymentTypes[paymentType]) {
      paymentErrors.paymentType = 'اختر نوع دفع متاح قبل إتمام الطلب.'
    }

    if (paymentType && paymentType !== 'cod') {
      if (!selectedPaymentMethod || !['paypal', 'bank'].includes(selectedPaymentMethod)) {
        paymentErrors.paymentMethod = 'اختر وسيلة الدفع أولاً.'
      } else if (selectedPaymentMethod === 'paypal' && !paypalEnabled) {
        paymentErrors.paymentMethod = paypalUnavailableReason
      } else if (selectedPaymentMethod === 'bank' && !selectedBank) {
        paymentErrors.selectedBank = 'اختر بنك التحويل قبل تأكيد الطلب.'
      }
    }

    if (!paymentTermsAccepted) {
      paymentErrors.paymentTerms = 'يجب الموافقة على شروط الدفع قبل تأكيد الطلب.'
    }

    setErrors((prev) => ({
      ...prev,
      shipping: paymentErrors.shipping || null,
      paymentType: paymentErrors.paymentType || null,
      paymentMethod: paymentErrors.paymentMethod || null,
      selectedBank: paymentErrors.selectedBank || null,
      paymentTerms: paymentErrors.paymentTerms || null,
    }))

    return Object.keys(paymentErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    setLoading(true)
    try {
      if (!validatePaymentStep()) {
        setLoading(false)
        return
      }

      // Re-validate coupon just before payment to prevent expired/over-limit coupons
      if (appliedCoupon) {
        const validation = await couponsApi.validateCoupon(
          appliedCoupon.code,
          user.id,
          discountedSubtotal
        )

        if (!validation.valid) {
          setAppliedCoupon(null)
          setCouponCode('')
          toast.error(validation.error || 'انتهت صلاحية الكوبون أو لم يعد مستوفياً لشروط الطلب.')
          setLoading(false)
          return
        }

        setAppliedCoupon(validation.coupon)
      }

      // Fetch current commission rate from platform settings
      let commissionRate = 2.0 // fallback default
      try {
        const settings = await platformSettings.getSettings()
        commissionRate = settings?.commission_rate ?? 2.0
      } catch (e) {
        // If settings fetch fails, fall back to default
        console.warn('Failed to fetch commission rate, using default:', e)
      }

      // Group items by vendor
      const vendorItems = {}
      items.forEach(item => {
        if (!vendorItems[item.vendor_id]) vendorItems[item.vendor_id] = []
        vendorItems[item.vendor_id].push(item)
      })

      const vendorIds = Object.keys(vendorItems)
      const { data: vendorProfiles, error: vendorProfilesError } = await supabase
        .from('profiles')
        .select('id, store_name, store_type, delivery_option, active_products_count, preferred_driver_id, partnership_status, min_order_amount')
        .in('id', vendorIds)

      if (vendorProfilesError) throw vendorProfilesError

      const freshMinimumOrderStatus = evaluateVendorMinimumOrders({
        items,
        vendorProfiles: vendorProfiles || [],
      })

      if (freshMinimumOrderStatus.hasViolations) {
        throw new Error(buildMinimumOrderMessage(freshMinimumOrderStatus.firstViolation))
      }

      const vendorProfilesMap = Object.fromEntries((vendorProfiles || []).map((vendor) => [vendor.id, vendor]))

      // Create orders for each vendor
      const orders = []
      const PLATFORM_COMMISSION_RATE = commissionRate // Use dynamic rate from platform settings
      const vendorEntries = Object.entries(vendorItems)
      let allocatedCouponDiscount = 0

      for (const [index, [vendorId, vItems]] of vendorEntries.entries()) {
        const vendorProfile = vendorProfilesMap[vendorId]
        const selectedDriverForVendor = hasSingleVendorCart ? selectedDriver : null
        const deliveryStrategy = storeTypeService.resolveOrderDeliveryStrategy(vendorProfile, selectedDriverForVendor)
        const vendorSetup = storeTypeService.decorateStoreProfile(vendorProfile)
        const minimumOrderAmount = Number(vendorProfile?.min_order_amount || 0)

        if (deliveryStrategy.blocked) {
          throw new Error(`المتجر ${vendorProfile?.store_name || 'المحدد'} يحتاج سائقاً مرتبطاً ومقبول الشراكة قبل إتمام هذا الطلب.`)
        }

        const vendorSubtotal = vItems.reduce((sum, item) => sum + (item.price_per_unit || item.price || 0) * item.quantity, 0)

        if (minimumOrderAmount > 0 && vendorSubtotal < minimumOrderAmount) {
          throw new Error(buildMinimumOrderMessage({
            vendorName: vendorProfile?.store_name || 'هذا المتجر',
            minOrderAmount: minimumOrderAmount,
            shortfall: minimumOrderAmount - vendorSubtotal,
          }))
        }

        const vendorBulkDiscount = toAmount(
          bulkDiscountBreakdown.offersByVendor?.[vendorId]?.discountAmount || 0
        )
        const vendorSubtotalAfterBulk = Math.max(toAmount(vendorSubtotal - vendorBulkDiscount), 0)

        let orderCouponDiscount = 0
        if (appliedCoupon && discountedSubtotal > 0) {
          if (index === vendorEntries.length - 1) {
            orderCouponDiscount = toAmount(
              Math.min(couponDiscount - allocatedCouponDiscount, vendorSubtotalAfterBulk)
            )
          } else {
            orderCouponDiscount = toAmount(
              Math.min(
                couponDiscount * (vendorSubtotalAfterBulk / discountedSubtotal),
                vendorSubtotalAfterBulk
              )
            )
          }
          allocatedCouponDiscount = toAmount(allocatedCouponDiscount + orderCouponDiscount)
        }

        const orderDiscountTotal = toAmount(vendorBulkDiscount + orderCouponDiscount)
        const discountedVendorSubtotal = Math.max(toAmount(vendorSubtotal - orderDiscountTotal), 0)

        // Commission calculations
        const buyerCommission = toAmount(discountedVendorSubtotal * (PLATFORM_COMMISSION_RATE / 100))
        const vendorCommission = toAmount(discountedVendorSubtotal * (PLATFORM_COMMISSION_RATE / 100))
        const productPayableTotal = toAmount(discountedVendorSubtotal + buyerCommission)
        const buyerTotal = toAmount(productPayableTotal + shippingCost)

        const driverCommission = deliveryStrategy.createDeliveryOnAcceptance
          ? toAmount(shippingCost * (PLATFORM_COMMISSION_RATE / 100))
          : 0
        const driverAmount = deliveryStrategy.createDeliveryOnAcceptance
          ? toAmount(shippingCost - driverCommission)
          : 0
        const vendorAmount = toAmount((
          discountedVendorSubtotal -
          vendorCommission +
          (deliveryStrategy.deliveryOption === 'self' ? shippingCost : 0)
        ))
        const scheduledSlot = hasSingleVendorCart && items[0]?.vendor_id === vendorId
          ? selectedDeliverySlot
          : null
        const paymentPlan = trustScoreService.buildPaymentPlan({
          paymentType,
          payableAmount: productPayableTotal,
          paymentMethod: paymentType === 'cod' ? 'cod' : selectedPaymentMethod,
        })

        const baseOrderPayload = {
          buyer_id: user.id,
          vendor_id: vendorId,
          driver_id: deliveryStrategy.assignedDriverId,
          subtotal: vendorSubtotal,
          shipping_cost: shippingCost,
          tax: 0,
          total: buyerTotal,
          buyer_commission: buyerCommission,
          buyer_total: buyerTotal,
          vendor_amount: vendorAmount,
          discount_total: orderDiscountTotal,
          coupon_discount_total: orderCouponDiscount,
          bulk_discount_total: vendorBulkDiscount,
          applied_coupon_id: appliedCoupon?.id || null,
          driver_commission: driverCommission,
          driver_amount: driverAmount,
          payment_type: paymentPlan.paymentType,
          first_payment_amount: paymentPlan.firstPaymentAmount,
          first_payment_status: paymentPlan.firstPaymentStatus,
          second_payment_amount: paymentPlan.secondPaymentAmount,
          second_payment_status: paymentPlan.secondPaymentStatus,
          second_payment_due_at: paymentPlan.secondPaymentDueAt,
          delivery_distance_km: shippingInfo_data?.distance || null,
          delivery_base_fee: shippingInfo_data?.breakdown?.base || 0,
          delivery_distance_fee: shippingInfo_data?.breakdown?.distance || 0,
          delivery_time_multiplier: shippingInfo_data?.timeMultiplier || 1,
          delivery_fee_breakdown: {
            ...(shippingInfo_data?.breakdown || {}),
            pricingSource: shippingInfo_data?.pricingSource || 'default',
            estimatedDeliveryTime,
          },
          cargo_size: cargoSize,
          driver_delivery_payment_method: deliveryStrategy.createDeliveryOnAcceptance ? driverDeliveryPaymentMethod : null,
          driver_delivery_payment_status: deliveryStrategy.createDeliveryOnAcceptance ? 'pending' : 'waived',
          driver_delivery_payment_notes: activeDeliveryDriverProfile?.driver_delivery_payment_notes || null,
          product_tva_exempt: true,
          platform_commission_rate_snapshot: Number((PLATFORM_COMMISSION_RATE / 100).toFixed(4)),
          vendor_product_total: discountedVendorSubtotal,
          delivery_fee_total: shippingCost,
          status: deliveryStrategy.initialOrderStatus,
          vendor_store_type: vendorSetup.storeType,
          delivery_option: deliveryStrategy.deliveryOption,
          shipping_address: shippingInfo.address,
          shipping_city: shippingInfo.city,
          shipping_country: 'Morocco',
          shipping_latitude: deliveryLocation.lat || null,
          shipping_longitude: deliveryLocation.lng || null,
          buyer_notes: shippingInfo.notes,
          requested_delivery_date: scheduledSlot ? requestedDeliveryDate : null,
          requested_delivery_slot_id: scheduledSlot?.id || null,
          requested_delivery_slot_label: scheduledSlot?.slot_label || null,
          minimum_order_amount_snapshot: minimumOrderAmount,
          minimum_order_shortfall: Math.max(minimumOrderAmount - vendorSubtotal, 0),
          delivery_schedule_snapshot: scheduledSlot
            ? buildDeliveryScheduleSnapshot({ requestedDate: requestedDeliveryDate, slot: scheduledSlot })
            : {},
        }

        const preferredOrderPayload = {
          ...baseOrderPayload,
          preferred_driver_id: deliveryStrategy.preferredDriverId,
          preferred_driver_status: deliveryStrategy.preferredDriverId
            ? deliveryStrategy.assignedDriverId
              ? 'linked'
              : 'unassigned'
            : null,
          preferred_driver_source: selectedDriverForVendor
            ? 'manual_selection'
            : deliveryStrategy.preferredDriverId
              ? 'vendor_preferred'
              : null,
          preferred_driver_assigned_at: deliveryStrategy.preferredDriverId ? new Date().toISOString() : null,
        }

        let insertResult = await supabase
          .from('orders')
          .insert(preferredOrderPayload)
          .select()
          .single()

        if (insertResult.error && insertResult.error.message?.includes('preferred_driver')) {
          insertResult = await supabase
            .from('orders')
            .insert(baseOrderPayload)
            .select()
            .single()
        }

        const { data, error } = insertResult

        if (error) throw error

        // Create payment record for products only; delivery fee is handled separately.
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            order_id: data.id,
            amount: paymentPlan.paymentMethod === 'cod' ? paymentPlan.secondPaymentAmount : paymentPlan.firstPaymentAmount,
            payment_method: paymentPlan.paymentMethod,
            status: 'pending',
          })

        if (paymentError) throw paymentError

        const { error: termsError } = await supabase
          .from('payment_terms_acceptance')
          .insert({
            user_id: user.id,
            order_id: data.id,
            payment_type: paymentPlan.paymentType,
            terms_version: 'payment-policy-v1',
            warning_shown: true,
          })

        if (termsError) throw termsError

        // Create order items
        const orderItems = vItems.map(item => ({
          order_id: data.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price_per_unit || item.price || 0,
          total: (item.price_per_unit || item.price || 0) * item.quantity,
        }))

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems)

        if (itemsError) throw itemsError
        
        // If no driver selected, the auto-dispatch system will handle it
        // The database trigger will create a delivery record when vendor accepts
        orders.push(data)
      }

      // Record coupon redemption (only once, after all orders created)
      if (appliedCoupon) {
        await supabase
          .from('coupon_redemptions')
          .insert({
            coupon_id: appliedCoupon.id,
            user_id: user.id,
            order_id: orders[0].id,
            discount_amount: couponDiscount,
            discount_percentage: appliedCoupon.discount_type === 'percentage'
              ? appliedCoupon.discount_value
              : null,
          })
      }

      let paypalApprovalUrl = null
      if (selectedPaymentMethod === 'paypal' && paymentType !== 'cod') {
        const primaryOrder = orders[0]
        if (!primaryOrder) {
          throw new Error('تعذر تهيئة طلب PayPal: لم يتم العثور على الطلب.')
        }

        const paypalAmount = Number(primaryOrder.first_payment_amount || 0)
        if (!paypalAmount || paypalAmount <= 0) {
          throw new Error('المبلغ المطلوب للدفع عبر PayPal غير صالح.')
        }

        const { data: paypalInit, error: paypalError } = await supabase.functions.invoke('create-paypal-order', {
          body: {
            orderId: primaryOrder.id,
            amount: paypalAmount,
            currency: 'MAD',
            customer: {
              email: user?.email || profile?.email || null,
              name: shippingInfo.fullName,
            },
            returnUrl: `${window.location.origin}/order-confirmation/${primaryOrder.id}?paypal=success`,
            cancelUrl: `${window.location.origin}/order-confirmation/${primaryOrder.id}?paypal=cancel`,
          },
        })

        if (paypalError) {
          throw new Error(paypalError.message || 'تعذر إنشاء عملية PayPal')
        }

        if (!paypalInit?.orderId) {
          throw new Error('لم يتم استلام معرف طلب PayPal من الخادم.')
        }

        const { error: updatePaymentError } = await supabase
          .from('payments')
          .update({
            transaction_id: paypalInit.orderId,
            gateway_response: paypalInit,
          })
          .eq('order_id', primaryOrder.id)
          .eq('payment_method', 'paypal')

        if (updatePaymentError) {
          throw updatePaymentError
        }

        paypalApprovalUrl = paypalInit.approvalUrl || null
      }

      clearCart()
      setAppliedCoupon(null)
      setCouponCode('')

      // Enrich order data with items, buyer, vendor, and payment_method for the confirmation page
      const enrichedOrders = await Promise.all(
        orders.map(async (order) => {
          // Fetch order items
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('*, product:products(name)')
            .eq('order_id', order.id)

          // Fetch payment method
          const { data: paymentData } = await supabase
            .from('payments')
            .select('payment_method')
            .eq('order_id', order.id)
            .maybeSingle()

          // Fetch buyer profile
          const { data: buyerData } = await supabase
            .from('profiles')
            .select('first_name, last_name, email, phone')
            .eq('id', order.buyer_id)
            .maybeSingle()

          // Fetch vendor profile
          const { data: vendorData } = await supabase
            .from('profiles')
            .select('store_name, city')
            .eq('id', order.vendor_id)
            .maybeSingle()

          return {
            ...order,
            items: orderItems || [],
            payment_method: paymentData?.payment_method || (paymentType === 'cod' ? 'cod' : selectedPaymentMethod),
            payment_type: order.payment_type || paymentType,
            selected_bank: paymentType === 'cod' || selectedPaymentMethod !== 'bank' ? null : selectedBank,
            buyer: buyerData || {},
            vendor: vendorData || {},
          }
        })
      )

      // Send order confirmation email
      try {
        const { data: buyerProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', user.id)
          .maybeSingle()

        if (buyerProfile?.email) {
          await emailService.sendOrderConfirmation(enrichedOrders[0], {
            name: `${buyerProfile.first_name || ''} ${buyerProfile.last_name || ''}`.trim(),
            email: buyerProfile.email,
          })
        }
      } catch (emailErr) {
        // Don't fail checkout if email fails
        logger.error('Order confirmation email failed:', emailErr)
      }

      if (paymentType === 'split' && selectedPaymentMethod === 'bank') {
        toast.success(`🎉 تم تقديم الطلب! الدفعة الأولى مطلوبة الآن عبر ${selectedBank || 'التحويل البنكي'}`)
      } else if (paymentType === 'full' && selectedPaymentMethod === 'bank') {
        toast.success(`🎉 تم تقديم الطلب! يرجى رفع إيصال التحويل الكامل عبر ${selectedBank || 'البنك المحدد'}`)
      } else if ((paymentType === 'split' || paymentType === 'full') && selectedPaymentMethod === 'paypal') {
        toast.success('🎉 تم تقديم الطلب بنجاح! سيتم إكمال الدفع عبر PayPal.')
      } else if (paymentType === 'cod') {
        toast.success('🎉 تم تقديم الطلب بنجاح! الدفع عند الاستلام')
      } else {
        toast.success('🎉 تم تقديم الطلب بنجاح!')
      }

      if (paypalApprovalUrl) {
        window.location.href = paypalApprovalUrl
        return
      }

      navigate('/order-confirmation', {
        state: {
          order: enrichedOrders[0],
          paymentMethod: paymentType === 'cod' ? 'cod' : selectedPaymentMethod,
          paymentType,
          selectedBank: paymentType === 'cod' || selectedPaymentMethod !== 'bank' ? null : selectedBank,
        }
      })
    } catch (error) {
      logger.error('Checkout error:', error)
      toast.error(error.message || 'Failed to place order')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { num: 1, label: 'Shipping' },
    { num: 2, label: 'Delivery' },
    { num: 3, label: 'Payment' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" role="main" aria-label="Checkout page" data-testid="checkout-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('checkout.title')}</h1>

        {/* Steps Indicator */}
        <nav aria-label="Checkout steps">
          <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step >= s.num ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                }`} aria-current={step === s.num ? 'step' : undefined}>
                  {step > s.num ? <CheckIcon className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-sm font-medium ${step >= s.num ? 'text-green-600' : 'text-gray-400'}`}>
                  {t(`checkout.steps.${s.label.toLowerCase()}`)}
                </span>
                {i < steps.length - 1 && <ChevronRightIcon className="w-4 h-4 text-gray-300" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </nav>
      </div>

      <form onSubmit={handleSubmit} aria-label="Checkout form" data-testid="checkout-form">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Shipping & Payment */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Shipping Info */}
            {step === 1 && (
              <Card className="p-6" data-testid="checkout-step-shipping">
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TruckIcon className="w-5 h-5" />
                  Shipping Information
                </h2>
                {vendorMinimumStatus.hasViolations && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-900">بعض المتاجر في السلة لم تصل إلى الحد الأدنى للطلب.</p>
                    <div className="mt-2 space-y-2 text-xs text-amber-800">
                      {vendorMinimumStatus.violations.map((vendor) => (
                        <p key={vendor.vendorId}>
                          {vendor.vendorName}: الحد الأدنى {formatPrice(vendor.minOrderAmount)} والمتبقي {formatPrice(vendor.shortfall)}.
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Input
                      label="Full Name *"
                      value={shippingInfo.fullName}
                      onChange={(e) => { setShippingInfo({ ...shippingInfo, fullName: e.target.value }); setErrors({...errors, fullName: null}) }}
                      placeholder="Your full name"
                      data-testid="checkout-full-name-input"
                    />
                    {errors.fullName && <p className="text-red-500 text-xs mt-1" data-testid="checkout-full-name-error">{errors.fullName}</p>}
                  </div>
                  <div>
                    <Input
                      label="Phone *"
                      type="tel"
                      value={shippingInfo.phone}
                      onChange={(e) => { setShippingInfo({ ...shippingInfo, phone: e.target.value }); setErrors({...errors, phone: null}) }}
                      placeholder="+212 6XX XXX XXX"
                      data-testid="checkout-phone-input"
                    />
                    {errors.phone && <p className="text-red-500 text-xs mt-1" data-testid="checkout-phone-error">{errors.phone}</p>}
                  </div>
                  <div>
                    <Input
                      label="City *"
                      value={shippingInfo.city}
                      onChange={(e) => { setShippingInfo({ ...shippingInfo, city: e.target.value }); setErrors({...errors, city: null}) }}
                      placeholder="Casablanca"
                      data-testid="checkout-city-input"
                    />
                    {errors.city && <p className="text-red-500 text-xs mt-1" data-testid="checkout-city-error">{errors.city}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="checkout-address" className="input-label">Address *</label>
                    <textarea
                      id="checkout-address"
                      value={shippingInfo.address}
                      onChange={(e) => { setShippingInfo({ ...shippingInfo, address: e.target.value }); setErrors({...errors, address: null}) }}
                      data-testid="checkout-address-input"
                      className={`input h-20 resize-none ${errors.address ? 'border-red-500' : ''}`}
                      placeholder="الشارع، المبنى، الشقة..."
                    />
                    {errors.address && <p className="text-red-500 text-xs mt-1" data-testid="checkout-address-error">{errors.address}</p>}
                  </div>

                  {/* Location Picker */}
                  <div className="sm:col-span-2">
                    <LocationPicker
                      value={deliveryLocation}
                      onChange={(loc) => {
                        setDeliveryLocation(loc)
                        setErrors({...errors, location: null})
                      }}
                      city={shippingInfo.city}
                      required
                    />
                    {errors.location && (
                      <p className="text-red-500 text-xs mt-2 flex items-center gap-1" data-testid="checkout-location-error">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {errors.location}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="checkout-notes" className="input-label">Notes (optional)</label>
                    <textarea
                      id="checkout-notes"
                      value={shippingInfo.notes}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, notes: e.target.value })}
                      data-testid="checkout-notes-input"
                      className="input h-16 resize-none"
                      placeholder="Delivery instructions, apartment number, etc."
                    />
                  </div>
                </div>
                <button type="button" onClick={handleNext} className="btn-primary w-full mt-6" disabled={vendorMinimumStatus.hasViolations} data-testid="checkout-continue-to-delivery">
                  Continue to Delivery Selection
                </button>
                {errors.minimumOrder && <p className="text-red-500 text-xs mt-2" data-testid="checkout-minimum-order-error">{errors.minimumOrder}</p>}
              </Card>
            )}

            {/* Step 2: Driver Selection */}
            {step === 2 && (
              <Card className="p-6" data-testid="checkout-step-delivery">
                <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TruckIcon className="w-5 h-5" />
                  Delivery Driver
                </h2>

                {hasSingleVendorCart && vendorStoreSetup && (
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 mb-4">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        {vendorStoreSetup.storeTypeLabel}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                        {vendorStoreSetup.deliveryOptionMeta?.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-6 mb-2">{vendorStoreSetup.storeTypeDescription}</p>
                    <p className="text-xs text-gray-500">عدد المنتجات النشطة: {vendorStoreSetup.activeProductsCountLabel}</p>
                  </div>
                )}

                {!hasSingleVendorCart ? (
                  <>
                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 mb-4">
                      <p className="text-sm font-medium text-blue-900">يوجد أكثر من متجر داخل السلة.</p>
                      <p className="text-xs text-blue-700 mt-1 leading-6">
                        سيتم تطبيق خيار التوصيل المناسب لكل متجر تلقائياً عند إنشاء الطلبات، سواء كان توصيلاً ذاتياً أو بحثاً عن سائق أو سائقاً مرتبطاً.
                      </p>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button type="button" onClick={() => setStep(1)} className="btn-outline flex-1">
                        Back
                      </button>
                      <button type="button" onClick={handleContinueToPayment} className="btn-primary flex-1" disabled={!canContinueToPayment} data-testid="checkout-continue-to-payment">
                        Continue to Payment
                      </button>
                    </div>
                    {errors.shipping && <p className="text-red-500 text-xs mt-2" data-testid="checkout-shipping-error">{errors.shipping}</p>}
                  </>
                ) : vendorDeliveryStrategy?.blocked ? (
                  <>
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 mb-4">
                      <p className="text-sm font-medium text-amber-900">هذا المتجر لم يكمل ربط السائق المرتبط بعد.</p>
                      <p className="text-xs text-amber-700 mt-1 leading-6">
                        لا يمكن متابعة هذا الطلب حالياً لأن خيار التوصيل الحالي يحتاج سائقاً مرتبطاً ومقبول الشراكة من طرف البائع.
                      </p>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button type="button" onClick={() => setStep(1)} className="btn-outline flex-1">
                        Back
                      </button>
                      <button type="button" disabled className="btn-primary flex-1 opacity-50 cursor-not-allowed" data-testid="checkout-continue-to-payment">
                        Continue to Payment
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Delivery Address Summary */}
                    <div className="p-4 bg-gray-50 rounded-xl mb-4" data-testid="checkout-delivery-summary">
                      <div className="flex items-start gap-2">
                        <MapPinIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Delivery to:</p>
                          <p className="text-sm text-gray-600">{shippingInfo.address}</p>
                          <p className="text-sm text-gray-600">{shippingInfo.city}</p>
                          {shippingInfo_data && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Estimated cost:</span>
                                {shippingLoading ? (
                                  <span className="font-semibold text-gray-500">Calculating...</span>
                                ) : shippingInfo_data.available === false ? (
                                  <span className="font-semibold text-red-600">غير متاح</span>
                                ) : (
                                  <span className="font-semibold text-green-600">{formatPrice(shippingCost)}</span>
                                )}
                              </div>
                              {shippingInfo_data.distance && (
                                <div className="flex justify-between text-xs mt-1">
                                  <span className="text-gray-500">Distance:</span>
                                  <span>{shippingInfo_data.distance.toFixed(1)} km</span>
                                </div>
                              )}
                              {estimatedDeliveryTime && shippingInfo_data.available !== false && (
                                <div className="flex justify-between text-xs mt-1">
                                  <span className="text-gray-500">Est. time:</span>
                                  <span className="flex items-center gap-1">
                                    <ClockIcon className="w-3 h-3" />
                                    {estimatedDeliveryTime}
                                  </span>
                                </div>
                              )}
                              {shippingInfo_data.pricingSource && (
                                <div className="flex justify-between text-xs mt-1">
                                  <span className="text-gray-500">Pricing from:</span>
                                  <span className="capitalize">{shippingInfo_data.pricingSource}</span>
                                </div>
                              )}
                              {shippingInfo_data.available === false && shippingInfo_data.blockingReason && (
                                <p className="text-xs text-red-600 mt-2 leading-6">{shippingInfo_data.blockingReason}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {hasSingleVendorCart && (
                      <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50 mb-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-medium text-indigo-900">جدولة التسليم</p>
                            <p className="text-xs text-indigo-700 mt-1">اختر تاريخاً وفترة مناسبة إذا كنت تريد تحديد نافذة التسليم مسبقاً.</p>
                          </div>
                          <ClockIcon className="w-5 h-5 text-indigo-600" />
                        </div>

                        <div className="mb-3">
                          <label className="input-label">تاريخ التسليم المطلوب</label>
                          <input
                            type="date"
                            min={todayDateValue()}
                            value={requestedDeliveryDate}
                            onChange={(event) => setRequestedDeliveryDate(event.target.value)}
                            data-testid="checkout-delivery-date-input"
                            className="input"
                          />
                        </div>

                        {loadingDeliverySlots ? (
                          <div className="flex items-center gap-3 text-sm text-indigo-700">
                            <LoadingSpinner size="sm" />
                            جاري تحميل فترات التوصيل المتاحة...
                          </div>
                        ) : availableDeliverySlots.length === 0 ? (
                          <div className="rounded-xl bg-white/70 px-4 py-3 text-sm text-indigo-700">
                            لا توجد فترات متاحة لهذا التاريخ حالياً. يمكنك متابعة الطلب بدون جدولة وسيتم التعامل معه بأقرب وقت متاح.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {availableDeliverySlots.map((slot) => (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => setSelectedDeliverySlotId(slot.id)}
                                disabled={!slot.available}
                                data-testid="checkout-delivery-slot"
                                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                                  selectedDeliverySlotId === slot.id
                                    ? 'border-indigo-500 bg-white shadow-sm'
                                    : 'border-indigo-100 bg-white/70'
                                } ${!slot.available ? 'opacity-60 cursor-not-allowed' : 'hover:border-indigo-300'}`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{slot.slot_label}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                      {slot.start_time} - {slot.end_time}
                                      {slot.cutoff_hours ? ` • إقفال قبل ${slot.cutoff_hours} س` : ''}
                                    </p>
                                  </div>
                                  <div className="text-right text-xs">
                                    {slot.isFull ? (
                                      <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 font-medium">مكتملة</span>
                                    ) : slot.pastCutoff ? (
                                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">انتهى وقت الحجز</span>
                                    ) : slot.remainingCapacity === null ? (
                                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">متاحة</span>
                                    ) : (
                                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                        متبقي {slot.remainingCapacity}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ))}
                            {selectedDeliverySlot && (
                              <button
                                type="button"
                                onClick={() => setSelectedDeliverySlotId(null)}
                                className="text-xs font-medium text-indigo-700 hover:text-indigo-800"
                              >
                                إزالة الجدولة واختيار أقرب وقت متاح
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 mb-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <p className="text-sm font-medium text-gray-900 mb-3">حجم الحمولة المطلوب</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'small', label: 'صغيرة' },
                            { value: 'medium', label: 'متوسطة' },
                            { value: 'large', label: 'كبيرة' },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setCargoSize(option.value)}
                              data-testid={`checkout-cargo-size-${option.value}`}
                              className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${cargoSize === option.value ? 'border-green-500 bg-white text-green-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-3 leading-6">سيتم استخدام هذا الحجم لمطابقة السائق المناسب وحفظه ضمن سجل الطلب القانوني.</p>
                      </div>

                      {vendorDeliveryStrategy?.createDeliveryOnAcceptance && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <p className="text-sm font-medium text-amber-900 mb-3">طريقة سداد رسم التوصيل</p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {[{
                              value: 'cash',
                              label: 'نقداً عند التسليم',
                              icon: BanknotesIcon,
                            }, {
                              value: 'bank_transfer',
                              label: 'تحويل بنكي للسائق',
                              icon: BuildingLibraryIcon,
                            }].map((option) => {
                              const Icon = option.icon
                              const disabled = activeDeliveryDriverProfile
                                ? !activeDriverSupportedPaymentMethods.includes(option.value)
                                : false

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => !disabled && setDriverDeliveryPaymentMethod(option.value)}
                                  disabled={disabled}
                                  data-testid={`checkout-driver-payment-${option.value}`}
                                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${driverDeliveryPaymentMethod === option.value ? 'border-amber-500 bg-white text-amber-900' : 'border-amber-100 bg-white/80 text-gray-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-amber-300'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4" />
                                    <span className="text-sm font-medium">{option.label}</span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                          <p className="text-xs text-amber-800 mt-3 leading-6">
                            هذه القيمة تخص خدمة التوصيل فقط. قيمة المنتجات تُدفع في الخطوة التالية وفق سياسة الدفع المعتمدة للمتاجر.
                          </p>
                          {activeDeliveryDriverProfile?.driver_delivery_payment_notes && (
                            <p className="text-xs text-amber-900 mt-2 leading-6 font-medium">{activeDeliveryDriverProfile.driver_delivery_payment_notes}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {vendorDeliveryStrategy?.deliveryOption === 'self' && (
                      <div className="p-4 rounded-xl border border-green-200 bg-green-50 mb-4">
                        <p className="text-sm font-medium text-green-900">هذا المتجر يعتمد التوصيل الذاتي.</p>
                        <p className="text-xs text-green-700 mt-1 leading-6">
                          لن يتم إنشاء دورة سائق عبر المنصة لهذا الطلب، وسيتم تسليمه مباشرة من طرف المتجر.
                        </p>
                      </div>
                    )}

                    {hasPreferredDriverAutoAssignment && (
                      <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 mb-4">
                        <p className="text-sm font-medium text-blue-900">سيتم توجيه هذا الطلب تلقائياً إلى السائق المرتبط بهذا المتجر.</p>
                        <p className="text-xs text-blue-700 mt-1">لن تحتاج إلى اختيار سائق يدوياً لهذه الطلبية.</p>
                      </div>
                    )}

                    {vendorDeliveryStrategy?.deliveryOption === 'find_driver' && (
                      <>
                        {loadingDrivers ? (
                          <div className="flex items-center justify-center py-8">
                            <LoadingSpinner size="md" />
                            <p className="text-sm text-gray-600 ml-3">Finding available drivers...</p>
                          </div>
                        ) : (
                          <>
                            {noDriversAvailable ? (
                              <>
                                <NoDriverAvailable
                                  vendorId={items[0]?.vendor_id}
                                  productId={items[0]?.id}
                                  productName={items[0]?.name}
                                />
                                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 mt-4">
                                  <p className="text-sm font-medium text-amber-900">لا يوجد سائق مطابق لهذه الحمولة أو لطريقة سداد التوصيل حالياً.</p>
                                  <p className="text-xs text-amber-700 mt-1 leading-6">
                                    يمكنك المتابعة بدون اختيار سائق الآن، وسيظهر الطلب لاحقاً فقط للسائقين المطابقين للمسافة وحجم الحمولة وطريقة السداد التي اخترتها.
                                  </p>
                                </div>
                              </>
                            ) : (
                              <DriverSelection
                                drivers={availableDrivers}
                                selectedDriver={selectedDriver}
                                onChange={setSelectedDriver}
                                cargoSize={cargoSize}
                                deliveryPaymentMethod={driverDeliveryPaymentMethod}
                              />
                            )}
                          </>
                        )}
                      </>
                    )}

                    <div className="flex gap-3 mt-6">
                      <button type="button" onClick={() => setStep(1)} className="btn-outline flex-1">
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleContinueToPayment}
                        className="btn-primary flex-1"
                        disabled={!canContinueToPayment}
                        data-testid="checkout-continue-to-payment"
                      >
                        Continue to Payment
                      </button>
                    </div>
                    {errors.shipping && <p className="text-red-500 text-xs mt-2" data-testid="checkout-shipping-error">{errors.shipping}</p>}
                  </>
                )}
              </Card>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <Card className="p-6" data-testid="checkout-step-payment">
                <PaymentTypeSelector
                  vendorPolicies={cartVendorPaymentPolicies}
                  codEligibility={codEligibility}
                  availablePaymentTypes={availablePaymentTypes}
                  paymentType={paymentType}
                  onPaymentTypeChange={handlePaymentTypeChange}
                  selectedPaymentMethod={selectedPaymentMethod}
                  onPaymentMethodChange={handlePaymentMethodChange}
                  paypalEnabled={paypalEnabled}
                  paypalUnavailableReason={paypalUnavailableReason}
                  selectedBank={selectedBank}
                  onBankChange={handleBankSelection}
                  termsAccepted={paymentTermsAccepted}
                  onTermsAcceptedChange={handlePaymentTermsChange}
                  totalAmount={productPaymentTotal}
                  errors={errors}
                  disabled={loading}
                />

                {/* Shipping Summary */}
                <div className="mt-6 p-4 bg-gray-50 rounded-xl" data-testid="checkout-shipping-summary">
                  <h3 className="font-medium text-sm text-gray-700 mb-2">Shipping to:</h3>
                  <p className="text-sm text-gray-600">{shippingInfo.fullName}</p>
                  <p className="text-sm text-gray-600">{shippingInfo.address}</p>
                  <p className="text-sm text-gray-600">{shippingInfo.city} • {shippingInfo.phone}</p>
                  {isShippingUnavailable && (
                    <p className="text-sm text-red-600 mt-2">{shippingBlockingReason}</p>
                  )}
                  {selectedDeliverySlot && (
                    <p className="text-sm text-indigo-700 mt-2">
                      موعد التسليم المطلوب: {requestedDeliveryDate} • {selectedDeliverySlot.slot_label} ({selectedDeliverySlot.start_time} - {selectedDeliverySlot.end_time})
                    </p>
                  )}
                  {vendorDeliveryStrategy?.createDeliveryOnAcceptance && (
                    <p className="text-sm text-amber-700 mt-2">
                      رسم التوصيل سيُسدد بشكل منفصل: {driverDeliveryPaymentMethod === 'bank_transfer' ? 'تحويل بنكي للسائق' : 'نقداً عند التسليم'}.
                    </p>
                  )}
                  {paymentType !== 'cod' && (
                    <p className="text-sm text-blue-700 mt-2">
                      وسيلة الدفع المختارة: {selectedPaymentMethod === 'paypal' ? 'PayPal' : `تحويل بنكي${selectedBank ? ` (${selectedBank})` : ''}`}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button type="button" onClick={() => setStep(2)} className="btn-outline flex-1">
                    Back
                  </button>
                  <button type="submit" className="btn-primary flex-1" disabled={loading || !availablePaymentTypes.hasAny || vendorMinimumStatus.hasViolations || shippingLoading || !shippingInfo_data || isShippingUnavailable} data-testid="checkout-submit">
                    {loading ? <LoadingSpinner size="sm" /> : `Place Order - ${formatPrice(total)}`}
                  </button>
                </div>
                {errors.shipping && <p className="text-red-500 text-xs mt-2" data-testid="checkout-shipping-error">{errors.shipping}</p>}
              </Card>
            )}
          </div>

          {/* Right: Order Summary */}
          <div className="lg:col-span-1">
            <OrderSummary
              items={items}
              vendorMinimumStatus={vendorMinimumStatus}
              subtotal={subtotal}
              bulkDiscount={bulkDiscount}
              couponDiscount={couponDiscount}
              shippingCost={shippingCost}
              shippingLoading={shippingLoading}
              estimatedDeliveryTime={estimatedDeliveryTime}
              shippingInfoData={shippingInfo_data}
              platformFee={platformFee}
              platformCommissionRate={platformCommissionRate}
              productPaymentTotal={productPaymentTotal}
              grandTotal={total}
              cargoSize={cargoSize}
              driverDeliveryPaymentMethod={driverDeliveryPaymentMethod}
              selectedDeliverySlot={selectedDeliverySlot}
              requestedDeliveryDate={requestedDeliveryDate}
              couponCode={couponCode}
              onCouponCodeChange={setCouponCode}
              onApplyCoupon={() => couponCode && validateCoupon(couponCode)}
              onRemoveCoupon={() => {
                setAppliedCoupon(null)
                setCouponCode('')
              }}
              couponLoading={couponLoading}
              appliedCoupon={appliedCoupon}
              showDriverDeliveryPayment={hasSingleVendorCart ? vendorDeliveryStrategy?.createDeliveryOnAcceptance : shippingCost > 0}
            />
          </div>
        </div>
      </form>
    </div>
  )
}

export default CheckoutSimplified
