/**
 * Marketplace Queries & Mutations
 * React Query hooks wrapping existing productsApi, ordersApi, reviewsApi from api.js
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { productsApi, ordersApi, reviewsApi } from '@/services/api'
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

export const orderKeys = {
  all: ['orders'],
  lists: () => [...orderKeys.all, 'list'],
  list: (filters) => [...orderKeys.all, 'list', filters],
  details: () => [...orderKeys.all, 'detail'],
  detail: (id) => [...orderKeys.all, 'detail', id],
  deleted: () => [...orderKeys.all, 'deleted'],
}

export const reviewKeys = {
  all: ['reviews'],
  byVendor: (vendorId) => [...reviewKeys.all, 'vendor', vendorId],
  deleted: () => [...reviewKeys.all, 'deleted'],
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

// ══════════════════════════════════════════
// REVIEW QUERIES & MUTATIONS
// ══════════════════════════════════════════

export const useVendorReviews = (vendorId, options = {}) => {
  return useQuery({
    queryKey: reviewKeys.byVendor(vendorId),
    queryFn: () => reviewsApi.getByVendor(vendorId),
    enabled: !!vendorId,
    staleTime: CACHE_CONFIG.PRODUCTS.staleTime,
    ...options,
  })
}

export const useDeletedReviews = (options = {}) => {
  return useQuery({
    queryKey: reviewKeys.deleted(),
    queryFn: () => reviewsApi.getDeleted(),
    staleTime: 60_000,
    ...options,
  })
}

export const useCreateReview = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reviewData) => reviewsApi.create(reviewData),
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all })
    },
  })
}

export const useDeleteReview = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => reviewsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all })
    },
  })
}

export const useRestoreReview = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => reviewsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all })
    },
  })
}
