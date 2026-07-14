import fs from 'fs'
import path from 'path'

const protectedRoutePath = path.resolve(__dirname, '../../components/ProtectedRoute.jsx')
const protectedRouteSource = fs.readFileSync(protectedRoutePath, 'utf-8')

const appRouterPath = path.resolve(__dirname, '../../router/AppRouter.jsx')
const appRouterSource = fs.readFileSync(appRouterPath, 'utf-8')

describe('Admin recovered pages — fraud-reports and disputes are reachable', () => {
  test('/admin/fraud-reports link is active in adminLinks', () => {
    expect(protectedRouteSource).toMatch(/\{ to: '\/admin\/fraud-reports'/)
    expect(protectedRouteSource).not.toMatch(/\/\/ \{ to: '\/admin\/fraud-reports'/)
  })

  test('/admin/disputes link is active in adminLinks', () => {
    expect(protectedRouteSource).toMatch(/\{ to: '\/admin\/disputes'/)
    expect(protectedRouteSource).not.toMatch(/\/\/ \{ to: '\/admin\/disputes'/)
  })

  test('fraud-reports route is active in AppRouter', () => {
    expect(appRouterSource).toMatch(/<Route path="fraud-reports"/)
    expect(appRouterSource).not.toMatch(/\{\s*\/\*.*<Route path="fraud-reports"/)
  })

  test('disputes route is active in AppRouter', () => {
    expect(appRouterSource).toMatch(/<Route path="disputes"/)
    expect(appRouterSource).not.toMatch(/\{\s*\/\*.*<Route path="disputes"/)
  })

  test('AdminFraudReports lazy import is active', () => {
    expect(appRouterSource).toMatch(/const AdminFraudReports\s*=\s*lazy/)
    expect(appRouterSource).not.toMatch(/\/\/ const AdminFraudReports/)
  })

  test('AdminDisputeManagement lazy import is active', () => {
    expect(appRouterSource).toMatch(/const AdminDisputeManagement\s*=\s*lazy/)
    expect(appRouterSource).not.toMatch(/\/\/ const AdminDisputeManagement/)
  })

  test('stale "table does not exist" comments are removed', () => {
    expect(protectedRouteSource).not.toContain('fraud_reports table does not exist')
    expect(protectedRouteSource).not.toContain('payment_disputes table does not exist')
    expect(appRouterSource).not.toContain('TEMPORARILY DISABLED')
  })
})
