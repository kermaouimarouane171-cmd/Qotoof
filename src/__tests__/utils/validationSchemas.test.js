import {
  loginSchema,
  registerSchema,
  passwordResetSchema,
  newPasswordSchema,
  productSchema,
  orderSchema,
  reviewSchema,
  searchSchema,
  validateData,
  useFormValidation,
} from '@/utils/validationSchemas'

describe('validationSchemas', () => {
  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@test.com',
        password: 'Password123!',
      })

      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'Password123!',
      })

      expect(result.success).toBe(false)
    })

    it('should reject short password', () => {
      const result = loginSchema.safeParse({
        email: 'test@test.com',
        password: 'short',
      })

      expect(result.success).toBe(false)
    })

    it('should transform email to lowercase', () => {
      const result = loginSchema.safeParse({
        email: 'TEST@TEST.COM',
        password: 'Password123!',
      })

      expect(result.success).toBe(true)
      expect(result.data.email).toBe('test@test.com')
    })
  })

  describe('registerSchema', () => {
    it('should validate valid registration data', () => {
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'buyer',
      })

      expect(result.success).toBe(true)
    })

    it('should reject mismatched passwords', () => {
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'Password123!',
        confirmPassword: 'Different123!',
        role: 'buyer',
      })

      expect(result.success).toBe(false)
    })

    it('should reject invalid role', () => {
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'admin',
      })

      expect(result.success).toBe(false)
    })

    it('should reject weak password', () => {
      const result = registerSchema.safeParse({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        password: 'weak',
        confirmPassword: 'weak',
        role: 'buyer',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('productSchema', () => {
    it('should validate valid product data', () => {
      const result = productSchema.safeParse({
        name: 'Fresh Tomatoes',
        description: 'Organic tomatoes from Marrakech',
        category: 'vegetables',
        price_per_unit: 10,
        unit_type: 'kg',
        available_quantity: 100,
      })

      expect(result.success).toBe(true)
    })

    it('should reject short product name', () => {
      const result = productSchema.safeParse({
        name: 'AB',
        category: 'vegetables',
        price_per_unit: 10,
        available_quantity: 100,
      })

      expect(result.success).toBe(false)
    })

    it('should reject negative price', () => {
      const result = productSchema.safeParse({
        name: 'Fresh Tomatoes',
        category: 'vegetables',
        price_per_unit: -5,
        available_quantity: 100,
      })

      expect(result.success).toBe(false)
    })

    it('should reject invalid category', () => {
      const result = productSchema.safeParse({
        name: 'Fresh Tomatoes',
        category: 'electronics',
        price_per_unit: 10,
        available_quantity: 100,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('orderSchema', () => {
    it('should validate valid order data', () => {
      const result = orderSchema.safeParse({
        items: [
          {
            product_id: '550e8400-e29b-41d4-a716-446655440000',
            quantity: 2,
            unit_price: 10,
          },
        ],
        shipping_address: '12 Rue Hassan IIreet, Casablanca',
        shipping_city: 'Casablanca',
      })

      expect(result.success).toBe(true)
    })

    it('should reject empty items', () => {
      const result = orderSchema.safeParse({
        items: [],
        shipping_address: '12 Rue Hassan IIreet, Casablanca',
        shipping_city: 'Casablanca',
      })

      expect(result.success).toBe(false)
    })

    it('should reject short address', () => {
      const result = orderSchema.safeParse({
        items: [
          {
            product_id: '550e8400-e29b-41d4-a716-446655440000',
            quantity: 2,
            unit_price: 10,
          },
        ],
        shipping_address: 'Short',
        shipping_city: 'Casablanca',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('reviewSchema', () => {
    it('should validate valid review', () => {
      const result = reviewSchema.safeParse({
        rating: 5,
        comment: 'Great product!',
      })

      expect(result.success).toBe(true)
    })

    it('should reject rating below 1', () => {
      const result = reviewSchema.safeParse({
        rating: 0,
      })

      expect(result.success).toBe(false)
    })

    it('should reject rating above 5', () => {
      const result = reviewSchema.safeParse({
        rating: 6,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('searchSchema', () => {
    it('should validate valid search query', () => {
      const result = searchSchema.safeParse({
        query: 'tomatoes',
      })

      expect(result.success).toBe(true)
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    })

    it('should reject empty query', () => {
      const result = searchSchema.safeParse({
        query: '',
      })

      expect(result.success).toBe(false)
    })

    it('should apply default pagination', () => {
      const result = searchSchema.safeParse({
        query: 'tomatoes',
      })

      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    })
  })

  describe('validateData', () => {
    it('should return success for valid data', () => {
      const result = validateData(loginSchema, {
        email: 'test@test.com',
        password: 'Password123!',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.errors).toBeNull()
    })

    it('should return errors for invalid data', () => {
      const result = validateData(loginSchema, {
        email: 'invalid',
        password: 'short',
      })

      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(Array.isArray(result.errors)).toBe(true)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('useFormValidation', () => {
    it('should create validation hook', () => {
      const hook = useFormValidation(loginSchema)

      expect(hook.validate).toBeDefined()
      expect(hook.validateField).toBeDefined()
    })

    it('should validate data through hook', () => {
      const hook = useFormValidation(loginSchema)
      const result = hook.validate({
        email: 'test@test.com',
        password: 'Password123!',
      })

      expect(result.success).toBe(true)
    })

    it('should validate individual field', () => {
      const hook = useFormValidation(loginSchema)
      const result = hook.validateField('email', 'test@test.com')

      expect(result.success).toBe(true)
    })
  })
})
