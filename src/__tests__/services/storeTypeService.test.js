jest.mock('@/services/supabase', () => ({
  supabase: {},
}))

import {
  decorateStoreProfile,
  resolveOrderDeliveryStrategy,
} from '@/services/storeTypeService'

describe('storeTypeService', () => {
  it('1. يفرض التوصيل الذاتي على المتجر الصغير إذا كان الخيار الحالي غير صالح', () => {
    const setup = decorateStoreProfile({
      store_type: 'small',
      delivery_option: 'find_driver',
      active_products_count: 6,
      preferred_driver_id: null,
      partnership_status: null,
    })

    expect(setup.storeType).toBe('small')
    expect(setup.deliveryOption).toBe('self')
    expect(setup.allowedDeliveryOptions.map((option) => option.value)).toEqual(['self'])
  })

  it('2. يحسب التقدم الصحيح للمتجر المتوسط ويُبقي خيار البحث عن سائق متاحاً', () => {
    const setup = decorateStoreProfile({
      store_type: 'medium',
      delivery_option: 'find_driver',
      active_products_count: 15,
      preferred_driver_id: null,
      partnership_status: null,
    })

    expect(setup.storeType).toBe('medium')
    expect(setup.deliveryOption).toBe('find_driver')
    expect(setup.progress.nextStoreType).toBe('enterprise')
    expect(setup.progress.remainingProducts).toBe(36)
  })

  it('3. يحتفظ المتجر المؤسسي بخيار السائق المرتبط عند وجود شراكة مقبولة', () => {
    const setup = decorateStoreProfile({
      store_type: 'enterprise',
      delivery_option: 'own_driver',
      active_products_count: 72,
      preferred_driver_id: 'drv-1',
      partnership_status: 'accepted',
    })

    expect(setup.storeType).toBe('enterprise')
    expect(setup.deliveryOption).toBe('own_driver')
    expect(setup.hasLinkedOwnDriver).toBe(true)
    expect(setup.requiresOwnDriverSetup).toBe(false)
  })

  it('4. يعيد استراتيجية الطلب الذاتي بدون سائق أو دورة توصيل', () => {
    const strategy = resolveOrderDeliveryStrategy({
      store_type: 'small',
      delivery_option: 'self',
      active_products_count: 4,
      preferred_driver_id: null,
      partnership_status: null,
    })

    expect(strategy.deliveryOption).toBe('self')
    expect(strategy.assignedDriverId).toBeNull()
    expect(strategy.initialOrderStatus).toBe('pending')
    expect(strategy.createDeliveryOnAcceptance).toBe(false)
  })

  it('5. يسمح خيار البحث عن سائق بإنشاء طلب awaiting_driver عند عدم اختيار سائق يدوياً', () => {
    const strategy = resolveOrderDeliveryStrategy({
      store_type: 'medium',
      delivery_option: 'find_driver',
      active_products_count: 22,
      preferred_driver_id: null,
      partnership_status: null,
    })

    expect(strategy.deliveryOption).toBe('find_driver')
    expect(strategy.assignedDriverId).toBeNull()
    expect(strategy.initialOrderStatus).toBe('awaiting_driver')
    expect(strategy.createDeliveryOnAcceptance).toBe(true)
  })

  it('6. يمنع خيار السائق المرتبط إذا لم توجد شراكة مقبولة مع سائق', () => {
    const strategy = resolveOrderDeliveryStrategy({
      store_type: 'enterprise',
      delivery_option: 'own_driver',
      active_products_count: 55,
      preferred_driver_id: null,
      partnership_status: null,
    })

    expect(strategy.deliveryOption).toBe('own_driver')
    expect(strategy.blocked).toBe(true)
    expect(strategy.blockedMessage).toContain('سائقاً مرتبطاً')
  })
})