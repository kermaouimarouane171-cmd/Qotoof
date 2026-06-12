import fs from 'fs'
import path from 'path'

const storesPath = path.resolve(__dirname, '../../pages/Stores.jsx')
const storesSource = fs.readFileSync(storesPath, 'utf-8')

const arJsonPath = path.resolve(__dirname, '../../i18n/locales/ar.json')
const enJsonPath = path.resolve(__dirname, '../../i18n/locales/en.json')
const frJsonPath = path.resolve(__dirname, '../../i18n/locales/fr.json')

const arJson = JSON.parse(fs.readFileSync(arJsonPath, 'utf-8'))
const enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf-8'))
const frJson = JSON.parse(fs.readFileSync(frJsonPath, 'utf-8'))

describe('Stores.jsx — i18n hard-coded text removal', () => {
  const arabicRegex = /[\u0600-\u06FF]/

  test('does not contain hard-coded Arabic text in active JSX', () => {
    const lines = storesSource.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip imports, constants defined outside component, and comments
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
      if (trimmed.startsWith('const ') || trimmed.startsWith('import ')) continue
      if (trimmed.startsWith('}') || trimmed.startsWith('{')) continue
      if (arabicRegex.test(line)) {
        throw new Error(`Found hard-coded Arabic text on line ${i + 1}: ${line}`)
      }
    }
  })

  test('uses t() for page title', () => {
    expect(storesSource).toContain("t('stores.title')")
  })

  test('uses t() for browseStores description', () => {
    expect(storesSource).toContain("t('stores.browseStores'")
  })

  test('uses t() for search placeholder', () => {
    expect(storesSource).toContain("t('stores.searchPlaceholder')")
  })

  test('uses t() for allCategories filter', () => {
    expect(storesSource).toContain("t('stores.filters.allCategories')")
  })

  test('uses t() for allCities filter', () => {
    expect(storesSource).toContain("t('stores.filters.allCities')")
  })

  test('uses t() for rating filter', () => {
    expect(storesSource).toContain("t('stores.filters.rating')")
  })

  test('uses t() for sort options', () => {
    expect(storesSource).toContain("t(`stores.sortOptions.${option.value}`)")
  })

  test('uses t() for empty state', () => {
    expect(storesSource).toContain("t('stores.empty.description')")
  })

  test('uses t() for unnamed store fallback', () => {
    expect(storesSource).toContain("t('stores.unnamedStore')")
  })

  test('uses t() for unknown city fallback', () => {
    expect(storesSource).toContain("t('stores.unknownCity')")
  })

  test('uses t() for product count label', () => {
    expect(storesSource).toContain("t('stores.productCount')")
  })

  test('uses t() for order count label', () => {
    expect(storesSource).toContain("t('stores.orderCount')")
  })

  test('uses t() for visit store CTA', () => {
    expect(storesSource).toContain("t('stores.cta.visitStore')")
  })

  test('uses t() for pagination previous/next', () => {
    expect(storesSource).toContain("t('common.previous')")
    expect(storesSource).toContain("t('common.next')")
  })

  test('ar.json has all required stores keys', () => {
    expect(arJson.stores.filters.rating).toBeTruthy()
    expect(arJson.stores.sortOptions.rating).toBeTruthy()
    expect(arJson.stores.sortOptions.most_orders).toBeTruthy()
    expect(arJson.stores.unnamedStore).toBeTruthy()
    expect(arJson.stores.unknownCity).toBeTruthy()
    expect(arJson.stores.productCount).toBeTruthy()
    expect(arJson.stores.orderCount).toBeTruthy()
  })

  test('en.json has all required stores keys', () => {
    expect(enJson.stores.filters.rating).toBeTruthy()
    expect(enJson.stores.sortOptions.rating).toBeTruthy()
    expect(enJson.stores.sortOptions.most_orders).toBeTruthy()
    expect(enJson.stores.unnamedStore).toBeTruthy()
    expect(enJson.stores.unknownCity).toBeTruthy()
    expect(enJson.stores.productCount).toBeTruthy()
    expect(enJson.stores.orderCount).toBeTruthy()
  })

  test('fr.json has all required stores keys', () => {
    expect(frJson.stores.filters.rating).toBeTruthy()
    expect(frJson.stores.sortOptions.rating).toBeTruthy()
    expect(frJson.stores.sortOptions.most_orders).toBeTruthy()
    expect(frJson.stores.unnamedStore).toBeTruthy()
    expect(frJson.stores.unknownCity).toBeTruthy()
    expect(frJson.stores.productCount).toBeTruthy()
    expect(frJson.stores.orderCount).toBeTruthy()
  })
})
