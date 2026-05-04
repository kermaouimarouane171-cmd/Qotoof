import { supabase } from '@/services/supabase'

export const STORE_TYPE_RULES = [
  {
    storeType: 'small',
    label: 'متجر صغير',
    description: 'يعتمد على التوصيل الذاتي فقط حتى يصل إلى مرحلة النمو التالية.',
    minProducts: 0,
    maxProducts: 10,
    allowedDeliveryOptions: ['self'],
    defaultDeliveryOption: 'self',
  },
  {
    storeType: 'medium',
    label: 'متجر متوسط',
    description: 'يمكنه الاختيار بين التوصيل الذاتي أو البحث عن سائق حسب كل طلب.',
    minProducts: 11,
    maxProducts: 50,
    allowedDeliveryOptions: ['self', 'find_driver'],
    defaultDeliveryOption: 'self',
  },
  {
    storeType: 'enterprise',
    label: 'متجر مؤسسي',
    description: 'يمكنه العمل عبر البحث عن سائق أو عبر سائق مرتبط ومقبول الشراكة.',
    minProducts: 51,
    maxProducts: null,
    allowedDeliveryOptions: ['find_driver', 'own_driver'],
    defaultDeliveryOption: 'find_driver',
  },
]

export const DELIVERY_OPTION_META = {
  self: {
    value: 'self',
    label: 'التوصيل الذاتي',
    shortLabel: 'ذاتي',
    description: 'البائع يتولى التوصيل بنفسه بدون إنشاء دورة سائق في المنصة.',
  },
  find_driver: {
    value: 'find_driver',
    label: 'البحث عن سائق',
    shortLabel: 'بحث عن سائق',
    description: 'يتم الاعتماد على السائقين المتاحين أو الإسناد التلقائي عند الحاجة.',
  },
  own_driver: {
    value: 'own_driver',
    label: 'السائق المرتبط',
    shortLabel: 'سائق مرتبط',
    description: 'يعتمد المتجر على سائقه المرتبط ويحتاج شراكة مقبولة قبل قبول الطلبات.',
  },
}

export const STORE_SETUP_SELECT = `
  id,
  role,
  store_name,
  store_type,
  delivery_option,
  active_products_count,
  preferred_driver_id,
  has_own_driver,
  partnership_status,
  store_type_updated_at,
  delivery_option_updated_at
`

const arabicNumberFormatter = new Intl.NumberFormat('ar-MA')

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export const formatArabicProductCount = (count, suffix = 'منتج') => {
  return `${arabicNumberFormatter.format(Number(count) || 0)} ${suffix}`
}

export const getStoreTypeRule = (storeType, activeProductsCount = 0) => {
  if (storeType) {
    const explicitRule = STORE_TYPE_RULES.find((rule) => rule.storeType === storeType)
    if (explicitRule) return explicitRule
  }

  return (
    STORE_TYPE_RULES.find((rule) => {
      const matchesMin = (Number(activeProductsCount) || 0) >= rule.minProducts
      const matchesMax = rule.maxProducts === null || (Number(activeProductsCount) || 0) <= rule.maxProducts
      return matchesMin && matchesMax
    }) || STORE_TYPE_RULES[0]
  )
}

export const getNextStoreTypeRule = (storeType) => {
  const currentIndex = STORE_TYPE_RULES.findIndex((rule) => rule.storeType === storeType)
  if (currentIndex === -1) return STORE_TYPE_RULES[1] || null
  return STORE_TYPE_RULES[currentIndex + 1] || null
}

export const getAllowedDeliveryOptions = (storeType, activeProductsCount = 0) => {
  const rule = getStoreTypeRule(storeType, activeProductsCount)
  return rule.allowedDeliveryOptions
    .map((value) => DELIVERY_OPTION_META[value])
    .filter(Boolean)
}

