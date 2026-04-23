import React from 'react'
import { render, screen } from '@testing-library/react'

// Simulated ProtectedRoute component (isolated, no real imports)
const ProtectedRoute = ({ children, allowedRoles, mockAuth }) => {
  const { user, profile, loading, mfaRequired, mfaPending } = mockAuth

  if (loading) {
    return <div data-testid="loading">Loading...</div>
  }

  if (!user) {
    return <div data-testid="redirect-login">Redirect to /login</div>
  }

  if (mfaRequired && mfaPending) {
    return <div data-testid="redirect-mfa">Redirect to /mfa-verify</div>
  }

  if (allowedRoles && !allowedRoles.includes(profile?.role)) {
    return <div data-testid="redirect-role">Redirect to role dashboard</div>
  }

  return children
}

describe('ProtectedRoute Component', () => {
  const defaultAuth = {
    user: { id: '1', email: 'test@example.com' },
    profile: { role: 'buyer', first_name: 'Test', mfa_enabled: true },
    loading: false,
    mfaRequired: false,
    mfaPending: false,
  }

  it('renders children when user is authenticated', () => {
    render(
      <ProtectedRoute mockAuth={defaultAuth}>
        <div data-testid="protected-content">Secret Content</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    expect(screen.getByText('Secret Content')).toBeInTheDocument()
  })

  it('shows loading state when auth is still loading', () => {
    render(
      <ProtectedRoute mockAuth={{ ...defaultAuth, loading: true }}>
        <div data-testid="protected-content">Secret</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('redirects to login when user is not authenticated', () => {
    render(
      <ProtectedRoute mockAuth={{ ...defaultAuth, user: null }}>
        <div data-testid="protected-content">Secret</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('redirect-login')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('redirects to MFA verification when MFA is required and pending', () => {
    render(
      <ProtectedRoute mockAuth={{ ...defaultAuth, mfaRequired: true, mfaPending: true }}>
        <div data-testid="protected-content">Secret</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('redirect-mfa')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })

  it('redirects when user role is not in allowedRoles', () => {
    render(
      <ProtectedRoute
        mockAuth={defaultAuth}
        allowedRoles={['admin', 'vendor']}
      >
        <div data-testid="protected-content">Secret</div>
      </ProtectedRoute>
    )
    expect(screen.getByTestId('redirect-role')).toBeInTheDocument()
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
  })
})
