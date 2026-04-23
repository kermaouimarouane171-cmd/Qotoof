import { memo } from 'react'
import { useTranslation } from 'react-i18next'

const COLUMNS_MAP = {
  sales: [
    { key: 'id', label: 'رقم الطلب' },
    { key: 'created_at', label: 'التاريخ' },
    { key: 'buyer_full_name', label: 'المشتري' },
    { key: 'total_amount', label: 'المبلغ الكلي (د.م)' },
    { key: 'status', label: 'الحالة' },
    { key: 'payment_method', label: 'طريقة الدفع' }
  ],
  users: [
    { key: 'id', label: 'المعرف' },
    { key: 'full_name', label: 'الاسم الكامل' },
    { key: 'email', label: 'البريد الإلكتروني' },
    { key: 'role', label: 'الدور' },
    { key: 'created_at', label: 'تاريخ التسجيل' },
    { key: 'is_active', label: 'نشط' }
  ],
  inventory: [
    { key: 'name', label: 'المنتج' },
    { key: 'category', label: 'الفئة' },
    { key: 'price', label: 'السعر (د.م)' },
    { key: 'stock_quantity', label: 'المخزون' },
    { key: 'vendor_full_name', label: 'المورد' },
    { key: 'is_active', label: 'نشط' }
  ],
  delivery: [
    { key: 'id', label: 'رقم الطلب' },
    { key: 'created_at', label: 'التاريخ' },
    { key: 'driver_full_name', label: 'السائق' },
    { key: 'buyer_full_name', label: 'العميل' },
    { key: 'buyer_city', label: 'المدينة' },
    { key: 'status', label: 'الحالة' }
  ]
}

function flattenReport(rows, type) {
  return rows.map(row => {
    if (type === 'sales') {
      return {
        id: row.id,
        created_at: new Date(row.created_at).toLocaleDateString('ar-MA'),
        buyer_full_name: row.buyer?.full_name || '',
        total_amount: row.total_amount,
        status: row.status,
        payment_method: row.payment_method
      }
    }
    if (type === 'inventory') {
      return {
        name: row.name,
        category: row.category,
        price: row.price,
        stock_quantity: row.stock_quantity,
        vendor_full_name: row.vendor?.full_name || '',
        is_active: row.is_active ? 'نعم' : 'لا'
      }
    }
    if (type === 'delivery') {
      return {
        id: row.id,
        created_at: new Date(row.created_at).toLocaleDateString('ar-MA'),
        driver_full_name: row.driver?.full_name || '',
        buyer_full_name: row.buyer?.full_name || '',
        buyer_city: row.buyer?.city || '',
        status: row.status
      }
    }
    return row
  })
}

const ReportPreview = memo(function ReportPreview({ rows = [], type = 'sales', loading = false }) {
  const { t } = useTranslation()
  const columns = COLUMNS_MAP[type] || []
  const flatRows = flattenReport(rows, type)

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        {t('reports.noData', 'لا توجد بيانات')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto" id="report-preview-table">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-green-500 text-white">
            {columns.map(col => (
              <th key={col.key} className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {flatRows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}>
              {columns.map(col => (
                <td key={col.key} className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})

export { COLUMNS_MAP, flattenReport }
export default ReportPreview
