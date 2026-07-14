/**
 * Regression test: buyerTracking.* i18n keys
 *
 * The buyer Tracking page (src/pages/buyer/Tracking.jsx) uses `t('buyerTracking.*', fallback)`
 * calls. Before this fix, the `buyerTracking` namespace was missing from all 3 locale files,
 * causing English/French users to see Arabic fallback strings.
 *
 * This test ensures:
 * 1. The `buyerTracking` object exists in ar.json, en.json, and fr.json
 * 2. Every key used in t() calls by Tracking.jsx is present in all locales
 * 3. No value is an empty string (which would cause i18next to return the key itself)
 */

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'en', 'fr']

// Keys actually passed to t() in src/pages/buyer/Tracking.jsx
const REQUIRED_KEYS = [
  'title',
  'empty',
  'emptyMessage',
  'browse',
  'active',
  'delivered',
  'driverAssigned',
  'eta.label',
  'eta.pending',
  'eta.accepted',
  'eta.preparing',
  'eta.driverAssigned',
  'eta.pickedUp',
  'eta.onTheWay',
  'eta.arrivingSoon',
  'eta.minutes',
  'eta.hours',
  'eta.hoursMinutes',
  'eta.range',
]

function getNestedValue(obj, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

function loadLocale(locale) {
  const filePath = path.resolve(__dirname, `../../i18n/locales/${locale}.json`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

describe('buyerTracking i18n keys', () => {
  for (const locale of LOCALES) {
    describe(`${locale}.json`, () => {
      const data = loadLocale(locale)

      it('has a top-level buyerTracking object', () => {
        expect(data.buyerTracking).toBeDefined()
        expect(typeof data.buyerTracking).toBe('object')
        expect(data.buyerTracking).not.toBeNull()
      })

      it('has an eta sub-object', () => {
        expect(data.buyerTracking.eta).toBeDefined()
        expect(typeof data.buyerTracking.eta).toBe('object')
      })

      for (const key of REQUIRED_KEYS) {
        it(`has non-empty value for buyerTracking.${key}`, () => {
          const value = getNestedValue(data.buyerTracking, key)
          expect(value).toBeDefined()
          expect(typeof value).toBe('string')
          expect(value.length).toBeGreaterThan(0)
        })
      }
    })
  }

  it('all 19 required keys are present across all 3 locales', () => {
    let missing = []
    for (const locale of LOCALES) {
      const data = loadLocale(locale)
      for (const key of REQUIRED_KEYS) {
        const value = getNestedValue(data.buyerTracking, key)
        if (value === undefined || (typeof value === 'string' && value.length === 0)) {
          missing.push(`${locale}: buyerTracking.${key}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
