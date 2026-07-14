import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UserIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Card, LoadingSpinner, Modal } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import disputeService from '@/services/disputeService'

const STATUS_CLASS = {
  open:            'bg-red-100 text-red-700',
  under_review:    'bg-amber-100 text-amber-800',
  resolved_vendor: 'bg-emerald-100 text-emerald-700',
  resolved_buyer:  'bg-blue-100 text-blue-700',
  closed:          'bg-gray-100 text-gray-700',
}

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const getBuyerName = (dispute, t) => {
  const buyer = dispute?.buyer || {}
  return `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || t('admin.disputes.unknownBuyer', 'Unknown Buyer')
}

const getVendorName = (dispute, t) => {
  const vendor = dispute?.vendor || {}
  return vendor.store_name || `${vendor.first_name || ''} ${vendor.last_name || ''}`.trim() || t('admin.disputes.unknownVendor', 'Unknown Vendor')
}

const DisputeManagement = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [disputes, setDisputes] = useState([])
  const [selectedDispute, setSelectedDispute] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [resolution, setResolution] = useState('')
  const [releaseBuyerData, setReleaseBuyerData] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [evidenceLinks, setEvidenceLinks] = useState([])

  const loadDisputes = async () => {
    setLoading(true)
    try {
      const data = await disputeService.getDisputes()
      setDisputes(data)
    } catch (error) {
      toast.error(error.message || t('admin.disputes.loadFailed', 'Failed to load disputes'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDisputes()
  }, [])

  useEffect(() => {
    let active = true

    const resolveEvidenceLinks = async () => {
      if (!selectedDispute?.evidence_urls?.length) {
        if (active) setEvidenceLinks([])
        return
      }

      const resolvedLinks = await Promise.all(
        selectedDispute.evidence_urls.map(async (path) => {
          if (path.startsWith('http')) {
            return { path, signedUrl: path }
          }

          const { data } = await supabase.storage
            .from('dispute-evidence')
            .createSignedUrl(path, 60 * 60)

          return {
            path,
            signedUrl: data?.signedUrl || '',
          }
        })
      )

      if (active) {
        setEvidenceLinks(resolvedLinks)
      }
    }

    resolveEvidenceLinks()

    return () => {
      active = false
    }
  }, [selectedDispute])

  const filteredDisputes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return disputes.filter((dispute) => {
      const orderNumber = String(dispute.order?.order_number || dispute.order_id || '').toLowerCase()
      const vendorName = getVendorName(dispute, t).toLowerCase()
      const buyerName = getBuyerName(dispute, t).toLowerCase()
      const description = String(dispute.description || '').toLowerCase()
      const matchesSearch = !normalizedSearch || orderNumber.includes(normalizedSearch) || vendorName.includes(normalizedSearch) || buyerName.includes(normalizedSearch) || description.includes(normalizedSearch)
      const matchesStatus = statusFilter === 'all' || dispute.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [disputes, search, statusFilter])

  const summary = useMemo(() => ({
    open: disputes.filter((dispute) => dispute.status === 'open').length,
    review: disputes.filter((dispute) => dispute.status === 'under_review').length,
    vendorWins: disputes.filter((dispute) => dispute.status === 'resolved_vendor').length,
    buyerWins: disputes.filter((dispute) => dispute.status === 'resolved_buyer').length,
  }), [disputes])

  const openDispute = (dispute) => {
    setSelectedDispute(dispute)
    setAdminNotes(dispute.admin_notes || '')
    setResolution(dispute.resolution || '')
    setReleaseBuyerData(dispute.buyer_data_released ?? true)
  }

  const refreshSelectedDispute = async (disputeId) => {
    const freshDispute = await disputeService.getDisputeById(disputeId)
    setSelectedDispute(freshDispute)
    setAdminNotes(freshDispute.admin_notes || '')
    setResolution(freshDispute.resolution || '')
    setReleaseBuyerData(freshDispute.buyer_data_released ?? true)
    await loadDisputes()
  }

  const handleMarkUnderReview = async () => {
    if (!selectedDispute) return

    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('payment_disputes')
        .update({
          status: 'under_review',
          admin_notes: adminNotes,
        })
        .eq('id', selectedDispute.id)

      if (error) throw error

      toast.success(t('admin.disputes.markedUnderReview', 'Dispute moved to Under Review'))
      await refreshSelectedDispute(selectedDispute.id)
    } catch (error) {
      toast.error(error.message || t('admin.disputes.updateFailed', 'Failed to update dispute'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolveVendor = async () => {
    if (!selectedDispute || !resolution.trim()) {
      toast.error(t('admin.disputes.resolutionRequired', 'Enter a resolution before proceeding'))
      return
    }

    setActionLoading(true)
    try {
      await disputeService.resolveInVendorFavor({
        disputeId: selectedDispute.id,
        adminId: user.id,
        resolution: resolution.trim(),
        adminNotes: adminNotes.trim(),
        releaseBuyerData,
      })

      toast.success(t('admin.disputes.resolvedVendor', 'Dispute resolved in favour of vendor'))
      await refreshSelectedDispute(selectedDispute.id)
    } catch (error) {
      toast.error(error.message || t('admin.disputes.resolveVendorFailed', 'Failed to resolve in vendor favour'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolveBuyer = async () => {
    if (!selectedDispute || !resolution.trim()) {
      toast.error(t('admin.disputes.resolutionRequired', 'Enter a resolution before proceeding'))
      return
    }

    setActionLoading(true)
    try {
      await disputeService.resolveInBuyerFavor({
        disputeId: selectedDispute.id,
        adminId: user.id,
        resolution: resolution.trim(),
        adminNotes: adminNotes.trim(),
      })

      toast.success(t('admin.disputes.resolvedBuyer', 'Dispute resolved in favour of buyer'))
      await refreshSelectedDispute(selectedDispute.id)
    } catch (error) {
      toast.error(error.message || t('admin.disputes.resolveBuyerFailed', 'Failed to resolve in buyer favour'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleCloseDispute = async () => {
    if (!selectedDispute) return

    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('payment_disputes')
        .update({
          status: 'closed',
          admin_notes: adminNotes.trim(),
          resolution: resolution.trim() || selectedDispute.resolution,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', selectedDispute.id)

      if (error) throw error

      toast.success(t('admin.disputes.closed', 'Dispute closed'))
      await refreshSelectedDispute(selectedDispute.id)
    } catch (error) {
      toast.error(error.message || t('admin.disputes.closeFailed', 'Failed to close dispute'))
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusLabel = (status) => ({
    open:            t('admin.disputes.status.open', 'Open'),
    under_review:    t('admin.disputes.status.underReview', 'Under Review'),
    resolved_vendor: t('admin.disputes.status.resolvedVendor', 'Resolved – Vendor'),
    resolved_buyer:  t('admin.disputes.status.resolvedBuyer', 'Resolved – Buyer'),
    closed:          t('admin.disputes.status.closed', 'Closed'),
  }[status] || status)

  const getTypeLabel = (type) => ({
    not_paid:      t('admin.disputes.type.notPaid', 'Non-Payment'),
    not_delivered: t('admin.disputes.type.notDelivered', 'Not Delivered'),
    wrong_amount:  t('admin.disputes.type.wrongAmount', 'Wrong Amount'),
  }[type] || type)

  const selectedStatusClass = selectedDispute ? (STATUS_CLASS[selectedDispute.status] || STATUS_CLASS.open) : STATUS_CLASS.open

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.disputes.title', 'Payment Disputes')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('admin.disputes.subtitle', 'Review disputes, release buyer data when legally required, and apply trust actions centrally.')}</p>
        </div>

        <button
          type="button"
          onClick={loadDisputes}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowPathIcon className="h-4 w-4" />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-5 bg-white">
          <p className="text-sm text-gray-500">{t('admin.disputes.stat.open', 'Open')}</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{summary.open}</p>
        </Card>
        <Card className="p-5 bg-white">
          <p className="text-sm text-gray-500">{t('admin.disputes.stat.underReview', 'Under Review')}</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{summary.review}</p>
        </Card>
        <Card className="p-5 bg-white">
          <p className="text-sm text-gray-500">{t('admin.disputes.stat.resolvedVendor', 'Resolved – Vendor')}</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{summary.vendorWins}</p>
        </Card>
        <Card className="p-5 bg-white">
          <p className="text-sm text-gray-500">{t('admin.disputes.stat.resolvedBuyer', 'Resolved – Buyer')}</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">{summary.buyerWins}</p>
        </Card>
      </div>

      <Card className="p-5 bg-white">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('admin.disputes.searchPlaceholder', 'Search by order #, vendor, or buyer')}
            className="input"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="input"
          >
            <option value="all">{t('admin.disputes.filter.all', 'All Statuses')}</option>
            <option value="open">{t('admin.disputes.status.open', 'Open')}</option>
            <option value="under_review">{t('admin.disputes.status.underReview', 'Under Review')}</option>
            <option value="resolved_vendor">{t('admin.disputes.status.resolvedVendor', 'Resolved – Vendor')}</option>
            <option value="resolved_buyer">{t('admin.disputes.status.resolvedBuyer', 'Resolved – Buyer')}</option>
            <option value="closed">{t('admin.disputes.status.closed', 'Closed')}</option>
          </select>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            {t('admin.disputes.resultCount', 'Results: {{count}}', { count: filteredDisputes.length })}
          </div>
        </div>
      </Card>

      <Card className="bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredDisputes.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShieldCheckIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">{t('admin.disputes.empty', 'No disputes match the current filters.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('admin.disputes.col.order', 'Order')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('admin.disputes.col.vendor', 'Vendor')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('admin.disputes.col.buyer', 'Buyer')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('admin.disputes.col.type', 'Type')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('admin.disputes.col.status', 'Status')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('admin.disputes.col.created', 'Created')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">{t('admin.disputes.col.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredDisputes.map((dispute) => {
                  const statusCls = STATUS_CLASS[dispute.status] || STATUS_CLASS.open

                  return (
                    <tr key={dispute.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm text-gray-900 font-medium">#{dispute.order?.order_number || dispute.order_id?.slice(0, 8)}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{getVendorName(dispute, t)}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{getBuyerName(dispute, t)}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{getTypeLabel(dispute.dispute_type)}</td>
                      <td className="px-4 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusCls}`}>
                          {getStatusLabel(dispute.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">{formatDate(dispute.created_at)}</td>
                      <td className="px-4 py-4 text-sm">
                        <button
                          type="button"
                          onClick={() => openDispute(dispute)}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <EyeIcon className="h-4 w-4" />
                          {t('admin.disputes.details', 'Details')}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={Boolean(selectedDispute)}
        onClose={() => setSelectedDispute(null)}
        size="lg"
        title={selectedDispute
          ? t('admin.disputes.modal.title', 'Dispute #{{id}}', { id: selectedDispute.order?.order_number || selectedDispute.order_id?.slice(0, 8) })
          : t('admin.disputes.modal.titleFallback', 'Dispute Details')}
      >
        {selectedDispute && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${selectedStatusClass}`}>
                  {getStatusLabel(selectedDispute.status)}
                </span>
                {selectedDispute.buyer_data_released && (
                  <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                    {t('admin.disputes.buyerDataReleased', 'Buyer Data Released')}
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500">{t('admin.disputes.lastUpdated', 'Last updated')}: {formatDate(selectedDispute.resolved_at || selectedDispute.created_at)}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-4 bg-gray-50">
                <div className="flex items-center gap-2 mb-3 text-gray-900 font-semibold">
                  <UserIcon className="h-5 w-5" />
                  {t('admin.disputes.buyer', 'Buyer')}
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>{getBuyerName(selectedDispute, t)}</p>
                  <p className="flex items-center gap-2"><EnvelopeIcon className="h-4 w-4" /> {selectedDispute.buyer?.email || '-'}</p>
                  <p className="flex items-center gap-2"><PhoneIcon className="h-4 w-4" /> {selectedDispute.buyer?.phone || '-'}</p>
                  <p className="flex items-center gap-2"><MapPinIcon className="h-4 w-4" /> {selectedDispute.buyer?.city || '-'} {selectedDispute.buyer?.address ? `- ${selectedDispute.buyer.address}` : ''}</p>
                </div>
              </Card>

              <Card className="p-4 bg-gray-50">
                <div className="flex items-center gap-2 mb-3 text-gray-900 font-semibold">
                  <ShieldCheckIcon className="h-5 w-5" />
                  {t('admin.disputes.vendorAndOrder', 'Vendor & Order')}
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>{getVendorName(selectedDispute, t)}</p>
                  <p>{t('admin.disputes.disputeType', 'Type')}: {getTypeLabel(selectedDispute.dispute_type)}</p>
                  <p>{t('admin.disputes.orderNumber', 'Order #')}: #{selectedDispute.order?.order_number || selectedDispute.order_id?.slice(0, 8)}</p>
                  <p>{t('admin.disputes.createdAt', 'Created')}: {formatDate(selectedDispute.created_at)}</p>
                </div>
              </Card>
            </div>

            <Card className="p-4 bg-red-50 border border-red-200">
              <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5" />
                {t('admin.disputes.description', 'Dispute Description')}
              </h3>
              <p className="text-sm leading-7 text-red-900">{selectedDispute.description}</p>
            </Card>

            <Card className="p-4 bg-white">
              <h3 className="font-semibold text-gray-900 mb-3">{t('admin.disputes.evidence', 'Evidence')}</h3>
              {evidenceLinks.length === 0 ? (
                <p className="text-sm text-gray-500">{t('admin.disputes.noEvidence', 'No evidence attachments for this dispute.')}</p>
              ) : (
                <div className="space-y-2">
                  {evidenceLinks.map((evidence) => (
                    <a
                      key={evidence.path}
                      href={evidence.signedUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <span className="truncate">{evidence.path.split('/').pop()}</span>
                      <EyeIcon className="h-4 w-4 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </Card>

            {selectedDispute.status === 'resolved_vendor' && selectedDispute.buyer_data_released && (
              <Card className="p-4 bg-amber-50 border border-amber-200">
                <h3 className="font-semibold text-amber-900 mb-2">{t('admin.disputes.buyerDataReleasedTitle', 'Buyer Data Released for Collection Purposes')}</h3>
                <p className="text-sm text-amber-900 leading-7">
                  {t('admin.disputes.buyerDataReleasedNote', 'Buyer data was released because the dispute was resolved in favour of the vendor. This release must remain limited to collection or legal follow-up procedures related to this order only.')}
                </p>
              </Card>
            )}

            <div className="space-y-3">
              <div>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.disputes.adminNotes', 'Admin Notes')}</label>
                <textarea
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  className="input min-h-[110px] resize-y"
                  placeholder={t('admin.disputes.adminNotesPlaceholder', 'Write investigation notes or operational evidence here')}
                />
              </div>

              <div>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.disputes.resolutionLabel', 'Resolution')}</label>
                <textarea
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  className="input min-h-[110px] resize-y"
                  placeholder={t('admin.disputes.resolutionPlaceholder', 'Write the final resolution text that will be saved on the dispute')}
                />
              </div>

              <label className="inline-flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={releaseBuyerData}
                  onChange={(event) => setReleaseBuyerData(event.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                {t('admin.disputes.releaseBuyerData', 'Release buyer data to vendor or collection agency if resolved in vendor’s favour')}
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={handleMarkUnderReview}
                disabled={actionLoading || selectedDispute.status === 'closed'}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                <ClockIcon className="h-4 w-4" />
                {t('admin.disputes.action.underReview', 'Under Review')}
              </button>

              <button
                type="button"
                onClick={handleResolveVendor}
                disabled={actionLoading || selectedDispute.status === 'closed'}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircleIcon className="h-4 w-4" />
                {t('admin.disputes.action.resolveVendor', 'Resolve – Vendor')}
              </button>

              <button
                type="button"
                onClick={handleResolveBuyer}
                disabled={actionLoading || selectedDispute.status === 'closed'}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <ShieldCheckIcon className="h-4 w-4" />
                {t('admin.disputes.action.resolveBuyer', 'Resolve – Buyer')}
              </button>

              <button
                type="button"
                onClick={handleCloseDispute}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <XCircleIcon className="h-4 w-4" />
                {t('admin.disputes.action.close', 'Close Dispute')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default DisputeManagement