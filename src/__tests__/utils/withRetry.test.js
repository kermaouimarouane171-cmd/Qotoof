import { withRetry } from '../../utils/withRetry'

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  }
}))

import { logger } from '../../utils/logger'

describe('withRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should succeed on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success')
    const result = await withRetry(fn)
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should succeed after retries with small delays', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('success')

    const result = await withRetry(fn, { baseDelay: 1, maxDelay: 5 })
    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should fail after maxRetries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('network error'))

    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 1, maxDelay: 5 })).rejects.toThrow('network error')
    expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('should not retry if shouldRetry returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('invalid input'))
    const shouldRetry = (error) => error.message.includes('network')

    await expect(withRetry(fn, { maxRetries: 3, shouldRetry })).rejects.toThrow('invalid input')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on 5xx errors', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce({ status: 500, message: 'Server error' })
      .mockResolvedValue('recovered')

    const result = await withRetry(fn, { baseDelay: 1, maxDelay: 5 })
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('should log warnings on retry', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('done')

    const result = await withRetry(fn, { baseDelay: 1, maxDelay: 5 })
    expect(result).toBe('done')
    expect(logger.warn).toHaveBeenCalledTimes(2)
  })
})
