import fs from 'fs'
import path from 'path'

describe('Order detail/tracking pages do not redirect to login internally', () => {
  it('OrderDetail.jsx does not contain internal login redirect', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../pages/OrderDetail.jsx'), 'utf-8')
    // The page is already protected by ProtectedRoute; internal redirects cause re-login loops.
    expect(source).not.toMatch(/navigate\(\s*['"]\/login['"]/)
  })

  it('OrderTracking.jsx does not contain internal login redirect', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../pages/OrderTracking.jsx'), 'utf-8')
    expect(source).not.toMatch(/navigate\(\s*['"]\/login['"]/)
  })
})
