import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Button, Input, LoadingSpinner, Modal } from '@/components/ui'
import { productsApi } from '@/services/api'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatPrice } from '@/utils/currency'
import { logger } from '@/utils/logger'

const STATUS_OPTIONS = ['all', 'pending', 'published', 'rejected', 'suspended']

const AdminProductsPage = () => {
  const { t, i18n } = useTranslation()

  const authLoading = useAuthStore((s) => s.loading)
  const authProfile = useAuthStore((s) => s.profile)

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [products, setProducts] = useState([])
  const [selectedIds, setSelectedIds] = useState([])

  const [statusFilter, setStatusFilter] = useState('pending')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [detailsProduct, setDetailsProduct] = useState(null)
  const [rejectState, setRejectState] = useState({ open: false, product: null, reason: '' })

  const isAdmin = authProfile?.role === 'admin'

  const loadProducts = async () => {
    if (!isAdmin) return

    setLoading(true)
    try {
      const response = await productsApi.getAll({
        approvalStatus: statusFilter === 'all' ? undefined : statusFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        vendorId: vendorFilter === 'all' ? undefined : vendorFilter,
        search: search.trim() || undefined,
        limit: 200,
        offset: 0,
      })

      const rows = Array.isArray(response) ? response : (response?.data || [])
      setProducts(rows)
      setSelectedIds((prev) => prev.filter((id) => rows.some((item) => item.id === id)))
    } catch (error) {
      logger.error('Failed to load admin products:', error)
      toast.error(t('admin.products.loadFailed', 'تعذر تحميل المنتجات'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    loadProducts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, statusFilter, categoryFilter, vendorFilter])

  useEffect(() => {
    if (!isAdmin) return
    const timer = setTimeout(() => loadProducts(), 250)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const categories = useMemo(() => {
    const values = new Set(products.map((p) => p.category).filter(Boolean))
    return Array.from(values)
  }, [products])

  const vendors = useMemo(() => {
    const map = new Map()
    products.forEach((p) => {
      if (!p.vendor_id) return
      const vendorName = p.vendor?.store_name || `${p.vendor?.first_name || ''} ${p.vendor?.last_name || ''}`.trim() || p.vendor?.email || p.vendor_id
      map.set(p.vendor_id, vendorName)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [products])

  const allSelected = products.length > 0 && selectedIds.length === products.length

  const canBatchApprove = selectedIds.length > 0 && selectedIds.every(
    (id) => products.find((p) => p.id === id)?.approval_status === 'pending'
  )

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ))
  }

  const toggleSelectAll = () => {
    const pendingIds = products.filter((p) => p.approval_status === 'pending').map((p) => p.id)
    const allPendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.includes(id))
    setSelectedIds(allPendingSelected ? [] : pendingIds)
  }
  const sendProductNotification = async ({ userId, title, message, productId, type = 'system' }) => {
    if (!userId) return
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        data: { product_id: productId, source: 'admin-products' },
      })
    if (error) logger.error('Product notification insert failed:', error)
  }

  const approveSingle = async (product) => {
    setActionLoading(true)
    try {
      await productsApi.approve(product.id, authProfile?.id || null)
      await sendProductNotification({
        userId: product.vendor_id,
        productId: product.id,
        title: t('admin.products.notifications.approvedTitle', 'تمت الموافقة على المنتج'),
        message: t('admin.products.notifications.approvedMessage', 'تمت الموافقة على منتجك ويمكن عرضه الآن.'),
      })
      toast.success(t('admin.products.approvedSuccess', 'تمت الموافقة على المنتج'))
      await loadProducts()
    } catch (error) {
      logger.error('Approve product failed:', error)
      toast.error(t('admin.products.approvedFailed', 'تعذر الموافقة على المنتج'))
    } finally {
      setActionLoading(false)
    }
  }

  const approveSelected = async () => {
    if (!selectedIds.length) return

    setActionLoading(true)
    try {
      const selectedProducts = products.filter((p) => selectedIds.includes(p.id))
      await productsApi.bulkApprove(selectedIds, authProfile?.id || null)

      await Promise.all(selectedProducts.map((p) => sendProductNotification({
        userId: p.vendor_id,
        productId: p.id,
        title: t('admin.products.notifications.approvedTitle', 'تمت الموافقة على المنتج'),
        message: t('admin.products.notifications.approvedMessage', 'تمت الموافقة على منتجك ويمكن عرضه الآن.'),
      })))

      toast.success(t('admin.products.bulkApproveSuccess', 'تمت الموافقة على المنتجات المحددة'))
      setSelectedIds([])
      await loadProducts()
    } catch (error) {
      logger.error('Bulk approve failed:', error)
      toast.error(t('admin.products.bulkApproveFailed', 'تعذرت الموافقة الجماعية'))
    } finally {
      setActionLoading(false)
    }
  }

  const suspendSingle = async (product) => {
    setActionLoading(true)
    try {
      await productsApi.suspend(product.id)
      await sendProductNotification({
        userId: product.vendor_id,
        productId: product.id,
        title: t('admin.products.notifications.suspendedTitle', 'تم تعليق المنتج'),
        message: t('admin.products.notifications.suspendedMessage', 'تم تعليق منتجك مؤقتاً من قبل الإدارة.'),
        type: 'system',
      })
      toast.success(t('admin.products.suspendedSuccess', 'تم تعليق المنتج'))
      await loadProducts()
    } catch (error) {
      logger.error('Suspend product failed:', error)
      toast.error(t('admin.products.suspendedFailed', 'تعذر تعليق المنتج'))
    } finally {
      setActionLoading(false)
    }
  }

  const submitReject = async () => {
    if (!rejectState.product || !rejectState.reason.trim()) {
      toast.error(t('admin.products.rejectReasonRequired', 'يرجى إدخال سبب الرفض'))
      return
    }

    setActionLoading(true)
    try {
      await productsApi.reject(rejectState.product.id, rejectState.reason.trim())
      await sendProductNotification({
        userId: rejectState.product.vendor_id,
        productId: rejectState.product.id,
        title: t('admin.products.notifications.rejectedTitle', 'تم رفض المنتج'),
        message: t('admin.products.notifications.rejectedMessage', 'تم رفض منتجك. السبب: {{reason}}', { reason: rejectState.reason.trim() }),
      })
      toast.success(t('admin.products.rejectedSuccess', 'تم رفض المنتج'))
      setRejectState({ open: false, product: null, reason: '' })
      await loadProducts()
    } catch (error) {
      logger.error('Reject product failed:', error)
      toast.error(t('admin.products.rejectedFailed', 'تعذر رفض المنتج'))
    } finally {
      setActionLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex justify-center py-10">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4" dir="rtl">
        <h2 className="text-lg font-semibold text-red-800 mb-1">
          {t('admin.products.forbiddenTitle', 'غير مصرح بالوصول')}
        </h2>
        <p className="text-sm text-red-700">
          {t('admin.products.forbiddenMessage', 'هذه الصفحة مخصصة للمشرفين فقط.')}
        </p>
      </div>
    )
  }

  return (
    <div dir="rtl" data-cy="admin-products-page">
      <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-cy="admin-products-title">
            {t('admin.products.title', 'إدارة المنتجات')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('admin.products.subtitle', 'مراجعة المنتجات والموافقة أو الرفض')}
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={approveSelected}
          disabled={!canBatchApprove}
          isLoading={actionLoading}
          data-cy="admin-products-batch-approve"
        >
          {t('admin.products.batchApprove', 'موافقة جماعية')} ({selectedIds.length})
        </Button>
      </div>

      <div className="grid gap-3 mb-4 md:grid-cols-4">
        <select
          className="input"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setSelectedIds([])
          }}
          data-cy="admin-products-status-filter"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status === 'all'
                ? t('admin.products.status.all', 'الكل')
                : t(`admin.products.status.${status}`, status)}
            </option>
          ))}
        </select>

        <select
          className="input"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          data-cy="admin-products-category-filter"
        >
          <option value="all">{t('admin.products.allCategories', 'كل التصنيفات')}</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>

        <select
          className="input"
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          data-cy="admin-products-vendor-filter"
        >
          <option value="all">{t('admin.products.allVendors', 'كل الباعة')}</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
          ))}
        </select>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.products.searchPlaceholder', 'بحث باسم المنتج أو البائع')}
          data-cy="admin-products-search"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white" data-cy="admin-products-table-wrap">
        <table className="min-w-full table-auto" data-cy="admin-products-table">
          <thead className="bg-gray-50 text-right text-sm text-gray-700">
            <tr>
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={products.filter(p => p.approval_status === 'pending').every(p => selectedIds.includes(p.id)) && products.some(p => p.approval_status === 'pending')}
                  onChange={toggleSelectAll}
                  disabled={!products.some(p => p.approval_status === 'pending')}
                  data-cy="admin-products-select-all"
                />
              </th>
              <th className="px-3 py-3">{t('admin.products.columns.name', 'الاسم')}</th>
              <th className="px-3 py-3">{t('admin.products.columns.vendor', 'البائع')}</th>
              <th className="px-3 py-3">{t('admin.products.columns.category', 'التصنيف')}</th>
              <th className="px-3 py-3">{t('admin.products.columns.price', 'السعر')}</th>
              <th className="px-3 py-3">{t('admin.products.columns.status', 'الحالة')}</th>
              <th className="px-3 py-3">{t('admin.products.columns.submittedAt', 'تاريخ الإرسال')}</th>
              <th className="px-3 py-3">{t('admin.products.columns.actions', 'الإجراءات')}</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center">
                  <LoadingSpinner size="md" />
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                  {t('admin.products.empty', 'لا توجد منتجات مطابقة')}
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const vendorName = product.vendor?.store_name || `${product.vendor?.first_name || ''} ${product.vendor?.last_name || ''}`.trim() || '-'
                return (
                  <tr key={product.id} className="border-t border-gray-100" data-cy={`admin-products-row-${product.id}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        disabled={product.approval_status !== 'pending'}
                        data-cy={`admin-products-select-${product.id}`}
                      />
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-900">{product.name}</td>
                    <td className="px-3 py-3">{vendorName}</td>
                    <td className="px-3 py-3">{product.category || '-'}</td>
                    <td className="px-3 py-3">{formatPrice(product.price_per_unit || 0)}</td>
                    <td className="px-3 py-3">
                      <span className={[
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        product.approval_status === 'pending'   && 'bg-yellow-100 text-yellow-800',
                        product.approval_status === 'published' && 'bg-green-100  text-green-800',
                        product.approval_status === 'rejected'  && 'bg-red-100    text-red-800',
                        product.approval_status === 'suspended' && 'bg-gray-100   text-gray-700',
                      ].filter(Boolean).join(' ')}>
                        {t(`admin.products.status.${product.approval_status}`, product.approval_status)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDetailsProduct(product)}
                          data-cy={`admin-products-view-${product.id}`}
                        >
                          {t('admin.products.actions.viewDetails', 'عرض التفاصيل')}
                        </Button>

                        {product.approval_status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => approveSingle(product)}
                              isLoading={actionLoading}
                              data-cy={`admin-products-approve-${product.id}`}
                            >
                              {t('admin.products.actions.approve', 'موافقة')}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setRejectState({ open: true, product, reason: '' })}
                              data-cy={`admin-products-reject-${product.id}`}
                            >
                              {t('admin.products.actions.reject', 'رفض')}
                            </Button>
                          </>
                        )}

                        {product.approval_status === 'published' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => suspendSingle(product)}
                            isLoading={actionLoading}
                            data-cy={`admin-products-suspend-${product.id}`}
                          >
                            {t('admin.products.actions.suspend', 'تعليق')}
                          </Button>
                        )}

                        {product.approval_status === 'suspended' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => approveSingle(product)}
                            isLoading={actionLoading}
                            data-cy={`admin-products-restore-${product.id}`}
                          >
                            {t('admin.products.actions.restore', 'إعادة نشر')}
                          </Button>
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

      <Modal
        isOpen={Boolean(detailsProduct)}
        onClose={() => setDetailsProduct(null)}
        title={t('admin.products.detailsTitle', 'تفاصيل المنتج')}
        size="lg"
      >
        {detailsProduct && (
          <div className="space-y-2 text-sm" dir="rtl" data-cy="admin-products-details-modal">
            <p><span className="font-semibold">{t('admin.products.columns.name', 'الاسم')}:</span> {detailsProduct.name}</p>
            <p><span className="font-semibold">{t('admin.products.columns.vendor', 'البائع')}:</span> {detailsProduct.vendor?.store_name || '-'}</p>
            <p><span className="font-semibold">{t('admin.products.columns.category', 'التصنيف')}:</span> {detailsProduct.category || '-'}</p>
            <p><span className="font-semibold">{t('admin.products.columns.price', 'السعر')}:</span> {formatPrice(detailsProduct.price_per_unit || 0)}</p>
            <p><span className="font-semibold">{t('admin.products.description', 'الوصف')}:</span> {detailsProduct.description || '-'}</p>
            <p><span className="font-semibold">{t('admin.products.columns.submittedAt', 'تاريخ الإرسال')}:</span> {new Date(detailsProduct.created_at).toLocaleString(i18n.language === 'ar' ? 'ar-MA' : 'en-US')}</p>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={rejectState.open}
        onClose={() => setRejectState({ open: false, product: null, reason: '' })}
        title={t('admin.products.rejectTitle', 'رفض المنتج')}
        size="md"
      >
        <div className="space-y-4" dir="rtl" data-cy="admin-products-reject-modal">
          <Input
            value={rejectState.reason}
            onChange={(e) => setRejectState((prev) => ({ ...prev, reason: e.target.value }))}
            placeholder={t('admin.products.rejectReasonPlaceholder', 'اكتب سبب الرفض')}
            data-cy="admin-products-reject-reason"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRejectState({ open: false, product: null, reason: '' })}
              data-cy="admin-products-reject-cancel"
            >
              {t('common.cancel', 'إلغاء')}
            </Button>
            <Button
              variant="danger"
              onClick={submitReject}
              isLoading={actionLoading}
              data-cy="admin-products-reject-submit"
            >
              {t('admin.products.actions.confirmReject', 'تأكيد الرفض')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AdminProductsPage
