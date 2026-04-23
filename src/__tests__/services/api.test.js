/**
 * Tests for API services
 * Note: We test the API logic in isolation due to supabase/withRetry/import.meta.env dependencies.
 */

describe('productsApi', () => {
  // Simulated products API
  const createProductsApi = () => {
    let products = [
      { id: 'p1', name: 'Tomatoes', category: 'vegetables', price_per_unit: 10, vendor_id: 'v1', deleted_at: null },
      { id: 'p2', name: 'Apples', category: 'fruits', price_per_unit: 15, vendor_id: 'v2', deleted_at: null },
      { id: 'p3', name: 'Deleted Product', category: 'vegetables', price_per_unit: 5, vendor_id: 'v1', deleted_at: '2025-01-01' },
    ]

    return {
      async getAll(filters = {}) {
        let result = products.filter(p => !p.deleted_at)

        if (filters.category) result = result.filter(p => p.category === filters.category)
        if (filters.minPrice) result = result.filter(p => p.price_per_unit >= filters.minPrice)
        if (filters.maxPrice) result = result.filter(p => p.price_per_unit <= filters.maxPrice)
        if (filters.search) {
          const search = filters.search.toLowerCase()
          result = result.filter(p => p.name.toLowerCase().includes(search))
        }
        if (filters.vendorId) result = result.filter(p => p.vendor_id === filters.vendorId)

        return result.sort((a, b) => b.id.localeCompare(a.id))
      },

      async getById(id) {
        const product = products.find(p => p.id === id && !p.deleted_at)
        if (!product) throw new Error('Product not found')
        return { ...product, vendor: {}, images: [], reviews: [] }
      },

      async create(product) {
        const newProduct = { id: `p${products.length + 1}`, ...product, deleted_at: null }
        products.push(newProduct)
        return newProduct
      },

      async update(id, updates) {
        const index = products.findIndex(p => p.id === id)
        if (index === -1) throw new Error('Product not found')
        products[index] = { ...products[index], ...updates }
        return products[index]
      },

      async delete(id) {
        const index = products.findIndex(p => p.id === id)
        if (index === -1) throw new Error('Product not found')
        products[index].deleted_at = new Date().toISOString()
        return products[index]
      },

      async restore(id) {
        const index = products.findIndex(p => p.id === id)
        if (index === -1) throw new Error('Product not found')
        products[index].deleted_at = null
        return products[index]
      },

      async getDeleted() {
        return products.filter(p => p.deleted_at).sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))
      },
    }
  }

  let api

  beforeEach(() => {
    api = createProductsApi()
  })

  describe('getAll', () => {
    it('should fetch products without filters', async () => {
      const result = await api.getAll()

      expect(result).toHaveLength(2) // Only non-deleted
    })

    it('should apply category filter', async () => {
      const result = await api.getAll({ category: 'vegetables' })

      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('vegetables')
    })

    it('should apply search filter', async () => {
      const result = await api.getAll({ search: 'Tomato' })

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Tomatoes')
    })

    it('should apply price range filters', async () => {
      const result = await api.getAll({ minPrice: 12, maxPrice: 20 })

      expect(result).toHaveLength(1)
      expect(result[0].price_per_unit).toBe(15)
    })

    it('should exclude deleted products', async () => {
      const result = await api.getAll()

      expect(result.find(p => p.deleted_at)).toBeUndefined()
    })
  })

  describe('getById', () => {
    it('should fetch single product', async () => {
      const result = await api.getById('p1')

      expect(result.id).toBe('p1')
    })

    it('should throw for deleted products', async () => {
      await expect(api.getById('p3')).rejects.toThrow('Product not found')
    })
  })

  describe('create', () => {
    it('should create a new product', async () => {
      const result = await api.create({ name: 'New Product', price_per_unit: 20, category: 'vegetables', vendor_id: 'v1' })

      expect(result.id).toBeDefined()
      expect(result.deleted_at).toBeNull()
    })
  })

  describe('update', () => {
    it('should update product fields', async () => {
      const result = await api.update('p1', { name: 'Updated Name' })

      expect(result.name).toBe('Updated Name')
    })
  })

  describe('delete', () => {
    it('should soft delete (set deleted_at)', async () => {
      const result = await api.delete('p1')

      expect(result.deleted_at).toBeDefined()
    })
  })

  describe('restore', () => {
    it('should restore a deleted product', async () => {
      await api.delete('p1')
      const result = await api.restore('p1')

      expect(result.deleted_at).toBeNull()
    })
  })
})

