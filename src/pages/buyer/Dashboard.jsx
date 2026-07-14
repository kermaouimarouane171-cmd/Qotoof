import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/modules/cart'
import { Breadcrumbs } from '@/components/ui'
import { logger } from '@/utils/logger'
import {
  ShoppingBagIcon,
  ClipboardDocumentListIcon,
  TruckIcon,
  HeartIcon,
  TagIcon,
  StarIcon,
  ArrowRightIcon,
  CurrencyDollarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { formatPrice } from '@/utils/currency'

const BuyerDashboard = () => {
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const { items: cartItems } = useCartStore()

  const { data: stats = { totalOrders: 0, activeOrders: 0, totalSpent: 0, loyaltyPoints: 0 } } = useQuery({
    queryKey: ['buyer-dashboard-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return { totalOrders: 0, activeOrders: 0, totalSpent: 0, loyaltyPoints: 0 }

      const [ordersResult, loyaltyResult] = await Promise.all([
        supabase
          .from('orders')
          .select('id, total, status, created_at')
          .eq('buyer_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('loyalty_transactions')
          .select('points')
          .eq('user_id', user.id),
      ])

      if (ordersResult.error) logger.error('Dashboard: orders error', ordersResult.error)
      if (loyaltyResult.error) logger.error('Dashboard: loyalty error', loyaltyResult.error)

      const orders = ordersResult.data || []
      const activeStatuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'picked_up']
      const activeOrders = orders.filter((o) => activeStatuses.includes(o.status))
      const totalSpent = orders
        .filter((o) => o.status === 'delivered')
        .reduce((sum, o) => sum + Number(o.total || 0), 0)
      const loyaltyPoints = (loyaltyResult.data || []).reduce((sum, t) => sum + Number(t.points || 0), 0)

      return {
        totalOrders: orders.length,
        activeOrders: activeOrders.length,
        totalSpent,
        loyaltyPoints,
        recentOrders: orders.slice(0, 5),
      }
    },
    enabled: Boolean(user?.id),
    staleTime: 60 * 1000,
  })

  const quickActions = [
    { to: '/marketplace', icon: ShoppingBagIcon, label: t('dashboard.quickActions.marketplace', 'Browse Marketplace'), color: 'bg-green-50 text-green-700' },
    { to: '/buyer/orders', icon: ClipboardDocumentListIcon, label: t('dashboard.quickActions.orders', 'My Orders'), color: 'bg-blue-50 text-blue-700' },
    { to: '/buyer/tracking', icon: TruckIcon, label: t('dashboard.quickActions.tracking', 'Track Deliveries'), color: 'bg-indigo-50 text-indigo-700' },
    { to: '/favorites', icon: HeartIcon, label: t('dashboard.quickActions.favorites', 'Favorites'), color: 'bg-red-50 text-red-700' },
    { to: '/buyer/coupons', icon: TagIcon, label: t('dashboard.quickActions.coupons', 'Coupons'), color: 'bg-amber-50 text-amber-700' },
    { to: '/buyer/loyalty', icon: StarIcon, label: t('dashboard.quickActions.loyalty', 'Loyalty'), color: 'bg-purple-50 text-purple-700' },
  ]

  const statCards = [
    { label: t('dashboard.stats.totalOrders', 'Total Orders'), value: stats.totalOrders, icon: ClipboardDocumentListIcon, color: 'text-blue-600' },
    { label: t('dashboard.stats.activeOrders', 'Active Orders'), value: stats.activeOrders, icon: TruckIcon, color: 'text-indigo-600' },
    { label: t('dashboard.stats.totalSpent', 'Total Spent'), value: formatPrice(stats.totalSpent), icon: CurrencyDollarIcon, color: 'text-green-600' },
    { label: t('dashboard.stats.loyaltyPoints', 'Loyalty Points'), value: stats.loyaltyPoints, icon: StarIcon, color: 'text-purple-600' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs />

      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {t('dashboard.welcome', 'Welcome back')}, {profile?.first_name || user?.email?.split('@')[0] || ''}
        </h1>
        <p className="text-gray-500 mt-1">{t('dashboard.subtitle', 'Here\'s your account overview')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4">{t('dashboard.quickActions.title', 'Quick Actions')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${action.color}`}>
                <action.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Cart Preview + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cart Preview */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <ShoppingBagIcon className="w-5 h-5 text-green-500" />
              {t('dashboard.cart.title', 'Your Cart')}
            </h2>
            <Link to="/cart" className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1">
              {t('dashboard.cart.view', 'View')}
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
          {cartItems.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">{t('dashboard.cart.empty', 'Your cart is empty')}</p>
          ) : (
            <div className="space-y-2">
              {cartItems.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                  <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0 overflow-hidden">
                    {item.image && <img src={item.image} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.quantity} {item.unit_type}</p>
                  </div>
                  <p className="text-sm font-semibold text-green-600">{formatPrice(item.price_per_unit || item.price)}</p>
                </div>
              ))}
              {cartItems.length > 3 && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  {t('dashboard.cart.moreItems', '+{{count}} more items', { count: cartItems.length - 3 })}
                </p>
              )}
              <Link to="/checkout" className="btn-primary w-full mt-3 text-sm">
                {t('dashboard.cart.checkout', 'Proceed to Checkout')}
              </Link>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-blue-500" />
              {t('dashboard.recentOrders.title', 'Recent Orders')}
            </h2>
            <Link to="/buyer/orders" className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1">
              {t('dashboard.recentOrders.viewAll', 'View All')}
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
          {!stats.recentOrders || stats.recentOrders.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">{t('dashboard.recentOrders.empty', 'No orders yet')}</p>
          ) : (
            <div className="space-y-2">
              {stats.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">#{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatPrice(order.total)}</p>
                    <p className="text-xs text-gray-400 capitalize">{order.status}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BuyerDashboard
