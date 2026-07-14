import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { emailService } from '@/services/emailService'
import { Card, LoadingSpinner } from '@/components/ui'
import AuthGate from '@/components/auth/AuthGate'
import { formatPrice } from '@/utils/currency'
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

// ============================================
// Constants
// ============================================

const RETURN_WINDOW_HOURS = 48
const MAX_IMAGES = 5
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const TABS = [
  { id: 'policy', label: 'Policy' },
  { id: 'request', label: 'Request Return' },
  { id: 'history', label: 'My Returns' },
]

// ============================================
// Policy Tab
// ============================================

const PolicyTab = ({ t }) => (
  <div className="space-y-8">
    <div>
      <Link to="/returns?tab=request" className="btn-primary inline-flex items-center gap-2">
        <ArrowPathIcon className="w-5 h-5" />
        {t('returns.submitRequest', 'Submit a Return Request')}
      </Link>
    </div>

    <Card className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{t('returns.policy.title', 'Return Policy')}</h2>
      <p className="text-gray-600 mb-4">
        {t('returns.policy.description', "We want you to be completely satisfied with your purchase. If you're not happy with your order, you can request a return within")}{' '}
        <strong>{t('returns.policy.timeframe', '24 hours')}</strong>{' '}
        {t('returns.policy.descriptionAfter', 'of delivery.')}
      </p>
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5" />
          <p className="text-sm text-green-700">
            {t('returns.policy.freeReturns', 'Returns are free and refunds are processed within 3-5 business days after approval.')}
          </p>
        </div>
      </div>
    </Card>

    <Card className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{t('returns.eligible.title', 'Eligible for Return')}</h2>
      <ul className="space-y-3">
        {[
          t('returns.eligible.item1', 'Products that are damaged or spoiled upon delivery'),
          t('returns.eligible.item2', "Items that don't match the product description"),
          t('returns.eligible.item3', 'Incorrect items delivered'),
          t('returns.eligible.item4', 'Missing items from the order'),
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckCircleIcon className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span className="text-gray-600">{item}</span>
          </li>
        ))}
      </ul>
    </Card>

    <Card className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{t('returns.notEligible.title', 'Not Eligible for Return')}</h2>
      <ul className="space-y-3">
        {[
          t('returns.notEligible.item1', 'Perishable items after 24 hours of delivery'),
          t('returns.notEligible.item2', 'Items damaged due to improper storage by buyer'),
          t('returns.notEligible.item3', 'Custom or special orders'),
        ].map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <span className="text-gray-600">{item}</span>
          </li>
        ))}
      </ul>
    </Card>

    <Card className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{t('returns.howTo.title', 'How to Request a Return')}</h2>
      <div className="space-y-4">
        {[
          { label: t('returns.steps.step1', 'Go to My Orders'), desc: t('returns.steps.step1Desc', 'Find the order you want to return') },
          { label: t('returns.steps.step2', 'Click "Request Return"'), desc: t('returns.steps.step2Desc', 'Select the items and reason for return') },
          { label: t('returns.steps.step3', 'Upload Photos'), desc: t('returns.steps.step3Desc', 'Add photos as evidence of the issue') },
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-green-600 font-semibold text-sm">{i + 1}</span>
            </div>
            <div>
              <p className="font-medium">{step.label}</p>
              <p className="text-sm text-gray-500">{step.desc}</p>
            </div>
          </div>
        ))}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
            <ArrowPathIcon className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="font-medium">{t('returns.steps.step4', 'Wait for Review')}</p>
            <p className="text-sm text-gray-500">{t('returns.steps.step4Desc', 'Vendor reviews and approves/rejects within 24 hours')}</p>
          </div>
        </div>
      </div>
    </Card>

    <Card className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">{t('returns.refundTimeline.title', 'Refund Timeline')}</h2>
      <div className="space-y-3">
        <div className="flex justify-between py-3 border-b">
          <span>{t('returns.refundTimeline.review', 'Return Review')}</span>
          <span className="font-medium">{t('returns.refundTimeline.reviewTime', 'Within 24 hours')}</span>
        </div>
        <div className="flex justify-between py-3 border-b">
          <span>{t('returns.refundTimeline.processing', 'Refund Processing')}</span>
          <span className="font-medium">{t('returns.refundTimeline.processingTime', '3-5 business days')}</span>
        </div>
        <div className="flex justify-between py-3">
          <span>{t('returns.refundTimeline.method', 'Refund Method')}</span>
          <span className="font-medium">{t('returns.refundTimeline.methodValue', 'Original payment method or wallet credit')}</span>
        </div>
      </div>
    </Card>
  </div>
)

