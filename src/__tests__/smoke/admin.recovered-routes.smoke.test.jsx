import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, AdminLayout } from '@/components/ProtectedRoute'
import { USER_ROLES } from '@/constants/roles'

jest.mock('@/components/Navbar', () => () => null)
jest.mock('@/components/notifications/NotificationLink', () => () => null)
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }))

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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback, vars) => {
      if (typeof fallback === 'string' && vars) {
        return fallback.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
      }
      return typeof fallback === 'string' ? fallback : _key
    },
  }),
}))

jest.mock('@/store/authStore', () => ({ useAuthStore: jest.fn() }))
jest.mock('@/orchestrators/OnboardingOrchestrator', () => ({ useOnboardingGate: jest.fn() }))
jest.mock('@/contexts/PaymentGuard', () => ({ usePaymentGuard: jest.fn() }))
// Required by ProtectedRoute's MainLayout imports
jest.mock('@/modules/cart', () => ({ useCartStore: jest.fn(() => ({ items: [] })) }))
jest.mock('@/store/languageStore', () => ({ useLanguageStore: jest.fn(() => ({ language: 'ar', setLanguage: jest.fn() })) }))
jest.mock('@/hooks/useDarkMode', () => ({ useDarkMode: jest.fn(() => ({ isDark: false, toggle: jest.fn() })) }))
jest.mock('@/hooks/useMobileKeyboardGuard', () => ({ useMobileKeyboardGuard: jest.fn() }))

jest.mock('@/services/fraudReportService', () => ({
  __esModule: true,
  default: {
    listFraudReportsForAdmin: jest.fn().mockResolvedValue([]),
    getFraudEvidenceLinks: jest.fn().mockResolvedValue([]),
    updateFraudReport: jest.fn(),
    createFraudReport: jest.fn(),
    getFraudReportById: jest.fn(),
    submitFraudReport: jest.fn(),
  },
  FRAUD_REPORT_TYPES: [
    { value: 'missing_items', label: 'نقص في الحمولة' },
    { value: 'wrong_condition', label: 'حالة المنتج' },
    { value: 'fake_delivery', label: 'تسليم صوري' },
    { value: 'payment_fraud', label: 'احتيال مالي' },
    { value: 'identity_fraud', label: 'انتحال هوية' },
    { value: 'other', label: 'حالة أخرى' },
  ],
  FRAUD_STATUS_OPTIONS: [
    { value: 'pending', label: 'قيد الانتظار' },
    { value: 'reviewing', label: 'قيد المراجعة' },
    { value: 'action_required', label: 'يتطلب إجراء' },
    { value: 'resolved', label: 'تمت المعالجة' },
    { value: 'dismissed', label: 'تم الحفظ' },
  ],
  FRAUD_PRIORITY_OPTIONS: [
    { value: 'medium', label: 'متوسط' },
    { value: 'high', label: 'مرتفع' },
    { value: 'urgent', label: 'عاجل' },
  ],
}))

jest.mock('@/services/disputeService', () => ({
  __esModule: true,
  default: {
    getDisputes: jest.fn().mockResolvedValue([]),
    getDisputeById: jest.fn(),
    resolveInVendorFavor: jest.fn(),
    resolveInBuyerFavor: jest.fn(),
    createDispute: jest.fn(),
    openDispute: jest.fn(),
    releaseBuyerDataToVendor: jest.fn(),
    applyDisputePenalty: jest.fn(),
    uploadEvidenceFiles: jest.fn(),
  },
}))

jest.mock('@/services/fraudAwarenessService', () => ({
  __esModule: true,
  default: {
    notifyFraudReportCreated: jest.fn().mockResolvedValue(),
    notifyFraudReportUpdated: jest.fn().mockResolvedValue(),
  },
}))

jest.mock('@/services/trustScoreService', () => ({
  __esModule: true,
  default: {
    registerFailedPayment: jest.fn().mockResolvedValue(),
    updateTrustScore: jest.fn().mockResolvedValue(),
    syncCodEligibility: jest.fn().mockResolvedValue(),
  },
}))