export const isDeliveryOptionAllowed = (storeType, deliveryOption, activeProductsCount = 0) => {
  if (!deliveryOption) return false
  const rule = getStoreTypeRule(storeType, activeProductsCount)
  return rule.allowedDeliveryOptions.includes(deliveryOption)
}

export const getStoreProgress = (activeProductsCount, storeType) => {
  const count = Number(activeProductsCount) || 0
  const currentRule = getStoreTypeRule(storeType, count)
  const nextRule = getNextStoreTypeRule(currentRule.storeType)

  if (!nextRule) {
    return {
      percentage: 100,
      nextStoreType: null,
      remainingProducts: 0,
      remainingProductsLabel: formatArabicProductCount(0),
      headline: 'وصل متجرك إلى أعلى فئة متاحة حالياً.',
    }
  }

  const start = currentRule.minProducts
  const target = nextRule.minProducts
  const span = Math.max(target - start, 1)
  const safeCount = clamp(count, start, target)
  const percentage = clamp(Math.round(((safeCount - start) / span) * 100), 0, 99)
  const remainingProducts = Math.max(target - count, 0)

  return {
    percentage,
    nextStoreType: nextRule.storeType,
    nextStoreTypeLabel: nextRule.label,
    remainingProducts,
    remainingProductsLabel: formatArabicProductCount(remainingProducts),
    headline: `يفصلك ${formatArabicProductCount(remainingProducts)} للوصول إلى ${nextRule.label}.`,
  }
}

export const decorateStoreProfile = (profile) => {
  if (!profile) return null

  const activeProductsCount = Number(profile.active_products_count) || 0
  const rule = getStoreTypeRule(profile.store_type, activeProductsCount)
  const currentDeliveryOption = isDeliveryOptionAllowed(rule.storeType, profile.delivery_option, activeProductsCount)
    ? profile.delivery_option
    : rule.defaultDeliveryOption
  const hasLinkedOwnDriver = Boolean(profile.preferred_driver_id && profile.partnership_status === 'accepted')
  const progress = getStoreProgress(activeProductsCount, rule.storeType)

  return {
    ...profile,
    storeType: rule.storeType,
    storeTypeLabel: rule.label,
    storeTypeDescription: rule.description,
    deliveryOption: currentDeliveryOption,
    deliveryOptionMeta: DELIVERY_OPTION_META[currentDeliveryOption],
    allowedDeliveryOptions: getAllowedDeliveryOptions(rule.storeType, activeProductsCount),
    activeProductsCount,
    activeProductsCountLabel: formatArabicProductCount(activeProductsCount),
    hasLinkedOwnDriver,
    requiresOwnDriverSetup: currentDeliveryOption === 'own_driver' && !hasLinkedOwnDriver,
    progress,
  }
}

export const decorateStoreEvolutionEvent = (event) => {
  if (!event) return null

  return {
    ...event,
    previousStoreTypeLabel: getStoreTypeRule(event.previous_store_type, event.previous_active_products_count).label,
    currentStoreTypeLabel: getStoreTypeRule(event.current_store_type, event.current_active_products_count).label,
    previousDeliveryOptionMeta: event.previous_delivery_option ? DELIVERY_OPTION_META[event.previous_delivery_option] : null,
    currentDeliveryOptionMeta: event.current_delivery_option ? DELIVERY_OPTION_META[event.current_delivery_option] : null,
    previousActiveProductsCountLabel: formatArabicProductCount(event.previous_active_products_count),
    currentActiveProductsCountLabel: formatArabicProductCount(event.current_active_products_count),
  }
}

