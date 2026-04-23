# 🔍 Product Detail Page Audit Report - Greenmarket (Qotoof)

**Date:** April 11, 2026  
**Auditor:** Senior Full-Stack Engineer (20 years experience)  
**File:** `src/pages/ProductDetail.jsx`  
**Route:** `/product/:id`  
**Component:** `ProductDetailPage`

---

## 📊 Executive Summary

After thorough review of the Product Detail page, I identified **16 issues** ranging from critical to minor. The page has **good foundations** with dynamic routing, Supabase queries, and image gallery, but requires improvements in **error handling**, **SEO**, **stock validation**, **lazy loading**, and **accessibility**.

### Issues Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 5 | Must fix |
| 🟡 High | 6 | Should fix |
| 🟢 Medium | 3 | Nice to have |
| ⚪ Low | 2 | Optional |

---

## ❌ Issues Found & Fixes

---

### 🔴 ERROR #1: No 404 Handling for Product Not Found

**Issue:** When Supabase returns an error (product doesn't exist), the page shows a generic "Product not found" message but doesn't properly handle the error state or redirect.

**Risk:** Users see error toast but page stays on broken state

**Location:** `loadProduct()` function

**Current Code:**
```javascript
if (error) throw error
// ...
catch (error) {
  logger.error('Error loading product:', error)
  toast.error('Product not found')
}
```

**Fixed Code:**
```javascript
const [notFound, setNotFound] = useState(false)

const loadProduct = async () => {
  if (!id) return

  setLoading(true)
  setNotFound(false)
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        vendor:profiles(id, first_name, last_name, city, country, store_name, store_description, latitude, longitude),
        images:product_images(id, url, is_primary)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Product not found
        setNotFound(true)
        return
      }
      throw error
    }

    setProduct(data)
    setQuantity(data?.min_order_quantity || 1)

    // Set primary image as selected
    if (data?.images?.length > 0) {
      const primaryIndex = data.images.findIndex(img => img.is_primary)
      setSelectedImage(primaryIndex >= 0 ? primaryIndex : 0)
    }
  } catch (error) {
    logger.error('Error loading product:', error)
    toast.error('Failed to load product. Please try again.')
    setNotFound(true)
  } finally {
    setLoading(false)
  }
}

// Add 404 state rendering
if (notFound) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <PhotoIcon className="w-10 h-10 text-gray-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {t('product.notFound.title', 'Product not found')}
      </h2>
      <p className="text-gray-500 mb-6">
        {t('product.notFound.description', 'The product you\'re looking for doesn\'t exist or has been removed.')}
      </p>
      <Link to="/marketplace" className="btn-primary inline-flex items-center gap-2">
        <ArrowLeftIcon className="w-5 h-5" />
        {t('product.notFound.backToMarketplace', 'Back to Marketplace')}
      </Link>
    </div>
  )
}
```

---

### 🔴 ERROR #2: Add to Cart Doesn't Validate Stock

**Issue:** `handleAddToCart` only checks `min_order_quantity` but doesn't validate against `available_quantity`.

**Risk:** Users can add more than available stock to cart

**Current Code:**
```javascript
const handleAddToCart = () => {
  if (product && quantity >= product.min_order_quantity) {
    addItem(product, quantity)
  }
}
```

**Fixed Code:**
```javascript
const handleAddToCart = () => {
  if (!product) return

  // Check if product is available
  if (!product.is_available) {
    toast.error(t('product.outOfStock', 'This product is out of stock'))
    return
  }

  // Check minimum order quantity
  if (quantity < product.min_order_quantity) {
    toast.error(
      t('product.minOrder', 'Minimum order is {{min}} {{unit}}', {
        min: product.min_order_quantity,
        unit: product.unit_type
      })
    )
    return
  }

  // Check available quantity
  if (product.available_quantity !== null && quantity > product.available_quantity) {
    toast.error(
      t('product.exceedsStock', 'Requested quantity exceeds available stock ({{max}} {{unit}})', {
        max: product.available_quantity,
        unit: product.unit_type
      })
    )
    return
  }

  addItem(product, quantity)
}
```

---

### 🔴 ERROR #3: Missing Error Boundary

**Issue:** No Error Boundary wrapping the Product Detail page.

**Risk:** Complete page crash on API failure

**Fixed Code:**
```javascript
import ErrorBoundary from '@/components/ErrorBoundary'

// Wrap export
const ProductDetailWithErrorBoundary = () => (
  <ErrorBoundary componentName="ProductDetailPage">
    <ProductDetailPage />
  </ErrorBoundary>
)

export default ProductDetailWithErrorBoundary
```

---

### 🔴 ERROR #4: No Structured Data (JSON-LD) for SEO

**Issue:** No JSON-LD structured data for product. This hurts Google search results, rich snippets, and shopping ads.

**Risk:** Poor SEO, no rich snippets in search results

**Fixed Code:**
```javascript
// Add useEffect for JSON-LD
useEffect(() => {
  if (!product) return

  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description || '',
    image: product.images?.map(img => img.url) || [],
    brand: {
      '@type': 'Brand',
      name: product.vendor?.store_name || product.vendor?.first_name || 'Unknown Vendor'
    },
    offers: {
      '@type': 'Offer',
      url: window.location.href,
      priceCurrency: 'MAD',
      price: product.price_per_unit,
      availability: product.is_available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      eligibleQuantity: product.min_order_quantity
        ? [{ '@type': 'QuantitativeValue', value: product.min_order_quantity, unitCode: product.unit_type }]
        : [],
      seller: {
        '@type': 'Organization',
        name: product.vendor?.store_name || product.vendor?.first_name || 'Unknown Vendor'
      }
    },
    aggregateRating: averageRating > 0
      ? {
          '@type': 'AggregateRating',
          ratingValue: averageRating.toFixed(1),
          reviewCount: reviews.length,
          bestRating: '5',
          worstRating: '1'
        }
      : undefined,
    category: product.category
  }

  // Remove existing JSON-LD if any
  const existingScript = document.querySelector('script[type="application/ld+json"]')
  if (existingScript) existingScript.remove()

  // Add new JSON-LD
  const script = document.createElement('script')
  script.type = 'application/ld+json'
  script.innerHTML = JSON.stringify(jsonLd)
  document.head.appendChild(script)

  // Cleanup on unmount
  return () => {
    script.remove()
  }
}, [product, averageRating, reviews])
```

---

### 🔴 ERROR #5: Reviews Not Lazy Loaded or Paginated

**Issue:** All reviews loaded at once with no pagination. If a product has 1000+ reviews, this will be slow.

**Risk:** Performance issues with many reviews

**Fixed Code:**
```javascript
const [reviewsPage, setReviewsPage] = useState(1)
const [reviewsLoading, setReviewsLoading] = useState(false)
const REVIEWS_PER_PAGE = 10
const [totalReviews, setTotalReviews] = useState(0)

const loadReviews = async (page = 1) => {
  if (!id) return

  setReviewsLoading(true)
  try {
    const from = (page - 1) * REVIEWS_PER_PAGE
    const to = from + REVIEWS_PER_PAGE - 1

    const { data, error, count } = await supabase
      .from('reviews')
      .select(`
        *,
        reviewer:profiles(id, first_name, last_name, avatar_url)
      `, { count: 'exact' })
      .eq('product_id', id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    setReviews(data || [])
    setTotalReviews(count || 0)
    setReviewsPage(page)

    // Calculate average rating (from all reviews, not just current page)
    if (count > 0) {
      const { data: allRatings } = await supabase
        .from('reviews')
        .select('rating')
        .eq('product_id', id)

      if (allRatings && allRatings.length > 0) {
        const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length
        setAverageRating(avg)
      }
    }
  } catch (error) {
    logger.error('Error loading reviews:', error)
  } finally {
    setReviewsLoading(false)
  }
}
```

---

### 🟡 ERROR #6: Breadcrumb Links Not Fully Translated

**Issue:** Breadcrumb has hardcoded English text ("Home", "Marketplace").

**Fixed Code:**
```jsx
<nav className="flex items-center gap-2 text-sm text-gray-500 mb-6" aria-label={t('product.breadcrumb', 'Breadcrumb')}>
  <Link to="/" className="hover:text-green-600">{t('nav.home', 'Home')}</Link>
  <span aria-hidden="true">/</span>
  <Link to="/marketplace" className="hover:text-green-600">{t('nav.marketplace', 'Marketplace')}</Link>
  {product.category && (
    <>
      <span aria-hidden="true">/</span>
      <Link to={`/marketplace?category=${product.category}`} className="hover:text-green-600 capitalize">
        {t(`product.categories.${product.category}`, product.category)}
      </Link>
    </>
  )}
  {product.subcategory && (
    <>
      <span aria-hidden="true">/</span>
      <Link to={`/marketplace?category=${product.category}&subcategory=${product.subcategory}`} className="hover:text-green-600 capitalize">
        {product.subcategory}
      </Link>
    </>
  )}
  <span aria-hidden="true">/</span>
  <span className="text-gray-900 truncate" aria-current="page">{product.name}</span>
</nav>
```

---

### 🟡 ERROR #7: Reviews Section Has Hardcoded Arabic Text

**Issue:** Reviews section mixes hardcoded Arabic text with English, inconsistent with rest of page.

**Fixed Code:**
```jsx
<h2 className="text-xl font-bold text-gray-900 mb-6">
  {t('product.reviews.title', 'Reviews')} ({reviews.length})
</h2>

{/* Rating Summary */}
<p className="text-sm text-gray-500">
  {reviews.length} {reviews.length === 1 ? t('product.reviews.review', 'review') : t('product.reviews.reviews', 'reviews')}
</p>

{/* Write Review */}
<h3 className="text-lg font-semibold text-gray-900 mb-4">{t('product.reviews.writeReview', 'Write a Review')}</h3>
<label className="block text-sm font-medium text-gray-700 mb-2">{t('product.reviews.rating', 'Rating')}</label>
<label className="block text-sm font-medium text-gray-700 mb-2">
  {t('product.reviews.comment', 'Comment (optional)')}
</label>
<textarea placeholder={t('product.reviews.commentPlaceholder', 'Share your experience with this product...')} />
<button disabled={submittingReview || userRating === 0}>
  {submittingReview ? t('product.reviews.submitting', 'Submitting...') : t('product.reviews.submit', 'Submit Review')}
</button>

{/* Login Required */}
<p className="text-blue-800">
  {t('product.reviews.loginRequired', 'You must')}{' '}
  <Link to="/login" className="font-semibold underline hover:text-blue-600">
    {t('product.reviews.login', 'log in')}
  </Link>
  {' '}{t('product.reviews.toReview', 'to write a review')}
</p>

{/* No Reviews */}
<div className="text-center py-8 text-gray-500">
  {t('product.reviews.noReviews', 'No reviews yet for this product')}
</div>
```

---

### 🟡 ERROR #8: Related Products Section Missing

**Issue:** No "Related Products" section at all. Should show products from same category.

**Fixed Code:**
```javascript
// Add state and effect
const [relatedProducts, setRelatedProducts] = useState([])
const [relatedLoading, setRelatedLoading] = useState(false)

useEffect(() => {
  if (product?.category) {
    loadRelatedProducts()
  }
}, [product?.category])

const loadRelatedProducts = async () => {
  if (!product?.category) return

  setRelatedLoading(true)
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        vendor:profiles(first_name, last_name, city, store_name, is_verified),
        images:product_images(url, is_primary)
      `)
      .eq('is_available', true)
      .eq('category', product.category)
      .neq('id', id) // Exclude current product
      .order('created_at', { ascending: false })
      .limit(4)

    if (error) throw error
    setRelatedProducts(data || [])
  } catch (error) {
    logger.error('Error loading related products:', error)
  } finally {
    setRelatedLoading(false)
  }
}

