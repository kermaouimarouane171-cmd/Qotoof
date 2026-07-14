import { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { runProductImageFallbackQuery } from '@/modules/catalog'
import { Button, Card, Modal, Input, Map, LoadingSpinner, EmptyState, StateSkeleton as Skeleton, Logo } from '@/components/ui'
import { useMapCenter } from '@/hooks/useMapCenter'
import ImageUploader from '@/components/vendor/ProductForm'
import { formatPrice } from '@/utils/currency'
import { PlusIcon, PhotoIcon, ExclamationTriangleIcon, DocumentArrowUpIcon, TagIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { MAIN_CATEGORIES, getSuggestedSubcategories, getCategoryLabel } from '@/constants/categories'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { isPayPalSetupComplete } from '@/utils/paypalEligibility'
// mammoth is loaded dynamically inside the DOCX upload handler — see parseBulkFile()

// Move lazy loading OUTSIDE the component to prevent re-mounting issues
const VendorLocationSetup = lazy(() => import('./LocationSetup'))

const VendorProducts = () => {
  const { profile } = useAuthStore()
  const { t, i18n } = useTranslation()
  
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [imageFiles, setImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [existingImages, setExistingImages] = useState([])
  const [selectedLocation, setSelectedLocation] = useState(null)
  const productMapCenter = useMapCenter({
    lat: selectedLocation?.lat,
    lng: selectedLocation?.lng,
    city: profile?.city,
  })
  const [needsLocation, setNeedsLocation] = useState(false)
  const [rejectionReasonProduct, setRejectionReasonProduct] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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

  // Get suggested subcategories for current category (localized)
  const currentLang = i18n.resolvedLanguage || i18n.language || 'en'
  const suggestedSubcategories = useMemo(() => {
    return getSuggestedSubcategories(formData.category, currentLang)
  }, [formData.category, currentLang])

  // Filter suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (!subcategoryInput) return suggestedSubcategories
    return suggestedSubcategories.filter(s =>
      s.toLowerCase().includes(subcategoryInput.toLowerCase())
    )
  }, [subcategoryInput, suggestedSubcategories])

  const STATUS_FILTERS = [
    { key: 'all', label: t('vendor.products.filters.all', 'الكل') },
    { key: 'pending', label: t('vendor.products.filters.pending', 'قيد المراجعة') },
    { key: 'published', label: t('vendor.products.filters.published', 'نشط') },
    { key: 'rejected', label: t('vendor.products.filters.rejected', 'مرفوض') },
    { key: 'suspended', label: t('vendor.products.filters.suspended', 'غير متوفر') },
  ]

  const statusBadgeClasses = {
    pending: 'bg-yellow-100 text-yellow-800',
    published: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    suspended: 'bg-gray-100 text-gray-600',
    inactive: 'bg-gray-100 text-gray-600',
  }

  const getStatusBadgeLabel = (status) => {
    if (status === 'pending') return t('vendor.products.status.pending', 'قيد المراجعة')
    if (status === 'published') return t('vendor.products.status.active', 'نشط')
    if (status === 'rejected') return t('vendor.products.status.rejected', 'مرفوض')
    if (status === 'suspended') return t('vendor.products.status.unavailable', 'غير متوفر')
    return status === 'active' ? t('vendor.products.status.active', 'نشط') : t('vendor.products.status.inactive', 'غير متوفر')
  }

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return products.filter((product) => {
      const matchesQuery =
        !query ||
        product.name?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.category?.toLowerCase().includes(query) ||
        product.subcategory?.toLowerCase().includes(query)

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && product.approval_status === 'published') ||
        product.approval_status === statusFilter

      return matchesQuery && matchesStatus
    })
  }, [products, searchQuery, statusFilter])

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
    
    setLoadError(null)
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
      toast.error(t('vendor.products.errors.loadFailed', 'Failed to load products'))
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [profile?.id])
  
  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  // Realtime: listen for approval_status changes on vendor's own products
  useEffect(() => {
    if (!profile?.id) return

    const channel = supabase
      .channel(`vendor-product-approvals:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `vendor_id=eq.${profile.id}`,
        },
        (payload) => {
          const updated = payload.new
          const prev    = payload.old

          if (updated.approval_status !== prev.approval_status) {
            if (updated.approval_status === 'published') {
              toast.success(
                `تمت الموافقة على منتج “${updated.name}” — هو الآن ظاهر للمشترين`,
                { duration: 6000 }
              )
            } else if (updated.approval_status === 'rejected') {
              toast.error(
                t('vendor.products.errors.productRejected', 'تم رفض منتج “{{name}}” — اضغط للاطلاع على السبب', { name: updated.name }),
                { duration: 8000 }
              )
            } else if (updated.approval_status === 'suspended') {
              toast(t('vendor.products.warnings.productSuspended', 'تم تعليق منتج “{{name}}” مؤقتاً من قبل الإدارة', { name: updated.name }), { icon: '⚠️', duration: 6000 })
            }

            // Refresh the local list to reflect the new status immediately
            setProducts((prev) =>
              prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id])
  
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
      return t('vendor.products.errors.unsupportedImageType', '"{{filename}}": نوع الملف غير مسموح. استخدم JPG أو PNG أو WebP فقط', { filename: file.name })
    }
    // Validate extension from whitelist
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      return t('vendor.products.errors.unsupportedImageExtension', '"{{filename}}": امتداد الملف غير مسموح', { filename: file.name })
    }
    // Validate size
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return t('vendor.products.errors.imageTooLarge', '"{{filename}}": حجم الملف يتجاوز 5MB', { filename: file.name })
    }
    return null
  }

  const handleImagesAdded = (files, previews) => {
    if (files.length + imageFiles.length > 5) {
      toast.error(t('vendor.products.errors.maxImages', 'الحد الأقصى هو 5 صور لكل منتج'))
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
      toast.success(t('vendor.products.success.imageRemoved', 'Image removed'))
    } catch (_error) {
      toast.error(t('vendor.products.errors.imageRemoveFailed', 'Failed to remove image'))
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
      toast.error(t('vendor.products.errors.bulkInvalidPrice', 'منتج "{{name}}": السعر غير صالح — تم التخطي', { name: parts[0].substring(0, 30) }))
      return null
    }

    const quantity = parseFloat(parts[3])
    if (isNaN(quantity) || quantity < 0) {
      toast.error(t('vendor.products.errors.bulkInvalidQuantity', 'منتج "{{name}}": الكمية غير صالحة — تم التخطي', { name }))
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
      if (!isPayPalSetupComplete(profile)) {
        toast.error(t('vendor.products.errors.paypalRequired', 'يجب إكمال إعداد PayPal والتحقق منه قبل إضافة المنتجات'))
        setBulkParsing(false)
        return
      }

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
        toast.error(t('vendor.products.errors.unsupportedFileType', 'نوع الملف غير مدعوم. استخدم DOCX أو CSV أو TXT'))
        setBulkParsing(false)
        return
      }

      if (products.length === 0) {
        toast.error(t('vendor.products.errors.noProductsFound', 'لم يتم العثور على منتجات. تأكد من تنسيق الملف'))
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

      toast.success(t('vendor.products.success.bulkUploaded', 'تم رفع {{success}} منتج بنجاح. فشل {{failed}} منتج.', { success: successCount, failed: failedCount }))
      
      // Reset and close
      setBulkFile(null)
      setBulkParsing(false)
      setBulkProgress({ current: 0, total: 0, success: 0, failed: 0 })
      setBulkModalOpen(false)
      
      // Reload products
      await loadProducts()
    } catch (error) {
      logger.error('Error processing bulk upload:', error)
      toast.error(t('vendor.products.errors.fileProcessingError', 'حدث خطأ أثناء معالجة الملف'))
      setBulkParsing(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isPayPalSetupComplete(profile)) {
      toast.error(t('vendor.products.errors.paypalRequired', 'يجب إكمال إعداد PayPal والتحقق منه قبل إضافة المنتجات'))
      return
    }

    // Validation - Accurate Product Description
    if (!formData.name.trim()) {
      toast.error(t('vendor.products.errors.productNameRequired', 'اسم المنتج مطلوب'))
      return
    }

    if (formData.name.trim().length < 3) {
      toast.error(t('vendor.products.errors.productNameTooShort', 'اسم المنتج يجب أن يكون 3 أحرف على الأقل'))
      return
    }

    if (!formData.description.trim()) {
      toast.error(t('vendor.products.errors.descriptionRequired', 'يجب إضافة وصف للمنتج يتضمن جودة وأصل ونوعية التغليف'))
      return
    }

    if (formData.description.trim().length < 10) {
      toast.error(t('vendor.products.errors.descriptionTooShort', 'الوصف قصير جداً — يرجى توفير وصف دقيق (10 أحرف على الأقل)'))
      return
    }

    // Validation - Accurate Pricing
    const price = parseFloat(formData.price_per_unit)
    const quantity = parseFloat(formData.available_quantity)
    const minOrder = parseFloat(formData.min_order_quantity) || 1

    if (isNaN(price) || price <= 0) {
      toast.error(t('vendor.products.errors.invalidPrice', 'يجب إدخال سعر صحيح بالدرهم المغربي'))
      return
    }

    if (price > 100000) {
      toast.error(t('vendor.products.errors.priceTooHigh', 'السعر يبدو مرتفعاً جداً. يرجى التحقق من توافق التسعير مع ممارسات التجارة العادلة.'))
      return
    }

    if (isNaN(quantity) || quantity < 0) {
      toast.error(t('vendor.products.errors.invalidQuantity', 'يجب إدخال كمية صحيحة'))
      return
    }

    // Stock warning for low quantities
    if (quantity > 0 && quantity <= 10) {
      toast(t('vendor.products.warnings.lowStock', '⚠️ تحذير: المخزون منخفض فقط {{quantity}} {{unit}}. قد يخيب آمال المشترين إذا نفد المخزون.', { quantity, unit: formData.unit_type }), { duration: 5000 })
    }

    // Out of stock warning
    if (quantity === 0 && editingProduct?.is_available) {
      toast(t('vendor.products.warnings.outOfStock', '⚠️ تعيين الكمية إلى 0 سيجعل هذا المنتج غير متوفر.'), { duration: 5000 })
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
        is_available: false, // Will be set to true after admin approval
        approval_status: 'pending', // Requires admin approval before visible to buyers
      }

      // Only include location columns if they have values
      // (columns were added in migration 20260711000013; defensive against missing columns)
      const lat = selectedLocation?.lat || formData.latitude
      const lng = selectedLocation?.lng || formData.longitude
      if (lat != null && lng != null) {
        productData.latitude = lat
        productData.longitude = lng
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
        
        toast.success(t('vendor.products.success.productUpdated', 'تم تحديث المنتج بنجاح!'))
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
        
        toast.success(
          t('vendor.products.success.productSubmitted', 'تم إرسال المنتج للمراجعة. سيظهر بعد موافقة الإدارة خلال 24 ساعة.'),
          { duration: 6000 }
        )
      }
      
      setModalOpen(false)
      resetForm()
      loadProducts()
    } catch (error) {
      logger.error('Error saving product:', error)
      toast.error(error.message || t('vendor.products.errors.saveFailed', 'حدث خطأ أثناء حفظ المنتج'))
    } finally {
      setSubmitting(false)
    }
  }
  
  const handleDelete = async (id) => {
    if (!confirm('هل تريد فعلاً حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.')) {
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
      toast.success(t('vendor.products.success.productDeleted', 'تم حذف المنتج بنجاح'))
      loadProducts()
    } catch (error) {
      logger.error('Error deleting product:', error)
      toast.error(t('vendor.products.errors.deleteFailed', 'حدث خطأ أثناء حذف المنتج'))
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

  if (loadError && products.length === 0) {
    return (
      <Card>
        <EmptyState
          title={t('vendor.products.errorTitle', 'Unable to load products')}
          description={t('vendor.products.errorDescription', 'There was a problem loading your product list. Please try again.')}
          actionLabel={t('vendor.products.retry', 'Retry')}
          onAction={loadProducts}
        />
      </Card>
    )
  }
  
  // Calculate statistics
  const stats = {
    total: products.length,
    active: products.filter(p => p.approval_status === 'published').length,
    pending: products.filter(p => p.approval_status === 'pending').length,
    rejected: products.filter(p => p.approval_status === 'rejected').length,
    unavailable: products.filter(p => p.approval_status === 'suspended').length,
  }

  return (
    <>
      {/* Pending-approval banner */}
      {(() => {
        const pendingCount = products.filter((p) => p.approval_status === 'pending').length
        if (!pendingCount) return null
        return (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-yellow-300 bg-yellow-50 p-4">
            <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              {t(
                'vendor.products.pendingBanner',
                'لديك {{count}} منتج قيد مراجعة الأدمن — ستظهر للمشترين بعد الموافقة عليها',
                { count: pendingCount }
              )}
            </p>
          </div>
        )
      })()}

      {/* Header with Logo and Title */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Logo size="lg" showText={false} />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 text-right">إدارة المنتجات</h1>
            <p className="text-gray-500 text-right text-sm">نظّم منتجات متجرك بسهولة</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 text-gray-400 -translate-y-1/2 rtl:left-auto rtl:right-3" />
          <Input
            className="pl-11 rtl:pl-0 rtl:pr-11 text-right"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن منتج..."
            dir="rtl"
          />
        </div>
      </div>

      {/* Add Product Button */}
      <div className="mb-6">
        <Button 
          variant="primary" 
          leftIcon={<PlusIcon className="w-5 h-5" />} 
          onClick={() => handleOpenModal()}
          className="rounded-2xl px-6 py-3"
        >
          + إضافة منتج
        </Button>
      </div>

      {/* Status Filters */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 justify-start rtl:justify-end">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setStatusFilter(option.key)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                statusFilter === option.key
                  ? 'border-green-600 bg-green-100 text-green-800'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">إجمالي المنتجات</p>
              <p className="text-3xl font-bold text-green-600">{stats.total}</p>
            </div>
            <div className="text-4xl">📦</div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">النشطة</p>
              <p className="text-3xl font-bold text-green-600">{stats.active}</p>
            </div>
            <div className="text-4xl">✅</div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">تحتاج مراجعة</p>
              <p className="text-3xl font-bold text-orange-500">{stats.pending}</p>
            </div>
            <div className="text-4xl">⏱️</div>
          </div>
        </div>
      </div>

      <Card>
        {products.length === 0 ? (
          <EmptyState
            icon="products"
            title={t('vendor.products.emptyTitle', 'لم تضف أي منتج بعد')}
            description={t('vendor.products.emptyDescription', 'ابدأ بإضافة أول منتج إلى متجرك')}
            actionLabel={t('vendor.products.addFirst', 'إضافة منتج')}
            onAction={() => handleOpenModal()}
          />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon="products"
            title={t('vendor.products.filterEmptyTitle', 'لم يتم العثور على منتجات')}
            description={t('vendor.products.filterEmptyDescription', 'جرّب تغيير الفلاتر أو البحث')}
            actionLabel={t('vendor.products.clearFilters', 'إظهار الكل')}
            onAction={() => {
              setSearchQuery('')
              setStatusFilter('all')
            }}
          />
        ) : (
          <div className="grid gap-4 grid-cols-1">
            {filteredProducts.map((product) => (
              <div 
                key={product.id} 
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white hover:shadow-md transition"
              >
                {/* Product Card Header with Image and Info */}
                <div className="flex flex-col sm:flex-row gap-4 p-4">
                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.name}
                        className="h-32 w-full sm:h-32 sm:w-32 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-32 w-full sm:h-32 sm:w-32 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
                        <PhotoIcon className="h-8 w-8" />
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">{getCategoryLabel(product.category, currentLang)}{product.subcategory ? ` • ${product.subcategory}` : ''}</p>
                        <h2 className="text-lg font-semibold text-gray-900 text-right">{product.name}</h2>
                      </div>
                      <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${statusBadgeClasses[product.approval_status || (product.is_available ? 'active' : 'inactive')] || 'bg-gray-100 text-gray-600'}`}>
                        {getStatusBadgeLabel(product.approval_status || (product.is_available ? 'active' : 'inactive'))}
                      </span>
                    </div>

                    {/* Price and Stock */}
                    <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
                      <span className="font-bold text-lg text-green-600">{formatPrice(product.price_per_unit)}</span>
                      <span className="text-gray-500">/{product.unit_type}</span>
                      <span className="text-gray-500 ml-auto">✓ متوفر {product.available_quantity?.toLocaleString()} {product.unit_type}</span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-600 text-right line-clamp-2">{product.description || t('vendor.products.noDescription', 'لا توجد وصف')}</p>
                  </div>
                </div>

                {/* Rejected Product Warning */}
                {product.approval_status === 'rejected' && (
                  <div className="border-t border-gray-200 bg-red-50 p-4">
                    <div className="flex items-start gap-2">
                      <span className="text-red-500">❌</span>
                      <div className="flex-1 text-right">
                        <p className="font-semibold text-red-700 text-sm mb-1">سبب الرفض</p>
                        <p className="text-red-600 text-sm">{product.rejection_reason || t('vendor.products.noReasonProvided', 'لم يتم تحديد سبب')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="border-t border-gray-200 bg-gray-50 p-4 flex flex-wrap gap-2 justify-end">
                  {product.approval_status === 'rejected' && (
                    <button
                      type="button"
                      onClick={() => handleOpenModal(product)}
                      className="inline-flex items-center gap-2 rounded-xl bg-red-100 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-200"
                    >
                      🔄 تعديل وإعادة الإرسال
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenModal(product)}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(product.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                  >
                    🗑️ حذف
                  </button>
                </div>
              </div>
            ))}
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
        title={editingProduct ? 'تعديل المنتج' : 'إضافة منتج'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
          <Input
            label="اسم المنتج"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="مثلاً: طماطم عضوية طازجة"
            required
            dir="rtl"
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="vendor-product-category" className="input-label">الفئة</label>
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
                  <option key={cat.id} value={cat.id}>{cat.emoji} {getCategoryLabel(cat.id, currentLang)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Subcategory Input with Autocomplete */}
          <div className="relative">
            <label htmlFor="vendor-product-subcategory" className="input-label flex items-center gap-1">
              <TagIcon className="w-4 h-4 text-gray-400" />
              الفئة الفرعية
              <span className="text-xs text-gray-400 font-normal">(اختياري)</span>
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
              placeholder={`مثلاً: ${suggestedSubcategories[0] || 'طماطم'}`}
              className="input"
              dir="rtl"
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
                      className={`w-full text-right px-4 py-2.5 text-sm hover:bg-green-50 transition-colors ${
                        subcategoryInput === suggestion ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700'
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2.5 text-sm text-gray-400 text-right">
                    اكتب لإضافة فئة فرعية مخصصة أو حدد من الاقتراحات
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="vendor-product-unit-type" className="input-label">وحدة القياس</label>
              <select
                id="vendor-product-unit-type"
                value={formData.unit_type}
                onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })}
                className="input"
              >
                <option value="kg">كيلوغرام (كغ)</option>
                <option value="ton">طن</option>
                <option value="piece">قطعة</option>
                <option value="box">صندوق</option>
              </select>
            </div>
          </div>
          
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-gray-900 text-right">السعر والمخزون</p>
              <p className="text-xs text-gray-500 text-right">جميع الأسعار بالدرهم المغربي (د.م)</p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="السعر لكل وحدة (د.م)"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_per_unit}
                onChange={(e) => setFormData({ ...formData, price_per_unit: e.target.value })}
                placeholder="12.50"
                required
                dir="rtl"
              />
              <Input
                label="الكمية المتاحة"
                type="number"
                min="0"
                value={formData.available_quantity}
                onChange={(e) => setFormData({ ...formData, available_quantity: e.target.value })}
                placeholder="1000"
                required
                dir="rtl"
              />
              <Input
                label="الحد الأدنى للطلب"
                type="number"
                min="1"
                value={formData.min_order_quantity}
                onChange={(e) => setFormData({ ...formData, min_order_quantity: e.target.value })}
                placeholder="1"
                dir="rtl"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="vendor-product-description" className="input-label text-right">الوصف</label>
            <textarea
              id="vendor-product-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input h-24 resize-none text-right"
              placeholder="صف جودة المنتج والأصل والتغليف..."
              dir="rtl"
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
            <p className="input-label text-right">موقع المنتج (اختياري)</p>
            <p className="text-xs text-gray-500 text-right mb-2">انقر على الخريطة لتعيين موقع المنتج</p>
            <Map
              center={productMapCenter}
              zoom={selectedLocation ? 14 : 12}
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
              إلغاء
            </Button>
            <Button type="submit" variant="primary" className="flex-1" isLoading={submitting}>
              {editingProduct ? 'تحديث المنتج' : 'إضافة المنتج'}
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

      {/* Rejection Reason Modal */}
      <Modal
        isOpen={Boolean(rejectionReasonProduct)}
        onClose={() => setRejectionReasonProduct(null)}
        title={t('vendor.products.rejectionReasonTitle', 'سبب رفض المنتج')}
        size="sm"
      >
        {rejectionReasonProduct && (
          <div className="space-y-3 text-sm" dir="rtl">
            <p className="font-medium text-gray-800">{rejectionReasonProduct.name}</p>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
              {rejectionReasonProduct.rejection_reason ||
                t('vendor.products.noReasonProvided', 'لم يُحدد سبب من قبل الأدمن')}
            </div>
            <p className="text-gray-500 text-xs">
              {t('vendor.products.rejectionHint', 'يمكنك تعديل المنتج وإعادة إرساله للمراجعة.')}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setRejectionReasonProduct(null)
                  handleOpenModal(rejectionReasonProduct)
                }}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
              >
                {t('vendor.products.editProduct', 'تعديل المنتج')}
              </button>
              <button
                onClick={() => setRejectionReasonProduct(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t('common.close', 'إغلاق')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export default VendorProducts
