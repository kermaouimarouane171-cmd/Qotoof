import fs from 'fs'
import path from 'path'

describe('paypalCheckout.ts schema alignment (no gateway_response/confirmed_at writes)', () => {
  const paypalCheckoutPath = path.resolve(__dirname, '../../../supabase/functions/_shared/paypalCheckout.ts')
  const source = fs.readFileSync(paypalCheckoutPath, 'utf-8')

  test('does not write gateway_response to payments update', () => {
    const lines = source.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('gateway_response') && line.includes('payments')) {
        throw new Error(
          `Found gateway_response referenced near payments update on line ${i + 1}: ${line.trim()}`
        )
      }
    }
  })

  test('does not write confirmed_at to payments update', () => {
    const lines = source.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('confirmed_at') && line.includes('payments')) {
        throw new Error(
          `Found confirmed_at referenced near payments update on line ${i + 1}: ${line.trim()}`
        )
      }
    }
  })

  test('paymentUpdate object still contains status, transaction_id, and updated_at', () => {
    expect(source).toMatch(/status:\s*paymentStatus/)
    expect(source).toMatch(/transaction_id:\s*paypalOrderId/)
    expect(source).toMatch(/updated_at:\s*now/)
  })

  test('persistPayPalOrderState still updates orders table', () => {
    expect(source).toMatch(/\.from\(['"]payments['"]\)\s*\.update\(paymentUpdate\)/)
  })
})
