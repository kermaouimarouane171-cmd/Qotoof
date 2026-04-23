import { useEffect, useMemo, useState } from 'react'
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

const statusMeta = {
  open: {
    label: 'مفتوح',
    className: 'bg-red-100 text-red-700',
  },
  under_review: {
    label: 'قيد المراجعة',
    className: 'bg-amber-100 text-amber-800',
  },
  resolved_vendor: {
    label: 'حُسم لصالح البائع',
    className: 'bg-emerald-100 text-emerald-700',
  },
  resolved_buyer: {
    label: 'حُسم لصالح المشتري',
    className: 'bg-blue-100 text-blue-700',
  },
  closed: {
    label: 'مغلق',
    className: 'bg-gray-100 text-gray-700',
  },
}

const disputeTypeLabel = {
  not_paid: 'امتناع عن السداد',
  not_delivered: 'ادعاء بعدم التسليم',
  wrong_amount: 'مبلغ خاطئ',
}

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('ar-MA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getBuyerName = (dispute) => {
  const buyer = dispute?.buyer || {}
  return `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() || 'مشتري غير معروف'
}

const getVendorName = (dispute) => {
  const vendor = dispute?.vendor || {}
  return vendor.store_name || `${vendor.first_name || ''} ${vendor.last_name || ''}`.trim() || 'بائع غير معروف'
}

const DisputeManagement = () => {
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
      toast.error(error.message || 'تعذر تحميل النزاعات المالية.')
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
      const vendorName = getVendorName(dispute).toLowerCase()
      const buyerName = getBuyerName(dispute).toLowerCase()
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

      toast.success('تم نقل النزاع إلى حالة قيد المراجعة.')
      await refreshSelectedDispute(selectedDispute.id)
    } catch (error) {
      toast.error(error.message || 'تعذر تحديث حالة النزاع.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolveVendor = async () => {
    if (!selectedDispute || !resolution.trim()) {
      toast.error('أدخل قرار الحسم قبل المتابعة.')
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

      toast.success('تم حسم النزاع لصالح البائع وتطبيق الأثر المناسب.')
      await refreshSelectedDispute(selectedDispute.id)
    } catch (error) {
      toast.error(error.message || 'تعذر حسم النزاع لصالح البائع.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolveBuyer = async () => {
    if (!selectedDispute || !resolution.trim()) {
      toast.error('أدخل قرار الحسم قبل المتابعة.')
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

      toast.success('تم حسم النزاع لصالح المشتري دون معاقبته.')
      await refreshSelectedDispute(selectedDispute.id)
    } catch (error) {
      toast.error(error.message || 'تعذر حسم النزاع لصالح المشتري.')
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

      toast.success('تم إغلاق النزاع.')
      await refreshSelectedDispute(selectedDispute.id)
    } catch (error) {
      toast.error(error.message || 'تعذر إغلاق النزاع.')
    } finally {
      setActionLoading(false)
    }
  }

  const selectedStatusMeta = selectedDispute ? (statusMeta[selectedDispute.status] || statusMeta.open) : statusMeta.open

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة نزاعات الدفع</h1>
          <p className="mt-1 text-sm text-gray-500">مراجعة النزاعات، الإفراج عن بيانات المشتري عند الاستحقاق النظامي، وتطبيق أثر الثقة بشكل مركزي.</p>
        </div>

        <button
          type="button"
          onClick={loadDisputes}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowPathIcon className="h-4 w-4" />
          تحديث
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-5 bg-white">
          <p className="text-sm text-gray-500">نزاعات مفتوحة</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{summary.open}</p>
        </Card>
        <Card className="p-5 bg-white">
          <p className="text-sm text-gray-500">قيد المراجعة</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{summary.review}</p>
        </Card>
        <Card className="p-5 bg-white">
          <p className="text-sm text-gray-500">حُسمت للبائع</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{summary.vendorWins}</p>
        </Card>
        <Card className="p-5 bg-white">
          <p className="text-sm text-gray-500">حُسمت للمشتري</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">{summary.buyerWins}</p>
        </Card>
      </div>

      <Card className="p-5 bg-white">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث برقم الطلب أو اسم البائع أو المشتري"
            className="input"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="input"
          >
            <option value="all">كل الحالات</option>
            <option value="open">مفتوح</option>
            <option value="under_review">قيد المراجعة</option>
            <option value="resolved_vendor">لصالح البائع</option>
            <option value="resolved_buyer">لصالح المشتري</option>
            <option value="closed">مغلق</option>
          </select>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            إجمالي النتائج الحالية: <strong>{filteredDisputes.length}</strong>
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
            <p className="mt-4 text-gray-500">لا توجد نزاعات مطابقة للفلاتر الحالية.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">الطلب</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">البائع</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">المشتري</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">النوع</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">الحالة</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">أُنشئ في</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredDisputes.map((dispute) => {
                  const meta = statusMeta[dispute.status] || statusMeta.open

                  return (
                    <tr key={dispute.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm text-gray-900 font-medium">#{dispute.order?.order_number || dispute.order_id?.slice(0, 8)}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{getVendorName(dispute)}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{getBuyerName(dispute)}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{disputeTypeLabel[dispute.dispute_type] || dispute.dispute_type}</td>
                      <td className="px-4 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>
                          {meta.label}
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
                          التفاصيل
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
        title={selectedDispute ? `تفاصيل النزاع #${selectedDispute.order?.order_number || selectedDispute.order_id?.slice(0, 8)}` : 'تفاصيل النزاع'}
      >
        {selectedDispute && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${selectedStatusMeta.className}`}>
                  {selectedStatusMeta.label}
                </span>
                {selectedDispute.buyer_data_released && (
                  <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                    تم الإفراج عن بيانات المشتري
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500">آخر تحديث: {formatDate(selectedDispute.resolved_at || selectedDispute.created_at)}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-4 bg-gray-50">
                <div className="flex items-center gap-2 mb-3 text-gray-900 font-semibold">
                  <UserIcon className="h-5 w-5" />
                  المشتري
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>{getBuyerName(selectedDispute)}</p>
                  <p className="flex items-center gap-2"><EnvelopeIcon className="h-4 w-4" /> {selectedDispute.buyer?.email || '-'}</p>
                  <p className="flex items-center gap-2"><PhoneIcon className="h-4 w-4" /> {selectedDispute.buyer?.phone || '-'}</p>
                  <p className="flex items-center gap-2"><MapPinIcon className="h-4 w-4" /> {selectedDispute.buyer?.city || '-'} {selectedDispute.buyer?.address ? `- ${selectedDispute.buyer.address}` : ''}</p>
                </div>
              </Card>

              <Card className="p-4 bg-gray-50">
                <div className="flex items-center gap-2 mb-3 text-gray-900 font-semibold">
                  <ShieldCheckIcon className="h-5 w-5" />
                  البائع والطلب
                </div>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>{getVendorName(selectedDispute)}</p>
                  <p>نوع النزاع: {disputeTypeLabel[selectedDispute.dispute_type] || selectedDispute.dispute_type}</p>
                  <p>رقم الطلب: #{selectedDispute.order?.order_number || selectedDispute.order_id?.slice(0, 8)}</p>
                  <p>تاريخ الإنشاء: {formatDate(selectedDispute.created_at)}</p>
                </div>
              </Card>
            </div>

            <Card className="p-4 bg-red-50 border border-red-200">
              <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5" />
                وصف النزاع
              </h3>
              <p className="text-sm leading-7 text-red-900">{selectedDispute.description}</p>
            </Card>

            <Card className="p-4 bg-white">
              <h3 className="font-semibold text-gray-900 mb-3">أدلة النزاع</h3>
              {evidenceLinks.length === 0 ? (
                <p className="text-sm text-gray-500">لا توجد مرفقات أدلة على هذا النزاع.</p>
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
                <h3 className="font-semibold text-amber-900 mb-2">بيانات المشتري المفرج عنها لأغراض التحصيل</h3>
                <p className="text-sm text-amber-900 leading-7">
                  تم الإفراج عن بيانات المشتري الأساسية لأن النزاع حُسم لصالح البائع. هذا الإفراج يجب أن يبقى محصوراً في إجراءات التحصيل أو المتابعة القانونية المرتبطة بهذا الطلب فقط.
                </p>
              </Card>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات الإدارة</label>
                <textarea
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  className="input min-h-[110px] resize-y"
                  placeholder="اكتب ملاحظات التحقيق أو القرائن التشغيلية هنا"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">قرار الحسم</label>
                <textarea
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  className="input min-h-[110px] resize-y"
                  placeholder="اكتب نص القرار النهائي الذي سيُحفظ على النزاع"
                />
              </div>

              <label className="inline-flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={releaseBuyerData}
                  onChange={(event) => setReleaseBuyerData(event.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                الإفراج عن بيانات المشتري للبائع أو لجهة التحصيل إذا تم الحسم لصالح البائع
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
                قيد المراجعة
              </button>

              <button
                type="button"
                onClick={handleResolveVendor}
                disabled={actionLoading || selectedDispute.status === 'closed'}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircleIcon className="h-4 w-4" />
                حسم للبائع
              </button>

              <button
                type="button"
                onClick={handleResolveBuyer}
                disabled={actionLoading || selectedDispute.status === 'closed'}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <ShieldCheckIcon className="h-4 w-4" />
                حسم للمشتري
              </button>

              <button
                type="button"
                onClick={handleCloseDispute}
                disabled={actionLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <XCircleIcon className="h-4 w-4" />
                إغلاق النزاع
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default DisputeManagement