// ============================================
// Request Tab
// ============================================

const RequestTab = ({ t, user, navigate }) => {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedItems, setSelectedItems] = useState([])
  const [returnReason, setReturnReason] = useState('')
  const [returnDescription, setReturnDescription] = useState('')
  const [returnImages, setReturnImages] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [existingReturn, setExistingReturn] = useState(null)

  const returnReasons = [
    { id: 'damaged', label: t('returnRequest.reasons.damaged', 'Damaged Product') },
    { id: 'wrong_item', label: t('returnRequest.reasons.wrong_item', 'Wrong Item') },
    { id: 'poor_quality', label: t('returnRequest.reasons.poor_quality', 'Poor Quality') },
    { id: 'not_as_described', label: t('returnRequest.reasons.not_as_described', 'Not as Described') },
    { id: 'late_delivery', label: t('returnRequest.reasons.late_delivery', 'Late Delivery') },
    { id: 'other', label: t('returnRequest.reasons.other', 'Other') },
  ]

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items (*), vendor:profiles(store_name, first_name, last_name)')
          .eq('buyer_id', user.id)
          .eq('status', 'delivered')
          .order('created_at', { ascending: false })

        if (error) throw error

        const now = new Date()
        const eligibleOrders = (data || []).filter(order => {
          if (!order.delivered_at) return false
          return (now - new Date(order.delivered_at)) / (1000 * 60 * 60) <= RETURN_WINDOW_HOURS
        })
        setOrders(eligibleOrders)
      } catch (error) {
        logger.error('Error loading orders:', error)
        toast.error(t('returnRequest.errors.loadOrders', 'Failed to load orders'))
      } finally {
        setLoading(false)
      }
    }
    loadOrders()
  }, [user.id, t])

  useEffect(() => {
    if (!selectedOrder) { setExistingReturn(null); setSelectedItems([]); return }
    const checkExisting = async () => {
      const { data } = await supabase
        .from('return_requests')
        .select('id, status, created_at')
        .eq('order_id', selectedOrder.id)
        .eq('user_id', user.id)
        .maybeSingle()
      setExistingReturn(data)
      if (data) { setSelectedItems([]); setReturnReason(''); setReturnDescription(''); setReturnImages([]) }
    }
    checkExisting()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder]) // user.id is stable for the lifetime of this component

  const handleItemSelect = (itemId) => {
    setSelectedItems(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId])
  }

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || [])
    const validFiles = []
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error(`Unsupported file type: ${file.name}`); continue }
      if (file.size > MAX_IMAGE_SIZE) { toast.error(`File too large: ${file.name} (max 5 MB)`); continue }
      validFiles.push(file)
    }
    if (!validFiles.length) return
    if (validFiles.length + returnImages.length > MAX_IMAGES) { toast.error(`Max ${MAX_IMAGES} images`); return }
    setReturnImages(prev => [...prev, ...validFiles])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedOrder) { toast.error(t('returnRequest.errors.selectOrder', 'Please select an order')); return }
    if (existingReturn) { toast.error(t('returnRequest.errors.existingReturn', 'A return already exists for this order')); return }
    if (!selectedItems.length) { toast.error(t('returnRequest.errors.selectItems', 'Please select at least one item')); return }
    if (!returnReason) { toast.error(t('returnRequest.errors.selectReason', 'Please select a return reason')); return }

    setSubmitting(true)
    try {
      const { data: returnData, error: returnError } = await supabase
        .from('return_requests')
        .insert({
          user_id: user.id,
          order_id: selectedOrder.id,
          buyer_id: user.id,
          vendor_id: selectedOrder.vendor_id,
          reason: returnReason,
          description: returnDescription || null,
          status: 'pending',
          items: selectedItems,
        })
        .select()
        .single()

      if (returnError) throw returnError

      for (const file of returnImages) {
        const fileName = `${returnData.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        await supabase.storage.from('return-images').upload(fileName, file, { contentType: file.type })
      }

      try {
        const { data: profileData } = await supabase.from('profiles').select('first_name, last_name, email').eq('id', user.id).maybeSingle()
        if (profileData?.email) {
          await emailService.sendReturnRequestConfirmation(
            { id: returnData.id, order_number: selectedOrder.order_number || selectedOrder.id.slice(0, 8), reason: returnReason },
            { name: `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim(), email: profileData.email }
          )
        }
      } catch (emailErr) { logger.error('Return email failed:', emailErr) }

      toast.success(t('returnRequest.success.submitted', 'Return request submitted successfully'))
      navigate('/buyer/orders')
    } catch (error) {
      logger.error('Error submitting return request:', error)
      toast.error(error.message || t('returnRequest.errors.submitFailed', 'Failed to submit return request'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>

  return (
    <div>
      <Card className="p-6 mb-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <ArrowPathIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <ul className="text-sm text-blue-800 space-y-1">
            <li>{t('returnRequest.policy.rule1', 'You can request a return within {{hours}} hours of delivery', { hours: RETURN_WINDOW_HOURS })}</li>
            <li>{t('returnRequest.policy.rule2', 'The product must be in its original condition')}</li>
            <li>{t('returnRequest.policy.rule3', 'The vendor will review your request within 24 hours')}</li>
            <li>{t('returnRequest.policy.rule4', 'Refunds are processed within 3-5 business days after approval')}</li>
          </ul>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Select Order */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('returnRequest.step1.title', 'Step 1: Select Order')}</h2>
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <ArrowPathIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('returnRequest.step1.noOrders', 'No eligible orders for return')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('returnRequest.step1.noOrdersHint', 'Order must be delivered within {{hours}} hours', { hours: RETURN_WINDOW_HOURS })}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const deliveredDate = order.delivered_at ? new Date(order.delivered_at) : null
                const hoursRemaining = deliveredDate
                  ? Math.max(0, Math.round(RETURN_WINDOW_HOURS - (new Date() - deliveredDate) / (1000 * 60 * 60)))
                  : null
                return (
                  <button key={order.id} type="button" onClick={() => setSelectedOrder(order)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${selectedOrder?.id === order.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{order.order_number || order.id.slice(0, 8)}</p>
                        <p className="text-sm text-gray-500">{order.vendor?.store_name || 'Store'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatPrice(order.total)}</p>
                        <p className="text-xs text-gray-400">{order.order_items?.length || 0} items</p>
                        {hoursRemaining !== null && (
                          <p className={`text-xs mt-1 ${hoursRemaining < 12 ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>
                            {hoursRemaining > 0 ? `${hoursRemaining}h remaining` : 'Expires today'}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        {existingReturn && (
          <Card className="p-6 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
              <p className="text-sm text-amber-800">
                {t('returnRequest.existingReturn.message', 'A return request already exists for this order (status: {{status}}).', { status: existingReturn.status })}
              </p>
            </div>
          </Card>
        )}

        {/* Step 2: Select Items */}
        {selectedOrder && !existingReturn && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('returnRequest.step2.title', 'Step 2: Select Items to Return')}</h2>
            <div className="space-y-3">
              {selectedOrder.order_items?.map((item) => (
                <button key={item.id} type="button" onClick={() => handleItemSelect(item.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${selectedItems.includes(item.id) ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedItems.includes(item.id) ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                        {selectedItems.includes(item.id) && <CheckCircleIcon className="w-5 h-5 text-white" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.product_name || 'Product'}</p>
                        <p className="text-sm text-gray-500">Qty: {item.quantity} {item.unit_type}</p>
                      </div>
                    </div>
                    <p className="font-bold text-gray-900">{formatPrice((item.price || item.unit_price || 0) * item.quantity)}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Step 3: Return Reason */}
        {selectedItems.length > 0 && !existingReturn && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('returnRequest.step3.title', 'Step 3: Return Reason')}</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {returnReasons.map((reason) => (
                <button key={reason.id} type="button" onClick={() => setReturnReason(reason.id)}
                  className={`p-4 rounded-xl border-2 text-center transition-colors ${returnReason === reason.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  {reason.label}
                </button>
              ))}
            </div>
            <div>
              <label className="input-label">{t('returnRequest.step3.descriptionLabel', 'Additional Details (optional)')}</label>
              <textarea value={returnDescription} onChange={(e) => setReturnDescription(e.target.value)}
                rows={4} className="input h-24 resize-none"
                placeholder={t('returnRequest.step3.descriptionPlaceholder', 'Describe the issue in more detail...')}
                maxLength={1000} />
              <p className="text-xs text-gray-400 mt-1">{returnDescription.length}/1000</p>
            </div>
          </Card>
        )}

        {/* Step 4: Upload Images */}
        {returnReason && !existingReturn && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {t('returnRequest.step4.title', 'Step 4: Upload Photos (optional, max {{max}})', { max: MAX_IMAGES })}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
              {returnImages.map((img, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200">
                  <img src={URL.createObjectURL(img)} alt={`Return attachment ${index + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setReturnImages(prev => prev.filter((_, i) => i !== index))}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {returnImages.length < MAX_IMAGES && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-green-500 transition-colors">
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleImageUpload} className="hidden" />
                  <PhotoIcon className="w-8 h-8 text-gray-400" />
                </label>
              )}
            </div>
          </Card>
        )}

        {returnReason && !existingReturn && (
          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? t('returnRequest.submit.submitting', 'Submitting...') : t('returnRequest.submit.send', 'Submit Return Request')}
          </button>
        )}
      </form>
    </div>
  )
}

// ============================================
// History Tab
// ============================================

const HistoryTab = ({ t, user, navigate }) => {
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadReturns = async () => {
      try {
        const { data, error } = await supabase
          .from('return_requests')
          .select('*, order:orders(order_number, total, vendor:profiles(store_name))')
          .eq('buyer_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setReturns(data || [])
      } catch {
        setReturns([])
      } finally {
        setLoading(false)
      }
    }
    loadReturns()
  }, [user.id])

  const statusConfig = {
    pending: { label: t('buyer.returns.status.pending', 'Pending Review'), color: 'bg-amber-100 text-amber-700', icon: ClockIcon, dot: 'bg-amber-500' },
    approved: { label: t('buyer.returns.status.approved', 'Approved'), color: 'bg-green-100 text-green-700', icon: CheckCircleIcon, dot: 'bg-green-500' },
    rejected: { label: t('buyer.returns.status.rejected', 'Rejected'), color: 'bg-red-100 text-red-700', icon: XCircleIcon, dot: 'bg-red-500' },
    refunded: { label: t('buyer.returns.status.refunded', 'Refunded'), color: 'bg-blue-100 text-blue-700', icon: CheckCircleIcon, dot: 'bg-blue-500' },
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>

  if (!returns.length) {
    return (
      <Card className="p-12 text-center">
        <ArrowPathIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('buyer.returns.emptyTitle', 'No return requests')}</h3>
        <p className="text-gray-500 mb-6">{t('buyer.returns.emptyDesc', "You haven't requested any returns yet")}</p>
        <button onClick={() => navigate('/buyer/orders')} className="btn-primary inline-flex items-center gap-2">
          <EyeIcon className="w-5 h-5" />
          {t('buyer.returns.viewOrders', 'View Orders')}
        </button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {returns.map(ret => {
        const config = statusConfig[ret.status] || statusConfig.pending
        const StatusIcon = config.icon
        return (
          <Card key={ret.id} className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color}`}>
                <StatusIcon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{t('buyer.returns.returnLabel', 'Return')} #{ret.id.slice(0, 8)}</h3>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                    {config.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {t('buyer.returns.orderLabel', 'Order')} {ret.order?.order_number || 'N/A'} — {ret.order?.vendor?.store_name || 'Vendor'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(ret.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {ret.reason && ` · ${ret.reason}`}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-gray-900">{formatPrice(ret.order?.total || 0)}</p>
                {ret.refund_amount && (
                  <p className="text-xs text-green-600">{t('buyer.returns.refundedLabel', 'Refunded')}: {formatPrice(ret.refund_amount)}</p>
                )}
              </div>
            </div>
            {ret.admin_response && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">{t('buyer.returns.adminResponse', 'Response from support:')}</p>
                <p className="text-sm text-gray-700">{ret.admin_response}</p>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ============================================
// Main Component
// ============================================

const Returns = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'policy'

  const setTab = (tab) => setSearchParams({ tab }, { replace: true })

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('returns.title', 'Return & Refund Policy')}</h1>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-8">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            {t(`returns.tabs.${tab.id}`, tab.label)}
          </button>
        ))}
      </div>

      {activeTab === 'policy' && <PolicyTab t={t} />}
      {activeTab === 'request' && (
        user
          ? <RequestTab t={t} user={user} navigate={navigate} />
          : <AuthGate title={t('returns.authRequired.title', 'Sign in required')} message={t('returns.authRequired.desc', 'You need to be signed in to access {{tab}}.', { tab: t('returns.tabs.request', 'Request Return') })} from="/returns" />
      )}
      {activeTab === 'history' && (
        user
          ? <HistoryTab t={t} user={user} navigate={navigate} />
          : <AuthGate title={t('returns.authRequired.title', 'Sign in required')} message={t('returns.authRequired.desc', 'You need to be signed in to access {{tab}}.', { tab: t('returns.tabs.history', 'My Returns') })} from="/returns" />
      )}
    </div>
  )
}

export default Returns
