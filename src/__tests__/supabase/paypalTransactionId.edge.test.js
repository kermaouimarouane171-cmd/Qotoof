import fs from 'fs'
import path from 'path'

describe('Phase 2 — transaction_id update moved to Edge Function', () => {
  const checkoutPath = path.resolve(__dirname, '../../../src/pages/CheckoutSimplified.jsx')
  const createPayPalOrderPath = path.resolve(__dirname, '../../../supabase/functions/create-paypal-order/index.ts')
  const checkoutSource = fs.readFileSync(checkoutPath, 'utf-8')
  const edgeSource = fs.readFileSync(createPayPalOrderPath, 'utf-8')

  test('CheckoutSimplified.jsx does not call updateOrderPaymentRecord after create-paypal-order', () => {
    const lines = checkoutSource.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('updateOrderPaymentRecord')) {
        throw new Error(
          `Found updateOrderPaymentReference on line ${i + 1} in CheckoutSimplified.jsx: ${line.trim()}`
        )
      }
    }
  })

  test('CheckoutSimplified.jsx does not import updateOrderPaymentRecord', () => {
    expect(checkoutSource).not.toContain('updateOrderPaymentRecord')
  })

  test('create-paypal-order Edge Function updates payments.transaction_id', () => {
    expect(edgeSource).toContain(".from('payments')")
    expect(edgeSource).toContain("transaction_id: paypalOrder?.id")
    expect(edgeSource).toContain(".update({")
  })

  test('create-paypal-order Edge Function does not write gateway_response or confirmed_at', () => {
    const lines = edgeSource.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('gateway_response')) {
        throw new Error(
          `Found gateway_response in create-paypal-order on line ${i + 1}: ${line.trim()}`
        )
      }
      if (line.includes('confirmed_at')) {
        throw new Error(
          `Found confirmed_at in create-paypal-order on line ${i + 1}: ${line.trim()}`
        )
      }
    }
  })

  test('create-paypal-order Edge Function does not write method column', () => {
    const lines = edgeSource.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes("'method'") || line.includes('"method"')) {
        throw new Error(
          `Found method column reference in create-paypal-order on line ${i + 1}: ${line.trim()}`
        )
      }
    }
  })

  test('create-paypal-order uses service_role/admin client pattern', () => {
    expect(edgeSource).toContain("createClient")
    expect(edgeSource).toContain("SUPABASE_SERVICE_ROLE_KEY")
    expect(edgeSource).toContain("buildAdminClient()")
  })

  test('create-paypal-order response format unchanged', () => {
    expect(edgeSource).toContain("orderId: paypalOrder?.id")
    expect(edgeSource).toContain("status: paypalOrder?.status")
    expect(edgeSource).toContain("approvalUrl")
  })
})
