/**
 * Authentication Queries & Mutations
 * React Query hooks for all auth operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import { CACHE_CONFIG } from '@/constants/apiEndpoints'

// ══════════════════════════════════════════
// QUERY KEYS
// ══════════════════════════════════════════

export const authKeys = {
  all: ['auth'],
  session: () => [...authKeys.all, 'session'],
  profile: () => [...authKeys.all, 'profile'],
  profileById: (id) => [...authKeys.all, 'profile', id],
}

// ══════════════════════════════════════════
// QUERIES
// ══════════════════════════════════════════

/**
 * Get current session
 */
export const useSession = (options = {}) => {
  return useQuery({
    queryKey: authKeys.session(),
    queryFn: async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return session
    },
    staleTime: CACHE_CONFIG.PROFILE.staleTime,
    cacheTime: CACHE_CONFIG.PROFILE.cacheTime,
    retry: 1,
    ...options,
  })
}

/**
 * Get current user profile
 */
export const useCurrentUser = (options = {}) => {
  return useQuery({
    queryKey: authKeys.profile(),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return null

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (error) throw error
      return data
    },
    staleTime: CACHE_CONFIG.PROFILE.staleTime,
    cacheTime: CACHE_CONFIG.PROFILE.cacheTime,
    ...options,
  })
}

// ══════════════════════════════════════════
// MUTATIONS
// ══════════════════════════════════════════

/**
 * Register new user
 */
export const useRegister = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ email, password, fullName, role, phone, businessName }) => {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            phone,
          },
        },
      })

      if (authError) throw authError

      // 2. Create profile
      const nameParts = fullName.trim().split(/\s+/)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email,
          first_name: nameParts[0],
          last_name: nameParts.slice(1).join(' ') || '',
          phone: phone || null,
          role,
          store_name: businessName || null,
        })
        .select()
        .single()

      if (profileError) throw profileError

      return { user: authData.user, profile }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all })
    },
  })
}

/**
 * Login user
 */
export const useLogin = () => {
  const queryClient = useQueryClient()
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: async ({ email, password }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileError) throw profileError

      return { session: data.session, user: data.user, profile }
    },
    onSuccess: (data) => {
      setAuth(data.profile, data.session)
      queryClient.setQueryData(authKeys.profile(), data.profile)
      queryClient.setQueryData(authKeys.session(), data.session)
    },
  })
}

/**
 * Logout user
 */
export const useLogout = () => {
  const queryClient = useQueryClient()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      clearAuth()
      queryClient.clear()
      navigate('/login')
    },
  })
}

/**
 * Send verification email / OTP
 */
export const useVerifyEmail = () => {
  return useMutation({
    mutationFn: async ({ email, token }) => {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      })

      if (error) throw error
      return data
    },
  })
}

/**
 * Forgot password - send reset email
 */
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: async ({ email }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error
      return { success: true, message: 'Password reset email sent' }
    },
  })
}

/**
 * Reset password with new password
 */
export const useResetPassword = () => {
  return useMutation({
    mutationFn: async ({ newPassword }) => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error
      return { success: true }
    },
  })
}

/**
 * Update user profile
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient()
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: async (updates) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', session.user.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.profile(), data)
      const session = queryClient.getQueryData(authKeys.session())
      if (session) setAuth(data, session)
    },
  })
}

/**
 * Upload avatar
 */
export const useUploadAvatar = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')

      const fileExt = file.name.split('.').pop()
      const filePath = `avatars/${session.user.id}.${fileExt}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update profile
      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', session.user.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(authKeys.profile(), data)
    },
  })
}

/**
 * Change password
 */
export const useChangePassword = () => {
  return useMutation({
    mutationFn: async ({ newPassword }) => {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error
      return { success: true }
    },
  })
}

/**
 * Delete account
 */
export const useDeleteAccount = () => {
  const queryClient = useQueryClient()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')

      // Soft delete profile
      const { error } = await supabase
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', session.user.id)

      if (error) throw error

      // Sign out
      await supabase.auth.signOut()
    },
    onSuccess: () => {
      clearAuth()
      queryClient.clear()
      navigate('/login')
    },
  })
}
