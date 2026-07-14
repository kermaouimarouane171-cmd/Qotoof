import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChartBarIcon,
  UsersIcon,
  CubeIcon,
  TruckIcon
} from '@heroicons/react/24/outline'
import { reportService } from '@/modules/analytics'
import { flattenReport, COLUMNS_MAP } from '@/components/Reports/ReportPreview'
import ReportPreview from '@/components/Reports/ReportPreview'
import ExportButtons from '@/components/Reports/ExportButtons'
import { logger } from '@/utils/logger'

const REPORT_TYPES = [
  { key: 'sales',     labelKey: 'admin.reports.type.sales',     icon: ChartBarIcon, color: 'green' },
  { key: 'users',     labelKey: 'admin.reports.type.users',     icon: UsersIcon,    color: 'blue' },
  { key: 'inventory', labelKey: 'admin.reports.type.inventory', icon: CubeIcon,     color: 'orange' },
  { key: 'delivery',  labelKey: 'admin.reports.type.delivery',  icon: TruckIcon,    color: 'purple' },
]

const getDefaultDates = () => {
  const end = new Date()
  const start = new Date(end)
  start.setMonth(start.getMonth() - 1)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  }
}

export default function Reports() {
  const { t } = useTranslation()

  const getTypeLabel = (key) => t(`admin.reports.type.${key}`, key)
  const dates = getDefaultDates()

  const [reportType, setReportType] = useState('sales')
  const [startDate, setStartDate] = useState(dates.start)
  const [endDate, setEndDate] = useState(dates.end)
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  const handleGenerate = async () => {
    if (!startDate || !endDate) return
    setLoading(true)
    setGenerated(false)
    try {
      let result = null
      const params = { startDate: `${startDate}T00:00:00Z`, endDate: `${endDate}T23:59:59Z` }
      if (reportType === 'sales') result = await reportService.generateSalesReport(params)
      else if (reportType === 'users') result = await reportService.generateUserReport(params)
      else if (reportType === 'inventory') result = await reportService.generateInventoryReport()
      else if (reportType === 'delivery') result = await reportService.generateDeliveryReport(params)
      setRows(result?.rows || [])
      setSummary(result?.summary || null)
      setGenerated(true)
    } catch (err) {
      logger.error('Reports: generate failed', err)
    } finally {
      setLoading(false)
    }
  }

  const flatRows = flattenReport(rows, reportType)
  const columns = COLUMNS_MAP[reportType] || []

  return (
    <div className="p-6 space-y-6" data-testid="reports-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('reports.title', 'Reports & Analytics')}
        </h1>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {REPORT_TYPES.map(({ key, labelKey, icon: Icon, color: _color }) => (
          <button
            key={key}
            onClick={() => { setReportType(key); setGenerated(false) }}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
              reportType === key
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
            }`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              reportType === key ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
            }`}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t(labelKey, key)}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex flex-wrap items-end gap-4">
          {reportType !== 'inventory' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t('reports.startDate', 'From Date')}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  max={endDate}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {t('reports.endDate', 'To Date')}
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={startDate}
                  max={new Date().toISOString().slice(0, 10)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                />
              </div>
            </>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-5 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
            data-testid="generate-report-btn"
          >
            {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {t('reports.generate', 'Generate Report')}
          </button>

          {generated && (
            <ExportButtons
              rows={flatRows}
              columns={columns}
              filename={`report_${reportType}_${startDate}`}
              title={getTypeLabel(reportType)}
              previewElementId="report-preview-table"
            />
          )}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(summary).map(([key, value]) => (
            <div key={key} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-400">{key}</p>
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100 mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Report table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {generated && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {rows.length} {t('reports.records', 'records')}
            </p>
          </div>
        )}
        <ReportPreview rows={rows} type={reportType} loading={loading} />
      </div>
    </div>
  )
}
