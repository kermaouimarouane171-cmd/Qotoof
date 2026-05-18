import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  useDeleteAccount,
  useLogin,
  useLogout,
  useRegister,
  useResetPassword,
  useUpdateProfile,
} from '@/hooks/queries/useAuthQueries'
import { useAuthStore } from '@/store/authStore'

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}))

const mockStore = {
  signIn: jest.fn(),
  signOut: jest.fn(),
  signUp: jest.fn(),
  resetPassword: jest.fn(),
  updatePassword: jest.fn(),
  updateProfile: jest.fn(),
  deleteAccount: jest.fn(),
}

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  )
}

describe('useAuthQueries mutations', () => {
  beforeEach(() => {
    Object.values(mockStore).forEach((fn) => fn.mockReset())
    useAuthStore.mockImplementation((selector) => selector(mockStore))
  })

  it('delegates login to authStore.signIn', async () => {
    mockStore.signIn.mockResolvedValue({ success: true, redirect: '/orders/1' })

    const { result } = renderHook(() => useLogin(), { wrapper: createWrapper() })

    result.current.mutate({
      email: 'buyer@example.com',
      password: 'password123',
      captchaToken: 'captcha-token',
      redirectTo: '/orders/1',
    })

    await waitFor(() => expect(mockStore.signIn).toHaveBeenCalledWith(
      'buyer@example.com',
      'password123',
      'captcha-token',
      '/orders/1'
    ))
  })

  it('delegates logout to authStore.signOut', async () => {
    mockStore.signOut.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useLogout(), { wrapper: createWrapper() })

    result.current.mutate()

    await waitFor(() => expect(mockStore.signOut).toHaveBeenCalledTimes(1))
  })

  it('maps register input to authStore.signUp', async () => {
    mockStore.signUp.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useRegister(), { wrapper: createWrapper() })

    result.current.mutate({
      email: 'vendor@example.com',
      password: 'password123',
      fullName: 'Vendor Owner',
      role: 'vendor',
      phone: '+212600000000',
      businessName: 'Atlas Market',
      captchaToken: 'register-captcha',
    })

    await waitFor(() => expect(mockStore.signUp).toHaveBeenCalledWith(
      'vendor@example.com',
      'password123',
      expect.objectContaining({
        firstName: 'Vendor',
        lastName: 'Owner',
        role: 'vendor',
        businessName: 'Atlas Market',
      }),
      'register-captcha'
    ))
  })

  it('delegates password reset and profile updates to the store', async () => {
    mockStore.updatePassword.mockResolvedValue({ success: true })
    mockStore.updateProfile.mockResolvedValue({ success: true })

    const { result: resetResult } = renderHook(() => useResetPassword(), { wrapper: createWrapper() })
    const { result: profileResult } = renderHook(() => useUpdateProfile(), { wrapper: createWrapper() })

    resetResult.current.mutate({ newPassword: 'new-password-123' })
    profileResult.current.mutate({ first_name: 'Updated' })

    await waitFor(() => expect(mockStore.updatePassword).toHaveBeenCalledWith('new-password-123'))
    await waitFor(() => expect(mockStore.updateProfile).toHaveBeenCalledWith({ first_name: 'Updated' }))
  })

  it('delegates account deletion to authStore.deleteAccount', async () => {
    mockStore.deleteAccount.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useDeleteAccount(), { wrapper: createWrapper() })

    result.current.mutate({ confirmationText: 'DELETE' })

    await waitFor(() => expect(mockStore.deleteAccount).toHaveBeenCalledWith('DELETE'))
  })
})