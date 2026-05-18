import { supabase } from '@/services/supabase'

export const createSupportTicket = async ({
  subject,
  description,
  category = 'general',
  orderId = null,
  attachments = [],
  priority = 'normal',
}) => {
  const { data, error } = await supabase.functions.invoke('create-support-ticket', {
    body: {
      subject: String(subject || '').trim(),
      description: String(description || '').trim(),
      category,
      orderId,
      attachments,
      priority,
    },
  })

  if (error) {
    throw error
  }

  if (!data?.success || !data?.ticket) {
    throw new Error(data?.error || 'Failed to create support ticket')
  }

  return data.ticket
}