// Add to JSX (before closing </div>)
{relatedProducts.length > 0 && (
  <div className="mb-12">
    <h2 className="text-xl font-bold text-gray-900 mb-6">
      {t('product.related.title', 'Related Products')}
    </h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {relatedProducts.map((relatedProduct) => (
        <ProductCard key={relatedProduct.id} product={relatedProduct} />
      ))}
    </div>
  </div>
)}
```

---

### 🟡 ERROR #9: Image Gallery Missing Keyboard Navigation

**Issue:** Image gallery only works with mouse clicks, no keyboard arrow support.

**Fixed Code:**
```javascript
// Add keyboard navigation
const handleKeyDown = (e) => {
  if (allImages.length <= 1) return

  if (e.key === 'ArrowLeft') {
    setSelectedImage(prev => (prev === 0 ? allImages.length - 1 : prev - 1))
  } else if (e.key === 'ArrowRight') {
    setSelectedImage(prev => (prev === allImages.length - 1 ? 0 : prev + 1))
  }
}

// Add to main container
<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12" onKeyDown={handleKeyDown}>
```

---

### 🟡 ERROR #10: Features Section Hardcoded

**Issue:** "Fast Delivery" and "Quality Assured" text hardcoded, not using i18n.

**Fixed Code:**
```jsx
<div className="grid grid-cols-2 gap-3">
  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
    <TruckIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
    <div>
      <p className="text-sm font-medium text-gray-900">{t('product.features.fastDelivery', 'Fast Delivery')}</p>
      <p className="text-xs text-gray-500">{t('product.features.deliveryTime', '24-48 hours')}</p>
    </div>
  </div>
  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
    <ShieldCheckIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
    <div>
      <p className="text-sm font-medium text-gray-900">{t('product.features.qualityAssured', 'Quality Assured')}</p>
      <p className="text-xs text-gray-500">{t('product.features.verifiedVendor', 'Verified vendor')}</p>
    </div>
  </div>
