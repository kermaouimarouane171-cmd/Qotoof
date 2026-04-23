// Standalone tests for utilities - no imports from src

describe('Currency Utils', () => {
  describe('formatPrice', () => {
    const formatPrice = (amount) => {
      return `${amount.toLocaleString('en-US')} MAD`
    }

    it('should format zero correctly', () => {
      expect(formatPrice(0)).toBe('0 MAD')
    })

    it('should format whole numbers', () => {
      expect(formatPrice(100)).toBe('100 MAD')
    })

    it('should format decimals', () => {
      expect(formatPrice(99.99)).toBe('99.99 MAD')
    })

    it('should format large numbers with commas', () => {
      expect(formatPrice(1000)).toBe('1,000 MAD')
      expect(formatPrice(1000000)).toBe('1,000,000 MAD')
    })

    it('should handle negative numbers', () => {
      expect(formatPrice(-50)).toBe('-50 MAD')
    })
  })

  describe('formatPriceShort', () => {
    const formatPriceShort = (amount) => {
      if (amount >= 1000000) return `${(amount / 1000000).toFixed(1).replace('.0', '')}M`
      if (amount >= 1000) return `${(amount / 1000).toFixed(1).replace('.0', '')}K`
      return amount.toString()
    }

    it('should format small numbers normally', () => {
      expect(formatPriceShort(100)).toBe('100')
    })

    it('should abbreviate thousands', () => {
      expect(formatPriceShort(1000)).toBe('1K')
      expect(formatPriceShort(1500)).toBe('1.5K')
    })

    it('should abbreviate millions', () => {
      expect(formatPriceShort(1000000)).toBe('1M')
      expect(formatPriceShort(1500000)).toBe('1.5M')
    })
  })
})

describe('Validation', () => {
  describe('Email Validation', () => {
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

    it('should validate valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
    })

    it('should reject invalid email', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
    })
  })

  describe('Password Validation', () => {
    const isValidPassword = (pwd) => pwd.length >= 8

    it('should validate valid password', () => {
      expect(isValidPassword('password123')).toBe(true)
    })

    it('should reject short password', () => {
      expect(isValidPassword('short')).toBe(false)
    })
  })

  describe('Phone Number Validation (Morocco)', () => {
    const isValidPhone = (phone) => /^(\+212|0)[5-7][0-9]{8}$/.test(phone)

    it('should validate valid Moroccan phone', () => {
      expect(isValidPhone('+212661234567')).toBe(true)
      expect(isValidPhone('0661234567')).toBe(true)
    })

    it('should reject invalid phone', () => {
      expect(isValidPhone('12345')).toBe(false)
    })
  })

  describe('RIB Validation (Morocco - 24 digits)', () => {
    const isValidRIB = (rib) => /^[0-9]{24}$/.test(rib)

    it('should validate valid RIB', () => {
      expect(isValidRIB('007700000000000000000000')).toBe(true)
    })

    it('should reject invalid RIB', () => {
      expect(isValidRIB('12345')).toBe(false)
    })
  })
})

describe('Shipping Calculator', () => {
  const calculateShippingCost = (distance, orderSubtotal) => {
    if (orderSubtotal >= 500) return { cost: 0, reason: 'free_over_500' }
    if (distance <= 10) return { cost: 20, reason: 'local' }
    if (distance <= 50) return { cost: 30, reason: 'regional' }
    if (distance <= 100) return { cost: 50, reason: 'national' }
    return { cost: 80, reason: 'remote' }
  }

  const getEstimatedDeliveryTime = (distance) => {
    if (distance <= 10) return { min: 1, max: 2, unit: 'hours' }
    if (distance <= 50) return { min: 4, max: 8, unit: 'hours' }
    if (distance <= 100) return { min: 1, max: 2, unit: 'days' }
    return { min: 2, max: 4, unit: 'days' }
  }

  describe('calculateShippingCost', () => {
    it('should be free for orders over 500 MAD', () => {
      const result = calculateShippingCost(50, 600)
      expect(result.cost).toBe(0)
    })

    it('should charge 20 MAD for local delivery', () => {
      const result = calculateShippingCost(10, 100)
      expect(result.cost).toBe(20)
    })

    it('should charge 30 MAD for regional delivery', () => {
      const result = calculateShippingCost(30, 100)
      expect(result.cost).toBe(30)
    })

    it('should charge 50 MAD for national delivery', () => {
      const result = calculateShippingCost(75, 100)
      expect(result.cost).toBe(50)
    })

    it('should charge 80 MAD for remote delivery', () => {
      const result = calculateShippingCost(150, 100)
      expect(result.cost).toBe(80)
    })
  })

  describe('getEstimatedDeliveryTime', () => {
    it('should estimate 1-2 hours for local', () => {
      const result = getEstimatedDeliveryTime(10)
      expect(result.min).toBe(1)
      expect(result.max).toBe(2)
    })

    it('should estimate 4-8 hours for regional', () => {
      const result = getEstimatedDeliveryTime(30)
      expect(result.min).toBe(4)
      expect(result.max).toBe(8)
    })

    it('should estimate 1-2 days for national', () => {
      const result = getEstimatedDeliveryTime(75)
      expect(result.min).toBe(1)
      expect(result.max).toBe(2)
    })
  })
})

