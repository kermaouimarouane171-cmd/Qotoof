import { act } from '@testing-library/react'

const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()
const mockSupabaseRpc = jest.fn().mockResolvedValue({ data: true, error: null })

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToastSuccess(...args),
    error: (...args) => mockToastError(...args),
  },
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    rpc: (...args) => mockSupabaseRpc(...args),
    from: jest.fn(),
  },
}))

jest.mock('@/utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}))

const createLocalStorageMock = (initialState = {}) => {
  let store = { ...initialState }

  return {
    getItem: jest.fn((key) => (key in store ? store[key] : null)),
    setItem: jest.fn((key, value) => {
      store[key] = String(value)
    }),
    removeItem: jest.fn((key) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
}

const setupLocalStorage = (initialState = {}) => {
  const localStorageMock = createLocalStorageMock(initialState)
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true,
  })
  return localStorageMock
}

const loadFreshCartStore = () => {
  let useCartStore
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    useCartStore = require('@/modules/cart').useCartStore
  })
  return useCartStore
}

const baseProduct = {
  id: 'prod-1',
  name: 'Tomatoes',
  price_per_unit: 10,
  unit_type: 'kg',
  vendor_id: 'vendor-1',
  image_url: 'https://cdn.example.com/tomatoes.jpg',
  min_order_quantity: 1,
  available_quantity: 20,
  is_available: true,
}

