import fs from 'fs'
import path from 'path'

const dashboardPath = path.resolve(__dirname, '../../pages/admin/Dashboard.jsx')
const dashboardSource = fs.readFileSync(dashboardPath, 'utf-8')

describe('Admin Dashboard — does not reference ghost columns in Supabase queries', () => {
  const ghostColumns = [
    'last_sign_in_at',
  ]

  ghostColumns.forEach((col) => {
    test(`does not reference ${col} anywhere in source`, () => {
      expect(dashboardSource).not.toContain(col)
    })
  })

  test('still references last_seen_at (safe column) for active users', () => {
    expect(dashboardSource).toContain('last_seen_at')
  })

  test('still references safe columns from profiles, orders, products', () => {
    expect(dashboardSource).toContain('role')
    expect(dashboardSource).toContain('is_verified')
    expect(dashboardSource).toContain('total')
    expect(dashboardSource).toContain('status')
    expect(dashboardSource).toContain('created_at')
    expect(dashboardSource).toContain('is_available')
    expect(dashboardSource).toContain('deleted_at')
  })
})
