import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render } from '@testing-library/react'

const defaultAuthState = {
  user: { id: 'test-user-1', email: 'test@example.com' },
  profile: { id: 'profile-1', role: 'buyer', onboarding_completed: true },
  loading: false,
  profileLoading: false,
  profileError: false,
  mfaRequired: false,
  mfaPending: false,
}

export const roleAuthState = {
  admin: {
    ...defaultAuthState,
    user: { id: 'admin-1', email: 'admin@greenmarket.test' },
    profile: { id: 'profile-admin', role: 'admin', onboarding_completed: true },
  },
  vendor: {
    ...defaultAuthState,
    user: { id: 'vendor-1', email: 'vendor@greenmarket.test' },
    profile: { id: 'profile-vendor', role: 'vendor', onboarding_completed: true, agreement_accepted: true },
  },
  buyer: {
    ...defaultAuthState,
    user: { id: 'buyer-1', email: 'buyer@greenmarket.test' },
    profile: { id: 'profile-buyer', role: 'buyer', onboarding_completed: true },
  },
  driver: {
    ...defaultAuthState,
    user: { id: 'driver-1', email: 'driver@greenmarket.test' },
    profile: { id: 'profile-driver', role: 'driver', onboarding_completed: true },
  },
  unauthenticated: {
    ...defaultAuthState,
    user: null,
    profile: null,
  },
}

export function setupAuthMock(authState) {
  const { useAuthStore } = require('@/store/authStore')
  useAuthStore.mockReturnValue(authState)
}

export function setupOnboardingMock(blocking = false) {
  const { useOnboardingGate } = require('@/orchestrators/OnboardingOrchestrator')
  useOnboardingGate.mockReturnValue({ isBlocking: blocking })
}

export function setupPaymentGuardMock() {
  const { usePaymentGuard } = require('@/contexts/PaymentGuard')
  usePaymentGuard.mockReturnValue({
    shouldRedirect: false,
    redirectTo: null,
    message: null,
  })
}

export function renderWithRouter(initialEntry, routes) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>{routes}</Routes>
    </MemoryRouter>,
  )
}

export { defaultAuthState }