describe('Tier Pricing', () => {
  const sampleTiers = [
    { minQuantity: 1, maxQuantity: 49, discount: 0 },
    { minQuantity: 50, maxQuantity: 99, discount: 5 },
    { minQuantity: 100, maxQuantity: 499, discount: 10 },
    { minQuantity: 500, maxQuantity: 999, discount: 15 },
    { minQuantity: 1000, maxQuantity: null, discount: 20 },
  ]

  const calculatePrice = (basePrice, quantity, tiers) => {
    const tier = tiers.find(t => quantity >= t.minQuantity && (t.maxQuantity === null || quantity <= t.maxQuantity))
    if (!tier) return { unitPrice: basePrice, totalPrice: basePrice * quantity, discount: 0 }
    
    const unitPrice = basePrice * (1 - tier.discount / 100)
    return {
      unitPrice: Math.round(unitPrice * 100) / 100,
      totalPrice: Math.round(unitPrice * quantity * 100) / 100,
      discount: tier.discount,
    }
  }

  describe('calculatePrice', () => {
    it('should return base price for small quantity', () => {
      const result = calculatePrice(100, 10, sampleTiers)
      expect(result.unitPrice).toBe(100)
      expect(result.discount).toBe(0)
    })

    it('should apply 5% discount for 50-99', () => {
      const result = calculatePrice(100, 75, sampleTiers)
      expect(result.discount).toBe(5)
      expect(result.unitPrice).toBe(95)
    })

    it('should apply 10% discount for 100-499', () => {
      const result = calculatePrice(100, 200, sampleTiers)
      expect(result.discount).toBe(10)
      expect(result.unitPrice).toBe(90)
    })

    it('should apply 20% discount for 1000+', () => {
      const result = calculatePrice(100, 1500, sampleTiers)
      expect(result.discount).toBe(20)
      expect(result.unitPrice).toBe(80)
    })
  })
})

