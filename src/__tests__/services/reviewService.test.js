jest.mock('@/services/supabase', () => ({
  supabase: {},
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

import { buildReviewSummary } from '@/modules/reviews'

describe('reviewService helpers', () => {
  it('builds summary metrics from review rows', () => {
    expect(buildReviewSummary([
      { rating: 5, vendor_reply: 'شكراً' },
      { rating: 4, vendor_reply: null },
      { rating: 2, vendor_reply: '' },
    ])).toEqual({
      totalReviews: 3,
      averageRating: 3.67,
      repliedCount: 1,
      pendingReplyCount: 2,
      lowRatingCount: 1,
    })
  })

  it('returns zeros for empty review sets', () => {
    expect(buildReviewSummary([])).toEqual({
      totalReviews: 0,
      averageRating: 0,
      repliedCount: 0,
      pendingReplyCount: 0,
      lowRatingCount: 0,
    })
  })
})