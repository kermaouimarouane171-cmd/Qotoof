import fs from 'fs'
import path from 'path'

describe('paymentRecords.js schema alignment (no method/gateway_response references)', () => {
  const paymentRecordsPath = path.resolve(__dirname, '../../services/paymentRecords.js')
  const checkoutPath = path.resolve(__dirname, '../../pages/CheckoutSimplified.jsx')
  const paymentRecordsSource = fs.readFileSync(paymentRecordsPath, 'utf-8')
  const checkoutSource = fs.readFileSync(checkoutPath, 'utf-8')

  test('paymentRecords.js buildPaymentMethodOrFilter does not reference method.eq in active code', () => {
    // The legacy OR filter used to contain method.eq...; after fix it should only use payment_method.eq
    const activeCodeLines = paymentRecordsSource.split('\n').filter((line) => {
      const trimmed = line.trim()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*')
    })
    for (const line of activeCodeLines) {
      if (line.includes('method.eq')) {
        throw new Error(`Found method.eq reference in paymentRecords.js: ${line}`)
      }
    }
  })

  test('paymentRecords.js still references payment_method in filter logic', () => {
    expect(paymentRecordsSource).toContain("${PAYMENT_METHOD_COLUMN}.eq.")
  })

  test('CheckoutSimplified.jsx does not select method column from payments', () => {
    const activeCodeLines = checkoutSource.split('\n').filter((line) => {
      const trimmed = line.trim()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*')
    })
    for (const line of activeCodeLines) {
      if (line.includes("'payment_method, method'") || line.includes('"payment_method, method"')) {
        throw new Error(`Found select with method column in CheckoutSimplified.jsx: ${line}`)
      }
    }
  })

  test('CheckoutSimplified.jsx does not write gateway_response in payments update payload', () => {
    const activeCodeLines = checkoutSource.split('\n').filter((line) => {
      const trimmed = line.trim()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*')
    })
    for (const line of activeCodeLines) {
      if (line.includes('gateway_response')) {
        throw new Error(`Found gateway_response reference in CheckoutSimplified.jsx: ${line}`)
      }
    }
  })

  test('CheckoutSimplified.jsx still updates transaction_id on payments', () => {
    expect(checkoutSource).toContain('transaction_id: paypalInit.orderId')
  })
})
