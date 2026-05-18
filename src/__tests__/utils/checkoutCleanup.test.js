import { rollbackCheckoutRecords } from '@/utils/checkoutCleanup'

describe('rollbackCheckoutRecords', () => {
  test('skips cleanup when there are no order ids', async () => {
    const result = await rollbackCheckoutRecords({ supabase: null, orderIds: [] })

    expect(result).toEqual({ attempted: false, errors: [] })
  })

  test('deletes dependent checkout records before deleting orders', async () => {
    const calls = []
    const supabase = {
      from(table) {
        return {
          delete() {
            return {
              in(column, values) {
                calls.push({ table, column, values })
                return Promise.resolve({ error: null })
              },
            }
          },
        }
      },
    }

    const result = await rollbackCheckoutRecords({
      supabase,
      orderIds: ['o1', 'o2', 'o1'],
    })

    expect(result.success).toBe(true)
    expect(calls).toEqual([
      { table: 'coupon_redemptions', column: 'order_id', values: ['o1', 'o2'] },
      { table: 'payment_terms_acceptance', column: 'order_id', values: ['o1', 'o2'] },
      { table: 'payments', column: 'order_id', values: ['o1', 'o2'] },
      { table: 'order_items', column: 'order_id', values: ['o1', 'o2'] },
      { table: 'orders', column: 'id', values: ['o1', 'o2'] },
    ])
  })

  test('collects cleanup errors without throwing', async () => {
    const supabase = {
      from(table) {
        return {
          delete() {
            return {
              in() {
                return Promise.resolve({
                  error: table === 'payments' ? new Error('delete failed') : null,
                })
              },
            }
          },
        }
      },
    }

    const result = await rollbackCheckoutRecords({
      supabase,
      orderIds: ['o1'],
    })

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].table).toBe('payments')
  })
})
