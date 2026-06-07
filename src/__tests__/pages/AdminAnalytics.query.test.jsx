/**
 * Page Tests: Admin Analytics – Query & Schema Regression
 * Verifies Analytics.jsx uses the correct columns (total, not total_amount).
 */

import fs from 'fs'
import path from 'path'

const analyticsPath = path.resolve(__dirname, '../../pages/admin/Analytics.jsx')
const analyticsSource = fs.readFileSync(analyticsPath, 'utf8')

describe('Admin Analytics – Query Regression', () => {
  test('orders query selects total only, never total_amount', () => {
    const ordersSelectMatch = analyticsSource.match(
      /\.from\('orders'\)\s*\.select\(['"]([^'"]*)['"]/
    )
    expect(ordersSelectMatch).toBeTruthy()
    const selectFields = ordersSelectMatch[1]
    expect(selectFields).toContain('total')
    expect(selectFields).not.toContain('total_amount')
  })
})
