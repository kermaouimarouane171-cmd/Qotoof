export const rollbackCheckoutRecords = async ({ supabase, orderIds = [] }) => {
  const uniqueOrderIds = Array.from(new Set((orderIds || []).filter(Boolean)))

  if (!supabase || uniqueOrderIds.length === 0) {
    return { attempted: false, errors: [] }
  }

  const cleanupSteps = [
    { table: 'coupon_redemptions', match: (query) => query.in('order_id', uniqueOrderIds) },
    { table: 'payment_terms_acceptance', match: (query) => query.in('order_id', uniqueOrderIds) },
    { table: 'payments', match: (query) => query.in('order_id', uniqueOrderIds) },
    { table: 'order_items', match: (query) => query.in('order_id', uniqueOrderIds) },
    { table: 'orders', match: (query) => query.in('id', uniqueOrderIds) },
  ]

  const results = await Promise.all(cleanupSteps.map(async ({ table, match }) => {
    try {
      const { error } = await match(supabase.from(table).delete())
      if (error) {
        return { table, error }
      }
      return { table, error: null }
    } catch (error) {
      return { table, error }
    }
  }))

  const errors = results.filter((result) => result.error)
  return {
    attempted: true,
    errors,
    success: errors.length === 0,
  }
}
