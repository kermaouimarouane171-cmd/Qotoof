/**
 * Cart & Payment Queries & Mutations
 * React Query hooks for cart management and payment processing
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hydrateRowsWithProductField, isProductImagesRelationError } from '@/modules/catalog'
import { supabase } from '@/services/supabase'
import { CACHE_CONFIG } from '@/constants/apiEndpoints'

// ══════════════════════════════════════════
// QUERY KEYS
// ══════════════════════════════════════════

export const cartKeys = {
  all: ['cart'],
  items: () => [...cartKeys.all, 'items'],
  count: () => [...cartKeys.all, 'count'],
}

export const paymentKeys = {
  all: ['payments'],
  history: (filters) => [...paymentKeys.all, 'history', filters],
  detail: (id) => [...paymentKeys.all, 'detail', id],
}

// ══════════════════════════════════════════
// CART QUERIES
// DB-004/ARCH-003: These DB-backed cart hooks are DEPRECATED for Beta.
// The Zustand cartStore (src/modules/cart/stores/cartStore.js) is the
// single source of truth for the buyer cart. These hooks query the
// `cart_items` table directly and are not used by any component.
// Do NOT use these in buyer checkout — use useCartStore instead.
// ══════════════════════════════════════════

/** @deprecated Use useCartStore from @/modules/cart instead. */
export const useCart = (options = {}) => {
  return useQuery({
    queryKey: cartKeys.items(),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return []

      const buildQuery = (selectClause) => supabase
        .from('cart_items')
        .select(selectClause)
        .eq('user_id', session.user.id)
        .is('deleted_at', null)

      let result = await buildQuery(`
        id, quantity, created_at,
        product:products(
          id, name, price_per_unit, unit_type,
          stock_quantity, is_available,
          product_images(url, is_primary)
        )
      `)

      if (result.error) {
        if (!isProductImagesRelationError(result.error)) throw result.error

        const fallbackResult = await buildQuery(`
          id, quantity, created_at,
          product:products(
            id, name, price_per_unit, unit_type,
            stock_quantity, is_available
          )
        `)

        if (fallbackResult.error) throw fallbackResult.error

        result = {
          ...fallbackResult,
          data: await hydrateRowsWithProductField(fallbackResult.data || []),
        }
      }

      return result.data || []
    },
    staleTime: CACHE_CONFIG.CART.staleTime,
    cacheTime: CACHE_CONFIG.CART.cacheTime,
    ...options,
  })
}

/** @deprecated Use useCartStore from @/modules/cart instead. */
export const useCartCount = (options = {}) => {
  return useQuery({
    queryKey: cartKeys.count(),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return 0

      const { count, error } = await supabase
        .from('cart_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .is('deleted_at', null)

      if (error) throw error
      return count || 0
    },
    staleTime: CACHE_CONFIG.CART.staleTime,
    ...options,
  })
}

// ══════════════════════════════════════════
// CART MUTATIONS
// ══════════════════════════════════════════

/** @deprecated Use useCartStore from @/modules/cart instead. */
export const useAddToCart = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, quantity = 1 }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // Check if item already in cart
      const { data: existing } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', session.user.id)
        .eq('product_id', productId)
        .is('deleted_at', null)
        .single()

      if (existing) {
        // Update quantity
        const { data, error } = await supabase
          .from('cart_items')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error
        return data
      }

      // Insert new
      const { data, error } = await supabase
        .from('cart_items')
        .insert({
          user_id: session.user.id,
          product_id: productId,
          quantity,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })
}

/** @deprecated Use useCartStore from @/modules/cart instead. */
export const useUpdateCartItem = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, quantity }) => {
      const { data, error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })
}

/** @deprecated Use useCartStore from @/modules/cart instead. */
export const useRemoveFromCart = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId) => {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })
}

/** @deprecated Use useCartStore from @/modules/cart instead. */
export const useClearCart = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', session.user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })
}

// ══════════════════════════════════════════
// PAYMENT QUERIES
// ══════════════════════════════════════════

/**
 * DB-001 FIX: payments table has no user_id column.
 * Query through orders.buyer_id instead.
 * @deprecated Consider using orders API directly for payment history.
 */
export const usePaymentHistory = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: paymentKeys.history(filters),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // DB-001: payments has no user_id — filter through orders.buyer_id
      let query = supabase
        .from('payments')
        .select('*, order:orders!inner(id, status, total_amount, buyer_id)')
        .eq('order.buyer_id', session.user.id)
        .order('created_at', { ascending: false })

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      const limit = filters.limit || 20
      const offset = filters.offset || 0
      query = query.range(offset, offset + limit - 1)

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    staleTime: 60_000,
    ...options,
  })
}

export const usePaymentDetail = (id, options = {}) => {
  return useQuery({
    queryKey: paymentKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, order:orders(*)')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
    ...options,
  })
}

// ══════════════════════════════════════════
// PAYMENT MUTATIONS
// ══════════════════════════════════════════

export const useCreatePayment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, amount, method }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // DB-001: payments table has no user_id column — omit it
      const { data, error } = await supabase
        .from('payments')
        .insert({
          order_id: orderId,
          amount,
          payment_method: method,
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all })
    },
  })
}

export const useConfirmPayment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ paymentId, transactionRef }) => {
      const { data, error } = await supabase
        .from('payments')
        .update({
          status: 'completed',
          transaction_ref: transactionRef,
          paid_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all })
    },
  })
}
