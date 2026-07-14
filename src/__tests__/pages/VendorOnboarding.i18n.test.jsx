/**
 * Regression test: Vendor onboarding i18n
 *
 * Ensures VendorOnboarding.jsx uses t() for all user-facing strings
 * instead of hardcoded Arabic.
 *
 * Covers V-007 (VendorOnboarding slide content).
 */

import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// ─── Mock state ──────────────────────────────────────────────────────────────

const mockAuthState = {
  user: { id: 'v1' },
  profile: { id: 'v1', role: 'vendor', onboarding_completed: false, onboarding_step: 0 },
  loading: false,
}

const mockTranslations = {
  ar: {
    'onboarding.vendor.roleLabel': 'تهيئة البائع',
    'onboarding.vendor.completeLabel': 'وقّع العقد وابدأ →',
    'onboarding.vendor.slides.s1.title': 'ابدأ البيع في 4 خطوات',
    'onboarding.vendor.slides.s2.title': 'أكمل ملفك التجاري',
    'onboarding.vendor.slides.s3.title': 'كيف تعمل العمولة؟',
    'onboarding.vendor.slides.s4.title': 'أنت جاهز للبدء!',
    'onboarding.saving': 'جارٍ الحفظ...',
    'onboarding.nextArrow': 'التالي →',
    'onboarding.previousArrow': '← السابق',
  },
  en: {
    'onboarding.vendor.roleLabel': 'Vendor Setup',
    'onboarding.vendor.completeLabel': 'Sign Contract & Start →',
    'onboarding.vendor.slides.s1.title': 'Start Selling in 4 Steps',
    'onboarding.vendor.slides.s2.title': 'Complete Your Store Profile',
    'onboarding.vendor.slides.s3.title': 'How Does Commission Work?',
    'onboarding.vendor.slides.s4.title': "You're Ready to Start!",
    'onboarding.saving': 'Saving...',
    'onboarding.nextArrow': 'Next →',
    'onboarding.previousArrow': '← Previous',
  },
}

let mockCurrentLang = 'ar'

const mockT = jest.fn((key, fallback, options) => {
  if (options && options.returnObjects) return undefined
  return mockTranslations[mockCurrentLang][key] || fallback || key
})

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
    i18n: { language: mockCurrentLang, dir: () => mockCurrentLang === 'ar' ? 'rtl' : 'ltr' },
  }),
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector) => {
    if (typeof selector === 'function') return selector(mockAuthState)
    return mockAuthState
  },
  setState: jest.fn(),
}))

jest.mock('@/services/onboardingService', () => ({
  completeOnboarding: jest.fn().mockResolvedValue(true),
  getOnboardingPathForRole: jest.fn().mockReturnValue('/vendor/dashboard'),
  updateOnboardingStep: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/components/ui', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}))

// ─── Import after mocks ──────────────────────────────────────────────────────

import VendorOnboarding from '@/pages/onboarding/VendorOnboarding'

// ─── Helpers ─────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup()
  mockT.mockClear()
})

const renderOnboarding = () =>
  render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<VendorOnboarding />} />
        <Route path="/vendor/digital-contract" element={<div data-testid="digital-contract">Contract</div>} />
        <Route path="/login" element={<div data-testid="login">Login</div>} />
      </Routes>
    </MemoryRouter>
  )

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('VendorOnboarding i18n', () => {
  it('renders with localized Arabic role label', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(screen.getByText('تهيئة البائع')).toBeInTheDocument()
  })

  it('renders with English role label when lang is en', () => {
    mockCurrentLang = 'en'
    renderOnboarding()
    expect(screen.getByText('Vendor Setup')).toBeInTheDocument()
  })

  it('calls t() for slide titles', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(mockT).toHaveBeenCalledWith('onboarding.vendor.slides.s1.title', expect.any(String))
  })

  it('renders the first slide title', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(screen.getByText('ابدأ البيع في 4 خطوات')).toBeInTheDocument()
  })

  it('renders the first slide lines as text', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(screen.getByText('وصل لآلاف المشترين في المغرب')).toBeInTheDocument()
  })

  it('calls t() for roleLabel and completeLabel', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(mockT).toHaveBeenCalledWith('onboarding.vendor.roleLabel', expect.any(String))
    expect(mockT).toHaveBeenCalledWith('onboarding.vendor.completeLabel', expect.any(String))
  })

  it('shows onboarding test id with role=vendor', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(screen.getByTestId('onboarding-vendor')).toBeInTheDocument()
  })

  it('renders localized "Next" button text', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(screen.getByText('التالي →')).toBeInTheDocument()
  })

  it('renders localized "Next" button text in English', () => {
    mockCurrentLang = 'en'
    renderOnboarding()
    expect(screen.getByText('Next →')).toBeInTheDocument()
  })
})
