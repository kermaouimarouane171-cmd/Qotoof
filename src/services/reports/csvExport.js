import Papa from 'papaparse'
import { logger } from '@/utils/logger'

/**
 * Flatten a report row object for CSV export
 */
function flattenRow(row) {
  const flat = {}
  const traverse = (obj, prefix = '') => {
    for (const [key, val] of Object.entries(obj || {})) {
      const fullKey = prefix ? `${prefix}_${key}` : key
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        traverse(val, fullKey)
      } else if (Array.isArray(val)) {
        flat[fullKey] = val.length
      } else {
        flat[fullKey] = val
      }
    }
  }
  traverse(row)
  return flat
}

/**
 * Export rows to CSV and trigger browser download
 */
function exportToCSV(rows = [], filename = 'report.csv') {
  try {
    const flatRows = rows.map(flattenRow)
    const csv = Papa.unparse(flatRows, { header: true })

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    logger.error('csvExport.exportToCSV', err)
    throw err
  }
}

export const csvExport = { exportToCSV }
