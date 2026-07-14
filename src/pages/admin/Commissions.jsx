import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { platformSettings } from '@/modules/admin'
import { getAdminCommissionsPayments } from '@/modules/commissions'
import { Card, LoadingSpinner } from '@/components/ui'
import {
  BanknotesIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  ArrowDownIcon,
  ArrowUpIcon,
} from '@heroicons/react/24/outline'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'
import { logger } from '@/utils/logger'

const AdminCommissionsPage = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalCommission: 0,
    totalOrders: 0,
    avgCommission: 0,
    thisMonth: 0,
    lastMonth: 0,
    growth: 0,
  })
  const [payments, setPayments] = useState([])
  const [chartData, setChartData] = useState([])
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  const loadData = async () => {
    try {
      setLoading(true)

      const now = new Date()

      // Fetch platform commission rate (default 10%)
      const settings = await platformSettings.getSettings()
      const commissionRate = (settings?.commission_rate ?? 3) / 100

      // Load all payments (commission is calculated from amount)
      const { data: paymentsRaw, error: paymentsError } = await getAdminCommissionsPayments({ period })

      if (paymentsError) throw paymentsError

      const paymentsData = (paymentsRaw || []).map((p) => ({
        ...p,
        commission: (p.amount || 0) * commissionRate,
        vendor_amount: (p.amount || 0) * (1 - commissionRate),
      }))

      setPayments(paymentsData)

      // Calculate stats
      const totalCommission = paymentsData.reduce((sum, p) => sum + (p.commission || 0), 0)
      const thisMonth = paymentsData
        .filter(p => {
          const date = new Date(p.created_at)
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
        })
        .reduce((sum, p) => sum + (p.commission || 0), 0)

      const lastMonth = paymentsData
        .filter(p => {
          const date = new Date(p.created_at)
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear()
        })
        .reduce((sum, p) => sum + (p.commission || 0), 0)

      const growth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0

      setStats({
        totalCommission: totalCommission.toFixed(2),
        totalOrders: paymentsData.length,
        avgCommission: paymentsData.length > 0 ? (totalCommission / paymentsData.length).toFixed(2) : 0,
        thisMonth: thisMonth.toFixed(2),
        lastMonth: lastMonth.toFixed(2),
        growth: growth.toFixed(1),
      })

      // Chart data - group by day
      const dailyData = {}
      paymentsData.forEach(p => {
        const date = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        if (!dailyData[date]) {
          dailyData[date] = { date, commission: 0, orders: 0 }
        }
        dailyData[date].commission += p.commission || 0
        dailyData[date].orders += 1
      })

      const chartDataArray = Object.values(dailyData)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-30)

      setChartData(chartDataArray)
    } catch (error) {
      logger.error('Load commissions error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('admin.commissions.title', 'Commissions Dashboard')}</h1>
        <p className="text-gray-600">{t('admin.commissions.subtitle', 'Track your platform earnings from vendor commissions')}</p>
        <div className="mt-4 max-w-xs">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input w-full"
            aria-label={t('admin.commissions.period', 'Analytics period')}
          >
            <option value="7d">{t('admin.commissions.last7Days', 'Last 7 days')}</option>
            <option value="30d">{t('admin.commissions.last30Days', 'Last 30 days')}</option>
            <option value="90d">{t('admin.commissions.last90Days', 'Last 90 days')}</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <BanknotesIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('admin.commissions.totalCommissions', 'Total Commissions')}</p>
              <p className="text-2xl font-bold text-green-600">{stats.totalCommission} MAD</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <ChartBarIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('admin.commissions.thisMonth', 'This Month')}</p>
              <p className="text-2xl font-bold text-blue-600">{stats.thisMonth} MAD</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('admin.commissions.growth', 'Growth')}</p>
              <div className="flex items-center gap-1">
                <p className="text-2xl font-bold text-purple-600">{stats.growth}%</p>
                {parseFloat(stats.growth) >= 0 ? (
                  <ArrowUpIcon className="w-4 h-4 text-green-600" />
                ) : (
                  <ArrowDownIcon className="w-4 h-4 text-red-600" />
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('admin.commissions.avgPerOrder', 'Avg per Order')}</p>
              <p className="text-2xl font-bold text-orange-600">{stats.avgCommission} MAD</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{t('admin.commissions.commissionOverTime', 'Commission Over Time')}</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="commission" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              {t('admin.commissions.noDataYet', 'No data yet')}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{t('admin.commissions.ordersOverTime', 'Orders Over Time')}</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="orders" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              {t('admin.commissions.noDataYet', 'No data yet')}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Payments Table */}
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">{t('admin.commissions.recentTransactions', 'Recent Transactions')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('admin.commissions.orderId', 'Order ID')}</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">{t('admin.commissions.user', 'User')}</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">{t('admin.commissions.amount', 'Amount')}</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">{t('admin.commissions.commission', 'Commission')}</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">{t('admin.commissions.vendorGets', 'Vendor Gets')}</th>
                <th className="text-center py-3 px-4 text-gray-500 font-medium">{t('admin.commissions.status', 'Status')}</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">{t('admin.commissions.date', 'Date')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.length > 0 ? (
                payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono text-xs">{payment.order_id?.substring(0, 8)}</td>
                    <td className="py-3 px-4 text-gray-400">
                      {t('admin.commissions.userUnavailable', 'Unavailable')}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">{payment.amount?.toFixed(2)} MAD</td>
                    <td className="py-3 px-4 text-right text-green-600 font-semibold">
                      +{payment.commission?.toFixed(2)} MAD
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">
                      {payment.vendor_amount?.toFixed(2)} MAD
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                        payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-gray-500">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-500">
                    {t('admin.commissions.noTransactionsYet', 'No transactions yet')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export default AdminCommissionsPage