</div>
```

---

### 🟡 ERROR #11: Page Title Not Set

**Issue:** Document title not updated with product name.

**Fixed Code:**
```javascript
useEffect(() => {
  if (product) {
    document.title = `${product.name} | Qotoof - قطوف`
  }
}, [product])
```

---

### 🟢 ERROR #12: Quantity Input Allows Invalid Values

**Issue:** User can manually type quantity that's not a multiple of min_order_quantity.

**Fixed Code:**
```javascript
<input
  type="number"
  value={quantity}
  onChange={(e) => {
    const val = parseInt(e.target.value)
    if (!isNaN(val) && val >= product.min_order_quantity) {
      // Round up to nearest multiple of min_order_quantity
      const adjusted = Math.ceil(val / product.min_order_quantity) * product.min_order_quantity
      setQuantity(Math.min(adjusted, product.available_quantity || adjusted))
    } else if (e.target.value === '') {
      setQuantity(product.min_order_quantity)
    }
  }}
  onBlur={() => {
    // Ensure quantity is valid on blur
    if (quantity < product.min_order_quantity) {
      setQuantity(product.min_order_quantity)
    }
    if (product.available_quantity && quantity > product.available_quantity) {
      setQuantity(product.available_quantity)
    }
  }}
  className="input w-24 text-center text-lg font-semibold"
  min={product.min_order_quantity}
  max={product.available_quantity || undefined}
  step={product.min_order_quantity}
  aria-label={t('product.quantity', 'Quantity')}
