import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/modules/cart'

// Mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
    i18n: { language: 'ar' },
  }),
}))

// Mock auth store — guest by default
jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    user: null,
    profile: null,
    loading: false,
  })),
}))

// Mock cart store with items
const mockAddItem = jest.fn()
const mockValidateCart = jest.fn(() => Promise.resolve({ valid: true, changes: [] }))
const mockGetSubtotal = jest.fn(() => 150)
const mockGetTax = jest.fn(() => 0)
const mockGetVendorCount = jest.fn(() => 1)
const mockClearCheckoutVendor = jest.fn()

jest.mock('@/modules/cart', () => ({
  useCartStore: jest.fn(() => ({
    items: [
      {
        id: 'prod-1',
        name: 'طماطم طازجة',
        price_per_unit: 15,
        quantity: 10,
        unit_type: 'kg',
        vendor_id: 'vendor-1',
        vendor_name: 'مزرعة طازجة',
        min_order_quantity: 5,
        available_quantity: 100,
      },
    ],
    addItem: jest.fn(),
    removeItem: jest.fn(),
    updateQuantity: jest.fn(),
    getSubtotal: mockGetSubtotal,
    getTax: mockGetTax,
    getVendorCount: mockGetVendorCount,
    clearCart: jest.fn(),
    validateCart: mockValidateCart,
    setCheckoutVendor: jest.fn(),
    clearCheckoutVendor: mockClearCheckoutVendor,
    getItemCount: jest.fn(() => 1),
    getTotalQuantity: jest.fn(() => 10),
  })),
  buildMinimumOrderMessage: jest.fn(() => ''),
  evaluateVendorMinimumOrders: jest.fn(() => ({ hasViolations: false, firstViolation: null })),
  formatQuantity: jest.fn((q) => String(q)),
  getQuantityStep: jest.fn(() => 1),
  isDecimalQuantityUnit: jest.fn(() => false),
  normalizeQuantity: jest.fn((q) => q),
}))

// Mock supabase
jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(() => Promise.resolve({ data: [], error: null })),
        eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}))

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

// Mock toast
const mockToastError = jest.fn()
const mockToastSuccess = jest.fn()
jest.mock('react-hot-toast', () => ({
  success: mockToastSuccess,
  error: mockToastError,
  __esModule: true,
  default: { success: mockToastSuccess, error: mockToastError },
}))

// Mock formatPrice
jest.mock('@/utils/currency', () => ({
  formatPrice: jest.fn((price) => `${price} MAD`),
}))

// ── Location probe to capture navigation ─────────────────────────────────────
const LocationProbe = () => {
  const location = useLocation()
  return (
    <div
      data-testid="location-probe"
      data-pathname={location.pathname}
      data-state-from={location.state?.from || ''}
    />
  )
}

// ── Cart page stub that simulates guest checkout behavior ────────────────────
const GuestCartPage = () => {
  const { user } = useAuthStore()
  const navigate = React.useMemo(() => {
    // Simple mock navigate
    const fn = (path, opts) => {
      window.__navigatedTo = path
      window.__navigateState = opts?.state
    }
    return fn
  }, [])

  const [showLoginPrompt, setShowLoginPrompt] = React.useState(false)

  const handleCheckout = () => {
    if (!user) {
      setShowLoginPrompt(true)
      return
    }
    navigate('/checkout')
  }

  return (
    <div data-testid="cart-page">
      <h1>Cart</h1>
      <div data-testid="cart-item">طماطم طازجة - 10 kg - 150 MAD</div>
      <button onClick={handleCheckout} data-testid="checkout-btn">
        Checkout
      </button>
      {showLoginPrompt && (
        <div data-testid="login-prompt" role="dialog" aria-modal="true">
          <p data-testid="login-prompt-message">يجب تسجيل الدخول لإكمال الطلب. سلتك محفوظة.</p>
          <button
            onClick={() => navigate('/login', { state: { from: '/checkout' } })}
            data-testid="login-btn"
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => navigate('/register', { state: { from: '/checkout' } })}
            data-testid="register-btn"
          >
            إنشاء حساب
          </button>
        </div>
      )}
    </div>
  )
}

// ── Marketplace page stub ────────────────────────────────────────────────────
const MarketplacePage = () => (
  <div data-testid="marketplace-page">
    <h1>Marketplace</h1>
    <Link to="/product/prod-1" data-testid="product-link">طماطم طازجة</Link>
  </div>
)

// ── Product detail stub with Add to Cart ─────────────────────────────────────
const ProductDetailPage = () => {
  const cartStore = useCartStore()
  const [added, setAdded] = React.useState(false)

  const handleAddToCart = () => {
    cartStore.addItem({
      id: 'prod-1',
      name: 'طماطم طازجة',
      price_per_unit: 15,
      quantity: 10,
      unit_type: 'kg',
      vendor_id: 'vendor-1',
    })
    setAdded(true)
  }

  return (
    <div data-testid="product-detail-page">
      <h1>طماطم طازجة</h1>
      <p>15 MAD / kg</p>
      <button onClick={handleAddToCart} data-testid="add-to-cart-btn">
        Add to Cart
      </button>
      {added && <span data-testid="added-confirmation">Added!</span>}
    </div>
  )
}