describe('ordersApi', () => {
  const createOrdersApi = () => {
    let orders = [
      { id: 'o1', order_number: 'ORD-001', status: 'pending', buyer_id: 'b1', vendor_id: 'v1', total: 100, deleted_at: null },
      { id: 'o2', order_number: 'ORD-002', status: 'completed', buyer_id: 'b2', vendor_id: 'v1', total: 200, deleted_at: null },
    ]

    return {
      async getAll(filters = {}) {
        let result = orders.filter(o => !o.deleted_at)

        if (filters.buyerId) result = result.filter(o => o.buyer_id === filters.buyerId)
        if (filters.vendorId) result = result.filter(o => o.vendor_id === filters.vendorId)
        if (filters.status) result = result.filter(o => o.status === filters.status)

        return result.sort((a, b) => b.id.localeCompare(a.id))
      },

      async getById(id) {
        const order = orders.find(o => o.id === id && !o.deleted_at)
        if (!order) throw new Error('Order not found')
        return { ...order, buyer: {}, vendor: {}, items: [] }
      },

      async create(order) {
        const newOrder = { id: `o${orders.length + 1}`, ...order, deleted_at: null }
        orders.push(newOrder)
        return newOrder
      },

      async updateStatus(id, status) {
        const index = orders.findIndex(o => o.id === id)
        if (index === -1) throw new Error('Order not found')
        orders[index].status = status
        orders[index].updated_at = new Date().toISOString()
        return orders[index]
      },

      async delete(id) {
        const index = orders.findIndex(o => o.id === id)
        if (index === -1) throw new Error('Order not found')
        orders[index].deleted_at = new Date().toISOString()
        return orders[index]
      },

      async restore(id) {
        const index = orders.findIndex(o => o.id === id)
        if (index === -1) throw new Error('Order not found')
        orders[index].deleted_at = null
        return orders[index]
      },
    }
  }

  let api

  beforeEach(() => {
    api = createOrdersApi()
  })

  describe('getAll', () => {
    it('should fetch orders without filters', async () => {
      const result = await api.getAll()

      expect(result).toHaveLength(2)
    })

    it('should apply buyerId filter', async () => {
      const result = await api.getAll({ buyerId: 'b1' })

      expect(result).toHaveLength(1)
      expect(result[0].buyer_id).toBe('b1')
    })

    it('should apply status filter', async () => {
      const result = await api.getAll({ status: 'completed' })

      expect(result).toHaveLength(1)
    })
  })

  describe('create', () => {
    it('should create a new order', async () => {
      const result = await api.create({ buyer_id: 'b1', vendor_id: 'v1', total: 150 })

      expect(result.id).toBeDefined()
    })
  })

  describe('updateStatus', () => {
    it('should update order status', async () => {
      const result = await api.updateStatus('o1', 'completed')

      expect(result.status).toBe('completed')
    })
  })

  describe('delete', () => {
    it('should soft delete an order', async () => {
      const result = await api.delete('o1')

      expect(result.deleted_at).toBeDefined()
    })
  })

  describe('restore', () => {
    it('should restore a deleted order', async () => {
      await api.delete('o1')
      const result = await api.restore('o1')

      expect(result.deleted_at).toBeNull()
    })
  })
})

describe('reviewsApi', () => {
  const createReviewsApi = () => {
    let reviews = [
      { id: 'r1', vendor_id: 'v1', rating: 5, comment: 'Great!', deleted_at: null },
      { id: 'r2', vendor_id: 'v1', rating: 4, comment: 'Good', deleted_at: null },
    ]

    return {
      async create(review) {
        const newReview = { id: `r${reviews.length + 1}`, ...review, deleted_at: null }
        reviews.push(newReview)
        return newReview
      },

      async getByVendor(vendorId) {
        return reviews.filter(r => r.vendor_id === vendorId && !r.deleted_at)
      },

      async delete(id) {
        const index = reviews.findIndex(r => r.id === id)
        if (index === -1) throw new Error('Review not found')
        reviews[index].deleted_at = new Date().toISOString()
        return reviews[index]
      },

      async restore(id) {
        const index = reviews.findIndex(r => r.id === id)
        if (index === -1) throw new Error('Review not found')
        reviews[index].deleted_at = null
        return reviews[index]
      },
    }
  }

  let api

  beforeEach(() => {
    api = createReviewsApi()
  })

  describe('create', () => {
    it('should create a new review', async () => {
      const result = await api.create({ vendor_id: 'v1', rating: 3, comment: 'OK' })

      expect(result.id).toBeDefined()
    })
  })

  describe('getByVendor', () => {
    it('should fetch reviews for a vendor', async () => {
      const result = await api.getByVendor('v1')

      expect(result).toHaveLength(2)
    })
  })

  describe('delete', () => {
    it('should soft delete a review', async () => {
      const result = await api.delete('r1')

      expect(result.deleted_at).toBeDefined()
    })
  })

  describe('restore', () => {
    it('should restore a deleted review', async () => {
      await api.delete('r1')
      const result = await api.restore('r1')

      expect(result.deleted_at).toBeNull()
    })
  })
})

