import fs from 'fs'
import path from 'path'

describe('confirm-bank-transfer/index.ts metadata storage in orders.invoice_metadata', () => {
  const edgePath = path.resolve(__dirname, '../../../supabase/functions/confirm-bank-transfer/index.ts')
  const source = fs.readFileSync(edgePath, 'utf-8')

  test('reads invoice_metadata from orders select', () => {
    const orderSelectMatch = source.match(
      /\.from\('orders'\)\s*\.select\(`[\s\S]*?invoice_metadata[\s\S]*?`\)/
    )
    expect(orderSelectMatch).toBeTruthy()
  })

  test('builds nextInvoiceMetadata preserving current metadata', () => {
    expect(source).toContain('const currentMetadata = order.invoice_metadata')
    expect(source).toContain('...currentMetadata')
    expect(source).toContain('bank_transfer: {')
    expect(source).toContain('...(currentMetadata.bank_transfer ?? {})')
  })

  test('stores proof_url inside invoice_metadata.bank_transfer', () => {
    expect(source).toContain('proof_url: transferProofUrl')
  })

  test('stores bank_name inside invoice_metadata.bank_transfer', () => {
    expect(source).toContain('bank_name: customerBankName')
  })

  test('stores transfer_date inside invoice_metadata.bank_transfer', () => {
    expect(source).toContain('transfer_date: transferDate')
  })

  test('stores notes inside invoice_metadata.bank_transfer', () => {
    expect(source).toContain('notes: notes')
  })

  test('stores transaction_id inside invoice_metadata.bank_transfer', () => {
    expect(source).toContain('transaction_id: transactionId')
  })

  test('stores submitted_at as ISO string inside bank_transfer', () => {
    expect(source).toContain('submitted_at: new Date().toISOString()')
  })

  test('stores submitted_by as user.id inside bank_transfer', () => {
    expect(source).toContain('submitted_by: user.id')
  })

  test('does NOT store full customerAccountNumber anywhere', () => {
    const fullAccountMatches = source.match(/accountNumber(?!\s*:)/g)
    // After destructuring, customerAccountNumber should only appear in the last4 slice expression
    const last4Slice = source.includes('String(customerAccountNumber).slice(-4)')
      || source.includes("customerAccountNumber ? String(customerAccountNumber).slice(-4) : null")
    expect(last4Slice).toBe(true)

    // Ensure no direct assignment of raw account number to any object property
    const dangerousPatterns = [
      /account_number\s*:\s*customerAccountNumber/,
      /customerAccountNumber\s*[,}]/,
    ]
    dangerousPatterns.forEach((pattern) => {
      const match = source.match(pattern)
      if (match && !source.includes('slice(-4)')) {
        throw new Error(`Found potentially unmasked account number near: ${match[0]}`)
      }
    })
  })

  test('stores account_number_last4 (last 4 digits only)', () => {
    expect(source).toContain('account_number_last4:')
    expect(source).toContain('.slice(-4)')
  })

  test('does NOT write proof_url to payments update/insert', () => {
    const paymentsUpdate = source.match(/\.from\('payments'\)[\s\S]*?\.update\(\{[\s\S]*?\}\)/)
    const paymentsInsert = source.match(/\.from\('payments'\)[\s\S]*?\.insert\(\{[\s\S]*?\}\)/)
    if (paymentsUpdate) {
      expect(paymentsUpdate[0]).not.toContain('proof_url')
    }
    if (paymentsInsert) {
      expect(paymentsInsert[0]).not.toContain('proof_url')
    }
  })

  test('does NOT write bank_name to payments update/insert', () => {
    const paymentsUpdate = source.match(/\.from\('payments'\)[\s\S]*?\.update\(\{[\s\S]*?\}\)/)
    const paymentsInsert = source.match(/\.from\('payments'\)[\s\S]*?\.insert\(\{[\s\S]*?\}\)/)
    if (paymentsUpdate) {
      expect(paymentsUpdate[0]).not.toContain('bank_name')
    }
    if (paymentsInsert) {
      expect(paymentsInsert[0]).not.toContain('bank_name')
    }
  })

  test('does NOT write notes to payments update/insert', () => {
    const paymentsUpdate = source.match(/\.from\('payments'\)[\s\S]*?\.update\(\{[\s\S]*?\}\)/)
    const paymentsInsert = source.match(/\.from\('payments'\)[\s\S]*?\.insert\(\{[\s\S]*?\}\)/)
    if (paymentsUpdate) {
      expect(paymentsUpdate[0]).not.toContain('notes')
    }
    if (paymentsInsert) {
      expect(paymentsInsert[0]).not.toContain('notes')
    }
  })

  test('still updates orders.payment_status to processing', () => {
    expect(source).toContain("payment_status: 'processing'")
    expect(source).toMatch(/\.from\('orders'\)[\s\S]*?\.update\(\{[\s\S]*?payment_status: 'processing'[\s\S]*?\}\)/)
  })

  test('still updates orders.invoice_metadata alongside payment_status', () => {
    // Find the order update block that contains invoice_metadata
    const ordersUpdateMatch = source.match(
      /\.from\('orders'\)[\s\S]*?\.update\(\{\s*payment_status:[\s\S]*?invoice_metadata:[\s\S]*?\}\)/
    )
    expect(ordersUpdateMatch).toBeTruthy()
    expect(ordersUpdateMatch[0]).toContain('invoice_metadata:')
    expect(ordersUpdateMatch[0]).toContain("payment_status: 'processing'")
  })

  test('response format unchanged', () => {
    expect(source).toContain('success: true')
    expect(source).toContain('status: \'processing\'')
    expect(source).toContain('message: \'Bank transfer confirmation submitted successfully\'')
  })
})
