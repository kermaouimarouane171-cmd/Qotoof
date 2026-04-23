import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Badge, Button, Input, LoadingSpinner } from '@/components/ui'
import { productsApi } from '@/services/api'
import { formatPrice } from '@/utils/currency'
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const APPROVAL_STATUS_CONFIG = (t) => ({
  pending: {
    label: t('admin.products.status.pending', 'Pending Review'),
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: ExclamationTriangleIcon,
  },
  approved: {
    label: t('admin.products.status.approved', 'Approved'),
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircleIcon,
  },
  rejected: {
    label: t('admin.products.status.rejected', 'Rejected'),
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircleIcon,
  },
})

const AdminProducts = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [selectedProducts, setSelectedProducts] = useState([])
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [viewModal, setViewModal] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const response = await productsApi.getAll({ approvalStatus: statusFilter })
      const productsList = Array.isArray(response) ? response : (response?.data || [])
      setProducts(productsList)
    } catch (_error) {
      toast.error(t('admin.products.notifications.loadFailed', 'Failed to load products'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, t])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const handleApprove = async (id) => {
    setSubmitting(true)
    try {
      await productsApi.approve(id)
      toast.success(t('admin.products.notifications.approveSuccess', 'Product approved successfully') + ' ✅')
      loadProducts()
    } catch (_error) {
      toast.error(t('admin.products.notifications.approveFailed', 'Failed to approve product'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!rejectModal) return
    setSubmitting(true)
    try {
      await productsApi.reject(rejectModal, rejectReason)
      toast.success(t('admin.products.notifications.rejectSuccess', 'Product rejected'))
      setRejectModal(null)
      setRejectReason('')
      loadProducts()
    } catch (_error) {
      toast.error(t('admin.products.notifications.rejectFailed', 'Failed to reject product'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleBulkApprove = async () => {
    if (selectedProducts.length === 0) return
    setSubmitting(true)
    try {
      await productsApi.bulkApprove(selectedProducts)
      toast.success(t('admin.products.notifications.bulkApproveSuccess', '{{count}} product(s) approved', { count: selectedProducts.length }).replace('{{count}}', selectedProducts.length) + ' ✅')
      setSelectedProducts([])
      loadProducts()
    } catch (_error) {
      toast.error(t('admin.products.notifications.bulkApproveFailed', 'Failed to bulk approve products'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleBulkReject = async () => {
    if (selectedProducts.length === 0) return
    setRejectModal('bulk')
  }

  const handleBulkRejectSubmit = async () => {
    if (rejectModal !== 'bulk') return
    setSubmitting(true)
    try {
      await productsApi.bulkReject(selectedProducts, rejectReason)
      toast.success(t('admin.products.notifications.bulkRejectSuccess', '{{count}} product(s) rejected', { count: selectedProducts.length }).replace('{{count}}', selectedProducts.length))
      setSelectedProducts([])
      setRejectModal(null)
      setRejectReason('')
      loadProducts()
    } catch (_error) {
      toast.error(t('admin.products.notifications.bulkRejectFailed', 'Failed to bulk reject products'))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleSelect = (id) => {
    setSelectedProducts(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id))
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.vendor?.store_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.vendor?.first_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    pending: products.filter(p => p.approval_status === 'pending').length,
    approved: products.filter(p => p.approval_status === 'approved').length,
    rejected: products.filter(p => p.approval_status === 'rejected').length,
  }

  if (loading) {
    return <LoadingSpinner size="lg" />
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('admin.products.title', 'Products')}</h1>
        <p className="text-gray-500 mt-1">{t('admin.products.subtitle', 'Review and manage product listings')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            statusFilter === 'pending'
              ? 'bg-yellow-50 border-yellow-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-yellow-200'
          }`}
        >
          <p className="text-sm text-yellow-600 font-medium">{t('admin.products.stats.pendingReview', 'Pending Review')}</p>
          <p className="text-3xl font-bold text-yellow-700 mt-1">{stats.pending}</p>
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            statusFilter === 'approved'
              ? 'bg-green-50 border-green-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-green-200'
          }`}
        >
          <p className="text-sm text-green-600 font-medium">{t('admin.products.stats.approved', 'Approved')}</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{stats.approved}</p>
        </button>
        <button
          onClick={() => setStatusFilter('rejected')}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            statusFilter === 'rejected'
              ? 'bg-red-50 border-red-300 shadow-sm'
              : 'bg-white border-gray-200 hover:border-red-200'
          }`}
        >
          <p className="text-sm text-red-600 font-medium">{t('admin.products.stats.rejected', 'Rejected')}</p>
          <p className="text-3xl font-bold text-red-700 mt-1">{stats.rejected}</p>
        </button>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <Input
            placeholder={t('admin.products.searchPlaceholder', 'Search products or vendors...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
          />
        </div>
        {statusFilter === 'pending' && selectedProducts.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={handleBulkApprove}
              isLoading={submitting}
              leftIcon={<CheckCircleIcon className="w-5 h-5" />}
            >
              {t('admin.products.bulkActions.approveSelected', 'Approve Selected ({{count}})', { count: selectedProducts.length }).replace('{{count}}', selectedProducts.length)}
            </Button>
            <Button
              variant="outline"
              onClick={handleBulkReject}
              isLoading={submitting}
              leftIcon={<XCircleIcon className="w-5 h-5" />}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              {t('admin.products.bulkActions.rejectSelected', 'Reject Selected')}
            </Button>
          </div>
        )}
      </div>

      {/* Products Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {statusFilter === 'pending' && (
                  <th className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-green-600"
                    />
                  </th>
                )}
                <th>{t('admin.products.table.product', 'Product')}</th>
                <th>{t('admin.products.table.vendor', 'Vendor')}</th>
                <th>{t('admin.products.table.category', 'Category')}</th>
                <th>{t('admin.products.table.price', 'Price')}</th>
                <th>{t('admin.products.table.status', 'Status')}</th>
                <th>{t('admin.products.table.created', 'Created')}</th>
                <th>{t('admin.products.table.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={statusFilter === 'pending' ? 8 : 7} className="text-center py-12">
                    <ExclamationTriangleIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">{t('admin.products.noProducts', 'No products found')}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {statusFilter === 'pending'
                        ? t('admin.products.allReviewed', 'All products have been reviewed')
                        : t('admin.products.noStatusProducts', 'No {{status}} products yet', { status: statusFilter }).replace('{{status}}', statusFilter)}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const statusConfig = APPROVAL_STATUS_CONFIG(t)[product.approval_status || 'pending']
                  const StatusIcon = statusConfig.icon
                  const images = product.images || []
                  const primaryImage = images.find(img => img.is_primary)?.url || images[0]?.url

                  return (
                    <tr key={product.id} className={selectedProducts.includes(product.id) ? 'bg-green-50' : ''}>
                      {statusFilter === 'pending' && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedProducts.includes(product.id)}
                            onChange={() => toggleSelect(product.id)}
                            className="w-4 h-4 rounded border-gray-300 text-green-600"
                          />
                        </td>
                      )}
                      <td>
                        <div className="flex items-center gap-3">
                          {primaryImage ? (
                            <img
                              src={primaryImage}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                              <span className="text-lg">📦</span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{product.name}</p>
                            {product.rejection_reason && (
                              <p className="text-xs text-red-500 mt-0.5" title={product.rejection_reason}>
                                {t('admin.products.rejectionReason', 'Reason')}: {product.rejection_reason.slice(0, 50)}...
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <p className="font-medium">{product.vendor?.store_name || 'N/A'}</p>
                          <p className="text-xs text-gray-500">
                            {product.vendor?.first_name} {product.vendor?.last_name}
                          </p>
                        </div>
                      </td>
                      <td className="capitalize">{product.category}</td>
                      <td className="font-medium">{formatPrice(product.price_per_unit)}</td>
                      <td>
                        <Badge className={statusConfig.color}>
                          <div className="flex items-center gap-1">
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig.label}
                          </div>
                        </Badge>
                      </td>
                      <td className="text-sm text-gray-500">
                        {new Date(product.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {/* View Details */}
                          <button
                            onClick={() => setViewModal(product)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('admin.products.viewDetails', 'View Details')}
                          >
                            <EyeIcon className="w-5 h-5" />
                          </button>

                          {/* Approve / Reject (only for pending) */}
                          {product.approval_status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(product.id)}
                                disabled={submitting}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                title={t('admin.products.approve', 'Approve')}
                              >
                                <CheckCircleIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => {
                                  setRejectModal(product.id)
                                  setRejectReason('')
                                }}
                                disabled={submitting}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title={t('admin.products.reject', 'Reject')}
                              >
                                <XCircleIcon className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View Product Modal */}
      {viewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">{t('admin.products.productDetails', 'Product Details')}</h2>
                <button onClick={() => setViewModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Product Image */}
              {viewModal.images?.length > 0 && (
                <img
                  src={viewModal.images.find(img => img.is_primary)?.url || viewModal.images[0].url}
                  alt={viewModal.name}
                  className="w-full h-48 object-cover rounded-xl mb-4"
                />
              )}

              {/* Product Info */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">{t('admin.products.productName', 'Product Name')}</p>
                  <p className="font-semibold text-lg">{viewModal.name}</p>
                </div>
                {viewModal.description && (
                  <div>
                    <p className="text-sm text-gray-500">{t('admin.products.description', 'Description')}</p>
                    <p className="text-gray-700">{viewModal.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">{t('admin.products.table.price', 'Price')}</p>
                    <p className="font-semibold">{formatPrice(viewModal.price_per_unit)} / {viewModal.unit_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('admin.products.table.category', 'Category')}</p>
                    <p className="font-semibold capitalize">{viewModal.category}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('admin.products.availableQuantity', 'Available Quantity')}</p>
                    <p className="font-semibold">{viewModal.available_quantity} {viewModal.unit_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{t('admin.products.table.status', 'Status')}</p>
                    <Badge className={APPROVAL_STATUS_CONFIG(t)[viewModal.approval_status]?.color}>
                      {APPROVAL_STATUS_CONFIG(t)[viewModal.approval_status]?.label}
                    </Badge>
                  </div>
                </div>

                {/* Vendor Info */}
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-2">{t('admin.products.table.vendor', 'Vendor')}</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <span className="text-lg">👤</span>
                    </div>
                    <div>
                      <p className="font-medium">{viewModal.vendor?.store_name || 'N/A'}</p>
                      <p className="text-sm text-gray-500">
                        {viewModal.vendor?.first_name} {viewModal.vendor?.last_name}
                        {viewModal.vendor?.city ? ` • ${viewModal.vendor.city}` : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {viewModal.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-sm font-medium text-red-900">{t('admin.products.rejectionReason', 'Rejection Reason')}</p>
                    <p className="text-sm text-red-700 mt-1">{viewModal.rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <XCircleIcon className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {rejectModal === 'bulk'
                      ? t('admin.products.rejectProducts', 'Reject Products')
                      : t('admin.products.rejectProduct', 'Reject Product')}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {rejectModal === 'bulk'
                      ? t('admin.products.rejectingCount', 'Rejecting {{count}} product(s)', { count: selectedProducts.length }).replace('{{count}}', selectedProducts.length)
                      : t('admin.products.provideReason', 'Provide a reason for rejection')}
                  </p>
                </div>
              </div>

              <textarea
                placeholder={t('admin.products.rejectionReasonPlaceholder', 'Enter rejection reason (optional but recommended)...')}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                rows={4}
              />

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => { setRejectModal(null); setRejectReason('') }}
                  disabled={submitting}
                  className="flex-1"
                >
                  {t('admin.products.cancel', 'Cancel')}
                </Button>
                <Button
                  variant="outline"
                  onClick={rejectModal === 'bulk' ? handleBulkRejectSubmit : handleReject}
                  isLoading={submitting}
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  {t('admin.products.confirmRejection', 'Confirm Rejection')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminProducts
