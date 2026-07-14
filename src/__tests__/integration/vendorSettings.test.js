import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import VendorSettingsPage from '@/pages/vendor/Settings'

const mockNavigate = jest.fn()
const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
}

const mockAuthState = {
  user: { id: 'vendor-1' },
  profile: {
    id: 'vendor-1',
    role: 'vendor',
    store_name: 'Green Atlas',
  },
}

const mockSetAuthState = jest.fn()

const mockProfilesService = {
  fetchVendorProfile: jest.fn(),
  updateProfile: jest.fn(),
}

const mockStoreTypeService = {
  decorateStoreProfile: jest.fn(),
}

const mockCancellationService = {
  getVendorCancellationPolicy: jest.fn(),
  upsertVendorCancellationPolicy: jest.fn(),
}

const mockRefundPolicyService = {
  getVendorRefundPolicy: jest.fn(),
  upsertVendorRefundPolicy: jest.fn(),
}

const mockStoreEmergencyService = {
  pauseStore: jest.fn(),
  resumeStore: jest.fn(),
}

const mockAuditLogger = {
  logProfileAction: jest.fn(),
}

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback,
  }),
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToast.success(...args),
    error: (...args) => mockToast.error(...args),
  },
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(jest.fn(() => mockAuthState), {
    setState: (...args) => mockSetAuthState(...args),
  }),
}))

jest.mock('@/services/profilesService', () => ({
  profilesService: {
    fetchVendorProfile: (...args) => mockProfilesService.fetchVendorProfile(...args),
    updateProfile: (...args) => mockProfilesService.updateProfile(...args),
  },
}))

jest.mock('@/services/storeTypeService', () => ({
  __esModule: true,
  default: {
    decorateStoreProfile: (...args) => mockStoreTypeService.decorateStoreProfile(...args),
  },
}))

jest.mock('@/services/cancellationService', () => ({
  __esModule: true,
  default: {
    getVendorCancellationPolicy: (...args) => mockCancellationService.getVendorCancellationPolicy(...args),
    upsertVendorCancellationPolicy: (...args) => mockCancellationService.upsertVendorCancellationPolicy(...args),
  },
  DEFAULT_VENDOR_CANCELLATION_POLICY: {
    allow_cancellation: true,
    free_cancellation_window_minutes: 120,
    cancellation_fee_type: 'fixed',
    cancellation_fee_value: 0,
    refund_percentage: 100,
    cutoff_status: 'vendor_accepted',
    auto_approve_before_preparing: true,
    policy_text_ar: '',
  },
  normalizeCancellationPolicy: (policy = {}) => ({
    allow_cancellation: true,
    free_cancellation_window_minutes: 120,
    cancellation_fee_type: 'fixed',
    cancellation_fee_value: 0,
    refund_percentage: 100,
    cutoff_status: 'vendor_accepted',
    auto_approve_before_preparing: true,
    policy_text_ar: '',
    ...policy,
  }),
}))

jest.mock('@/modules/payments', () => ({
  refundPolicyService: {
    getVendorRefundPolicy: (...args) => mockRefundPolicyService.getVendorRefundPolicy(...args),
    upsertVendorRefundPolicy: (...args) => mockRefundPolicyService.upsertVendorRefundPolicy(...args),
  },
  DEFAULT_REFUND_POLICY: {
    return_window_days: 7,
    allow_partial_returns: true,
    return_shipping_paid_by: 'buyer',
    non_returnable_categories: [],
    policy_text: 'Refund policy text',
  },
}))

jest.mock('@/services/storeEmergencyService', () => ({
  __esModule: true,
  default: {
    pauseStore: (...args) => mockStoreEmergencyService.pauseStore(...args),
    resumeStore: (...args) => mockStoreEmergencyService.resumeStore(...args),
  },
}))

jest.mock('@/services/auditLogger', () => ({
  auditLogger: {
    logProfileAction: (...args) => mockAuditLogger.logProfileAction(...args),
  },
}))

jest.mock('@/components/ErrorBoundary', () => {
  return function ErrorBoundaryMock({ children }) {
    return children
  }
})

