import fs from 'fs'
import path from 'path'

describe('verify-cmi-callback Edge Function schema compliance', () => {
  const filePath = path.resolve(__dirname, '../../../supabase/functions/verify-cmi-callback/index.ts')
  const source = fs.readFileSync(filePath, 'utf-8')

  test('payments update only uses confirmed columns', () => {
    const paymentsUpdateMatch = source.match(/\.from\('payments'\)[\s\S]*?\.update\((\{[\s\S]*?\})\)/)
    expect(paymentsUpdateMatch).toBeTruthy()
    const payload = paymentsUpdateMatch[1]
    const allowedColumns = new Set(['status', 'transaction_id', 'updated_at'])
    const keys = [...payload.matchAll(/([a-z_]+):/g)].map(m => m[1])
    keys.forEach(key => {
      expect(allowedColumns.has(key)).toBe(true)
    })
  })

  test('does not write ghost columns to payments update', () => {
    const ghostColumns = [
      'gateway_response',
      'auth_code',
      'reference_number',
      'paid_at',
      'method',
      'user_id',
      'currency',
      'confirmed_at',
    ]
    // Isolate the payments update block to avoid false positives from other tables
    const paymentsBlock = source.match(/\.from\('payments'\)[\s\S]*?\.eq\('order_id', originalOrderId\)/)?.[0] || ''
    ghostColumns.forEach(col => {
      expect(paymentsBlock).not.toContain(col)
    })
  })

  test('stores CMI metadata in orders.invoice_metadata.cmi', () => {
    expect(source).toContain('invoice_metadata')
    expect(source).toMatch(/cmi:\s*\{/)
  })

  test('preserves existing invoice_metadata via merge', () => {
    expect(source).toContain('...existingMeta')
  })

  test('fetches current invoice_metadata before merge', () => {
    expect(source).toContain(".from('orders')")
    expect(source).toContain(".select('invoice_metadata')")
    expect(source).toContain('.maybeSingle()')
  })

  test('financial_audit_log insert does not throw on error', () => {
    const auditBlock = source.match(/from\('financial_audit_log'\)[\s\S]*?if \(auditError\) \{[\s\S]*?\}/)?.[0] || ''
    expect(auditBlock).toBeTruthy()
    expect(auditBlock).not.toContain('throw')
  })
})
