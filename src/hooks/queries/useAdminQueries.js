/**
 * Admin Queries & Mutations — extracted from useVendorAdminQueries.js (Phase 4.7)
 *
 * No behavior changes. All React Query keys, caching, and invalidation preserved exactly.
 * Re-exported by useVendorAdminQueries.js for backward compatibility.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, analyticsApi } from '@/services/api'
import { CACHE_CONFIG } from '@/constants/apiEndpoints'

// ══════════════════════════════════════════
// QUERY KEYS
// ══════════════════════════════════════════

export const adminKeys = {
  all: ['admin'],
  users: () => [...adminKeys.all, 'users'],
  userList: (filters) => [...adminKeys.all, 'users', filters],
  userDetail: (id) => [...adminKeys.all, 'users', id],
  deletedUsers: () => [...adminKeys.all, 'users', 'deleted'],
  stats: () => [...adminKeys.all, 'stats'],
}

// ══════════════════════════════════════════
// ADMIN USER QUERIES
// ══════════════════════════════════════════

export const useAdminUsers = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: adminKeys.userList(filters),
    queryFn: () => usersApi.getAll(filters),
    staleTime: 30_000,
    keepPreviousData: true,
    ...options,
  })
}

export const useAdminUser = (id, options = {}) => {
  return useQuery({
    queryKey: adminKeys.userDetail(id),
    queryFn: () => usersApi.getById(id),
    enabled: !!id,
    ...options,
  })
}

export const useDeletedUsers = (options = {}) => {
  return useQuery({
    queryKey: adminKeys.deletedUsers(),
    queryFn: () => usersApi.getDeleted(),
    staleTime: 60_000,
    ...options,
  })
}

export const useAdminStats = (options = {}) => {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => analyticsApi.getAdminStats(),
    staleTime: CACHE_CONFIG.ANALYTICS.staleTime,
    cacheTime: CACHE_CONFIG.ANALYTICS.cacheTime,
    ...options,
  })
}

// ══════════════════════════════════════════
// ADMIN USER MUTATIONS
// ══════════════════════════════════════════

export const useUpdateUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => usersApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.userDetail(variables.id) })
      queryClient.invalidateQueries({ queryKey: adminKeys.users() })
    },
  })
}

export const useDeleteUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() })
    },
  })
}

export const useRestoreUser = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => usersApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() })
      queryClient.invalidateQueries({ queryKey: adminKeys.deletedUsers() })
    },
  })
}
