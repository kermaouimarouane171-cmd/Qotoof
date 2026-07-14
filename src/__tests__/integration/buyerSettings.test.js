import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import BuyerSettings from '@/pages/buyer/Settings'

const mockNavigate = jest.fn()
const mockDeleteAccount = jest.fn()
const mockToast = { success: jest.fn(), error: jest.fn() }

const mockFetchProfileFn = jest.fn()
const mockProfilesService = {
  fetchProfile: jest.fn(),
  updateProfile: jest.fn(),
}
const mockFetchOrders = jest.fn()

let mockUserSettingsRow = {
  email_notifications: true,
  sms_notifications: false,
  push_notifications: true,
  order_updates: true,
  promotional_emails: false,
  delivery_updates: true,
  show_phone_to_vendors: true,
  show_email_to_vendors: false,
}

// Settings.jsx now uses delete+insert pattern instead of upsert
const mockUserSettingsInsert = jest.fn(async () => ({ error: null }))
const mockUserSettingsDelete = jest.fn(() => ({
  eq: jest.fn(() => ({
    eq: jest.fn(async () => ({ error: null })),
  })),
}))

const makeSupabaseBuilder = (tableName) => {
  if (tableName === 'user_settings') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({
              data: { setting_value: mockUserSettingsRow },
              error: null,
            })),
          })),
          single: jest.fn(async () => ({ data: mockUserSettingsRow, error: null })),
        })),
      })),
      delete: (...args) => mockUserSettingsDelete(...args),
      insert: (...args) => mockUserSettingsInsert(...args),
      // Keep upsert mock for backward compat with other tests
      upsert: jest.fn(async () => ({ error: null })),
    }
  }

  if (tableName === 'favorites') {
    return {
      select: jest.fn(() => ({
        eq: jest.fn(async () => ({ data: [{ id: 'fav-1' }], error: null })),
      })),
    }
  }

  return {
    select: jest.fn(() => ({
      eq: jest.fn(async () => ({ data: [], error: null })),
    })),
    upsert: jest.fn(async () => ({ error: null })),
  }
}

const mockFrom = jest.fn((tableName) => makeSupabaseBuilder(tableName))

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k, fallback) => fallback }),
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToast.success(...args),
    error: (...args) => mockToast.error(...args),
  },
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    user: { id: 'buyer-1', email: 'buyer@greenmarket.test' },
    profile: { id: 'buyer-1', email: 'buyer@greenmarket.test', phone: '+212600000001', phone_verified: true },
    deleteAccount: (...args) => mockDeleteAccount(...args),
  })),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}))

jest.mock('@/services/profilesService', () => ({
  fetchProfile: (...args) => mockFetchProfileFn(...args),
  profilesService: {
    fetchProfile: (...args) => mockProfilesService.fetchProfile(...args),
    updateProfile: (...args) => mockProfilesService.updateProfile(...args),
  },
}))

jest.mock('@/services/ordersService', () => ({
  fetchBuyerOrdersAll: (...args) => mockFetchOrders(...args),
}))

jest.mock('@/components/ui', () => ({
  Card: ({ children }) => <div>{children}</div>,
  LoadingSpinner: () => <div>loading</div>,
}))

jest.mock('@/components/auth/PhoneVerification', () => ({
  PhoneVerificationDialog: ({ open, onVerified }) => (
    open ? <button onClick={onVerified}>verify-phone-action</button> : null
  ),
}))

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn() },
}))

const renderPage = () => render(
  <MemoryRouter>
    <BuyerSettings />
  </MemoryRouter>
)

