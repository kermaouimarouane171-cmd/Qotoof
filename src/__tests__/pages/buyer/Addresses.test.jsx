/**
 * Test: Addresses page handleSetDefault error handling (B-05)
 * Verifies that if unsetting previous defaults fails, the function
 * does not proceed to set the new default.
 */
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'

const mockToast = { success: jest.fn(), error: jest.fn() }
const mockUpdateCallCount = { current: 0 }

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

jest.mock('@/services/supabase', () => {
  return {
    supabase: {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              order: jest.fn().mockResolvedValue({
                data: [
                  { id: 'addr-1', label: 'Home', is_default: true, address: '123 St', type: 'home', city: 'Casablanca', region: '', postal_code: '', country: 'Morocco' },
                  { id: 'addr-2', label: 'Work', is_default: false, address: '456 Ave', type: 'work', city: 'Rabat', region: '', postal_code: '', country: 'Morocco' },
                ],
                error: null,
              }),
            })),
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => {
            mockUpdateCallCount.current++
            if (mockUpdateCallCount.current === 1) {
              return Promise.resolve({ error: { message: 'RLS violation' } })
            }
            return Promise.resolve({ error: null })
          }),
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: {}, error: null }),
          })),
        })),
        delete: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn().mockResolvedValue({ error: null }),
          })),
        })),
      })),
    },
  }
})

jest.mock('@/components/ui', () => ({
  Card: ({ children }) => <div>{children}</div>,
  LoadingSpinner: () => <div data-testid="loading">Loading...</div>,
}))

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn() },
}))

jest.mock('@heroicons/react/24/outline', () => ({
  MapPinIcon: () => <svg />,
  PlusIcon: () => <svg />,
  PencilIcon: () => <svg />,
  TrashIcon: () => <svg />,
  CheckIcon: () => <svg />,
  XMarkIcon: () => <svg />,
  HomeIcon: () => <svg />,
  BuildingOfficeIcon: () => <svg />,
  ArrowLeftIcon: () => <svg />,
}))

import BuyerAddresses from '@/pages/buyer/Addresses'
import { supabase } from '@/services/supabase'

const renderPage = () => render(
  <MemoryRouter>
    <BuyerAddresses />
  </MemoryRouter>
)

describe('Addresses handleSetDefault (B-05)', () => {
  beforeEach(() => {
    mockUpdateCallCount.current = 0
  })

  it('does not proceed to set new default when unsetting old defaults fails', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
    }, { timeout: 5000 })

    const setDefaultBtn = screen.getByText('Set as Default')
    fireEvent.click(setDefaultBtn)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to update default address')
    })

    expect(mockUpdateCallCount.current).toBe(1)
  })
})
