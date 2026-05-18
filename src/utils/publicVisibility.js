const LATIN_EXPERIMENTAL_MARKERS = [
  /\b(?:demo|test|sample|dummy|placeholder|mock|sandbox|experimental|staging|qa)\b/i,
  /(?:^|[._-])(?:demo|test|sample|dummy|placeholder|mock|sandbox|experimental|staging|qa)(?:$|[._-])/i,
  /@example\.com$/i,
]

const ARABIC_EXPERIMENTAL_MARKERS = [
  /تجريبي|تجريبية|اختباري|اختبارية|للاختبار|بيانات تجريبية/i,
]

const hasExperimentalMarker = (value) => {
  const text = String(value || '').trim()
  if (!text) return false

  return [...LATIN_EXPERIMENTAL_MARKERS, ...ARABIC_EXPERIMENTAL_MARKERS].some((pattern) => pattern.test(text))
}

const collectVendorFields = (vendor = {}) => ([
  vendor.store_name,
  vendor.store_description,
  vendor.first_name,
  vendor.last_name,
  vendor.email,
])

const collectProductFields = (product = {}) => ([
  product.name,
  product.description,
  product.subcategory,
  product.category,
  product.store_name,
  product.vendor_name,
])

export const isPublicVendorVisible = (vendor) => {
  if (!vendor) return false
  return !collectVendorFields(vendor).some(hasExperimentalMarker)
}

export const isPublicProductVisible = (product) => {
  if (!product) return false

  const vendor = product.vendor || {
    first_name: product.vendor_first_name,
    last_name: product.vendor_last_name,
    store_name: product.store_name || product.vendor_name,
    email: product.vendor_email,
  }

  return !collectProductFields(product).some(hasExperimentalMarker) && isPublicVendorVisible(vendor)
}

export const filterPublicVendors = (vendors = []) => vendors.filter(isPublicVendorVisible)

export const filterPublicProducts = (products = []) => products.filter(isPublicProductVisible)

export const publicVisibilityUtils = {
  hasExperimentalMarker,
  isPublicVendorVisible,
  isPublicProductVisible,
  filterPublicVendors,
  filterPublicProducts,
}

export default publicVisibilityUtils