export const resolveOrderDeliveryStrategy = (rawProfile, selectedDriverId = null) => {
  const profile = decorateStoreProfile(rawProfile)
  const hasLinkedOwnDriver = Boolean(profile?.hasLinkedOwnDriver)

  if (!profile) {
    return {
      deliveryOption: 'self',
      assignedDriverId: null,
      preferredDriverId: null,
      initialOrderStatus: 'pending',
      createDeliveryOnAcceptance: false,
      blocked: false,
      blockedMessage: null,
    }
  }

  if (profile.deliveryOption === 'self') {
    return {
      deliveryOption: 'self',
      assignedDriverId: null,
      preferredDriverId: null,
      initialOrderStatus: 'pending',
      createDeliveryOnAcceptance: false,
      blocked: false,
      blockedMessage: null,
    }
  }

  if (profile.deliveryOption === 'find_driver') {
    return {
      deliveryOption: 'find_driver',
      assignedDriverId: selectedDriverId || null,
      preferredDriverId: null,
      initialOrderStatus: selectedDriverId ? 'pending' : 'awaiting_driver',
      createDeliveryOnAcceptance: true,
      blocked: false,
      blockedMessage: null,
    }
  }

  return {
    deliveryOption: 'own_driver',
    assignedDriverId: hasLinkedOwnDriver ? profile.preferred_driver_id : null,
    preferredDriverId: hasLinkedOwnDriver ? profile.preferred_driver_id : null,
    initialOrderStatus: 'pending',
    createDeliveryOnAcceptance: true,
    blocked: !hasLinkedOwnDriver,
    blockedMessage: !hasLinkedOwnDriver
      ? 'هذا الخيار يتطلب سائقاً مرتبطاً ومقبول الشراكة قبل قبول الطلبات.'
      : null,
  }
}

export const storeTypeService = {
  getStoreTypeRule,
  getNextStoreTypeRule,
  getAllowedDeliveryOptions,
  isDeliveryOptionAllowed,
  formatArabicProductCount,
  getStoreProgress,
  decorateStoreProfile,
  decorateStoreEvolutionEvent,
  resolveOrderDeliveryStrategy,

  async getVendorStoreSetup(vendorId) {
    const { data, error } = await supabase
      .from('profiles')
      .select(STORE_SETUP_SELECT)
      .eq('id', vendorId)
      .single()

    if (error) throw error
    return decorateStoreProfile(data)
  },

  async updateDeliveryOption(vendorId, deliveryOption) {
    const currentSetup = await this.getVendorStoreSetup(vendorId)

    if (!isDeliveryOptionAllowed(currentSetup.storeType, deliveryOption, currentSetup.activeProductsCount)) {
      throw new Error(`خيار ${DELIVERY_OPTION_META[deliveryOption]?.label || 'التوصيل'} غير متاح لنوع متجرك الحالي.`)
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        delivery_option: deliveryOption,
        delivery_option_updated_at: new Date().toISOString(),
      })
      .eq('id', vendorId)
      .select(STORE_SETUP_SELECT)
      .single()

    if (error) throw error
    return decorateStoreProfile(data)
  },

  async getLatestStoreEvolutionEvent(vendorId, { includeAcknowledged = false } = {}) {
    let query = supabase
      .from('store_type_evolution_log')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!includeAcknowledged) {
      query = query.is('acknowledged_at', null)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw error
    return decorateStoreEvolutionEvent(data)
  },

  async acknowledgeStoreEvolutionEvent(eventId, vendorId) {
    const { data, error } = await supabase
      .from('store_type_evolution_log')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('vendor_id', vendorId)
      .select('*')
      .single()

    if (error) throw error
    return decorateStoreEvolutionEvent(data)
  },
}

export const getStoreTypeInfo = async (vendorId) => {
  return storeTypeService.getVendorStoreSetup(vendorId)
}

export const saveDeliveryOption = async (vendorId, option) => {
  return storeTypeService.updateDeliveryOption(vendorId, option)
}

export const checkDeliveryOptionNeeded = async (vendorId) => {
  const setup = await storeTypeService.getVendorStoreSetup(vendorId)
  return {
    needed: (setup?.allowedDeliveryOptions?.length || 0) > 1,
    currentOption: setup?.deliveryOption || null,
    allowedOptions: setup?.allowedDeliveryOptions || [],
  }
}

export default storeTypeService