import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Button, LoadingSpinner } from '@/components/ui'
import inventoryService from '@/services/inventoryService'
import { formatPrice } from '@/utils/currency'
import {
  ArchiveBoxIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { useTranslation } from 'react-i18next'

const InventoryManager = ({ vendorId, onInventoryChange }) => {
  const { t } = useTranslation()
  const FILTERS = [
    { id: 'all', label: t('vendor.inventory.filters.all', 'الكل') },
    { id: 'low', label: t('vendor.inventory.filters.lowStock', 'منخفض') },
    { id: 'out', label: t('vendor.inventory.filters.outOfStock', 'نافد') },
  ]
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [draftStock, setDraftStock] = useState({})
  const [savingById, setSavingById] = useState({})
  const [activeFilter, setActiveFilter] = useState('all')

  const loadInventory = useCallback(async () => {
    if (!vendorId) return

    setLoading(true)
    try {
      const response = await inventoryService.getInventorySummary(vendorId)
      setItems(response.items)
      setSummary(response.summary)
      setDraftStock(
        response.items.reduce((accumulator, item) => {
          accumulator[item.id] = String(item.currentStock)
          return accumulator
        }, {})
      )
    } catch (error) {
      logger.error('Error loading inventory summary:', error)
      toast.error(t('vendor.inventory.loadFailed', 'تعذر تحميل بيانات المخزون'))
    } finally {
      setLoading(false)
    }
  }, [vendorId])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  const filteredItems = useMemo(() => {
    if (activeFilter === 'low') {
      return items.filter((item) => item.currentStock > 0 && item.currentStock <= item.threshold)
    }

    if (activeFilter === 'out') {
      return items.filter((item) => item.currentStock <= 0)
    }

    return items
  }, [activeFilter, items])

  const handleStockDraftChange = (productId, value) => {
    setDraftStock((previous) => ({
      ...previous,
      [productId]: value,
    }))
  }

  const handleQuickAdjust = (productId, currentStock, delta) => {
    const nextValue = Math.max(0, Number(currentStock || 0) + delta)
    handleStockDraftChange(productId, String(nextValue))
  }

  const handleSave = async (item) => {
    const nextQuantity = Number(draftStock[item.id])
    if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
      toast.error(t('vendor.inventory.invalidQuantity', 'أدخل كمية صحيحة للمخزون'))
      return
    }

    setSavingById((previous) => ({ ...previous, [item.id]: true }))
    try {
      await inventoryService.updateProductStock({
        productId: item.id,
        vendorId,
        nextQuantity,
      })

      toast.success(t('vendor.inventory.updateSuccess', 'تم تحديث المخزون بنجاح'))
      await loadInventory()
      await onInventoryChange?.()
    } catch (error) {
      logger.error('Error updating stock from inventory manager:', error)
      toast.error(error.message || t('vendor.inventory.updateFailed', 'تعذر تحديث المخزون'))
    } finally {
      setSavingById((previous) => ({ ...previous, [item.id]: false }))
    }
  }

  if (loading) {
    return (
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6 mb-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">إدارة المخزون السريعة</h2>
            <p className="text-sm text-gray-500 mt-1">تابع المنتجات منخفضة المخزون وعدّل الكميات بدون فتح نافذة المنتج.</p>
          </div>
          <Button variant="outline" onClick={loadInventory} leftIcon={<ArrowPathIcon className="w-4 h-4" />}>
            تحديث
          </Button>
        </div>

        <div className="grid gap-4 mt-6 md:grid-cols-5">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">إجمالي المنتجات</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{summary?.totalProducts || 0}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">متوفر جيداً</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{summary?.inStock || 0}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">مخزون منخفض</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{summary?.lowStock || 0}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm text-rose-700">نافد</p>
            <p className="mt-2 text-2xl font-bold text-rose-700">{summary?.outOfStock || 0}</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm text-sky-700">قوائم انتظار نشطة</p>
            <p className="mt-2 text-2xl font-bold text-sky-700">{summary?.activeWaitlists || 0}</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    activeFilter === filter.id
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500">قيمة المخزون الحالية: <span className="font-semibold text-gray-900">{formatPrice(summary?.inventoryValue || 0)}</span></p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <ArchiveBoxIcon className="mx-auto mb-3 h-12 w-12 text-gray-300" />
            <p>لا توجد منتجات ضمن هذا الفلتر.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>السعر</th>
                  <th>المخزون الحالي</th>
                  <th>حد التنبيه</th>
                  <th>قائمة الانتظار</th>
                  <th>إجراء سريع</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isLowStock = item.currentStock > 0 && item.currentStock <= item.threshold
                  const isOutOfStock = item.currentStock <= 0

                  return (
                    <tr key={item.id}>
                      <td>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">آخر تحديث: {item.updated_at ? new Date(item.updated_at).toLocaleDateString('ar-MA') : 'غير متوفر'}</p>
                        </div>
                      </td>
                      <td>{formatPrice(item.price_per_unit)}/{item.unit_type}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {isOutOfStock ? (
                            <ExclamationTriangleIcon className="h-4 w-4 text-rose-500" />
                          ) : isLowStock ? (
                            <BellAlertIcon className="h-4 w-4 text-amber-500" />
                          ) : (
                            <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                          )}
                          <span className={`font-semibold ${isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {Number(item.currentStock).toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td>{Number(item.threshold).toFixed(2)}</td>
                      <td>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${item.waitlistCount > 0 ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500'}`}>
                          {item.waitlistCount}
                        </span>
                      </td>
                      <td>
                        <div className="flex min-w-[280px] items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item.id, draftStock[item.id] ?? item.currentStock, -1)}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            -1
                          </button>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draftStock[item.id] ?? item.currentStock}
                            onChange={(event) => handleStockDraftChange(item.id, event.target.value)}
                            className="input w-24 text-center"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item.id, draftStock[item.id] ?? item.currentStock, 10)}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            +10
                          </button>
                          <Button
                            size="sm"
                            onClick={() => handleSave(item)}
                            isLoading={savingById[item.id]}
                          >
                            حفظ
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

export default InventoryManager