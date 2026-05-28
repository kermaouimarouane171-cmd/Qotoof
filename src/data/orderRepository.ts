import { supabase } from '@/services/supabase'
import type { PostgrestError } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'

type OrderUpdate = Database['public']['Tables']['orders']['Update']

export const fetchOrderStatusContext = async (orderId: string) => {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, buyer_id, vendor_id, order_number')
    .eq('id', orderId)
    .single()

  return {
    data,
    error: error as PostgrestError | null,
  }
}

export const updateOrderById = async (
  orderId: string,
  updatePayload: Record<string, unknown>,
) => {
  const { data, error } = await supabase
    .from('orders')
    .update(updatePayload as OrderUpdate)
    .eq('id', orderId)
    .select()
    .single()

  return {
    data,
    error: error as PostgrestError | null,
  }
}

export const insertOrderNotification = async ({
  userId,
  orderId,
  orderNumber,
  previousStatus,
  status,
  metadata,
}: {
  userId?: string | null
  orderId: string
  orderNumber?: string | null
  previousStatus: string
  status: string
  metadata: Record<string, unknown>
}) => {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId || null,
      type: 'order',
      title: 'Order Status Updated',
      message: `Order ${orderNumber || orderId} moved to ${status}`,
      data: {
        order_id: orderId,
        previous_status: previousStatus,
        status,
        metadata,
      } as Json,
      is_read: false,
      created_at: new Date().toISOString(),
    })

  return {
    error: error as PostgrestError | null,
  }
}
