import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { csvExport } from '@/services/reports/csvExport'
import { excelExport } from '@/services/reports/excelExport'
import { pdfExport } from '@/services/reports/pdfExport'
import { logger } from '@/utils/logger'

const ExportButtons = memo(function ExportButtons({
  rows = [],
  columns = [],
  filename = 'report',
  title = '',
  previewElementId = null
}) {
  useTranslation()
  const [loading, setLoading] = useState(null)

  const handleExport = async (type) => {
    if (!rows.length) return
    setLoading(type)
    try {
      if (type === 'csv') {
        csvExport.exportToCSV(rows, `${filename}.csv`)
      } else if (type === 'excel') {
        await excelExport.exportToExcel(rows, `${filename}.xlsx`)
      } else if (type === 'pdf') {
        if (previewElementId) {
          await pdfExport.exportElementToPDF(previewElementId, `${filename}.pdf`, title)
        } else {
          pdfExport.exportTableToPDF(columns, rows, `${filename}.pdf`, title)
        }
      }
    } catch (err) {
      logger.error('ExportButtons: export failed', err)
    } finally {
      setLoading(null)
    }
  }

  const buttons = [
    { type: 'csv', label: 'CSV', color: 'blue' },
    { type: 'excel', label: 'Excel', color: 'green' },
    { type: 'pdf', label: 'PDF', color: 'red' }
  ]

  return (
    <div className="flex items-center gap-2" data-testid="export-buttons">
      {buttons.map(({ type, label, color }) => (
        <button
          key={type}
          onClick={() => handleExport(type)}
          disabled={!!loading || !rows.length}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed
            ${color === 'blue' ? 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20' : ''}
            ${color === 'green' ? 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20' : ''}
            ${color === 'red' ? 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20' : ''}
          `}
          data-testid={`export-${type}`}
        >
          {loading === type ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
          )}
          {label}
        </button>
      ))}
    </div>
  )
})

export default ExportButtons
