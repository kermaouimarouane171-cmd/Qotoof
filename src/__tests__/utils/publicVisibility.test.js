import {
  filterPublicProducts,
  filterPublicVendors,
  isPublicProductVisible,
  isPublicVendorVisible,
} from '@/utils/publicVisibility'

describe('publicVisibility', () => {
  test('hides vendors marked as experimental in Arabic', () => {
    expect(isPublicVendorVisible({
      store_name: 'متجر فاطمة التجريبي',
      first_name: 'فاطمة',
      last_name: 'النجار',
    })).toBe(false)
  })

  test('keeps legitimate vendors visible', () => {
    expect(isPublicVendorVisible({
      store_name: 'مزارع الأطلس',
      first_name: 'أحمد',
      last_name: 'العلمي',
      email: 'vendor@qotoof.ma',
    })).toBe(true)
  })

  test('hides products belonging to experimental vendors', () => {
    expect(isPublicProductVisible({
      name: 'تفاح أخضر',
      description: 'طازج',
      vendor: {
        store_name: 'متجر فاطمة التجريبي',
        first_name: 'فاطمة',
        last_name: 'النجار',
      },
    })).toBe(false)
  })

  test('filters product and vendor collections consistently', () => {
    expect(filterPublicVendors([
      { id: '1', store_name: 'متجر فاطمة التجريبي' },
      { id: '2', store_name: 'ضيعة الريف' },
    ])).toEqual([
      { id: '2', store_name: 'ضيعة الريف' },
    ])

    expect(filterPublicProducts([
      { id: '1', name: 'Tomatoes', vendor: { store_name: 'demo farm' } },
      { id: '2', name: 'Mint', vendor: { store_name: 'Atlas Herbs' } },
    ])).toEqual([
      { id: '2', name: 'Mint', vendor: { store_name: 'Atlas Herbs' } },
    ])
  })
})