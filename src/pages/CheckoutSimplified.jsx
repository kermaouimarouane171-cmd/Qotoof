import { useState, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner, NoDriverAvailable } from '@/components/ui'
import PaymentStep from '@/components/checkout/PaymentStep'
import CheckoutSummary from '@/components/checkout/CheckoutSummary'
import CheckoutAddressStep from '@/components/checkout/CheckoutAddressStep'
import AddressStep from '@/components/checkout/AddressStep'
import DriverSelectionStep from '@/components/checkout/DriverSelectionStep'
import { TruckIcon, ChevronRightIcon, MapPinIcon, ClockIcon, BanknotesIcon, BuildingLibraryIcon, CheckIcon } from '@heroicons/react/24/outline'
import { formatPrice } from '@/utils/currency'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { couponsApi } from '@/services/coupons'
import deliveryScheduleService, { } from '@/services/deliveryScheduleService'
import { platformSettings } from '@/services/platformSettings'
import deliveryMatchingService, { DRIVER_SELECT, getDriverSupportedPaymentMethods } from '@/services/deliveryMatchingService'
import storeTypeService from '@/services/storeTypeService'
import trustScoreService from '@/services/trustScoreService'
import { logger } from '@/utils/logger'
import { buildMinimumOrderMessage, evaluateVendorMinimumOrders } from '@/services/minimumOrderService'
import { getPayPalClientId } from '@/lib/config'
import { emailService } from '@/services/emailService'
import { getLatestOrderPaymentRecord, updateOrderPaymentRecord } from '@/services/paymentService'
import { createCheckoutOrder } from '@/services/checkoutService'
import { useCheckoutPricing } from '@/hooks/useCheckoutPricing'

const toAmount = (value) => Number(Number(value || 0).toFixed(2))
const todayDateValue = () => new Date().toISOString().slice(0, 10)
const DELIVERY_PAYMENT_METHOD_LABELS = {
  cash: 'نقداً عند التسليم',
  bank_transfer: 'تحويل بنكي للسائق',
}
const MULTI_VENDOR_CHECKOUT_DISABLED_MESSAGE = 'يمكن إتمام الطلب حالياً من متجر واحد فقط. افصل السلة حسب البائع ثم أعد المحاولة.'

