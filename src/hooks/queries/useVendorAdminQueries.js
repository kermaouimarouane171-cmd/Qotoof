/**
 * Vendor & Admin Queries & Mutations
 * React Query hooks wrapping vendorsApi, usersApi, analyticsApi from api.js
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorsApi, usersApi, analyticsApi } from '@/services/api'
import { CACHE_CONFIG } from '@/constants/apiEndpoints'

// ══════════════════════════════════════════
// QUERY KEYS
// ══════════════════════════════════════════

export const vendorKeys = {
  all: ['vendors'],
  lists: () => [...vendorKeys.all, 'list'],
  list: (filters) => [...vendorKeys.all, 'list', filters],
  detail: (id) => [...vendorKeys.all, 'detail', id],
  stats: (id) => [...vendorKeys.all, 'stats', id],
}

export const adminKeys = {
  all: ['admin'],
  users: () => [...adminKeys.all, 'users'],
  userList: (filters) => [...adminKeys.all, 'users', filters],
  userDetail: (id) => [...adminKeys.all, 'users', id],
  deletedUsers: () => [...adminKeys.all, 'users', 'deleted'],
  stats: () => [...adminKeys.all, 'stats'],
}

// ══════════════════════════════════════════
// VENDOR QUERIES
// ══════════════════════════════════════════

export const useVendors = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: vendorKeys.list(filters),
    queryFn: () => vendorsApi.getAll(filters),
    staleTime: CACHE_CONFIG.PRODUCTS.staleTime,
    keepPreviousData: true,
    ...options,
  })
}

export const useVendor = (id, options = {}) => {
  return useQuery({
    queryKey: vendorKeys.detail(id),
    queryFn: () => vendorsApi.getById(id),
    enabled: !!id,
    ...options,
  })
}

export const useVendorStats = (vendorId, options = {}) => {
  return useQuery({
    queryKey: vendorKeys.stats(vendorId),
    queryFn: () => analyticsApi.getVendorStats(vendorId),
    enabled: !!vendorId,
    staleTime: CACHE_CONFIG.ANALYTICS.staleTime,
    cacheTime: CACHE_CONFIG.ANALYTICS.cacheTime,
    ...options,
  })
}

// ══════════════════════════════════════════
// VENDOR MUTATIONS
// ══════════════════════════════════════════

export const useUpdateVendor = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => vendorsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: vendorKeys.lists() })
    },
  })
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
