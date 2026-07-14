import { useEffect, useMemo, useState } from 'react'
import { Card, LoadingSpinner, Modal } from '@/components/ui'
import { commissionService } from '@/modules/commissions'
import { useTranslation } from 'react-i18next'
import {
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
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

const formatOrderLabel = (orderId, t) => {
  if (!orderId) return t('marketplaceFeatures.common.unknownOrder')
  return `#${String(orderId).slice(0, 8)}`
}

const CommissionDashboard = ({ vendorId }) => {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [submittingPayment, setSubmittingPayment] = useState(false)

  const statusLabel = useMemo(() => ({
    active: t('marketplaceFeatures.commissionDashboard.statusLabels.active'),
    pending: t('marketplaceFeatures.commissionDashboard.statusLabels.pending'),
    overdue: t('marketplaceFeatures.commissionDashboard.statusLabels.overdue'),
    paid: t('marketplaceFeatures.commissionDashboard.statusLabels.paid'),
  }), [t])

  const paymentMethodOptions = useMemo(() => ([
    { value: 'bank_transfer', label: t('marketplaceFeatures.commissionDashboard.paymentMethods.bankTransfer') },
    { value: 'cash', label: t('marketplaceFeatures.commissionDashboard.paymentMethods.cash') },
    { value: 'check', label: t('marketplaceFeatures.commissionDashboard.paymentMethods.check') },
  ]), [t])

  const loadData = async () => {
    if (!vendorId) return

    setLoading(true)
    try {
      const [summaryRes, historyRes] = await Promise.all([
        commissionService.getCurrentMonthSummary(vendorId),
        commissionService.getVendorCommissionHistory(vendorId),
      ])

      if (!summaryRes?.success) {
        throw new Error(summaryRes?.error || t('marketplaceFeatures.commissionDashboard.errors.loadSummary'))
      }

      if (!historyRes?.success) {
        throw new Error(historyRes?.error || t('marketplaceFeatures.commissionDashboard.errors.loadHistory'))
      }

      setSummary(summaryRes)
      setHistory(historyRes.history || [])
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.commissionDashboard.errors.loadData'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId])

  const currentMonthKey = `${summary?.month || ''}-${summary?.year || ''}`

  const previousMonths = useMemo(
    () => history.filter((row) => `${row.month}-${row.year}` !== currentMonthKey),
    [history, currentMonthKey]
  )

  const openInvoice = useMemo(() => {
    const historyInvoice = previousMonths.find((row) => ['pending', 'overdue'].includes(row.status))
    if (historyInvoice) return historyInvoice
    if (summary && ['pending', 'overdue'].includes(summary.status)) return summary
    return null
  }, [previousMonths, summary])

  const activeInvoice = selectedInvoice || openInvoice

  const currentMonthBalance = useMemo(
    () => Number(Math.max(Number(summary?.commission_due || 0) - Number(summary?.commission_paid || 0), 0).toFixed(2)),
    [summary]
  )

  useEffect(() => {
    if (!activeInvoice) return
    setPaymentMethod(activeInvoice.payment_method || 'bank_transfer')
    setPaymentReference(activeInvoice.payment_reference || '')
  }, [activeInvoice])

  const handleSubmitPaymentNotice = async () => {
    if (!activeInvoice?.id) {
      toast.error(t('marketplaceFeatures.commissionDashboard.errors.noOpenInvoice'))
      return
    }

    if (!paymentReference.trim()) {
      toast.error(t('marketplaceFeatures.commissionDashboard.errors.paymentReferenceRequired'))
      return
    }

    setSubmittingPayment(true)
    try {
      const result = await commissionService.submitPaymentNotice(
        vendorId,
        activeInvoice.id,
        paymentMethod,
        paymentReference.trim(),
        paymentNote.trim()
      )

      if (!result?.success) {
        throw new Error(result?.error || t('marketplaceFeatures.commissionDashboard.errors.submitNotice'))
      }

      toast.success(t('marketplaceFeatures.commissionDashboard.success.noticeSent', { monthLabel: result.month_label }))
      setPaymentModalOpen(false)
      setSelectedInvoice(null)
      setPaymentNote('')
      await loadData()
    } catch (error) {
      toast.error(error.message || t('marketplaceFeatures.commissionDashboard.errors.sendNotice'))
    } finally {
      setSubmittingPayment(false)
    }
  }

  const renderInvoiceBanner = () => {
    if (openInvoice) {
      const bannerTone = openInvoice.status === 'overdue'
        ? 'border-red-200 bg-red-50/80 text-red-900'
        : 'border-amber-200 bg-amber-50/80 text-amber-900'
      const bannerTitle = openInvoice.status === 'overdue'
        ? t('marketplaceFeatures.commissionDashboard.banners.overdueTitle')
        : t('marketplaceFeatures.commissionDashboard.banners.openTitle')

      return (
        <div className={`rounded-2xl border p-4 sm:p-5 mb-5 ${bannerTone}`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold text-base mb-1">{bannerTitle}</p>
              <p className="text-sm leading-6">
                {t('marketplaceFeatures.commissionDashboard.banners.period')}: <span className="font-semibold">{openInvoice.month_label || `${openInvoice.month}/${openInvoice.year}`}</span>
                {' '}• {t('marketplaceFeatures.commissionDashboard.banners.currentDue')}: <span className="font-semibold">{formatMAD(openInvoice.balance_remaining ?? openInvoice.commission_due, i18n.language)}</span>
                {' '}• {t('marketplaceFeatures.commissionDashboard.banners.dueDate')}: <span className="font-semibold">{formatDate(openInvoice.due_date, i18n.language)}</span>
              </p>
              {openInvoice.payment_reference && (
                <p className="text-xs mt-2 opacity-80">
                  {t('marketplaceFeatures.commissionDashboard.banners.lastReportedReference')}: {openInvoice.payment_reference}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedInvoice(openInvoice)
                setPaymentModalOpen(true)
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-black"
            >
              <CurrencyDollarIcon className="w-4 h-4" />
              {t('marketplaceFeatures.commissionDashboard.banners.notifyAdmin')}
            </button>
          </div>
        </div>
      )
    }

    if (summary?.status === 'paid') {
      return (
        <div className="rounded-2xl border border-green-200 bg-green-50/80 p-4 sm:p-5 mb-5 text-green-900">
          <p className="font-semibold text-base mb-1">{t('marketplaceFeatures.commissionDashboard.banners.noPendingTitle')}</p>
          <p className="text-sm leading-6">
            {t('marketplaceFeatures.commissionDashboard.banners.lastPaidPeriod')}: <span className="font-semibold">{summary.month_label}</span>
            {' '}• {t('marketplaceFeatures.commissionDashboard.banners.settledAt')}: <span className="font-semibold">{formatDate(summary.paid_at, i18n.language)}</span>
          </p>
        </div>
      )
    }

    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 sm:p-5 mb-5 text-blue-900">
        <p className="font-semibold text-base mb-1">{t('marketplaceFeatures.commissionDashboard.banners.counterTitle')}</p>
        <p className="text-sm leading-6">
          {t('marketplaceFeatures.commissionDashboard.banners.counterDescription')}
        </p>
      </div>
    )
  }

  if (!vendorId) return null

  return (
    <Card className="p-5 mb-6 border border-emerald-100 bg-gradient-to-br from-emerald-50/70 to-white">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
          <CurrencyDollarIcon className="w-5 h-5 text-emerald-600" />
          {t('marketplaceFeatures.commissionDashboard.title')}
        </h2>
        <button
          onClick={loadData}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          {t('marketplaceFeatures.commissionDashboard.refresh')}
        </button>
      </div>

      {loading ? (
        <div className="py-8 flex items-center justify-center">
          <LoadingSpinner size="md" />
        </div>
      ) : (
        <>
          {renderInvoiceBanner()}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl bg-white border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">{t('marketplaceFeatures.commissionDashboard.cards.totalSales')} {summary?.month_label || t('marketplaceFeatures.commissionDashboard.cards.thisMonth')}</p>
              <p className="text-lg font-bold text-gray-900">{formatMAD(summary?.total_sales, i18n.language)}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">{t('marketplaceFeatures.commissionDashboard.cards.accumulatedCommission')}</p>
              <p className="text-lg font-bold text-red-600">{formatMAD(summary?.commission_due, i18n.language)}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">{t('marketplaceFeatures.commissionDashboard.cards.balanceDue')}</p>
              <p className="text-lg font-bold text-amber-600">{formatMAD(openInvoice?.balance_remaining ?? currentMonthBalance, i18n.language)}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-3">
              <p className="text-xs text-gray-500 mb-1">{t('marketplaceFeatures.commissionDashboard.cards.accountStatus')}</p>
              <p className={`text-lg font-bold ${summary?.account_active === false ? 'text-red-600' : 'text-green-600'}`}>
                {summary?.account_active === false ? t('marketplaceFeatures.commissionDashboard.statusLabels.frozen') : t('marketplaceFeatures.commissionDashboard.statusLabels.active')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {openInvoice?.due_date
                  ? `${t('marketplaceFeatures.commissionDashboard.banners.dueDate')}: ${formatDate(openInvoice.due_date, i18n.language)}`
                  : t('marketplaceFeatures.commissionDashboard.cards.noOpenDue')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-5 text-sm">
            <span className={`px-2.5 py-1 rounded-full font-medium ${statusClass[summary?.status] || 'bg-gray-100 text-gray-700'}`}>
              {t('marketplaceFeatures.commissionDashboard.chips.status')}: {statusLabel[summary?.status] || t('marketplaceFeatures.commissionDashboard.chips.undefinedStatus')}
            </span>
            {summary?.due_date && (
              <span className="inline-flex items-center gap-1 text-gray-600">
                <ClockIcon className="w-4 h-4" />
                {t('marketplaceFeatures.commissionDashboard.chips.paymentDue')}: {new Date(summary.due_date).toLocaleDateString(getLocale(i18n.language))}
              </span>
            )}
            {typeof summary?.days_remaining === 'number' && (
              <span className="inline-flex items-center gap-1 text-gray-600">
                <CheckCircleIcon className="w-4 h-4" />
                {t('marketplaceFeatures.commissionDashboard.chips.remainingDays')}: {summary.days_remaining}
              </span>
            )}
          </div>

          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">{t('marketplaceFeatures.commissionDashboard.currentTransactions.title')}</p>
              <span className="text-xs text-gray-500">{t('marketplaceFeatures.commissionDashboard.currentTransactions.count', { count: summary?.transactions?.length || 0 })}</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('marketplaceFeatures.commissionDashboard.currentTransactions.order')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('marketplaceFeatures.commissionDashboard.currentTransactions.date')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('marketplaceFeatures.commissionDashboard.currentTransactions.saleValue')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('marketplaceFeatures.commissionDashboard.currentTransactions.commission')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.transactions || []).map((transaction) => (
                    <tr key={transaction.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-4 py-3 font-medium text-gray-900">{formatOrderLabel(transaction.order_id, t)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(transaction.confirmed_at, i18n.language)}</td>
                      <td className="px-4 py-3 text-gray-900">{formatMAD(transaction.sale_amount, i18n.language)}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">{formatMAD(transaction.commission_amount, i18n.language)}</td>
                    </tr>
                  ))}
                  {(summary?.transactions || []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        {t('marketplaceFeatures.commissionDashboard.currentTransactions.noTransactions')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">{t('marketplaceFeatures.commissionDashboard.previousMonths.title')}</p>
              <span className="text-xs text-gray-500">{t('marketplaceFeatures.commissionDashboard.previousMonths.subtitle')}</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('marketplaceFeatures.commissionDashboard.previousMonths.period')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('marketplaceFeatures.commissionDashboard.previousMonths.sales')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('marketplaceFeatures.commissionDashboard.previousMonths.due')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('marketplaceFeatures.commissionDashboard.previousMonths.paid')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('marketplaceFeatures.commissionDashboard.chips.status')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">{t('marketplaceFeatures.commissionDashboard.previousMonths.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {previousMonths.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.month_label || `${row.month}/${row.year}`}</td>
                      <td className="px-4 py-3 text-gray-900">{formatMAD(row.total_sales, i18n.language)}</td>
                      <td className="px-4 py-3 font-semibold text-red-600">{formatMAD(row.commission_due, i18n.language)}</td>
                      <td className="px-4 py-3 text-green-600 font-semibold">{formatMAD(row.commission_paid, i18n.language)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusClass[row.status] || 'bg-gray-100 text-gray-700'}`}>
                          {statusLabel[row.status] || row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {['pending', 'overdue'].includes(row.status) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(row)
                              setPaymentMethod(row.payment_method || 'bank_transfer')
                              setPaymentReference(row.payment_reference || '')
                              setPaymentModalOpen(true)
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                          >
                            <ArrowPathIcon className="w-4 h-4" />
                            {t('marketplaceFeatures.commissionDashboard.previousMonths.sendPaymentNotice')}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">{t('marketplaceFeatures.commissionDashboard.previousMonths.noAction')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {previousMonths.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        {t('marketplaceFeatures.commissionDashboard.previousMonths.noHistory')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={paymentModalOpen}
        onClose={() => {
          if (submittingPayment) return
          setPaymentModalOpen(false)
          setSelectedInvoice(null)
        }}
        title={t('marketplaceFeatures.commissionDashboard.modal.title')}
      >
        <div className="space-y-4">
          <div className={`rounded-xl border p-3 text-sm ${activeInvoice?.status === 'overdue' ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            <p className="font-semibold mb-1">
              {activeInvoice?.month_label || t('marketplaceFeatures.commissionDashboard.modal.openPeriod')}
            </p>
            <p>
              {t('marketplaceFeatures.commissionDashboard.banners.currentDue')}: <span className="font-semibold">{formatMAD(activeInvoice?.balance_remaining ?? activeInvoice?.commission_due, i18n.language)}</span>
            </p>
            <p>
              {t('marketplaceFeatures.commissionDashboard.banners.dueDate')}: <span className="font-semibold">{formatDate(activeInvoice?.due_date, i18n.language)}</span>
            </p>
          </div>

          <div>
            <label htmlFor="vendor-commission-method" className="block text-sm font-medium text-gray-700 mb-1">{t('marketplaceFeatures.commissionDashboard.modal.paymentMethod')}</label>
            <select
              id="vendor-commission-method"
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
            <label htmlFor="vendor-payment-reference" className="block text-sm font-medium text-gray-700 mb-1">{t('marketplaceFeatures.commissionDashboard.modal.paymentReference')}</label>
            <input
              id="vendor-payment-reference"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder={t('marketplaceFeatures.commissionDashboard.modal.paymentReferencePlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="vendor-payment-note" className="block text-sm font-medium text-gray-700 mb-1">{t('marketplaceFeatures.commissionDashboard.modal.paymentNote')}</label>
            <textarea
              id="vendor-payment-note"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-none"
              placeholder={t('marketplaceFeatures.commissionDashboard.modal.paymentNotePlaceholder')}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 leading-6">
            {t('marketplaceFeatures.commissionDashboard.modal.hint')}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPaymentModalOpen(false)
                setSelectedInvoice(null)
              }}
              disabled={submittingPayment}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              {t('marketplaceFeatures.commissionDashboard.modal.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmitPaymentNotice}
              disabled={submittingPayment}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {submittingPayment
                ? t('marketplaceFeatures.commissionDashboard.modal.submitting')
                : t('marketplaceFeatures.commissionDashboard.modal.submit')}
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  )
}

export default CommissionDashboard
