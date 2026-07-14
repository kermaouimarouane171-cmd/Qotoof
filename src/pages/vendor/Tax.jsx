/**
 * صفحة إدارة الضريبة للبائع.
 * تعرض معلومات TVA المغربي، تقارير ضريبية، وتنبيهات.
 * المنتجات الفلاحية الأولية معفاة من TVA بموجب القانون المغربي.
 * المنتجات المصنعة/المعلبة تخضع لـ TVA بنسبة 20%.
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Card, LoadingSpinner } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatPrice } from '@/utils/currency'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  CalculatorIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

const TVA_RATE = 0.20 // 20% TVA المغربي

const VendorTax = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [selectedPeriod, setSelectedPeriod] = useState('30d')

  const periods = [
    { id: '30d', label: t('vendor.tax.periods.last30', 'آخر 30 يوم') },
    { id: '90d', label: t('vendor.tax.periods.last90', 'آخر 90 يوم') },
    { id: 'ytd', label: t('vendor.tax.periods.ytd', 'منذ بداية السنة') },
    { id: '365d', label: t('vendor.tax.periods.last365', 'آخر سنة') },
  ]

  const getPeriodStart = (period) => {
    const now = new Date()
    switch (period) {
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      case 'ytd':
        return new Date(now.getFullYear(), 0, 1)
      case '365d':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
  }

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const startDate = getPeriodStart(selectedPeriod)

      const [ordersResult, productsResult] = await Promise.all([
        supabase
          .from('orders')
          .select(`
            id,
            total,
            status,
            created_at,
            order_items (
              id,
              product_id,
              quantity,
              unit_price
            )
          `)
          .eq('vendor_id', user.id)
          .in('status', ['delivered', 'vendor_accepted', 'pending'])
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('products')
          .select('id, name, category, price_per_unit, is_available')
          .eq('vendor_id', user.id),
      ])

      if (ordersResult.error) throw ordersResult.error
      if (productsResult.error) throw productsResult.error

      setOrders(ordersResult.data || [])
      setProducts(productsResult.data || [])
    } catch (error) {
      logger.error('[VendorTax] loadData error:', error)
      toast.error(t('vendor.tax.errors.loadFailed', 'تعذر تحميل البيانات الضريبية'))
    } finally {
      setLoading(false)
    }
  }, [user?.id, selectedPeriod, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Classify products: agricultural (exempt) vs processed (TVA 20%)
  // Based on category — agricultural categories are exempt
  const AGRICULTURAL_CATEGORIES = [
    'vegetables', 'fruits', 'fruits_vegetables', 'herbs', 'grains',
    'dairy', 'eggs', 'meat', 'poultry', 'seafood', 'honey',
    'خضروات', 'فواكه', 'حبوب', 'أعشاب', 'منتجات الألبان', 'بيض', 'لحوم', 'دواجن', 'مأكولات بحرية', 'عسل',
  ]

  const isAgriculturalProduct = (productName, category) => {
    const cat = (category || '').toLowerCase().trim()
    const name = (productName || '').toLowerCase().trim()
    return AGRICULTURAL_CATEGORIES.some((c) => cat.includes(c) || name.includes(c))
  }

  // Calculate tax breakdown
  const taxBreakdown = (() => {
    let exemptRevenue = 0
    let taxableRevenue = 0
    let exemptOrders = 0
    let taxableOrders = 0

    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const order of orders) {
      const items = order.order_items || []
      let orderExempt = 0
      let orderTaxable = 0

      for (const item of items) {
        const product = productMap.get(item.product_id)
        const itemRevenue = Number(item.unit_price || 0) * Number(item.quantity || 0)

        if (product && isAgriculturalProduct(product.name, product.category)) {
          orderExempt += itemRevenue
        } else {
          orderTaxable += itemRevenue
        }
      }

      if (orderExempt > 0 && orderTaxable === 0) {
        exemptRevenue += orderExempt
        exemptOrders++
      } else if (orderTaxable > 0) {
        taxableRevenue += orderTaxable + orderExempt
        taxableOrders++
      } else {
        // No items matched — treat as exempt
        exemptRevenue += Number(order.total || 0)
        exemptOrders++
      }
    }

    const tvaCollected = taxableRevenue * TVA_RATE
    const totalRevenue = exemptRevenue + taxableRevenue
    const effectiveRate = totalRevenue > 0 ? (tvaCollected / totalRevenue) * 100 : 0

    return {
      exemptRevenue,
      taxableRevenue,
      exemptOrders,
      taxableOrders,
      tvaCollected,
      totalRevenue,
      effectiveRate,
    }
  })()

  const handleExportTaxReport = () => {
    try {
      const headers = ['Order ID', 'Date', 'Status', 'Total (MAD)', 'Type', 'TVA (MAD)']
      const rows = orders.map((order) => {
        const items = order.order_items || []
        const productMap = new Map(products.map((p) => [p.id, p]))
        let isExempt = true
        for (const item of items) {
          const product = productMap.get(item.product_id)
          if (product && !isAgriculturalProduct(product.name, product.category)) {
            isExempt = false
            break
          }
        }
        const tva = isExempt ? 0 : Number(order.total || 0) * TVA_RATE
        return [
          order.id,
          new Date(order.created_at).toLocaleDateString(),
          order.status,
          Number(order.total || 0).toFixed(2),
          isExempt ? 'معفى' : 'خاضع لـ TVA',
          tva.toFixed(2),
        ]
      })

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tax-report-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(t('vendor.tax.exportSuccess', 'تم تصدير التقرير الضريبي بنجاح'))
    } catch (error) {
      logger.error('[VendorTax] Export error:', error)
      toast.error(t('vendor.tax.exportFailed', 'فشل تصدير التقرير'))
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/vendor/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t('vendor.tax.aria.back', 'العودة إلى لوحة التحكم')}
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CalculatorIcon className="w-7 h-7 text-green-600" />
              {t('vendor.tax.title', 'إدارة الضريبة')}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {t('vendor.tax.subtitle', 'تقارير TVA والمعالجة الضريبية لمبيعاتك')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="input text-sm py-2 pr-8"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <button
            onClick={handleExportTaxReport}
            className="btn-outline text-sm py-2 px-3 flex items-center gap-2"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            {t('vendor.tax.export', 'تصدير')}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="p-5 border-2 border-blue-100 bg-blue-50/50">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">
              {t('vendor.tax.info.title', 'معلومات ضريبية مهمة')}
            </p>
            <p className="text-blue-700">
              {t('vendor.tax.info.description', 'المنتجات الفلاحية الأولية معفاة من TVA بموجب القانون المغربي. المنتجات المصنعة أو المعلبة تخضع لـ TVA بنسبة 20%. هذه الصفحة تساعدك على تتبع وتصنيف مبيعاتك لأغراض ضريبية.')}
            </p>
          </div>
        </div>
      </Card>

      {/* Tax Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <ChartBarIcon className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-700">{t('vendor.tax.totalRevenue', 'إجمالي الإيرادات')}</p>
          </div>
          <p className="text-2xl font-bold text-green-900">{formatPrice(taxBreakdown.totalRevenue)}</p>
          <p className="text-xs text-green-500 mt-1">{orders.length} {t('vendor.tax.orders', 'طلب')}</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <DocumentTextIcon className="w-5 h-5 text-blue-600" />
            <p className="text-sm text-blue-700">{t('vendor.tax.exemptRevenue', 'إيرادات معفاة')}</p>
          </div>
          <p className="text-2xl font-bold text-blue-900">{formatPrice(taxBreakdown.exemptRevenue)}</p>
          <p className="text-xs text-blue-500 mt-1">{taxBreakdown.exemptOrders} {t('vendor.tax.exemptOrders', 'طلب معفى')}</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <CalculatorIcon className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-amber-700">{t('vendor.tax.taxableRevenue', 'إيرادات خاضعة')}</p>
          </div>
          <p className="text-2xl font-bold text-amber-900">{formatPrice(taxBreakdown.taxableRevenue)}</p>
          <p className="text-xs text-amber-500 mt-1">{taxBreakdown.taxableOrders} {t('vendor.tax.taxableOrders', 'طلب خاضع')}</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <CalculatorIcon className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700">{t('vendor.tax.tvaCollected', 'TVA المستحقة')}</p>
          </div>
          <p className="text-2xl font-bold text-red-900">{formatPrice(taxBreakdown.tvaCollected)}</p>
          <p className="text-xs text-red-500 mt-1">
            {t('vendor.tax.effectiveRate', 'معدل فعلي')}: {taxBreakdown.effectiveRate.toFixed(1)}%
          </p>
        </Card>
      </div>

      {/* Tax Breakdown Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {t('vendor.tax.breakdownTitle', 'تفصيل ضريبي حسب الطلب')}
        </h3>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            {t('vendor.tax.noData', 'لا توجد بيانات ضريبية للفترة المحددة')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-right py-3 px-2 font-medium text-gray-500">{t('vendor.tax.table.orderId', 'رقم الطلب')}</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">{t('vendor.tax.table.date', 'التاريخ')}</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">{t('vendor.tax.table.total', 'المبلغ')}</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">{t('vendor.tax.table.type', 'النوع')}</th>
                  <th className="text-right py-3 px-2 font-medium text-gray-500">{t('vendor.tax.table.tva', 'TVA')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 20).map((order) => {
                  const items = order.order_items || []
                  const productMap = new Map(products.map((p) => [p.id, p]))
                  let isExempt = true
                  for (const item of items) {
                    const product = productMap.get(item.product_id)
                    if (product && !isAgriculturalProduct(product.name, product.category)) {
                      isExempt = false
                      break
                    }
                  }
                  const tva = isExempt ? 0 : Number(order.total || 0) * TVA_RATE

                  return (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-2 text-gray-700 font-mono text-xs">{order.id.slice(0, 8)}...</td>
                      <td className="py-3 px-2 text-gray-600">{new Date(order.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-2 text-gray-900 font-medium">{formatPrice(order.total)}</td>
                      <td className="py-3 px-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          isExempt ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {isExempt ? t('vendor.tax.exempt', 'معفى') : t('vendor.tax.taxable', 'خاضع')}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-gray-700">{formatPrice(tva)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {orders.length > 20 && (
              <p className="text-xs text-gray-400 text-center mt-4">
                {t('vendor.tax.showingFirst', 'عرض أول 20 طلب من')} {orders.length}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Disclaimer */}
      <Card className="p-5 bg-gray-50 border-gray-200">
        <p className="text-xs text-gray-500">
          {t('vendor.tax.disclaimer', 'تنبيه: هذه التقارير لأغراض استرشادية فقط. يُنصح باستشارة محاسب أو خبير ضريبي معتمد للإقرار الضريبي الرسمي. القوانين الضريبية في المغرب قد تتغير، ويجب التحقق من المعدلات الحالية مع المديرية العامة للضرائب.')}
        </p>
      </Card>
    </div>
  )
}

export default VendorTax
