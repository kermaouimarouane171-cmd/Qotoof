import fs from 'fs'
import path from 'path'

const arabicRegex = /[\u0600-\u06FF]/

const arJsonPath = path.resolve(__dirname, '../../i18n/locales/ar.json')
const enJsonPath = path.resolve(__dirname, '../../i18n/locales/en.json')
const arJson = JSON.parse(fs.readFileSync(arJsonPath, 'utf-8'))
const enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf-8'))

const scanForHardcodedArabic = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf-8')
  const lines = source.split('\n')
  const violations = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
    if (trimmed.startsWith('import ')) continue
    if (arabicRegex.test(line)) {
      violations.push({ line: i + 1, content: line })
    }
  }
  return violations
}

const checkKeyExists = (obj, keyPath) => {
  const parts = keyPath.split('.')
  let current = obj
  for (const part of parts) {
    if (current[part] === undefined) return false
    current = current[part]
  }
  return true
}

describe('OrderConfirmation i18n — hardcoded Arabic removal', () => {
  const filePath = path.resolve(__dirname, '../../pages/OrderConfirmation.jsx')

  test('OrderConfirmation page has no hardcoded Arabic text', () => {
    const violations = scanForHardcodedArabic(filePath)
    if (violations.length > 0) {
      throw new Error(
        `Found ${violations.length} hardcoded Arabic text(s) in OrderConfirmation.jsx:\n` +
        violations.map(v => `  Line ${v.line}: ${v.content.trim()}`).join('\n')
      )
    }
  })
})

describe('OrderConfirmation i18n — translation key existence', () => {
  const keysToCheck = [
    { key: 'orderConfirmation.paypal.cancelledMessage', en: null, ar: null },
    { key: 'orderConfirmation.paypal.confirmedMessage', en: null, ar: null },
    { key: 'orderConfirmation.paypal.pendingMessage', en: null, ar: null },
    { key: 'orderConfirmation.paypal.errorMessage', en: null, ar: null },
    { key: 'orderConfirmation.paypal.alreadyPaidError', en: null, ar: null },
    { key: 'orderConfirmation.paypal.retryInitError', en: null, ar: null },
    { key: 'orderConfirmation.paypal.recordNotFoundError', en: null, ar: null },
    { key: 'orderConfirmation.paypal.retryError', en: null, ar: null },
    { key: 'orderConfirmation.paypal.sectionTitle', en: 'Pay with PayPal', ar: 'الدفع عبر PayPal' },
    { key: 'orderConfirmation.paypal.completedDescription', en: null, ar: null },
    { key: 'orderConfirmation.paypal.pendingDescription', en: null, ar: null },
    { key: 'orderConfirmation.paypal.retryButton', en: 'Complete Payment via PayPal', ar: 'إتمام الدفع عبر PayPal' },
    { key: 'orderConfirmation.paypal.processingButton', en: 'Initializing PayPal...', ar: 'جاري تهيئة PayPal...' },
    { key: 'orderConfirmation.cod.sectionTitle', en: 'Cash on Delivery Policy', ar: 'سياسة الدفع عند الاستلام' },
    { key: 'orderConfirmation.cod.policyText', en: null, ar: null },
    // Cart / checkout flow
    { key: 'cart.summary.deliveryRulesNotice', en: null, ar: null },
  ]

  keysToCheck.forEach(({ key, en, ar }) => {
    test(`key ${key} exists in ar.json`, () => {
      expect(checkKeyExists(arJson, key)).toBe(true)
    })
    test(`key ${key} exists in en.json`, () => {
      expect(checkKeyExists(enJson, key)).toBe(true)
    })
    if (en) {
      test(`key ${key} has expected English value`, () => {
        const parts = key.split('.')
        let current = enJson
        for (const part of parts) current = current[part]
        expect(current).toBe(en)
      })
    }
    if (ar) {
      test(`key ${key} has expected Arabic value`, () => {
        const parts = key.split('.')
        let current = arJson
        for (const part of parts) current = current[part]
        expect(current).toBe(ar)
      })
    }
  })
})
