import fs from 'fs'
import path from 'path'

describe('COD / Bank Transfer payment schema compliance', () => {
  const filePath = path.resolve(__dirname, '../../modules/payments/api/paymentGateway.js')
  const source = fs.readFileSync(filePath, 'utf-8')

  // Extract processCodPayment method body
  const codMatch = source.match(
    /async processCodPayment\(\{ orderId, amount, customer \}\) \{([\s\S]*?)\n  \}\n\n  async recordRefund/
  )
  const codBody = codMatch ? codMatch[1] : ''

  // Extract processBankTransfer method body
  const bankMatch = source.match(
    /async processBankTransfer\(\{ orderId, amount, customer \}\) \{([\s\S]*?)\n  \}\n\n  \/\*\*\n   \* Cache bank details/
  )
  const bankBody = bankMatch ? bankMatch[1] : ''

  test('processCodPayment body was extracted', () => {
    expect(codBody.length).toBeGreaterThan(0)
  })

  test('processBankTransfer body was extracted', () => {
    expect(bankBody.length).toBeGreaterThan(0)
  })

  test('processCodPayment does not pass ghost columns to payments insert', () => {
    const insertMatch = codBody.match(/insertPaymentRecord\(\{[\s\S]*?payload: \{([\s\S]*?)\}/)
    const payloadBlock = insertMatch ? insertMatch[1] : ''
    const ghostColumns = ['customer_name', 'customer_phone']
    ghostColumns.forEach((col) => {
      expect(payloadBlock).not.toContain(col)
    })
  })

  test('processBankTransfer does not pass ghost columns to payments insert', () => {
    const insertMatch = bankBody.match(/insertPaymentRecord\(\{[\s\S]*?payload: \{([\s\S]*?)\}/)
    const payloadBlock = insertMatch ? insertMatch[1] : ''
    const ghostColumns = ['reference_number', 'customer_name']
    ghostColumns.forEach((col) => {
      expect(payloadBlock).not.toContain(col)
    })
  })

  test('COD payments payload only contains allowed columns', () => {
    const insertMatch = codBody.match(/insertPaymentRecord\(\{[\s\S]*?payload: \{([\s\S]*?)\}/)
    const payloadBlock = insertMatch ? insertMatch[1] : ''
    const allowedKeys = new Set(['order_id', 'amount', 'payment_method', 'status', 'transaction_id', 'created_at', 'updated_at'])
    const foundKeys = [...payloadBlock.matchAll(/([a-z_]+):/g)].map((m) => m[1])
    foundKeys.forEach((key) => {
      expect(allowedKeys.has(key)).toBe(true)
    })
  })

  test('Bank payments payload only contains allowed columns', () => {
    const insertMatch = bankBody.match(/insertPaymentRecord\(\{[\s\S]*?payload: \{([\s\S]*?)\}/)
    const payloadBlock = insertMatch ? insertMatch[1] : ''
    const allowedKeys = new Set(['order_id', 'amount', 'payment_method', 'status', 'transaction_id', 'created_at', 'updated_at'])
    const foundKeys = [...payloadBlock.matchAll(/([a-z_]+):/g)].map((m) => m[1])
    foundKeys.forEach((key) => {
      expect(allowedKeys.has(key)).toBe(true)
    })
  })

  test('COD metadata is stored in orders.invoice_metadata.cod', () => {
    expect(codBody).toContain('invoice_metadata')
    expect(codBody).toMatch(/cod\s*:/)
  })

  test('Bank metadata is stored in orders.invoice_metadata.bank_transfer', () => {
    expect(bankBody).toContain('invoice_metadata')
    expect(bankBody).toMatch(/bank_transfer\s*:/)
  })

  test('invoice_metadata old data is preserved via merge in COD', () => {
    expect(codBody).toMatch(/\.\.\.existingMeta/)
  })

  test('invoice_metadata old data is preserved via merge in Bank Transfer', () => {
    expect(bankBody).toMatch(/\.\.\.existingMeta/)
  })

  test('existing bank_transfer sub-key is preserved via merge (not fully replaced)', () => {
    expect(bankBody).toMatch(/\.\.\.\(existingMeta\.bank_transfer \|\| \{\}\)/)
  })
})
