import { logger } from '@/utils/logger'

/**
 * Export rows to Excel (.xlsx) and trigger browser download
 */
async function exportToExcel(rows = [], filename = 'report.xlsx', sheetName = 'Sheet1') {
  try {
    const { Workbook } = await import('exceljs')
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet(sheetName)

    const columnKeys = rows.length > 0 ? Object.keys(rows[0]) : []
    const columnWidths = columnKeys.reduce((widths, key) => {
      widths[key] = key.length
      return widths
    }, {})

    worksheet.columns = columnKeys.map((key) => ({
      header: key,
      key,
      width: Math.min(Math.max(key.length + 2, 12), 50),
    }))

    rows.forEach((row) => {
      worksheet.addRow(row)
      Object.entries(row).forEach(([key, value]) => {
        const nextWidth = String(value ?? '').length + 2
        columnWidths[key] = Math.max(columnWidths[key] || 0, nextWidth)
      })
    })

    worksheet.columns.forEach((column) => {
      column.width = Math.min(Math.max(columnWidths[column.key] || 12, 12), 50)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob(
      [buffer],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    )
    const downloadUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(downloadUrl)
  } catch (err) {
    logger.error('excelExport.exportToExcel', err)
    throw err
  }
}

export const excelExport = { exportToExcel }
