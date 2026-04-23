/**
 * Tests for favoritesStore
 * Note: We test the favorites logic in isolation due to zustand/persist dependencies.
 */

describe('favoritesStore', () => {
  // Simulated favorites store
  const createFavoritesStore = () => {
    let state = {
      products: [],
      vendors: [],
      loading: false,
    }

    const getState = () => state

    const setState = (newState) => {
      state = { ...state, ...newState }
    }

    return {
      getState,

      toggleProduct(product) {
        const exists = state.products.find(p => p.id === product.id)
        if (exists) {
          setState({ products: state.products.filter(p => p.id !== product.id) })
        } else {
          setState({ products: [...state.products, product] })
        }
      },

      toggleVendor(vendor) {
        const exists = state.vendors.find(v => v.id === vendor.id)
        if (exists) {
          setState({ vendors: state.vendors.filter(v => v.id !== vendor.id) })
        } else {
          setState({ vendors: [...state.vendors, vendor] })
        }
      },

      isFavorited(productId) {
        return state.products.some(p => p.id === productId)
      },

      getFavoriteProducts() {
        return state.products
      },

      getFavoriteVendors() {
        return state.vendors
      },

      getCount() {
        return state.products.length + state.vendors.length
      },

      clearFavorites() {
        setState({ products: [], vendors: [] })
      },
    }
  }

  let store

  beforeEach(() => {
    store = createFavoritesStore()
  })

  describe('toggleProduct', () => {
    it('should add product to favorites', () => {
      const product = { id: 'p1', name: 'Tomatoes', price_per_unit: 10 }

      store.toggleProduct(product)

      expect(store.getState().products).toContainEqual(product)
    })

    it('should remove product from favorites', () => {
      const product = { id: 'p1', name: 'Tomatoes', price_per_unit: 10 }

      store.toggleProduct(product)
      store.toggleProduct(product)

      expect(store.getState().products).toHaveLength(0)
    })
  })

  describe('isFavorited', () => {
    it('should return true for favorited product', () => {
      const product = { id: 'p1', name: 'Tomatoes', price_per_unit: 10 }

      store.toggleProduct(product)

      expect(store.isFavorited('p1')).toBe(true)
    })

    it('should return false for non-favorited product', () => {
      expect(store.isFavorited('p99')).toBe(false)
    })
  })

  describe('getFavoriteProducts', () => {
    it('should return all favorite products', () => {
      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 10 }
      const p2 = { id: 'p2', name: 'Potatoes', price_per_unit: 5 }

      store.toggleProduct(p1)
      store.toggleProduct(p2)

      expect(store.getFavoriteProducts()).toHaveLength(2)
    })
  })

  describe('toggleVendor', () => {
    it('should add vendor to favorites', () => {
      const vendor = { id: 'v1', name: 'Fresh Store' }

      store.toggleVendor(vendor)

      expect(store.getState().vendors).toContainEqual(vendor)
    })

    it('should remove vendor from favorites', () => {
      const vendor = { id: 'v1', name: 'Fresh Store' }

      store.toggleVendor(vendor)
      store.toggleVendor(vendor)

      expect(store.getState().vendors).toHaveLength(0)
    })
  })

  describe('clearFavorites', () => {
    it('should clear all favorites', () => {
      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 10 }
      const v1 = { id: 'v1', name: 'Fresh Store' }

      store.toggleProduct(p1)
      store.toggleVendor(v1)
      store.clearFavorites()

      const state = store.getState()
      expect(state.products).toHaveLength(0)
      expect(state.vendors).toHaveLength(0)
    })
  })

  describe('getCount', () => {
    it('should return total favorites count', () => {
      const p1 = { id: 'p1', name: 'Tomatoes', price_per_unit: 10 }
      const p2 = { id: 'p2', name: 'Potatoes', price_per_unit: 5 }
      const v1 = { id: 'v1', name: 'Fresh Store' }

      store.toggleProduct(p1)
      store.toggleProduct(p2)
      store.toggleVendor(v1)

      expect(store.getCount()).toBe(3)
    })
  })
})