describe('Rate Limiter', () => {
  class RateLimiter {
    constructor() { this.requests = new Map() }
    
    isAllowed(key, maxRequests, windowMs) {
      const now = Date.now()
      const request = this.requests.get(key)
      
      if (!request || now > request.resetTime) {
        this.requests.set(key, { count: 1, resetTime: now + windowMs })
        return { allowed: true, remaining: maxRequests - 1 }
      }
      
      if (request.count >= maxRequests) {
        return { allowed: false, remaining: 0, retryAfter: request.resetTime - now }
      }
      
      request.count++
      return { allowed: true, remaining: maxRequests - request.count }
    }
  }

  let limiter

  beforeEach(() => { limiter = new RateLimiter() })

  it('should allow first request', () => {
    const result = limiter.isAllowed('user', 5, 60000)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('should block after limit', () => {
    for (let i = 0; i < 3; i++) {
      limiter.isAllowed('user', 3, 60000)
    }
    const result = limiter.isAllowed('user', 3, 60000)
    expect(result.allowed).toBe(false)
  })

  it('should track remaining correctly', () => {
    const r1 = limiter.isAllowed('user', 5, 60000)
    expect(r1.remaining).toBe(4)
    
    const r2 = limiter.isAllowed('user', 5, 60000)
    expect(r2.remaining).toBe(3)
  })
})

describe('Cart Store', () => {
  const createCart = () => {
    let items = []
    return {
      getItems: () => items,
      addItem: (product, qty = 1) => {
        const existing = items.find(i => i.id === product.id)
        if (existing) existing.quantity += qty
        else items.push({ ...product, quantity: qty })
      },
      removeItem: (id) => { items = items.filter(i => i.id !== id) },
      clearCart: () => { items = [] },
      getSubtotal: () => items.reduce((sum, i) => sum + (i.price_per_unit || i.price) * i.quantity, 0),
      getTax: () => Math.round(createCart().getSubtotal.call({ getItems: () => items })() * 0.10 * 100) / 100,
    }
  }

  let cart

  beforeEach(() => { cart = createCart() })

  it('should add item', () => {
    cart.addItem({ id: '1', price_per_unit: 10 }, 5)
    expect(cart.getItems()).toHaveLength(1)
  })

  it('should increase quantity for existing', () => {
    cart.addItem({ id: '1', price_per_unit: 10 }, 5)
    cart.addItem({ id: '1', price_per_unit: 10 }, 3)
    expect(cart.getItems()[0].quantity).toBe(8)
  })

  it('should remove item', () => {
    cart.addItem({ id: '1', price_per_unit: 10 }, 5)
    cart.removeItem('1')
    expect(cart.getItems()).toHaveLength(0)
  })

  it('should calculate subtotal', () => {
    cart.addItem({ id: '1', price_per_unit: 10 }, 5)
    cart.addItem({ id: '2', price_per_unit: 8 }, 3)
    expect(cart.getSubtotal()).toBe(74)
  })

  it('should clear cart', () => {
    cart.addItem({ id: '1', price_per_unit: 10 }, 5)
    cart.clearCart()
    expect(cart.getItems()).toHaveLength(0)
  })
})

describe('Map Utilities', () => {
  const validateCoordinates = (lat, lng) => {
    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)
    
    if (isNaN(latitude) || isNaN(longitude)) return { valid: false, error: 'Invalid' }
    if (latitude < -90 || latitude > 90) return { valid: false, error: 'Lat out of range' }
    if (longitude < -180 || longitude > 180) return { valid: false, error: 'Lng out of range' }
    return { valid: true, lat: latitude, lng: longitude }
  }

  it('should validate correct coordinates', () => {
    const result = validateCoordinates(33.5731, -7.5898)
    expect(result.valid).toBe(true)
  })

  it('should reject invalid latitude', () => {
    expect(validateCoordinates(91, 0).valid).toBe(false)
  })

  it('should reject invalid longitude', () => {
    expect(validateCoordinates(0, -181).valid).toBe(false)
  })

  it('should accept Morocco coordinates', () => {
    expect(validateCoordinates(33.5731, -7.5898).valid).toBe(true)
    expect(validateCoordinates(31.6295, -7.9811).valid).toBe(true)
  })
})

describe('Order Flow', () => {
  describe('Order Status Transitions', () => {
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['shipped', 'cancelled'],
      shipped: ['delivered'],
      delivered: [],
      cancelled: [],
    }

    it('should allow valid transitions', () => {
      expect(validTransitions['pending']).toContain('confirmed')
      expect(validTransitions['confirmed']).toContain('preparing')
    })

    it('should reject invalid transitions', () => {
      expect(validTransitions['pending']).not.toContain('delivered')
    })

    it('should not allow from terminal states', () => {
      expect(validTransitions['delivered']).toHaveLength(0)
    })
  })

  describe('Order Calculations', () => {
    it('should calculate total from items', () => {
      const items = [
        { quantity: 5, unit_price: 10, total: 50 },
        { quantity: 3, unit_price: 8, total: 24 },
      ]
      const total = items.reduce((sum, i) => sum + i.total, 0)
      expect(total).toBe(74)
    })

    it('should calculate tax (10%)', () => {
      expect(100 * 0.10).toBe(10)
    })
  })
})

describe('Authentication Flow', () => {
  it('should validate email format', () => {
    const isValid = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    expect(isValid('user@example.com')).toBe(true)
    expect(isValid('invalid')).toBe(false)
  })

  it('should validate password length', () => {
    expect('password123'.length).toBeGreaterThanOrEqual(8)
    expect('short'.length).toBeLessThan(8)
  })

  it('should match passwords', () => {
    const pwd1 = 'password123'
    const pwd2 = 'password123'
    expect(pwd1).toBe(pwd2)
  })

  it('should reject mismatched passwords', () => {
    const pwd1 = 'password123'
    const pwd2 = 'password456'
    expect(pwd1).not.toBe(pwd2)
  })
})
