import fs from 'fs'
import path from 'path'

const checkoutPath = path.resolve(__dirname, '../../pages/CheckoutSimplified.jsx')
const checkoutSource = fs.readFileSync(checkoutPath, 'utf-8')

const arJsonPath = path.resolve(__dirname, '../../i18n/locales/ar.json')
const enJsonPath = path.resolve(__dirname, '../../i18n/locales/en.json')
const frJsonPath = path.resolve(__dirname, '../../i18n/locales/fr.json')

const arJson = JSON.parse(fs.readFileSync(arJsonPath, 'utf-8'))
const enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf-8'))
const frJson = JSON.parse(fs.readFileSync(frJsonPath, 'utf-8'))

describe('CheckoutSimplified.jsx — i18n hard-coded text removal', () => {
  const arabicRegex = /[\u0600-\u06FF]/

  test('does not contain hard-coded Arabic text in active JSX', () => {
    const lines = checkoutSource.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
      if (trimmed.startsWith('import ')) continue
      if (arabicRegex.test(line)) {
        throw new Error(`Found hard-coded Arabic text on line ${i + 1}: ${line}`)
      }
    }
  })

  test('uses t() for checkout step labels', () => {
    expect(checkoutSource).toContain("checkout.steps.${s.label.toLowerCase()}")
  })

  test('uses t() for multi-vendor disabled message', () => {
    expect(checkoutSource).toContain("t('checkout.multiVendorDisabled.title')")
    expect(checkoutSource).toContain("t('checkout.errors.multiVendorDisabled')")
    expect(checkoutSource).toContain("t('checkout.multiVendorDisabled.backToCart')")
  })

  test('uses t() for validation messages', () => {
    expect(checkoutSource).toContain("t('checkout.validation.nameRequired')")
    expect(checkoutSource).toContain("t('checkout.validation.phoneRequired')")
    expect(checkoutSource).toContain("t('checkout.validation.cityRequired')")
    expect(checkoutSource).toContain("t('checkout.validation.addressRequired')")
    expect(checkoutSource).toContain("t('checkout.validation.locationRequired')")
  })

  test('uses t() for PayPal unavailable reasons', () => {
    expect(checkoutSource).toContain("t('checkout.errors.paypalNotConfigured')")
    expect(checkoutSource).toContain("t('checkout.errors.paypalSingleVendorOnly')")
    expect(checkoutSource).toContain("t('checkout.errors.paypalUnavailable')")
  })

  test('uses t() for shipping blockers', () => {
    expect(checkoutSource).toContain("t('checkout.errors.calculatingShipping')")
    expect(checkoutSource).toContain("t('checkout.errors.shippingNotConfirmed')")
    expect(checkoutSource).toContain("t('checkout.errors.shippingOutOfRange')")
  })

  test('uses t() for payment blockers', () => {
    expect(checkoutSource).toContain("t('checkout.blockers.noPaymentMethod')")
    expect(checkoutSource).toContain("t('checkout.blockers.selectPaymentType')")
    expect(checkoutSource).toContain("t('checkout.blockers.selectPaymentMethod')")
    expect(checkoutSource).toContain("t('checkout.blockers.selectBank')")
    expect(checkoutSource).toContain("t('checkout.blockers.acceptTerms')")
  })

  test('uses t() for delivery section strings', () => {
    expect(checkoutSource).toContain("t('checkout.delivery.title')")
    expect(checkoutSource).toContain("t('checkout.delivery.unavailable')")
    expect(checkoutSource).toContain("t('checkout.delivery.scheduling.title')")
    expect(checkoutSource).toContain("t('checkout.delivery.cargoSize.title')")
    expect(checkoutSource).toContain("t('checkout.delivery.driverPayment.title')")
    expect(checkoutSource).toContain("t('checkout.delivery.selfDelivery.title')")
    expect(checkoutSource).toContain("t('checkout.delivery.preferredDriver.title')")
    expect(checkoutSource).toContain("t('checkout.delivery.findingDriver.noMatchTitle')")
  })

  test('uses t() for success and error toasts', () => {
    expect(checkoutSource).toContain("t('checkout.success.generic')")
    expect(checkoutSource).toContain("t('checkout.success.cod')")
    expect(checkoutSource).toContain("t('checkout.success.paypal')")
    expect(checkoutSource).toContain("t('checkout.errors.createOrderFailed')")
    expect(checkoutSource).toContain("t('checkout.errors.genericFailed')")
  })

  test('uses t() for PayPal flow strings', () => {
    expect(checkoutSource).toContain("t('checkout.paypal.autoSwitchNotice')")
    expect(checkoutSource).toContain("t('checkout.paypal.pendingToast')")
    expect(checkoutSource).toContain("t('checkout.paypal.readyToast')")
    expect(checkoutSource).toContain("t('checkout.paypal.cancelled')")
    expect(checkoutSource).toContain("t('checkout.paypal.buttonError')")
  })

  test('uses t() for coupon strings', () => {
    expect(checkoutSource).toContain("t('checkout.coupon.applied'")
    expect(checkoutSource).toContain("t('checkout.coupon.percentage'")
    expect(checkoutSource).toContain("t('checkout.coupon.fixed'")
  })

  test('en.json has all required checkout keys', () => {
    expect(enJson.checkout.steps.shipping).toBeTruthy()
    expect(enJson.checkout.steps.delivery).toBeTruthy()
    expect(enJson.checkout.steps.payment).toBeTruthy()
    expect(enJson.checkout.errors.multiVendorDisabled).toBeTruthy()
    expect(enJson.checkout.validation.nameRequired).toBeTruthy()
    expect(enJson.checkout.delivery.title).toBeTruthy()
    expect(enJson.checkout.deliveryPayment.cash).toBeTruthy()
    expect(enJson.checkout.deliveryPayment.bankTransfer).toBeTruthy()
    expect(enJson.checkout.success.generic).toBeTruthy()
    expect(enJson.checkout.paypal.cancelled).toBeTruthy()
  })

  test('ar.json has all required checkout keys', () => {
    expect(arJson.checkout.steps.shipping).toBeTruthy()
    expect(arJson.checkout.steps.delivery).toBeTruthy()
    expect(arJson.checkout.steps.payment).toBeTruthy()
    expect(arJson.checkout.errors.multiVendorDisabled).toBeTruthy()
    expect(arJson.checkout.validation.nameRequired).toBeTruthy()
    expect(arJson.checkout.delivery.title).toBeTruthy()
    expect(arJson.checkout.deliveryPayment.cash).toBeTruthy()
    expect(arJson.checkout.deliveryPayment.bankTransfer).toBeTruthy()
    expect(arJson.checkout.success.generic).toBeTruthy()
    expect(arJson.checkout.paypal.cancelled).toBeTruthy()
  })

  test('fr.json has all required checkout keys', () => {
    expect(frJson.checkout.steps.shipping).toBeTruthy()
    expect(frJson.checkout.steps.delivery).toBeTruthy()
    expect(frJson.checkout.steps.payment).toBeTruthy()
    expect(frJson.checkout.errors.multiVendorDisabled).toBeTruthy()
    expect(frJson.checkout.validation.nameRequired).toBeTruthy()
    expect(frJson.checkout.delivery.title).toBeTruthy()
    expect(frJson.checkout.deliveryPayment.cash).toBeTruthy()
    expect(frJson.checkout.deliveryPayment.bankTransfer).toBeTruthy()
    expect(frJson.checkout.success.generic).toBeTruthy()
    expect(frJson.checkout.paypal.cancelled).toBeTruthy()
  })
})
