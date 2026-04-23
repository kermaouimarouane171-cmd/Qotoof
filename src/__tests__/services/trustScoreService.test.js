jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

import { supabase } from '@/services/supabase'
import trustScoreService from '@/services/trustScoreService'

describe('trustScoreService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('marks COD as ineligible when trust history is insufficient', async () => {
    supabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              trust_score: 65,
              completed_orders_count: 2,
              failed_payments_count: 1,
              cod_eligible: false,
              cod_restricted_until: null,
            },
            error: null,
          }),
        }),
      }),
    })

    const eligibility = await trustScoreService.checkCodEligibility('buyer-1')

    expect(eligibility.eligible).toBe(false)
    expect(eligibility.reason).toContain('3 طلبات')
  })

  it('builds the split payment plan as two staged payments', () => {
    const plan = trustScoreService.buildPaymentPlan({
      paymentType: 'split',
      payableAmount: 1000,
    })

    expect(plan.paymentMethod).toBe('bank')
    expect(plan.firstPaymentAmount).toBe(500)
    expect(plan.secondPaymentAmount).toBe(500)
    expect(plan.firstPaymentStatus).toBe('pending')
    expect(plan.secondPaymentStatus).toBe('pending')
  })
})