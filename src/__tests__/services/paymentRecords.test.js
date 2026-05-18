import {
  buildPaymentWritePayload,
  decoratePaymentRecord,
  getPaymentMethodCandidates,
  normalizePaymentMethod,
} from '@/services/paymentRecords'

describe('paymentRecords helpers', () => {
  test('normalizes legacy payment aliases to canonical ids', () => {
    expect(normalizePaymentMethod('bank_transfer')).toBe('bank')
    expect(normalizePaymentMethod('cash_on_delivery')).toBe('cod')
    expect(normalizePaymentMethod('paypal')).toBe('paypal')
  })

  test('keeps compatibility candidates for legacy bank records', () => {
    expect(getPaymentMethodCandidates('bank')).toEqual(['bank', 'bank_transfer'])
  })

  test('decorates legacy payment rows with canonical payment_method and alias', () => {
    expect(decoratePaymentRecord({ id: 'p1', method: 'bank_transfer' })).toEqual({
      id: 'p1',
      payment_method: 'bank',
      method: 'bank',
    })
  })

  test('writes canonical payment_method and strips deprecated fields', () => {
    expect(buildPaymentWritePayload({
      order_id: 'o1',
      paymentMethod: 'bank_transfer',
      method: 'paypal',
      status: 'pending',
    })).toEqual({
      order_id: 'o1',
      payment_method: 'bank',
      status: 'pending',
    })
  })
})