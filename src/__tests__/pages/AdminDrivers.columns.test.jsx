/**
 * Admin Drivers Page – Schema Regression Test
 * Verifies that Drivers.jsx does NOT select columns that do not exist in the DB schema.
 */

import fs from 'fs'
import path from 'path'

const driversPath = path.resolve(__dirname, '../../pages/admin/Drivers.jsx')
const driversSource = fs.readFileSync(driversPath, 'utf8')

describe('Admin Drivers – SELECT columns must match DB schema', () => {
  // Extract ONLY the .select() string for the profiles query
  const profilesSelectMatch = driversSource.match(
    /\.from\('profiles'\)[\s\S]*?\.select\('([^']+)'\)/
  )
  const selectString = profilesSelectMatch ? profilesSelectMatch[1] : ''

  test('does not request license_verified from profiles', () => {
    expect(selectString).not.toContain('license_verified')
  })

  test('does not request insurance_verified from profiles', () => {
    expect(selectString).not.toContain('insurance_verified')
  })

  test('does not request license_expiry_date from profiles', () => {
    expect(selectString).not.toContain('license_expiry_date')
  })

  test('does not request insurance_expiry_date from profiles', () => {
    expect(selectString).not.toContain('insurance_expiry_date')
  })

  test('profiles select still includes core driver fields', () => {
    expect(profilesSelectMatch).toBeTruthy()
    const columns = selectString.split(/,\s*/)
    expect(columns).toContain('id')
    expect(columns).toContain('first_name')
    expect(columns).toContain('vehicle_type')
    expect(columns).toContain('vehicle_plate')
    expect(columns).toContain('is_available_for_delivery')
  })

  test('getVerificationStatus handles missing columns gracefully', () => {
    // Must use optional / falsy-safe checks (undefined → false)
    expect(driversSource).toMatch(/!!driver\.license_verified/)
    expect(driversSource).toMatch(/!!driver\.insurance_verified/)
  })
})
