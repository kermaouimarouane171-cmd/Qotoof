import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { logger } from '../utils/logger.js'

// Helper: Get i18n translation
const getTranslation = (key, fallback) => {
  try {
    const lang = localStorage.getItem('language') || 'en'
    const translations = {
      en: {
        'cart.added': 'Added to cart',
        'cart.removed': 'Removed from cart',
        'cart.cleared': 'Cart cleared',
        'cart.quantityUpdated': 'Quantity updated',
        'cart.outOfStock': 'This product is out of stock',
        'cart.exceedsAvailable': 'Requested quantity exceeds available stock',
        'cart.belowMinimum': 'Quantity must be at least {min} {unit}',
        'cart.priceChanged': 'Price changed for {product}',
        'cart.unavailable': '{product} is no longer available',
        'cart.removedUnavailable': 'Removed from cart (unavailable)',
      },
      fr: {
        'cart.added': 'Ajouté au panier',
        'cart.removed': 'Retiré du panier',
        'cart.cleared': 'Panier vidé',
        'cart.quantityUpdated': 'Quantité mise à jour',
        'cart.outOfStock': 'Ce produit est en rupture de stock',
        'cart.exceedsAvailable': 'La quantité demandée dépasse le stock disponible',
        'cart.belowMinimum': 'La quantité doit être d\'au moins {min} {unit}',
        'cart.priceChanged': 'Le prix a changé pour {product}',
        'cart.unavailable': '{product} n\'est plus disponible',
        'cart.removedUnavailable': 'Retiré du panier (non disponible)',
      },
      ar: {
        'cart.added': 'تمت الإضافة إلى السلة',
        'cart.removed': 'تمت الإزالة من السلة',
        'cart.cleared': 'تم تفريغ السلة',
        'cart.quantityUpdated': 'تم تحديث الكمية',
        'cart.outOfStock': 'هذا المنتج غير متوفر في المخزون',
        'cart.exceedsAvailable': 'الكمية المطلوبة تتجاوز المخزون المتاح',
        'cart.belowMinimum': 'يجب أن تكون الكمية على الأقل {min} {unit}',
        'cart.priceChanged': 'تغير السعر لـ {product}',
        'cart.unavailable': '{product} لم يعد متوفراً',
        'cart.removedUnavailable': 'تمت الإزالة من السلة (غير متوفر)',
      }
    }
    return translations[lang]?.[key] || translations.en[key] || fallback
  } catch {
    return fallback
  }
}