jest.mock('@/services/notifications', () => ({
  notificationsApi: { create: jest.fn().mockResolvedValue() },
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({ data: null, error: null })),
          order: jest.fn(() => ({ data: [], error: null })),
        })),
        order: jest.fn(() => ({ data: [], error: null })),
      })),
      insert: jest.fn(() => ({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({ data: null, error: null })),
      })),
    })),
    storage: {
      from: jest.fn(() => ({
        createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: '' }, error: null }),
        upload: jest.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}))

const { useAuthStore } = require('@/store/authStore')
const { useOnboardingGate } = require('@/orchestrators/OnboardingOrchestrator')
const { usePaymentGuard } = require('@/contexts/PaymentGuard')

const adminAuth = {
  user: { id: 'admin-1', email: 'admin@greenmarket.test' },
  profile: { id: 'profile-admin', role: 'admin', onboarding_completed: true },
  loading: false,
  profileLoading: false,
  profileError: false,
  mfaRequired: false,
  mfaPending: false,
  signOut: jest.fn(),
}

const nonAdminAuth = {
  ...adminAuth,
  user: { id: 'buyer-1', email: 'buyer@greenmarket.test' },
  profile: { id: 'profile-buyer', role: 'buyer', onboarding_completed: true },
}

const unauthState = {
  ...adminAuth,
  user: null,
  profile: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(adminAuth) : adminAuth)
  useOnboardingGate.mockReturnValue({ isBlocking: false })
  usePaymentGuard.mockReturnValue({ shouldRedirect: false, redirectTo: null, message: null })
})

const renderAdminRoute = (path, pageElement) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute
              Layout={AdminLayout}
              requiredRole={USER_ROLES.ADMIN}
              allowedRoles={[USER_ROLES.ADMIN]}
            />
          }
        >
          <Route path="fraud-reports" element={pageElement} />
          <Route path="disputes" element={pageElement} />
          <Route path="dashboard" element={pageElement} />
        </Route>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const FraudReports = require('@/pages/admin/FraudReports').default
const DisputeManagement = require('@/pages/admin/DisputeManagement').default

describe('Admin Recovered Routes Smoke Tests', () => {
  test('admin fraud-reports route renders without crash', async () => {
    renderAdminRoute('/admin/fraud-reports', <FraudReports />)
    await waitFor(() => {
      expect(screen.getByText('بلاغات الاحتيال')).toBeInTheDocument()
    })
  })

  test('admin disputes route renders without crash', async () => {
    renderAdminRoute('/admin/disputes', <DisputeManagement />)
    await waitFor(() => {
      expect(screen.getByText('إدارة نزاعات الدفع')).toBeInTheDocument()
    })
  })

  test('non-admin role is blocked from fraud-reports route', async () => {
    useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(nonAdminAuth) : nonAdminAuth)
    renderAdminRoute('/admin/fraud-reports', <FraudReports />)
    await waitFor(() => {
      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument()
    })
  })

  test('non-admin role is blocked from disputes route', async () => {
    useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(nonAdminAuth) : nonAdminAuth)
    renderAdminRoute('/admin/disputes', <DisputeManagement />)
    await waitFor(() => {
      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument()
    })
  })

  test('unauthenticated user is redirected from fraud-reports to /login', async () => {
    useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(unauthState) : unauthState)
    renderAdminRoute('/admin/fraud-reports', <FraudReports />)
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  test('unauthenticated user is redirected from disputes to /login', async () => {
    useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(unauthState) : unauthState)
    renderAdminRoute('/admin/disputes', <DisputeManagement />)
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  test('admin sidebar contains fraud reports and disputes navigation links', async () => {
    const MockPage = () => <div data-testid="admin-page">Content</div>
    renderAdminRoute('/admin/dashboard', <MockPage />)
    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Fraud Reports').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Payment Disputes').length).toBeGreaterThan(0)
  })

  test('fraud-reports empty state does not crash (no data from service)', async () => {
    renderAdminRoute('/admin/fraud-reports', <FraudReports />)
    await waitFor(() => {
      expect(screen.getByText('بلاغات الاحتيال')).toBeInTheDocument()
    })
  })

  test('disputes empty state does not crash (no data from service)', async () => {
    renderAdminRoute('/admin/disputes', <DisputeManagement />)
    await waitFor(() => {
      expect(screen.getByText('إدارة نزاعات الدفع')).toBeInTheDocument()
    })
  })
})
