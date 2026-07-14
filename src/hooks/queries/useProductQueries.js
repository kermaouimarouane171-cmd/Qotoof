/**
 * Product Queries & Mutations
 * React Query hooks wrapping productsApi from api.js
 * Split from useMarketplaceQueries.js (Phase 2.6) for clearer module ownership.
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { productsApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { CACHE_CONFIG } from '@/constants/apiEndpoints'

// ══════════════════════════════════════════
// QUERY KEYS
// ══════════════════════════════════════════

export const productKeys = {
  all: ['products'],
  lists: () => [...productKeys.all, 'list'],
  list: (filters) => [...productKeys.all, 'list', filters],
  details: () => [...productKeys.all, 'detail'],
  detail: (id) => [...productKeys.all, 'detail', id],
  pending: () => [...productKeys.all, 'pending'],
  deleted: () => [...productKeys.all, 'deleted'],
}

// ══════════════════════════════════════════
// PRODUCT QUERIES
// ══════════════════════════════════════════

export const useProducts = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => productsApi.getAll(filters),
    staleTime: CACHE_CONFIG.PRODUCTS.staleTime,
    cacheTime: CACHE_CONFIG.PRODUCTS.cacheTime,
    keepPreviousData: true,
    ...options,
  })
}

export const useProduct = (id, options = {}) => {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productsApi.getById(id),
    enabled: !!id,
    staleTime: CACHE_CONFIG.PRODUCTS.staleTime,
    ...options,
  })
}

export const usePendingProducts = (options = {}) => {
  return useQuery({
    queryKey: productKeys.pending(),
    queryFn: () => productsApi.getPending(),
    staleTime: 30_000,
    ...options,
  })
}

export const useDeletedProducts = (options = {}) => {
  return useQuery({
    queryKey: productKeys.deleted(),
    queryFn: () => productsApi.getDeleted(),
    staleTime: 60_000,
    ...options,
  })
}

export const useInfiniteProducts = (filters = {}, options = {}) => {
  return useInfiniteQuery({
    queryKey: [...productKeys.list(filters), 'infinite'],
    queryFn: ({ pageParam = 0 }) =>
      productsApi.getAll({ ...filters, offset: pageParam, limit: 20 }),
    getNextPageParam: (lastPage) => {
      if (!lastPage?.data || lastPage.data.length < 20) return undefined
      return (lastPage.offset || 0) + 20
    },
    staleTime: CACHE_CONFIG.PRODUCTS.staleTime,
    ...options,
  })
}

// ══════════════════════════════════════════
// PRODUCT MUTATIONS
// ══════════════════════════════════════════

export const useCreateProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (productData) => productsApi.create(productData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}

export const useUpdateProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => productsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}

export const useDeleteProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },
  })
}

export const useRestoreProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => productsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export const useApproveProduct = () => {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: (id) => productsApi.approve(id, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export const useRejectProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => productsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export const useBulkApproveProducts = () => {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: (ids) => productsApi.bulkApprove(ids, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}

export const useBulkRejectProducts = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids) => productsApi.bulkReject(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}
