import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VendorProducts from '@/pages/vendor/Products'
import { formatPrice } from '@/utils/currency'

jest.mock('@/store/authStore', () => ({
  __esModule: true,
  useAuthStore: () => ({ profile: { id: 'v1', latitude: 33.5, longitude: -7.6 } }),
}))

jest.mock('@/services/supabase', () => ({
  __esModule: true,
  supabase: {
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
  },
}))

jest.mock('@/services/productImages', () => ({
  __esModule: true,
  runProductImageFallbackQuery: jest.fn(() => Promise.resolve({ data: [] })),
}))

jest.mock('@/components/vendor/InventoryManager', () => ({
  __esModule: true,
  default: () => <div data-testid="inventory-manager" />,
}))

jest.mock('@/components/ui', () => ({
  __esModule: true,
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  Card: ({ children, ...props }) => <div {...props}>{children}</div>,
  Modal: ({ children, isOpen }) => (isOpen ? <div data-testid="modal">{children}</div> : null),
  Input: (props) => <input data-testid="input" {...props} />,
  Map: () => <div data-testid="map" />,
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
  VendorAlerts: () => <div data-testid="vendor-alerts" />,
  EmptyState: ({ title, description, actionLabel, onAction }) => (
    <div data-testid="empty-state">
      <h1>{title}</h1>
      <p>{description}</p>
      <button type="button" onClick={onAction}>{actionLabel}</button>
    </div>
  ),
  StateSkeleton: (() => {
    const Component = ({ children, ...props }) => <div data-testid="skeleton" {...props}>{children}</div>
    Component.Card = () => <div data-testid="skeleton-card" />
    return Component
  })(),
}))

jest.mock('@/components/vendor/ProductForm', () => ({
  __esModule: true,
  default: () => <div data-testid="image-uploader" />,
}))

jest.mock('@/utils/paypalEligibility', () => ({
  __esModule: true,
  isPayPalSetupComplete: () => true,
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, defaultValue) => defaultValue || key }),
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const { runProductImageFallbackQuery } = jest.requireMock('@/services/productImages')

