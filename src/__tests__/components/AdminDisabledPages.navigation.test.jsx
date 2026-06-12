import fs from 'fs'
import path from 'path'

const protectedRoutePath = path.resolve(__dirname, '../../components/ProtectedRoute.jsx')
const protectedRouteSource = fs.readFileSync(protectedRoutePath, 'utf-8')

const appRouterPath = path.resolve(__dirname, '../../router/AppRouter.jsx')
const appRouterSource = fs.readFileSync(appRouterPath, 'utf-8')

describe('Admin disabled pages — fraud-reports and disputes are not reachable', () => {
  test('/admin/fraud-reports link is commented out in adminLinks', () => {
    // The line containing fraud-reports must be preceded by // (commented out)
    expect(protectedRouteSource).toMatch(/\/\/ \{ to: '\/admin\/fraud-reports'/)
  })

  test('/admin/disputes link is commented out in adminLinks', () => {
    expect(protectedRouteSource).toMatch(/\/\/ \{ to: '\/admin\/disputes'/)
  })

  test('fraud-reports route is commented out in AppRouter', () => {
    // JSX comment syntax: {/* <Route path="fraud-reports" ... */}
    expect(appRouterSource).toMatch(/\{\s*\/\*.*<Route path="fraud-reports"/)
  })

  test('disputes route is commented out in AppRouter', () => {
    expect(appRouterSource).toMatch(/\{\s*\/\*.*<Route path="disputes"/)
  })

  test('AdminFraudReports lazy import is commented out', () => {
    expect(appRouterSource).toMatch(/\/\/ const AdminFraudReports/)
  })

  test('AdminDisputeManagement lazy import is commented out', () => {
    expect(appRouterSource).toMatch(/\/\/ const AdminDisputeManagement/)
  })

  test('contains comments explaining temporary disablement due to missing DB tables', () => {
    expect(protectedRouteSource).toContain('fraud_reports table does not exist')
    expect(protectedRouteSource).toContain('payment_disputes table does not exist')
    expect(appRouterSource).toContain('fraud_reports')
    expect(appRouterSource).toContain('payment_disputes')
  })
})
