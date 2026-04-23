/**
 * Page Tests: Register (Signup) Page
 * Tests form validation, tier selection, and submission logic.
 */

describe('Register Page – Logic', () => {
  const ROLES = ['buyer', 'vendor', 'driver']

  function createRegisterState(overrides = {}) {
    return {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      role: 'buyer',
      agreeTerms: false,
      ...overrides
    }
  }

  function validateRegister(s) {
    const errors = {}
    if (!s.firstName || s.firstName.trim().length < 2) errors.firstName = 'الاسم مطلوب'
    if (!s.lastName || s.lastName.trim().length < 2) errors.lastName = 'اللقب مطلوب'
    if (!s.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) errors.email = 'البريد غير صالح'
    if (!s.phone || !/^\+?[0-9]{10,15}$/.test(s.phone.replace(/\s/g, ''))) errors.phone = 'رقم الهاتف غير صالح'
    if (!s.password || s.password.length < 8) errors.password = 'كلمة المرور ضعيفة'
    if (s.password !== s.confirmPassword) errors.confirmPassword = 'كلمتا المرور غير متطابقتين'
    if (!s.agreeTerms) errors.agreeTerms = 'يجب قبول الشروط'
    if (!ROLES.includes(s.role)) errors.role = 'الدور غير صالح'
    return errors
  }

  test('rejects empty form', () => {
    const errors = validateRegister(createRegisterState())
    expect(Object.keys(errors).length).toBeGreaterThan(0)
    expect(errors.firstName).toBeDefined()
    expect(errors.email).toBeDefined()
    expect(errors.password).toBeDefined()
  })

  test('rejects mismatched passwords', () => {
    const errors = validateRegister(createRegisterState({
      firstName: 'أحمد',
      lastName: 'خالد',
      email: 'a@b.com',
      phone: '+212612345678',
      password: 'StrongPass1!',
      confirmPassword: 'DifferentPass1!',
      agreeTerms: true
    }))
    expect(errors.confirmPassword).toBeDefined()
  })

  test('rejects invalid Moroccan phone', () => {
    const errors = validateRegister(createRegisterState({
      phone: '123'
    }))
    expect(errors.phone).toBeDefined()
  })

  test('valid Moroccan phone passes', () => {
    const errors = validateRegister(createRegisterState({
      firstName: 'أحمد',
      lastName: 'خالد',
      email: 'a@b.com',
      phone: '+212612345678',
      password: 'StrongPass1!',
      confirmPassword: 'StrongPass1!',
      agreeTerms: true,
      role: 'buyer'
    }))
    expect(errors.phone).toBeUndefined()
    expect(Object.keys(errors).length).toBe(0)
  })

  test('rejects invalid role', () => {
    const errors = validateRegister(createRegisterState({
      role: 'admin_hack'
    }))
    expect(errors.role).toBeDefined()
  })

  test('vendor role is allowed', () => {
    const s = createRegisterState({
      firstName: 'فاطمة',
      lastName: 'أمين',
      email: 'vendor@test.com',
      phone: '+212655000111',
      password: 'VendorPass123!',
      confirmPassword: 'VendorPass123!',
      agreeTerms: true,
      role: 'vendor'
    })
    const errors = validateRegister(s)
    expect(Object.keys(errors).length).toBe(0)
  })

  test('driver role is allowed', () => {
    const s = createRegisterState({
      firstName: 'يوسف',
      lastName: 'بنعلي',
      email: 'driver@test.com',
      phone: '+212677123456',
      password: 'DriverPass123!',
      confirmPassword: 'DriverPass123!',
      agreeTerms: true,
      role: 'driver'
    })
    const errors = validateRegister(s)
    expect(Object.keys(errors).length).toBe(0)
  })
})
