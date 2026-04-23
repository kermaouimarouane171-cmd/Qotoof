import * as XLSX from 'xlsx'
import { logger } from '@/utils/logger'

/**
 * Export rows to Excel (.xlsx) and trigger browser download
 */
function exportToExcel(rows = [], filename = 'report.xlsx', sheetName = 'Sheet1') {
  try {
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    // Auto column width
    const maxLen = {}
    rows.forEach(row => {
      Object.entries(row).forEach(([k, v]) => {
        const len = String(v || '').length
        if (!maxLen[k] || len > maxLen[k]) maxLen[k] = Math.max(len, k.length)
      })
    })
    ws['!cols'] = Object.values(maxLen).map(w => ({ wch: Math.min(w + 2, 50) }))

    XLSX.writeFile(wb, filename)
  } catch (err) {
    logger.error('excelExport.exportToExcel', err)
    throw err
  }
}

export const excelExport = { exportToExcel }
