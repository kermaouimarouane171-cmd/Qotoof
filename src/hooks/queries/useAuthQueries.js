/**
 * Authentication Queries & Mutations
 * React Query hooks for all auth operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import { CACHE_CONFIG } from '@/constants/apiEndpoints'

const resolveMutationResult = (result, fallbackMessage) => {
  if (result?.success === false) {
    throw new Error(result.error || result.message || fallbackMessage)
  }

  return result
}

const splitFullName = (fullName = '') => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean)

  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  }
}

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
  const signUp = useAuthStore((s) => s.signUp)

  return useMutation({
    mutationFn: async ({
      email,
      password,
      fullName,
      firstName,
      lastName,
      role,
      phone,
      businessName,
      captchaToken = null,
    }) => {
      const derivedName = splitFullName(fullName)
      const result = await signUp(email, password, {
        firstName: firstName || derivedName.firstName,
        lastName: lastName || derivedName.lastName,
        email,
        phone,
        role,
        businessName,
      }, captchaToken)

      return resolveMutationResult(result, 'Failed to register')
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
  const signIn = useAuthStore((s) => s.signIn)

  return useMutation({
    mutationFn: async ({ email, password, captchaToken = null, redirectTo = null }) => {
      const result = await signIn(email, password, captchaToken, redirectTo)
      return resolveMutationResult(result, 'Failed to sign in')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all })
    },
  })
}

/**
 * Logout user
 */
export const useLogout = () => {
  const queryClient = useQueryClient()
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async () => {
      const result = await signOut()
      return resolveMutationResult(result, 'Failed to sign out')
    },
    onSuccess: () => {
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
  const resetPassword = useAuthStore((s) => s.resetPassword)

  return useMutation({
    mutationFn: async ({ email }) => {
      const result = await resetPassword(email)
      return resolveMutationResult(result, 'Failed to send password reset email')
    },
  })
}

/**
 * Reset password with new password
 */
export const useResetPassword = () => {
  const updatePassword = useAuthStore((s) => s.updatePassword)

  return useMutation({
    mutationFn: async ({ newPassword }) => {
      const result = await updatePassword(newPassword)
      return resolveMutationResult(result, 'Failed to update password')
    },
  })
}

/**
 * Update user profile
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient()
  const updateProfile = useAuthStore((s) => s.updateProfile)

  return useMutation({
    mutationFn: async (updates) => {
      const result = await updateProfile(updates)
      return resolveMutationResult(result, 'Failed to update profile')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.profile() })
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
  const updatePassword = useAuthStore((s) => s.updatePassword)

  return useMutation({
    mutationFn: async ({ newPassword }) => {
      const result = await updatePassword(newPassword)
      return resolveMutationResult(result, 'Failed to change password')
    },
  })
}

/**
 * Delete account
 */
export const useDeleteAccount = () => {
  const queryClient = useQueryClient()
  const deleteAccount = useAuthStore((s) => s.deleteAccount)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async ({ confirmationText = 'DELETE' } = {}) => {
      const result = await deleteAccount(confirmationText)
      return resolveMutationResult(result, 'Failed to delete account')
    },
    onSuccess: () => {
      queryClient.clear()
      navigate('/login')
    },
  })
}
