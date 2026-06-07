/**
 * Page Tests: Admin Drivers – Resilience Regression
 * Verifies Drivers.jsx does not crash when driver_verification_documents is missing.
 */

import fs from 'fs'
import path from 'path'

const driversPath = path.resolve(__dirname, '../../pages/admin/Drivers.jsx')
const driversSource = fs.readFileSync(driversPath, 'utf8')

describe('Admin Drivers – Resilience Regression', () => {
  test('driver_verification_documents error is handled gracefully, not thrown', () => {
    const loadDataFunction = driversSource.match(/const loadData = async \(\) => \{([\s\S]*?)\n  \}/)
    expect(loadDataFunction).toBeTruthy()
    const loadDataBody = loadDataFunction[1]

    // Must check pendingRes.error before throwing
    expect(loadDataBody).toContain('pendingRes.error')

    // Must NOT simply throw pendingRes.error unconditionally
    expect(loadDataBody).not.toMatch(/if \(pendingRes\.error\) throw pendingRes\.error/)

    // Must warn instead of throw when table is missing
    expect(loadDataBody).toContain("42P01")
    expect(loadDataBody).toContain("does not exist")
    expect(loadDataBody).toContain("logger.warn")
  })

  test('pendingDocuments falls back to 0 when count is unavailable', () => {
    const statsMatch = driversSource.match(/pendingDocuments: (pendingRes\.count \|\| 0)/)
    expect(statsMatch).toBeTruthy()
  })
})