describe('Buyer Settings integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockProfilesService.fetchProfile.mockResolvedValue({
      data: {
        email_notifications: true,
        order_updates: true,
        marketing_emails: false,
        data_sharing: false,
      },
      error: null,
    })

    mockProfilesService.updateProfile.mockResolvedValue({ data: {}, error: null })
    mockFetchProfileFn.mockResolvedValue({ id: 'buyer-1', email: 'buyer@greenmarket.test' })
    mockFetchOrders.mockResolvedValue([{ id: 'order-1' }])
    mockUserSettingsInsert.mockClear()
    mockUserSettingsDelete.mockClear()

    global.URL.createObjectURL = jest.fn(() => 'blob:url')
    global.URL.revokeObjectURL = jest.fn()
  })

  it('loads buyer settings on mount from user_settings', async () => {
    renderPage()

    expect(await screen.findByText('Settings')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('user_settings')
      expect(mockProfilesService.fetchProfile).toHaveBeenCalledWith('buyer-1')
    })

    expect(screen.getByText('Email Notifications')).toBeInTheDocument()
    expect(screen.getByText('SMS Notifications')).toBeInTheDocument()
    expect(screen.getByText('Push Notifications')).toBeInTheDocument()
  })

  it('updates notification toggles and persists using user_settings delete+insert', async () => {
    renderPage()

    await screen.findByText('Save Settings')

    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[0])

    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    await waitFor(() => {
      // Settings.jsx now uses delete+insert pattern (not upsert)
      expect(mockUserSettingsInsert).toHaveBeenCalled()
    })

    expect(mockToast.success).toHaveBeenCalled()
  })

  it('saves privacy preferences to profiles service', async () => {
    renderPage()

    await screen.findByText('Save Privacy Preferences')

    const privacySwitches = screen.getAllByRole('switch')
    fireEvent.click(privacySwitches[8])

    fireEvent.click(screen.getByRole('button', { name: 'Save Privacy Preferences' }))

    await waitFor(() => {
      expect(mockProfilesService.updateProfile).toHaveBeenCalledWith(
        'buyer-1',
        expect.objectContaining({ marketing_emails: true }),
      )
    })

    expect(mockToast.success).toHaveBeenCalled()
  })

  it('exports buyer data as JSON', async () => {
    const originalCreateElement = document.createElement.bind(document)
    const createElementSpy = jest.spyOn(document, 'createElement')
    const clickSpy = jest.fn()

    createElementSpy.mockImplementation((tagName) => {
      if (tagName === 'a') {
        return { click: clickSpy, set href(v) { this._href = v }, set download(v) { this._download = v } }
      }
      return originalCreateElement(tagName)
    })

    renderPage()
    await screen.findByText('Export My Data (JSON)')

    fireEvent.click(screen.getByRole('button', { name: 'Export My Data (JSON)' }))

    await waitFor(() => {
      expect(mockFetchOrders).toHaveBeenCalledWith('buyer-1')
      expect(mockFetchProfileFn).toHaveBeenCalledWith('buyer-1')
      expect(clickSpy).toHaveBeenCalledTimes(1)
    })

    createElementSpy.mockRestore()
  })

  it('deletes account through confirmation flow and phone verification', async () => {
    mockDeleteAccount.mockResolvedValue({ success: true })

    renderPage()
    await screen.findByText('Delete My Account')

    fireEvent.click(screen.getByRole('button', { name: 'Delete My Account' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.change(screen.getByPlaceholderText('Type "DELETE" here'), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    fireEvent.click(screen.getByRole('button', { name: 'Delete Forever' }))
    fireEvent.click(screen.getByRole('button', { name: 'verify-phone-action' }))

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith('DELETE')
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    })
  })

  it('shows quick links and navigates to addresses/security/coupons', async () => {
    renderPage()
    await screen.findByText('Manage Addresses')

    fireEvent.click(screen.getByRole('button', { name: 'Manage Addresses →' }))
    expect(mockNavigate).toHaveBeenCalledWith('/buyer/addresses')

    fireEvent.click(screen.getByRole('button', { name: 'Security Settings →' }))
    expect(mockNavigate).toHaveBeenCalledWith('/buyer/security')

    fireEvent.click(screen.getByRole('button', { name: 'My Coupons →' }))
    expect(mockNavigate).toHaveBeenCalledWith('/buyer/coupons')
  })
})
