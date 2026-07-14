const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const buildVendorCartBuckets = (items = []) => {
  const buckets = new Map()

  items.forEach((item) => {
    const vendorId = item.vendor_id || 'unknown'
    const existing = buckets.get(vendorId) || {
      vendorId,
      vendorName: item.vendor_name || item.store_name || 'Vendor',
      subtotal: 0,
      itemCount: 0,
      items: [],
    }

    existing.subtotal += (item.is_negotiated && item.locked_price != null
      ? toNumber(item.locked_price)
      : toNumber(item.price_per_unit || item.price)) * toNumber(item.quantity)
    existing.itemCount += 1
    existing.items.push(item)
    buckets.set(vendorId, existing)
  })

  return Array.from(buckets.values())
}

export const evaluateVendorMinimumOrders = ({ items = [], vendorProfiles = [] } = {}) => {
  const profileMap = new Map(vendorProfiles.map((profile) => [profile.id, profile]))
  const vendors = buildVendorCartBuckets(items).map((bucket) => {
    const profile = profileMap.get(bucket.vendorId)
    const minOrderAmount = toNumber(profile?.min_order_amount)
    const shortfall = Math.max(minOrderAmount - bucket.subtotal, 0)

    return {
      ...bucket,
      vendorName: profile?.store_name || bucket.vendorName,
      minOrderAmount,
      shortfall,
      meetsMinimum: minOrderAmount <= 0 || shortfall === 0,
    }
  })

  const violations = vendors.filter((vendor) => !vendor.meetsMinimum)

  return {
    vendors,
    violations,
    hasViolations: violations.length > 0,
    firstViolation: violations[0] || null,
  }
}

export const buildMinimumOrderMessage = (vendor) => {
  if (!vendor || vendor.meetsMinimum) return ''
  return `الحد الأدنى للطلب لدى ${vendor.vendorName} هو ${vendor.minOrderAmount.toFixed(2)} درهم. المتبقي ${vendor.shortfall.toFixed(2)} درهم.`
}