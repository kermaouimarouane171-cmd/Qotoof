/**
 * Regression test: Buyer onboarding i18n
 *
 * Ensures BuyerOnboarding.jsx and OnboardingFlow.jsx use t() for all
 * user-facing strings instead of hardcoded Arabic/English.
 *
 * Covers B-003 (BuyerOnboarding slide content) and B-004 (OnboardingFlow
 * shared button labels and error messages).
 */

import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// ─── Mock state (must use mock* prefix for jest.mock factory access) ─────────

const mockAuthState = {
  user: { id: 'u1' },
  profile: { id: 'u1', role: 'buyer', onboarding_completed: false, onboarding_step: 0 },
  loading: false,
}

const mockTranslations = {
  ar: {
    'onboarding.buyer.roleLabel': 'تهيئة المشتري',
    'onboarding.buyer.completeLabel': 'ابدأ التسوق الآن 🚀',
    'onboarding.buyer.slides.s1.title': 'مرحباً في Qotoof',
    'onboarding.buyer.slides.s2.title': 'ابحث واختر وادفع',
    'onboarding.buyer.slides.s3.title': 'حماية كاملة لك',
    'onboarding.saving': 'جارٍ الحفظ...',
    'onboarding.nextArrow': 'التالي →',
    'onboarding.previousArrow': '← السابق',
    'onboarding.errors.saveFailed': 'تعذر حفظ تقدم التهيئة الآن',
    'onboarding.errors.completeFailed': 'تعذر إكمال التهيئة حالياً',
  },
  en: {
    'onboarding.buyer.roleLabel': 'Buyer Setup',
    'onboarding.buyer.completeLabel': 'Start Shopping Now 🚀',
    'onboarding.buyer.slides.s1.title': 'Welcome to Qotoof',
    'onboarding.buyer.slides.s2.title': 'Search, Choose & Pay',
    'onboarding.buyer.slides.s3.title': 'Full Protection for You',
    'onboarding.saving': 'Saving...',
    'onboarding.nextArrow': 'Next →',
    'onboarding.previousArrow': '← Previous',
    'onboarding.errors.saveFailed': 'Could not save onboarding progress right now',
    'onboarding.errors.completeFailed': 'Could not complete onboarding right now',
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
  getOnboardingPathForRole: jest.fn().mockReturnValue('/marketplace'),
  updateOnboardingStep: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/components/ui', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}))

// ─── Import after mocks ──────────────────────────────────────────────────────

import BuyerOnboarding from '@/pages/onboarding/BuyerOnboarding'

// ─── Helpers ─────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup()
  mockT.mockClear()
})

const renderOnboarding = () =>
  render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<BuyerOnboarding />} />
        <Route path="/marketplace" element={<div data-testid="marketplace">Marketplace</div>} />
        <Route path="/login" element={<div data-testid="login">Login</div>} />
      </Routes>
    </MemoryRouter>
  )

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BuyerOnboarding i18n', () => {
  it('renders with localized Arabic role label', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(screen.getByText('تهيئة المشتري')).toBeInTheDocument()
  })

  it('renders with English role label when lang is en', () => {
    mockCurrentLang = 'en'
    renderOnboarding()
    expect(screen.getByText('Buyer Setup')).toBeInTheDocument()
  })

  it('calls t() for slide titles (not hardcoded)', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(mockT).toHaveBeenCalledWith('onboarding.buyer.slides.s1.title', expect.any(String))
  })

  it('renders the first slide title', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(screen.getByText('مرحباً في Qotoof')).toBeInTheDocument()
  })

  it('renders the first slide lines as text', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(screen.getByText('سوق الجملة المغربي الأول')).toBeInTheDocument()
  })

  it('calls t() for roleLabel and completeLabel', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(mockT).toHaveBeenCalledWith('onboarding.buyer.roleLabel', expect.any(String))
    expect(mockT).toHaveBeenCalledWith('onboarding.buyer.completeLabel', expect.any(String))
  })

  it('shows onboarding test id with role=buyer', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(screen.getByTestId('onboarding-buyer')).toBeInTheDocument()
  })
})

describe('OnboardingFlow shared button i18n', () => {
  it('renders localized "Next" button text in Arabic', () => {
    mockCurrentLang = 'ar'
    renderOnboarding()
    expect(screen.getByText('التالي →')).toBeInTheDocument()
  })

  it('renders localized "Next" button text in English', () => {
    mockCurrentLang = 'en'
    renderOnboarding()
    expect(screen.getByText('Next →')).toBeInTheDocument()
  })

  it('renders localized "Previous" button on step > 0', () => {
    mockCurrentLang = 'ar'
    mockAuthState.profile.onboarding_step = 1
    renderOnboarding()
    expect(screen.getByText('← السابق')).toBeInTheDocument()
    mockAuthState.profile.onboarding_step = 0
  })
})
