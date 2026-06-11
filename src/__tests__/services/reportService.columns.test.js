import fs from 'fs'
import path from 'path'

const reportServicePath = path.resolve(__dirname, '../../services/reports/reportService.js')
const reportServiceSource = fs.readFileSync(reportServicePath, 'utf-8')

describe('reportService — does not reference ghost columns in Supabase queries', () => {
  test('does not request total_amount from orders', () => {
    expect(reportServiceSource).not.toContain('total_amount')
    expect(reportServiceSource).toContain('.reduce((sum, o) => sum + (o.total || 0), 0)')
  })

  test('does not request payment_method from orders table', () => {
    // payment_method exists in payments table, not orders table
    const ordersSelects = [...reportServiceSource.matchAll(/\.from\(['"]orders['"]\)[\s\S]*?\.select\(/g)]
    expect(ordersSelects.length).toBeGreaterThanOrEqual(1)
    expect(reportServiceSource).not.toMatch(/\.from\(['"]orders['"]\)[\s\S]*?payment_method/)
  })

  test('does not request full_name from profiles', () => {
    expect(reportServiceSource).not.toContain('full_name')
    expect(reportServiceSource).toContain('first_name')
    expect(reportServiceSource).toContain('last_name')
  })

  test('does not request is_active from profiles', () => {
    expect(reportServiceSource).not.toContain('is_active')
    expect(reportServiceSource).toContain('created_at')
  })

  test('does not request is_active from products', () => {
    expect(reportServiceSource).not.toMatch(/\.from\(['"]products['"]\)[\s\S]*?is_active/)
  })

  test('still references safe columns', () => {
    expect(reportServiceSource).toContain('order_items')
    expect(reportServiceSource).toContain('products')
    expect(reportServiceSource).toContain('profiles')
    expect(reportServiceSource).toContain('status')
    expect(reportServiceSource).toContain('delivered_at')
  })
})
