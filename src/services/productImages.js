const RELATION_ERROR_SNIPPET = "Could not find a relationship between 'products' and 'product_images'"

let supabaseClientPromise = null

const getSupabaseClient = async () => {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import('./supabase').then((module) => module.supabase)
  }

  return supabaseClientPromise
}

export const isProductImagesRelationError = (error) => {
  const values = [error?.message, error?.details, error?.hint]
  return values.some((value) => typeof value === 'string' && value.includes(RELATION_ERROR_SNIPPET))
}

export const mergeProductImages = (products = [], productImages = []) => {
  if (!Array.isArray(products) || products.length === 0) return []

  const imagesByProductId = new Map()
  for (const image of productImages) {
    if (!image?.product_id) continue
    const images = imagesByProductId.get(image.product_id) || []
    images.push(image)
    imagesByProductId.set(image.product_id, images)
  }

  return products.map((product) => {
    const existingImages = Array.isArray(product?.images)
      ? product.images
      : Array.isArray(product?.product_images)
        ? product.product_images
        : []
    const images = existingImages.length > 0 ? existingImages : (imagesByProductId.get(product.id) || [])
    const primaryImage = images.find((image) => image?.is_primary) || images[0] || null

    return {
      ...product,
      images,
      product_images: images,
      image_url: product?.image_url || primaryImage?.url || null,
    }
  })
}

export const hydrateProductsWithImages = async (products = []) => {
  if (!Array.isArray(products) || products.length === 0) return []

  const productIds = [...new Set(products.map((product) => product?.id).filter(Boolean))]
  if (productIds.length === 0) return products

  const supabase = await getSupabaseClient()

  const { data, error } = await supabase
    .from('product_images')
    .select('id, product_id, url, is_primary, created_at')
    .in('product_id', productIds)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return mergeProductImages(products, data || [])
}

export const runProductImageFallbackQuery = async ({
  buildQuery,
  selectWithImages,
  selectWithoutImages,
  hydrate = hydrateProductsWithImages,
  onRelationError = null,
}) => {
  const primaryResult = await buildQuery(selectWithImages)
  if (!primaryResult.error) {
    return primaryResult
  }

  if (!isProductImagesRelationError(primaryResult.error)) {
    throw primaryResult.error
  }

  onRelationError?.(primaryResult.error)

  const fallbackResult = await buildQuery(selectWithoutImages)
  if (fallbackResult.error) {
    throw fallbackResult.error
  }

  let hydratedData = fallbackResult.data
  if (Array.isArray(fallbackResult.data)) {
    hydratedData = await hydrate(fallbackResult.data)
  } else if (fallbackResult.data) {
    const [hydratedRecord] = await hydrate([fallbackResult.data])
    hydratedData = hydratedRecord || fallbackResult.data
  }

  return {
    ...fallbackResult,
    data: hydratedData,
  }
}

export const hydrateRowsWithProductField = async (rows = [], { productKey = 'product' } = {}) => {
  if (!Array.isArray(rows) || rows.length === 0) return []

  const products = rows.map((row) => row?.[productKey]).filter(Boolean)
  const hydratedProducts = await hydrateProductsWithImages(products)
  const productsById = new Map(hydratedProducts.map((product) => [product.id, product]))

  return rows.map((row) => {
    const product = row?.[productKey]
    if (!product?.id) return row

    return {
      ...row,
      [productKey]: productsById.get(product.id) || product,
    }
  })
}

export const hydrateRowsWithProductItems = async (rows = [], { itemKey = 'items', productKey = 'product' } = {}) => {
  if (!Array.isArray(rows) || rows.length === 0) return []

  const products = rows.flatMap((row) => {
    if (!Array.isArray(row?.[itemKey])) return []
    return row[itemKey].map((item) => item?.[productKey]).filter(Boolean)
  })

  const hydratedProducts = await hydrateProductsWithImages(products)
  const productsById = new Map(hydratedProducts.map((product) => [product.id, product]))

  return rows.map((row) => {
    if (!Array.isArray(row?.[itemKey])) return row

    return {
      ...row,
      [itemKey]: row[itemKey].map((item) => {
        const product = item?.[productKey]
        if (!product?.id) return item

        return {
          ...item,
          [productKey]: productsById.get(product.id) || product,
        }
      }),
    }
  })
}