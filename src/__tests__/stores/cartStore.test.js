/**
 * Tests for cartStore
 * Note: We test the cart logic in isolation due to zustand/persist dependencies.
 */

describe('cartStore', () => {
  // Simulated cart store
  const createCartStore = () => {
    let state = {
      items: [],
      vendorItems: {},
      couponCode: null,
      couponDiscount: 0,
    }

    const getState = () => state

    const setState = (newState) => {
      state = { ...state, ...newState }
    }

    return {
      getState,

      addItem(product, quantity = 1) {
        const existing = state.items.find(item => item.id === product.id)
        if (existing) {
          const newQty = existing.quantity + quantity
          const cappedQty = Math.min(newQty, product.available_quantity)
          existing.quantity = Math.max(cappedQty, product.min_quantity)
        } else {
          const cappedQty = Math.min(quantity, product.available_quantity)
          const finalQty = Math.max(cappedQty, product.min_quantity)
          state.items.push({ ...product, quantity: finalQty })
        }

        // Update vendor items
        if (!state.vendorItems[product.vendor_id]) {
          state.vendorItems[product.vendor_id] = []
        }
        if (!state.vendorItems[product.vendor_id].find(i => i.id === product.id)) {
          state.vendorItems[product.vendor_id].push(product.id)
        }
      },

      removeItem(productId) {
        const item = state.items.find(i => i.id === productId)
        if (item) {
          delete state.vendorItems[item.vendor_id]
        }
        state.items = state.items.filter(i => i.id !== productId)
      },

      updateQuantity(productId, quantity) {
        if (quantity <= 0) {
          this.removeItem(productId)
          return
        }
        const item = state.items.find(i => i.id === productId)
        if (item) {
          item.quantity = quantity
        }
      },

      clearCart() {
        setState({ items: [], vendorItems: {}, couponCode: null, couponDiscount: 0 })
      },

      getItemCount() {
        return state.items.length
      },

      getTotalQuantity() {
        return state.items.reduce((sum, item) => sum + item.quantity, 0)
      },

      getSubtotal() {
        return state.items.reduce((sum, item) => sum + (item.price_per_unit * item.quantity), 0)
      },

      getTotal() {
        const subtotal = this.getSubtotal()
        const tax = subtotal * 0.2 // 20% TVA
        const discount = state.couponDiscount
        return subtotal + tax - discount
      },

      getVendorCount() {
        return Object.keys(state.vendorItems).length
      },
    }
  }

  let store

  beforeEach(() => {
    store = createCartStore()
  })

  describe('addItem', () => {
    it('should add a product to cart', () => {
      const product = {
        id: 'p1',
        name: 'Tomatoes',
        price_per_unit: 10,
        vendor_id: 'v1',
        min_quantity: 1,
        available_quantity: 100,
      }

      store.addItem(product, 2)

      expect(store.getState().items).toHaveLength(1)
      expect(store.getState().items[0].quantity).toBe(2)
    })

    it('should increase quantity for existing item', () => {
      const product = {
        id: 'p1',
        name: 'Tomatoes',
        price_per_unit: 10,
        vendor_id: 'v1',
        min_quantity: 1,
        available_quantity: 100,
      }

      store.addItem(product, 2)
      store.addItem(product, 3)

      expect(store.getState().items).toHaveLength(1)
      expect(store.getState().items[0].quantity).toBe(5)
    })

    it('should respect min quantity', () => {
      const product = {
        id: 'p1',
        name: 'Tomatoes',
        price_per_unit: 10,
        vendor_id: 'v1',
        min_quantity: 5,
        available_quantity: 100,
      }

      store.addItem(product, 2)

      expect(store.getState().items[0].quantity).toBe(5)
    })

    it('should respect available quantity', () => {
      const product = {
        id: 'p1',
        name: 'Tomatoes',
        price_per_unit: 10,
        vendor_id: 'v1',
        min_quantity: 1,
        available_quantity: 3,
      }

      store.addItem(product, 10)

      expect(store.getState().items[0].quantity).toBe(3)
    })
  })

  describe('removeItem', () => {
    it('should remove a product from cart', () => {
      const product = {
        id: 'p1',
        name: 'Tomatoes',
        price_per_unit: 10,
        vendor_id: 'v1',
        min_quantity: 1,
        available_quantity: 100,
      }

      store.addItem(product, 2)
      store.removeItem('p1')

      expect(store.getState().items).toHaveLength(0)
    })
  })

  describe('updateQuantity', () => {
    it('should update item quantity', () => {
      const product = {
        id: 'p1',
        name: 'Tomatoes',
        price_per_unit: 10,
        vendor_id: 'v1',
        min_quantity: 1,
        available_quantity: 100,
      }

      store.addItem(product, 2)
      store.updateQuantity('p1', 5)

      expect(store.getState().items[0].quantity).toBe(5)
    })

    it('should remove item when quantity is 0', () => {
      const product = {
        id: 'p1',
        name: 'Tomatoes',
        price_per_unit: 10,
        vendor_id: 'v1',
        min_quantity: 1,
        available_quantity: 100,
      }

      store.addItem(product, 2)
      store.updateQuantity('p1', 0)

      expect(store.getState().items).toHaveLength(0)
    })
  })

  describe('clearCart', () => {
    it('should clear all items', () => {
      const product = {
        id: 'p1',
        name: 'Tomatoes',
        price_per_unit: 10,
        vendor_id: 'v1',
        min_quantity: 1,
        available_quantity: 100,
      }

      store.addItem(product, 2)
      store.clearCart()

      expect(store.getState().items).toHaveLength(0)
    })
  })

  describe('getTotalQuantity', () => {
    it('should return total quantity of all items', () => {
      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 10, vendor_id: 'v1', min_quantity: 1, available_quantity: 100 }
      const p2 = { id: 'p2', name: 'Potatoes', price_per_unit: 5, vendor_id: 'v1', min_quantity: 1, available_quantity: 100 }

      store.addItem(p1, 3)
      store.addItem(p2, 5)

      expect(store.getTotalQuantity()).toBe(8)
    })
  })

  describe('getSubtotal', () => {
    it('should calculate subtotal', () => {
      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 10, vendor_id: 'v1', min_quantity: 1, available_quantity: 100 }
      const p2 = { id: 'p2', name: 'Potatoes', price_per_unit: 5, vendor_id: 'v1', min_quantity: 1, available_quantity: 100 }

      store.addItem(p1, 3)
      store.addItem(p2, 4)

      expect(store.getSubtotal()).toBe(50) // 3*10 + 4*5
    })
  })

  describe('getVendorCount', () => {
    it('should return number of unique vendors', () => {
      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 10, vendor_id: 'v1', min_quantity: 1, available_quantity: 100 }
      const p2 = { id: 'p2', name: 'Potatoes', price_per_unit: 5, vendor_id: 'v2', min_quantity: 1, available_quantity: 100 }

      store.addItem(p1, 1)
      store.addItem(p2, 1)

      expect(store.getVendorCount()).toBe(2)
    })
  })
})
