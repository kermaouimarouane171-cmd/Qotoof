import fs from 'fs'
import path from 'path'

const reviewsPath = path.resolve(__dirname, '../../pages/admin/Reviews.jsx')
const reviewsSource = fs.readFileSync(reviewsPath, 'utf-8')

describe('Admin Reviews — does not reference ghost columns in Supabase queries or UI', () => {
  const ghostColumns = [
    'is_flagged',
    'flagged_at',
    'admin_notes',
    'approved_by',
    'approved_at',
  ]

  ghostColumns.forEach((col) => {
    test(`does not reference ${col} anywhere in source`, () => {
      expect(reviewsSource).not.toContain(col)
    })
  })

  test('still allows vendor_reply filter (safe column)', () => {
    expect(reviewsSource).toContain("'vendor_reply'")
  })

  test('still filters deleted_at safely', () => {
    expect(reviewsSource).toContain("'deleted_at'")
  })

  test('keeps safe buyer/vendor/product joins', () => {
    expect(reviewsSource).toContain('buyer:profiles')
    expect(reviewsSource).toContain('vendor:profiles')
    expect(reviewsSource).toContain('product:products')
  })
})
