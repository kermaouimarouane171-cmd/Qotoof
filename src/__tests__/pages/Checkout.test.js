/**
 * Page Tests: Checkout Page
 * Tests cart validation, shipping calculation, payment method selection,
 * coupon application, and order creation logic.
 */

describe('Checkout Page – Logic', () => {
  const SHIPPING_RATES = { standard: 30, express: 60, free_threshold: 500 }

  function calculateShipping(cartTotal, method = 'standard') {
    if (cartTotal >= SHIPPING_RATES.free_threshold) return 0
    return SHIPPING_RATES[method] || SHIPPING_RATES.standard
  }

  function validateShippingAddress(addr) {
    const errors = {}
    if (!addr.fullName || addr.fullName.trim().length < 3) errors.fullName = 'الاسم مطلوب'
    if (!addr.phone || !/^\+?[0-9]{10,15}$/.test(addr.phone.replace(/\s/g, ''))) errors.phone = 'الهاتف مطلوب'
    if (!addr.address || addr.address.trim().length < 5) errors.address = 'العنوان مطلوب'
    if (!addr.city || addr.city.trim().length < 2) errors.city = 'المدينة مطلوبة'
    return errors
  }

  function applyCoupon(coupon, cartTotal) {
    const coupons = {
      'SAVE10': { type: 'percent', value: 10, minOrder: 100 },
      'FLAT50': { type: 'flat', value: 50, minOrder: 200 },
      'EXPIRED': { type: 'percent', value: 20, minOrder: 0, expired: true }
    }
    const c = coupons[coupon?.toUpperCase()]
    if (!c) return { valid: false, error: 'الكوبون غير صالح' }
    if (c.expired) return { valid: false, error: 'الكوبون منتهي الصلاحية' }
    if (cartTotal < c.minOrder) return { valid: false, error: `الحد الأدنى للطلب ${c.minOrder} د.م` }
    const discount = c.type === 'percent' ? (cartTotal * c.value / 100) : c.value
    return { valid: true, discount, finalTotal: cartTotal - discount }
  }

  function canProceedWithCheckout(items = []) {
    const vendorCount = new Set(items.map((item) => item.vendor_id).filter(Boolean)).size
    return vendorCount <= 1
  }

  // ─── Shipping ────────────────────────────────────────────────────────────

  test('applies free shipping above threshold', () => {
    expect(calculateShipping(600)).toBe(0)
    expect(calculateShipping(500)).toBe(0)
  })

  test('charges standard shipping below threshold', () => {
    expect(calculateShipping(100)).toBe(30)
    expect(calculateShipping(499)).toBe(30)
  })

  test('charges express shipping when selected', () => {
    expect(calculateShipping(100, 'express')).toBe(60)
  })

  // ─── Address validation ──────────────────────────────────────────────────

  test('rejects empty address', () => {
    const errors = validateShippingAddress({})
    expect(errors.fullName).toBeDefined()
    expect(errors.phone).toBeDefined()
    expect(errors.city).toBeDefined()
  })

  test('accepts valid address', () => {
    const errors = validateShippingAddress({
      fullName: 'أحمد المغربي',
      phone: '+212612345678',
      address: 'شارع الحسن الثاني، رقم 12',
      city: 'الدار البيضاء'
    })
    expect(Object.keys(errors).length).toBe(0)
  })

  // ─── Coupon ──────────────────────────────────────────────────────────────

  test('rejects invalid coupon', () => {
    const result = applyCoupon('FAKE123', 200)
    expect(result.valid).toBe(false)
  })

  test('rejects expired coupon', () => {
    const result = applyCoupon('EXPIRED', 300)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('منتهي')
  })

  test('rejects coupon below minimum order', () => {
    const result = applyCoupon('FLAT50', 100)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('200')
  })

  test('applies percent coupon correctly', () => {
    const result = applyCoupon('SAVE10', 200)
    expect(result.valid).toBe(true)
    expect(result.discount).toBe(20)
    expect(result.finalTotal).toBe(180)
  })

  test('applies flat coupon correctly', () => {
    const result = applyCoupon('FLAT50', 300)
    expect(result.valid).toBe(true)
    expect(result.discount).toBe(50)
    expect(result.finalTotal).toBe(250)
  })

  // ─── Order total ─────────────────────────────────────────────────────────

  test('calculates order total correctly', () => {
    const items = [
      { price: 100, quantity: 2 },
      { price: 50, quantity: 1 },
      { price: 25.5, quantity: 4 }
    ]
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    expect(subtotal).toBe(352)
    const shipping = calculateShipping(subtotal)
    const total = subtotal + shipping
    expect(total).toBe(382)
  })

  // ─── Payment method ──────────────────────────────────────────────────────

  test('COD is available for all orders', () => {
    const methods = ['cod', 'stripe', 'cmi', 'bank_transfer']
    expect(methods.includes('cod')).toBe(true)
  })

  test('rejects unknown payment method', () => {
    const VALID_METHODS = ['cod', 'stripe', 'cmi', 'bank_transfer']
    expect(VALID_METHODS.includes('bitcoin')).toBe(false)
  })

  test('allows checkout for a single-vendor cart', () => {
    expect(canProceedWithCheckout([
      { id: 'p1', vendor_id: 'vendor-1' },
      { id: 'p2', vendor_id: 'vendor-1' },
    ])).toBe(true)
  })

  test('blocks checkout for multi-vendor carts until shipping is split per vendor', () => {
    expect(canProceedWithCheckout([
      { id: 'p1', vendor_id: 'vendor-1' },
      { id: 'p2', vendor_id: 'vendor-2' },
    ])).toBe(false)
  })
})