jest.mock('@/components/ui', () => ({
  Card: ({ children, className = '' }) => <div className={className}>{children}</div>,
  LoadingSpinner: () => <div>Loading...</div>,
  Tooltip: ({ children }) => <>{children}</>,
  Input: ({ label, value, onChange, type = 'text', error, ...props }) => (
    <div>
      <label>
        <span>{label}</span>
        <input aria-label={label} type={type} value={value} onChange={onChange} {...props} />
      </label>
      {error ? <div role="alert">{error}</div> : null}
    </div>
  ),
}))

jest.mock('@/components/ui/LocationPicker', () => {
  return function LocationPickerMock({ onChange }) {
    return (
      <button onClick={() => onChange({ lat: 33.57, lng: -7.59, address: 'Casablanca' })}>
        Set Location
      </button>
    )
  }
})

jest.mock('@/components/vendor/PaymentPolicySettings', () => {
  return function PaymentPolicySettingsMock({ onChange }) {
    return <button onClick={() => onChange({ full: true, split: false, cod: true })}>Change Payment Policies</button>
  }
})

jest.mock('@/components/vendor/CancellationPolicy', () => {
  return function CancellationPolicyMock({ onChange }) {
    return <button onClick={() => onChange({ free_cancellation_window_minutes: 90 })}>Change Cancellation Policy</button>
  }
})

jest.mock('@/components/vendor/RefundPolicySettings', () => {
  return function RefundPolicySettingsMock({ onChange }) {
    return <button onClick={() => onChange({ return_window_days: 10, policy_text: 'Updated policy' })}>Change Refund Policy</button>
  }
})

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}))

const renderPage = () => {
  return render(
    <MemoryRouter>
      <VendorSettingsPage />
    </MemoryRouter>
  )
}

