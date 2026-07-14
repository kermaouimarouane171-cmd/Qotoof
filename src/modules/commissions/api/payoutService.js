import { supabase } from '@/services/supabase'

export const payoutService = {
  sendPayout: async ({ userId, amount, currency = 'EUR', source = 'manual' }) => {
    const { data, error } = await supabase.functions.invoke('send-payout', {
      body: {
        user_id: userId,
        amount,
        currency,
        source,
      },
    })

    if (error) throw error
    if (!data?.success) throw new Error(data?.error || 'Failed to send payout')

    return data
  },
}

export default payoutService
