/**
 * Integration test: "Add to Cart" flow
 *
 * Tests the full ProductCard → cartStore → toast pipeline.
 * Renders the real component tree (MemoryRouter).
 * Uses the real cartStore Zustand store – only Supabase API is mocked.
 *
 * ProductCard location: src/components/ui/ProductCard.jsx
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { act } from 'react'

// ─── Mock: Supabase (before imports that use it) ───────────────────────────────
const mockRpc = jest.fn().mockResolvedValue({ data: true, error: null })
const mockFrom = jest.fn()

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    }),
  },
}))

// ─── Mock: react-hot-toast ─────────────────────────────────────────────────────
const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToastSuccess(...args),
    error: (...args) => mockToastError(...args),
  },
}))

// ─── Mock: Auth store ─────────────────────────────────────────────────────────
const mockAuthState = { user: null }

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn((selector) => {
    if (typeof selector === 'function') return selector(mockAuthState)
    return mockAuthState
  }),
}))

// ─── Mock: Favorites store (merged into @/modules/cart mock, real cartStore preserved) ─────
jest.mock('@/modules/cart', () => {
  const actual = jest.requireActual('@/modules/cart')
  return {
    ...actual,
    useFavoritesStore: jest.fn((selector) => {
      const state = {
        toggleProduct: jest.fn(),
        isFavorited: jest.fn().mockReturnValue(false),
      }
      if (typeof selector === 'function') return selector(state)
      return state
    }),
  }
})

// ─── Mock: ReportAbuseModal (heavy modal with its own Supabase calls) ─────────
jest.mock('@/components/ReportAbuseModal', () => ({
  __esModule: true,
  default: () => null,
}))

// ─── Mock: logger (used inside cartStore via withRetry indirectly) ─────────────
jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

// ─── Mock: react-i18next (use real Arabic translations so t() returns Arabic) ─
jest.mock('react-i18next', () => {
  const ar = require('@/i18n/locales/ar.json')
  const t = (key, fallbackOrOptions, options) => {
    const opts = typeof fallbackOrOptions === 'object' ? fallbackOrOptions : options || {}
    const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : undefined
    const parts = key.split('.')
    let val = ar
    for (const p of parts) {
      val = val?.[p]
      if (val === undefined) break
    }
    if (typeof val === 'string' && opts) {
      Object.keys(opts).forEach((k) => {
        val = val.replace(new RegExp(`{{${k}}}`, 'g'), opts[k])
      })
    }
    return val !== undefined ? val : (fallback ?? key)
  }
  return {
    useTranslation: () => ({ t, i18n: { language: 'ar' } }),
    withTranslation: () => (Component) => Component,
    I18nextProvider: ({ children }) => children,
  }
})

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import ProductCard from '@/components/ui/ProductCard'
import { useCartStore } from '@/modules/cart'

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const makeProduct = (overrides = {}) => ({
  id: 'prod-1',
  name: 'طماطم طازجة / Tomates fraîches',
  description: 'طماطم عضوية من حديقتنا',
  price_per_unit: 8.5,
  unit_type: 'kg',
  min_order_quantity: 1,
  available_quantity: 20,
  is_available: true,
  category: 'vegetables',
  vendor_id: 'vendor-1',
  vendor: {
    first_name: 'Ahmed',
    last_name: 'Alami',
    store_name: 'Ferme Bio Alami',
    city: 'Casablanca',
    is_verified: true,
  },
  images: [{ url: 'https://example.com/tomato.jpg', is_primary: true }],
  average_rating: 4.5,
  reviews_count: 12,
  ...overrides,
})

// ─── Render helper ────────────────────────────────────────────────────────────
const renderCard = (product) =>
  render(
    <MemoryRouter>
      <ProductCard product={product} />
    </MemoryRouter>
  )

// ══════════════════════════════════════════════════════════════════════════════
describe('ProductCard – Add to Cart integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Reset cart to empty state before each test
    act(() => {
      useCartStore.setState({ items: [], lastValidated: null, checkoutVendorId: null })
    })

    // Default: vendor is open (no toast warning)
    mockRpc.mockResolvedValue({ data: true, error: null })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('1. Product card renders correctly', () => {
    it('shows the product name (Arabic and French)', () => {
      renderCard(makeProduct())

      expect(screen.getByText('طماطم طازجة / Tomates fraîches')).toBeInTheDocument()
    })

    it('shows the price in MAD', () => {
      renderCard(makeProduct({ price_per_unit: 8.5 }))

      // formatPrice(8.5) → "MAD 8,50" or similar – check for MAD token
      expect(screen.getByText(/MAD/i)).toBeInTheDocument()
    })

    it('shows the unit type', () => {
      renderCard(makeProduct({ unit_type: 'kg' }))

      expect(screen.getByText(/\/\s*kg/i)).toBeInTheDocument()
    })

    it('shows the minimum order quantity note when > 1', () => {
      renderCard(makeProduct({ min_order_quantity: 5, unit_type: 'kg' }))

      expect(screen.getByText(/الحد الأدنى:\s*5\s*kg/i)).toBeInTheDocument()
    })

    it('does not show minimum order note when min_order_quantity is 1', () => {
      renderCard(makeProduct({ min_order_quantity: 1 }))

      expect(screen.queryByText(/الحد الأدنى:/i)).not.toBeInTheDocument()
    })

    it('shows the add-to-cart button when product is available', () => {
      renderCard(makeProduct({ is_available: true }))

      expect(screen.getByTestId('add-to-cart-btn')).toBeInTheDocument()
    })

    it('shows vendor store name', () => {
      renderCard(makeProduct())

      expect(screen.getByText('Ferme Bio Alami')).toBeInTheDocument()
    })

    it('shows the product category badge', () => {
      renderCard(makeProduct({ category: 'vegetables' }))

      expect(screen.getByText('vegetables')).toBeInTheDocument()
    })

    it('renders the product image with correct alt text', () => {
      renderCard(makeProduct())

      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'https://example.com/tomato.jpg')
      expect(img).toHaveAttribute('alt', 'طماطم طازجة / Tomates fraîches')
    })

    it('renders the product card article element', () => {
      renderCard(makeProduct())

      expect(screen.getByTestId('product-card')).toBeInTheDocument()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('2. Adding to cart – happy path', () => {
    it('calls toast.success after clicking Add to Cart', async () => {
      const user = userEvent.setup()
      renderCard(makeProduct())

      await user.click(screen.getByTestId('add-to-cart-btn'))

      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringMatching(/added|ajout|إضافة|السلة/i)
      )
    })

    it('adds the product to the cart store', async () => {
      const user = userEvent.setup()
      const product = makeProduct()
      renderCard(product)

      await user.click(screen.getByTestId('add-to-cart-btn'))

      const { items } = useCartStore.getState()
      expect(items).toHaveLength(1)
      expect(items[0]).toMatchObject({ id: 'prod-1', name: product.name })
    })

    it('stores the correct price and unit in the cart', async () => {
      const user = userEvent.setup()
      renderCard(makeProduct({ price_per_unit: 8.5, unit_type: 'kg' }))

      await user.click(screen.getByTestId('add-to-cart-btn'))

      const { items } = useCartStore.getState()
      expect(items[0]).toMatchObject({ price_per_unit: 8.5, unit_type: 'kg' })
    })

    it('adds exactly min_order_quantity to the cart', async () => {
      const user = userEvent.setup()
      renderCard(makeProduct({ min_order_quantity: 3 }))

      await user.click(screen.getByTestId('add-to-cart-btn'))

      const { items } = useCartStore.getState()
      expect(items[0].quantity).toBe(3)
    })

    it('checks vendor operating hours after adding', async () => {
      const user = userEvent.setup()
      renderCard(makeProduct({ vendor_id: 'vendor-1' }))

      await user.click(screen.getByTestId('add-to-cart-btn'))

      expect(mockRpc).toHaveBeenCalledWith('is_vendor_open', { p_vendor_id: 'vendor-1' })
    })

    it('shows a warning toast when vendor is closed but still adds the item', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null })
      const user = userEvent.setup()
      renderCard(makeProduct())

      await user.click(screen.getByTestId('add-to-cart-btn'))

      // Item should be in cart
      const { items } = useCartStore.getState()
      expect(items).toHaveLength(1)

      // Wait for async vendor check
      await act(async () => {})
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/مغلق|closed/i),
        expect.anything()
      )
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('3. Quantity validation', () => {
    it('does not add item and shows error when is_available is false (via button absence)', () => {
      renderCard(makeProduct({ is_available: false }))

      // The add-to-cart button is not rendered for unavailable products
      expect(screen.queryByTestId('add-to-cart-btn')).not.toBeInTheDocument()
    })

    it('shows toast error when trying to exceed available stock', async () => {
      // Product has only 2 in stock, min_order is 1, but already 2 in cart
      act(() => {
        useCartStore.setState({
          items: [{ id: 'prod-1', quantity: 2, vendor_id: 'vendor-1', min_order_quantity: 1 }],
          lastValidated: null,
          checkoutVendorId: null,
        })
      })

      const user = userEvent.setup()
      renderCard(makeProduct({ available_quantity: 2, min_order_quantity: 1 }))

      await user.click(screen.getByTestId('add-to-cart-btn'))

      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/exceeds|dépasse|تتجاوز/i)
      )
    })

    it('does not add item to cart when stock is exceeded', async () => {
      act(() => {
        useCartStore.setState({
          items: [{ id: 'prod-1', quantity: 2, vendor_id: 'vendor-1', min_order_quantity: 1 }],
          lastValidated: null,
          checkoutVendorId: null,
        })
      })

      const user = userEvent.setup()
      renderCard(makeProduct({ available_quantity: 2, min_order_quantity: 1 }))

      await user.click(screen.getByTestId('add-to-cart-btn'))

      // Quantity should remain at 2, not increase
      const { items } = useCartStore.getState()
      expect(items[0].quantity).toBe(2)
    })

    it('respects min_order_quantity – quick-add uses it as the quantity', async () => {
      const user = userEvent.setup()
      renderCard(makeProduct({ min_order_quantity: 5, available_quantity: 50 }))

      await user.click(screen.getByTestId('add-to-cart-btn'))

      const { items } = useCartStore.getState()
      expect(items[0].quantity).toBe(5)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('4. Out of stock', () => {
    it('does not render the add-to-cart button when is_available is false', () => {
      renderCard(makeProduct({ is_available: false }))

      expect(screen.queryByTestId('add-to-cart-btn')).not.toBeInTheDocument()
    })

    it('shows "غير متوفر" overlay when is_available is false', () => {
      renderCard(makeProduct({ is_available: false }))

      expect(screen.getByText('غير متوفر')).toBeInTheDocument()
    })

    it('does not show "غير متوفر" when product is available', () => {
      renderCard(makeProduct({ is_available: true }))

      expect(screen.queryByText('غير متوفر')).not.toBeInTheDocument()
    })

    it('does not show the out-of-stock overlay when is_available is true', () => {
      renderCard(makeProduct({ is_available: true }))

      // The overlay should not be in the DOM
      expect(screen.queryByText('غير متوفر')).not.toBeInTheDocument()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('5. Updating existing cart item (same product added twice)', () => {
    it('increases quantity instead of adding a duplicate item', async () => {
      const user = userEvent.setup()
      const product = makeProduct({ min_order_quantity: 1, available_quantity: 20 })
      const { container } = renderCard(product)

      // First click
      await user.click(screen.getByTestId('add-to-cart-btn'))
      // Second click
      await user.click(screen.getByTestId('add-to-cart-btn'))

      const { items } = useCartStore.getState()
      expect(items).toHaveLength(1)
      expect(items[0].quantity).toBe(2)
    })

    it('updates the cart subtotal correctly after adding the same product twice', async () => {
      const user = userEvent.setup()
      renderCard(makeProduct({ price_per_unit: 10, min_order_quantity: 1, available_quantity: 20 }))

      await user.click(screen.getByTestId('add-to-cart-btn'))
      await user.click(screen.getByTestId('add-to-cart-btn'))

      const { items, getSubtotal } = useCartStore.getState()
      // 2 units × 10 MAD = 20
      expect(getSubtotal()).toBe(20)
    })

    it('shows success toast each time an item is added', async () => {
      const user = userEvent.setup()
      renderCard(makeProduct({ min_order_quantity: 1, available_quantity: 20 }))

      await user.click(screen.getByTestId('add-to-cart-btn'))
      await user.click(screen.getByTestId('add-to-cart-btn'))

      expect(mockToastSuccess).toHaveBeenCalledTimes(2)
    })

    it('caps quantity at available_quantity when adding the same product multiple times', async () => {
      const user = userEvent.setup()
      // 3 already in cart, only 3 total available → adding 1 more should fail
      act(() => {
        useCartStore.setState({
          items: [{ id: 'prod-1', quantity: 3, vendor_id: 'vendor-1', min_order_quantity: 1 }],
          lastValidated: null,
          checkoutVendorId: null,
        })
      })

      renderCard(makeProduct({ min_order_quantity: 1, available_quantity: 3 }))

      await userEvent.setup().click(screen.getByTestId('add-to-cart-btn'))

      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/exceeds|dépasse|تتجاوز/i)
      )

      const { items } = useCartStore.getState()
      expect(items[0].quantity).toBe(3)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('6. Favorite button', () => {
    it('shows login error when unauthenticated user tries to favorite', async () => {
      const user = userEvent.setup()
      renderCard(makeProduct())

      // Find the heart button – it is a button without data-testid="add-to-cart-btn"
      const buttons = screen.getAllByRole('button')
      const heartBtn = buttons.find((b) => b.dataset.testid !== 'add-to-cart-btn')
      expect(heartBtn).toBeTruthy()

      await user.click(heartBtn)

      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/login|sign in|تسجيل الدخول/i)
      )
    })
  })
})
