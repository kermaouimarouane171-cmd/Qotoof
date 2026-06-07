import fs from 'fs'
import path from 'path'

/**
 * Regression test: prevent sending non-existent columns to profiles.updateProfile.
 * Issue: Settings.jsx previously sent currency / notify_new_orders / notify_reviews
 * which do not exist in the profiles table, causing save failures.
 *
 * This test statically inspects the payload object literal inside handleSave.
 */

function extractUpdateProfilePayload(source) {
  const marker = 'profilesService.updateProfile(user.id, {'
  const startIdx = source.indexOf(marker)
  if (startIdx === -1) return null

  let braceCount = 0
  let payloadStart = -1
  for (let i = startIdx + marker.length - 1; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') {
      braceCount++
      if (payloadStart === -1) payloadStart = i + 1
    } else if (ch === '}') {
      braceCount--
      if (braceCount === 0 && payloadStart !== -1) {
        // Ensure next non-whitespace is ')'
        let j = i + 1
        while (j < source.length && /\s/.test(source[j])) j++
        if (source[j] === ')') {
          return source.slice(payloadStart, i)
        }
      }
    }
  }
  return null
}

describe('VendorSettings save payload regression', () => {
  const settingsPath = path.resolve(process.cwd(), 'src/pages/vendor/Settings.jsx')
  const settingsSource = fs.readFileSync(settingsPath, 'utf8')
  const payloadBody = extractUpdateProfilePayload(settingsSource)

  it('locates the profilesService.updateProfile payload in Settings.jsx', () => {
    expect(payloadBody).not.toBeNull()
    expect(typeof payloadBody).toBe('string')
    expect(payloadBody.length).toBeGreaterThan(0)
  })

  describe('forbidden columns (must NOT be sent)', () => {
    const forbidden = ['currency', 'notify_new_orders', 'notify_reviews']

    forbidden.forEach((key) => {
      it(`does not send ${key}`, () => {
        const regex = new RegExp(`\\b${key}\\s*:`)
        expect(payloadBody).not.toMatch(regex)
      })
    })
  })

  describe('required columns (must be sent)', () => {
    const required = ['paypal_email', 'payout_method']

    required.forEach((key) => {
      it(`sends ${key}`, () => {
        const regex = new RegExp(`\\b${key}\\s*:`)
        expect(payloadBody).toMatch(regex)
      })
    })
  })

  describe('generated schema cross-check', () => {
    const dbPath = path.resolve(process.cwd(), 'src/types/database.ts')
    const dbSource = fs.readFileSync(dbPath, 'utf8')

    it('verifies paypal_email exists in database.ts', () => {
      expect(dbSource).toMatch(/\bpaypal_email\b/)
    })

    it('verifies payout_method exists in database.ts', () => {
      expect(dbSource).toMatch(/\bpayout_method\b/)
    })
  })
})
