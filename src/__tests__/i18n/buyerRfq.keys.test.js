/**
 * Regression test: buyer.rfq.* i18n keys
 *
 * The buyer RFQ page (src/pages/buyer/RFQ.jsx) uses `t('buyer.rfq.*', fallback)`
 * calls. Before this fix, the `buyer.rfq` namespace was missing from fr.json
 * (present in ar.json and en.json), causing French users to see English fallbacks.
 *
 * This test ensures:
 * 1. The `buyer.rfq` object exists in ar.json, en.json, and fr.json
 * 2. Every key used in t() calls by RFQ.jsx is present in all 3 locales
 * 3. The set of keys is identical across all 3 locales (no drift)
 * 4. No value is an empty string
 */

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'en', 'fr']

// Keys actually passed to t() in src/pages/buyer/RFQ.jsx (extracted from source)
const REQUIRED_TOP_KEYS = [
  'title',
  'subtitle',
  'newRequest',
  'deadline',
  'maxBudget',
  'offers',
  'viewOffers',
  'viewDetails',
  'vendorFallback',
  'unit',
  'total',
  'acceptOffer',
  'confirmCancel',
  'noOffersYet',
  'cancelTitle',
]

const REQUIRED_NESTED_KEYS = [
  'status.open',
  'status.closed',
  'status.expired',
  'status.cancelled',
  'offerStatus.pending',
  'offerStatus.accepted',
  'offerStatus.rejected',
  'offerStatus.withdrawn',
  'summary.total',
  'summary.open',
  'summary.completed',
  'empty.title',
  'empty.desc',
  'empty.createButton',
  'modal.title',
  'form.title',
  'form.titlePlaceholder',
  'form.category',
  'form.quantity',
  'form.maxBudget',
  'form.optional',
  'form.city',
  'form.cityPlaceholder',
  'form.deadline',
  'form.description',
  'form.descriptionPlaceholder',
  'form.submit',
  'errors.loadFailed',
  'errors.loadOffersFailed',
  'errors.acceptFailed',
  'errors.cancelFailed',
  'errors.titleAndQuantityRequired',
  'errors.createFailed',
  'success.offerAccepted',
  'success.cancelled',
  'success.created',
]

const ALL_REQUIRED_KEYS = [...REQUIRED_TOP_KEYS, ...REQUIRED_NESTED_KEYS]

function getNestedValue(obj, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

function deepKeys(obj, prefix = '') {
  let keys = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? prefix + '.' + k : k
    if (typeof v === 'object' && v !== null) keys.push(...deepKeys(v, full))
    else keys.push(full)
  }
  return keys.sort()
}

function loadLocale(locale) {
  const filePath = path.resolve(__dirname, `../../i18n/locales/${locale}.json`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

describe('buyer.rfq i18n keys', () => {
  for (const locale of LOCALES) {
    describe(`${locale}.json`, () => {
      const data = loadLocale(locale)

      it('has a buyer.rfq object', () => {
        expect(data.buyer).toBeDefined()
        expect(data.buyer.rfq).toBeDefined()
        expect(typeof data.buyer.rfq).toBe('object')
        expect(data.buyer.rfq).not.toBeNull()
      })

      for (const key of ALL_REQUIRED_KEYS) {
        it(`has non-empty value for buyer.rfq.${key}`, () => {
          const value = getNestedValue(data.buyer.rfq, key)
          expect(value).toBeDefined()
          expect(typeof value).toBe('string')
          expect(value.length).toBeGreaterThan(0)
        })
      }
    })
  }

  it('all 3 locales have identical deep key sets for buyer.rfq', () => {
    const keySets = LOCALES.map((locale) => {
      const data = loadLocale(locale)
      return deepKeys(data.buyer.rfq)
    })
    // Compare all against the first (ar)
    const arKeys = keySets[0].join(',')
    for (let i = 1; i < keySets.length; i++) {
      expect(keySets[i].join(',')).toBe(arKeys)
    }
  })

  it('all required keys are present across all 3 locales', () => {
    let missing = []
    for (const locale of LOCALES) {
      const data = loadLocale(locale)
      for (const key of ALL_REQUIRED_KEYS) {
        const value = getNestedValue(data.buyer.rfq, key)
        if (value === undefined || (typeof value === 'string' && value.length === 0)) {
          missing.push(`${locale}: buyer.rfq.${key}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