describe('Vendor settings integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockProfilesService.fetchVendorProfile
      .mockResolvedValueOnce({
        data: {
          store_name: 'Green Atlas',
          min_order_amount: 50,
          currency: 'MAD',
          low_stock_threshold: 10,
          paypal_email: 'vendor@greenatlas.ma',
          paypal_verified: true,
          payment_policy_full: true,
          payment_policy_split: true,
          payment_policy_cod: false,
          notify_new_orders: true,
          notify_order_updates: true,
          notify_customer_messages: true,
          notify_low_stock: true,
          notify_reviews: true,
          store_paused: false,
          store_paused_reason: '',
          latitude: 33.57,
          longitude: -7.59,
          store_address: 'Casablanca',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          store_name: 'Green Atlas',
          min_order_amount: 50,
          currency: 'MAD',
          low_stock_threshold: 10,
          paypal_email: 'vendor@greenatlas.ma',
          paypal_verified: true,
          payment_policy_full: true,
          payment_policy_split: true,
          payment_policy_cod: false,
          notify_new_orders: true,
          notify_order_updates: true,
          notify_customer_messages: true,
          notify_low_stock: true,
          notify_reviews: true,
        },
        error: null,
      })

    mockProfilesService.updateProfile.mockResolvedValue({ error: null })

    mockStoreTypeService.decorateStoreProfile.mockReturnValue({
      storeTypeLabel: 'متجر صغير',
      deliveryOptionMeta: { label: 'التوصيل الذاتي' },
      activeProductsCountLabel: '3 منتجات',
    })

    mockCancellationService.getVendorCancellationPolicy.mockResolvedValue({
      free_cancellation_window_minutes: 120,
      cancellation_fee_type: 'fixed',
      cancellation_fee_value: 0,
      refund_percentage: 100,
      allow_cancellation: true,
      cutoff_status: 'vendor_accepted',
      auto_approve_before_preparing: true,
      policy_text_ar: '',
    })
    mockCancellationService.upsertVendorCancellationPolicy.mockResolvedValue({
      free_cancellation_window_minutes: 90,
      cancellation_fee_type: 'fixed',
      cancellation_fee_value: 0,
      refund_percentage: 100,
      allow_cancellation: true,
      cutoff_status: 'vendor_accepted',
      auto_approve_before_preparing: true,
      policy_text_ar: '',
    })

    mockRefundPolicyService.getVendorRefundPolicy.mockResolvedValue({
      return_window_days: 7,
      policy_text: 'Refund policy text',
      allow_partial_returns: true,
      return_shipping_paid_by: 'buyer',
      non_returnable_categories: [],
    })
    mockRefundPolicyService.upsertVendorRefundPolicy.mockResolvedValue({
      return_window_days: 10,
      policy_text: 'Updated policy',
      allow_partial_returns: true,
      return_shipping_paid_by: 'buyer',
      non_returnable_categories: [],
    })

    mockStoreEmergencyService.pauseStore.mockResolvedValue({ pausedAt: '2026-05-24T10:00:00Z', pausedProductsCount: 4 })
    mockStoreEmergencyService.resumeStore.mockResolvedValue({ resumedAt: '2026-05-24T11:00:00Z', resumedProductsCount: 4 })
  })

  it('loads initial settings from services', async () => {
    renderPage()

    expect(await screen.findByText('إعدادات المتجر')).toBeInTheDocument()

    await waitFor(() => {
      expect(mockProfilesService.fetchVendorProfile).toHaveBeenCalledWith('vendor-1')
      expect(mockCancellationService.getVendorCancellationPolicy).toHaveBeenCalledWith('vendor-1')
      expect(mockRefundPolicyService.getVendorRefundPolicy).toHaveBeenCalledWith('vendor-1')
    })

    expect(screen.getByDisplayValue('Green Atlas')).toBeInTheDocument()
  })

  it('shows validation error and does not save when store name is empty', async () => {
    renderPage()

    await screen.findByText('إعدادات المتجر')

    const storeNameInput = screen.getByLabelText('Store Name')
    fireEvent.change(storeNameInput, { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(mockProfilesService.updateProfile).not.toHaveBeenCalled()
    expect(mockToast.error).toHaveBeenCalled()
  })

  it('saves profile + policy settings and logs audit action', async () => {
    renderPage()

    await screen.findByText('إعدادات المتجر')

    fireEvent.change(screen.getByLabelText('Store Name'), { target: { value: 'Green Atlas Updated' } })
    fireEvent.click(screen.getByText('Change Payment Policies'))
    fireEvent.click(screen.getByText('Change Cancellation Policy'))
    fireEvent.click(screen.getByText('Change Refund Policy'))
    fireEvent.click(screen.getByText('Set Location'))

    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }))

    await waitFor(() => {
      expect(mockProfilesService.updateProfile).toHaveBeenCalledWith(
        'vendor-1',
        expect.objectContaining({
          store_name: 'Green Atlas Updated',
          payment_policy_cod: true,
          latitude: 33.57,
          longitude: -7.59,
          paypal_email: 'vendor@greenatlas.ma',
          payout_method: 'paypal',
        }),
      )
    })

    const updateCall = mockProfilesService.updateProfile.mock.calls[0][1]
    expect(Number.isNaN(updateCall.min_order_amount)).toBe(false)
    expect(Number.isNaN(updateCall.low_stock_threshold)).toBe(false)
    expect(typeof updateCall.min_order_amount).toBe('number')
    expect(typeof updateCall.low_stock_threshold).toBe('number')
    expect(updateCall.min_order_amount).toBeGreaterThanOrEqual(0)
    expect(updateCall.low_stock_threshold).toBeGreaterThanOrEqual(0)

    expect(mockCancellationService.upsertVendorCancellationPolicy).toHaveBeenCalled()
    expect(mockRefundPolicyService.upsertVendorRefundPolicy).toHaveBeenCalled()
    expect(mockAuditLogger.logProfileAction).toHaveBeenCalledWith(
      'SETTINGS_UPDATED',
      expect.objectContaining({ store_name: 'Green Atlas Updated' }),
      expect.any(Object),
    )
    expect(mockToast.success).toHaveBeenCalled()
  })

  it('can pause and resume store emergency mode', async () => {
    renderPage()

    await screen.findByText('إعدادات المتجر')

    fireEvent.change(
      screen.getByPlaceholderText('سبب الإيقاف (مثال: توقف التوريد المؤقت / صيانة مفاجئة)'),
      { target: { value: 'طارئ تشغيلي' } },
    )

    fireEvent.click(screen.getByRole('button', { name: 'تفعيل وضع الطوارئ' }))

    await waitFor(() => {
      expect(mockStoreEmergencyService.pauseStore).toHaveBeenCalledWith({
        vendorId: 'vendor-1',
        reason: 'طارئ تشغيلي',
      })
    })

    expect(mockSetAuthState).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'إلغاء وضع الطوارئ' }))

    await waitFor(() => {
      expect(mockStoreEmergencyService.resumeStore).toHaveBeenCalledWith({ vendorId: 'vendor-1' })
    })
    expect(mockSetAuthState).toHaveBeenCalled()
  })
})
