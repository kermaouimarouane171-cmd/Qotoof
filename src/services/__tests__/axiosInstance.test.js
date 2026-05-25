jest.mock('axios', () => {
  const axiosMock = {
    create: jest.fn(),
    post: jest.fn(),
  }

  return {
    __esModule: true,
    default: axiosMock,
  }
})

const createStorageMock = () => {
  let store = {}

  return {
    getItem: jest.fn((key) => (key in store ? store[key] : null)),
    setItem: jest.fn((key, value) => {
      store[key] = String(value)
    }),
    removeItem: jest.fn((key) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
}

describe('axiosInstance interceptors', () => {
  let axios
  let localStorageMock
  let sessionStorageMock
  let requestSuccessHandler
  let requestErrorHandler
  let responseSuccessHandler
  let responseErrorHandler
  let axiosInstanceMock

  const loadAxiosInstanceModule = () => {
    jest.resetModules()

    // eslint-disable-next-line global-require
    axios = require('axios').default

    axiosInstanceMock = jest.fn()
    axiosInstanceMock.interceptors = {
      request: {
        use: jest.fn((onSuccess, onError) => {
          requestSuccessHandler = onSuccess
          requestErrorHandler = onError
          return 0
        }),
      },
      response: {
        use: jest.fn((onSuccess, onError) => {
          responseSuccessHandler = onSuccess
          responseErrorHandler = onError
          return 0
        }),
      },
    }

    axios.create.mockReturnValue(axiosInstanceMock)

    // استيراد الملف بعد ضبط الـ mocks حتى يلتقط الـ interceptors الصحيحة
    // eslint-disable-next-line global-require
    return require('../axiosInstance')
  }

  beforeEach(() => {
    jest.clearAllMocks()

    localStorageMock = createStorageMock()
    sessionStorageMock = createStorageMock()

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
      writable: true,
    })

    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageMock,
      configurable: true,
      writable: true,
    })

    loadAxiosInstanceModule()
  })

  describe('Request Interceptor', () => {
    it('should add Authorization: Bearer <token> header when token exists in localStorage', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'accessToken') return 'token-123'
        return null
      })

      const config = { headers: {} }
      const result = requestSuccessHandler(config)

      expect(result.headers.Authorization).toBe('Bearer token-123')
      expect(result.headers['X-Requested-With']).toBe('XMLHttpRequest')
      expect(localStorageMock.getItem).toHaveBeenCalledWith('accessToken')
    })

    it('should NOT add Authorization header when no token exists', () => {
      localStorageMock.getItem.mockReturnValue(null)
      sessionStorageMock.getItem.mockReturnValue(null)

      const config = { headers: {} }
      const result = requestSuccessHandler(config)

      expect(result.headers.Authorization).toBeUndefined()
      expect(result.headers['X-Requested-With']).toBe('XMLHttpRequest')
    })

    it('should handle malformed tokens gracefully', () => {
      // توكن غير متوقع، المهم أن المنطق لا يرمي استثناء
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'accessToken') return '{malformed-token'
        return null
      })

      const config = { headers: {} }

      expect(() => requestSuccessHandler(config)).not.toThrow()
      expect(config.headers.Authorization).toBe('Bearer {malformed-token')
      expect(config.headers['X-Requested-With']).toBe('XMLHttpRequest')
    })

    it('should reject request errors through request error interceptor', async () => {
      const requestError = new Error('request failed')

      await expect(requestErrorHandler(requestError)).rejects.toThrow('request failed')
    })
  })

  describe('Response Interceptor - Token Refresh', () => {
    it('should automatically call refresh endpoint when 401 is received', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'refreshToken') return 'refresh-123'
        return null
      })

      axios.post.mockResolvedValue({
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      })

      axiosInstanceMock.mockResolvedValue({ retried: true })

      const originalRequest = { headers: {}, url: '/orders' }
      const error401 = { response: { status: 401 }, config: originalRequest }

      await responseErrorHandler(error401)

      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(axios.post.mock.calls[0][0]).toContain('/auth/refresh-token')
      expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        { refreshToken: 'refresh-123' }
      )
    })

    it('should retry the original request after successful token refresh', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'refreshToken') return 'refresh-abc'
        return null
      })

      axios.post.mockResolvedValue({
        data: {
          accessToken: 'fresh-token',
          refreshToken: 'fresh-refresh-token',
        },
      })

      axiosInstanceMock.mockResolvedValue({ ok: true })

      const originalRequest = { headers: {}, method: 'get', url: '/profile' }
      const error401 = { response: { status: 401 }, config: originalRequest }

      const result = await responseErrorHandler(error401)

      expect(axiosInstanceMock).toHaveBeenCalledWith(originalRequest)
      expect(originalRequest.headers.Authorization).toBe('Bearer fresh-token')
      expect(result).toEqual({ ok: true })
    })

    it('should set _retry = true to prevent infinite retry loops', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'refreshToken') return 'refresh-xyz'
        return null
      })

      axios.post.mockResolvedValue({
        data: {
          accessToken: 'next-token',
          refreshToken: 'next-refresh-token',
        },
      })

      axiosInstanceMock.mockResolvedValue({ done: true })

      const originalRequest = { headers: {}, url: '/secure-endpoint' }
      const error401 = { response: { status: 401 }, config: originalRequest }

      await responseErrorHandler(error401)

      expect(originalRequest._retry).toBe(true)
    })

    it('should redirect to /login when token refresh fails', async () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'refreshToken') return 'bad-refresh-token'
        return null
      })

      const locationProto = Object.getPrototypeOf(window.location)
      const originalHrefDescriptor = Object.getOwnPropertyDescriptor(locationProto, 'href')
      const hrefSetter = jest.fn()

      if (originalHrefDescriptor?.configurable) {
        Object.defineProperty(locationProto, 'href', {
          configurable: true,
          get: () => 'http://localhost/',
          set: hrefSetter,
        })
      }

      const refreshError = new Error('Refresh failed')
      axios.post.mockRejectedValue(refreshError)

      const originalRequest = { headers: {}, url: '/secure' }
      const error401 = { response: { status: 401 }, config: originalRequest }

      await expect(responseErrorHandler(error401)).rejects.toThrow('Refresh failed')

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('accessToken')
      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('refreshToken')

      if (originalHrefDescriptor?.configurable) {
        expect(hrefSetter).toHaveBeenCalledWith('/login')
        Object.defineProperty(locationProto, 'href', originalHrefDescriptor)
      }
    })

    it('should NOT retry if _retry is already true', async () => {
      const originalRequest = { headers: {}, url: '/secure', _retry: true }
      const error401 = {
        response: {
          status: 401,
          data: { message: 'Unauthorized again' },
        },
        config: originalRequest,
      }

      await expect(responseErrorHandler(error401)).rejects.toEqual({
        status: 401,
        message: 'Unauthorized again',
        data: { message: 'Unauthorized again' },
      })

      expect(axios.post).not.toHaveBeenCalled()
      expect(axiosInstanceMock).not.toHaveBeenCalled()
    })

    it('should pass through response success handler data correctly', () => {
      const response = { data: { id: 1, ok: true } }

      expect(responseSuccessHandler(response)).toEqual({ id: 1, ok: true })
    })
  })

  describe('Network error handling', () => {
    it('should propagate network errors properly', async () => {
      const networkError = {
        request: {},
        message: 'Network Error',
        config: { url: '/products' },
      }

      await expect(responseErrorHandler(networkError)).rejects.toEqual({
        status: 0,
        message: 'No response from server',
        data: null,
      })
    })

    it('should handle timeout errors', async () => {
      const timeoutError = {
        message: 'timeout of 10000ms exceeded',
      }

      await expect(responseErrorHandler(timeoutError)).rejects.toEqual({
        status: 0,
        message: 'timeout of 10000ms exceeded',
        data: null,
      })
    })
  })
})
