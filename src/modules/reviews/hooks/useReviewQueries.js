/**
 * Review Queries & Mutations
 * React Query hooks wrapping reviewsApi from api.js
 * Split from useMarketplaceQueries.js (Phase 2.6) for clearer module ownership.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reviewsApi } from '../api/reviewsApi'
import { CACHE_CONFIG } from '@/constants/apiEndpoints'

// ══════════════════════════════════════════
// QUERY KEYS
// ══════════════════════════════════════════

export const reviewKeys = {
  all: ['reviews'],
  byVendor: (vendorId) => [...reviewKeys.all, 'vendor', vendorId],
  deleted: () => [...reviewKeys.all, 'deleted'],
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
