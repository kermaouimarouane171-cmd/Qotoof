import React from 'react'
import fs from 'fs'
import path from 'path'
import { render, screen } from '@testing-library/react'

import Button from '@/components/ui/Button'
import ProductCard from '@/components/ui/ProductCard'
import OrderCard from '@/components/buyer/OrderCard'
import Navbar from '@/components/Navbar'
import { ORDER_STATUS_COLORS } from '@/modules/orders'

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

const FORBIDDEN_COLOR_PATTERNS = [
  /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g,
  /\brgba?\(/gi,
  /\bhsla?\(/gi,
]

let mockCurrentLanguage = 'ar'

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

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/' }),
  Link: ({ children, ...props }) => <a {...props}>{children}</a>,
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    user: null,
    profile: null,
    signOut: jest.fn(),
  })),
}))

jest.mock('@/modules/cart', () => ({
  useCartStore: jest.fn((selector) => {
    const state = { items: [] }
    return typeof selector === 'function' ? selector(state) : state
  }),
  useFavoritesStore: () => ({
    toggleProduct: jest.fn(),
    isFavorited: jest.fn(() => false),
  }),
}))

jest.mock('@/store/languageStore', () => ({
  useLanguageStore: jest.fn(() => ({
    language: mockCurrentLanguage,
    setLanguage: jest.fn(),
  })),
}))

jest.mock('@/hooks/useDarkMode', () => ({
  useDarkMode: () => ({
    isDark: false,
    toggle: jest.fn(),
  }),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
  },
}))

jest.mock('@/components/notifications/NotificationLink', () => {
  const MockNotificationLink = (props) => <a data-testid="notification-link" {...props}>notif</a>
  return {
    __esModule: true,
    default: MockNotificationLink,
  }
})


jest.mock('@/components/ReportAbuseModal', () => {
  const MockReportAbuseModal = () => null
  return {
    __esModule: true,
    default: MockReportAbuseModal,
  }
})

jest.mock('@headlessui/react', () => {
  const Dialog = ({ children, ...props }) => <div {...props}>{children}</div>
  Dialog.Panel = ({ children, ...props }) => <div {...props}>{children}</div>
  Dialog.Title = ({ children, ...props }) => <h2 {...props}>{children}</h2>

  const Root = ({ children, show }) => (show ? <>{children}</> : null)
  const Child = ({ children }) => <>{children}</>

  return {
    Dialog,
    Transition: {
      Root,
      Child,
    },
  }
})

const containsForbiddenHardcodedColor = (className = '') =>
  FORBIDDEN_COLOR_PATTERNS.some((pattern) => pattern.test(className))

describe('CSS Variable Usage - No Hardcoded Colors', () => {
  it('Button component uses no hardcoded color values in class list', () => {
    render(<Button>CTA</Button>)
    const button = screen.getByRole('button', { name: 'CTA' })

    expect(containsForbiddenHardcodedColor(button.className)).toBe(false)
  })

  it('ProductCard uses no hardcoded hex colors in class names', () => {
    render(
      <ProductCard
        product={{
          id: 'p1',
          name: 'بطاطس',
          category: 'vegetables',
          price_per_unit: 10,
          unit_type: 'kg',
          min_order_quantity: 1,
          is_available: true,
          vendor_id: 'v1',
          vendor: { first_name: 'Ali', last_name: 'Vendor', city: 'Rabat', is_verified: true },
          images: [{ url: 'https://example.com/p.jpg', is_primary: true }],
        }}
      />,
    )

    const card = screen.getByTestId('product-card')
    expect(containsForbiddenHardcodedColor(card.className)).toBe(false)
  })

  it('OrderCard status badges use semantic status color utilities from constants', () => {
    expect(ORDER_STATUS_COLORS.delivered.text).toContain('text-')
    expect(ORDER_STATUS_COLORS.delivered.hex).toMatch(/^#[0-9A-Fa-f]{6}$/)

    render(
      <OrderCard
        order={{
          id: 'o1',
          order_number: 'ORD-1',
          status: 'delivered',
          total: 200,
          created_at: '2026-05-20T10:00:00.000Z',
          delivered_at: '2026-05-22T10:00:00.000Z',
          vendor: { store_name: 'Store' },
          items: [],
        }}
        onReorder={jest.fn()}
        onReview={jest.fn()}
        onReturn={jest.fn()}
        onViewDetails={jest.fn()}
        onDownloadInvoice={jest.fn()}
        isSelected={false}
        onSelect={jest.fn()}
        t={(k, f) => (typeof f === 'string' ? f : k)}
      />,
    )

    expect(screen.getByText(/Delivered|تم التسليم|تم التوصيل/i)).toBeInTheDocument()
  })

  it('Navbar uses utility classes (dark/light) instead of hardcoded hex in classNames', () => {
    render(<Navbar />)
    const header = screen.getByRole('banner')

    expect(header.className).toContain('bg-white')
    expect(header.className).toContain('dark:bg-gray-900')
    expect(containsForbiddenHardcodedColor(header.className)).toBe(false)
  })

  it('Modal overlay uses alpha utility (bg-black/50) and not hex literal', () => {
    const modalPath = path.join(process.cwd(), 'src/components/ui/Modal.jsx')
    const modalSource = fs.readFileSync(modalPath, 'utf8')

    expect(modalSource).toContain('bg-black/50')
    expect(modalSource).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
  })
})

describe('Tailwind Dark Mode Classes', () => {
  it('components with dark: classes also include baseline light classes', () => {
    render(<Navbar />)
    const header = screen.getByRole('banner')

    expect(header.className).toContain('bg-white')
    expect(header.className).toContain('dark:bg-gray-900')
  })
})

describe('Status Color Consistency', () => {
  it('ORDER_STATUS_COLORS exported map is available for status rendering', () => {
    expect(Object.keys(ORDER_STATUS_COLORS).length).toBeGreaterThan(5)
    expect(ORDER_STATUS_COLORS.pending).toEqual(
      expect.objectContaining({ bg: expect.any(String), text: expect.any(String) }),
    )
  })

  it.todo('all status displays across migrated files import constants/orderStatuses directly')
  it.todo('all status colors pass WCAG AA contrast ratio >= 4.5 in light and dark themes')
})
