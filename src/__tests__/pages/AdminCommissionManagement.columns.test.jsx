import fs from 'fs'
import path from 'path'

const commissionManagementPath = path.resolve(__dirname, '../../pages/admin/CommissionManagement.jsx')
const commissionManagementSource = fs.readFileSync(commissionManagementPath, 'utf-8')

describe('Admin CommissionManagement — does not reference ghost tables in Supabase queries', () => {
  test('does not query vendor_monthly_sales table', () => {
    expect(commissionManagementSource).not.toContain(".from('vendor_monthly_sales')")
  })

  test('queries orders and profiles tables instead', () => {
    expect(commissionManagementSource).toContain(".from('orders')")
    expect(commissionManagementSource).toContain(".from('profiles')")
  })

  test('imports platformSettings for commission rate', () => {
    expect(commissionManagementSource).toContain("import { platformSettings } from '@/services/platformSettings'")
  })
})
