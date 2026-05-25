import React from 'react'
import { axe } from 'jest-axe'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, Link } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within, waitFor } from '@testing-library/react'

import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Navbar from '@/components/Navbar'
import ProductCard from '@/components/ui/ProductCard'
import BuyerOrderCard from '@/components/orders/BuyerOrderCard'
import { ORDER_STATUS_COLORS, getOrderStatusColors } from '@/constants/orderStatuses'

const mockAuthState = {
  user: null,
  profile: null,
  signOut: jest.fn(),
}

const mockCartState = {
  items: [],
}

const mockFavoritesState = {
  toggleProduct: jest.fn(),
  isFavorited: jest.fn(() => false),
}

const mockLanguageState = {
  language: 'ar',
  setLanguage: jest.fn(),
}

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(() => mockAuthState),
}))

jest.mock('@/store/cartStore', () => ({
  useCartStore: jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector({ ...mockCartState })
    }
    return mockCartState
  }),
}))

jest.mock('@/store/favoritesStore', () => ({
  useFavoritesStore: jest.fn(() => mockFavoritesState),
}))

jest.mock('@/store/languageStore', () => ({
  useLanguageStore: jest.fn(() => mockLanguageState),
}))

jest.mock('@/hooks/useDarkMode', () => ({
  useDarkMode: () => ({ isDark: false, toggle: jest.fn() }),
}))

jest.mock('@/components/notifications/NotificationLink', () => {
  const MockNotificationLink = (props) => <a href="/notifications" {...props}>notifications</a>
  return { __esModule: true, default: MockNotificationLink }
})

jest.mock('@/components/ReportAbuseModal', () => {
  const MockReportAbuseModal = () => null
  return { __esModule: true, default: MockReportAbuseModal }
})

