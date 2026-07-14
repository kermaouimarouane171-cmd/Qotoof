import fs from 'fs'
import path from 'path'

describe('FG-003 / FG-004 — PayPal Edge Function configuration and error handling', () => {
  const functionsDir = path.resolve(__dirname, '../../../supabase/functions')

  test('create-paypal-order reads MAD exchange rate from environment with safe fallback', () => {
    const source = fs.readFileSync(
      path.resolve(functionsDir, 'create-paypal-order/index.ts'),
      'utf-8'
    )
    expect(source).toMatch(/Deno\.env\.get\(['"]PAYPAL_MAD_EXCHANGE_RATE['"]\)/)
    expect(source).toMatch(/Deno\.env\.get\(['"]PAYPAL_SETTLEMENT_CURRENCY['"]\)/)
    expect(source).not.toMatch(/PAYPAL_MAD_EXCHANGE_RATE\s*=\s*0\.092/)
  })

  test('create-paypal-order does not expose raw PayPal API details to client', () => {
    const source = fs.readFileSync(
      path.resolve(functionsDir, 'create-paypal-order/index.ts'),
      'utf-8'
    )
    // The error response to the buyer should be generic.
    expect(source).toContain('Failed to create PayPal order')
    expect(source).toContain('Could not create PayPal order')
    expect(source).toContain('console.error')
    // Should not forward paypalOrder details into the JSON body
    expect(source).not.toContain('details: paypalOrder?.details')
  })

  test('PayPal shared helper does not include raw PayPal debug JSON in thrown errors', () => {
    const source = fs.readFileSync(
      path.resolve(functionsDir, '_shared/paypalCheckout.ts'),
      'utf-8'
    )
    expect(source).not.toContain('JSON.stringify(data)')
    expect(source).toContain('console.error')
  })

  test('PayPal Edge Functions use CORS helper instead of wildcard', () => {
    const paypalFunctions = ['create-paypal-order', 'capture-paypal-order', 'reconcile-paypal-payments']
    for (const fn of paypalFunctions) {
      const source = fs.readFileSync(path.resolve(functionsDir, `${fn}/index.ts`), 'utf-8')
      expect(source).not.toContain("'Access-Control-Allow-Origin': '*'")
      const usesCorsHelper = source.includes('getCorsHeaders') || source.includes('paypalCorsHeaders')
      expect(usesCorsHelper).toBe(true)
    }
  })

  test('FG-010: create-paypal-order attempts to void previous PayPal order on retry', () => {
    const source = fs.readFileSync(
      path.resolve(functionsDir, 'create-paypal-order/index.ts'),
      'utf-8'
    )
    const sharedSource = fs.readFileSync(
      path.resolve(functionsDir, '_shared/paypalCheckout.ts'),
      'utf-8'
    )
    expect(source).toContain('voidPayPalOrder')
    expect(source).toContain('previousPayPalOrderId')
    expect(source).toContain('transaction_id')
    expect(sharedSource).toContain('export const voidPayPalOrder')
  })
})
