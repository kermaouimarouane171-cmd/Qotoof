import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { formatPrice } from '@/utils/currency'
import { logger } from '@/utils/logger'
import { supabase } from '@/services/supabase'
import { createNegotiation } from '@/services/negotiationService'

export default function CreateNegotiation() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [proposedPrice, setProposedPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')

  const productId = new URLSearchParams(window.location.search).get('productId')

  const loadProduct = useCallback(async () => {
    if (!productId) {
      setLoading(false)
      return
    }
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, price_per_unit, unit_type, is_available, available_quantity,
          min_order_quantity, category, subcategory,
          product_images(url, is_primary),
          vendor:public_vendor_profiles!vendor_id(id, store_name, first_name, last_name, city)
        `)
        .eq('id', productId)
        .maybeSingle()

      if (error) throw error
      if (!data) {
        toast.error(t('negotiation.errors.productNotFound', 'Product not found'))
        navigate('/favorites')
        return
      }

      setProduct(data)
      setProposedPrice(String(data.price_per_unit))
      setQuantity(String(data.min_order_quantity || 1))
    } catch (err) {
      logger.error('Failed to load product for negotiation:', err)
      toast.error(err.message || t('negotiation.errors.loadFailed', 'Failed to load product'))
    } finally {
      setLoading(false)
    }
  }, [productId, navigate, t])

  useEffect(() => {
    loadProduct()
  }, [loadProduct])

  const handleSubmit = async () => {
    if (!user) {
      toast.error(t('common.loginRequired', 'Please sign in to continue'))
      navigate('/login', { state: { from: `/buyer/negotiations/new?productId=${productId}` } })
      return
    }

    if (!product) return

    if (profile && !profile.is_verified) {
      toast.error(t('negotiation.errors.phoneNotVerified', 'Phone verification required to create negotiations'))
      navigate('/buyer/settings/security')
      return
    }

    const price = Number(proposedPrice)
    const qty = Number(quantity)

    if (!price || price <= 0) {
      toast.error(t('negotiation.errors.invalidPrice', 'Invalid price'))
      return
    }

    if (!qty || qty <= 0) {
      toast.error(t('negotiation.errors.invalidQuantity', 'Invalid quantity'))
      return
    }

    setSubmitting(true)
    try {
      const result = await createNegotiation({
        productId: product.id,
        buyerId: user.id,
        vendorId: product.vendor_id,
        originalPrice: product.price_per_unit,
        proposedPrice: price,
        proposedQuantity: qty,
        buyerNote: note || null,
      })

      toast.success(t('negotiation.created', 'Negotiation offer sent'))
      navigate(`/buyer/negotiations/${result.id}`)
    } catch (err) {
      logger.error('Failed to create negotiation:', err)
      toast.error(err.message || t('negotiation.errors.createFailed', 'Failed to create negotiation'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <p className="text-red-600 mb-4">{t('negotiation.errors.productNotFound', 'Product not found')}</p>
          <Link to="/favorites" className="text-green-600 text-sm font-medium hover:underline">
            {t('favorites.title', 'My Favorites')}
          </Link>
        </Card>
      </div>
    )
  }

  const productImages = product.product_images || []
  const primaryImage = productImages.find(img => img.is_primary) || productImages[0]
  const vendorName = product.vendor?.store_name || `${product.vendor?.first_name || ''} ${product.vendor?.last_name || ''}`.trim()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link
        to="/favorites"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        {t('negotiation.backToFavorites', 'Back to Favorites')}
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {t('negotiation.createTitle', 'Negotiate Price')}
      </h1>

      <Card className="p-6 space-y-6">
        {/* Product Info */}
        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={product.name}
              className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-3xl flex-shrink-0">
              🌱
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{vendorName}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">
              {formatPrice(product.price_per_unit)}
              <span className="text-sm text-gray-400 font-normal"> /{product.unit_type}</span>
            </p>
          </div>
        </div>

        {/* Price Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('negotiation.yourPrice', 'Your Proposed Price')} (MAD)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={proposedPrice}
            onChange={(e) => setProposedPrice(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="0.00"
          />
          <p className="text-xs text-gray-400 mt-1">
            {t('negotiation.originalPrice', 'Original Price')}: {formatPrice(product.price_per_unit)} /{product.unit_type}
          </p>
        </div>

        {/* Quantity Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('negotiation.quantity', 'Quantity')} ({product.unit_type})
          </label>
          <input
            type="number"
            step="0.01"
            min={product.min_order_quantity || 1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="1"
          />
          {product.min_order_quantity > 1 && (
            <p className="text-xs text-gray-400 mt-1">
              {t('productDetail.purchase.minOrder', 'Min order')}: {product.min_order_quantity} {product.unit_type}
            </p>
          )}
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('negotiation.note', 'Note (optional)')}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder={t('negotiation.notePlaceholder', 'Add a note to the vendor...')}
          />
        </div>

        {/* Summary */}
        {proposedPrice && quantity && (
          <div className="rounded-xl bg-green-50 border border-green-100 p-4 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('negotiation.productTotal', 'Product Total')}</span>
              <span className="font-semibold text-gray-900">
                {formatPrice(Number(proposedPrice) * Number(quantity))}
              </span>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 py-3 px-4 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-3 px-4 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting
              ? t('common.sending', 'Sending...')
              : t('negotiation.sendOffer', 'Send Offer')}
          </button>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-gray-400 italic text-center">
          {t('negotiation.disclaimer', 'This is a non-binding offer until final approval and payment completion')}
        </p>
      </Card>
    </div>
  )
}
