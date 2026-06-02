import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = jest.fn()
const mockSignOut = jest.fn()
const mockToast = { success: jest.fn(), error: jest.fn() }

const mockAuthState = {
  user: { id: 'vendor-1', email: 'ahmed@example.ma' },
  profile: {
    id: 'vendor-1',
    role: 'vendor',
    first_name: 'أحمد',
    last_name: 'بنسعيد',
    store_name: 'منتجات الأطلس',
    phone: '0612345678',
    email: 'ahmed@example.ma',
    agreement_accepted: false,
  },
  signOut: (...args) => mockSignOut(...args),
}

let supabaseContractQueryResult = { data: [], error: null }

const mockSupabaseFrom = jest.fn(() => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(supabaseContractQueryResult),
  insert: jest.fn().mockResolvedValue({ error: null }),
  update: jest.fn().mockReturnThis(),
}))

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

jest.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(jest.fn(() => mockAuthState), {
    setState: jest.fn(),
  }),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: (...args) => mockSupabaseFrom(...args),
  },
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToast.success(...args),
    error: (...args) => mockToast.error(...args),
  },
}))

jest.mock('@/constants/banks', () => ({
  MOROCCAN_BANKS: [{ code: 'bmce', name: 'البنك المغربي للتجارة الخارجية' }],
}))

jest.mock('@heroicons/react/24/outline', () => new Proxy({}, {
  get: () => () => null,
}))

jest.mock('@/components/ui', () => ({
  Card: ({ children, className = '', ...props }) => <div className={className} {...props}>{children}</div>,
  Input: ({ label, value, onChange, type = 'text', className = '', ...props }) => (
    <div className={className}>
      {label ? <label>{label}<input aria-label={label} type={type} value={value} onChange={onChange} {...props} /></label> : (
        <input value={value} onChange={onChange} type={type} {...props} />
      )}
    </div>
  ),
  StateSkeleton: Object.assign(
    ({ className = '' }) => <div className={className} data-testid="skeleton-block" />,
    { Card: ({ className = '' }) => <div className={className} /> },
  ),
  ErrorState: ({ title, description, onRetry, retryLabel = 'إعادة المحاولة' }) => (
    <div>
      <h3>{title}</h3>
      <p>{description}</p>
      {onRetry ? <button type="button" onClick={onRetry}>{retryLabel}</button> : null}
    </div>
  ),
}))

const DigitalContractPage = require('@/pages/vendor/DigitalContract').default

const renderPage = () => render(
  <MemoryRouter initialEntries={['/vendor/digital-contract']}>
    <DigitalContractPage />
  </MemoryRouter>
)

const fillRequiredFields = async () => {
  fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: 'أحمد بنسعيد' } })
  fireEvent.change(screen.getByLabelText('البريد الإلكتروني'), { target: { value: 'ahmed@example.ma' } })
  fireEvent.change(screen.getByLabelText('رقم الهاتف'), { target: { value: '0612345678' } })
  fireEvent.change(screen.getByLabelText('بريد PayPal'), { target: { value: 'ahmed.paypal@example.ma' } })

  fireEvent.click(screen.getByTestId('toggle-full-contract'))

  await waitFor(() => {
    expect(screen.getByTestId('full-contract-panel')).toBeInTheDocument()
  })

  fireEvent.change(screen.getByLabelText('رقم بطاقة التعريف الوطنية'), { target: { value: 'AB123456' } })
  fireEvent.change(screen.getByLabelText('اسم البنك'), { target: { value: 'البنك المغربي للتجارة الخارجية' } })
  fireEvent.change(screen.getByLabelText('رقم IBAN'), { target: { value: 'MA123456789012345678901234' } })
  fireEvent.change(screen.getByLabelText('اسم صاحب الحساب'), { target: { value: 'أحمد بنسعيد' } })

  fireEvent.click(screen.getByLabelText(/أقر بأن المعلومات/))
  fireEvent.click(screen.getByLabelText(/شروط وأحكام المنصة/))
  fireEvent.click(screen.getByLabelText(/استخدام بريد PayPal/))
}

describe('صفحة العقد الرقمي /vendor/digital-contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    supabaseContractQueryResult = { data: [], error: null }
    mockAuthState.profile = {
      id: 'vendor-1',
      role: 'vendor',
      first_name: 'أحمد',
      last_name: 'بنسعيد',
      store_name: 'منتجات الأطلس',
      phone: '0612345678',
      email: 'ahmed@example.ma',
      agreement_accepted: false,
    }
    mockAuthState.user = { id: 'vendor-1', email: 'ahmed@example.ma' }

    mockSupabaseFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(supabaseContractQueryResult),
      insert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }))
  })

  it('يعرض حالة التحميل بدون crash', async () => {
    mockSupabaseFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn(() => new Promise((resolve) => {
        setTimeout(() => resolve({ data: [], error: null }), 80)
      })),
    }))

    renderPage()
    expect(screen.getByTestId('digital-contract-loading')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId('digital-contract-page')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('يعرض حالة الخطأ مع إعادة المحاولة', async () => {
    mockSupabaseFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'فشل الاتصال' } }),
    }))

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('تعذر تحميل العقد')).toBeInTheDocument()
    })

    mockSupabaseFrom.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    }))

    fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }))

    await waitFor(() => {
      expect(screen.getByTestId('digital-contract-title')).toHaveTextContent('العقد الرقمي')
    })
  })

  it('يعرض العنوان العربي والأزرار الرئيسية', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('digital-contract-title')).toHaveTextContent('العقد الرقمي')
    })

    expect(screen.getByTestId('sign-contract-button')).toHaveTextContent('توقيع العقد')
    expect(screen.getByTestId('cancel-contract-button')).toHaveTextContent('إلغاء')
    expect(screen.getByText('يجب توقيع العقد الرقمي قبل تفعيل متجرك')).toBeInTheDocument()
    expect(screen.getByText('منتجات الأطلس')).toBeInTheDocument()
  })

  it('لا يعرض رموز $ أو USD', async () => {
    const { container } = renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('digital-contract-page')).toBeInTheDocument()
    })

    expect(container.textContent).not.toMatch(/\$|USD/)
  })

  it('يحتوي على pb-20 وعدم overflow أفقي على 360px', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 360 })

    const { container } = renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('digital-contract-page')).toBeInTheDocument()
    })

    const page = screen.getByTestId('digital-contract-page')
    expect(page).toHaveClass('pb-20')
    expect(page).toHaveClass('overflow-x-hidden')
    expect(page).toHaveClass('min-w-0')

    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth + 1)
  })

  it('يطلب تأكيداً قبل التوقيع', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)

    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('sign-contract-button')).toBeInTheDocument()
    })

    await fillRequiredFields()

    fireEvent.click(screen.getByTestId('sign-contract-button'))

    expect(confirmSpy).toHaveBeenCalledWith('هل أنت متأكد من توقيع العقد الرقمي؟ لا يمكن التراجع بعد التوقيع.')

    confirmSpy.mockRestore()
  })

  it('يعرض لوحة العقد الكامل عند النقر', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('toggle-full-contract')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('toggle-full-contract'))

    await waitFor(() => {
      expect(screen.getByTestId('full-contract-panel')).toBeInTheDocument()
    })

    expect(screen.getByText(/عمولة التطبيق/)).toBeInTheDocument()
  })
})
