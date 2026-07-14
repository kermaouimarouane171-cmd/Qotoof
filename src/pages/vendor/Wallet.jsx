import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, LoadingSpinner, Badge } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import { commissionService } from '@/modules/commissions'
import { supabase } from '@/services/supabase'
import { formatPrice } from '@/utils/currency'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'
import { APP_CONFIG } from '@/config/appConfig'
import {
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getLocale = (lang) =>
  lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-US'

const formatMAD = (value, lang) =>
  new Intl.NumberFormat(getLocale(lang), {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const formatDate = (value, lang) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString(getLocale(lang), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const STATUS_COLORS = {
  delivered: 'bg-green-100 text-green-700',
  vendor_accepted: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-600',
  vendor_rejected: 'bg-red-100 text-red-600',
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, color = 'text-gray-900', bg = 'bg-white' }) {
  return (
    <Card className={`p-4 ${bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`text-xl font-bold ${color}`}>{value}</p>
        </div>
        <div className="shrink-0 w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-gray-600" />
        </div>
      </div>
    </Card>
  )
}

// ─── Ledger Row ───────────────────────────────────────────────────────────────

function LedgerRow({ order, lang, t, commissionRate }) {
  const [open, setOpen] = useState(false)
  const gross = Number(order.total || 0)
  const commission = +(gross * commissionRate).toFixed(2)
  const net = +(gross - commission).toFixed(2)
  const statusColor = STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'
  const statusLabel = t(`vendor.orders.status.${order.status}`, order.status)

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-right"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">
            {order.status === 'delivered'
              ? <CheckCircleIcon className="w-4 h-4 text-green-500" />
              : <ClockIcon className="w-4 h-4 text-gray-400" />}
          </div>
          <div className="min-w-0 text-right">
            <p className="text-sm font-medium text-gray-900">#{order.order_number}</p>
            <p className="text-xs text-gray-500">{formatDate(order.created_at, lang)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${statusColor}`}>
            {statusLabel}
          </span>
          <p className="text-sm font-bold text-green-700">{formatMAD(net, lang)}</p>
          {open ? <ChevronUpIcon className="w-4 h-4 text-gray-400" /> : <ChevronDownIcon className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 bg-gray-50">
          <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">{t('vendor.wallet.ledger.gross', 'إجمالي الطلب')}</span>
              <span className="font-medium">{formatMAD(gross, lang)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('vendor.wallet.ledger.commission', 'عمولة المنصة (3%)')}</span>
              <span className="font-medium text-red-600">- {formatMAD(commission, lang)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-1 mt-1">
              <span className="font-semibold text-gray-900">{t('vendor.wallet.ledger.net', 'صافي الأرباح')}</span>
              <span className="font-bold text-green-700">{formatMAD(net, lang)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VendorWallet() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const lang = i18n.language

  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [commissionSummary, setCommissionSummary] = useState(null)
  const [commissionHistory, setCommissionHistory] = useState([])
  const [commissionRate, setCommissionRate] = useState(APP_CONFIG.commissionRate)

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [ordersRes, summaryRes, historyRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, total, status, created_at, payment_status')
          .eq('vendor_id', user.id)
          .in('status', ['delivered', 'vendor_accepted', 'driver_assigned', 'driver_accepted', 'driver_picked_up', 'on_the_way'])
          .order('created_at', { ascending: false })
          .limit(50),
        commissionService.getCurrentMonthSummary(user.id),
        commissionService.getVendorCommissionHistory(user.id),
        // Fetch the vendor's commission rate from their subscription plan
        supabase
          .from('profiles')
          .select('subscription_plan')
          .eq('id', user.id)
          .single(),
      ])

      if (ordersRes.error) throw ordersRes.error
      setOrders(ordersRes.data || [])

      if (summaryRes?.success) setCommissionSummary(summaryRes)
      if (historyRes?.success) setCommissionHistory(historyRes.history || [])

      // Resolve commission rate from subscription plan
      const profileRes = arguments[0]?.[3]
      const planId = profileRes?.data?.subscription_plan
      if (planId) {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('commission_rate')
          .eq('id', planId)
          .eq('is_active', true)
          .single()
        if (plan?.commission_rate != null) {
          setCommissionRate(Number(plan.commission_rate) / 100)
        }
      }
    } catch (err) {
      logger.error('[VendorWallet] loadData', err)
      toast.error(t('vendor.wallet.errors.loadFailed', 'تعذّر تحميل بيانات المحفظة'))
    } finally {
      setLoading(false)
    }
  }, [user?.id, t])

  useEffect(() => { loadData() }, [loadData])

  // ── Derived totals ────────────────────────────────────────────────────────
  const deliveredOrders = orders.filter((o) => o.status === 'delivered')
  const pendingOrders = orders.filter((o) => o.status !== 'delivered')

  const totalGross = deliveredOrders.reduce((s, o) => s + Number(o.total || 0), 0)
  const totalCommission = +(totalGross * commissionRate).toFixed(2)
  const totalNet = +(totalGross - totalCommission).toFixed(2)

  const commissionOwed = Number(
    Math.max(
      Number(commissionSummary?.commission_due || 0) - Number(commissionSummary?.commission_paid || 0),
      0
    ).toFixed(2)
  )

  const pendingRevenue = pendingOrders.reduce((s, o) => s + Number(o.total || 0), 0)

  const hasOverdue = commissionHistory.some((r) => r.status === 'overdue')

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('vendor.wallet.title', 'المحفظة والأرباح')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('vendor.wallet.subtitle', 'متابعة أرباحك وعمولاتك المستحقة')}</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh', 'تحديث')}
        </button>
      </div>

      {/* Overdue warning */}
      {hasOverdue && !loading && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800">
          <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">{t('vendor.wallet.overdueAlert.title', 'عمولة متأخرة السداد')}</p>
            <p className="text-xs mt-0.5">{t('vendor.wallet.overdueAlert.description', 'لديك فاتورة عمولة متأخرة. يرجى السداد لتجنب تجميد الحساب.')}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              icon={ArrowTrendingUpIcon}
              label={t('vendor.wallet.stats.totalNet', 'صافي الأرباح (مُسلَّمة)')}
              value={formatMAD(totalNet, lang)}
              color="text-green-700"
            />
            <SummaryCard
              icon={ClockIcon}
              label={t('vendor.wallet.stats.pendingRevenue', 'إيرادات قيد التوصيل')}
              value={formatMAD(pendingRevenue, lang)}
              color="text-blue-700"
            />
            <SummaryCard
              icon={ArrowTrendingDownIcon}
              label={t('vendor.wallet.stats.commissionOwed', 'عمولة مستحقة هذا الشهر')}
              value={formatMAD(commissionOwed, lang)}
              color={commissionOwed > 0 ? 'text-amber-700' : 'text-gray-500'}
            />
            <SummaryCard
              icon={BanknotesIcon}
              label={t('vendor.wallet.stats.totalSales', 'إجمالي المبيعات (مُسلَّمة)')}
              value={formatMAD(totalGross, lang)}
            />
          </div>

          {/* Commission This Month */}
          {commissionSummary && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900">{t('vendor.wallet.commission.title', 'العمولة الشهرية')}</h2>
                <Badge className={
                  commissionSummary.status === 'paid' ? 'bg-green-100 text-green-700' :
                  commissionSummary.status === 'overdue' ? 'bg-red-100 text-red-700' :
                  commissionSummary.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }>
                  {t(`vendor.wallet.commission.status.${commissionSummary.status}`, commissionSummary.status)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('vendor.wallet.commission.period', 'الفترة')}</p>
                  <p className="font-semibold">{commissionSummary.month_label || `${commissionSummary.month}/${commissionSummary.year}`}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('vendor.wallet.commission.sales', 'المبيعات')}</p>
                  <p className="font-semibold">{formatMAD(commissionSummary.total_sales, lang)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('vendor.wallet.commission.due', 'العمولة المستحقة')}</p>
                  <p className="font-semibold text-red-600">{formatMAD(commissionSummary.commission_due, lang)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('vendor.wallet.commission.paid', 'المدفوع')}</p>
                  <p className="font-semibold text-green-600">{formatMAD(commissionSummary.commission_paid, lang)}</p>
                </div>
              </div>
              {commissionSummary.due_date && (
                <p className="text-xs text-gray-500 mt-3">
                  {t('vendor.wallet.commission.dueDate', 'تاريخ الاستحقاق')}: <span className="font-medium">{formatDate(commissionSummary.due_date, lang)}</span>
                </p>
              )}
            </Card>
          )}

          {/* Commission History */}
          {commissionHistory.length > 0 && (
            <Card className="p-5">
              <h2 className="text-base font-bold text-gray-900 mb-4">{t('vendor.wallet.history.title', 'سجل العمولات')}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-right pb-2 pr-2">{t('vendor.wallet.history.period', 'الفترة')}</th>
                      <th className="text-right pb-2 px-2">{t('vendor.wallet.history.sales', 'المبيعات')}</th>
                      <th className="text-right pb-2 px-2">{t('vendor.wallet.history.due', 'المستحق')}</th>
                      <th className="text-right pb-2 px-2">{t('vendor.wallet.history.paid', 'المدفوع')}</th>
                      <th className="text-right pb-2 pl-2">{t('vendor.wallet.history.status', 'الحالة')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionHistory.slice(0, 12).map((row) => (
                      <tr key={row.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-2 font-medium text-gray-900">{row.month_label || `${row.month}/${row.year}`}</td>
                        <td className="py-2 px-2 text-gray-700">{formatMAD(row.total_sales, lang)}</td>
                        <td className="py-2 px-2 text-red-600 font-medium">{formatMAD(row.commission_due, lang)}</td>
                        <td className="py-2 px-2 text-green-600 font-medium">{formatMAD(row.commission_paid, lang)}</td>
                        <td className="py-2 pl-2">
                          <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                            row.status === 'paid' ? 'bg-green-100 text-green-700' :
                            row.status === 'overdue' ? 'bg-red-100 text-red-700' :
                            row.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {t(`vendor.wallet.commission.status.${row.status}`, row.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Orders Ledger */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">{t('vendor.wallet.ledger.title', 'سجل الإيرادات')}</h2>
              <span className="text-xs text-gray-500">{t('vendor.wallet.ledger.count', 'آخر {{count}} طلب', { count: orders.length })}</span>
            </div>
            {orders.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <BanknotesIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="font-medium">{t('vendor.wallet.ledger.empty', 'لا توجد طلبات مكتملة بعد')}</p>
                <p className="text-sm mt-1">{t('vendor.wallet.ledger.emptyHint', 'ستظهر هنا أرباحك عند اكتمال الطلبات')}</p>
              </div>
            ) : (
              <div>
                {orders.map((order) => (
                  <LedgerRow key={order.id} order={order} lang={lang} t={t} commissionRate={commissionRate} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
