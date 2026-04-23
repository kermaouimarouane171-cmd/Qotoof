import { useEffect, useMemo, useState } from 'react'
import { Card, LoadingSpinner, Modal } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { commissionService } from '@/services/commissionService'
import { csvExport } from '@/services/reports/csvExport'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  LockOpenIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const getLocale = (language) => (language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-MA' : 'en-US')

const formatMAD = (value, language) =>
  new Intl.NumberFormat(getLocale(language), {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const statusClass = {
  active: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
}

const formatDate = (value, language) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(getLocale(language))
}

const getVendorName = (row, t) => {
  const fullName = `${row.vendor?.first_name || ''} ${row.vendor?.last_name || ''}`.trim()
  return row.vendor?.store_name || fullName || t('marketplaceFeatures.common.unknownStore')
}

const getPeriodLabel = (row) => {
  if (row.month_label) return row.month_label
  return `${row.month}/${row.year}`
}

const CommissionManagementPage = () => {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [selectedPaymentRow, setSelectedPaymentRow] = useState(null)
  const [selectedUnfreezeRow, setSelectedUnfreezeRow] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [paymentReference, setPaymentReference] = useState('')
  const [unfreezeNote, setUnfreezeNote] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  const [savingUnfreeze, setSavingUnfreeze] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    period: 'all',
    city: 'all',
  })

  const loadRows = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('vendor_monthly_sales')
        .select(`
          id,
          vendor_id,
          month,
          year,
          total_sales,
          commission_due,
          commission_paid,
          status,
          due_date,
          paid_at,
          payment_method,
          payment_reference,
          vendor:profiles!vendor_monthly_sales_vendor_id_fkey(id, first_name, last_name, store_name, email, city, is_active)
        `)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(400)

      if (error) throw error

      const normalizedRows = (data || [])
        .filter((row) => {
          const hasValue = Number(row.total_sales || 0) > 0 || Number(row.commission_due || 0) > 0 || Number(row.commission_paid || 0) > 0
          return hasValue || ['pending', 'overdue', 'paid'].includes(row.status)
        })
        .map((row) => ({
          ...row,
          month_label: new Date(row.year, row.month - 1, 1).toLocaleDateString('ar-MA', { month: 'long', year: 'numeric' }),
          balance_remaining: Number(Math.max(Number(row.commission_due || 0) - Number(row.commission_paid || 0), 0).toFixed(2)),
        }))

      setRows(normalizedRows)
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.commissionManagement.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRows()
  }, [])

  const periodOptions = useMemo(() => {
    const uniquePeriods = new Map()
    rows.forEach((row) => {
      const key = `${row.month}-${row.year}`
      if (!uniquePeriods.has(key)) {
        uniquePeriods.set(key, { key, label: getPeriodLabel(row) })
      }
    })
    return Array.from(uniquePeriods.values())
  }, [rows])

  const cityOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.vendor?.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar'))
  }, [rows])

  const statusLabel = useMemo(() => ({
    active: t('marketplaceFeatures.commissionManagement.statusLabels.active'),
    pending: t('marketplaceFeatures.commissionManagement.statusLabels.pending'),
    overdue: t('marketplaceFeatures.commissionManagement.statusLabels.overdue'),
    paid: t('marketplaceFeatures.commissionManagement.statusLabels.paid'),
  }), [t])

  const paymentMethodOptions = useMemo(() => ([
    { value: 'bank_transfer', label: t('marketplaceFeatures.commissionManagement.paymentMethods.bankTransfer') },
    { value: 'cash', label: t('marketplaceFeatures.commissionManagement.paymentMethods.cash') },
    { value: 'check', label: t('marketplaceFeatures.commissionManagement.paymentMethods.check') },
  ]), [t])

  const filteredRows = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase()

    return rows.filter((row) => {
      const vendorName = getVendorName(row, t).toLowerCase()
      const email = String(row.vendor?.email || '').toLowerCase()
      const city = String(row.vendor?.city || '').toLowerCase()
      const matchesSearch = !normalizedSearch || vendorName.includes(normalizedSearch) || email.includes(normalizedSearch) || city.includes(normalizedSearch)
      const matchesStatus = filters.status === 'all' || row.status === filters.status
      const matchesPeriod = filters.period === 'all' || `${row.month}-${row.year}` === filters.period
      const matchesCity = filters.city === 'all' || row.vendor?.city === filters.city
      return matchesSearch && matchesStatus && matchesPeriod && matchesCity
    })
  }, [rows, filters])

  const summary = useMemo(() => {
    const pending = filteredRows.filter((r) => r.status === 'pending' || r.status === 'overdue')
    const overdue = filteredRows.filter((r) => r.status === 'overdue')
    const pendingAmount = pending.reduce((sum, r) => sum + Number(r.balance_remaining || r.commission_due || 0), 0)
    const paidAmount = filteredRows
      .filter((r) => r.status === 'paid')
      .reduce((sum, r) => sum + Number(r.commission_paid || 0), 0)
    const frozenCount = filteredRows.filter((r) => r.vendor?.is_active === false).length

    return {
      pendingCount: pending.length,
      overdueCount: overdue.length,
      frozenCount,
      pendingAmount,
      paidAmount,
    }
  }, [filteredRows])

  const openPaymentModal = (row) => {
    setSelectedPaymentRow(row)
    setPaymentMethod(row.payment_method || 'bank_transfer')
    setPaymentReference(row.payment_reference || '')
  }

  const handleConfirmPayment = async () => {
    if (!selectedPaymentRow) return
    if (!paymentReference.trim()) {
      toast.error(t('marketplaceFeatures.commissionManagement.errors.paymentReferenceRequired'))
      return
    }

    setSavingPayment(true)
    try {
      const result = await commissionService.confirmCommissionPayment(
        selectedPaymentRow.vendor_id,
        selectedPaymentRow.month,
        selectedPaymentRow.year,
        paymentMethod,
        paymentReference.trim()
      )

      if (!result?.success) {
        throw new Error(result?.error || t('marketplaceFeatures.commissionManagement.errors.confirmPaymentFailed'))
      }

      toast.success(t('marketplaceFeatures.commissionManagement.success.paymentConfirmed'))
      setSelectedPaymentRow(null)
      setPaymentReference('')
      await loadRows()
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.commissionManagement.errors.confirmPaymentAction'))
    } finally {
      setSavingPayment(false)
    }
  }

  const handleManualUnfreeze = async () => {
    if (!selectedUnfreezeRow) return
    if (!unfreezeNote.trim()) {
      toast.error(t('marketplaceFeatures.commissionManagement.errors.unfreezeNoteRequired'))
      return
    }

    setSavingUnfreeze(true)
    try {
      const result = await commissionService.manuallyUnfreezeVendor(
        selectedUnfreezeRow.vendor_id,
        selectedUnfreezeRow.id,
        unfreezeNote.trim()
      )

      if (!result?.success) {
        throw new Error(result?.error || t('marketplaceFeatures.commissionManagement.errors.unfreezeFailed'))
      }

      toast.success(t('marketplaceFeatures.commissionManagement.success.unfrozenUntil', { date: formatDate(result.due_date, i18n.language) }))
      setSelectedUnfreezeRow(null)
      setUnfreezeNote('')
      await loadRows()
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.commissionManagement.errors.unfreezeAction'))
    } finally {
      setSavingUnfreeze(false)
    }
  }

  const handleExportCSV = () => {
    setExporting(true)
    try {
      const exportRows = filteredRows.map((row) => ({
        vendor_store: getVendorName(row, t),
        vendor_email: row.vendor?.email || '',
        vendor_city: row.vendor?.city || '',
        period: getPeriodLabel(row),
        total_sales_mad: Number(row.total_sales || 0),
        commission_due_mad: Number(row.commission_due || 0),
        commission_paid_mad: Number(row.commission_paid || 0),
        balance_remaining_mad: Number(row.balance_remaining || 0),
        status: statusLabel[row.status] || row.status,
        due_date: formatDate(row.due_date, i18n.language),
        paid_at: formatDate(row.paid_at, i18n.language),
        payment_method: row.payment_method || '',
        payment_reference: row.payment_reference || '',
        account_state: row.vendor?.is_active === false ? 'frozen' : 'active',
      }))

      csvExport.exportToCSV(
        exportRows,
        `commission-management-${new Date().toISOString().split('T')[0]}.csv`
      )

      toast.success(t('marketplaceFeatures.commissionManagement.success.exported'))
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.commissionManagement.errors.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('marketplaceFeatures.commissionManagement.title')}</h1>
        <p className="text-sm text-gray-600">{t('marketplaceFeatures.commissionManagement.subtitle')}</p>
      </div>

      <Card className="p-4 sm:p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <input
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5"
            placeholder={t('marketplaceFeatures.commissionManagement.searchPlaceholder')}
          />

          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5"
          >
            <option value="all">{t('marketplaceFeatures.commissionManagement.filters.allStatuses')}</option>
            <option value="active">{statusLabel.active}</option>
            <option value="pending">{statusLabel.pending}</option>
            <option value="overdue">{statusLabel.overdue}</option>
            <option value="paid">{statusLabel.paid}</option>
          </select>

          <select
            value={filters.period}
            onChange={(e) => setFilters((prev) => ({ ...prev, period: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5"
          >
            <option value="all">{t('marketplaceFeatures.commissionManagement.filters.allPeriods')}</option>
            {periodOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>

          <select
            value={filters.city}
            onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5"
          >
            <option value="all">{t('marketplaceFeatures.commissionManagement.filters.allCities')}</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <button
              onClick={loadRows}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50"
            >
              <ArrowPathIcon className="w-4 h-4" />
              {t('marketplaceFeatures.commissionManagement.refresh')}
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-black disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              {exporting
                ? t('marketplaceFeatures.commissionManagement.exporting')
                : t('marketplaceFeatures.commissionManagement.exportCsv')}
            </button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('marketplaceFeatures.commissionManagement.summary.needsAttention')}</p>
              <p className="text-xl font-bold text-gray-900">{summary.pendingCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <CurrencyDollarIcon className="w-5 h-5 text-red-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('marketplaceFeatures.commissionManagement.summary.totalUnpaid')}</p>
              <p className="text-xl font-bold text-red-600">{formatMAD(summary.pendingAmount, i18n.language)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center">
              <LockOpenIcon className="w-5 h-5 text-rose-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('marketplaceFeatures.commissionManagement.summary.frozenAccounts')}</p>
              <p className="text-xl font-bold text-rose-600">{summary.frozenCount}</p>
              <p className="text-xs text-gray-500 mt-1">{t('marketplaceFeatures.commissionManagement.summary.actualOverdue')}: {summary.overdueCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircleIcon className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('marketplaceFeatures.commissionManagement.summary.totalPaid')}</p>
              <p className="text-xl font-bold text-green-600">{formatMAD(summary.paidAmount, i18n.language)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right py-3 px-4 font-medium text-gray-600">{t('marketplaceFeatures.commissionManagement.table.vendor')}</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">{t('marketplaceFeatures.commissionManagement.table.city')}</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">{t('marketplaceFeatures.commissionManagement.table.period')}</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">{t('marketplaceFeatures.commissionManagement.table.sales')}</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">{t('marketplaceFeatures.commissionManagement.table.due')}</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">{t('marketplaceFeatures.commissionManagement.table.paid')}</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">{t('marketplaceFeatures.commissionManagement.table.status')}</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">{t('marketplaceFeatures.commissionManagement.table.paymentReference')}</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">{t('marketplaceFeatures.commissionManagement.table.account')}</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">{t('marketplaceFeatures.commissionManagement.table.dueDate')}</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">{t('marketplaceFeatures.commissionManagement.table.action')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900">{getVendorName(row, t)}</p>
                    <p className="text-xs text-gray-500">{row.vendor?.email || t('marketplaceFeatures.commissionManagement.table.noEmail')}</p>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{row.vendor?.city || '-'}</td>
                  <td className="py-3 px-4">{getPeriodLabel(row)}</td>
                  <td className="py-3 px-4">{formatMAD(row.total_sales, i18n.language)}</td>
                  <td className="py-3 px-4 font-semibold text-red-600">{formatMAD(row.commission_due, i18n.language)}</td>
                  <td className="py-3 px-4 font-semibold text-green-600">{formatMAD(row.commission_paid, i18n.language)}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusClass[row.status] || 'bg-gray-100 text-gray-700'}`}>
                      {statusLabel[row.status] || row.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-xs text-gray-700">{row.payment_reference || '-'}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{row.payment_method || t('marketplaceFeatures.commissionManagement.table.notDeclared')}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${row.vendor?.is_active === false ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {row.vendor?.is_active === false ? t('marketplaceFeatures.commissionManagement.statusLabels.frozen') : t('marketplaceFeatures.commissionManagement.statusLabels.active')}
                    </span>
                  </td>
                  <td className="py-3 px-4">{row.due_date ? new Date(row.due_date).toLocaleDateString(getLocale(i18n.language)) : '-'}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-2 min-w-[120px]">
                      {(row.status === 'pending' || row.status === 'overdue') ? (
                        <button
                          onClick={() => openPaymentModal(row)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700"
                        >
                          {t('marketplaceFeatures.commissionManagement.table.confirmPayment')}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">{t('marketplaceFeatures.commissionManagement.table.noPendingPayment')}</span>
                      )}

                      {(row.status === 'overdue' || row.vendor?.is_active === false) ? (
                        <button
                          onClick={() => setSelectedUnfreezeRow(row)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-300 text-rose-700 hover:bg-rose-50"
                        >
                          {t('marketplaceFeatures.commissionManagement.table.unfreeze')}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-gray-500">{t('marketplaceFeatures.commissionManagement.table.noResults')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={Boolean(selectedPaymentRow)}
        onClose={() => !savingPayment && setSelectedPaymentRow(null)}
        title={t('marketplaceFeatures.commissionManagement.paymentModal.title')}
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            {t('marketplaceFeatures.commissionManagement.paymentModal.description', {
              vendor: selectedPaymentRow ? getVendorName(selectedPaymentRow, t) : '-',
              period: selectedPaymentRow ? getPeriodLabel(selectedPaymentRow) : '-',
            })}
          </div>
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
            {t('marketplaceFeatures.commissionManagement.paymentModal.amount')}: <span className="font-semibold text-red-600">{formatMAD(selectedPaymentRow?.balance_remaining ?? selectedPaymentRow?.commission_due, i18n.language)}</span>
          </div>
          <div>
            <label htmlFor="payment-method" className="block text-sm font-medium text-gray-700 mb-1">{t('marketplaceFeatures.commissionManagement.paymentModal.method')}</label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {paymentMethodOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="payment-reference" className="block text-sm font-medium text-gray-700 mb-1">{t('marketplaceFeatures.commissionManagement.paymentModal.reference')}</label>
            <input
              id="payment-reference"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder={t('marketplaceFeatures.commissionManagement.paymentModal.referencePlaceholder')}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setSelectedPaymentRow(null)}
              disabled={savingPayment}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              {t('marketplaceFeatures.commissionManagement.common.cancel')}
            </button>
            <button
              onClick={handleConfirmPayment}
              disabled={savingPayment}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {savingPayment
                ? t('marketplaceFeatures.commissionManagement.common.saving')
                : t('marketplaceFeatures.commissionManagement.paymentModal.confirm')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(selectedUnfreezeRow)}
        onClose={() => !savingUnfreeze && setSelectedUnfreezeRow(null)}
        title={t('marketplaceFeatures.commissionManagement.unfreezeModal.title')}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            {t('marketplaceFeatures.commissionManagement.unfreezeModal.description', {
              vendor: selectedUnfreezeRow ? getVendorName(selectedUnfreezeRow, t) : '-',
            })}
          </div>

          <div>
            <label htmlFor="unfreeze-note" className="block text-sm font-medium text-gray-700 mb-1">{t('marketplaceFeatures.commissionManagement.unfreezeModal.internalNote')}</label>
            <textarea
              id="unfreeze-note"
              value={unfreezeNote}
              onChange={(e) => setUnfreezeNote(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-none"
              placeholder={t('marketplaceFeatures.commissionManagement.unfreezeModal.notePlaceholder')}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setSelectedUnfreezeRow(null)}
              disabled={savingUnfreeze}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              {t('marketplaceFeatures.commissionManagement.common.cancel')}
            </button>
            <button
              onClick={handleManualUnfreeze}
              disabled={savingUnfreeze}
              className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700 disabled:opacity-50"
            >
              {savingUnfreeze
                ? t('marketplaceFeatures.commissionManagement.unfreezeModal.processing')
                : t('marketplaceFeatures.commissionManagement.unfreezeModal.confirm')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default CommissionManagementPage
