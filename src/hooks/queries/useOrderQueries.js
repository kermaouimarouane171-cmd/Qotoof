/**
 * Order Queries & Mutations
 * React Query hooks wrapping ordersApi from api.js
 * Split from useMarketplaceQueries.js (Phase 2.6) for clearer module ownership.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ordersApi } from '@/services/api'
import { CACHE_CONFIG } from '@/constants/apiEndpoints'

// ══════════════════════════════════════════
// QUERY KEYS
// ══════════════════════════════════════════

export const orderKeys = {
  all: ['orders'],
  lists: () => [...orderKeys.all, 'list'],
  list: (filters) => [...orderKeys.all, 'list', filters],
  details: () => [...orderKeys.all, 'detail'],
  detail: (id) => [...orderKeys.all, 'detail', id],
  deleted: () => [...orderKeys.all, 'deleted'],
}

// ══════════════════════════════════════════
// ORDER QUERIES
// ══════════════════════════════════════════

export const useOrders = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: () => ordersApi.getAll(filters),
    staleTime: CACHE_CONFIG.ORDERS.staleTime,
    cacheTime: CACHE_CONFIG.ORDERS.cacheTime,
    keepPreviousData: true,
    ...options,
  })
}

export const useOrder = (id, options = {}) => {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => ordersApi.getById(id),
    enabled: !!id,
    staleTime: CACHE_CONFIG.ORDERS.staleTime,
    ...options,
  })
}

export const useDeletedOrders = (options = {}) => {
  return useQuery({
    queryKey: orderKeys.deleted(),
    queryFn: () => ordersApi.getDeleted(),
    staleTime: 60_000,
    ...options,
  })
}

// ══════════════════════════════════════════
// ORDER MUTATIONS
// ══════════════════════════════════════════

export const useCreateOrder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderData) => ordersApi.create(orderData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
    },
  })
}

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }) => ordersApi.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
    },
  })
}

export const useDeleteOrder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => ordersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
    },
  })
}

export const useRestoreOrder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => ordersApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })
}