describe('useCartStore shopping cart logic', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupLocalStorage({ language: 'en' })
  })

  describe('Add to cart', () => {
    it('adds new product correctly', () => {
      const useCartStore = loadFreshCartStore()

      let result
      act(() => {
        result = useCartStore.getState().addItem(baseProduct, 2)
      })

      const state = useCartStore.getState()
      expect(result).toBe(true)
      expect(state.items).toHaveLength(1)
      expect(state.items[0]).toMatchObject({
        id: 'prod-1',
        name: 'Tomatoes',
        quantity: 2,
        vendor_id: 'vendor-1',
      })
    })

    it('increments quantity if product already in cart', () => {
      const useCartStore = loadFreshCartStore()

      act(() => {
        useCartStore.getState().addItem(baseProduct, 2)
      })

      act(() => {
        useCartStore.getState().addItem(baseProduct, 3)
      })

      const state = useCartStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.items[0].quantity).toBe(5)
    })

    it('validates minimum order quantity', () => {
      const useCartStore = loadFreshCartStore()

      const productWithMinimum = {
        ...baseProduct,
        id: 'prod-2',
        min_order_quantity: 5,
      }

      let result
      act(() => {
        result = useCartStore.getState().addItem(productWithMinimum, 2)
      })

      expect(result).toBe(false)
      expect(useCartStore.getState().items).toHaveLength(0)
      expect(mockToastError).toHaveBeenCalled()
    })

    it('rejects if stock is insufficient', () => {
      const useCartStore = loadFreshCartStore()

      const lowStockProduct = {
        ...baseProduct,
        id: 'prod-3',
        available_quantity: 3,
      }

      let result
      act(() => {
        result = useCartStore.getState().addItem(lowStockProduct, 5)
      })

      expect(result).toBe(false)
      expect(useCartStore.getState().items).toHaveLength(0)
      expect(mockToastError).toHaveBeenCalled()
    })
  })

  describe('Remove from cart', () => {
    it('removes item by productId', () => {
      const useCartStore = loadFreshCartStore()

      act(() => {
        useCartStore.getState().addItem(baseProduct, 2)
      })

      act(() => {
        useCartStore.getState().removeItem('prod-1')
      })

      expect(useCartStore.getState().items).toHaveLength(0)
    })

    it('handles removing non-existent item gracefully', () => {
      const useCartStore = loadFreshCartStore()

      act(() => {
        useCartStore.getState().addItem(baseProduct, 1)
      })

      expect(() => {
        act(() => {
          useCartStore.getState().removeItem('does-not-exist')
        })
      }).not.toThrow()

      expect(useCartStore.getState().items).toHaveLength(1)
    })
  })

  describe('Update quantity', () => {
    it('updates quantity up and down', () => {
      const useCartStore = loadFreshCartStore()

      act(() => {
        useCartStore.getState().addItem(baseProduct, 2)
      })

      act(() => {
        useCartStore.getState().updateQuantity('prod-1', 4)
      })

      expect(useCartStore.getState().items[0].quantity).toBe(4)

      act(() => {
        useCartStore.getState().updateQuantity('prod-1', 1)
      })

      expect(useCartStore.getState().items[0].quantity).toBe(1)
    })

    it('removes item when quantity reaches 0', () => {
      const useCartStore = loadFreshCartStore()

      act(() => {
        useCartStore.getState().addItem(baseProduct, 2)
      })

      act(() => {
        useCartStore.getState().updateQuantity('prod-1', 0)
      })

      expect(useCartStore.getState().items).toHaveLength(0)
    })
  })

  describe('Cart totals', () => {
    it('calculates subtotal correctly (price × quantity)', () => {
      const useCartStore = loadFreshCartStore()

      act(() => {
        useCartStore.getState().addItem(baseProduct, 3)
      })

      expect(useCartStore.getState().getSubtotal()).toBe(30)
    })

    it('calculates total with multiple items', () => {
      const useCartStore = loadFreshCartStore()

      const secondProduct = {
        ...baseProduct,
        id: 'prod-4',
        name: 'Potatoes',
        price_per_unit: 7,
        vendor_id: 'vendor-2',
      }

      act(() => {
        useCartStore.getState().addItem(baseProduct, 2)
        useCartStore.getState().addItem(secondProduct, 3)
      })

      expect(useCartStore.getState().getSubtotal()).toBe(41)
      expect(useCartStore.getState().getTotal()).toBe(41)
    })

    it('handles decimal prices correctly (MAD currency)', () => {
      const useCartStore = loadFreshCartStore()

      const decimalProduct = {
        ...baseProduct,
        id: 'prod-5',
        name: 'Olive Oil',
        unit_type: 'liter',
        price_per_unit: 12.75,
      }

      act(() => {
        useCartStore.getState().addItem(decimalProduct, 2.5)
      })

      expect(useCartStore.getState().getSubtotal()).toBeCloseTo(31.88, 2)
      expect(useCartStore.getState().getTotal()).toBeCloseTo(31.88, 2)
    })
  })

  describe('Clear cart', () => {
    it('empties all items', () => {
      const useCartStore = loadFreshCartStore()

      act(() => {
        useCartStore.getState().addItem(baseProduct, 1)
      })

      act(() => {
        useCartStore.getState().clearCart()
      })

      expect(useCartStore.getState().items).toHaveLength(0)
    })

    it('resets total to 0', () => {
      const useCartStore = loadFreshCartStore()

      act(() => {
        useCartStore.getState().addItem(baseProduct, 2)
      })

      act(() => {
        useCartStore.getState().clearCart()
      })

      expect(useCartStore.getState().getSubtotal()).toBe(0)
      expect(useCartStore.getState().getTotal()).toBe(0)
    })
  })

  describe('Persistence', () => {
    it('cart persists to localStorage', () => {
      const localStorageMock = setupLocalStorage({ language: 'en' })
      const useCartStore = loadFreshCartStore()

      act(() => {
        useCartStore.getState().addItem(baseProduct, 2)
      })

      expect(localStorageMock.setItem).toHaveBeenCalled()
      const persistedCall = localStorageMock.setItem.mock.calls.find(([key]) => key === 'cart-storage')
      expect(persistedCall).toBeDefined()

      const [, persistedPayload] = persistedCall
      const parsed = JSON.parse(persistedPayload)
      expect(parsed.state.items).toHaveLength(1)
      expect(parsed.state.items[0].id).toBe('prod-1')
    })

    it('cart is restored from localStorage on init', async () => {
      const persistedState = {
        state: {
          items: [
            {
              id: 'persisted-1',
              name: 'Persisted Item',
              price_per_unit: 9.5,
              unit_type: 'kg',
              quantity: 2,
              min_order_quantity: 1,
              is_available: true,
              available_quantity: 100,
              vendor_id: 'vendor-7',
              vendor_name: 'Persisted Vendor',
              image_url: null,
              category: 'vegetables',
            },
          ],
          lastValidated: null,
        },
        version: 3,
      }

      setupLocalStorage({
        language: 'en',
        'cart-storage': JSON.stringify(persistedState),
      })

      const useCartStore = loadFreshCartStore()

      await act(async () => {
        await Promise.resolve()
      })

      const state = useCartStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.items[0]).toMatchObject({
        id: 'persisted-1',
        quantity: 2,
      })
    })
  })
})
