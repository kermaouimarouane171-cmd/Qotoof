import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, Badge, Button, LoadingSpinner, Modal } from '@/components/ui'
import {
  CheckIcon,
  XMarkIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  BellIcon
} from '@heroicons/react/24/outline'
import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'
import { auditLogger } from '@/services/auditLogger'
import toast from 'react-hot-toast'

const rejectionReasons = [
  { value: 'incomplete_documents', label: 'Incomplete Documents', labelAr: 'مستندات غير مكتملة' },
  { value: 'invalid_business_license', label: 'Invalid Business License', labelAr: 'رخصة تجارية غير صالحة' },
  { value: 'policy_violation', label: 'Policy Violation', labelAr: 'انتهاك السياسة' },
  { value: 'duplicate_account', label: 'Duplicate Account', labelAr: 'حساب مكرر' },
  { value: 'fraudulent_information', label: 'Fraudulent Information', labelAr: 'معلومات احتيالية' },
  { value: 'other', label: 'Other', labelAr: 'أخرى' },
]

const suspensionReasons = [
  { value: 'repeated_violations', label: 'Repeated Violations', labelAr: 'مخالفات متكررة' },
  { value: 'fraudulent_activity', label: 'Fraudulent Activity', labelAr: 'نشاط احتيالي' },
  { value: 'quality_complaints', label: 'Quality Complaints', labelAr: 'شكاوى الجودة' },
  { value: 'delivery_issues', label: 'Delivery Issues', labelAr: 'مشاكل التوصيل' },
  { value: 'customer_complaints', label: 'Customer Complaints', labelAr: 'شكاوى العملاء' },
  { value: 'policy_violation', label: 'Policy Violation', labelAr: 'انتهاك السياسة' },
  { value: 'other', label: 'Other', labelAr: 'أخرى' },
]

