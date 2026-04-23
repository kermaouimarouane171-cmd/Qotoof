import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { paymentGateway } from '@/services/paymentGateway'
import { auditLogger, useEntityAuditLogs } from '@/services/auditLogger'
import { Card, LoadingSpinner } from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import { sanitizePostgRESTFilter } from '@/utils/sanitization'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XMarkIcon,
  ClockIcon,
  TruckIcon,
  ShoppingBagIcon,
  BanknotesIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  EyeIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

// ============================================
// Constants
// ============================================

const getSTATUS_CONFIG = (t) => ({
  pending:            { label: t('admin.orders.status.pending', 'Pending'),            color: '#F59E0B', bg: 'bg-amber-100',    text: 'text-amber-700',    icon: ClockIcon },
  vendor_accepted:    { label: t('admin.orders.status.accepted', 'Accepted'),           color: '#3B82F6', bg: 'bg-blue-100',    text: 'text-blue-700',     icon: CheckCircleIcon },
  vendor_rejected:    { label: t('admin.orders.status.rejected', 'Rejected'),           color: '#EF4444', bg: 'bg-red-100',      text: 'text-red-700',      icon: XMarkIcon },
  driver_assigned:    { label: t('admin.orders.status.driverAssigned', 'Driver Assigned'),    color: '#8B5CF6', bg: 'bg-purple-100',  text: 'text-purple-700',   icon: TruckIcon },
  driver_accepted:    { label: t('admin.orders.status.driverAccepted', 'Driver Accepted'),    color: '#8B5CF6', bg: 'bg-purple-100',  text: 'text-purple-700',   icon: CheckCircleIcon },
  driver_picked_up:   { label: t('admin.orders.status.pickedUp', 'Picked Up'),          color: '#8B5CF6', bg: 'bg-purple-100',  text: 'text-purple-700',   icon: ShoppingBagIcon },
  on_the_way:         { label: t('admin.orders.status.onTheWay', 'On the Way'),         color: '#8B5CF6', bg: 'bg-purple-100',  text: 'text-purple-700',   icon: TruckIcon },
  delivered:          { label: t('admin.orders.status.delivered', 'Delivered'),          color: '#10B981', bg: 'bg-emerald-100', text: 'text-emerald-700',  icon: CheckCircleIcon },
  cancelled:          { label: t('admin.orders.status.cancelled', 'Cancelled'),          color: '#EF4444', bg: 'bg-red-100',      text: 'text-red-700',      icon: XMarkIcon },
  refunded:           { label: t('admin.orders.status.refunded', 'Refunded'),           color: '#6B7280', bg: 'bg-gray-100',    text: 'text-gray-700',     icon: ArrowPathIcon },
})

