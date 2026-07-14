/**
 * Regression test: Vendor i18n keys
 *
 * Ensures all vendor.* namespaces that were added during the Vendor Role
 * Improvement Blueprint implementation exist in all 3 locale files.
 *
 * Covers: V-001 through V-019 (i18n fixes)
 */

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'en', 'fr']

// Namespaces that should exist under vendor.*
const REQUIRED_VENDOR_NAMESPACES = [
  'reviews',
  'deliveryOptionSetup',
  'driverPreferenceSetup',
  'profile',
  'productForm',
  'products',
  'subscription',
]

// Specific keys that must be present
const REQUIRED_KEYS = {
  'vendor.reviews.loadFailed': true,
  'vendor.reviews.vendorNotFound': true,
  'vendor.reviews.replyEmpty': true,
  'vendor.reviews.alreadyReplied': true,
  'vendor.reviews.replySuccess': true,
  'vendor.reviews.replyFailed': true,
  'vendor.deliveryOptionSetup.loadFailed': true,
  'vendor.deliveryOptionSetup.selectFirst': true,
  'vendor.deliveryOptionSetup.ownDriverSaved': true,
  'vendor.deliveryOptionSetup.findDriverActivated': true,
  'vendor.deliveryOptionSetup.selfActivated': true,
  'vendor.deliveryOptionSetup.saved': true,
  'vendor.deliveryOptionSetup.saveFailed': true,
  'vendor.driverPreferenceSetup.selectChoice': true,
  'vendor.driverPreferenceSetup.vendorNotFound': true,
  'vendor.driverPreferenceSetup.saveFailed': true,
  'vendor.profile.tabs.storeInfo': true,
  'vendor.profile.tabs.location': true,
  'vendor.profile.tabs.hours': true,
  'vendor.profile.tabs.security': true,
  'vendor.profile.tabs.preferences': true,
  'vendor.productForm.maxImagesError': true,
  'vendor.productForm.unsupportedFormatError': true,
  'vendor.productForm.fileTooLargeError': true,
  'vendor.orders.notifications.newOrderReceived': true,
  'vendor.orders.success.driverAssigned': true,
  'vendor.orders.errors.driverAssignFailed': true,
  'vendor.locationSetup.moroccoBoundsError': true,
  'vendor.products.errors.loadFailed': true,
  'vendor.products.errors.imageRemoveFailed': true,
  'vendor.products.success.imageRemoved': true,
  'vendor.subscription.paymentCompleted': true,
  'vendor.subscription.paymentCanceled': true,
  'vendor.subscription.loadFailed': true,
  'vendor.subscription.checkoutFailed': true,
  'vendor.subscription.title': true,
  'vendor.subscription.subtitle': true,
  'vendor.subscription.refresh': true,
  'vendor.subscription.status.active': true,
  'vendor.subscription.status.past_due': true,
  'vendor.subscription.status.grace_period': true,
  'vendor.subscription.status.canceled': true,
  'vendor.subscription.currentPlan': true,
  'vendor.subscription.subscriptionEnds': true,
  'vendor.subscription.gracePeriodUntil': true,
  'vendor.subscription.monthly': true,
  'vendor.subscription.yearly': true,
  'vendor.subscription.currentBadge': true,
  'vendor.subscription.perMonth': true,
  'vendor.subscription.perYear': true,
  'vendor.subscription.monthlyEquivalent': true,
  'vendor.subscription.maxProducts': true,
  'vendor.subscription.unlimited': true,
  'vendor.subscription.commission': true,
  'vendor.subscription.currentPlanButton': true,
  'vendor.subscription.includedButton': true,
  'vendor.subscription.upgradeButton': true,
  'vendor.subscription.recentBilling': true,
  'vendor.subscription.noInvoices': true,
  'vendor.subscription.planActivity': true,
  'vendor.subscription.noActivity': true,
}

// onboarding.vendor keys
const REQUIRED_ONBOARDING_KEYS = {
  'onboarding.vendor.roleLabel': true,
  'onboarding.vendor.completeLabel': true,
  'onboarding.vendor.slides.s1.title': true,
  'onboarding.vendor.slides.s2.title': true,
  'onboarding.vendor.slides.s3.title': true,
  'onboarding.vendor.slides.s4.title': true,
}

function getNestedValue(obj, dottedPath) {
  return dottedPath.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

function loadLocale(locale) {
  const filePath = path.resolve(__dirname, `../../i18n/locales/${locale}.json`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

describe('Vendor i18n keys', () => {
  for (const locale of LOCALES) {
    describe(`${locale}.json vendor namespaces`, () => {
      const data = loadLocale(locale)

      for (const ns of REQUIRED_VENDOR_NAMESPACES) {
        it(`has vendor.${ns} object`, () => {
          expect(data.vendor).toBeDefined()
          expect(data.vendor[ns]).toBeDefined()
          expect(typeof data.vendor[ns]).toBe('object')
        })
      }

      for (const key of Object.keys(REQUIRED_KEYS)) {
        it(`has non-empty value for ${key}`, () => {
          const value = getNestedValue(data, key)
          expect(value).toBeDefined()
          expect(typeof value).toBe('string')
          expect(value.length).toBeGreaterThan(0)
        })
      }
    })

    describe(`${locale}.json onboarding.vendor keys`, () => {
      const data = loadLocale(locale)

      for (const key of Object.keys(REQUIRED_ONBOARDING_KEYS)) {
        it(`has non-empty value for ${key}`, () => {
          const value = getNestedValue(data, key)
          expect(value).toBeDefined()
          expect(typeof value).toBe('string')
          expect(value.length).toBeGreaterThan(0)
        })
      }
    })
  }

  it('all required vendor keys present across all 3 locales', () => {
    let missing = []
    for (const locale of LOCALES) {
      const data = loadLocale(locale)
      for (const key of [...Object.keys(REQUIRED_KEYS), ...Object.keys(REQUIRED_ONBOARDING_KEYS)]) {
        const value = getNestedValue(data, key)
        if (value === undefined || (typeof value === 'string' && value.length === 0)) {
          missing.push(`${locale}: ${key}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
