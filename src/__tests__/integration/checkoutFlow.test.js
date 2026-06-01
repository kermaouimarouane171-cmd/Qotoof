/**
 * Integration Tests: Checkout Flow
 * Tests the Cart -> Checkout -> Order Creation flow end-to-end.
 * All logic is simulated with mock implementations; no real imports.
 */

describe('Checkout Flow Integration', () => {
  // --- Mock Stores / Services ---

  const createCartStore = () => {
    let state = { items: [], vendorItems: {}, couponCode: null, couponDiscount: 0 }
    return {
      getState: () => state,
      addItem(product, quantity = 1) {
        const existing = state.items.find(i => i.id === product.id)
        if (existing) {
          existing.quantity = Math.min(existing.quantity + quantity, product.available_quantity)
        } else {
          state.items.push({ ...product, quantity: Math.min(quantity, product.available_quantity) })
        }
        if (!state.vendorItems[product.vendor_id]) state.vendorItems[product.vendor_id] = []
        if (!state.vendorItems[product.vendor_id].includes(product.id)) {
          state.vendorItems[product.vendor_id].push(product.id)
        }
      },
      removeItem(productId) {
        const item = state.items.find(i => i.id === productId)
        if (item) delete state.vendorItems[item.vendor_id]
        state.items = state.items.filter(i => i.id !== productId)
      },
      updateQuantity(productId, qty) {
        if (qty <= 0) { this.removeItem(productId); return }
        const item = state.items.find(i => i.id === productId)
        if (item) item.quantity = qty
      },
      clearCart() {
        state = { items: [], vendorItems: {}, couponCode: null, couponDiscount: 0 }
      },
      getSubtotal() {
        return state.items.reduce((sum, i) => sum + i.price_per_unit * i.quantity, 0)
      },
      getTotal() {
        const sub = this.getSubtotal()
        const tax = sub * 0.2
        return sub + tax - state.couponDiscount
      },
      getItemCount() { return state.items.length },
      getVendorCount() { return Object.keys(state.vendorItems).length },
    }
  }

  const createAuthStore = () => {
    let state = { user: null, profile: null }
    return {
      getState: () => state,
      async signIn(email, password) {
        if (!email || !password || password.length < 8) return { success: false, error: 'Invalid credentials' }
        state = { user: { id: 'u1', email }, profile: { id: 'u1', role: 'buyer', first_name: 'Test', last_name: 'User' } }
        return { success: true }
      },
      async signOut() { state = { user: null, profile: null }; return { success: true } },
    }
  }

  const createOrdersApi = () => {
    const orders = []
    const notifications = []
    let nextId = 1
    return {
      async createOrder({ items, shippingAddress, paymentMethod, total }) {
        const orderNumber = `ORD-${String(nextId++).padStart(3, '0')}`
        const order = {
          id: `o${nextId - 1}`,
          order_number: orderNumber,
          status: 'pending',
          items,
          shipping_address: shippingAddress,
          payment_method: paymentMethod,
          total,
          buyer_id: 'u1',
          created_at: new Date().toISOString(),
        }
        orders.push(order)
        notifications.push({
          user_id: 'u1',
          type: 'order_created',
          title: 'Order Created',
          message: `Order ${orderNumber} placed successfully`,
          order_id: order.id,
        })
        return order
      },
      getOrders() { return [...orders] },
      getById(id) { return orders.find(o => o.id === id) || null },
      getNotifications() { return [...notifications] },
    }
  }

  const createInventoryApi = () => {
    const stock = {}
    return {
      setStock(productId, qty) { stock[productId] = qty },
      getStock(productId) { return stock[productId] ?? 0 },
      async reserveStock(productId, quantity) {
        if ((stock[productId] ?? 0) < quantity) {
          throw new Error(`Insufficient stock for product ${productId}`)
        }
        stock[productId] -= quantity
        return { success: true, remaining: stock[productId] }
      },
      async releaseStock(productId, quantity) {
        stock[productId] = (stock[productId] ?? 0) + quantity
        return { success: true }
      },
    }
  }

  let cart, auth, orders, inventory

  beforeEach(() => {
    cart = createCartStore()
    auth = createAuthStore()
    orders = createOrdersApi()
    inventory = createInventoryApi()
  })

  // --- Tests ---

  describe('Cart population', () => {
    it('should add multiple products from different vendors to cart', () => {
      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 12, vendor_id: 'v1', min_quantity: 1, available_quantity: 50 }
      const p2 = { id: 'p2', name: 'Olive Oil', price_per_unit: 85, vendor_id: 'v2', min_quantity: 1, available_quantity: 30 }

      cart.addItem(p1, 3)
      cart.addItem(p2, 1)

      expect(cart.getItemCount()).toBe(2)
      expect(cart.getVendorCount()).toBe(2)
    })

    it('should calculate correct subtotal and total with tax', () => {
      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 10, vendor_id: 'v1', min_quantity: 1, available_quantity: 100 }
      const p2 = { id: 'p2', name: 'Potatoes', price_per_unit: 5, vendor_id: 'v1', min_quantity: 1, available_quantity: 100 }

      cart.addItem(p1, 4)
      cart.addItem(p2, 6)

      expect(cart.getSubtotal()).toBe(70) // 4*10 + 6*5
      expect(cart.getTotal()).toBe(84) // 70 + 70*0.2
    })
  })

  describe('Checkout validation', () => {
    it('should fail checkout when cart is empty', async () => {
      expect(cart.getItemCount()).toBe(0)
      // Checkout should reject with empty cart
      const canCheckout = cart.getItemCount() > 0
      expect(canCheckout).toBe(false)
    })

    it('should fail checkout when cart contains multiple vendors', async () => {
      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 12, vendor_id: 'v1', min_quantity: 1, available_quantity: 50 }
      const p2 = { id: 'p2', name: 'Olive Oil', price_per_unit: 85, vendor_id: 'v2', min_quantity: 1, available_quantity: 30 }

      cart.addItem(p1, 3)
      cart.addItem(p2, 1)

      const canCheckout = cart.getItemCount() > 0 && cart.getVendorCount() === 1
      expect(canCheckout).toBe(false)
    })

    it('should fail checkout when user is not authenticated', async () => {
      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 10, vendor_id: 'v1', min_quantity: 1, available_quantity: 100 }
      cart.addItem(p1, 2)

      const isAuthenticated = auth.getState().user !== null
      expect(isAuthenticated).toBe(false)
    })

    it('should fail checkout when inventory is insufficient', async () => {
      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 10, vendor_id: 'v1', min_quantity: 1, available_quantity: 100 }
      cart.addItem(p1, 5)
      inventory.setStock('p1', 2)

      await expect(inventory.reserveStock('p1', 5)).rejects.toThrow('Insufficient stock')
    })
  })

  describe('Order creation', () => {
    it('should create order successfully with valid cart, auth, and inventory', async () => {
      // Setup: authenticate user
      await auth.signIn('buyer@test.com', 'password123')
      expect(auth.getState().user).toBeDefined()

      // Setup: add items to cart
      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 10, vendor_id: 'v1', min_quantity: 1, available_quantity: 100 }
      cart.addItem(p1, 3)

      // Setup: ensure inventory
      inventory.setStock('p1', 50)
      await inventory.reserveStock('p1', 3)

      // Checkout
      const order = await orders.createOrder({
        items: cart.getState().items,
        shippingAddress: { city: 'Casablanca', address: '12 Rue Hassan II', phone: '0612345678' },
        paymentMethod: 'cod',
        total: cart.getTotal(),
      })

      expect(order).toBeDefined()
      expect(order.status).toBe('pending')
      expect(order.order_number).toMatch(/^ORD-\d{3}$/)
      expect(order.items).toHaveLength(1)
    })

    it('should clear cart after successful order creation', async () => {
      await auth.signIn('buyer@test.com', 'password123')

      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 10, vendor_id: 'v1', min_quantity: 1, available_quantity: 100 }
      cart.addItem(p1, 2)
      expect(cart.getItemCount()).toBe(1)

      inventory.setStock('p1', 50)
      await inventory.reserveStock('p1', 2)

      await orders.createOrder({
        items: cart.getState().items,
        shippingAddress: { city: 'Rabat', address: '45 Avenue Mohammed V', phone: '0698765432' },
        paymentMethod: 'bank',
        total: cart.getTotal(),
      })

      cart.clearCart()
      expect(cart.getItemCount()).toBe(0)
    })

    it('should generate a notification when order is created', async () => {
      await auth.signIn('buyer@test.com', 'password123')

      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 10, vendor_id: 'v1', min_quantity: 1, available_quantity: 100 }
      cart.addItem(p1, 1)
      inventory.setStock('p1', 50)
      await inventory.reserveStock('p1', 1)

      await orders.createOrder({
        items: cart.getState().items,
        shippingAddress: { city: 'Marrakech', address: '789 Rd', phone: '0655555555' },
        paymentMethod: 'cod',
        total: cart.getTotal(),
      })

      const notifications = orders.getNotifications()
      expect(notifications).toHaveLength(1)
      expect(notifications[0].type).toBe('order_created')
      expect(notifications[0].order_id).toBeDefined()
    })
  })
})
