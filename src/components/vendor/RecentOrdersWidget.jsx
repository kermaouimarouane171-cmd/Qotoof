import { Card } from '@/components/ui'
import { ClockIcon, CheckIcon, XMarkIcon, TruckIcon } from '@heroicons/react/24/outline'
import { getOrderStatusColors, STATUS_I18N_KEYS, getOrderStatusLabel } from '@/modules/orders'

const STATUS_ICONS_VENDOR = {
  pending: ClockIcon,
  vendor_accepted: CheckIcon,
  vendor_rejected: XMarkIcon,
  driver_assigned: TruckIcon,
  on_the_way: TruckIcon,
  delivered: CheckIcon,
  cancelled: XMarkIcon,
}

export default function RecentOrdersWidget({ recentOrders, formatPrice, locale, onViewOrder, onViewAll, t }) {
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">
          {t('vendor.dashboard.recentOrders.title', 'Recent Orders')}
        </h3>
        <button
          onClick={onViewAll}
          className="text-sm text-green-600 font-medium hover:underline"
        >
          {t('common.viewAll', 'View All')}
        </button>
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{t('vendor.orders.orderId', 'Order ID')}</th>
              <th>{t('vendor.orders.buyer', 'Buyer')}</th>
              <th>{t('vendor.orders.total', 'Total')}</th>
              <th>{t('vendor.orders.status', 'Status')}</th>
              <th>{t('vendor.orders.date', 'Date')}</th>
              <th>{t('vendor.dashboard.recentOrders.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-500">
                  {t('vendor.dashboard.recentOrders.noOrders', 'No orders yet')}
                </td>
              </tr>
            ) : (
              recentOrders.slice(0, 8).map((order) => {
                const sc = getOrderStatusColors(order.status)
                const Icon = STATUS_ICONS_VENDOR[order.status] || ClockIcon
                return (
                  <tr key={order.id}>
                    <td>
                      <span className="font-semibold text-green-600 text-sm">
                        {order.order_number || order.id?.slice(0, 8)}
                      </span>
                    </td>
                    <td className="font-medium text-sm">
                      {order.buyer?.first_name} {order.buyer?.last_name}
                    </td>
                    <td className="font-semibold text-sm">{formatPrice(order.total)}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${sc.bg} ${sc.text} border ${sc.border}`}>
                        <Icon className="w-3 h-3" />
                        {t(STATUS_I18N_KEYS[order.status] || `admin.orders.status.${order.status}`, getOrderStatusLabel(order.status))}
                      </span>
                    </td>
                    <td className="text-gray-500 text-sm">
                      {new Date(order.created_at).toLocaleDateString(locale, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <button
                        onClick={() => onViewOrder(order.id)}
                        className="text-sm text-green-600 hover:underline font-medium"
                      >
                        {t('vendor.dashboard.recentOrders.view', 'View')}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden space-y-3">
        {recentOrders.length === 0 ? (
          <p className="text-center py-8 text-gray-500 text-sm">
            {t('vendor.dashboard.recentOrders.noOrders', 'No orders yet')}
          </p>
        ) : (
          recentOrders.slice(0, 5).map((order) => {
            const sc = getOrderStatusColors(order.status)
            const Icon = STATUS_ICONS_VENDOR[order.status] || ClockIcon
            return (
              <div
                key={order.id}
                className="p-4 bg-gray-50 rounded-xl border border-gray-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-green-600 text-sm">
                    {order.order_number || order.id?.slice(0, 8)}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${sc.bg} ${sc.text} border ${sc.border}`}>
                    <Icon className="w-3 h-3" />
                    {t(STATUS_I18N_KEYS[order.status] || `admin.orders.status.${order.status}`, getOrderStatusLabel(order.status))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {order.buyer?.first_name} {order.buyer?.last_name}
                  </span>
                  <span className="font-bold text-gray-900">{formatPrice(order.total)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(order.created_at).toLocaleDateString(locale, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <button
                  onClick={() => onViewOrder(order.id)}
                  className="w-full mt-3 py-2.5 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors min-h-[44px]"
                >
                  {t('vendor.dashboard.recentOrders.viewDetails', 'View Details')}
                </button>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}