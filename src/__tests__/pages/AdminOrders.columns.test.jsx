import fs from 'fs'
import path from 'path'

const ordersPath = path.resolve(__dirname, '../../pages/admin/Orders.jsx')
const ordersSource = fs.readFileSync(ordersPath, 'utf-8')

describe('Admin Orders — does not reference ghost columns in Supabase queries', () => {
  test('payments select does not contain ghost columns method, gateway, metadata', () => {
    // Extract the .select('...') string after .from('payments')
    const paymentsMatch = ordersSource.match(/\.from\(['"]payments['"]\)[\s\S]*?\.select\('([^']*)'\)/)
    expect(paymentsMatch).toBeTruthy()
    const paymentsSelect = paymentsMatch[1]
    const cols = paymentsSelect.split(',').map((c) => c.trim())
    expect(cols).not.toContain('method')
    expect(cols).not.toContain('gateway')
    expect(cols).not.toContain('metadata')
    // Safe columns must still be present
    expect(cols).toContain('payment_method')
    expect(cols).toContain('transaction_id')
  })

  test('return_requests selects do not contain ghost columns', () => {
    // Extract all .select(`...`) strings after .from('return_requests')
    const returnMatches = [...ordersSource.matchAll(/\.from\(['"]return_requests['"]\)[\s\S]*?\.select\(`([\s\S]*?)`\)/g)]
    expect(returnMatches.length).toBeGreaterThanOrEqual(1)
    returnMatches.forEach((match) => {
      const sel = match[1].replace(/\s+/g, ' ')
      const cols = sel.split(',').map((c) => c.trim().split(':')[0]).filter(Boolean)
      expect(cols).not.toContain('description')
      expect(cols).not.toContain('item_ids')
      expect(cols).not.toContain('admin_response')
      expect(cols).not.toContain('admin_id')
      // Safe columns must still be present
      expect(cols).toContain('reason')
      expect(cols).toContain('status')
    })
  })

  test('return_requests update payload does not contain ghost columns', () => {
    const updateMatch = ordersSource.match(/\.from\(['"]return_requests['"]\)[\s\S]*?\.update\(\{([\s\S]*?)\}\)/)
    expect(updateMatch).toBeTruthy()
    const updateBody = updateMatch[1].replace(/\s+/g, ' ')
    expect(updateBody).not.toContain('admin_response')
    expect(updateBody).not.toContain('admin_id')
    expect(updateBody).toContain('status')
  })

  test('still references safe core columns from orders and profiles', () => {
    expect(ordersSource).toContain('order_number')
    expect(ordersSource).toContain('total')
    expect(ordersSource).toContain('status')
    expect(ordersSource).toContain('buyer_id')
    expect(ordersSource).toContain('vendor_id')
    expect(ordersSource).toContain('order_items')
  })
})
