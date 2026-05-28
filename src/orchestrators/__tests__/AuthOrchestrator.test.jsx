import React from 'react'
import { act, render } from '@testing-library/react'
import { useAuthOrchestrator } from '@/orchestrators/AuthOrchestrator'
import { useAuthStore } from '@/store/authStore'

const mockNavigate = jest.fn()
let mockLocation = {
  pathname: '/marketplace',
  search: '?q=olive',
  hash: '#grid',
}

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}))

const Harness = () => {
  useAuthOrchestrator()
  return null
}

describe('useAuthOrchestrator', () => {
  const initialize = jest.fn()
  const setupAuthListener = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocation = {
      pathname: '/marketplace',
      search: '?q=olive',
      hash: '#grid',
    }

    const cleanup = jest.fn()
    setupAuthListener.mockReturnValue(cleanup)
    useAuthStore.getState.mockReturnValue({ initialize, setupAuthListener })
  })

  it('initializes auth exactly once and cleans up auth listener on unmount', () => {
    const { rerender, unmount } = render(<Harness />)

    rerender(<Harness />)

    expect(initialize).toHaveBeenCalledTimes(1)
    expect(setupAuthListener).toHaveBeenCalledTimes(1)

    unmount()

    const cleanupFn = setupAuthListener.mock.results[0].value
    expect(cleanupFn).toHaveBeenCalledTimes(1)
  })

  it('navigates to login with preserved source when auth:sessionExpired is dispatched', () => {
    render(<Harness />)

    act(() => {
      window.dispatchEvent(new CustomEvent('auth:sessionExpired'))
    })

    expect(mockNavigate).toHaveBeenCalledWith('/login?expired=true', {
      replace: true,
      state: { from: '/marketplace?q=olive#grid' },
    })
  })

  it('does not redirect when already on login', () => {
    mockLocation = {
      pathname: '/login',
      search: '',
      hash: '',
    }

    render(<Harness />)

    act(() => {
      window.dispatchEvent(new CustomEvent('auth:sessionExpired'))
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('uses latest route location (stale-closure regression guard)', () => {
    const { rerender } = render(<Harness />)

    mockLocation = {
      pathname: '/buyer/orders',
      search: '?status=active',
      hash: '#section',
    }

    rerender(<Harness />)

    act(() => {
      window.dispatchEvent(new CustomEvent('auth:sessionExpired'))
    })

    expect(mockNavigate).toHaveBeenCalledWith('/login?expired=true', {
      replace: true,
      state: { from: '/buyer/orders?status=active#section' },
    })
  })
})
