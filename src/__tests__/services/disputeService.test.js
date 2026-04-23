jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}))

jest.mock('@/services/notifications', () => ({
  notificationsApi: {
    create: jest.fn().mockResolvedValue({}),
  },
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('@/services/trustScoreService', () => ({
  __esModule: true,
  default: {
    registerFailedPayment: jest.fn().mockResolvedValue({}),
    updateTrustScore: jest.fn().mockResolvedValue({}),
    syncCodEligibility: jest.fn().mockResolvedValue({ eligible: true }),
  },
}))

import { supabase } from '@/services/supabase'
import { notificationsApi } from '@/services/notifications'
import trustScoreService from '@/services/trustScoreService'
import disputeService from '@/services/disputeService'

describe('disputeService', () => {
  const baseDispute = {
    id: 'dispute-1',
    buyer_id: 'buyer-1',
    vendor_id: 'vendor-1',
    order_id: 'order-1',
    order: {
      id: 'order-1',
      order_number: 'ORD-1001',
      buyer_id: 'buyer-1',
    },
    buyer: {
      first_name: 'Buyer',
      last_name: 'One',
      email: 'buyer@example.com',
      phone: '+212600000001',
      city: 'Casablanca',
      address: 'Rue 1',
    },
    vendor: {
      store_name: 'Vendor Store',
      email: 'vendor@example.com',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()

    supabase.from.mockImplementation((table) => {
      if (table === 'payment_disputes') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: baseDispute, error: null }),
            }),
          }),
          update: (payload) => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: { ...baseDispute, ...payload },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }

      if (table === 'orders') {
        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })
  })

  it('resolves disputes in vendor favor and applies payment-failure penalties', async () => {
    const result = await disputeService.resolveInVendorFavor({
      disputeId: 'dispute-1',
      adminId: 'admin-1',
      resolution: 'ثبت امتناع المشتري عن السداد بعد التنفيذ.',
      adminNotes: 'تمت مراجعة الإيصال والتتبع.',
      releaseBuyerData: true,
    })

    expect(trustScoreService.registerFailedPayment).toHaveBeenCalledWith('buyer-1', {
      penalty: 20,
      restrictionDays: 45,
    })
    expect(notificationsApi.create).toHaveBeenCalledTimes(2)
    expect(result.buyerData).toEqual(baseDispute.buyer)
  })

  it('protects the buyer when the dispute is resolved in the buyer favor', async () => {
    await disputeService.resolveInBuyerFavor({
      disputeId: 'dispute-1',
      adminId: 'admin-1',
      resolution: 'ثبت أن البلاغ غير صحيح وأن موقف المشتري سليم.',
      adminNotes: 'لا يوجد امتناع فعلي عن السداد.',
    })

    expect(trustScoreService.registerFailedPayment).not.toHaveBeenCalled()
    expect(trustScoreService.updateTrustScore).toHaveBeenCalledWith('buyer-1', 5)
    expect(trustScoreService.syncCodEligibility).toHaveBeenCalledWith('buyer-1')
    expect(notificationsApi.create).toHaveBeenCalledTimes(2)
  })
})