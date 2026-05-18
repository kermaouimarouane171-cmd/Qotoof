import {
  isProductImagesRelationError,
  mergeProductImages,
  runProductImageFallbackQuery,
} from '@/services/productImages'

describe('productImages helpers', () => {
  test('detects missing product_images relation errors from PostgREST', () => {
    expect(isProductImagesRelationError({
      message: "Could not find a relationship between 'products' and 'product_images' in the schema cache",
    })).toBe(true)

    expect(isProductImagesRelationError({ message: 'Random failure' })).toBe(false)
  })

  test('merges fetched images back into product payloads', () => {
    const merged = mergeProductImages(
      [
        { id: 'product-1', name: 'Basil' },
        { id: 'product-2', name: 'Mint', image_url: 'existing.jpg' },
      ],
      [
        { id: 'image-2', product_id: 'product-1', url: 'secondary.jpg', is_primary: false },
        { id: 'image-1', product_id: 'product-1', url: 'primary.jpg', is_primary: true },
      ],
    )

    expect(merged[0].images).toEqual([
      { id: 'image-2', product_id: 'product-1', url: 'secondary.jpg', is_primary: false },
      { id: 'image-1', product_id: 'product-1', url: 'primary.jpg', is_primary: true },
    ])
    expect(merged[0].product_images).toEqual(merged[0].images)
    expect(merged[0].image_url).toBe('primary.jpg')
    expect(merged[1].images).toEqual([])
    expect(merged[1].image_url).toBe('existing.jpg')
  })

  test('hydrates single-record fallback queries', async () => {
    const result = await runProductImageFallbackQuery({
      buildQuery: async (selectClause) => {
        if (selectClause.includes('product_images')) {
          return {
            data: null,
            error: {
              message: "Could not find a relationship between 'products' and 'product_images' in the schema cache",
            },
          }
        }

        return {
          data: { id: 'product-1', name: 'Basil' },
          error: null,
        }
      },
      selectWithImages: '*, product_images(url, is_primary)',
      selectWithoutImages: '*',
      hydrate: async (products) => products.map((product) => ({
        ...product,
        images: [{ url: 'primary.jpg', is_primary: true }],
        image_url: 'primary.jpg',
      })),
    })

    expect(result.data).toEqual({
      id: 'product-1',
      name: 'Basil',
      images: [{ url: 'primary.jpg', is_primary: true }],
      image_url: 'primary.jpg',
    })
  })
})