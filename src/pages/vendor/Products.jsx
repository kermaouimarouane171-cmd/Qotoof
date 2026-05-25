import { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { runProductImageFallbackQuery } from '@/services/productImages'
import { Button, Card, Modal, Input, Map, LoadingSpinner, VendorAlerts, EmptyState, StateSkeleton as Skeleton } from '@/components/ui'
import InventoryManager from '@/components/vendor/InventoryManager'
import { ImageUploader } from '@/components/vendor/ProductForm'
import { formatPrice } from '@/utils/currency'
import { PlusIcon, PencilIcon, TrashIcon, ArrowUpTrayIcon, PhotoIcon, ExclamationTriangleIcon, DocumentArrowUpIcon, TagIcon } from '@heroicons/react/24/outline'
import { MAIN_CATEGORIES, getSuggestedSubcategories } from '@/constants/categories'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
// mammoth is loaded dynamically inside the DOCX upload handler — see parseBulkFile()

// Move lazy loading OUTSIDE the component to prevent re-mounting issues
const VendorLocationSetup = lazy(() => import('./LocationSetup'))

const VendorProducts = () => {
  const { profile } = useAuthStore()
  const { t } = useTranslation()
  
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [existingImages, setExistingImages] = useState([])
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [needsLocation, setNeedsLocation] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_per_unit: '',
    unit_type: 'kg',
    min_order_quantity: '1',
    available_quantity: '',
    category: 'vegetables',
    subcategory: '',
    is_available: true,
  })
  const [subcategoryInput, setSubcategoryInput] = useState('')
  const [showSubcategorySuggestions, setShowSubcategorySuggestions] = useState(false)
  const [_bulkFile, setBulkFile] = useState(null)
  const [bulkParsing, setBulkParsing] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })

  // Get suggested subcategories for current category
  const suggestedSubcategories = useMemo(() => {
    return getSuggestedSubcategories(formData.category)
  }, [formData.category])

  // Filter suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (!subcategoryInput) return suggestedSubcategories
    return suggestedSubcategories.filter(s =>
      s.toLowerCase().includes(subcategoryInput.toLowerCase())
    )
  }, [subcategoryInput, suggestedSubcategories])

  // Check if vendor has location set
  useEffect(() => {
    if (profile?.id) {
      if (!profile.latitude || !profile.longitude) {
        setNeedsLocation(true)
      } else {
        setNeedsLocation(false)
      }
    }
  }, [profile?.id, profile?.latitude, profile?.longitude])
  
  // Load products from Supabase
  const loadProducts = useCallback(async () => {
    if (!profile?.id) return
    
    setLoading(true)
    try {
      const buildQuery = (selectClause) => supabase
        .from('products')
        .select(selectClause)
        .eq('vendor_id', profile.id)
        .order('created_at', { ascending: false })

      const { data } = await runProductImageFallbackQuery({
        buildQuery,
        selectWithImages: `
          *,
          images:product_images(id, url, is_primary)
        `,
        selectWithoutImages: '*',
        onRelationError: (error) => logger.warn('Vendor products: product_images relation missing, hydrating separately', error),
      })

      setProducts(data || [])
    } catch (error) {
      logger.error('Error loading products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])
  
  useEffect(() => {
    loadProducts()
  }, [loadProducts])
  
  const resetForm = () => {
    setFormData({
      name: '',
      category: 'vegetables',
      subcategory: '',
      price_per_unit: '',
      unit_type: 'kg',
      min_order_quantity: '1',
      available_quantity: '',
      description: '',
      latitude: null,
      longitude: null,
    })
    setSubcategoryInput('')
    setShowSubcategorySuggestions(false)
    setEditingProduct(null)
    setImageFiles([])
    setImagePreviews([])
    setExistingImages([])
    setSelectedLocation(null)
  }

  const handleOpenModal = (product = null) => {
    if (product) {
      setEditingProduct(product)
      setFormData({
        name: product.name || '',
        category: product.category || 'vegetables',
        subcategory: product.subcategory || '',
        price_per_unit: product.price_per_unit?.toString() || '',
        unit_type: product.unit_type || 'kg',
        min_order_quantity: product.min_order_quantity?.toString() || '1',
        available_quantity: product.available_quantity?.toString() || '',
        description: product.description || '',
        latitude: product.latitude,
        longitude: product.longitude,
      })
      setSubcategoryInput(product.subcategory || '')
      setExistingImages(product.images || [])
      setSelectedLocation(
        product.latitude && product.longitude
          ? { lat: product.latitude, lng: product.longitude }
          : { lat: profile.latitude, lng: profile.longitude }
      )
    } else {
      resetForm()
      // Default to vendor's location
      if (profile.latitude && profile.longitude) {
        setSelectedLocation({ lat: profile.latitude, lng: profile.longitude })
      }
    }
    setModalOpen(true)
  }
  
  // Allowed image MIME types and extensions — whitelist approach
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
  const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

  const validateImageFile = (file) => {
    // Validate MIME type (can't be spoofed via filename alone)
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return `"${file.name}": نوع الملف غير مسموح. استخدم JPG أو PNG أو WebP فقط`
    }
    // Validate extension from whitelist
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      return `"${file.name}": امتداد الملف غير مسموح`
    }
    // Validate size
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return `"${file.name}": حجم الملف يتجاوز 5MB`
    }
    return null
  }

  const handleImagesAdded = (files, previews) => {
    if (files.length + imageFiles.length > 5) {
      toast.error('الحد الأقصى هو 5 صور لكل منتج')
      return
    }

    // Validate each file before accepting
    const validFiles = []
    for (const file of files) {
      const error = validateImageFile(file)
      if (error) {
        toast.error(error)
        continue
      }
      validFiles.push(file)
    }

    if (validFiles.length === 0) return

    setImageFiles((prev) => [...prev, ...validFiles])
    setImagePreviews((prev) => [...prev, ...previews])
  }
  
  const removeImage = (index) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index))
    setImagePreviews(imagePreviews.filter((_, i) => i !== index))
  }
  
  const removeExistingImage = async (imageId) => {
    try {
      const { error } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId)
      
      if (error) throw error
      setExistingImages(existingImages.filter(img => img.id !== imageId))
      toast.success('Image removed')
    } catch (_error) {
      toast.error('Failed to remove image')
    }
  }
  
  // Sanitize a text value: strip HTML tags and control characters to prevent Stored XSS
  const sanitizeText = (value) => {
    if (!value || typeof value !== 'string') return ''
    return value
      .replace(/<[^>]*>/g, '')       // Strip HTML tags
      .replace(/[^\p{L}\p{N}\s.,;:()\-'/+%]/gu, '') // Allow letters, numbers, common punctuation
      .trim()
      .substring(0, 500)             // Hard cap length
  }

  // Parse a line from bulk upload into a product object with validation and sanitization
  const parseBulkProduct = (parts) => {
    const name = sanitizeText(parts[0])
    if (!name) return null

    const price = parseFloat(parts[2])
    if (isNaN(price) || price <= 0) {
      toast.error(`منتج "${parts[0].substring(0, 30)}": السعر غير صالح — تم التخطي`)
      return null
    }

    const quantity = parseFloat(parts[3])
    if (isNaN(quantity) || quantity < 0) {
      toast.error(`منتج "${name}": الكمية غير صالحة — تم التخطي`)
      return null
    }

    return {
      name,
      category: sanitizeText(parts[1])?.toLowerCase() || 'vegetables',
      price_per_unit: price,
      available_quantity: quantity,
      unit_type: sanitizeText(parts[4]) || 'kg',
      description: sanitizeText(parts[5]) || name,
      min_order_quantity: 1,
    }
  }

  const uploadImages = async (productId) => {
    const uploadedUrls = []

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      // Use MIME type to determine safe extension — not the filename (prevents path traversal)
      const mimeToExt = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
      const safeExt = mimeToExt[file.type] || 'jpg'
      const fileName = `products/${productId}/${Date.now()}-${i}.${safeExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file)
      
      if (uploadError) {
        logger.error('Upload error:', uploadError)
        continue
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName)
      
      uploadedUrls.push({ url: publicUrl, is_primary: i === 0 && existingImages.length === 0 })
    }
    
    // Insert image records
    if (uploadedUrls.length > 0) {
      const { error } = await supabase
        .from('product_images')
        .insert(uploadedUrls.map(url => ({
          product_id: productId,
          url: url.url,
          is_primary: url.is_primary,
        })))
      
      if (error) logger.error('Error inserting images:', error)
    }
  }

  const handleBulkUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setBulkFile(file)
    setBulkParsing(true)
    setBulkProgress({ current: 0, total: 0, success: 0, failed: 0 })

    try {
      let products = []

      // Handle DOCX files
      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer()
        // Dynamic import: mammoth (~138 kB) only loads when a DOCX is uploaded
        const mammoth = await import('mammoth')
        const result = await mammoth.default.extractRawText({ arrayBuffer })
        const text = result.value

        // Parse text - expected format: one product per line
        // Format: Name | Category | Price | Quantity | Unit | Description
        const lines = text.split('\n').filter(line => line.trim())
        
        products = lines.map(line => {
          const parts = line.split('|').map(p => p.trim())
          if (parts.length >= 4) {
            return parseBulkProduct(parts)
          }
          return null
        }).filter(Boolean)
      }
      // Handle CSV files
      else if (file.name.endsWith('.csv')) {
        const text = await file.text()
        const lines = text.split('\n').filter(line => line.trim())

        // Skip header if exists
        const startIndex = lines[0]?.toLowerCase().includes('name') ? 1 : 0

        products = lines.slice(startIndex).map(line => {
          const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''))
          if (parts.length >= 4) {
            return parseBulkProduct(parts)
          }
          return null
        }).filter(Boolean)
      }
      // Handle TXT files
      else if (file.name.endsWith('.txt')) {
        const text = await file.text()
        const lines = text.split('\n').filter(line => line.trim())

        products = lines.map(line => {
          const parts = line.split('|').map(p => p.trim())
          if (parts.length >= 4) {
            return parseBulkProduct(parts)
          }
          return null
        }).filter(Boolean)
      } else {
        toast.error('نوع الملف غير مدعوم. استخدم DOCX أو CSV أو TXT')
        setBulkParsing(false)
        return
      }

      if (products.length === 0) {
        toast.error('لم يتم العثور على منتجات. تأكد من تنسيق الملف')
        setBulkParsing(false)
        return
      }

      setBulkProgress({ current: 0, total: products.length, success: 0, failed: 0 })

      // Upload products to Supabase
      let successCount = 0
      let failedCount = 0

      for (let i = 0; i < products.length; i++) {
        const product = products[i]
        setBulkProgress(prev => ({ ...prev, current: i + 1 }))

        try {
          const { error } = await supabase
            .from('products')
            .insert({
              vendor_id: profile.id,
              name: product.name,
              category: product.category,
              price_per_unit: product.price_per_unit,
              unit_type: product.unit_type,
              min_order_quantity: product.min_order_quantity,
              available_quantity: product.available_quantity,
              description: product.description,
              latitude: profile.latitude,
              longitude: profile.longitude,
              is_available: product.available_quantity > 0,
            })

          if (error) {
            logger.error(`Error uploading product ${product.name}:`, error)
            failedCount++
          } else {
            successCount++
          }
        } catch (error) {
          logger.error(`Error uploading product ${product.name}:`, error)
          failedCount++
        }

        setBulkProgress(prev => ({ ...prev, success: successCount, failed: failedCount }))
      }

      toast.success(`تم رفع ${successCount} منتج بنجاح. فشل ${failedCount} منتج.`)
      
      // Reset and close
      setBulkFile(null)
      setBulkParsing(false)
      setBulkProgress({ current: 0, total: 0, success: 0, failed: 0 })
      setBulkModalOpen(false)
      
      // Reload products
      await loadProducts()
    } catch (error) {
      logger.error('Error processing bulk upload:', error)
      toast.error('حدث خطأ أثناء معالجة الملف')
      setBulkParsing(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation - Accurate Product Description
    if (!formData.name.trim()) {
      toast.error('Product name is required')
      return
    }

    if (formData.name.trim().length < 3) {
      toast.error('Product name must be at least 3 characters')
      return
    }

    if (!formData.description.trim()) {
      toast.error('Product description is required - provide accurate details about quality, origin, and packaging')
      return
    }

    if (formData.description.trim().length < 10) {
      toast.error('Description too short - please provide accurate product details (min 10 characters)')
      return
    }

    // Validation - Accurate Pricing
    const price = parseFloat(formData.price_per_unit)
    const quantity = parseFloat(formData.available_quantity)
    const minOrder = parseFloat(formData.min_order_quantity) || 1

    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price in MAD')
      return
    }

    if (price > 100000) {
      toast.error('Price seems unusually high. Please verify your pricing complies with fair trade practices.')
      return
    }

    if (isNaN(quantity) || quantity < 0) {
      toast.error('Please enter a valid stock quantity')
      return
    }

    // Stock warning for low quantities
    if (quantity > 0 && quantity <= 10) {
      toast(`Low stock warning: Only ${quantity} ${formData.unit_type} listed. Buyers may be disappointed if stock runs out.`, { icon: '⚠️' })
    }

    // Out of stock warning
    if (quantity === 0 && editingProduct?.is_available) {
      toast('Setting quantity to 0 will mark this product as unavailable. Consider marking as "Out of Stock" instead.', { icon: '⚠️' })
    }

    setSubmitting(true)
    
    try {
      const productData = {
        vendor_id: profile.id,
        name: formData.name.trim(),
        category: formData.category,
        subcategory: subcategoryInput.trim() || null,
        price_per_unit: price,
        unit_type: formData.unit_type,
        min_order_quantity: minOrder,
        available_quantity: quantity,
        description: formData.description.trim(),
        latitude: selectedLocation?.lat || formData.latitude,
        longitude: selectedLocation?.lng || formData.longitude,
        is_available: false, // Will be set to true after admin approval
        approval_status: 'pending', // Requires admin approval before visible to buyers
      }

      if (editingProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)
        
        if (error) throw error
        
        // Upload new images
        if (imageFiles.length > 0) {
          await uploadImages(editingProduct.id)
        }
        
        toast.success('Product updated successfully!')
      } else {
        // Create new product
        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single()
        
        if (error) throw error
        
        // Upload images
        if (imageFiles.length > 0) {
          await uploadImages(data.id)
        }
        
        toast.success('Product added successfully!')
      }
      
      setModalOpen(false)
      resetForm()
      loadProducts()
    } catch (error) {
      logger.error('Error saving product:', error)
      toast.error(error.message || 'Failed to save product')
    } finally {
      setSubmitting(false)
    }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product? This cannot be undone.')) {
      return
    }
    
    try {
      // Delete images from storage first
      const { data: images } = await supabase
        .from('product_images')
        .select('url')
        .eq('product_id', id)
      
      if (images) {
        for (const img of images) {
          const path = img.url.split('/').slice(-2).join('/')
          await supabase.storage.from('product-images').remove([path])
        }
      }
      
      // Delete product (images will be cascade deleted)
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      toast.success('Product deleted')
      loadProducts()
    } catch (error) {
      logger.error('Error deleting product:', error)
      toast.error('Failed to delete product')
    }
  }
  
  const handleLocationSelect = (latlng) => {
    setSelectedLocation(latlng)
  }
  
  if (needsLocation) {
    return (
      <Suspense fallback={<LoadingSpinner size="lg" />}>
        <VendorLocationSetup onComplete={() => setNeedsLocation(false)} />
      </Suspense>
    )
  }
  
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => <Skeleton.Card key={index} />)}
        </div>
      </div>
    )
  }
  
  return (
    <div>
      {/* Vendor Alerts */}
      <div className="mb-6">
        <VendorAlerts />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Products</h1>
          <p className="text-gray-500 mt-1">{products.length} products listed</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" leftIcon={<ArrowUpTrayIcon className="w-5 h-5" />} onClick={() => setBulkModalOpen(true)}>
            Bulk Upload
          </Button>
          <Button variant="primary" leftIcon={<PlusIcon className="w-5 h-5" />} onClick={() => handleOpenModal()}>
            Add Product
          </Button>
        </div>
      </div>

      {/* Compliance Notice */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Vendor Compliance Reminder</p>
            <p className="text-blue-700">
              Ensure all product descriptions are accurate, prices are fair, and stock levels are up-to-date. 
              Non-compliance with Moroccan consumer protection laws (Law 31-08) may result in penalties.
            </p>
          </div>
        </div>
      </div>

      <InventoryManager vendorId={profile?.id} onInventoryChange={loadProducts} />
      
      {/* Products Table */}
      <Card>
        {products.length === 0 ? (
          <EmptyState
            icon="products"
            title={t('vendor.products.emptyTitle', 'No products yet')}
            description={t('vendor.products.emptyDescription', 'Add your first product to start selling')}
            actionLabel={t('vendor.products.addFirst', 'Add Your First Product')}
            onAction={() => handleOpenModal()}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {product.images?.[0] ? (
                          <img src={product.images[0].url} alt={product.name} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <PhotoIcon className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <span className="font-medium">{product.name}</span>
                      </div>
                    </td>
                    <td className="capitalize">{product.category}</td>
                    <td>{formatPrice(product.price_per_unit)}/{product.unit_type}</td>
                    <td>{product.available_quantity?.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${product.is_available ? 'badge-primary' : 'badge-danger'}`}>
                        {product.is_available ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenModal(product)}
                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      
      {/* Add/Edit Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          resetForm()
        }}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Product Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Fresh Organic Tomatoes"
            required
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="vendor-product-category" className="input-label">Category</label>
              <select
                id="vendor-product-category"
                value={formData.category}
                onChange={(e) => {
                  setFormData({ ...formData, category: e.target.value, subcategory: '' })
                  setSubcategoryInput('')
                  setShowSubcategorySuggestions(false)
                }}
                className="input"
              >
                {MAIN_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.emoji} {cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subcategory Input with Autocomplete */}
          <div className="relative">
            <label htmlFor="vendor-product-subcategory" className="input-label flex items-center gap-1">
              <TagIcon className="w-4 h-4 text-gray-400" />
              Subcategory
              <span className="text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="vendor-product-subcategory"
              type="text"
              value={subcategoryInput}
              onChange={(e) => {
                setSubcategoryInput(e.target.value)
                setShowSubcategorySuggestions(true)
              }}
              onFocus={() => setShowSubcategorySuggestions(true)}
              onBlur={() => {
                // Delay closing to allow click on suggestion
                setTimeout(() => setShowSubcategorySuggestions(false), 200)
              }}
              placeholder={`e.g., ${suggestedSubcategories[0] || 'Tomatoes'}`}
              className="input"
            />

            {/* Suggestions Dropdown */}
            {showSubcategorySuggestions && suggestedSubcategories.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {filteredSuggestions.length > 0 ? (
                  filteredSuggestions.map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setSubcategoryInput(suggestion)
                        setShowSubcategorySuggestions(false)
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 transition-colors ${
                        subcategoryInput === suggestion ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2.5 text-sm text-gray-400">
                    Type to add custom subcategory or select from suggestions
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="vendor-product-unit-type" className="input-label">Unit Type</label>
              <select
                id="vendor-product-unit-type"
                value={formData.unit_type}
                onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                className="input"
              >
                <option value="kg">Kilogram (kg)</option>
                <option value="ton">Ton</option>
                <option value="piece">Piece</option>
                <option value="box">Box</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Price per Unit ($)"
              type="number"
              step="0.01"
              min="0"
              value={formData.price_per_unit}
              onChange={(e) => setFormData({ ...formData, price_per_unit: e.target.value })}
              placeholder="0.00"
              required
            />
            <Input
              label="Available Quantity"
              type="number"
              min="0"
              value={formData.available_quantity}
              onChange={(e) => setFormData({ ...formData, available_quantity: e.target.value })}
              placeholder="1000"
              required
            />
            <Input
              label="Min Order"
              type="number"
              min="1"
              value={formData.min_order_quantity}
              onChange={(e) => setFormData({ ...formData, min_order_quantity: e.target.value })}
              placeholder="1"
            />
          </div>
          
          <div>
            <label htmlFor="vendor-product-description" className="input-label">Description</label>
            <textarea
              id="vendor-product-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input h-24 resize-none"
              placeholder="Describe your product quality, origin, packaging..."
            />
          </div>
          
          {/* Image Upload */}
          <ImageUploader
            existingImages={existingImages}
            newFiles={imageFiles}
            previews={imagePreviews}
            onAddFiles={handleImagesAdded}
            onRemoveNewImage={removeImage}
            onRemoveExistingImage={removeExistingImage}
          />
          
          {/* Location Map */}
          <div>
            <p className="input-label">Product Location (optional)</p>
            <p className="text-xs text-gray-500 mb-2">Click on the map to set product location</p>
            <Map
              center={selectedLocation || [33.5731, -7.5898]}
              zoom={selectedLocation ? 14 : 6}
              onLocationSelect={handleLocationSelect}
              height="200px"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setModalOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" isLoading={submitting}>
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </form>
      </Modal>
      
      {/* Bulk Upload Modal */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="رفع منتجات جملة"
      >
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <DocumentArrowUpIcon className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">رفع ملف المنتجات</h3>
            <p className="text-gray-500 mb-4">
              اختر ملف يحتوي على قائمة المنتجات بصيغة DOCX أو CSV أو TXT
            </p>
            
            {/* Format Guide */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
              <h4 className="font-semibold text-blue-900 mb-2">تنسيق الملف المطلوب:</h4>
              <p className="text-sm text-blue-800 mb-2">
                كل سطر يمثل منتج واحد بالتنسيق التالي:
              </p>
              <code className="block bg-white p-2 rounded text-xs">
                الاسم | الفئة | السعر | الكمية | الوحدة | الوصف
              </code>
              <p className="text-sm text-blue-800 mt-2">
                مثال: طماطم عضوية | خضروات | 15 | 100 | kg | طماطم طازجة من المزرعة
              </p>
            </div>

            <label className="btn-primary cursor-pointer inline-flex items-center gap-2">
              <input
                type="file"
                accept=".docx,.csv,.txt"
                className="hidden"
                onChange={handleBulkUpload}
                disabled={bulkParsing}
              />
              <DocumentArrowUpIcon className="w-5 h-5" />
              {bulkParsing ? 'جاري المعالجة...' : 'اختيار ملف'}
            </label>
            <p className="text-xs text-gray-400 mt-4">
              الصيغ المدعومة: DOCX, CSV, TXT
            </p>
          </div>

          {/* Progress Bar */}
          {bulkProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>التقدم</span>
                <span>{bulkProgress.current} / {bulkProgress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600">✓ نجح: {bulkProgress.success}</span>
                <span className="text-red-600">✗ فشل: {bulkProgress.failed}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default VendorProducts
