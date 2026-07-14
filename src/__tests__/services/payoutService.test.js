import { payoutService } from '@/modules/commissions'

jest.mock('@/services/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}))

const { supabase } = require('@/services/supabase')

describe('payoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('sendPayout', () => {
    test('invokes send-payout Edge Function with correct payload', async () => {
      supabase.functions.invoke.mockResolvedValue({
        data: { success: true, payout_id: 'payout-123' },
        error: null,
      })

      const result = await payoutService.sendPayout({
        userId: 'user-abc',
        amount: 150.50,
        currency: 'EUR',
        source: 'manual',
      })

      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-payout', {
        body: {
          user_id: 'user-abc',
          amount: 150.50,
          currency: 'EUR',
          source: 'manual',
        },
      })
      expect(result).toEqual({ success: true, payout_id: 'payout-123' })
    })

    test('uses default currency EUR and source manual when not provided', async () => {
      supabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null,
      })

      await payoutService.sendPayout({
        userId: 'user-xyz',
        amount: 75,
      })

      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-payout', {
        body: {
          user_id: 'user-xyz',
          amount: 75,
          currency: 'EUR',
          source: 'manual',
        },
      })
    })

    test('throws when Edge Function returns an error', async () => {
      const edgeError = new Error('Edge Function error')
      supabase.functions.invoke.mockResolvedValue({
        data: null,
        error: edgeError,
      })

      await expect(
        payoutService.sendPayout({ userId: 'u1', amount: 100 })
      ).rejects.toThrow('Edge Function error')
    })

    test('throws when data.success is false', async () => {
      supabase.functions.invoke.mockResolvedValue({
        data: { success: false, error: 'Insufficient balance' },
        error: null,
      })

      await expect(
        payoutService.sendPayout({ userId: 'u1', amount: 100 })
      ).rejects.toThrow('Insufficient balance')
    })

    test('throws generic error when data.success is false and no error message', async () => {
      supabase.functions.invoke.mockResolvedValue({
        data: { success: false },
        error: null,
      })

      await expect(
        payoutService.sendPayout({ userId: 'u1', amount: 100 })
      ).rejects.toThrow('Failed to send payout')
    })

    test('returns data exactly as received from Edge Function on success', async () => {
      const mockData = { success: true, payout_id: 'p-789', amount: 200, currency: 'EUR' }
      supabase.functions.invoke.mockResolvedValue({
        data: mockData,
        error: null,
      })

      const result = await payoutService.sendPayout({
        userId: 'u1',
        amount: 200,
        currency: 'EUR',
        source: 'auto',
      })

      expect(result).toBe(mockData)
    })
  })

  describe('default export', () => {
    test('payoutServiceDefault is the same object as payoutService', () => {
      const { payoutServiceDefault } = require('@/modules/commissions')
      expect(payoutServiceDefault).toBe(payoutService)
    })
  })
})
