/**
 * Test: ShoppingLists page error handling (B-04)
 * Verifies that toast.error is shown when list loading fails.
 */
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'

const mockToast = { success: jest.fn(), error: jest.fn() }
const mockFrom = jest.fn()

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return { ...actual, useNavigate: () => jest.fn() }
})

jest.mock('react-i18next', () => {
  const t = (_k, fallback) => fallback
  return { useTranslation: () => ({ t }) }
})

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToast.success(...args),
    error: (...args) => mockToast.error(...args),
  },
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'buyer-1' } }),
}))

jest.mock('@/modules/cart', () => ({
  useCartStore: () => ({ addItem: jest.fn() }),
}))

jest.mock('@/services/supabase', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

jest.mock('@/services/productImages', () => ({
  isProductImagesRelationError: jest.fn(() => false),
  hydrateRowsWithProductItems: jest.fn(async (rows) => rows),
}))

jest.mock('@/components/ui', () => ({
  Card: ({ children }) => <div>{children}</div>,
  LoadingSpinner: () => <div data-testid="loading">Loading...</div>,
}))

jest.mock('@/utils/currency', () => ({
  formatPrice: (v) => String(v),
}))

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}))

jest.mock('@heroicons/react/24/outline', () => ({
  ClipboardDocumentListIcon: () => <svg />,
  PlusIcon: () => <svg />,
  TrashIcon: () => <svg />,
  ShoppingCartIcon: () => <svg />,
  ArrowLeftIcon: () => <svg />,
  XMarkIcon: () => <svg />,
  CheckIcon: () => <svg />,
}))

import ShoppingLists from '@/pages/buyer/ShoppingLists'

const renderPage = () => render(
  <MemoryRouter>
    <ShoppingLists />
  </MemoryRouter>
)

describe('ShoppingLists page error handling (B-04)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows toast.error when load fails with thrown error', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn().mockRejectedValue(new Error('Network error')),
        })),
      })),
    })

    renderPage()

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to load shopping lists',
      )
    })
  })

  it('does not show toast.error on successful load', async () => {
    mockFrom.mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn().mockResolvedValue({
            data: [{ id: 'l1', name: 'My List', items: [] }],
            error: null,
          }),
        })),
      })),
    })

    renderPage()

    await waitFor(() => {
      expect(mockToast.error).not.toHaveBeenCalled()
    })
  })
})