const AdminVendors = () => {
  const { t } = useTranslation()
  const [statusFilter, setStatusFilter] = useState('all')
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)

  // Rejection modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [rejectingVendorId, setRejectingVendorId] = useState(null)
  const [rejectingVendorName, setRejectingVendorName] = useState('')
  const [selectedRejectionReason, setSelectedRejectionReason] = useState('')
  const [customRejectionReason, setCustomRejectionReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  // Suspension modal state
  const [suspendModalOpen, setSuspendModalOpen] = useState(false)
  const [suspendingVendorId, setSuspendingVendorId] = useState(null)
  const [suspendingVendorName, setSuspendingVendorName] = useState('')
  const [selectedSuspensionReason, setSelectedSuspensionReason] = useState('')
  const [customSuspensionReason, setCustomSuspensionReason] = useState('')
  const [suspensionEndDate, setSuspensionEndDate] = useState('')
  const [suspending, setSuspending] = useState(false)

  // View vendor details modal
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [viewingVendor, setViewingVendor] = useState(null)

  useEffect(() => {
    loadVendors()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadVendors = async () => {
    try {
      setLoading(true)

      // Fetch all vendors from profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, city, country, store_name, store_description, role, vendor_status, is_verified, vendor_warning_count, latitude, longitude, created_at')
        .eq('role', 'vendor')
        .order('created_at', { ascending: false })

      if (profilesError) throw profilesError

      const vendorRows = profilesData || []
      const vendorIds = vendorRows.map((vendor) => vendor.id)

      if (vendorIds.length === 0) {
        setVendors([])
        return
      }

      const [productsResult, reviewsResult] = await Promise.all([
        supabase
          .from('products')
          .select('vendor_id')
          .in('vendor_id', vendorIds),
        supabase
          .from('reviews')
          .select('vendor_id, rating')
          .in('vendor_id', vendorIds),
      ])

      if (productsResult.error) throw productsResult.error
      if (reviewsResult.error) throw reviewsResult.error

      const productCountsByVendor = new Map()
      ;(productsResult.data || []).forEach((row) => {
        const current = productCountsByVendor.get(row.vendor_id) || 0
        productCountsByVendor.set(row.vendor_id, current + 1)
      })

      const ratingsByVendor = new Map()
      ;(reviewsResult.data || []).forEach((row) => {
        const current = ratingsByVendor.get(row.vendor_id) || { sum: 0, count: 0 }
        ratingsByVendor.set(row.vendor_id, {
          sum: current.sum + Number(row.rating || 0),
          count: current.count + 1,
        })
      })

      const vendorsWithProducts = vendorRows.map((vendor) => {
        const ratings = ratingsByVendor.get(vendor.id)
        const avgRating = ratings?.count ? ratings.sum / ratings.count : null

        // Determine status from vendor_status field
        const status = vendor.vendor_status || 'pending'

        return {
          id: vendor.id,
          store_name: vendor.store_name || `${vendor.first_name} ${vendor.last_name}`,
          owner: `${vendor.first_name} ${vendor.last_name}`,
          email: vendor.email,
          phone: vendor.phone,
          city: vendor.city,
          country: vendor.country,
          store_description: vendor.store_description,
          location: vendor.city || 'N/A',
          status,
          vendor_status: vendor.vendor_status,
          is_suspended: status === 'suspended',
          suspension_reason: null,
          suspension_start: null,
          suspension_end: null,
          violation_count: vendor.vendor_warning_count || 0,
          rating: avgRating ? parseFloat(avgRating.toFixed(1)) : null,
          products: productCountsByVendor.get(vendor.id) || 0,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          created_at: vendor.created_at,
        }
      })

      setVendors(vendorsWithProducts)
    } catch (error) {
      logger.error('Error loading vendors:', error)
      toast.error(t('admin.vendors.errors.loadFailed', 'Failed to load vendors data'))
    } finally {
      setLoading(false)
    }
  }

  const filteredVendors = statusFilter === 'all'
    ? vendors
    : vendors.filter(v => v.status === statusFilter)

  // Send notification to vendor
  const sendVendorNotification = async (vendorId, title, message, type = 'system') => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: vendorId,
          title,
          message,
          type,
          data: { source: 'admin' }
        })

      if (error) {
        logger.error('Error sending notification:', error)
      }
    } catch (error) {
      logger.error('Error sending notification:', error)
    }
  }

  const handleApprove = async (id, vendorName) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          vendor_status: 'approved',
          is_verified: true,
        })
        .eq('id', id)

      if (error) throw error

      // Send approval notification to vendor
      await sendVendorNotification(
        id,
        t('admin.vendors.notifications.approvedTitle', '✅ Vendor Application Approved'),
        t('admin.vendors.notifications.approvedMessage', 'Congratulations! Your vendor application has been approved. You can now list products and start selling on Qotoof.'),
        'system'
      )

      // Log audit
      await auditLogger.logProfileAction('VENDOR_APPROVED', {
        vendor_id: id,
        vendor_name: vendorName,
      })

      toast.success(t('admin.vendors.notifications.approvedSuccess', 'Vendor approved successfully'))
      await loadVendors()
    } catch (error) {
      logger.error('Error approving vendor:', error)
      toast.error(t('admin.vendors.errors.approveFailed', 'Failed to approve vendor'))
    }
  }

  const openRejectModal = (vendor) => {
    setRejectingVendorId(vendor.id)
    setRejectingVendorName(vendor.store_name)
    setSelectedRejectionReason('')
    setCustomRejectionReason('')
    setRejectModalOpen(true)
  }

  const handleReject = async () => {
    if (!selectedRejectionReason) {
      toast.error(t('admin.vendors.errors.selectRejectionReason', 'Please select a rejection reason'))
      return
    }

    if (selectedRejectionReason === 'other' && !customRejectionReason.trim()) {
      toast.error(t('admin.vendors.errors.customRejectionReason', 'Please provide a rejection reason'))
      return
    }

    setRejecting(true)

    try {
      const finalReason = selectedRejectionReason === 'other'
        ? customRejectionReason
        : rejectionReasons.find(r => r.value === selectedRejectionReason)?.label || selectedRejectionReason

      const { error } = await supabase
        .from('profiles')
        .update({
          vendor_status: 'rejected',
          is_verified: false,
        })
        .eq('id', rejectingVendorId)

      if (error) throw error

      // Send rejection notification to vendor with reason
      await sendVendorNotification(
        rejectingVendorId,
        t('admin.vendors.notifications.rejectedTitle', '❌ Vendor Application Rejected'),
        t('admin.vendors.notifications.rejectedMessage', 'Your vendor application has been rejected. Reason: {{reason}}. You may reapply after addressing the issues.', { reason: finalReason }),
        'system'
      )

      // Log audit
      await auditLogger.logProfileAction('VENDOR_REJECTED', {
        vendor_id: rejectingVendorId,
        vendor_name: rejectingVendorName,
        rejection_reason: finalReason,
      })

      toast.success(t('admin.vendors.notifications.rejectedSuccess', 'Vendor application rejected'))
      setRejectModalOpen(false)
      await loadVendors()
    } catch (error) {
      logger.error('Error rejecting vendor:', error)
      toast.error(t('admin.vendors.errors.rejectFailed', 'Failed to reject vendor'))
    } finally {
      setRejecting(false)
    }
  }

  const openSuspendModal = (vendor) => {
    setSuspendingVendorId(vendor.id)
    setSuspendingVendorName(vendor.store_name)
    setSelectedSuspensionReason('')
    setCustomSuspensionReason('')
    setSuspensionEndDate('')
    setSuspendModalOpen(true)
  }

  const handleSuspend = async () => {
    if (!selectedSuspensionReason) {
      toast.error(t('admin.vendors.errors.selectSuspensionReason', 'Please select a suspension reason'))
      return
    }

    if (selectedSuspensionReason === 'other' && !customSuspensionReason.trim()) {
      toast.error(t('admin.vendors.errors.customSuspensionReason', 'Please provide a suspension reason'))
      return
    }

    setSuspending(true)

    try {
      const finalReason = selectedSuspensionReason === 'other'
        ? customSuspensionReason
        : suspensionReasons.find(r => r.value === selectedSuspensionReason)?.label || selectedSuspensionReason

      const updateData = {
        vendor_status: 'suspended',
        vendor_warning_count: (vendors.find(v => v.id === suspendingVendorId)?.violation_count || 0) + 1,
      }

      if (suspensionEndDate) {
        // Date is currently used for notification messaging only in this schema.
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', suspendingVendorId)

      if (error) throw error

      // Send suspension notification to vendor
      const suspensionMsg = suspensionEndDate
        ? t('admin.vendors.notifications.suspendedWithEndMessage', 'Your vendor account has been suspended. Reason: {{reason}}. Suspension end date: {{endDate}}. You cannot list or sell products during this period.', { reason: finalReason, endDate: new Date(suspensionEndDate).toLocaleDateString() })
        : t('admin.vendors.notifications.suspendedIndefiniteMessage', 'Your vendor account has been suspended indefinitely. Reason: {{reason}}. You cannot list or sell products until the suspension is lifted.', { reason: finalReason })

      await sendVendorNotification(
        suspendingVendorId,
        t('admin.vendors.notifications.suspendedTitle', '⚠️ Vendor Account Suspended'),
        suspensionMsg,
        'system'
      )

      // Log audit
      await auditLogger.logProfileAction('VENDOR_SUSPENDED', {
        vendor_id: suspendingVendorId,
        vendor_name: suspendingVendorName,
        suspension_reason: finalReason,
        suspension_end: suspensionEndDate || 'indefinite',
      })

      toast.success(t('admin.vendors.notifications.suspendedSuccess', 'Vendor account suspended'))
      setSuspendModalOpen(false)
      await loadVendors()
    } catch (error) {
      logger.error('Error suspending vendor:', error)
      toast.error(t('admin.vendors.errors.suspendFailed', 'Failed to suspend vendor'))
    } finally {
      setSuspending(false)
    }
  }

  const handleUnsuspend = async (id, vendorName) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          vendor_status: 'approved',
        })
        .eq('id', id)

      if (error) throw error

      // Send unsuspension notification to vendor
      await sendVendorNotification(
        id,
        t('admin.vendors.notifications.unsuspendedTitle', '✅ Vendor Account Restored'),
        t('admin.vendors.notifications.unsuspendedMessage', 'Your vendor account has been restored. You can now list products and resume selling on Qotoof.'),
        'system'
      )

      // Log audit
      await auditLogger.logProfileAction('VENDOR_UNSUSPENDED', {
        vendor_id: id,
        vendor_name: vendorName,
      })

      toast.success(t('admin.vendors.notifications.unsuspendedSuccess', 'Vendor account restored'))
      await loadVendors()
    } catch (error) {
      logger.error('Error unsuspending vendor:', error)
      toast.error(t('admin.vendors.errors.unsuspendFailed', 'Failed to restore vendor'))
    }
  }

  const openViewModal = (vendor) => {
    setViewingVendor(vendor)
    setViewModalOpen(true)
  }

  const getStatusBadge = (vendor) => {
    if (vendor.status === 'suspended') {
      return <Badge variant="danger">{t('admin.vendors.suspended', 'Suspended')}</Badge>
    }
    if (vendor.status === 'approved') {
      return <Badge variant="primary">{t('admin.vendors.approved', 'Approved')}</Badge>
    }
    if (vendor.status === 'rejected') {
      return <Badge variant="danger">{t('admin.vendors.rejected', 'Rejected')}</Badge>
    }
    return <Badge variant="warning">{t('admin.vendors.pending', 'Pending')}</Badge>
  }

  if (loading) {
    return <LoadingSpinner size="lg" />
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('admin.vendors.title')}</h1>

      {/* Status Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'all', label: t('admin.vendors.filters.all', 'All') },
          { key: 'approved', label: t('admin.vendors.filters.approved', 'Approved') },
          { key: 'pending', label: t('admin.vendors.filters.pending', 'Pending') },
          { key: 'rejected', label: t('admin.vendors.filters.rejected', 'Rejected') },
          { key: 'suspended', label: t('admin.vendors.filters.suspended', 'Suspended') },
        ].map((status) => (
          <button
            key={status.key}
            onClick={() => setStatusFilter(status.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              statusFilter === status.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status.label}
          </button>
        ))}
      </div>

      {/* Vendors Grid */}
      <div className="space-y-4">
        {filteredVendors.length === 0 && (
          <Card className="p-6 text-center text-gray-500">
            {t('admin.vendors.empty', 'لا يوجد باعة مطابقون للفلاتر الحالية')}
          </Card>
        )}
        {filteredVendors.map((vendor) => (
          <Card key={vendor.id} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{vendor.store_name}</h3>
                  {getStatusBadge(vendor)}
                  {vendor.violation_count > 0 && (
                    <span className="text-xs text-red-600 flex items-center gap-1">
                      <ExclamationTriangleIcon className="w-4 h-4" />
                      {vendor.violation_count} {t('admin.vendors.violations', 'violations')}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">{t('admin.vendors.owner', 'Owner')}:</span> {vendor.owner}
                </p>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">{t('admin.vendors.email', 'Email')}:</span> {vendor.email}
                </p>
                <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                  <MapPinIcon className="w-4 h-4" />
                  <span>{vendor.location}</span>
                </div>

                {vendor.is_suspended && vendor.suspension_reason && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      <span className="font-medium">{t('admin.vendors.suspensionReason', 'Suspension Reason')}:</span> {vendor.suspension_reason}
                    </p>
                    {vendor.suspension_end && (
                      <p className="text-sm text-red-700 mt-1">
                        <span className="font-medium">{t('admin.vendors.suspensionEnd', 'End Date')}:</span> {new Date(vendor.suspension_end).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {vendor.status === 'approved' && !vendor.is_suspended && (
                  <div className="flex items-center gap-4 text-sm mt-2">
                    {vendor.rating !== null ? (
                      <span className="text-yellow-600">★ {vendor.rating}</span>
                    ) : (
                      <span className="text-gray-400">{t('admin.vendors.noRatings', 'No ratings yet')}</span>
                    )}
                    <span>{vendor.products} {t('admin.vendors.products', 'products')}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* View Details Button */}
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<EyeIcon className="w-4 h-4" />}
                  onClick={() => openViewModal(vendor)}
                >
                  {t('admin.vendors.viewDetails', 'View')}
                </Button>

                {/* Pending Actions */}
                {vendor.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<CheckIcon className="w-4 h-4" />}
                      onClick={() => handleApprove(vendor.id, vendor.store_name)}
                    >
                      {t('admin.vendors.approve')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<XMarkIcon className="w-4 h-4" />}
                      onClick={() => openRejectModal(vendor)}
                    >
                      {t('admin.vendors.reject')}
                    </Button>
                  </div>
                )}

                {/* Approved Actions */}
                {vendor.status === 'approved' && !vendor.is_suspended && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<ExclamationTriangleIcon className="w-4 h-4 text-red-600" />}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => openSuspendModal(vendor)}
                  >
                    {t('admin.vendors.suspend', 'Suspend')}
                  </Button>
                )}

                {/* Suspended Actions */}
                {vendor.is_suspended && (
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<BellIcon className="w-4 h-4" />}
                    onClick={() => handleUnsuspend(vendor.id, vendor.store_name)}
                  >
                    {t('admin.vendors.unsuspend', 'Unsuspend')}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Rejection Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={t('admin.vendors.rejectModal.title', 'Reject Vendor Application')}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              {t('admin.vendors.rejectModal.warning', 'You are about to reject the application for "{{vendorName}}". The vendor will be notified with the rejection reason.', { vendorName: rejectingVendorName })}
            </p>
          </div>

          <div>
            <label className="input-label">{t('admin.vendors.rejectModal.reason', 'Reason for Rejection')}</label>
            <select
              value={selectedRejectionReason}
              onChange={(e) => setSelectedRejectionReason(e.target.value)}
              className="input"
            >
              <option value="">{t('admin.vendors.rejectModal.selectReason', 'Select a reason')}</option>
              {rejectionReasons.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          {selectedRejectionReason === 'other' && (
            <div>
              <label className="input-label">{t('admin.vendors.rejectModal.otherReason', 'Please specify')}</label>
              <textarea
                value={customRejectionReason}
                onChange={(e) => setCustomRejectionReason(e.target.value)}
                className="input min-h-[80px]"
                placeholder={t('admin.vendors.rejectModal.otherPlaceholder', 'Describe the reason...')}
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              onClick={handleReject}
              disabled={rejecting || !selectedRejectionReason || (selectedRejectionReason === 'other' && !customRejectionReason.trim())}
              className="flex-1"
            >
              {rejecting ? (
                <>
                  <LoadingSpinner size="sm" />
                  {t('admin.vendors.rejectModal.rejecting', 'Rejecting...')}
                </>
              ) : (
                t('admin.vendors.rejectModal.confirmReject', 'Confirm Rejection')
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setRejectModalOpen(false)}
              disabled={rejecting}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Suspension Modal */}
      <Modal
        isOpen={suspendModalOpen}
        onClose={() => setSuspendModalOpen(false)}
        title={t('admin.vendors.suspendModal.title', 'Suspend Vendor Account')}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              {t('admin.vendors.suspendModal.warning', 'You are about to suspend "{{vendorName}}". The vendor will not be able to list or sell products during suspension.', { vendorName: suspendingVendorName })}
            </p>
          </div>

          <div>
            <label className="input-label">{t('admin.vendors.suspendModal.reason', 'Reason for Suspension')}</label>
            <select
              value={selectedSuspensionReason}
              onChange={(e) => setSelectedSuspensionReason(e.target.value)}
              className="input"
            >
              <option value="">{t('admin.vendors.suspendModal.selectReason', 'Select a reason')}</option>
              {suspensionReasons.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          {selectedSuspensionReason === 'other' && (
            <div>
              <label className="input-label">{t('admin.vendors.suspendModal.otherReason', 'Please specify')}</label>
              <textarea
                value={customSuspensionReason}
                onChange={(e) => setCustomSuspensionReason(e.target.value)}
                className="input min-h-[80px]"
                placeholder={t('admin.vendors.suspendModal.otherPlaceholder', 'Describe the reason...')}
              />
            </div>
          )}

          <div>
            <label className="input-label">{t('admin.vendors.suspendModal.endDate', 'Suspension End Date (optional)')}</label>
            <input
              type="date"
              value={suspensionEndDate}
              onChange={(e) => setSuspensionEndDate(e.target.value)}
              className="input"
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('admin.vendors.suspendModal.endDateHint', 'Leave empty for indefinite suspension')}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              onClick={handleSuspend}
              disabled={suspending || !selectedSuspensionReason || (selectedSuspensionReason === 'other' && !customSuspensionReason.trim())}
              className="flex-1"
            >
              {suspending ? (
                <>
                  <LoadingSpinner size="sm" />
                  {t('admin.vendors.suspendModal.suspending', 'Suspending...')}
                </>
              ) : (
                t('admin.vendors.suspendModal.confirmSuspend', 'Confirm Suspension')
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setSuspendModalOpen(false)}
              disabled={suspending}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Vendor Details Modal */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={t('admin.vendors.viewModal.title', 'Vendor Details')}
        size="lg"
      >
        {viewingVendor && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">{t('admin.vendors.viewModal.storeName', 'Store Name')}</p>
                <p className="font-medium">{viewingVendor.store_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.vendors.viewModal.owner', 'Owner')}</p>
                <p className="font-medium">{viewingVendor.owner}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.vendors.viewModal.email', 'Email')}</p>
                <p className="font-medium">{viewingVendor.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.vendors.viewModal.phone', 'Phone')}</p>
                <p className="font-medium">{viewingVendor.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.vendors.viewModal.location', 'Location')}</p>
                <p className="font-medium">{viewingVendor.city || 'N/A'}{viewingVendor.country ? `, ${viewingVendor.country}` : ''}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.vendors.viewModal.status', 'Status')}</p>
                <div className="mt-1">{getStatusBadge(viewingVendor)}</div>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.vendors.viewModal.products', 'Products')}</p>
                <p className="font-medium">{viewingVendor.products}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.vendors.viewModal.rating', 'Rating')}</p>
                <p className="font-medium">{viewingVendor.rating ? `★ ${viewingVendor.rating}` : t('admin.vendors.viewModal.noRating', 'No ratings yet')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.vendors.viewModal.violations', 'Violations')}</p>
                <p className="font-medium">{viewingVendor.violation_count}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">{t('admin.vendors.viewModal.registeredAt', 'Registered At')}</p>
                <p className="font-medium">{new Date(viewingVendor.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {viewingVendor.store_description && (
              <div>
                <p className="text-sm text-gray-500">{t('admin.vendors.viewModal.description', 'Store Description')}</p>
                <p className="mt-1 text-gray-700">{viewingVendor.store_description}</p>
              </div>
            )}

            {viewingVendor.is_suspended && viewingVendor.suspension_reason && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <span className="font-medium">{t('admin.vendors.viewModal.suspensionReason', 'Suspension Reason')}:</span> {viewingVendor.suspension_reason}
                </p>
                {viewingVendor.suspension_start && (
                  <p className="text-sm text-red-700 mt-1">
                    <span className="font-medium">{t('admin.vendors.viewModal.suspensionStart', 'Since')}:</span> {new Date(viewingVendor.suspension_start).toLocaleDateString()}
                  </p>
                )}
                {viewingVendor.suspension_end && (
                  <p className="text-sm text-red-700 mt-1">
                    <span className="font-medium">{t('admin.vendors.viewModal.suspensionEnd', 'End Date')}:</span> {new Date(viewingVendor.suspension_end).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default AdminVendors
