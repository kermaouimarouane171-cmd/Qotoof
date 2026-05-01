import { supabase } from '@/services/supabase'

const FUNCTION_NAME = 'auth-admin-ops'

const invokeAuthAdminOp = async (body) => {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body })

  if (error) {
    throw new Error(error.message || 'Failed to invoke auth admin operation')
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Auth admin operation failed')
  }

  return data
}

export const authAdminOps = {
  cleanupPendingSignup: async ({ userId, email }) => {
    return invokeAuthAdminOp({
      action: 'cleanup-pending-signup',
      userId,
      email,
    })
  },

  confirmEmail: async ({ email, otp }) => {
    return invokeAuthAdminOp({
      action: 'confirm-email',
      email,
      otp,
    })
  },

  deleteUser: async (userId) => {
    return invokeAuthAdminOp({
      action: 'delete-user',
      userId,
    })
  },
}

export default authAdminOps