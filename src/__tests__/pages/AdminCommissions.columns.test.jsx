import fs from 'fs'
import path from 'path'

const commissionsPath = path.resolve(__dirname, '../../pages/admin/Commissions.jsx')
const commissionsSource = fs.readFileSync(commissionsPath, 'utf-8')

describe('Admin Commissions — does not reference ghost columns in Supabase queries', () => {
  test('does not select commission or vendor_amount from payments table', () => {
    expect(commissionsSource).not.toMatch(/\.from\(['"]payments['"]\).*commission/)
    expect(commissionsSource).not.toMatch(/\.from\(['"]payments['"]\).*vendor_amount/)
  })

  test('imports platformSettings to calculate commission dynamically', () => {
    expect(commissionsSource).toContain("import { platformSettings } from '@/services/platformSettings'")
  })

  test('selects only safe columns from payments', () => {
    expect(commissionsSource).toContain('id, order_id, amount, payment_method, status, created_at')
  })

  test('does not select user_id from payments', () => {
    expect(commissionsSource).not.toMatch(/\.from\(['"]payments['"]\).*user_id/)
  })

  test('does not select commission or vendor_amount from payments query', () => {
    expect(commissionsSource).not.toMatch(/\.from\(['"]payments['"]\).*commission/)
    expect(commissionsSource).not.toMatch(/\.from\(['"]payments['"]\).*vendor_amount/)
  })

  test('does not select method, gateway, or metadata from payments', () => {
    expect(commissionsSource).not.toMatch(/\.from\(['"]payments['"]\).*method/)
    expect(commissionsSource).not.toMatch(/\.from\(['"]payments['"]\).*gateway/)
    expect(commissionsSource).not.toMatch(/\.from\(['"]payments['"]\).*metadata/)
  })
})
