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
    expect(commissionsSource).toContain("id, order_id, user_id, amount, status, created_at")
  })
})
