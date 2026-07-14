/**
 * Vendor Queries & Mutations — extracted from useVendorAdminQueries.js (Phase 4.7)
 *
 * No behavior changes. All React Query keys, caching, and invalidation preserved exactly.
 * Re-exported by useVendorAdminQueries.js for backward compatibility.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorsApi, analyticsApi } from '@/services/api'
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
