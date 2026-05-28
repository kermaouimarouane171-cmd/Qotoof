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

const assertAdminProfile = async () => {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData?.user?.id) {
    throw new Error('غير مصرح')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    throw new Error('غير مصرح')
  }
}

export const authAdminOps = {
  cleanupPendingSignup: async ({ userId, email }) => {
    await assertAdminProfile()
    return invokeAuthAdminOp({
      action: 'cleanup-pending-signup',
      userId,
      email,
    })
  },

  confirmEmail: async ({ email, otp }) => {
    await assertAdminProfile()
    return invokeAuthAdminOp({
      action: 'confirm-email',
      email,
      otp,
    })
  },

  deleteUser: async (userId) => {
    await assertAdminProfile()
    return invokeAuthAdminOp({
      action: 'delete-user',
      userId,
    })
  },
}

export default authAdminOps