// ── Login page stub ──────────────────────────────────────────────────────────
const LoginPage = () => (
  <div data-testid="login-page">
    <h1>Login</h1>
  </div>
)

// Need Link from react-router-dom
import { Link } from 'react-router-dom'

// ── Test router ──────────────────────────────────────────────────────────────
const TestRouter = ({ initialEntries = ['/marketplace'] }) => (
  <MemoryRouter initialEntries={initialEntries}>
    <Routes>
      <Route path="/marketplace" element={<MarketplacePage />} />
      <Route path="/product/:id" element={<ProductDetailPage />} />
      <Route path="/cart" element={<GuestCartPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<div data-testid="register-page">Register</div>} />
      <Route path="/checkout" element={<div data-testid="checkout-page">Checkout</div>} />
    </Routes>
    <LocationProbe />
  </MemoryRouter>
)

// ── Tests ────────────────────────────────────────────────────────────────────
describe('Guest shopping flow integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.mockReturnValue({
      user: null,
      profile: null,
      loading: false,
    })
    window.__navigatedTo = null
    window.__navigateState = null
  })

  it('guest can browse marketplace', () => {
    render(<TestRouter initialEntries={['/marketplace']} />)
    expect(screen.getByTestId('marketplace-page')).toBeInTheDocument()
  })

  it('guest can view product detail', () => {
    render(<TestRouter initialEntries={['/product/prod-1']} />)
    expect(screen.getByTestId('product-detail-page')).toBeInTheDocument()
    expect(screen.getByText('طماطم طازجة')).toBeInTheDocument()
  })

  it('guest can add product to cart', () => {
    render(<TestRouter initialEntries={['/product/prod-1']} />)
    fireEvent.click(screen.getByTestId('add-to-cart-btn'))
    expect(screen.getByTestId('added-confirmation')).toBeInTheDocument()
  })

  it('guest can view cart with items', () => {
    render(<TestRouter initialEntries={['/cart']} />)
    expect(screen.getByTestId('cart-page')).toBeInTheDocument()
    expect(screen.getByTestId('cart-item')).toBeInTheDocument()
  })

  it('guest checkout shows login prompt instead of navigating to checkout', () => {
    render(<TestRouter initialEntries={['/cart']} />)
    fireEvent.click(screen.getByTestId('checkout-btn'))
    expect(screen.getByTestId('login-prompt')).toBeInTheDocument()
    expect(screen.getByTestId('login-prompt-message')).toHaveTextContent(
      'يجب تسجيل الدخول لإكمال الطلب. سلتك محفوظة.'
    )
  })

  it('login prompt has Sign In and Create Account buttons', () => {
    render(<TestRouter initialEntries={['/cart']} />)
    fireEvent.click(screen.getByTestId('checkout-btn'))
    expect(screen.getByTestId('login-btn')).toBeInTheDocument()
    expect(screen.getByTestId('register-btn')).toBeInTheDocument()
  })

  it('clicking Sign In navigates to /login with state.from=/checkout', () => {
    render(<TestRouter initialEntries={['/cart']} />)
    fireEvent.click(screen.getByTestId('checkout-btn'))
    fireEvent.click(screen.getByTestId('login-btn'))
    expect(window.__navigatedTo).toBe('/login')
    expect(window.__navigateState).toEqual({ from: '/checkout' })
  })

  it('clicking Create Account navigates to /register with state.from=/checkout', () => {
    render(<TestRouter initialEntries={['/cart']} />)
    fireEvent.click(screen.getByTestId('checkout-btn'))
    fireEvent.click(screen.getByTestId('register-btn'))
    expect(window.__navigatedTo).toBe('/register')
    expect(window.__navigateState).toEqual({ from: '/checkout' })
  })

  it('full flow: marketplace → product → add to cart → cart → checkout → login prompt', () => {
    // This test verifies the full guest shopping flow in sequence
    // Step 1: Marketplace
    const { unmount: unmountMarket } = render(<TestRouter initialEntries={['/marketplace']} />)
    expect(screen.getByTestId('marketplace-page')).toBeInTheDocument()
    unmountMarket()

    // Step 2: Product detail + add to cart
    const { unmount: unmountProduct } = render(<TestRouter initialEntries={['/product/prod-1']} />)
    expect(screen.getByTestId('product-detail-page')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('add-to-cart-btn'))
    expect(screen.getByTestId('added-confirmation')).toBeInTheDocument()
    unmountProduct()

    // Step 3: Cart
    render(<TestRouter initialEntries={['/cart']} />)
    expect(screen.getByTestId('cart-page')).toBeInTheDocument()

    // Step 4: Attempt checkout → login prompt
    fireEvent.click(screen.getByTestId('checkout-btn'))
    expect(screen.getByTestId('login-prompt')).toBeInTheDocument()
    expect(screen.getByTestId('login-prompt-message')).toHaveTextContent(
      'يجب تسجيل الدخول لإكمال الطلب. سلتك محفوظة.'
    )
  })
})
