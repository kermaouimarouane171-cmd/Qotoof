import fs from 'fs'
import path from 'path'

describe('confirm-bank-transfer/index.ts schema alignment (no non-existent columns)', () => {
  const edgePath = path.resolve(__dirname, '../../../supabase/functions/confirm-bank-transfer/index.ts')
  const source = fs.readFileSync(edgePath, 'utf-8')

  const forbiddenColumns = [
    'gateway_response',
    'payment_proof_url',
    'bank_name',
    'user_id',
    'currency',
    'confirmed_at',
    'method',
  ]

  test.each(forbiddenColumns)(
    'does not write %s to payments update/insert',
    (column) => {
      const lines = source.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes(column) && (line.includes(".from('payments')") || line.includes('.update({') || line.includes('.insert({'))) {
          throw new Error(
            `Found ${column} near payments write on line ${i + 1}: ${line.trim()}`
          )
        }
      }
    }
  )

  test('UPDATE payload contains only safe columns', () => {
    const updateMatch = source.match(/\.update\(\{[\s\S]*?\}\)\s*\.eq\('order_id', orderId\)/)
    if (updateMatch) {
      const updateBlock = updateMatch[0]
      expect(updateBlock).toContain('status:')
      expect(updateBlock).toContain('transaction_id:')
      expect(updateBlock).toContain('updated_at:')
    }
  })

  test('INSERT payload contains only safe columns', () => {
    const insertMatch = source.match(/\.insert\(\{[\s\S]*?\}\)\)/)
    if (insertMatch) {
      const insertBlock = insertMatch[0]
      expect(insertBlock).toContain('order_id:')
      expect(insertBlock).toContain('amount:')
      expect(insertBlock).toContain('payment_method:')
      expect(insertBlock).toContain('status:')
      expect(insertBlock).toContain('transaction_id:')
      expect(insertBlock).toContain('created_at:')
      expect(insertBlock).toContain('updated_at:')
    }
  })

  test('still uses service_role/admin client', () => {
    expect(source).toContain('createClient')
    expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  test('still verifies buyer ownership', () => {
    expect(source).toContain('order.buyer_id !== user.id')
  })

  test('still updates order payment_status', () => {
    expect(source).toContain(".from('orders')")
    expect(source).toContain('payment_status:')
  })
})
