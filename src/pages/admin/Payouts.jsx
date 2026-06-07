import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, LoadingSpinner } from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import {
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  EyeIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
  TableCellsIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
// @react-pdf/renderer is loaded dynamically inside handleExportPDF — see below
import { subDays, format } from 'date-fns'

// ============================================
// Constants
// ============================================
const DATE_RANGES = [
  { id: '7d', labelKey: 'admin.payouts.dateRanges.7d', days: 7 },
  { id: '30d', labelKey: 'admin.payouts.dateRanges.30d', days: 30 },
  { id: '3m', labelKey: 'admin.payouts.dateRanges.3m', days: 90 },
  { id: '6m', labelKey: 'admin.payouts.dateRanges.6m', days: 180 },
  { id: 'all', labelKey: 'admin.payouts.dateRanges.all', days: null },
]

// ============================================
// PayoutPDFDocument and pdfStyles are defined inside handleExportPDF below
// using a dynamic import so @react-pdf/renderer (643 kB) only loads on demand.

// ============================================
// Main Component
// ============================================
const AdminPayouts = () => {
  const { t } = useTranslation()
  const { profile: currentUser } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [processing, setProcessing] = useState(null)
  const [selectedRange, setSelectedRange] = useState('30d')
  const [filter, setFilter] = useState('pending')
  const [payouts, setPayouts] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [selectedPayout, setSelectedPayout] = useState(null)
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [summary, setSummary] = useState({
    totalAmount: 0,
    totalCount: 0,
    pendingAmount: 0,
    pendingCount: 0,
    completedAmount: 0,
    completedCount: 0,
  })

  // ============================================
  // Load Payouts
  // ============================================
  const loadPayouts = useCallback(async () => {
    try {
      setLoading(true)

      // Determine date range
      const now = new Date()
      let startDate = null
      if (selectedRange !== 'all') {
        const range = DATE_RANGES.find(r => r.id === selectedRange) || DATE_RANGES[1]
        startDate = subDays(now, range.days)
      }

      // Fetch payouts
      let query = supabase
        .from('payouts')
        .select(`
          *,
          user:profiles!payouts_user_id_fkey(id, first_name, last_name, email, store_name, phone)
        `)
        .order('created_at', { ascending: false })

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString())
      }

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      setPayouts(data || [])

      // Calculate summary
      const allPayouts = data || []
      setSummary({
        totalAmount: allPayouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
        totalCount: allPayouts.length,
        pendingAmount: allPayouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
        pendingCount: allPayouts.filter(p => p.status === 'pending').length,
        completedAmount: allPayouts.filter(p => p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
        completedCount: allPayouts.filter(p => p.status === 'completed').length,
      })

      setLoading(false)
    } catch (error) {
      logger.error('Error loading payouts:', error)
      toast.error(t('admin.payouts.errors.loadFailed', 'Failed to load payouts'))
      setLoading(false)
    }
  }, [filter, selectedRange, t])

  useEffect(() => {
    loadPayouts()
  }, [loadPayouts])

  // ============================================
  // Load Audit Logs for selected payout
  // ============================================
  const loadAuditLogs = async (payoutId) => {
    try {
      const { data, error } = await supabase
        .from('financial_audit_log')
        .select(`
          *,
          performed_by_profile:profiles!financial_audit_log_performed_by_fkey(first_name, last_name, role)
        `)
        .eq('entity_type', 'payout')
        .eq('entity_id', payoutId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setAuditLogs(data || [])
    } catch (error) {
      logger.error('Error loading audit logs:', error)
    }
  }

  // ============================================
  // Update Status
  // ============================================
  const handleUpdateStatus = async (payoutId, newStatus) => {
    setProcessing(payoutId)
    try {
      const payout = payouts.find(p => p.id === payoutId)
      const previousStatus = payout?.status || 'unknown'

      const { error } = await supabase
        .from('payouts')
        .update({ status: newStatus })
        .eq('id', payoutId)

      if (error) throw error

      // Log audit
      await supabase.rpc('log_financial_audit', {
        p_entity_type: 'payout',
        p_entity_id: payoutId,
        p_action: 'status_updated',
        p_previous_status: previousStatus,
        p_new_status: newStatus,
        p_amount: payout?.amount || 0,
        p_details: { updated_by: currentUser?.id, new_status: newStatus },
        p_reason: null,
      })

      // Notify user
      if (payout?.user_id) {
        await supabase.from('notifications').insert({
          user_id: payout.user_id,
          title: `Payout ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
          message: `Your payout of ${formatPrice(payout.amount)} has been updated to ${newStatus}.`,
          type: 'payout',
          data: { payout_id: payoutId, amount: payout.amount, status: newStatus },
        })
      }

      toast.success(t('admin.payouts.toast.statusUpdated', 'Status updated'))
      loadPayouts()
    } catch (error) {
      logger.error('Status update error:', error)
      toast.error(t('admin.payouts.errors.updateFailed', 'Failed to update status'))
    } finally {
      setProcessing(null)
    }
  }

  // ============================================
  // Process Payout (Bank Transfer)
  // ============================================
  const handleProcessPayout = async (payoutId) => {
    await handleUpdateStatus(payoutId, 'processing')
  }

  // ============================================
  // Complete Payout
  // ============================================
  const handleCompletePayout = async (payoutId) => {
    await handleUpdateStatus(payoutId, 'completed')
  }

  // ============================================
  // Export CSV
  // ============================================
  const handleExportCSV = async () => {
    if (payouts.length === 0) {
      toast.error(t('admin.payouts.errors.noDataExport', 'No data to export'))
      return
    }

    setExporting(true)
    try {
      const headers = [
        'Reference',
        'Vendor',
        'Email',
        'Amount (MAD)',
        'Status',
        'Method',
        'Created At',
        'Notes',
      ]

      const rows = payouts.map(p => [
        p.reference || p.id.slice(0, 8),
        p.user?.store_name || `${p.user?.first_name || ''} ${p.user?.last_name || ''}`,
        p.user?.email || '',
        parseFloat(p.amount).toFixed(2),
        p.status,
        p.payment_method,
        new Date(p.created_at).toLocaleString(),
        p.notes || '',
      ])

      const summaryRow = [
        'SUMMARY',
        '',
        '',
        summary.totalAmount.toFixed(2),
        `${summary.completedCount} completed / ${summary.pendingCount} pending`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        '',
        summaryRow.map(cell => `"${cell}"`).join(','),
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `payouts-${selectedRange}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(t('admin.payouts.toast.csvExported', 'Payouts exported as CSV!'))
    } catch (error) {
      logger.error('CSV export error:', error)
      toast.error(t('admin.payouts.errors.csvExportFailed', 'Failed to export CSV'))
    } finally {
      setExporting(false)
    }
  }

  // ============================================
  // Export PDF
  // ============================================
  const handleExportPDF = async () => {
    if (payouts.length === 0) {
      toast.error('No data to export')
      return
    }

    setExporting(true)
    try {
      // Dynamic import: @react-pdf/renderer (643 kB) only loads when user clicks export
      const { pdf, Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer')

      const pdfStyles = StyleSheet.create({
        page: { padding: 30, fontSize: 10 },
        title: { fontSize: 18, marginBottom: 5, fontWeight: 'bold' },
        subtitle: { fontSize: 10, marginBottom: 15, color: '#666' },
        section: { marginBottom: 15 },
        sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
        table: { marginTop: 10 },
        tableRow: { flexDirection: 'row', borderBottom: '1 solid #e5e7eb', padding: 6 },
        tableHeader: { fontWeight: 'bold', backgroundColor: '#f3f4f6' },
        col1: { width: '20%' }, col2: { width: '20%' }, col3: { width: '15%' },
        col4: { width: '15%' }, col5: { width: '15%' }, col6: { width: '15%' },
        summaryBox: { padding: 15, backgroundColor: '#f9fafb', marginBottom: 15 },
        summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
        summaryLabel: { fontSize: 10, color: '#666' },
        summaryValue: { fontSize: 12, fontWeight: 'bold' },
        footer: { position: 'absolute', bottom: 30, right: 30, left: 30, textAlign: 'center', fontSize: 8, color: '#999' },
      })

      const PayoutPDFDocument = ({ payouts: p, summary: s, dateRangeLabel }) => (
        <Document>
          <Page size="A4" style={pdfStyles.page}>
            <Text style={pdfStyles.title}>Payout Report</Text>
            <Text style={pdfStyles.subtitle}>{dateRangeLabel}</Text>
            <View style={pdfStyles.summaryBox}>
              <View style={pdfStyles.summaryRow}><Text style={pdfStyles.summaryLabel}>Total Payouts</Text><Text style={pdfStyles.summaryValue}>{s.totalCount}</Text></View>
              <View style={pdfStyles.summaryRow}><Text style={pdfStyles.summaryLabel}>Total Amount</Text><Text style={pdfStyles.summaryValue}>{formatPrice(s.totalAmount)}</Text></View>
              <View style={pdfStyles.summaryRow}><Text style={pdfStyles.summaryLabel}>Completed</Text><Text style={pdfStyles.summaryValue}>{s.completedCount} ({formatPrice(s.completedAmount)})</Text></View>
              <View style={pdfStyles.summaryRow}><Text style={pdfStyles.summaryLabel}>Pending</Text><Text style={pdfStyles.summaryValue}>{s.pendingCount} ({formatPrice(s.pendingAmount)})</Text></View>
            </View>
            <View style={pdfStyles.section}>
              <Text style={pdfStyles.sectionTitle}>Payout Details</Text>
              <View style={pdfStyles.table}>
                <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
                  <Text style={pdfStyles.col1}>Reference</Text><Text style={pdfStyles.col2}>Vendor</Text>
                  <Text style={pdfStyles.col3}>Amount</Text><Text style={pdfStyles.col4}>Status</Text>
                  <Text style={pdfStyles.col5}>Date</Text><Text style={pdfStyles.col6}>Method</Text>
                </View>
                {p.slice(0, 50).map((payout, i) => (
                  <View key={i} style={pdfStyles.tableRow}>
                    <Text style={pdfStyles.col1}>{payout.reference || payout.id.slice(0, 8)}</Text>
                    <Text style={pdfStyles.col2}>{payout.user?.store_name || 'N/A'}</Text>
                    <Text style={pdfStyles.col3}>{formatPrice(payout.amount)}</Text>
                    <Text style={pdfStyles.col4}>{payout.status}</Text>
                    <Text style={pdfStyles.col5}>{format(new Date(payout.created_at), 'dd/MM/yyyy')}</Text>
                    <Text style={pdfStyles.col6}>{payout.payment_method || 'N/A'}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={pdfStyles.footer}>Qotoof Platform - Financial Report - CONFIDENTIAL</Text>
          </Page>
        </Document>
      )

      const rangeLabel = DATE_RANGES.find(r => r.id === selectedRange)?.label || 'All Time'
      const blob = await pdf(<PayoutPDFDocument payouts={payouts} summary={summary} dateRangeLabel={rangeLabel} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `payouts-report-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(t('admin.payouts.toast.pdfExported', 'Payouts exported as PDF!'))
    } catch (error) {
      logger.error('PDF export error:', error)
      toast.error(t('admin.payouts.errors.pdfExportFailed', 'Failed to export PDF'))
    } finally {
      setExporting(false)
    }
  }

  // ============================================
  // View Audit Trail
  // ============================================
  const handleViewAudit = async (payout) => {
    setSelectedPayout(payout)
    await loadAuditLogs(payout.id)
    setShowAuditModal(true)
  }

  // ============================================
  // Helpers
  // ============================================
  const getStatusBadge = (status) => {
    const config = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: ClockIcon, labelKey: 'admin.payouts.status.pending' },
      processing: { color: 'bg-blue-100 text-blue-800', icon: ArrowUpTrayIcon, labelKey: 'admin.payouts.status.processing' },
      completed: { color: 'bg-emerald-100 text-emerald-800', icon: CheckCircleIcon, labelKey: 'admin.payouts.status.completed' },
      failed: { color: 'bg-gray-100 text-gray-800', icon: ExclamationTriangleIcon, labelKey: 'admin.payouts.status.failed' },
    }
    const { color, icon: Icon, labelKey } = config[status] || config.pending
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        <Icon className="w-3 h-3" />
        {t(labelKey, status)}
      </span>
    )
  }

  if (loading) {
    return <LoadingSpinner size="lg" />
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.payouts.title', 'Payouts Management')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('admin.payouts.subtitle', 'Manage vendor payouts and settlements')}</p>
        </div>

        <div className="flex gap-2">
          <button onClick={handleExportCSV} disabled={exporting} className="btn-secondary flex items-center gap-2">
            <TableCellsIcon className="w-4 h-4" />
            {t('admin.payouts.exportCSV', 'Export CSV')}
          </button>
          <button onClick={handleExportPDF} disabled={exporting} className="btn-secondary flex items-center gap-2">
            <DocumentIcon className="w-4 h-4" />
            {t('admin.payouts.exportPDF', 'Export PDF')}
          </button>
        </div>
      </div>

      {/* Date Range & Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('admin.payouts.filters.dateRange', 'Date Range')}</label>
            <select
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              {DATE_RANGES.map(range => (
                <option key={range.id} value={range.id}>{t(range.labelKey, range.id)}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('admin.payouts.filters.status', 'Status Filter')}</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="pending">{t('admin.payouts.status.pending', 'Pending')}</option>
              <option value="processing">{t('admin.payouts.status.processing', 'Processing')}</option>
              <option value="completed">{t('admin.payouts.status.completed', 'Completed')}</option>
              <option value="failed">{t('admin.payouts.status.failed', 'Failed')}</option>
              <option value="all">{t('admin.payouts.filters.all', 'All')}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6 border-l-4 border-yellow-500">
          <p className="text-sm text-gray-500 mb-1">{t('admin.payouts.stats.pendingPayouts', 'Pending Payouts')}</p>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(summary.pendingAmount)}</p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.payouts.stats.requests', '{{count}} requests', { count: summary.pendingCount })}</p>
        </Card>
        <Card className="p-6 border-l-4 border-blue-500">
          <p className="text-sm text-gray-500 mb-1">{t('admin.payouts.status.processing', 'Processing')}</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatPrice(payouts.filter(p => p.status === 'processing').reduce((s, p) => s + parseFloat(p.amount || 0), 0))}
          </p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.payouts.stats.inTransit', '{{count}} in transit', { count: payouts.filter(p => p.status === 'processing').length })}</p>
        </Card>
        <Card className="p-6 border-l-4 border-green-500">
          <p className="text-sm text-gray-500 mb-1">{t('admin.payouts.stats.completed', 'Completed')}</p>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(summary.completedAmount)}</p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.payouts.stats.payouts', '{{count}} payouts', { count: summary.completedCount })}</p>
        </Card>
        <Card className="p-6 border-l-4 border-purple-500">
          <p className="text-sm text-gray-500 mb-1">{t('admin.payouts.stats.totalVolume', 'Total Volume')}</p>
          <p className="text-2xl font-bold text-gray-900">{formatPrice(summary.totalAmount)}</p>
          <p className="text-xs text-gray-400 mt-1">{t('admin.payouts.stats.total', '{{count}} total', { count: summary.totalCount })}</p>
        </Card>
      </div>

      {/* Payouts List */}
      {payouts.length === 0 ? (
        <Card className="p-12 text-center">
          <BanknotesIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('admin.payouts.empty.title', 'No Payouts Found')}</h3>
          <p className="text-gray-500">{t('admin.payouts.empty.description', 'No payouts match the current filter')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {payouts.map((payout) => {
            const canStartProcessing = payout.status === 'pending'
            const canComplete = payout.status === 'processing'
            const canMarkFailed = payout.status === 'processing'

            return (
              <Card key={payout.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <BanknotesIcon className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold text-gray-900">
                        {payout.user?.store_name || `${payout.user?.first_name || ''} ${payout.user?.last_name || ''}`}
                      </h3>
                      {getStatusBadge(payout.status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">{t('admin.payouts.table.amount', 'Amount')}</p>
                        <p className="text-lg font-bold text-gray-900">{formatPrice(payout.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{t('admin.payouts.table.method', 'Method')}</p>
                        <p className="text-sm font-medium text-gray-900 capitalize">{payout.payment_method}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{t('admin.payouts.table.reference', 'Reference')}</p>
                        <p className="text-sm font-medium text-gray-900">{payout.reference || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{t('admin.payouts.table.created', 'Created')}</p>
                        <p className="text-sm font-medium text-gray-900">{format(new Date(payout.created_at), 'dd MMM yyyy')}</p>
                      </div>
                    </div>

                    {payout.user?.email && (
                      <p className="text-xs text-gray-500 mt-2">{payout.user.email}</p>
                    )}

                    {payout.reference && (
                      <p className="text-xs text-gray-500 mt-1">Ref: {payout.reference}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => handleViewAudit(payout)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title={t('admin.payouts.actions.viewAuditTrail', 'View Audit Trail')}
                    >
                      <EyeIcon className="w-5 h-5" />
                    </button>

                    {canStartProcessing && (
                      <button
                        onClick={() => handleProcessPayout(payout.id)}
                        disabled={processing === payout.id}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {processing === payout.id ? t('admin.payouts.actions.processing', 'Processing...') : t('admin.payouts.actions.startProcessing', 'Start Processing')}
                      </button>
                    )}

                    {canComplete && (
                      <button
                        onClick={() => handleCompletePayout(payout.id)}
                        disabled={processing === payout.id}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {processing === payout.id ? t('admin.payouts.actions.processing', 'Processing...') : t('admin.payouts.actions.markCompleted', 'Mark Completed')}
                      </button>
                    )}

                    {canMarkFailed && (
                      <button
                        onClick={() => handleUpdateStatus(payout.id, 'failed')}
                        disabled={processing === payout.id}
                        className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {processing === payout.id ? t('admin.payouts.actions.processing', 'Processing...') : t('admin.payouts.actions.markFailed', 'Mark Failed')}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Audit Trail Modal */}
      {showAuditModal && selectedPayout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{t('admin.payouts.auditModal.title', 'Audit Trail')}</h2>
              <button
                onClick={() => { setShowAuditModal(false); setSelectedPayout(null); setAuditLogs([]) }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                {t('admin.payouts.auditModal.payoutInfo', 'Payout: {{amount}} | {{vendor}}', {
                  amount: formatPrice(selectedPayout.amount),
                  vendor: selectedPayout.user?.store_name || 'N/A'
                })}
              </p>
              <p className="text-xs text-gray-500">{t('admin.payouts.auditModal.ref', 'Ref: {{ref}}', { ref: selectedPayout.reference || selectedPayout.id.slice(0, 8) })}</p>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t('admin.payouts.auditModal.noLogs', 'No audit logs found')}</p>
            ) : (
              <div className="space-y-3">
                {auditLogs.map((log, _index) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <DocumentTextIcon className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {log.action.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(log.created_at), 'dd MMM yyyy HH:mm')}
                        </p>
                      </div>
                      <p className="text-xs text-gray-600">
                        {t('admin.payouts.auditModal.performedBy', 'By: {{name}} ({{role}})', {
                          name: `${log.performed_by_profile?.first_name || ''} ${log.performed_by_profile?.last_name || ''}`.trim(),
                          role: log.performed_by_profile?.role || 'N/A'
                        })}
                      </p>
                      {log.reason && (
                        <p className="text-xs text-gray-500 mt-1">{t('admin.payouts.auditModal.reason', 'Reason: {{reason}}', { reason: log.reason })}</p>
                      )}
                      {log.previous_status && log.new_status && (
                        <p className="text-xs text-gray-400 mt-1">
                          {log.previous_status} → {log.new_status}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

export default AdminPayouts
