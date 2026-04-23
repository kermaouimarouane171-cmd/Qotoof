/**
 * Integration Tests: Product Management
 * Tests Vendor creates product -> appears in marketplace -> buyer adds to cart flow.
 * All logic is simulated with mock implementations; no real imports.
 */

describe('Product Management Integration', () => {
  // --- Mock Services ---

  const createAuthStore = () => {
    let state = { user: null, profile: null }
    return {
      getState: () => ({ ...state }),
      async signIn(email, password, role = 'buyer') {
        if (!email || !password || password.length < 8) return { success: false, error: 'Invalid credentials' }
        state = { user: { id: role === 'vendor' ? 'v1' : 'b1', email }, profile: { id: role === 'vendor' ? 'v1' : 'b1', role, first_name: 'Test', last_name: 'User' } }
        return { success: true }
      },
      async signOut() { state = { user: null, profile: null }; return { success: true } },
      isAuthenticated() { return state.user !== null },
      getRole() { return state.profile?.role || null },
    }
  }

  const createProductsApi = () => {
    const products = []
    let nextId = 1
    return {
      async createProduct(vendorId, productData) {
        const product = {
          id: `p${nextId++}`,
          vendor_id: vendorId,
          ...productData,
          status: productData.status || 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        products.push(product)
        return product
      },
      async updateProduct(productId, vendorId, updates) {
        const idx = products.findIndex(p => p.id === productId && p.vendor_id === vendorId)
        if (idx === -1) throw new Error('Product not found or not owned by vendor')
        products[idx] = { ...products[idx], ...updates, updated_at: new Date().toISOString() }
        return products[idx]
      },
      async deactivateProduct(productId, vendorId) {
        return this.updateProduct(productId, vendorId, { status: 'inactive' })
      },
      async getMarketplace(filters = {}) {
        let result = products.filter(p => p.status === 'active')
        if (filters.category) result = result.filter(p => p.category === filters.category)
        if (filters.vendorId) result = result.filter(p => p.vendor_id === filters.vendorId)
        if (filters.search) {
          const q = filters.search.toLowerCase()
          result = result.filter(p => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
        }
        if (filters.minPrice) result = result.filter(p => p.price_per_unit >= filters.minPrice)
        if (filters.maxPrice) result = result.filter(p => p.price_per_unit <= filters.maxPrice)
        return result
      },
      async getProductById(productId) {
        return products.find(p => p.id === productId) || null
      },
      async getVendorProducts(vendorId) {
        return products.filter(p => p.vendor_id === vendorId)
      },
      getAllProducts() { return [...products] },
    }
  }

  const createCartStore = () => {
    let state = { items: [], vendorItems: {} }
    return {
      getState: () => ({ ...state }),
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
      getItemCount() { return state.items.length },
      getTotalQuantity() { return state.items.reduce((sum, i) => sum + i.quantity, 0) },
      getSubtotal() { return state.items.reduce((sum, i) => sum + i.price_per_unit * i.quantity, 0) },
      clearCart() { state = { items: [], vendorItems: {} } },
    }
  }

  const createCategoriesApi = () => {
    const categories = [
      { id: 'cat1', name: 'Fruits', slug: 'fruits' },
      { id: 'cat2', name: 'Vegetables', slug: 'vegetables' },
      { id: 'cat3', name: 'Dairy', slug: 'dairy' },
      { id: 'cat4', name: 'Oils', slug: 'oils' },
    ]
    return {
      getAll() { return [...categories] },
      getBySlug(slug) { return categories.find(c => c.slug === slug) || null },
    }
  }

  let auth, products, cart, categories

  beforeEach(() => {
    auth = createAuthStore()
    products = createProductsApi()
    cart = createCartStore()
    categories = createCategoriesApi()
  })

  // --- Tests ---

  describe('Vendor creates product', () => {
    it('should create a product with valid data', async () => {
      await auth.signIn('vendor@test.com', 'password123', 'vendor')
      expect(auth.getRole()).toBe('vendor')

      const product = await products.createProduct('v1', {
        name: 'Organic Tomatoes',
        description: 'Fresh organic tomatoes from local farm',
        category: 'vegetables',
        price_per_unit: 12,
        unit_type: 'kg',
        min_quantity: 1,
        available_quantity: 50,
        images: ['tomato1.jpg'],
      })

      expect(product).toBeDefined()
      expect(product.id).toMatch(/^p\d+$/)
      expect(product.vendor_id).toBe('v1')
      expect(product.status).toBe('active')
      expect(product.name).toBe('Organic Tomatoes')
    })

    it('should list vendor products after creation', async () => {
      await auth.signIn('vendor@test.com', 'password123', 'vendor')

      await products.createProduct('v1', { name: 'Tomatoes', category: 'vegetables', price_per_unit: 12, unit_type: 'kg', min_quantity: 1, available_quantity: 50 })
      await products.createProduct('v1', { name: 'Cucumbers', category: 'vegetables', price_per_unit: 8, unit_type: 'kg', min_quantity: 1, available_quantity: 30 })

      const vendorProducts = await products.getVendorProducts('v1')
      expect(vendorProducts).toHaveLength(2)
    })

    it('should update product details', async () => {
      await auth.signIn('vendor@test.com', 'password123', 'vendor')

      const product = await products.createProduct('v1', { name: 'Tomatoes', category: 'vegetables', price_per_unit: 12, unit_type: 'kg', min_quantity: 1, available_quantity: 50 })
      const updated = await products.updateProduct(product.id, 'v1', { price_per_unit: 15, available_quantity: 40 })

      expect(updated.price_per_unit).toBe(15)
      expect(updated.available_quantity).toBe(40)
    })

    it('should deactivate product', async () => {
      await auth.signIn('vendor@test.com', 'password123', 'vendor')

      const product = await products.createProduct('v1', { name: 'Tomatoes', category: 'vegetables', price_per_unit: 12, unit_type: 'kg', min_quantity: 1, available_quantity: 50 })
      await products.deactivateProduct(product.id, 'v1')

      const marketplace = await products.getMarketplace()
      expect(marketplace.find(p => p.id === product.id)).toBeUndefined()
    })
  })

  describe('Marketplace visibility', () => {
    it('should show active products in marketplace', async () => {
      await auth.signIn('vendor@test.com', 'password123', 'vendor')
      await products.createProduct('v1', { name: 'Tomatoes', category: 'vegetables', price_per_unit: 12, unit_type: 'kg', min_quantity: 1, available_quantity: 50 })
      await products.createProduct('v1', { name: 'Olive Oil', category: 'oils', price_per_unit: 85, unit_type: 'liter', min_quantity: 1, available_quantity: 20 })

      const marketplace = await products.getMarketplace()
      expect(marketplace).toHaveLength(2)
    })

    it('should filter marketplace by category', async () => {
      await auth.signIn('vendor@test.com', 'password123', 'vendor')
      await products.createProduct('v1', { name: 'Tomatoes', category: 'vegetables', price_per_unit: 12, unit_type: 'kg', min_quantity: 1, available_quantity: 50 })
      await products.createProduct('v1', { name: 'Olive Oil', category: 'oils', price_per_unit: 85, unit_type: 'liter', min_quantity: 1, available_quantity: 20 })

      const vegProducts = await products.getMarketplace({ category: 'vegetables' })
      expect(vegProducts).toHaveLength(1)
      expect(vegProducts[0].category).toBe('vegetables')
    })

    it('should filter marketplace by search query', async () => {
      await auth.signIn('vendor@test.com', 'password123', 'vendor')
      await products.createProduct('v1', { name: 'Organic Tomatoes', description: 'Fresh red tomatoes', category: 'vegetables', price_per_unit: 12, unit_type: 'kg', min_quantity: 1, available_quantity: 50 })
      await products.createProduct('v1', { name: 'Olive Oil', description: 'Extra virgin olive oil', category: 'oils', price_per_unit: 85, unit_type: 'liter', min_quantity: 1, available_quantity: 20 })

      const searchResults = await products.getMarketplace({ search: 'tomato' })
      expect(searchResults).toHaveLength(1)
      expect(searchResults[0].name).toBe('Organic Tomatoes')
    })

    it('should filter marketplace by price range', async () => {
      await auth.signIn('vendor@test.com', 'password123', 'vendor')
      await products.createProduct('v1', { name: 'Tomatoes', category: 'vegetables', price_per_unit: 12, unit_type: 'kg', min_quantity: 1, available_quantity: 50 })
      await products.createProduct('v1', { name: 'Saffron', category: 'spices', price_per_unit: 250, unit_type: 'gram', min_quantity: 1, available_quantity: 10 })

      const cheapProducts = await products.getMarketplace({ maxPrice: 50 })
      expect(cheapProducts).toHaveLength(1)
      expect(cheapProducts[0].price_per_unit).toBe(12)
    })
  })

  describe('Buyer adds to cart', () => {
    it('should add marketplace product to cart', async () => {
      // Vendor creates product
      await auth.signIn('vendor@test.com', 'password123', 'vendor')
      const product = await products.createProduct('v1', { name: 'Tomatoes', category: 'vegetables', price_per_unit: 12, unit_type: 'kg', min_quantity: 1, available_quantity: 50 })

      // Buyer browses marketplace and adds to cart
      await auth.signOut()
      await auth.signIn('buyer@test.com', 'password123', 'buyer')

      const marketplace = await products.getMarketplace()
      expect(marketplace).toHaveLength(1)

      cart.addItem(marketplace[0], 3)
      expect(cart.getItemCount()).toBe(1)
      expect(cart.getTotalQuantity()).toBe(3)
      expect(cart.getSubtotal()).toBe(36) // 3 * 12
    })

    it('should respect available quantity when adding to cart', async () => {
      await auth.signIn('vendor@test.com', 'password123', 'vendor')
      const product = await products.createProduct('v1', { name: 'Tomatoes', category: 'vegetables', price_per_unit: 12, unit_type: 'kg', min_quantity: 1, available_quantity: 5 })

      await auth.signOut()
      await auth.signIn('buyer@test.com', 'password123', 'buyer')

      const marketplace = await products.getMarketplace()
      cart.addItem(marketplace[0], 10) // Try to add more than available

      expect(cart.getTotalQuantity()).toBe(5) // Capped at available_quantity
    })

    it('should handle multi-vendor cart', async () => {
      // Two vendors create products
      await auth.signIn('vendor1@test.com', 'password123', 'vendor')
      const p1 = await products.createProduct('v1', { name: 'Tomatoes', category: 'vegetables', price_per_unit: 12, unit_type: 'kg', min_quantity: 1, available_quantity: 50 })
      await auth.signOut()

      await auth.signIn('vendor2@test.com', 'password123', 'vendor')
      const p2 = await products.createProduct('v2', { name: 'Olive Oil', category: 'oils', price_per_unit: 85, unit_type: 'liter', min_quantity: 1, available_quantity: 20 })
      await auth.signOut()

      // Buyer adds both to cart
      await auth.signIn('buyer@test.com', 'password123', 'buyer')
      const marketplace = await products.getMarketplace()
      expect(marketplace).toHaveLength(2)

      cart.addItem(marketplace.find(p => p.vendor_id === 'v1'), 2)
      cart.addItem(marketplace.find(p => p.vendor_id === 'v2'), 1)

      expect(cart.getItemCount()).toBe(2)
      expect(Object.keys(cart.getState().vendorItems).length).toBe(2)
    })
  })
})