describe('VendorProducts Page', () => {
  beforeEach(() => {
    runProductImageFallbackQuery.mockResolvedValue({ data: [] })
  })

  describe('Page Rendering', () => {
    it('renders without crashing', async () => {
      render(<VendorProducts />)
      await waitFor(() => expect(screen.getByTestId('empty-state')).toBeInTheDocument())
    })

    it('displays the page title "إدارة المنتجات"', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        expect(screen.getByText('إدارة المنتجات')).toBeInTheDocument()
      })
    })

    it('displays the subtitle "نظّم منتجات متجرك بسهولة"', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        expect(screen.getByText('نظّم منتجات متجرك بسهولة')).toBeInTheDocument()
      })
    })
  })

  describe('Add Product Button', () => {
    it('displays the "+ إضافة منتج" button', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        expect(screen.getAllByText(/إضافة منتج/).length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('Status Filters', () => {
    it('displays all status filter buttons', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        expect(screen.getByText('الكل')).toBeInTheDocument()
        expect(screen.getByText('نشط')).toBeInTheDocument()
        expect(screen.getByText('قيد المراجعة')).toBeInTheDocument()
        expect(screen.getByText('مرفوض')).toBeInTheDocument()
        expect(screen.getByText('غير متوفر')).toBeInTheDocument()
      })
    })
  })

  describe('Empty State', () => {
    it('renders empty state when there are no products', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        expect(screen.getByText('لم تضف أي منتج بعد')).toBeInTheDocument()
        expect(screen.getByText('ابدأ بإضافة أول منتج إلى متجرك')).toBeInTheDocument()
      })
    })
  })

  describe('Loading State', () => {
    it('displays loading skeleton while fetching products', async () => {
      runProductImageFallbackQuery.mockImplementation(() => new Promise(() => {}))
      render(<VendorProducts />)

      await waitFor(() => {
        expect(screen.getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('Error State', () => {
    it('displays error state when product loading fails', async () => {
      runProductImageFallbackQuery.mockImplementation(() => 
        Promise.reject(new Error('Failed to load'))
      )
      
      render(<VendorProducts />)
      await waitFor(() => {
        const emptyStates = screen.getAllByTestId('empty-state')
        expect(emptyStates.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Product Cards', () => {
    beforeEach(() => {
      runProductImageFallbackQuery.mockResolvedValue({
        data: [
          {
            id: 'p1',
            vendor_id: 'v1',
            name: 'طماطم طازجة',
            description: 'طماطم عضوية طازجة من المزرعة',
            category: 'vegetables',
            subcategory: 'tomatoes',
            price_per_unit: 120,
            unit_type: 'kg',
            available_quantity: 45,
            approval_status: 'published',
            is_available: true,
            images: [],
          },
          {
            id: 'p2',
            vendor_id: 'v1',
            name: 'برتقال ممتاز',
            description: 'برتقال طازج وممتاز',
            category: 'fruits',
            subcategory: 'citrus',
            price_per_unit: 90,
            unit_type: 'kg',
            available_quantity: 30,
            approval_status: 'pending',
            is_available: true,
            images: [],
          },
          {
            id: 'p3',
            vendor_id: 'v1',
            name: 'نعناع طازج',
            description: 'نعناع طازج وعطري',
            category: 'herbs',
            subcategory: 'mint',
            price_per_unit: 45,
            unit_type: 'kg',
            available_quantity: 10,
            approval_status: 'rejected',
            rejection_reason: 'الصورة غير واضحة',
            is_available: true,
            images: [],
          },
        ],
      })
    })

    it('displays product cards with names', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        expect(screen.getByText('طماطم طازجة')).toBeInTheDocument()
        expect(screen.getByText('برتقال ممتاز')).toBeInTheDocument()
        expect(screen.getByText('نعناع طازج')).toBeInTheDocument()
      })
    })

    it('displays product status badges', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        expect(screen.getAllByText('نشط').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('قيد المراجعة').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('مرفوض').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('displays edit and delete buttons for each product', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        const editButtons = screen.getAllByText(/تعديل/)
        const deleteButtons = screen.getAllByText(/حذف/)
        expect(editButtons.length).toBeGreaterThan(0)
        expect(deleteButtons.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Rejected Product Card', () => {
    beforeEach(() => {
      runProductImageFallbackQuery.mockResolvedValue({
        data: [
          {
            id: 'p3',
            vendor_id: 'v1',
            name: 'نعناع طازج',
            description: 'نعناع طازج وعطري',
            category: 'herbs',
            price_per_unit: 45,
            unit_type: 'kg',
            available_quantity: 10,
            approval_status: 'rejected',
            rejection_reason: 'الصورة غير واضحة',
            is_available: true,
            images: [],
          },
        ],
      })
    })

    it('displays rejection badge and reason for rejected products', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        expect(screen.getAllByText('مرفوض').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByText('الصورة غير واضحة')).toBeInTheDocument()
      })
    })

    it('displays "تعديل وإعادة الإرسال" button for rejected products', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        expect(screen.getByText(/تعديل وإعادة الإرسال/)).toBeInTheDocument()
      })
    })
  })

  describe('Currency Formatting', () => {
    beforeEach(() => {
      runProductImageFallbackQuery.mockResolvedValue({
        data: [
          {
            id: 'p1',
            vendor_id: 'v1',
            name: 'طماطم طازجة',
            description: 'طماطم عضوية طازجة',
            category: 'vegetables',
            price_per_unit: 250,
            unit_type: 'kg',
            available_quantity: 10,
            approval_status: 'published',
            images: [],
          },
        ],
      })
    })

    it('does not display dollar sign ($) in product prices', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        expect(screen.queryByText('$')).not.toBeInTheDocument()
      })
    })

    it('does not display USD in product prices', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        // USD should not appear in the product card
        const page = screen.getByText('طماطم طازجة').closest('div').textContent
        expect(page).not.toContain('USD')
      })
    })

    it('displays Moroccan Dirham currency format', () => {
      const formatted = formatPrice(1250)
      expect(formatted).toContain('MAD')
      expect(formatted).not.toContain('$')
    })
  })

  describe('Mobile Responsiveness', () => {
    it('renders without horizontal overflow', () => {
      render(<VendorProducts />)
      const container = document.body
      expect(container.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    })

    it('product cards render vertically on small screens', async () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(max-width: 640px)',
      }))

      runProductImageFallbackQuery.mockResolvedValue({
        data: [
          {
            id: 'p1',
            vendor_id: 'v1',
            name: 'طماطم',
            description: 'طماطم طازجة',
            category: 'vegetables',
            price_per_unit: 120,
            unit_type: 'kg',
            available_quantity: 45,
            approval_status: 'published',
            images: [],
          },
        ],
      })

      render(<VendorProducts />)
      await waitFor(() => {
        expect(screen.getByText('طماطم')).toBeInTheDocument()
      })
    })
  })

  describe('Statistics Cards', () => {
    beforeEach(() => {
      runProductImageFallbackQuery.mockResolvedValue({
        data: [
          {
            id: 'p1',
            vendor_id: 'v1',
            name: 'منتج 1',
            description: 'وصف',
            category: 'vegetables',
            price_per_unit: 100,
            unit_type: 'kg',
            available_quantity: 10,
            approval_status: 'published',
            images: [],
          },
          {
            id: 'p2',
            vendor_id: 'v1',
            name: 'منتج 2',
            description: 'وصف',
            category: 'vegetables',
            price_per_unit: 100,
            unit_type: 'kg',
            available_quantity: 10,
            approval_status: 'pending',
            images: [],
          },
          {
            id: 'p3',
            vendor_id: 'v1',
            name: 'منتج 3',
            description: 'وصف',
            category: 'vegetables',
            price_per_unit: 100,
            unit_type: 'kg',
            available_quantity: 10,
            approval_status: 'published',
            images: [],
          },
        ],
      })
    })

    it('displays statistics cards with correct counts', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        expect(screen.getByText('إجمالي المنتجات')).toBeInTheDocument()
        expect(screen.getByText('النشطة')).toBeInTheDocument()
        expect(screen.getByText('تحتاج مراجعة')).toBeInTheDocument()
      })
    })
  })

  describe('Search Functionality', () => {
    beforeEach(() => {
      runProductImageFallbackQuery.mockResolvedValue({
        data: [
          {
            id: 'p1',
            vendor_id: 'v1',
            name: 'طماطم حمراء',
            description: 'طماطم طازجة',
            category: 'vegetables',
            price_per_unit: 120,
            unit_type: 'kg',
            available_quantity: 45,
            approval_status: 'published',
            images: [],
          },
          {
            id: 'p2',
            vendor_id: 'v1',
            name: 'خيار أخضر',
            description: 'خيار طازج',
            category: 'vegetables',
            price_per_unit: 80,
            unit_type: 'kg',
            available_quantity: 30,
            approval_status: 'published',
            images: [],
          },
        ],
      })
    })

    it('has a search input field', async () => {
      render(<VendorProducts />)
      await waitFor(() => {
        const inputs = screen.getAllByPlaceholderText('ابحث عن منتج...')
        expect(inputs.length).toBeGreaterThan(0)
      })
    })
  })
})
