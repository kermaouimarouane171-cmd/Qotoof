import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import useRequireAuth from '@/hooks/useRequireAuth'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}))

const { useNavigate } = jest.requireMock('react-router-dom')

const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>

describe('useRequireAuth', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, profile: null, session: null, loading: false })
    useNavigate.mockReset()
  })

  it('returns isAuthenticated false when user is null', () => {
    const { result } = renderHook(() => useRequireAuth(), { wrapper })
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('returns isAuthenticated true when user exists', () => {
    useAuthStore.setState({ user: { id: 'u-1' } })
    const { result } = renderHook(() => useRequireAuth(), { wrapper })
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('navigates to login when requireAuth is called while unauthenticated', () => {
    const navigate = jest.fn()
    useNavigate.mockReturnValue(navigate)

    const { result } = renderHook(() => useRequireAuth(), { wrapper })

    act(() => {
      result.current.requireAuth({ from: '/protected' })
    })

    expect(navigate).toHaveBeenCalledWith('/login', { state: { from: '/protected' } })
  })

  it('does not navigate when preventNavigation is true', () => {
    const navigate = jest.fn()
    useNavigate.mockReturnValue(navigate)

    const { result } = renderHook(() => useRequireAuth(), { wrapper })

    act(() => {
      result.current.requireAuth({ preventNavigation: true })
    })

    expect(navigate).not.toHaveBeenCalled()
  })

  it('calls onUnauthorized callback when unauthenticated', () => {
    const navigate = jest.fn()
    const onUnauthorized = jest.fn()
    useNavigate.mockReturnValue(navigate)

    const { result } = renderHook(() => useRequireAuth(), { wrapper })

    act(() => {
      result.current.requireAuth({ onUnauthorized })
    })

    expect(onUnauthorized).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/login', expect.any(Object))
  })
})