const getPAYMENT_STATUS_CONFIG = (t) => ({
  pending:          { label: t('admin.orders.paymentStatus.pending', 'Payment Pending'),  color: '#F59E0B', bg: 'bg-amber-100',    text: 'text-amber-700' },
  paid:             { label: t('admin.orders.paymentStatus.paid', 'Paid'),             color: '#10B981', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  awaiting_transfer: { label: t('admin.orders.paymentStatus.awaitingTransfer', 'Awaiting Transfer'), color: '#3B82F6', bg: 'bg-blue-100',   text: 'text-blue-700' },
  refunded:         { label: t('admin.orders.paymentStatus.refunded', 'Refunded'),         color: '#6B7280', bg: 'bg-gray-100',    text: 'text-gray-700' },
  failed:           { label: t('admin.orders.paymentStatus.failed', 'Failed'),           color: '#EF4444', bg: 'bg-red-100',      text: 'text-red-700' },
})

const getRETURN_STATUS_CONFIG = (t) => ({
  pending:   { label: t('admin.orders.returnStatus.pending', 'Return Pending'),   color: '#F59E0B', bg: 'bg-amber-100',    text: 'text-amber-700' },
  approved:  { label: t('admin.orders.returnStatus.approved', 'Return Approved'),  color: '#3B82F6', bg: 'bg-blue-100',    text: 'text-blue-700' },
  rejected:  { label: t('admin.orders.returnStatus.rejected', 'Return Rejected'),  color: '#EF4444', bg: 'bg-red-100',      text: 'text-red-700' },
  refunded:  { label: t('admin.orders.returnStatus.refunded', 'Refund Complete'),  color: '#10B981', bg: 'bg-emerald-100', text: 'text-emerald-700' },
})

const getFILTER_TABS = (t) => [
  { id: 'all', label: t('admin.orders.filters.all', 'All Orders') },
  { id: 'active', label: t('admin.orders.filters.active', 'In Progress') },
  { id: 'delivered', label: t('admin.orders.filters.completed', 'Completed') },
  { id: 'cancelled', label: t('admin.orders.filters.cancelled', 'Cancelled/Refunded') },
]

const ACTIVE_STATUSES = ['pending', 'vendor_accepted', 'driver_assigned', 'driver_accepted', 'driver_picked_up', 'on_the_way']

const getREFUND_REASONS = (t) => [
  { id: 'customer_request', label: t('admin.orders.refundModal.reasons.customerRequest', 'Customer Request') },
  { id: 'product_defect', label: t('admin.orders.refundModal.reasons.productDefect', 'Product Defect') },
  { id: 'wrong_item', label: t('admin.orders.refundModal.reasons.wrongItem', 'Wrong Item Delivered') },
  { id: 'late_delivery', label: t('admin.orders.refundModal.reasons.lateDelivery', 'Late Delivery') },
  { id: 'not_as_described', label: t('admin.orders.refundModal.reasons.notAsDescribed', 'Not As Described') },
  { id: 'vendor_agreement', label: t('admin.orders.refundModal.reasons.vendorAgreement', 'Vendor Agreement') },
  { id: 'other', label: t('admin.orders.refundModal.reasons.other', 'Other') },
]

// ============================================
// Admin Orders Page Component
// ============================================

const AdminOrders = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()

  // State
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundNotes, setRefundNotes] = useState('')
  const [processingRefund, setProcessingRefund] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  const [statusNotes, setStatusNotes] = useState('')
  const [processingStatus, setProcessingStatus] = useState(false)
  const [returnRequests, setReturnRequests] = useState([])
  const [showReturnsTab, setShowReturnsTab] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 })

  // Redirect if not admin
  useEffect(() => {
    if (profile?.role !== 'admin') {
      toast.error(t('common.error', 'Unauthorized access'))
      navigate('/unauthorized')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, navigate])

  // ============================================
  // Load Orders
  // ============================================

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('orders')
        .select(`
          *,
          buyer:profiles!buyer_id(first_name, last_name, email, phone, avatar_url),
          vendor:profiles!vendor_id(first_name, last_name, email, phone, store_name, avatar_url),
          order_items (*)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })

      // Apply filter
      if (filter === 'active') {
        query = query.in('status', ACTIVE_STATUSES)
      } else if (filter === 'delivered') {
        query = query.eq('status', 'delivered')
      } else if (filter === 'cancelled') {
        query = query.in('status', ['cancelled', 'refunded', 'vendor_rejected'])
      }

      // Apply search
      if (searchQuery) {
        const safeSearch = sanitizePostgRESTFilter(searchQuery)
        query = query.or(`order_number.ilike.%${safeSearch}%,buyer_id.eq.${safeSearch},vendor_id.eq.${safeSearch}`)
      }

      // Pagination
      const from = (pagination.page - 1) * pagination.limit
      const to = from + pagination.limit - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      setOrders(data || [])
      setPagination(prev => ({ ...prev, total: count || 0 }))
    } catch (error) {
      logger.error('Error loading orders:', error)
      toast.error(t('admin.orders.notifications.loadFailed', 'Failed to load orders'))
    } finally {
      setLoading(false)
    }
  }, [filter, searchQuery, pagination.page, pagination.limit, t])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // ============================================
  // Load Return Requests
  // ============================================

  const loadReturnRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('return_requests')
        .select(`
          *,
          buyer:profiles!buyer_id(first_name, last_name, email),
          vendor:profiles!vendor_id(first_name, last_name, store_name),
          order:orders(order_number, total, status)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setReturnRequests(data || [])
    } catch (error) {
      logger.error('Error loading return requests:', error)
    }
  }, [])

  useEffect(() => {
    if (showReturnsTab) {
      loadReturnRequests()
    }
  }, [showReturnsTab, loadReturnRequests])

  // ============================================
  // Handle Order Status Update
  // ============================================

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !newStatus) return

    setProcessingStatus(true)
    const oldData = { ...selectedOrder }

    try {
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }

      // Add timestamps for terminal states
      if (newStatus === 'delivered') {
        updateData.delivered_at = new Date().toISOString()
      }
      if (newStatus === 'cancelled' || newStatus === 'vendor_rejected') {
        updateData.cancelled_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', selectedOrder.id)
        .select()
        .single()

      if (error) throw error

      // Log audit trail
      await auditLogger.logOrderAction('STATUS_UPDATE', data, oldData)

      // Log additional metadata
      await auditLogger.log({
        action: 'ORDER_STATUS_CHANGE',
        entityType: 'order',
        entityId: selectedOrder.id,
        oldValues: { status: oldData.status },
        newValues: { status: newStatus, notes: statusNotes },
        metadata: {
          changedBy: 'admin',
          adminId: user?.id,
          notes: statusNotes,
          previousStatus: oldData.status,
        },
      })

      toast.success(t('admin.orders.notifications.statusUpdated', 'Order status updated to {{status}}', { status: getSTATUS_CONFIG(t)[newStatus]?.label || newStatus }).replace('{{status}}', getSTATUS_CONFIG(t)[newStatus]?.label || newStatus))
      setShowStatusModal(false)
      setSelectedOrder(data)
      loadOrders()
    } catch (error) {
      logger.error('Error updating order status:', error)
      toast.error(t('admin.orders.notifications.statusUpdateFailed', 'Failed to update order status'))
    } finally {
      setProcessingStatus(false)
    }
  }

  // ============================================
  // Handle Refund Processing
  // ============================================

  const handleRefund = async () => {
    if (!selectedOrder || !refundAmount || !refundReason) {
      toast.error(t('common.error', 'Please fill in all required fields'))
      return
    }

    const amount = parseFloat(refundAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error(t('common.error', 'Invalid refund amount'))
      return
    }

    if (amount > selectedOrder.total) {
      toast.error(t('common.error', 'Refund amount cannot exceed order total'))
      return
    }

    setProcessingRefund(true)
    const oldData = { ...selectedOrder }

    try {
      // 1. Find the payment record for this order
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', selectedOrder.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .maybeSingle()

      if (paymentError) {
        logger.error('Error fetching payment:', paymentError)
      }

      // 2. Process refund through payment gateway
      let refundResult = { success: false, status: 'manual' }

      if (payment && payment.id) {
        try {
          refundResult = await paymentGateway.refundPayment(payment.id, amount, refundReason)
        } catch (gatewayError) {
          logger.error('Payment gateway refund error:', gatewayError)
          // Fallback to manual refund record
          toast.error(t('admin.orders.refundModal.gatewayError', 'Payment gateway error: {{message}}. Recording manual refund.', { message: gatewayError.message }).replace('{{message}}', gatewayError.message))
        }
      }

      // 3. Update payment record
      if (payment && payment.id) {
        await supabase
          .from('payments')
          .update({
            status: 'refunded',
            refund_amount: amount,
            refund_reason: refundReason,
            refunded_at: new Date().toISOString(),
          })
          .eq('id', payment.id)
      } else {
        // Create a refund payment record if no payment exists (COD/Bank)
        await supabase
          .from('payments')
          .insert({
            order_id: selectedOrder.id,
            amount: -amount, // Negative for refund
            method: payment?.method || 'cod',
            status: 'refunded',
            refund_amount: amount,
            refund_reason: refundReason,
            refunded_at: new Date().toISOString(),
          })
      }

      // 4. Update order status if full refund
      let newOrderStatus = oldData.status
      if (amount >= selectedOrder.total * 0.99) {
        newOrderStatus = 'refunded'
        await supabase
          .from('orders')
          .update({
            status: 'refunded',
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedOrder.id)
      }

      // 5. Update return request if exists
      const { data: returnReq } = await supabase
        .from('return_requests')
        .select('id')
        .eq('order_id', selectedOrder.id)
        .maybeSingle()

      if (returnReq) {
        await supabase
          .from('return_requests')
          .update({
            status: 'refunded',
            refund_amount: amount,
            admin_id: user?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', returnReq.id)
      }

      // 6. Log comprehensive audit trail
      const newData = { ...oldData, status: newOrderStatus }
      await auditLogger.logOrderAction('REFUND_PROCESSED', newData, oldData)

      await auditLogger.log({
        action: 'ORDER_REFUND',
        entityType: 'order',
        entityId: selectedOrder.id,
        oldValues: { status: oldData.status, payment_status: payment?.status },
        newValues: { status: newOrderStatus, refund_amount: amount },
        metadata: {
          refundAmount: amount,
          refundReason: refundReason,
          refundNotes: refundNotes,
          paymentMethod: payment?.method || 'unknown',
          gatewayRefundStatus: refundResult.status,
          processedBy: 'admin',
          adminId: user?.id,
          returnRequestId: returnReq?.id || null,
        },
      })

      // 7. Log financial action
      await auditLogger.logFinancialAction('REFUND_PROCESSED', user?.id, {
        orderId: selectedOrder.id,
        orderNumber: selectedOrder.order_number,
        amount: amount,
        reason: refundReason,
        paymentMethod: payment?.method,
      })

      toast.success(t('admin.orders.notifications.refundSuccess', 'Refund of {{amount}} processed successfully', { amount: formatPrice(amount) }).replace('{{amount}}', formatPrice(amount)))
      setShowRefundModal(false)
      setRefundAmount('')
      setRefundReason('')
      setRefundNotes('')
      loadOrders()
    } catch (error) {
      logger.error('Error processing refund:', error)
      toast.error(t('admin.orders.notifications.refundFailed', 'Failed to process refund'))
    } finally {
      setProcessingRefund(false)
    }
  }

  // ============================================
  // Handle Return Request Actions
  // ============================================

  const handleReturnAction = async (returnId, action, adminResponse = '') => {
    try {
      const { data: returnReq, error: fetchError } = await supabase
        .from('return_requests')
        .select('*')
        .eq('id', returnId)
        .single()

      if (fetchError) throw fetchError

      const oldStatus = returnReq.status
      let newStatus = oldStatus

      if (action === 'approve') {
        newStatus = 'approved'
      } else if (action === 'reject') {
        newStatus = 'rejected'
      }

      const { error: updateError } = await supabase
        .from('return_requests')
        .update({
          status: newStatus,
          admin_response: adminResponse,
          admin_id: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', returnId)

      if (updateError) throw updateError

      // Log audit trail
      await auditLogger.log({
        action: 'RETURN_REQUEST_UPDATE',
        entityType: 'return_request',
        entityId: returnId,
        oldValues: { status: oldStatus },
        newValues: { status: newStatus, admin_response: adminResponse },
        metadata: {
          orderId: returnReq.order_id,
          buyerId: returnReq.buyer_id,
          vendorId: returnReq.vendor_id,
          processedBy: 'admin',
          adminId: user?.id,
        },
      })

      toast.success(action === 'approve' ? t('admin.orders.notifications.returnApproved', 'Return request approved') : t('admin.orders.notifications.returnRejected', 'Return request rejected'))
      loadReturnRequests()
    } catch (error) {
      logger.error('Error handling return request:', error)
      toast.error(t('admin.orders.notifications.returnFailed', 'Failed to process return request'))
    }
  }

  // ============================================
  // Open Modals
  // ============================================

  const openDetailModal = async (order) => {
    setSelectedOrder(order)
    setShowDetailModal(true)
  }

  const openRefundModal = (order) => {
    setSelectedOrder(order)
    setRefundAmount(order.total.toString())
    setRefundReason('')
    setRefundNotes('')
    setShowRefundModal(true)
  }

  const openStatusModal = (order) => {
    setSelectedOrder(order)
    setNewStatus(order.status)
    setStatusNotes('')
    setShowStatusModal(true)
  }

  // ============================================
  // Computed Values
  // ============================================

  const stats = useMemo(() => ({
    total: pagination.total,
    active: orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => ['cancelled', 'vendor_rejected'].includes(o.status)).length,
    totalRevenue: orders.reduce((sum, o) => sum + (o.total || 0), 0),
    pendingReturns: returnRequests.filter(r => r.status === 'pending').length,
  }), [orders, returnRequests, pagination.total])

  // ============================================
  // Render
  // ============================================

  if (loading && orders.length === 0) {
    return <LoadingSpinner size="lg" />
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900"> {t('admin.orders.title', 'Order Management')} </h1>
        <p className="text-gray-500 mt-1"> {t('admin.orders.subtitle', 'Manage orders, process refunds, and track audit trails')} </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ShoppingBagIcon className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-500"> {t('admin.orders.stats.totalOrders', 'Total Orders')} </p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ClockIcon className="w-8 h-8 text-amber-600" />
            <div>
              <p className="text-sm text-gray-500"> {t('admin.orders.stats.inProgress', 'In Progress')} </p>
              <p className="text-xl font-bold">{stats.active}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-8 h-8 text-emerald-600" />
            <div>
              <p className="text-sm text-gray-500"> {t('admin.orders.stats.delivered', 'Delivered')} </p>
              <p className="text-xl font-bold">{stats.delivered}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CurrencyDollarIcon className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-500"> {t('admin.orders.stats.revenue', 'Revenue')} </p>
              <p className="text-xl font-bold">{formatPrice(stats.totalRevenue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <ArrowPathIcon className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-500"> {t('admin.orders.stats.pendingReturns', 'Pending Returns')} </p>
              <p className="text-xl font-bold">{stats.pendingReturns}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setShowReturnsTab(false)}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
            !showReturnsTab
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('admin.orders.tabs.orders', 'Orders')}
        </button>
        <button
          onClick={() => setShowReturnsTab(true)}
          className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors relative ${
            showReturnsTab
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('admin.orders.tabs.returns', 'Return Requests')}
          {stats.pendingReturns > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {stats.pendingReturns}
            </span>
          )}
        </button>
      </div>

      {!showReturnsTab ? (
        <>
          {/* Filters & Search */}
          <Card className="p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('admin.orders.searchPlaceholder', 'Search by order number, buyer ID, or vendor ID...')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2">
                {getFILTER_TABS(t).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Orders Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"> {t('admin.orders.table.order', 'Order')} </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"> {t('admin.orders.table.buyer', 'Buyer')} </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"> {t('admin.orders.table.vendor', 'Vendor')} </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"> {t('admin.orders.table.status', 'Status')} </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"> {t('admin.orders.table.payment', 'Payment')} </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"> {t('admin.orders.table.total', 'Total')} </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"> {t('admin.orders.table.date', 'Date')} </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase"> {t('admin.orders.table.actions', 'Actions')} </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((order) => {
                    const statusCfg = getSTATUS_CONFIG(t)[order.status] || getSTATUS_CONFIG(t).pending
                    const StatusIcon = statusCfg.icon
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{order.order_number || order.id.slice(0, 8)}</p>
                          <p className="text-xs text-gray-500">{order.order_items?.length || 0} {t('admin.orders.items', 'items')} </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900">
                            {order.buyer ? `${order.buyer.first_name} ${order.buyer.last_name}` : 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">{order.buyer?.email || ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900">
                            {order.vendor?.store_name || `${order.vendor?.first_name || ''} ${order.vendor?.last_name || ''}`}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <PaymentStatusBadge orderId={order.id} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{formatPrice(order.total)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-500">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openDetailModal(order)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title={t('admin.orders.actions.viewDetails', 'View')}
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openStatusModal(order)}
                              className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title={t('admin.orders.actions.updateStatus', 'Update Status')}
                            >
                              <ArrowPathIcon className="w-4 h-4" />
                            </button>
                            {(order.status === 'delivered' || order.status === 'vendor_rejected') && (
                              <button
                                onClick={() => openRefundModal(order)}
                                className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                title={t('admin.orders.actions.processRefund', 'Refund')}
                              >
                                <BanknotesIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {t('admin.orders.pagination.showing', 'Showing {{from}} to {{to}} of {{total}} orders').replace('{{from}}', ((pagination.page - 1) * pagination.limit) + 1).replace('{{to}}', Math.min(pagination.page * pagination.limit, pagination.total)).replace('{{total}}', pagination.total)}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page * pagination.limit >= pagination.total}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </>
      ) : (
        /* Return Requests Tab */
        <ReturnRequestsList
          returns={returnRequests}
          onAction={handleReturnAction}
          loading={loading}
        />
      )}

      {/* Modals */}
      {showDetailModal && selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setShowDetailModal(false)}
          onViewAuditLogs={() => {
            setShowDetailModal(false)
            navigate(`/admin/audit-logs?entityType=order&entityId=${selectedOrder.id}`)
          }}
        />
      )}

      {showRefundModal && selectedOrder && (
        <RefundModal
          order={selectedOrder}
          refundAmount={refundAmount}
          setRefundAmount={setRefundAmount}
          refundReason={refundReason}
          setRefundReason={setRefundReason}
          refundNotes={refundNotes}
          setRefundNotes={setRefundNotes}
          processingRefund={processingRefund}
          onRefund={handleRefund}
          onClose={() => setShowRefundModal(false)}
        />
      )}

      {showStatusModal && selectedOrder && (
        <StatusUpdateModal
          order={selectedOrder}
          newStatus={newStatus}
          setNewStatus={setNewStatus}
          statusNotes={statusNotes}
          setStatusNotes={setStatusNotes}
          processingStatus={processingStatus}
          onUpdate={handleStatusUpdate}
          onClose={() => setShowStatusModal(false)}
        />
      )}
    </div>
  )
}

// ============================================
// Sub-Components
// ============================================

const PaymentStatusBadge = ({ orderId }) => {
  const { t } = useTranslation()
  const [paymentStatus, setPaymentStatus] = useState(null)

  useEffect(() => {
    const fetchPaymentStatus = async () => {
      const { data } = await supabase
        .from('payments')
        .select('status')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setPaymentStatus(data?.status || 'pending')
    }
    fetchPaymentStatus()
  }, [orderId])

  if (!paymentStatus) return <span className="text-xs text-gray-400">...</span>

  const cfg = getPAYMENT_STATUS_CONFIG(t)[paymentStatus] || getPAYMENT_STATUS_CONFIG(t).pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

const ReturnRequestsList = ({ returns, onAction, loading }) => {
  const { t } = useTranslation()
  const [adminResponse, setAdminResponse] = useState({})
  const [expandedReturn, setExpandedReturn] = useState(null)

  if (loading) return <LoadingSpinner size="lg" />

  if (returns.length === 0) {
    return (
      <Card className="p-12 text-center">
        <ArrowPathIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">{t('admin.orders.returnRequests.noRequests', 'No return requests found')}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {returns.map((ret) => {
        const cfg = getRETURN_STATUS_CONFIG(t)[ret.status] || getRETURN_STATUS_CONFIG(t).pending
        const isExpanded = expandedReturn === ret.id
        return (
          <Card key={ret.id} className="overflow-hidden">
            <button
              type="button"
              className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedReturn(isExpanded ? null : ret.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {t('admin.orders.returnRequests.returnNumber', 'Return')} #{ret.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t('admin.orders.returnRequests.order', 'Order')}: {ret.order?.order_number || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-900">
                      {t('admin.orders.returnRequests.buyer', 'Buyer')}: {ret.buyer ? `${ret.buyer.first_name} ${ret.buyer.last_name}` : 'N/A'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t('admin.orders.returnRequests.vendor', 'Vendor')}: {ret.vendor?.store_name || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatPrice(ret.refund_amount || ret.order?.total || 0)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(ret.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{t('admin.orders.returnRequests.returnDetails', 'Return Details')}</h4>
                    <p className="text-sm text-gray-600"><strong>{t('admin.orders.returnRequests.reason', 'Reason')}:</strong> {ret.reason}</p>
                    {ret.description && (
                      <p className="text-sm text-gray-600 mt-1"><strong>{t('common.description', 'Description')}:</strong> {ret.description}</p>
                    )}
                    {ret.items && (
                      <p className="text-sm text-gray-600 mt-1">
                        <strong>{t('admin.orders.detailModal.items', 'Items')}:</strong> {Array.isArray(ret.items) ? ret.items.length : JSON.stringify(ret.items)}
                      </p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{t('admin.orders.returnRequests.actions', 'Admin Actions')}</h4>
                    {ret.status === 'pending' && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={adminResponse[ret.id] || ''}
                          onChange={(e) => setAdminResponse(prev => ({ ...prev, [ret.id]: e.target.value }))}
                          placeholder={t('admin.orders.returnRequests.adminResponsePlaceholder', 'Add your response...')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => onAction(ret.id, 'approve', adminResponse[ret.id] || '')}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            <CheckCircleIcon className="w-4 h-4 inline mr-1" />
                            {t('admin.orders.returnRequests.approve', 'Approve')}
                          </button>
                          <button
                            onClick={() => onAction(ret.id, 'reject', adminResponse[ret.id] || '')}
                            className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <XMarkIcon className="w-4 h-4 inline mr-1" />
                            {t('admin.orders.returnRequests.reject', 'Reject')}
                          </button>
                        </div>
                      </div>
                    )}
                    {ret.admin_response && (
                      <p className="text-sm text-gray-600">
                        <strong>{t('admin.orders.returnRequests.adminResponse', 'Admin Response')}:</strong> {ret.admin_response}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

const OrderDetailModal = ({ order, onClose, onViewAuditLogs }) => {
  const { t } = useTranslation()
  const { logs: auditLogs, loading: auditLoading } = useEntityAuditLogs('order', order.id, 10)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{t('admin.orders.detailModal.title', 'Order Details')}</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">{order.order_number || order.id}</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2"> {t('admin.orders.table.buyer', 'Buyer')} </h3>
              <p className="text-sm">{order.buyer ? `${order.buyer.first_name} ${order.buyer.last_name}` : 'N/A'}</p>
              <p className="text-xs text-gray-500">{order.buyer?.email || ''}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2"> {t('admin.orders.table.vendor', 'Vendor')} </h3>
              <p className="text-sm">{order.vendor?.store_name || `${order.vendor?.first_name || ''} ${order.vendor?.last_name || ''}`}</p>
            </div>
          </div>

          {/* Order Items */}
          {order.order_items && order.order_items.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">{t('admin.orders.detailModal.items', 'Order Items')}</h3>
              <div className="space-y-2">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{item.product_name || t('common.product', 'Product')}</p>
                      <p className="text-xs text-gray-500">{t('product.quantity', 'Qty')}: {item.quantity} {item.unit_type}</p>
                    </div>
                    <p className="font-semibold">{formatPrice((item.price || item.unit_price || 0) * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{t('checkout.orderSummary', 'Subtotal')}</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              {order.shipping_cost > 0 && (
                <div className="flex justify-between text-sm">
                  <span>{t('checkout.shipping', 'Shipping')}</span>
                  <span>{formatPrice(order.shipping_cost)}</span>
                </div>
              )}
              {order.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span>{t('common.tax', 'Tax')}</span>
                  <span>{formatPrice(order.tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
                <span> {t('admin.orders.table.total', 'Total')} </span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Audit Trail */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">{t('admin.orders.detailModal.timeline', 'Order Timeline')}</h3>
              <button
                onClick={onViewAuditLogs}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                View Full Audit Log
              </button>
            </div>
            {auditLoading ? (
              <p className="text-sm text-gray-400">{t('common.loading', 'Loading...')}</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-gray-400">{t('admin.orders.detailModal.noAuditLogs', 'No audit logs found for this order')}</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{log.action}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {log.user && (
                      <p className="text-xs text-gray-600">
                        By: {log.user.first_name} {log.user.last_name} ({log.user.role})
                      </p>
                    )}
                    {log.new_values && (
                      <pre className="mt-2 p-2 bg-white rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.new_values, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  )
}

const RefundModal = ({
  order,
  refundAmount,
  setRefundAmount,
  refundReason,
  setRefundReason,
  refundNotes,
  setRefundNotes,
  processingRefund,
  onRefund,
  onClose,
}) => {
  const { t } = useTranslation()
  return (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl max-w-lg w-full">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{t('admin.orders.refundModal.title', 'Process Refund')}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">{t('admin.orders.refundModal.orderNumber', 'Order')}: {order.order_number || order.id}</p>
      </div>

      <div className="p-6 space-y-4">
        {/* Order Summary */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">{t('admin.orders.refundModal.orderTotal', 'Order Total')}: {formatPrice(order.total)}</p>
              <p className="text-xs text-amber-700 mt-1">
                {t('admin.orders.refundModal.refundWarning', 'This action will process a refund through the payment gateway. The audit trail will be logged.')}
              </p>
            </div>
          </div>
        </div>

        {/* Refund Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.orders.refundModal.refundAmount', 'Refund Amount (MAD)')}</label>
          <input
            type="number"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            min="0"
            max={order.total}
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder={t('admin.orders.refundModal.enterAmount', 'Enter refund amount')}
          />
        </div>

        {/* Refund Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.orders.refundModal.refundReason', 'Refund Reason *')}</label>
          <select
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="">{t('admin.orders.refundModal.selectReason', 'Select a reason...')}</option>
            {getREFUND_REASONS(t).map((reason) => (
              <option key={reason.id} value={reason.id}>{reason.label}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.orders.refundModal.notes', 'Additional Notes')}</label>
          <textarea
            value={refundNotes}
            onChange={(e) => setRefundNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
            placeholder={t('admin.orders.refundModal.notesPlaceholder', 'Add any additional notes about this refund...')}
            maxLength={500}
          />
          <p className="text-xs text-gray-400 mt-1">{refundNotes.length}/500</p>
        </div>
      </div>

      <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          disabled={processingRefund}
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          onClick={onRefund}
          disabled={processingRefund || !refundAmount || !refundReason}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processingRefund ? t('admin.orders.refundModal.processing', 'Processing...') : t('admin.orders.refundModal.confirmRefund', 'Process Refund')}
        </button>
      </div>
    </div>
  </div>
  )
}

const StatusUpdateModal = ({
  order,
  newStatus,
  setNewStatus,
  statusNotes,
  setStatusNotes,
  processingStatus,
  onUpdate,
  onClose,
}) => {
  const { t } = useTranslation()
  const availableStatuses = [
    'pending',
    'vendor_accepted',
    'vendor_rejected',
    'driver_assigned',
    'driver_accepted',
    'driver_picked_up',
    'on_the_way',
    'delivered',
    'cancelled',
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{t('admin.orders.statusModal.title', 'Update Order Status')}</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.orders.statusModal.orderInfo', 'Order')}: {order.order_number || order.id} | {t('admin.orders.statusModal.current', 'Current')}: {getSTATUS_CONFIG(t)[order.status]?.label || order.status}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.orders.statusModal.newStatus', 'New Status')}</label>
            <div className="grid grid-cols-2 gap-2">
              {availableStatuses.map((status) => {
                const cfg = getSTATUS_CONFIG(t)[status]
                const isSelected = newStatus === status
                return (
                  <button
                    key={status}
                    onClick={() => setNewStatus(status)}
                    className={`p-3 rounded-lg border-2 text-left transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className={`inline-flex items-center gap-2 text-sm font-medium ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.orders.statusModal.notes', 'Status Change Notes')}</label>
            <textarea
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
              placeholder={t('admin.orders.statusModal.notesPlaceholder', 'Add notes about this status change...')}
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1">{statusNotes.length}/500</p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={processingStatus}
          >
            Cancel
          </button>
          <button
            onClick={onUpdate}
            disabled={processingStatus || newStatus === order.status}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingStatus ? t('admin.orders.statusModal.updating', 'Updating...') : t('admin.orders.statusModal.confirmUpdate', 'Update Status')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdminOrders
