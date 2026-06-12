import fs from 'fs'
import path from 'path'

const productDetailPath = path.resolve(__dirname, '../../pages/ProductDetail.jsx')
const productDetailSource = fs.readFileSync(productDetailPath, 'utf-8')

const storeDetailPath = path.resolve(__dirname, '../../pages/StoreDetail.jsx')
const storeDetailSource = fs.readFileSync(storeDetailPath, 'utf-8')

describe('Public pages — reviews.is_flagged ghost column removed', () => {
  test('ProductDetail.jsx does not reference is_flagged', () => {
    expect(productDetailSource).not.toContain("is_flagged")
  })

  test('StoreDetail.jsx does not reference is_flagged', () => {
    expect(storeDetailSource).not.toContain("is_flagged")
  })

  test('ProductDetail.jsx still queries reviews table', () => {
    expect(productDetailSource).toContain(".from('reviews')")
  })

  test('StoreDetail.jsx still queries reviews table', () => {
    expect(storeDetailSource).toContain(".from('reviews')")
  })

  test('ProductDetail.jsx reviews query still filters by product_id', () => {
    expect(productDetailSource).toContain(".eq('product_id', id)")
  })

  test('StoreDetail.jsx reviews query still filters by vendor_id', () => {
    expect(storeDetailSource).toContain(".eq('vendor_id', id)")
  })

  test('ProductDetail.jsx reviews query still excludes soft-deleted rows', () => {
    expect(productDetailSource).toContain(".is('deleted_at', null)")
  })

  test('StoreDetail.jsx reviews query still excludes soft-deleted rows', () => {
    expect(storeDetailSource).toContain(".is('deleted_at', null)")
  })
})