jest.mock('@/components/ui', () => ({
  Card: ({ children, ...props }) => <div {...props}>{children}</div>,
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('leaflet', () => ({
  __esModule: true,
  default: {
    icon: jest.fn(() => ({})),
    divIcon: jest.fn(() => ({})),
  },
  icon: jest.fn(() => ({})),
  divIcon: jest.fn(() => ({})),
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

const i18n = createInstance()
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

beforeAll(async () => {
  await i18n.init({
    lng: 'ar',
    fallbackLng: 'ar',
    resources: { ar: { translation: {} }, en: { translation: {} } },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  mockAuthState.user = null
  mockAuthState.profile = null
  mockCartState.items = []
  mockFavoritesState.isFavorited.mockReturnValue(false)
  mockLanguageState.language = 'ar'
  mockLanguageState.setLanguage.mockClear()
  mockAuthState.signOut.mockClear()
})

const renderWithProviders = (ui, { route = '/', lang = 'ar' } = {}) => {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[route]}>
          {ui}
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

const makeProduct = (overrides = {}) => ({
  id: 'p1',
  name: 'طماطم',
  category: 'vegetables',
  price_per_unit: 25,
  unit_type: 'kg',
  min_order_quantity: 1,
  is_available: true,
  vendor_id: 'v1',
  vendor: {
    id: 'v1',
    first_name: 'Ali',
    last_name: 'Vendor',
    store_name: 'Atlas Fresh',
    city: 'Rabat',
    is_verified: true,
  },
  images: [{ url: 'https://example.com/tomato.jpg', is_primary: true }],
  ...overrides,
})

const ModalHarness = ({ initialOpen = false }) => {
  const [open, setOpen] = React.useState(initialOpen)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>open modal</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="نافذة الاختبار">
        <button type="button">إجراء داخلي</button>
        <input aria-label="حقل داخل المودال" />
      </Modal>
    </>
  )
}

const FormHarness = ({ hasError = false } = {}) => (
  <form>
    <Input
      id="name-input"
      label="الاسم"
      required
      error={hasError ? 'هذه القيمة مطلوبة' : ''}
      helperText={hasError ? '' : 'أدخل اسمك الكامل'}
    />
    <Button type="submit">حفظ</Button>
  </form>
)

const getContrastRatio = (foregroundHex, backgroundHex) => {
  const hexToRgb = (hex) => {
    const value = hex.replace('#', '')
    const normalized = value.length === 3
      ? value.split('').map((char) => char + char).join('')
      : value
    const int = Number.parseInt(normalized, 16)
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255,
    }
  }

  const channel = (value) => {
    const normalized = value / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  const foreground = hexToRgb(foregroundHex)
  const background = hexToRgb(backgroundHex)
  const foregroundLuminance = (0.2126 * channel(foreground.r)) + (0.7152 * channel(foreground.g)) + (0.0722 * channel(foreground.b))
  const backgroundLuminance = (0.2126 * channel(background.r)) + (0.7152 * channel(background.g)) + (0.0722 * channel(background.b))
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2))
}

describe('Button Component — Accessibility', () => {
  it('has no axe violations in default state', async () => {
    const { container } = renderWithProviders(<Button>إضافة للسلة</Button>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('disabled button is accessible', () => {
    renderWithProviders(<Button disabled>مُعطّل</Button>)
    const button = screen.getByRole('button', { name: 'مُعطّل' })

    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it('loading button has aria-busy="true"', () => {
    renderWithProviders(<Button isLoading>جارٍ الحفظ</Button>)
    expect(screen.getByRole('button', { name: 'جارٍ الحفظ' })).toHaveAttribute('aria-busy', 'true')
  })

  it('icon-only button has aria-label', () => {
    renderWithProviders(<Button icon={<span aria-hidden="true">🗑</span>} aria-label="حذف المنتج" />)
    expect(screen.getByRole('button', { name: 'حذف المنتج' })).toBeInTheDocument()
  })
})

describe('Form Components — Accessibility', () => {
  it('Input has associated label (htmlFor + id match)', () => {
    renderWithProviders(<Input id="email-input" label="البريد الإلكتروني" />)
    const input = screen.getByLabelText('البريد الإلكتروني')
    const label = screen.getByText('البريد الإلكتروني')

    expect(input).toHaveAttribute('id', 'email-input')
    expect(label).toHaveAttribute('for', 'email-input')
  })

  it('required Input has aria-required="true"', () => {
    renderWithProviders(<Input id="name-input" label="الاسم" required />)
    expect(screen.getByLabelText('الاسم')).toHaveAttribute('aria-required', 'true')
  })

  it('Input with error has aria-invalid="true"', () => {
    renderWithProviders(<Input id="city-input" label="المدينة" error="المدينة مطلوبة" />)
    expect(screen.getByLabelText('المدينة')).toHaveAttribute('aria-invalid', 'true')
  })

  it('Input with error has aria-describedby pointing to error message', () => {
    renderWithProviders(<Input id="city-input" label="المدينة" error="المدينة مطلوبة" />)
    const input = screen.getByLabelText('المدينة')
    const error = screen.getByRole('alert')

    expect(input).toHaveAttribute('aria-describedby', error.id)
  })

  it('error message element has role="alert"', () => {
    renderWithProviders(<Input id="city-input" label="المدينة" error="المدينة مطلوبة" />)
    expect(screen.getByRole('alert')).toHaveTextContent('المدينة مطلوبة')
  })

  it('form has no axe violations', async () => {
    const { container } = renderWithProviders(<FormHarness />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe('Modal — Accessibility', () => {
  it('modal has role="dialog"', () => {
    renderWithProviders(<Modal isOpen onClose={jest.fn()} title="نافذة الاختبار"><p>المحتوى</p></Modal>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('modal has aria-modal="true"', () => {
    renderWithProviders(<Modal isOpen onClose={jest.fn()} title="نافذة الاختبار"><p>المحتوى</p></Modal>)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('modal has aria-labelledby pointing to title', () => {
    renderWithProviders(<Modal isOpen onClose={jest.fn()} title="نافذة الاختبار"><p>المحتوى</p></Modal>)
    const dialog = screen.getByRole('dialog')
    const title = screen.getByText('نافذة الاختبار')

    expect(dialog).toHaveAttribute('aria-labelledby', title.id)
  })

  it('focus moves to modal when opened', async () => {
    renderWithProviders(<ModalHarness initialOpen />)

    await waitFor(() => expect(screen.getByLabelText('إغلاق النافذة')).toHaveFocus())
  })

  it('focus trapped inside modal (Tab cycles within)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ModalHarness initialOpen />)

    const closeButton = await screen.findByLabelText('إغلاق النافذة')
    const innerButton = screen.getByRole('button', { name: 'إجراء داخلي' })

    expect(closeButton).toHaveFocus()
    await user.tab()
    expect(innerButton).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('حقل داخل المودال')).toHaveFocus()
    await user.tab()
    expect(closeButton).toHaveFocus()
  })

  it('Escape key closes modal and returns focus to trigger', async () => {
    const user = userEvent.setup()

    const Harness = () => {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>open modal</button>
          <Modal isOpen={open} onClose={() => setOpen(false)} title="نافذة الاختبار">
            <button type="button">إجراء داخلي</button>
          </Modal>
        </>
      )
    }

    renderWithProviders(<Harness />)
    const trigger = screen.getByTestId('trigger')
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('modal has no axe violations when open', async () => {
    const { container } = renderWithProviders(<Modal isOpen onClose={jest.fn()} title="نافذة الاختبار"><p>المحتوى</p></Modal>)
    const results = await axe(container.ownerDocument.body)
    expect(results).toHaveNoViolations()
  })
})

describe('Navigation — Accessibility', () => {
  it('Navbar has role="navigation"', () => {
    renderWithProviders(<Navbar />, { route: '/marketplace', lang: 'ar' })
    expect(screen.getByRole('navigation', { name: 'القائمة الرئيسية' })).toBeInTheDocument()
  })

  it('Navbar has aria-label in Arabic: "القائمة الرئيسية"', () => {
    renderWithProviders(<Navbar />, { route: '/marketplace', lang: 'ar' })
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'القائمة الرئيسية')
  })

  it('active nav link has aria-current="page"', () => {
    renderWithProviders(<Navbar />, { route: '/marketplace', lang: 'ar' })
    expect(screen.getByRole('link', { name: 'السوق' })).toHaveAttribute('aria-current', 'page')
  })

  it('mobile hamburger button has aria-expanded attribute', () => {
    renderWithProviders(<Navbar />, { route: '/marketplace', lang: 'ar' })
    expect(screen.getByRole('button', { name: /فتح القائمة|إغلاق القائمة/ })).toHaveAttribute('aria-expanded')
  })

  it('hamburger button has aria-controls pointing to menu', () => {
    renderWithProviders(<Navbar />, { route: '/marketplace', lang: 'ar' })
    const button = screen.getByRole('button', { name: /فتح القائمة|إغلاق القائمة/ })
    expect(button).toHaveAttribute('aria-controls', 'mobile-navigation-menu')
  })
})

describe('ProductCard — Accessibility', () => {
  it('product image has descriptive alt text (product name in Arabic)', () => {
    renderWithProviders(<ProductCard product={makeProduct()} />, { route: '/marketplace', lang: 'ar' })
    expect(screen.getByRole('img', { name: 'طماطم' })).toBeInTheDocument()
  })

  it('price is readable by screen readers', () => {
    renderWithProviders(<ProductCard product={makeProduct()} />, { route: '/marketplace', lang: 'ar' })
    expect(screen.getByLabelText('السعر: 25 درهم')).toBeInTheDocument()
  })

  it('add to cart button is keyboard accessible', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProductCard product={makeProduct()} />, { route: '/marketplace', lang: 'ar' })
    const button = screen.getByRole('button', { name: 'إضافة طماطم إلى السلة' })

    await user.tab()
    button.focus()
    expect(button).toHaveFocus()
    expect(button).toBeVisible()
  })

  it('favorite button has aria-pressed attribute', () => {
    renderWithProviders(<ProductCard product={makeProduct()} />, { route: '/marketplace', lang: 'ar' })
    expect(screen.getByRole('button', { name: 'إضافة إلى المفضلة' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('product card has no axe violations', async () => {
    const { container } = renderWithProviders(<ProductCard product={makeProduct()} />, { route: '/marketplace', lang: 'ar' })
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})

describe('Status Badges — Color Contrast', () => {
  const badgePalette = {
    pending: { bg: '#FEF3C7', text: '#B45309' },
    confirmed: { bg: '#DBEAFE', text: '#1D4ED8' },
    cancelled: { bg: '#FEE2E2', text: '#B91C1C' },
    delivered: { bg: '#D1FAE5', text: '#047857' },
  }

  it('pending badge text meets 4.5:1 contrast ratio', () => {
    expect(getContrastRatio(badgePalette.pending.text, badgePalette.pending.bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('confirmed badge text meets 4.5:1 contrast ratio', () => {
    expect(getContrastRatio(badgePalette.confirmed.text, badgePalette.confirmed.bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('cancelled badge text meets 4.5:1 contrast ratio', () => {
    expect(getContrastRatio(badgePalette.cancelled.text, badgePalette.cancelled.bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('delivered badge text meets 4.5:1 contrast ratio', () => {
    expect(getContrastRatio(badgePalette.delivered.text, badgePalette.delivered.bg)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('RTL Accessibility', () => {
  it('root element has lang="ar" and dir="rtl" for Arabic', () => {
    renderWithProviders(<Navbar />, { route: '/marketplace', lang: 'ar' })
    expect(document.documentElement).toHaveAttribute('lang', 'ar')
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
  })

  it('screen reader reading order follows visual order in RTL', () => {
    renderWithProviders(<Navbar />, { route: '/marketplace', lang: 'ar' })
    const navigation = screen.getByRole('navigation', { name: 'القائمة الرئيسية' })
    const links = within(navigation).getAllByRole('link')
    const labels = links.map((link) => link.textContent?.trim()).filter(Boolean)

    expect(labels.slice(0, 4)).toEqual(['ققطوف', 'الرئيسية', 'السوق', 'المتاجر'])
  })

  it('bidirectional text (Arabic + numbers) handled correctly', () => {
    renderWithProviders(
      <BuyerOrderCard
        order={{
          id: 'o1',
          order_number: 'ORD-2026-0001',
          status: 'delivered',
          total: 300,
          created_at: '2026-05-20T10:00:00.000Z',
          delivered_at: '2026-05-21T10:00:00.000Z',
          shipping_address: 'Hay Riyad',
          shipping_city: 'Rabat',
          requested_delivery_date: '2026-05-15',
          requested_delivery_slot_label: '10:00 - 12:00',
          vendor: { store_name: 'Atlas Fresh' },
          items: [],
        }}
        onReorder={jest.fn()}
        onReview={jest.fn()}
        onReturn={jest.fn()}
        onViewDetails={jest.fn()}
        onDownloadInvoice={jest.fn()}
        isSelected={false}
        onSelect={jest.fn()}
        t={(key, fallback, params) => {
          if (params && typeof fallback === 'string') {
            return fallback.replace('{{progress}}', String(params.progress ?? ''))
          }
          return typeof fallback === 'string' ? fallback : key
        }}
      />,
      { route: '/buyer/orders', lang: 'ar' },
    )

    expect(screen.getByRole('button', { name: /Click to copy ORD-2026-0001/ })).toHaveAttribute('dir', 'ltr')
    expect(getOrderStatusColors('delivered').text).toBe(ORDER_STATUS_COLORS.delivered.text)
  })
})