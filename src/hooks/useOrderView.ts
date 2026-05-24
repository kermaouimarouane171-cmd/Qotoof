import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/services/supabase'
import type { PostgrestError } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type OrderView = Database['public']['Functions']['get_order_view']['Returns']

type UseOrderViewResult = {
  order: OrderView | null
  loading: boolean
  error: PostgrestError | null
  refetch: () => Promise<{ data: OrderView | null; error: PostgrestError | null }>
  data: OrderView | null
  isLoading: boolean
}

export function useOrderView(orderId?: string | null): UseOrderViewResult {
  const [order, setOrder] = useState<OrderView | null>(null)
  const [loading, setLoading] = useState(Boolean(orderId))
  const [error, setError] = useState<PostgrestError | null>(null)

  const fetchOrderView = useCallback(async (): Promise<{ data: OrderView | null; error: PostgrestError | null }> => {
    if (!orderId) {
      setOrder(null)
      setLoading(false)
      setError(null)
      return { data: null, error: null }
    }

    setLoading(true)
    setError(null)

    const response = await supabase.rpc('get_order_view', {
      p_order_id: orderId,
    })

    if (response.error) {
      setError(response.error)
      setOrder(null)
    } else {
      setOrder(response.data as OrderView)
    }

    setLoading(false)
    return response
  }, [orderId])

  useEffect(() => {
    fetchOrderView()
  }, [fetchOrderView])

  return {
    order,
    loading,
    error,
    refetch: fetchOrderView,
    data: order,
    isLoading: loading,
  }
}
