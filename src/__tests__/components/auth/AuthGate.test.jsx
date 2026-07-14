import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthGate from '@/components/auth/AuthGate'

jest.mock('@/components/ui', () => ({
  Card: ({ children, className, ...props }) => (
    <div className={className} {...props}>{children}</div>
  ),
}))

jest.mock('leaflet', () => ({
  __esModule: true,
  default: {
    icon: jest.fn(() => ({})),
  },
}))

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('AuthGate', () => {
  it('renders card variant by default with sign-in link', () => {
    renderWithRouter(<AuthGate from="/test" />)
    expect(screen.getByText('Sign in required')).toBeInTheDocument()
    expect(screen.getByText('You need to be signed in to continue.')).toBeInTheDocument()
    expect(screen.getByText('Sign In')).toHaveAttribute('href', '/login')
  })

  it('renders fullscreen variant with sign-in and register links', () => {
    renderWithRouter(
      <AuthGate variant="fullscreen" title="Track Your Orders" message="Sign in to track" from="/tracking" showRegister />
    )
    expect(screen.getByText('Track Your Orders')).toBeInTheDocument()
    expect(screen.getByText('Sign In')).toHaveAttribute('href', '/login')
    expect(screen.getByText('Create Account')).toHaveAttribute('href', '/register')
  })

  it('renders modal variant with cancel button when onCancel is provided', () => {
    const onCancel = jest.fn()
    renderWithRouter(<AuthGate variant="modal" from="/cart" onCancel={onCancel} showRegister />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })
})
