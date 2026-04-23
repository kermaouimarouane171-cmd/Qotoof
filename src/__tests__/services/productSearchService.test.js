import {
  buildProductSearchFiltersFromParams,
  normalizeProductSearchFilters,
  normalizeSearchProduct,
} from '@/services/search/productSearchHelpers'

describe('productSearchService helpers', () => {
  test('normalizes filter aliases and strips empty values', () => {
    expect(normalizeProductSearchFilters({
      query: '  mint  ',
      category: 'herbs',
      subcategory: 'Mint',
      region: 'Rabat',
      priceMin: '10',
      price_max: '80',
      rating: '4',
      in_stock: 'true',
      sortBy: 'priceHigh',
      page: '2',
      hitsPerPage: '12',
    })).toEqual({
      query: 'mint',
      category: 'herbs',
      subcategory: 'Mint',
      region: 'Rabat',
      minPrice: 10,
      maxPrice: 80,
      rating: 4,
      inStock: true,
      sortBy: 'price_desc',
      page: 2,
      hitsPerPage: 12,
    })
  })

  test('normalizes product payloads for shared UI cards', () => {
    const normalized = normalizeSearchProduct({
      id: 'product-1',
      name: 'Fresh Basil',
      price_per_unit: '12.5',
      unit_type: 'kg',
      average_rating: '4.6',
      reviews_count: '8',
      stock_quantity: '14',
      is_available: true,
      product_images: [
        { url: 'secondary.jpg', is_primary: false },
        { url: 'primary.jpg', is_primary: true },
      ],
      vendor: {
        id: 'vendor-1',
        first_name: 'Green',
        last_name: 'Farm',
        city: 'Casablanca',
        is_verified: 1,
      },
    })

    expect(normalized.image_url).toBe('primary.jpg')
    expect(normalized.images).toHaveLength(2)
    expect(normalized.price).toBe(12.5)
    expect(normalized.price_per_unit).toBe(12.5)
    expect(normalized.unit_type).toBe('kg')
    expect(normalized.average_rating).toBe(4.6)
    expect(normalized.reviews_count).toBe(8)
    expect(normalized.in_stock).toBe(true)
    expect(normalized.vendor).toEqual({
      id: 'vendor-1',
      first_name: 'Green',
      last_name: 'Farm',
      store_name: '',
      city: 'Casablanca',
      is_verified: true,
    })
  })

  test('builds filters from URL params used by search pages', () => {
    expect(buildProductSearchFiltersFromParams({
      q: 'olive',
      category: 'fruits',
      subcategory: 'Olives',
      region: 'Meknes',
      minPrice: '20',
      maxPrice: '90',
      rating: '3',
      inStock: 'true',
      sortBy: 'name',
      page: '1',
    })).toEqual({
      query: 'olive',
      category: 'fruits',
      subcategory: 'Olives',
      region: 'Meknes',
      minPrice: 20,
      maxPrice: 90,
      rating: 3,
      inStock: true,
      sortBy: 'name_asc',
      page: 1,
      hitsPerPage: 24,
    })
  })
})