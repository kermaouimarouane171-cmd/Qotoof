import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { logger } from '@/utils/logger'

/**
 * Export a DOM element as PDF via html2canvas + jsPDF
 */
async function exportElementToPDF(elementId, filename = 'report.pdf', title = '') {
  const el = document.getElementById(elementId)
  if (!el) throw new Error(`Element #${elementId} not found`)

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })

    const imgData = canvas.toDataURL('image/jpeg', 0.95)
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    // Header
    if (title) {
      pdf.setFontSize(14)
      pdf.setTextColor(33, 33, 33)
      pdf.text(title, pageW / 2, 14, { align: 'center' })
      pdf.setFontSize(9)
      pdf.setTextColor(120, 120, 120)
      pdf.text(new Date().toLocaleDateString('ar-MA'), pageW / 2, 20, { align: 'center' })
    }

    const topPad = title ? 25 : 10
    const availH = pageH - topPad - 10
    const availW = pageW - 20

    const ratio = canvas.width / canvas.height
    let imgW = availW
    let imgH = imgW / ratio
    if (imgH > availH) { imgH = availH; imgW = imgH * ratio }

    pdf.addImage(imgData, 'JPEG', (pageW - imgW) / 2, topPad, imgW, imgH)
    pdf.save(filename)
  } catch (err) {
    logger.error('pdfExport.exportElementToPDF', err)
    throw err
  }
}

/**
 * Export rows to a simple PDF table without DOM element
 */
function exportTableToPDF(columns = [], rows = [], filename = 'report.pdf', title = '') {
  try {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()

    // Title
    pdf.setFontSize(13)
    pdf.setTextColor(30, 30, 30)
    pdf.text(title || filename.replace('.pdf', ''), pageW / 2, 15, { align: 'center' })
    pdf.setFontSize(8)
    pdf.setTextColor(130, 130, 130)
    pdf.text(new Date().toLocaleDateString('ar-MA'), pageW / 2, 21, { align: 'center' })

    // Table headers
    const colW = (pageW - 20) / columns.length
    let y = 30

    pdf.setFillColor(34, 197, 94) // green-500
    pdf.rect(10, y - 5, pageW - 20, 8, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)
    columns.forEach((col, i) => {
      pdf.text(String(col.label || col), 12 + i * colW, y)
    })
    y += 8

    // Rows
    rows.forEach((row, rowIdx) => {
      if (y > pdf.internal.pageSize.getHeight() - 20) {
        pdf.addPage()
        y = 20
      }
      if (rowIdx % 2 === 0) {
        pdf.setFillColor(248, 250, 252)
        pdf.rect(10, y - 4, pageW - 20, 7, 'F')
      }
      pdf.setTextColor(50, 50, 50)
      columns.forEach((col, i) => {
        const val = typeof col === 'object' ? row[col.key] : row[col]
        pdf.text(String(val ?? ''), 12 + i * colW, y, { maxWidth: colW - 2 })
      })
      y += 7
    })

    pdf.save(filename)
  } catch (err) {
    logger.error('pdfExport.exportTableToPDF', err)
    throw err
  }
}

export const pdfExport = { exportElementToPDF, exportTableToPDF }
