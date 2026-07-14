import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { Card, LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { getPayPalClientId } from '@/lib/config'
import { logger } from '@/utils/logger'
import OfferCard from '@/components/negotiations/OfferCard'
import {
  fetchNegotiation,
  counterNegotiation,
  acceptNegotiation,
  subscribeToNegotiation,
  expireStaleNegotiations,
  NEGOTIATION_STATUS,
  NEGOTIATION_MAX_ROUNDS,
} from '@/services/negotiationService'
import { supabase } from '@/services/supabase'
import { useCartStore } from '@/modules/cart'

export default function BuyerNegotiation() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [negotiation, setNegotiation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showCounterForm, setShowCounterForm] = useState(false)
  const [counterPrice, setCounterPrice] = useState('')
  const [counterNote, setCounterNote] = useState('')
  const [paypalOrderId] = useState(null)
  const [paypalProcessing, setPaypalProcessing] = useState(false)
  const [convertedOrderId] = useState(null)
  const { addNegotiatedItem } = useCartStore()

  const loadNegotiation = useCallback(async () => {
    try {
      const data = await fetchNegotiation(id)
      if (!data) {
        setError(t('negotiation.errors.notFound', 'التفاوض غير موجود'))
        return
      }
      if (data.buyer_id !== user?.id) {
        setError(t('negotiation.errors.forbidden', 'لا يمكنك عرض هذا التفاوض'))
        return
      }
      setNegotiation(data)
    } catch (err) {
      logger.error('Failed to load negotiation:', err)
      setError(err.message || t('negotiation.errors.loadFailed', 'فشل تحميل التفاوض'))
    }
  }, [id, user, t])

  useEffect(() => {
    if (!user) return
    expireStaleNegotiations()
    setLoading(true)
    loadNegotiation().finally(() => setLoading(false))
  }, [user, loadNegotiation])

  // Real-time subscription
  useEffect(() => {
    if (!id) return
    const unsubscribe = subscribeToNegotiation(id, (updated) => {
      setNegotiation(updated)
    })
    return unsubscribe
  }, [id])

  const canCounter = negotiation
    && negotiation.status !== NEGOTIATION_STATUS.ACCEPTED
    && negotiation.status !== NEGOTIATION_STATUS.REJECTED
    && negotiation.status !== NEGOTIATION_STATUS.EXPIRED
    && negotiation.status !== NEGOTIATION_STATUS.CONVERTED
    && negotiation.round_number < NEGOTIATION_MAX_ROUNDS
    && negotiation.offer_by === 'vendor'

  const canAccept = negotiation
    && (negotiation.status === NEGOTIATION_STATUS.COUNTERED || negotiation.status === NEGOTIATION_STATUS.PENDING)
    && negotiation.offer_by === 'vendor'

  const handleAccept = async () => {
    setActionLoading(true)
    try {
      await acceptNegotiation(id, {})
      toast.success(t('negotiation.accepted', 'تم قبول العرض'))
      await loadNegotiation()
    } catch (err) {
      toast.error(err.message || t('negotiation.errors.acceptFailed', 'فشل قبول العرض'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleCounter = async () => {
    const price = Number(counterPrice)
    if (!price || price <= 0) {
      toast.error(t('negotiation.errors.invalidPrice', 'السعر غير صالح'))
      return
    }
    setActionLoading(true)
    try {
      await counterNegotiation(id, {
        proposedPrice: price,
        note: counterNote || null,
        offerBy: 'buyer',
      })
      toast.success(t('negotiation.counterSent', 'تم إرسال العرض المقابل'))
      setShowCounterForm(false)
      setCounterPrice('')
      setCounterNote('')
      await loadNegotiation()
    } catch (err) {
      toast.error(err.message || t('negotiation.errors.counterFailed', 'فشل إرسال العرض المقابل'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddToCartAndCheckout = async () => {
    if (!negotiation) return
    setActionLoading(true)
    try {
      // Fetch full product data for the cart item
      const { data: productData, error: prodError } = await supabase
        .from('products')
        .select(`id, name, price_per_unit, unit_type, is_available, available_quantity,
          min_order_quantity, category, subcategory,
          product_images(url, is_primary),
          vendor:public_vendor_profiles!vendor_id(id, store_name, first_name, last_name, city)`)
        .eq('id', negotiation.product_id)
        .maybeSingle()

      if (prodError) throw prodError

      // Build negotiation object with product data for addNegotiatedItem
      const negWithProduct = {
        ...negotiation,
        product: productData || negotiation.product || {},
      }

      addNegotiatedItem(negWithProduct)
      toast.success(t('negotiation.addedToCart', 'Added to cart with negotiated price'))
      navigate('/cart')
    } catch (err) {
      logger.error('Failed to add negotiated item to cart:', err)
      toast.error(err.message || t('negotiation.errors.addToCartFailed', 'Failed to add to cart'))
    } finally {
      setActionLoading(false)
    }
  }

  const handlePayPalApprove = async () => {
    if (!paypalOrderId || !convertedOrderId) return
    setPaypalProcessing(true)
    try {
      const { error: captureError } = await supabase.functions.invoke('capture-paypal-order', {
        body: { orderId: paypalOrderId },
      })
      if (captureError) throw captureError
      toast.success(t('checkout.paypal.success', 'تم الدفع بنجاح'))
      navigate(`/order-confirmation/${convertedOrderId}?paypal=success`)
    } catch (err) {
      logger.error('PayPal capture failed:', err)
      toast.error(t('checkout.paypal.error', 'فشل الدفع عبر PayPal'))
    } finally {
      setPaypalProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Link to="/buyer/orders" className="text-green-600 dark:text-green-400 text-sm font-medium hover:underline">
            {t('negotiation.backToOrders', 'العودة للطلبات')}
          </Link>
        </Card>
      </div>
    )
  }

  if (!negotiation) return null

  const showPayPal = negotiation.status === NEGOTIATION_STATUS.ACCEPTED && paypalOrderId
  const showPayButton = negotiation.status === NEGOTIATION_STATUS.ACCEPTED && !convertedOrderId

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back link */}
      <Link
        to="/buyer/orders"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        {t('negotiation.backToOrders', 'العودة للطلبات')}
      </Link>

      <OfferCard negotiation={negotiation} viewerRole="buyer">
        {/* ── Action buttons for buyer ─────────────────────────────── */}
        <div className="space-y-3">
          {/* Accept vendor's counter-offer */}
          {canAccept && (
            <button
              onClick={handleAccept}
              disabled={actionLoading}
              className="w-full py-3 px-4 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircleIcon className="w-5 h-5" />
              {t('negotiation.acceptOffer', 'قبول العرض')}
            </button>
          )}

          {/* Counter-offer toggle */}
          {canCounter && !showCounterForm && (
            <button
              onClick={() => setShowCounterForm(true)}
              disabled={actionLoading}
              className="w-full py-3 px-4 rounded-xl bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowPathIcon className="w-5 h-5" />
              {t('negotiation.counterOffer', 'عرض مقابل')}
            </button>
          )}

          {/* Counter-offer form */}
          {showCounterForm && (
            <Card className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {t('negotiation.yourPrice', 'سعرك المقترح')} (MAD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {t('negotiation.note', 'ملاحظة (اختياري)')}
                </label>
                <textarea
                  value={counterNote}
                  onChange={(e) => setCounterNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder={t('negotiation.notePlaceholder', 'أضف ملاحظة للبائع...')}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCounter}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? t('common.sending', 'جاري الإرسال...') : t('negotiation.sendCounter', 'إرسال')}
                </button>
                <button
                  onClick={() => setShowCounterForm(false)}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('common.cancel', 'إلغاء')}
                </button>
              </div>
            </Card>
          )}

          {/* Add to cart button (after accepted) */}
          {showPayButton && (
            <button
              onClick={handleAddToCartAndCheckout}
              disabled={actionLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold text-sm hover:from-green-700 hover:to-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {actionLoading
                ? t('negotiation.addingToCart', 'Adding to cart...')
                : t('negotiation.addToCartAndCheckout', 'Add to Cart & Checkout')}
            </button>
          )}

          {/* PayPal inline buttons */}
          {showPayPal && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="mb-3 text-sm font-medium text-blue-900 dark:text-blue-300">
                {t('negotiation.completePayment', 'أكمل الدفع الآن عبر PayPal')}
              </p>
              <PayPalScriptProvider
                options={{
                  clientId: getPayPalClientId(),
                  currency: 'MAD',
                  intent: 'capture',
                }}
              >
                <PayPalButtons
                  style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' }}
                  createOrder={() => paypalOrderId}
                  onApprove={handlePayPalApprove}
                  onCancel={() => toast.error(t('checkout.paypal.cancelled', 'تم إلغاء الدفع'))}
                  onError={(err) => {
                    logger.error('PayPal button error:', err)
                    toast.error(t('checkout.paypal.buttonError', 'خطأ في PayPal'))
                  }}
                  forceReRender={[paypalOrderId]}
                  disabled={paypalProcessing}
                />
              </PayPalScriptProvider>
            </div>
          )}

          {/* Converted — link to order */}
          {convertedOrderId && !showPayPal && (
            <Link
              to={`/order-confirmation/${convertedOrderId}`}
              className="block w-full py-3 px-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 font-semibold text-sm text-center hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
            >
              {t('negotiation.viewOrder', 'عرض الطلب')}
            </Link>
          )}
        </div>
      </OfferCard>
    </div>
  )
}
