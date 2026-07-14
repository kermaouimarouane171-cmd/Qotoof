// ============================================
// Catalog Module — UI Public API
// Re-exports product-related UI components and pages.
// No files were moved — this is a re-export layer.
// ============================================

// Product card component (reusable catalog component)
export { default as ProductCard } from '@/components/ui/ProductCard'

// Product form with image uploader (vendor product creation/editing)
export { default as ProductForm } from '@/components/vendor/ProductForm'
export { ImageUploader } from '@/components/vendor/ProductForm'

// Product detail page
export { default as ProductDetailPage } from '@/pages/ProductDetail'

// Vendor product management page
export { default as VendorProductsPage } from '@/pages/vendor/Products'

// Admin product moderation page
export { default as AdminProductsPage } from '@/pages/admin/Products'