// Helper: Replace placeholders in translation string
const replacePlaceholders = (str, values) => {
  return str.replace(/\{(\w+)\}/g, (match, key) => values[key] || match)
}

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      lastValidated: null,

      /**
       * Add item to cart with validation
       * - Checks product availability
       * - Validates min_order_quantity
       * - Checks available_quantity
       * - Checks vendor operating hours
       */
      addItem: async (product, quantity) => {
        const { items } = get()

        // Check if product is available
        if (product.is_available === false) {
          toast.error(getTranslation('cart.outOfStock', 'This product is out of stock'))
          return false
        }

        // Check if vendor is currently open
        if (product.vendor_id) {
          try {
            const { data: isOpen } = await supabase.rpc('is_vendor_open', {
              p_vendor_id: product.vendor_id,
            })

            if (isOpen === false) {
              toast.error(
                'This vendor is currently closed. You can still add items to cart, but orders will be processed when they reopen.',
                { duration: 6000 }
              )
              // Allow adding to cart but warn the user
            }
          } catch (err) {
            // RPC might not exist yet — don't block
            logger.debug('Vendor schedule check skipped:', err.message)
          }
        }

        // Validate min_order_quantity
        const minQty = product.min_order_quantity || 1
        if (quantity < minQty) {
          const msg = replacePlaceholders(
            getTranslation('cart.belowMinimum', 'Quantity must be at least {min} {unit}'),
            { min: minQty, unit: product.unit_type || 'units' }
          )
          toast.error(msg)
          return false
        }

        // Validate against available_quantity
        if (product.available_quantity !== null && product.available_quantity !== undefined) {
          const existingItem = items.find(item => item.id === product.id)
          const currentQty = existingItem?.quantity || 0
          const totalRequested = currentQty + quantity
          
          if (totalRequested > product.available_quantity) {
            toast.error(getTranslation('cart.exceedsAvailable', 'Requested quantity exceeds available stock'))
            return false
          }
        }

        // Add or update item
        const existingItem = items.find(item => item.id === product.id)
        
        if (existingItem) {
          set({
            items: items.map(item =>
              item.id === product.id
                ? { 
                    ...item, 
                    quantity: item.quantity + quantity,
                    // Update price in case it changed
                    price_per_unit: product.price_per_unit || product.price,
                    is_available: product.is_available,
                    available_quantity: product.available_quantity
                  }
                : item
            )
          })
        } else {
          // Store only essential data to minimize localStorage usage
          set({
            items: [...items, {
              id: product.id,
              name: product.name,
              price_per_unit: product.price_per_unit || product.price,
              unit_type: product.unit_type || 'kg',
              quantity,
              min_order_quantity: minQty,
              is_available: product.is_available,
              available_quantity: product.available_quantity,
              vendor_id: product.vendor_id,
              vendor_name: product.vendor?.store_name || product.vendor_name || product.store_name || product.vendor?.first_name || '',
              image_url: product.images?.[0]?.url || product.image_url || null,
              category: product.category,
              subcategory: product.subcategory || null
            }]
          })
        }

        toast.success(getTranslation('cart.added', 'Added to cart'))
        return true
      },

      /**
       * Remove item from cart
       */
      removeItem: (productId) => {
        set({
          items: get().items.filter(item => item.id !== productId)
        })
        toast.success(getTranslation('cart.removed', 'Removed from cart'))
      },

      /**
       * Update quantity with validation
       * - Enforces min_order_quantity
       * - Enforces available_quantity
       */
      updateQuantity: (productId, quantity) => {
        const { items } = get()
        const item = items.find(i => i.id === productId)

        if (!item) return

        // Remove if quantity is 0 or negative
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }

        // Validate min_order_quantity
        const minQty = item.min_order_quantity || 1
        if (quantity < minQty) {
          const msg = replacePlaceholders(
            getTranslation('cart.belowMinimum', 'Quantity must be at least {min} {unit}'),
            { min: minQty, unit: item.unit_type || 'units' }
          )
          toast.error(msg)
          return
        }

        // Validate against available_quantity
        if (item.available_quantity !== null && item.available_quantity !== undefined) {
          if (quantity > item.available_quantity) {
            toast.error(getTranslation('cart.exceedsAvailable', 'Requested quantity exceeds available stock'))
            return
          }
        }

        set({
          items: items.map(i =>
            i.id === productId ? { ...i, quantity } : i
          )
        })

        toast.success(getTranslation('cart.quantityUpdated', 'Quantity updated'))
      },

      /**
       * Clear entire cart
       */
      clearCart: () => {
        set({ items: [], lastValidated: null })
        toast.success(getTranslation('cart.cleared', 'Cart cleared'))
      },

      /**
       * Get total number of distinct items (for badge count)
       */
      getItemCount: () => {
        return get().items.length
      },

      /**
       * Get total quantity of all items (for display)
       */
      getTotalQuantity: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      /**
       * Calculate subtotal (before tax and shipping)
       */
      getSubtotal: () => {
        return get().items.reduce((total, item) => {
          const price = item.price_per_unit || 0
          return total + (price * item.quantity)
        }, 0)
      },

      /**
       * Alias for backward compatibility
       */
      getTotal: function() {
        return this.getSubtotal()
      },

      /**
       * Calculate tax — fresh agricultural products are TVA-exempt (0%) in Morocco
       * (Article 92 CGI — exonération produits agricoles bruts)
       */
      getTax: () => {
        const subtotal = get().getSubtotal()
        const taxRate = Number(import.meta.env.VITE_TAX_RATE ?? 0)
        return subtotal * taxRate
      },

      /**
       * Get distinct vendor count
       */
      getVendorCount: () => {
        const vendorIds = new Set(get().items.map(item => item.vendor_id).filter(Boolean))
        return vendorIds.size
      },

      /**
       * Validate cart items against database
       * - Checks if products still exist
       * - Checks availability
       * - Updates prices if changed
       * - Removes unavailable items
       */
      validateCart: async () => {
        const { items } = get()
        if (items.length === 0) return { valid: true, changes: [] }

        const changes = []
        const validItems = []

        try {
          // Fetch fresh data for all cart items
          const productIds = items.map(item => item.id)
          const { data: freshProducts, error } = await supabase
            .from('products')
            .select('id, name, price_per_unit, is_available, available_quantity')
            .in('id', productIds)

          if (error) throw error

          const freshMap = new Map(freshProducts.map(p => [p.id, p]))

          // Check each cart item
          for (const item of items) {
            const fresh = freshMap.get(item.id)

            if (!fresh) {
              // Product no longer exists
              changes.push({ type: 'removed', item, reason: 'Product deleted' })
              toast.error(
                replacePlaceholders(
                  getTranslation('cart.unavailable', '{product} is no longer available'),
                  { product: item.name }
                )
              )
              continue
            }

            if (!fresh.is_available) {
              // Product is out of stock
              changes.push({ type: 'removed', item, reason: 'Out of stock' })
              toast.error(
                replacePlaceholders(
                  getTranslation('cart.unavailable', '{product} is no longer available'),
                  { product: item.name }
                )
              )
              continue
            }

            // Check if price changed
            const oldPrice = item.price_per_unit
            const newPrice = fresh.price_per_unit
            if (Math.abs(oldPrice - newPrice) > 0.01) {
              changes.push({ type: 'price_changed', item, oldPrice, newPrice })
              toast.error(
                replacePlaceholders(
                  getTranslation('cart.priceChanged', 'Price changed for {product}'),
                  { product: item.name }
                )
              )
            }

            // Check if quantity exceeds available
            let adjustedQuantity = item.quantity
            if (fresh.available_quantity !== null && item.quantity > fresh.available_quantity) {
              adjustedQuantity = fresh.available_quantity
              changes.push({ type: 'quantity_adjusted', item, oldQty: item.quantity, newQty: adjustedQuantity })
            }

            // Add valid item with updated data
            validItems.push({
              ...item,
              price_per_unit: newPrice,
              is_available: fresh.is_available,
              available_quantity: fresh.available_quantity,
              quantity: adjustedQuantity
            })
          }

          // Update cart with valid items
          set({ 
            items: validItems,
            lastValidated: new Date().toISOString()
          })

          return { valid: changes.length === 0, changes }
        } catch (error) {
          logger.error('Cart validation error:', error)
          return { valid: false, error: error.message }
        }
      }
    }),
    {
      name: 'cart-storage',
      version: 2, // Increment version to trigger migration
      migrate: (persistedState, version) => {
        // Migrate from v1 (stored full products) to v2 (essential data only)
        if (version < 2 && persistedState?.items) {
          persistedState.items = persistedState.items.map(item => ({
            id: item.id,
            name: item.name,
            price_per_unit: item.price_per_unit || item.price,
            unit_type: item.unit_type || 'kg',
            quantity: item.quantity,
            min_order_quantity: item.min_order_quantity || 1,
            is_available: item.is_available,
            available_quantity: item.available_quantity,
            vendor_id: item.vendor_id,
            vendor_name: item.vendor_name || item.store_name,
            image_url: item.images?.[0]?.url || item.image_url || null,
            category: item.category
          }))
        }
        return persistedState
      }
    }
  )
)
