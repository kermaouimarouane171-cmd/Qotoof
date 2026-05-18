import { supabase } from '@/services/supabase'

export const signInWithServerRateLimit = async ({ email, password, captchaToken = null }) => {
  const { data, error } = await supabase.functions.invoke('secure-login', {
    body: {
      email: String(email || '').trim(),
      password: String(password || ''),
      captchaToken,
    },
  })

  if (error) {
    throw error
  }

  if (!data?.success || !data?.session?.access_token || !data?.session?.refresh_token) {
    throw new Error(data?.error || 'Failed to sign in')
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })

  if (sessionError) {
    throw sessionError
  }

  if (!sessionData?.session || !sessionData?.user) {
    throw new Error('Failed to establish authenticated session')
  }

  return {
    user: sessionData.user,
    session: sessionData.session,
  }
}