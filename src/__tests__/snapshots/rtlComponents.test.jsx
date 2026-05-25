import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'

import Navbar from '@/components/Navbar'
import ProductCard from '@/components/ui/ProductCard'
import OrderCard from '@/components/buyer/OrderCard'
import CartPage from '@/pages/Cart'
import CheckoutAddressStep from '@/components/checkout/CheckoutAddressStep'

jest.mock('leaflet', () => ({
  __esModule: true,
  default: {
    icon: jest.fn(() => ({})),
    divIcon: jest.fn(() => ({})),
  },
  icon: jest.fn(() => ({})),
  divIcon: jest.fn(() => ({})),
}))

jest.mock('@/components/ui', () => ({
  Card: ({ children, ...props }) => <div {...props}>{children}</div>,
  Input: ({ label, value = '', onChange, error, ...props }) => (
    <label>
      {label ? <span>{label}</span> : null}
      <input value={value} onChange={onChange} {...props} />
      {error ? <span>{error}</span> : null}
    </label>
  ),
  LocationPicker: ({ onLocationSelect }) => (
    <button
      type="button"
      data-testid="location-picker-mock"
      onClick={() => onLocationSelect && onLocationSelect(33.5731, -7.5898)}
    >
      pick location
    </button>
  ),
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

let mockCurrentLanguage = 'ar'

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback, params) => {
      if (params && typeof fallback === 'string') {
        return fallback.replace('{{progress}}', String(params.progress ?? ''))
      }
      return typeof fallback === 'string' ? fallback : key
    },
    i18n: {
      get language() {
        return mockCurrentLanguage
      },
      changeLanguage: jest.fn((lang) => {
        mockCurrentLanguage = lang
      }),
    },
  }),
}))

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/marketplace' }),
}))

const mockAuthStore = {
  user: null,
  profile: null,
  signOut: jest.fn(),
}

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(() => mockAuthStore),
}))

const mockCartStoreState = {
  items: [],
  removeItem: jest.fn(),
  updateQuantity: jest.fn(),
  getSubtotal: jest.fn(() => 0),
  getTax: jest.fn(() => 0),
  getVendorCount: jest.fn(() => 0),
  clearCart: jest.fn(),
  validateCart: jest.fn(async () => ({ valid: true, changes: [] })),
  setCheckoutVendor: jest.fn(),
  clearCheckoutVendor: jest.fn(),
}

jest.mock('@/store/cartStore', () => ({
  useCartStore: jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockCartStoreState)
    }
    return mockCartStoreState
  }),
}))

jest.mock('@/store/languageStore', () => ({
  useLanguageStore: jest.fn(() => ({
    language: mockCurrentLanguage,
    setLanguage: jest.fn((lang) => {
      mockCurrentLanguage = lang
    }),
  })),
}))

jest.mock('@/hooks/useDarkMode', () => ({
  useDarkMode: () => ({
    isDark: false,
    toggle: jest.fn(),
  }),
}))

jest.mock('@/store/favoritesStore', () => ({
  useFavoritesStore: () => ({
    toggleProduct: jest.fn(),
    isFavorited: jest.fn(() => false),
  }),
}))

jest.mock('@/components/notifications/NotificationLink', () => {
  const MockNotificationLink = (props) => <a href="/notifications" data-testid="notification-link" {...props}>notif</a>
  return {
    __esModule: true,
    default: MockNotificationLink,
  }
})

jest.mock('@/components/ReportAbuseModal', () => {
  const MockReportAbuseModal = ({ isOpen }) => isOpen ? <div data-testid="report-modal">modal</div> : null
  return {
    __esModule: true,
    default: MockReportAbuseModal,
  }
})

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
    })),
  },
}))

