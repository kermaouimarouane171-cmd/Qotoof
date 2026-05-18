const { cartSchemas, orderSchemas, productSchemas } = require('@/utils/validators')

const VALID_UUID = '00000000-0000-4000-8000-000000000001'

describe('quantity validator consistency', () => {
  test('accepts decimal product stock and minimum order quantities', () => {
    const result = productSchemas.create.safeParse({
      name: 'Fresh oranges',
      description: 'Fresh oranges sold by weight for marketplace checkout tests.',
      category: 'fruits',
      price: 12.5,
      stock: 24.75,
      minOrderQuantity: 0.5,
      unitType: 'kg',
      images: ['https://example.com/oranges.png'],
    })

    expect(result.success).toBe(true)
  })

  test('accepts decimal cart quantities', () => {
    const result = cartSchemas.addItem.safeParse({
      productId: VALID_UUID,
      quantity: 1.5,
    })

    expect(result.success).toBe(true)
  })

  test('accepts decimal order quantities', () => {
    const result = orderSchemas.create.safeParse({
      items: [{ productId: VALID_UUID, quantity: 2.25, price: 18 }],
      shippingAddress: {
        street: '123 Market Street',
        city: 'Casablanca',
        state: 'Casablanca-Settat',
        zipCode: '20000',
        country: 'MA',
      },
      paymentMethod: 'bank',
    })

    expect(result.success).toBe(true)
  })
})