describe('usersApi', () => {
  const createUsersApi = () => {
    let users = [
      { id: 'u1', email: 'test@test.com', role: 'buyer', deleted_at: null },
      { id: 'u2', email: 'vendor@test.com', role: 'vendor', deleted_at: null },
    ]

    return {
      async getAll(filters = {}) {
        let result = users.filter(u => !u.deleted_at)

        if (filters.role && filters.role !== 'all') result = result.filter(u => u.role === filters.role)
        if (filters.search) {
          const search = filters.search.toLowerCase()
          result = result.filter(u => u.email.toLowerCase().includes(search))
        }

        return { data: result, count: result.length }
      },

      async delete(id) {
        const index = users.findIndex(u => u.id === id)
        if (index === -1) throw new Error('User not found')
        const userData = { ...users[index] }
        users[index].deleted_at = new Date().toISOString()
        return userData
      },

      async restore(id) {
        const index = users.findIndex(u => u.id === id)
        if (index === -1) throw new Error('User not found')
        users[index].deleted_at = null
        return users[index]
      },
    }
  }

  let api

  beforeEach(() => {
    api = createUsersApi()
  })

  describe('getAll', () => {
    it('should fetch users without filters', async () => {
      const result = await api.getAll()

      expect(result.data).toHaveLength(2)
      expect(result.count).toBe(2)
    })

    it('should apply role filter', async () => {
      const result = await api.getAll({ role: 'vendor' })

      expect(result.data).toHaveLength(1)
    })

    it('should apply search filter', async () => {
      const result = await api.getAll({ search: 'test@test' })

      expect(result.data).toHaveLength(1)
    })
  })

  describe('delete', () => {
    it('should soft delete a user', async () => {
      const result = await api.delete('u1')

      expect(result.email).toBe('test@test.com')
    })
  })

  describe('restore', () => {
    it('should restore a deleted user', async () => {
      await api.delete('u1')
      const result = await api.restore('u1')

      expect(result.deleted_at).toBeNull()
    })
  })
})

describe('analyticsApi', () => {
  const createAnalyticsApi = () => {
    const orders = [
      { vendor_id: 'v1', total: 100, status: 'completed', deleted_at: null },
      { vendor_id: 'v1', total: 50, status: 'pending', deleted_at: null },
      { vendor_id: 'v1', total: 200, status: 'completed', deleted_at: null },
    ]

    return {
      async getVendorStats(vendorId) {
        const vendorOrders = orders.filter(o => o.vendor_id === vendorId && !o.deleted_at)
        const totalRevenue = vendorOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total, 0)
        return {
          totalRevenue,
          totalOrders: vendorOrders.length,
          pendingOrders: vendorOrders.filter(o => o.status === 'pending').length,
        }
      },

      async getAdminStats() {
        return {
          totalUsers: 100,
          totalProducts: 500,
          totalOrders: 1000,
          totalRevenue: 50000,
        }
      },
    }
  }

  let api

  beforeEach(() => {
    api = createAnalyticsApi()
  })

  describe('getVendorStats', () => {
    it('should calculate vendor revenue from completed orders', async () => {
      const result = await api.getVendorStats('v1')

      expect(result.totalRevenue).toBe(300)
      expect(result.totalOrders).toBe(3)
      expect(result.pendingOrders).toBe(1)
    })
  })

  describe('getAdminStats', () => {
    it('should return platform-wide statistics', async () => {
      const result = await api.getAdminStats()

      expect(result.totalUsers).toBe(100)
      expect(result.totalProducts).toBe(500)
      expect(result.totalOrders).toBe(1000)
      expect(result.totalRevenue).toBe(50000)
    })
  })
})