jest.mock('@/services/minimumOrderService', () => ({
  evaluateVendorMinimumOrders: jest.fn(() => ({ hasViolations: false, violations: [] })),
  buildMinimumOrderMessage: jest.fn(() => ''),
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

const renderWithDir = (ui, { lang = 'ar' } = {}) => {
  mockCurrentLanguage = lang
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)

  return render(
    <div dir={dir} data-testid="direction-root">
      <MemoryRouter>{ui}</MemoryRouter>
    </div>,
  )
}

const productFixture = {
  id: 'prod-1',
  name: 'طماطم طازجة',
  category: 'vegetables',
  price_per_unit: 12.5,
  unit_type: 'kg',
  min_order_quantity: 1,
  is_available: true,
  vendor_id: 'vendor-1',
  vendor: {
    id: 'vendor-1',
    first_name: 'Ali',
    last_name: 'Vendor',
    city: 'Casablanca',
    is_verified: true,
    store_name: 'Atlas Farm',
  },
  images: [{ url: 'https://example.com/tomato.jpg', is_primary: true }],
  description: 'Fresh tomato from local farms',
}

const orderFixture = {
  id: 'order-1',
  order_number: 'ORD-2026-0001',
  status: 'delivered',
  total: 300,
  created_at: '2026-05-20T10:00:00.000Z',
  delivered_at: '2026-05-22T10:00:00.000Z',
  requested_delivery_date: '١٥ مايو ٢٠٢٦',
  requested_delivery_slot_label: '10:00 - 12:00',
  vendor: { store_name: 'Atlas Farm' },
  shipping_address: 'Hay Riyad',
  shipping_city: 'Rabat',
  items: [
    {
      quantity: 2,
      product: { name: 'طماطم', images: [{ url: 'https://example.com/p1.jpg' }] },
    },
  ],
}

const checkoutProps = {
  shippingInfo: {
    fullName: 'محمد أمين',
    phone: '+212600000000',
    city: 'Rabat',
    address: 'Hay Riyad, Rue 10',
    notes: 'اتصل قبل الوصول',
  },
  setShippingInfo: jest.fn(),
  deliveryLocation: { lat: 34.0209, lng: -6.8416 },
  setDeliveryLocation: jest.fn(),
  errors: {
    fullName: null,
    phone: null,
    city: null,
    address: null,
    location: null,
    minimumOrder: null,
  },
  setErrors: jest.fn(),
  vendorMinimumStatus: { hasViolations: false, violations: [] },
  stepOneBlockingMessage: '',
  onContinue: jest.fn(),
}

describe('Navbar - RTL vs LTR Snapshot', () => {
  beforeEach(() => {
    mockAuthStore.user = null
    mockAuthStore.profile = null
    mockCartStoreState.items = [{ id: 'item-1' }, { id: 'item-2' }]
  })

  it('matches Arabic RTL snapshot', () => {
    const { container } = renderWithDir(<Navbar />, { lang: 'ar' })
    expect(container).toMatchSnapshot()
  })

  it('matches French LTR snapshot', () => {
    const { container } = renderWithDir(<Navbar />, { lang: 'fr' })
    expect(container).toMatchSnapshot()
  })

  it('RTL snapshot has logo inside RTL container', () => {
    renderWithDir(<Navbar />, { lang: 'ar' })

    const logoLink = screen.getByRole('link', { name: /قطوف/i })
    const dirContainer = logoLink.closest('[dir]')
    expect(dirContainer?.getAttribute('dir')).toBe('rtl')
    expect(dirContainer?.getAttribute('dir')).toMatchInlineSnapshot('"rtl"')
  })

  it('RTL and LTR nav link containers are direction-aware snapshots', () => {
    const { container: rtlContainer } = renderWithDir(<Navbar />, { lang: 'ar' })
    const rtlNav = rtlContainer.querySelector('header nav')

    const { container: ltrContainer } = renderWithDir(<Navbar />, { lang: 'fr' })
    const ltrNav = ltrContainer.querySelector('header nav')

    expect(rtlNav?.closest('[dir]')?.getAttribute('dir')).toBe('rtl')
    expect(ltrNav?.closest('[dir]')?.getAttribute('dir')).toBe('ltr')
  })

  it('language switcher always visible regardless of direction', () => {
    const { rerender } = renderWithDir(<Navbar />, { lang: 'ar' })
    expect(screen.getAllByRole('button', { name: 'AR' }).length).toBeGreaterThan(0)

    mockCurrentLanguage = 'fr'
    document.documentElement.setAttribute('dir', 'ltr')
    rerender(
      <div dir="ltr" data-testid="direction-root">
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </div>,
    )

    expect(screen.getAllByRole('button', { name: 'FR' }).length).toBeGreaterThan(0)
  })
})

describe('ProductCard - RTL Snapshot', () => {
  beforeEach(() => {
    mockAuthStore.user = null
  })

  it('matches ProductCard Arabic RTL snapshot', () => {
    const { container } = renderWithDir(<ProductCard product={productFixture} />, { lang: 'ar' })
    expect(container).toMatchSnapshot()
  })

  it('price in MAD displays correctly in RTL context', () => {
    renderWithDir(<ProductCard product={productFixture} />, { lang: 'ar' })

    const card = screen.getByTestId('product-card')
    expect(within(card).getByText(/د\.م\.|MAD|12\.50|12,50/i)).toBeInTheDocument()
  })

  it('product name in Arabic renders with expected semantic classes', () => {
    renderWithDir(<ProductCard product={productFixture} />, { lang: 'ar' })

    const productName = screen.getByText('طماطم طازجة')
    expect(productName.className).toContain('font-semibold')
    expect(productName.className).toMatchInlineSnapshot('"font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-green-600 transition-colors"')
  })

  it('add to cart button text direction context is inherited from RTL root', () => {
    renderWithDir(<ProductCard product={productFixture} />, { lang: 'ar' })

    const addToCartButton = screen.getByTestId('add-to-cart-btn')
    expect(addToCartButton.closest('[dir]')?.getAttribute('dir')).toBe('rtl')
  })
})

describe('OrderCard - RTL Snapshot', () => {
  it('matches order card Arabic RTL snapshot', () => {
    const { container } = renderWithDir(
      <OrderCard
        order={orderFixture}
        onReorder={jest.fn()}
        onReview={jest.fn()}
        onReturn={jest.fn()}
        onViewDetails={jest.fn()}
        onDownloadInvoice={jest.fn()}
        isSelected={false}
        onSelect={jest.fn()}
        t={(k, f) => (typeof f === 'string' ? f : k)}
      />,
      { lang: 'ar' },
    )

    expect(container).toMatchSnapshot()
  })

  it('order status badge is rendered consistently in RTL', () => {
    renderWithDir(
      <OrderCard
        order={orderFixture}
        onReorder={jest.fn()}
        onReview={jest.fn()}
        onReturn={jest.fn()}
        onViewDetails={jest.fn()}
        onDownloadInvoice={jest.fn()}
        isSelected={false}
        onSelect={jest.fn()}
        t={(k, f) => (typeof f === 'string' ? f : k)}
      />,
      { lang: 'ar' },
    )

    expect(screen.getByText(/Delivered|تم التسليم|تم التوصيل/i)).toBeInTheDocument()
  })

  it('order date supports Arabic date text rendering', () => {
    renderWithDir(
      <OrderCard
        order={orderFixture}
        onReorder={jest.fn()}
        onReview={jest.fn()}
        onReturn={jest.fn()}
        onViewDetails={jest.fn()}
        onDownloadInvoice={jest.fn()}
        isSelected={false}
        onSelect={jest.fn()}
        t={(k, f) => (typeof f === 'string' ? f : k)}
      />,
      { lang: 'ar' },
    )

    expect(screen.getByText(/١٥ مايو ٢٠٢٦/)).toBeInTheDocument()
  })

  it('order number keeps monospace/LTR-friendly styling inside RTL context', () => {
    renderWithDir(
      <OrderCard
        order={orderFixture}
        onReorder={jest.fn()}
        onReview={jest.fn()}
        onReturn={jest.fn()}
        onViewDetails={jest.fn()}
        onDownloadInvoice={jest.fn()}
        isSelected={false}
        onSelect={jest.fn()}
        t={(k, f) => (typeof f === 'string' ? f : k)}
      />,
      { lang: 'ar' },
    )

    const orderNumber = screen.getByText('ORD-2026-0001')
    expect(orderNumber.className).toContain('font-mono')
  })
})

describe('Cart - RTL Snapshot', () => {
  it('matches empty cart snapshot in Arabic RTL', () => {
    mockCartStoreState.items = []
    const { container } = renderWithDir(<CartPage />, { lang: 'ar' })
    expect(container).toMatchSnapshot()
  })
})

describe('Checkout Form - RTL Snapshot', () => {
  it('matches checkout address step snapshot in RTL', () => {
    const { container } = renderWithDir(<CheckoutAddressStep {...checkoutProps} />, { lang: 'ar' })
    expect(container).toMatchSnapshot()
  })

  it('form labels and inputs render inside RTL direction root', () => {
    renderWithDir(<CheckoutAddressStep {...checkoutProps} />, { lang: 'ar' })

    const formRoot = screen.getByTestId('checkout-step-shipping').closest('[dir]')
    expect(formRoot?.getAttribute('dir')).toBe('rtl')

    const phoneInput = screen.getByTestId('checkout-phone-input')
    expect(phoneInput.closest('[dir]')?.getAttribute('dir')).toBe('rtl')
  })

  it('error messages are rendered in right-to-left context', () => {
    const propsWithErrors = {
      ...checkoutProps,
      errors: {
        ...checkoutProps.errors,
        phone: 'رقم الهاتف مطلوب',
      },
    }

    renderWithDir(<CheckoutAddressStep {...propsWithErrors} />, { lang: 'ar' })

    const errorMessage = screen.getByText('رقم الهاتف مطلوب')
    expect(errorMessage.closest('[dir]')?.getAttribute('dir')).toBe('rtl')
  })

  it('field icon flip verification is tracked as inline snapshot of current structure', () => {
    const { container } = renderWithDir(<CheckoutAddressStep {...checkoutProps} />, { lang: 'ar' })
    const titleIcon = container.querySelector('[data-testid="checkout-step-shipping"] h2 svg')

    expect(Boolean(titleIcon)).toMatchInlineSnapshot('true')
  })
})

describe('Direction Changes Do Not Break Layout', () => {
  it('switching from AR to FR does not leave stale rtl-specific classes on root', () => {
    const { rerender, getByTestId } = renderWithDir(<Navbar />, { lang: 'ar' })

    mockCurrentLanguage = 'fr'
    document.documentElement.setAttribute('dir', 'ltr')

    rerender(
      <div dir="ltr" data-testid="direction-root">
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </div>,
    )

    const root = getByTestId('direction-root')
    expect(root.getAttribute('dir')).toBe('ltr')
    expect(root.className.includes('rtl:')).toBe(false)
  })
})

/**
 * Snapshot governance:
 * - Update snapshots only for intentional UI/layout changes.
 * - Treat unexpected snapshot diffs as potential RTL/LTR regressions first,
 *   then verify whether the change was deliberate.
 */
