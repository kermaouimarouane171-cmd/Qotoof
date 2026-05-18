import { supabase } from '@/services/supabase'

export const lookupPublicOrderTracking = async ({ orderNumber, phone }) => {
  const { data, error } = await supabase.functions.invoke('public-order-tracking', {
    body: {
      orderNumber: String(orderNumber || '').trim(),
      phone: String(phone || '').trim(),
    },
  })

  if (error) {
    throw error
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Failed to search tracking')
  }

  return data
}