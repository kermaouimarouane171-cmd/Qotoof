import fs from 'fs'
import path from 'path'

describe('PayPal refundPayPalPayment schema compliance', () => {
  const filePath = path.resolve(__dirname, '../../services/paymentGateway.js')
  const source = fs.readFileSync(filePath, 'utf-8')

  // Extract the refundPayPalPayment method body (from signature to start of next method)
  const methodMatch = source.match(
    /async refundPayPalPayment\(payment, amount, reason = ''\) \{([\s\S]*?)\n  \}\n\n  \/\*\*\n   \* Refund CMI payment/
  )
  const methodBody = methodMatch ? methodMatch[1] : ''

  test('method body was extracted', () => {
    expect(methodBody.length).toBeGreaterThan(0)
  })

  test('does not write ghost columns to payments update', () => {
    // Extract only the updatePaymentRecordById call block inside refundPayPalPayment
    const updateMatch = methodBody.match(/updatePaymentRecordById\(\{[\s\S]*?\}\s*\)\s*\n/)
    const updateBlock = updateMatch ? updateMatch[0] : ''
    const ghostColumns = ['refund_amount', 'refund_reason', 'refunded_at', 'gateway_response']
    ghostColumns.forEach((col) => {
      expect(updateBlock).not.toContain(col)
    })
  })

  test('payments update only uses allowed columns (status, updated_at)', () => {
    const updateMatch = methodBody.match(/updatePaymentRecordById\(\{[\s\S]*?values: \{([\s\S]*?)\}/)
    expect(updateMatch).toBeTruthy()
    const valuesBlock = updateMatch[1]
    const allowedKeys = new Set(['status', 'updated_at'])
    const foundKeys = [...valuesBlock.matchAll(/([a-z_]+):/g)].map((m) => m[1])
    foundKeys.forEach((key) => {
      expect(allowedKeys.has(key)).toBe(true)
    })
  })

  test('stores refund metadata in orders.invoice_metadata.paypal_refund', () => {
    expect(methodBody).toContain('invoice_metadata')
    expect(methodBody).toMatch(/paypal_refund\s*:/)
  })

  test('preserves existing invoice_metadata via merge', () => {
    expect(methodBody).toMatch(/\.\.\.existingMeta/)
  })

  test('PayPal API call is outside DB retry scope', () => {
    const paypalCallIndex = methodBody.indexOf('supabase.functions.invoke(\'refund-paypal-payment\'') // corrected quote type for matching
    const withRetryIndex = methodBody.indexOf('withRetry(')
    expect(paypalCallIndex).toBeGreaterThan(-1)
    expect(withRetryIndex).toBeGreaterThan(-1)
    expect(paypalCallIndex).toBeLessThan(withRetryIndex)
  })

  test('recordRefund is wrapped in try/catch (non-blocking)', () => {
    expect(methodBody).toMatch(/try \{\s*await this\.recordRefund/)
    expect(methodBody).toMatch(/catch \(recordErr\)/)
    expect(methodBody).toMatch(/console\.warn/)
  })

  test('recordRefund does not break the flow', () => {
    // return statement must come after the try/catch block, not inside it
    const returnIndex = methodBody.indexOf('return { success: true')
    const catchCloseIndex = methodBody.lastIndexOf('}')
    expect(returnIndex).toBeGreaterThan(-1)
    expect(returnIndex).toBeGreaterThan(methodBody.indexOf('catch (recordErr)'))
  })
})