const CheckoutSimplified = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const {
    items: cartItems,
    checkoutVendorId,
    clearCart,
    clearCheckoutVendor,
    clearVendorItems,
  } = useCartStore()
  const items = useMemo(
    () => checkoutVendorId
      ? cartItems.filter((item) => item.vendor_id === checkoutVendorId)
      : cartItems,
    [cartItems, checkoutVendorId]
  )
  const [shippingCost, setShippingCost] = useState(0)
  const [shippingLoading, setShippingLoading] = useState(false)
  const [shippingInfo_data, setShippingInfoData] = useState(null)
  const [authoritativePricing, setAuthoritativePricing] = useState(null)
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
  const [checkoutNotices, setCheckoutNotices] = useState({
    paymentMethod: null,
    driverDeliveryPayment: null,
  })
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
  const [pendingPayPalCheckout, setPendingPayPalCheckout] = useState(null)
  const [paypalInlineProcessing, setPaypalInlineProcessing] = useState(false)

  const savedAddresses = useMemo(() => {
    const candidates = [
      profile?.address,
      shippingInfo?.address,
    ].filter(Boolean)

    return [...new Set(candidates)].map((value, index) => ({
      id: `addr-${index}`,
      value,
      label: value,
    }))
  }, [profile?.address, shippingInfo?.address])

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
  const [_bulkDiscountCandidates, setBulkDiscountCandidates] = useState([])
  const [couponLoading, setCouponLoading] = useState(false)
  const checkoutRequestKeyRef = useRef(null)
  const cartVendorIds = useMemo(
    () => Array.from(new Set(items.map((item) => item.vendor_id).filter(Boolean))),
    [items]
  )
  const checkoutRequestSignature = useMemo(() => JSON.stringify({
    items: items.map((item) => ({ id: item.id, quantity: item.quantity, vendor_id: item.vendor_id })),
    shippingInfo,
    deliveryLocation,
    paymentType,
    selectedPaymentMethod,
    selectedDriver,
    requestedDeliveryDate,
    selectedDeliverySlotId,
    appliedCouponCode: appliedCoupon?.code || null,
    cargoSize,
    driverDeliveryPaymentMethod,
  }), [
    appliedCoupon?.code,
    cargoSize,
    deliveryLocation,
    driverDeliveryPaymentMethod,
    items,
    paymentType,
    requestedDeliveryDate,
    selectedDeliverySlotId,
    selectedDriver,
    selectedPaymentMethod,
    shippingInfo,
  ])
  const vendorMinimumStatus = useMemo(
    () => evaluateVendorMinimumOrders({ items, vendorProfiles: cartVendorMinimumProfiles }),
    [cartVendorMinimumProfiles, items]
  )
  const selectedDeliverySlot = useMemo(
    () => availableDeliverySlots.find((slot) => slot.id === selectedDeliverySlotId) || null,
    [availableDeliverySlots, selectedDeliverySlotId]
  )
  const { pricing: hookPricing, loading: hookPricingLoading } = useCheckoutPricing(
    items,
    appliedCoupon?.code || couponCode,
    vendorDeliveryStrategy?.deliveryOption,
  )
  const subtotal = useMemo(
    () => authoritativePricing?.subtotal ?? hookPricing?.subtotal ?? 0,
    [authoritativePricing?.subtotal, hookPricing?.subtotal],
  )
  const bulkDiscount = useMemo(
    () => authoritativePricing?.bulkDiscount ?? hookPricing?.bulkDiscount ?? 0,
    [authoritativePricing?.bulkDiscount, hookPricing?.bulkDiscount],
  )
  const discountedSubtotal = useMemo(
    () => authoritativePricing?.discountedSubtotal ?? hookPricing?.discountedSubtotal ?? subtotal,
    [authoritativePricing?.discountedSubtotal, hookPricing?.discountedSubtotal, subtotal],
  )
  const couponDiscount = useMemo(
    () => authoritativePricing?.couponDiscount ?? hookPricing?.couponDiscount ?? 0,
    [authoritativePricing?.couponDiscount, hookPricing?.couponDiscount],
  )
  const netSubtotal = useMemo(
    () => authoritativePricing?.netSubtotal ?? hookPricing?.netSubtotal ?? Math.max(toAmount(discountedSubtotal - couponDiscount), 0),
    [authoritativePricing?.netSubtotal, couponDiscount, discountedSubtotal, hookPricing?.netSubtotal],
  )
  const platformFee = useMemo(
    () => authoritativePricing?.platformFee ?? hookPricing?.taxFees ?? toAmount(netSubtotal * (platformCommissionRate / 100)),
    [authoritativePricing?.platformFee, hookPricing?.taxFees, netSubtotal, platformCommissionRate],
  )
  const productPaymentTotal = useMemo(
    () => authoritativePricing?.productPaymentTotal ?? hookPricing?.productPaymentTotal ?? toAmount(netSubtotal + platformFee),
    [authoritativePricing?.productPaymentTotal, hookPricing?.productPaymentTotal, netSubtotal, platformFee],
  )
  const total = useMemo(
    () => authoritativePricing?.total ?? hookPricing?.finalTotal ?? toAmount(productPaymentTotal + shippingCost),
    [authoritativePricing?.total, hookPricing?.finalTotal, productPaymentTotal, shippingCost],
  )
  const isShippingUnavailable = shippingInfo_data?.available === false
  const shippingBlockingReason = shippingInfo_data?.blockingReason || 'هذا العنوان خارج نطاق التوصيل الحالي.'
  const canContinueToPayment = !vendorMinimumStatus.hasViolations && !shippingLoading && !!shippingInfo_data && !isShippingUnavailable
  const stepOneBlockingMessage = useMemo(() => {
    if (!vendorMinimumStatus.hasViolations) return null
    return buildMinimumOrderMessage(vendorMinimumStatus.firstViolation)
  }, [vendorMinimumStatus])
  const checkoutDeliveryStepBlockers = useMemo(() => {
    const blockers = []

    if (vendorMinimumStatus.hasViolations) {
      blockers.push(buildMinimumOrderMessage(vendorMinimumStatus.firstViolation))
    }

    if (shippingLoading) {
      blockers.push('جاري حساب رسوم التوصيل لهذا العنوان. انتظر لحظة قبل المتابعة إلى الدفع.')
    } else if (!shippingInfo_data) {
      blockers.push('لم يتم تأكيد رسوم التوصيل بعد. تأكد من تحديد العنوان والموقع الدقيق ثم انتظر اكتمال الحساب.')
    } else if (isShippingUnavailable) {
      blockers.push(shippingBlockingReason)
    }

    return blockers
  }, [isShippingUnavailable, shippingBlockingReason, shippingInfo_data, shippingLoading, vendorMinimumStatus])
  const availablePaymentTypes = useMemo(
    () => trustScoreService.resolveAvailablePaymentTypes({
      vendorPolicies: cartVendorPaymentPolicies,
      codEligibility,
    }),
    [cartVendorPaymentPolicies, codEligibility]
  )
  const paymentStepBlockers = useMemo(() => {
    const blockers = []

    if (vendorMinimumStatus.hasViolations) {
      blockers.push(buildMinimumOrderMessage(vendorMinimumStatus.firstViolation))
    }

    if (shippingLoading) {
      blockers.push('جاري حساب رسوم التوصيل. انتظر لحظة قبل تأكيد الطلب.')
    } else if (!shippingInfo_data) {
      blockers.push('لم يتم تأكيد رسوم التوصيل بعد لهذا العنوان.')
    } else if (isShippingUnavailable) {
      blockers.push(shippingBlockingReason)
    }

    if (!availablePaymentTypes.hasAny) {
      blockers.push('لا توجد طريقة دفع مشتركة متاحة لهذه السلة حالياً.')
    } else if (paymentType && !availablePaymentTypes[paymentType]) {
      blockers.push('نوع الدفع المحدد لم يعد متاحاً لهذه السلة. اختر خياراً آخر من الخيارات المتاحة.')
    }

    if (paymentType && paymentType !== 'cod') {
      if (!selectedPaymentMethod || !['paypal', 'bank'].includes(selectedPaymentMethod)) {
        blockers.push('اختر وسيلة دفع للمبلغ المطلوب الآن قبل تأكيد الطلب.')
      } else if (selectedPaymentMethod === 'paypal' && !paypalEnabled) {
        blockers.push(paypalUnavailableReason || 'PayPal غير متاح حالياً لهذا الطلب.')
      } else if (selectedPaymentMethod === 'bank' && !selectedBank) {
        blockers.push('اختر بنك التحويل قبل تأكيد الطلب.')
      }
    }

    if (!paymentTermsAccepted) {
      blockers.push('يجب الموافقة على شروط الدفع قبل تأكيد الطلب.')
    }

    return Array.from(new Set(blockers))
  }, [
    availablePaymentTypes,
    isShippingUnavailable,
    paymentTermsAccepted,
    paymentType,
    paypalEnabled,
    paypalUnavailableReason,
    selectedBank,
    selectedPaymentMethod,
    shippingBlockingReason,
    shippingInfo_data,
    shippingLoading,
    vendorMinimumStatus,
  ])
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

  useEffect(() => {
    if (!checkoutVendorId) {
      return
    }

    if (cartItems.some((item) => item.vendor_id === checkoutVendorId)) {
      return
    }

    clearCheckoutVendor()
  }, [cartItems, checkoutVendorId, clearCheckoutVendor])

  useEffect(() => {
    if (selectedPaymentMethod !== 'paypal' || paymentType === 'cod') {
      setPendingPayPalCheckout(null)
      setPaypalInlineProcessing(false)
    }
  }, [paymentType, selectedPaymentMethod])

  useEffect(() => {
    checkoutRequestKeyRef.current = null
  }, [checkoutRequestSignature])

  // Load available drivers when reaching step 2
  useEffect(() => {
    if (step === 2 && items.length > 0 && canManuallySelectDriver) {
      loadAvailableDrivers()
      return
    }

    setAvailableDrivers([])
    setLoadingDrivers(false)
    setNoDriversAvailable(false)
  }, [canManuallySelectDriver, cargoSize, deliveryLocation.lat, deliveryLocation.lng, driverDeliveryPaymentMethod, items.length, step, vendorLocation?.lat, vendorLocation?.lon]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (hasSingleVendorCart && items.length > 0 && items[0]?.vendor_id) {
      loadVendorLocation(items[0].vendor_id)
      return
    }

    setVendorStoreProfile(null)
    setVendorLocation(null)
    setPreferredDriverProfile(null)
  }, [hasSingleVendorCart, items])

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
          .from('public_profiles')
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
      setCheckoutNotices((prev) => ({
        ...prev,
        paymentMethod: paypalUnavailableReason || 'تم التحويل إلى التحويل البنكي لأن PayPal غير متاح لهذا الطلب حالياً.',
      }))
      setSelectedPaymentMethod('bank')
    }
  }, [paymentType, paypalEnabled, paypalUnavailableReason, selectedPaymentMethod])

  useEffect(() => {
    if (selectedDriver && !availableDrivers.some((driver) => driver.id === selectedDriver)) {
      setSelectedDriver(null)
    }
  }, [availableDrivers, selectedDriver])

  useEffect(() => {
    if (!activeDeliveryDriverProfile || activeDriverSupportedPaymentMethods.length === 0) return
    if (!activeDriverSupportedPaymentMethods.includes(driverDeliveryPaymentMethod)) {
      const nextMethod = activeDriverSupportedPaymentMethods[0]
      setCheckoutNotices((prev) => ({
        ...prev,
        driverDeliveryPayment: `تم تعديل طريقة سداد رسم التوصيل تلقائياً إلى ${DELIVERY_PAYMENT_METHOD_LABELS[nextMethod] || nextMethod} لأن السائق الحالي لا يدعم الطريقة السابقة.`,
      }))
      setDriverDeliveryPaymentMethod(nextMethod)
    }
  }, [activeDeliveryDriverProfile, activeDriverSupportedPaymentMethods, driverDeliveryPaymentMethod])

  const handleDriverDeliveryPaymentMethodChange = (method) => {
    setDriverDeliveryPaymentMethod(method)
    setCheckoutNotices((prev) => ({
      ...prev,
      driverDeliveryPayment: null,
    }))
  }

  const loadVendorLocation = async (vendorId) => {
    try {
      const { data, error } = await supabase
        .from('public_profiles')
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
            .from('public_profiles')
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

  // Sync pricing hook results into local shipping state consumed by the rest of the component.
  useEffect(() => {
    setShippingLoading(hookPricingLoading)
  }, [hookPricingLoading])

  useEffect(() => {
    if (!hookPricing) return
    setAuthoritativePricing(hookPricing)
    setShippingCost(hookPricing.shipping || hookPricing.shippingCost || 0)
    setShippingInfoData(hookPricing.shippingInfoData || { available: true, cost: hookPricing.shipping || 0 })
    setPlatformCommissionRate((prev) => hookPricing.platformCommissionRate ?? prev)
    setErrors((prev) => ({
      ...prev,
      shipping: hookPricing.shippingInfoData?.available === false
        ? (hookPricing.shippingInfoData?.blockingReason || 'هذا العنوان خارج نطاق التوصيل الحالي.')
        : null,
    }))
    setEstimatedDeliveryTime(hookPricing.estimatedDeliveryTime || null)
  }, [hookPricing])

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
    return <Navigate to="/login" state={{ from: '/checkout' }} replace />
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

  if (!hasSingleVendorCart) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <TruckIcon className="w-10 h-10 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">الطلب المتعدد البائعين متوقف مؤقتاً</h2>
        <p className="text-gray-600 mb-6 max-w-xl mx-auto leading-7">
          {MULTI_VENDOR_CHECKOUT_DISABLED_MESSAGE}
        </p>
        <button onClick={() => navigate('/cart')} className="btn-primary">
          العودة إلى السلة
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
    setCheckoutNotices((prev) => ({
      ...prev,
      paymentMethod: nextPaymentType === 'cod' ? null : prev.paymentMethod,
    }))
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
    setCheckoutNotices((prev) => ({
      ...prev,
      paymentMethod: null,
    }))
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

    if (!hasSingleVendorCart) {
      toast.error(MULTI_VENDOR_CHECKOUT_DISABLED_MESSAGE)
      return
    }

    setLoading(true)
    try {
      if (!validatePaymentStep()) {
        setLoading(false)
        return
      }
      if (!checkoutRequestKeyRef.current) {
        checkoutRequestKeyRef.current = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      }

      const checkoutResult = await createCheckoutOrder({
        items,
        shippingInfo,
        deliveryLocation,
        paymentType,
        selectedPaymentMethod,
        selectedDriverId: hasSingleVendorCart ? selectedDriver : null,
        requestedDeliveryDate,
        selectedDeliverySlotId,
        appliedCouponCode: appliedCoupon?.code || null,
        cargoSize,
        driverDeliveryPaymentMethod,
        idempotencyKey: checkoutRequestKeyRef.current,
      })

      const orders = checkoutResult.orders || []
      const serverPricing = checkoutResult.pricing || null
      if (!orders.length) {
        throw new Error('تعذر إنشاء الطلب من الخادم.')
      }

      if (serverPricing) {
        setAuthoritativePricing(serverPricing)
        setShippingCost(serverPricing.shippingCost || 0)
        setShippingInfoData(serverPricing.shippingInfoData || null)
        setEstimatedDeliveryTime(serverPricing.estimatedDeliveryTime || null)
        setPlatformCommissionRate(serverPricing.platformCommissionRate ?? platformCommissionRate)
      }

      let pendingPaypalOrder = null
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

        const paymentRecord = await getLatestOrderPaymentRecord({
          orderId: primaryOrder.id,
          paymentMethod: 'paypal',
          select: 'id',
          allowMissing: false,
        })

        if (!paymentRecord?.id) {
          throw new Error('تعذر العثور على سجل دفع PayPal لتحديثه.')
        }

        await updateOrderPaymentRecord({
          paymentId: paymentRecord.id,
          values: {
            transaction_id: paypalInit.orderId,
            gateway_response: paypalInit,
          },
        })

        pendingPaypalOrder = {
          internalOrderId: primaryOrder.id,
          paypalOrderId: paypalInit.orderId,
          amount: paypalAmount,
          createdAt: new Date().toISOString(),
        }
      }

      // Enrich order data with items, buyer, vendor, and payment_method for the confirmation page
      const enrichedOrders = await Promise.all(
        orders.map(async (order) => {
          // Fetch order items
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('*, product:products(name)')
            .eq('order_id', order.id)

          // Fetch payment method
          const paymentData = await getLatestOrderPaymentRecord({
            orderId: order.id,
            select: 'payment_method, method',
            allowMissing: true,
          })

          // Fetch buyer profile
          const { data: buyerData } = await supabase
            .from('profiles')
            .select('first_name, last_name, email, phone')
            .eq('id', order.buyer_id)
            .maybeSingle()

          // Fetch vendor profile
          const { data: vendorData } = await supabase
            .from('public_profiles')
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

      // Defer confirmation email for PayPal until payment is actually approved.
      if (!(selectedPaymentMethod === 'paypal' && paymentType !== 'cod')) {
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
      }

      if (checkoutVendorId) {
        clearVendorItems(checkoutVendorId)
      } else {
        clearCart()
      }
      setAppliedCoupon(null)
      setCouponCode('')

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

      if (pendingPaypalOrder) {
        setPendingPayPalCheckout(pendingPaypalOrder)
        checkoutRequestKeyRef.current = null
        toast.success('تم إنشاء الطلب. أكمل الآن الدفع عبر أزرار PayPal في نفس الصفحة.')
        setLoading(false)
        return
      }

      checkoutRequestKeyRef.current = null

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
      toast.error(error.message || 'تعذر إتمام الطلب حالياً. حاول مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }

  const handleInlinePayPalApprove = async () => {
    if (!pendingPayPalCheckout?.paypalOrderId || !pendingPayPalCheckout?.internalOrderId) {
      toast.error('تعذر إكمال الدفع: بيانات طلب PayPal غير مكتملة.')
      return
    }

    setPaypalInlineProcessing(true)
    try {
      const { data: captureResult, error: captureError } = await supabase.functions.invoke('capture-paypal-order', {
        body: { orderId: pendingPayPalCheckout.paypalOrderId },
      })

      if (captureError) {
        throw new Error(captureError.message || 'تعذر تأكيد دفع PayPal')
      }

      if (!captureResult || captureResult?.status === 'FAILED') {
        throw new Error('لم تكتمل عملية الدفع عبر PayPal.')
      }

      setPendingPayPalCheckout(null)
      toast.success('تم تأكيد الدفع عبر PayPal بنجاح.')
      navigate(`/order-confirmation/${pendingPayPalCheckout.internalOrderId}?paypal=success`)
    } catch (error) {
      logger.error('Inline PayPal approval failed:', error)
      toast.error(error.message || 'فشل تأكيد عملية الدفع عبر PayPal')
    } finally {
      setPaypalInlineProcessing(false)
    }
  }

  const steps = [
    { num: 1, label: 'الشحن' },
    { num: 2, label: 'التوصيل' },
    { num: 3, label: 'الدفع' },
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
              <>
                <AddressStep
                  selectedAddress={shippingInfo.address}
                  savedAddresses={savedAddresses}
                  onAddressSelect={(address) => {
                    setShippingInfo((prev) => ({ ...prev, address: address.value }))
                    setErrors((prev) => ({ ...prev, address: null }))
                  }}
                  onNewAddress={(address) => {
                    setShippingInfo((prev) => ({ ...prev, address }))
                    setErrors((prev) => ({ ...prev, address: null }))
                  }}
                  userId={user?.id}
                  t={t}
                />
                <CheckoutAddressStep
                  shippingInfo={shippingInfo}
                  setShippingInfo={setShippingInfo}
                  deliveryLocation={deliveryLocation}
                  setDeliveryLocation={setDeliveryLocation}
                  errors={errors}
                  setErrors={setErrors}
                  vendorMinimumStatus={vendorMinimumStatus}
                  stepOneBlockingMessage={stepOneBlockingMessage}
                  onContinue={handleNext}
                />
              </>
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
                    {!canContinueToPayment && checkoutDeliveryStepBlockers.length > 0 && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" data-testid="checkout-payment-blockers">
                        <p className="text-xs font-medium text-amber-900">لماذا لا يمكنك المتابعة إلى الدفع الآن؟</p>
                        <ul className="mt-2 space-y-1 text-xs leading-6 text-amber-800">
                          {checkoutDeliveryStepBlockers.map((reason) => (
                            <li key={reason}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
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
                          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
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
                              data-cy={`driver-select-cargo-${option.value}`}
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
                                  onClick={() => !disabled && handleDriverDeliveryPaymentMethodChange(option.value)}
                                  disabled={disabled}
                                  data-testid={`checkout-driver-payment-${option.value}`}
                                  data-cy={`driver-select-payment-${option.value}`}
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
                          {checkoutNotices.driverDeliveryPayment && (
                            <p className="text-xs text-amber-900 mt-2 leading-6 font-medium" data-testid="checkout-driver-payment-notice">
                              {checkoutNotices.driverDeliveryPayment}
                            </p>
                          )}
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
                              <DriverSelectionStep
                                availableDrivers={availableDrivers}
                                selectedDriver={selectedDriver}
                                onDriverSelect={setSelectedDriver}
                                loading={loadingDrivers}
                                t={t}
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
                    {!canContinueToPayment && checkoutDeliveryStepBlockers.length > 0 && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" data-testid="checkout-payment-blockers">
                        <p className="text-xs font-medium text-amber-900">لماذا لا يمكنك المتابعة إلى الدفع الآن؟</p>
                        <ul className="mt-2 space-y-1 text-xs leading-6 text-amber-800">
                          {checkoutDeliveryStepBlockers.map((reason) => (
                            <li key={reason}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {errors.shipping && <p className="text-red-500 text-xs mt-2" data-testid="checkout-shipping-error">{errors.shipping}</p>}
                  </>
                )}
              </Card>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <PaymentStep
                paymentMethod={selectedPaymentMethod}
                onMethodSelect={handlePaymentMethodChange}
                totalAmount={productPaymentTotal}
                paypalConfig={{
                  vendorPolicies: cartVendorPaymentPolicies,
                  codEligibility,
                  availablePaymentTypes,
                  paymentType,
                  onPaymentTypeChange: handlePaymentTypeChange,
                  paypalEnabled,
                  paypalUnavailableReason,
                  selectedBank,
                  onBankChange: handleBankSelection,
                  termsAccepted: paymentTermsAccepted,
                  onTermsAcceptedChange: handlePaymentTermsChange,
                  errors,
                  disabled: loading,
                  notice: checkoutNotices.paymentMethod,
                  summary: (
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
                  ),
                  onBack: () => setStep(2),
                  paypalInline: {
                    enabled: Boolean(pendingPayPalCheckout?.paypalOrderId) && selectedPaymentMethod === 'paypal' && paymentType !== 'cod',
                    clientId: getPayPalClientId(),
                    disabled: loading || paypalInlineProcessing,
                    forceRenderKey: `${pendingPayPalCheckout?.paypalOrderId || 'none'}:${paypalInlineProcessing}`,
                    createOrder: () => pendingPayPalCheckout?.paypalOrderId,
                    onApprove: async () => {
                      await handleInlinePayPalApprove()
                    },
                    onCancel: () => {
                      toast.error('تم إلغاء عملية PayPal. يمكنك المحاولة مرة أخرى.')
                    },
                    onError: (error) => {
                      logger.error('PayPal inline button error:', error)
                      toast.error('حدث خطأ أثناء تحميل أزرار PayPal')
                    },
                  },
                  onPlaceOrder: () => {
                    if (pendingPayPalCheckout?.paypalOrderId) {
                      toast('لديك طلب PayPal جاهز. أكمل الدفع من الأزرار أسفل الصفحة أولاً.', { icon: 'ℹ️' })
                      return
                    }

                    const form = document.querySelector('[data-testid="checkout-form"]')
                    if (form) {
                      form.requestSubmit()
                    }
                  },
                  submitDisabled: loading || paypalInlineProcessing || !availablePaymentTypes.hasAny || vendorMinimumStatus.hasViolations || shippingLoading || !shippingInfo_data || isShippingUnavailable,
                  submitLabel: loading ? 'Loading...' : `Place Order - ${formatPrice(total)}`,
                  blockers: (loading || !availablePaymentTypes.hasAny || vendorMinimumStatus.hasViolations || shippingLoading || !shippingInfo_data || isShippingUnavailable || paymentStepBlockers.length > 0) ? paymentStepBlockers : [],
                  shippingError: errors.shipping,
                }}
                t={t}
              />
            )}
          </div>

          {/* Right: Order Summary */}
          <div className="lg:col-span-1">
            <CheckoutSummary
              cartItems={items}
              pricing={{
                vendorMinimumStatus,
                subtotal,
                bulkDiscount,
                couponDiscount,
                shippingCost,
                shippingLoading,
                estimatedDeliveryTime,
                shippingInfoData: shippingInfo_data,
                platformFee,
                platformCommissionRate,
                productPaymentTotal,
                grandTotal: total,
                cargoSize,
                driverDeliveryPaymentMethod,
                selectedDeliverySlot,
                requestedDeliveryDate,
                onCouponCodeChange: setCouponCode,
                onApplyCoupon: () => couponCode && validateCoupon(couponCode),
                onRemoveCoupon: () => {
                  setAppliedCoupon(null)
                  setCouponCode('')
                },
                couponLoading,
                appliedCoupon,
                showDriverDeliveryPayment: hasSingleVendorCart ? vendorDeliveryStrategy?.createDeliveryOnAcceptance : shippingCost > 0,
                placeOrderLabel: `Place Order - ${formatPrice(total)}`,
              }}
              couponCode={couponCode}
              onPlaceOrder={null}
              isPending={loading}
              t={t}
            />
          </div>
        </div>
      </form>
    </div>
  )
}

export default CheckoutSimplified
