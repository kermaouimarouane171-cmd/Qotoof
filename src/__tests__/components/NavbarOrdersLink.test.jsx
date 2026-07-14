import { getOrdersLinkForRole } from '@/components/Navbar'

describe('getOrdersLinkForRole', () => {
  it('returns /buyer/orders for buyer role', () => {
    expect(getOrdersLinkForRole('buyer')).toBe('/buyer/orders')
  })

  it('returns /vendor/orders for vendor role', () => {
    expect(getOrdersLinkForRole('vendor')).toBe('/vendor/orders')
  })

  it('returns /admin/orders for admin role', () => {
    expect(getOrdersLinkForRole('admin')).toBe('/admin/orders')
  })

  it('returns /driver/history for driver role', () => {
    expect(getOrdersLinkForRole('driver')).toBe('/driver/history')
  })

  it('falls back to /orders for unknown role', () => {
    expect(getOrdersLinkForRole('unknown')).toBe('/orders')
  })

  it('falls back to /orders for undefined role', () => {
    expect(getOrdersLinkForRole(undefined)).toBe('/orders')
  })

  it('falls back to /orders for null role', () => {
    expect(getOrdersLinkForRole(null)).toBe('/orders')
  })

  it('does not return /buyer/orders for non-buyer roles', () => {
    expect(getOrdersLinkForRole('vendor')).not.toBe('/buyer/orders')
    expect(getOrdersLinkForRole('admin')).not.toBe('/buyer/orders')
    expect(getOrdersLinkForRole('driver')).not.toBe('/buyer/orders')
  })
})