/>
```

---

### 🟢 ERROR #13: No Loading State for Reviews

**Issue:** Reviews section shows "No reviews" while loading instead of loading indicator.

**Fixed Code:**
```jsx
<div className="space-y-4">
  {reviewsLoading ? (
    <div className="flex items-center justify-center py-8">
      <LoadingSpinner size="md" />
    </div>
  ) : reviews.length === 0 ? (
    <div className="text-center py-8 text-gray-500">
      {t('product.reviews.noReviews', 'No reviews yet for this product')}
    </div>
  ) : (
    reviews.map((review) => (
      // ... review cards
    ))
  )}
</div>
```

---

### 🟢 ERROR #14: Subcategory Breadcrumb Links to Wrong URL

**Issue:** Subcategory breadcrumb links to `?category=${product.category}` instead of including subcategory.

**Current Code:**
```jsx
<Link to={`/marketplace?category=${product.category}`} className="hover:text-green-600 capitalize">
  {product.subcategory}
</Link>
```

**Fixed Code:**
```jsx
<Link to={`/marketplace?category=${product.category}&subcategory=${product.subcategory}`} className="hover:text-green-600 capitalize">
  {product.subcategory}
</Link>
```

---

### ⚪ ERROR #15: Image Thumbnails Missing aria-label

**Fixed Code:**
```jsx
<button
  key={img.id || index}
  onClick={() => setSelectedImage(index)}
  className={`aspect-square rounded-xl overflow-hidden border-2 transition-colors ${
    selectedImage === index ? 'border-green-500' : 'border-transparent hover:border-gray-300'
  }`}
  aria-label={t('product.imageThumbnail', 'View image {{num}}', { num: index + 1 })}
  aria-pressed={selectedImage === index}
>
  <img src={img.url} alt="" className="w-full h-full object-cover" />
</button>
```

---

### ⚪ ERROR #16: No Meta Description for Product

**Already covered by JSON-LD fix (#4).** Add meta description update:

```javascript
useEffect(() => {
  if (!product) return

  document.title = `${product.name} | Qotoof - قطوف`

  let metaDescription = document.querySelector('meta[name="description"]')
  if (!metaDescription) {
    metaDescription = document.createElement('meta')
    metaDescription.name = 'description'
    document.head.appendChild(metaDescription)
  }
  metaDescription.content = product.description || `${product.name} - ${product.category} available at Qotoof marketplace`
}, [product])
```

---

## ✅ What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| **Dynamic Route** | ✅ Working | `useParams()` extracts id correctly |
| **Supabase Query** | ✅ Optimized | Proper joins with vendor and images |
| **Image Gallery** | ✅ Working | Works with 1 or multiple images |
| **Cart Integration** | ⚠️ Partial | addItem works but stock validation missing |
| **Vendor Info** | ✅ Complete | Shows vendor details and location |
| **Map Integration** | ✅ Working | Shows vendor location on map |
| **Quantity Selector** | ✅ Working | Respects min_order_quantity |
| **Breadcrumb** | ⚠️ Partial | Links work but text not translated |

---

## 📝 Files to Modify

| File | Changes Required |
|------|------------------|
| `src/pages/ProductDetail.jsx` | 16 fixes (#1-#16) |
| `src/i18n/locales/en.json` | Add product translation keys |
| `src/i18n/locales/ar.json` | Add product translation keys |
| `src/i18n/locales/fr.json` | Add product translation keys |

---

## 🎯 Priority Fixes (Top 5)

If you only fix 5 things, fix these:

1. **Stock Validation (#2)** - Prevent overselling
2. **404 Handling (#1)** - Proper error state
3. **Error Boundary (#3)** - Prevent page crashes
4. **JSON-LD SEO (#4)** - Rich snippets in Google
5. **Related Products (#8)** - Keep users engaged

---

**End of Audit Report**
