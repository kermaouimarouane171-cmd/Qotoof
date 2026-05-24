import { Card } from '@/components/ui'
import {
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  UserIcon,
  MapPinIcon,
  PhoneIcon,
  CubeIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'

export default function PendingOrdersPanel({
  pendingOrders,
  processingAction,
  getTimeRemaining,
  onAcceptOrder,
  onRejectOrder,
  onViewOrder,
  formatPrice,
  t,
}) {
  if (!pendingOrders?.length) return null

  return (
    <Card className="p-4 sm:p-6 mb-6 sm:mb-8 border-2 border-green-100">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <ClockIcon className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              {t('vendor.dashboard.quickActions.title', 'Quick Order Actions')}
            </h3>
            <p className="text-xs text-gray-500">
              {t('vendor.dashboard.quickActions.subtitle', '{{count}} orders awaiting your response', {
                count: pendingOrders.length,
              })}
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
          {pendingOrders.length}
        </span>
      </div>

      <div className="space-y-4">
        {pendingOrders.map((order) => {
          const timeRemaining = getTimeRemaining(order.created_at)
          return (
            <div
              key={order.id}
              className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-green-200 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-green-600 text-sm">
                    {order.order_number || order.id?.slice(0, 8)}
                  </span>
                  {timeRemaining.expired ? (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      {t('vendor.dashboard.quickActions.expired', 'Expired')}
                    </span>
                  ) : timeRemaining.urgent ? (
                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full animate-pulse">
                      {timeRemaining.text} {t('vendor.dashboard.quickActions.left', 'left')}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      {timeRemaining.text} {t('vendor.dashboard.quickActions.left', 'left')}
                    </span>
                  )}
                </div>
                <span className="font-bold text-gray-900">{formatPrice(order.total)}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3 text-xs text-gray-600">
                <div className="flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="font-medium">
                    {order.buyer?.first_name} {order.buyer?.last_name}
                  </span>
                </div>
                {order.shipping_city && (
                  <div className="flex items-center gap-1.5">
                    <MapPinIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span>{order.shipping_city}</span>
                  </div>
                )}
                {order.buyer?.phone && (
                  <a
                    href={`tel:${order.buyer.phone}`}
                    className="flex items-center gap-1.5 text-green-600 hover:underline"
                  >
                    <PhoneIcon className="w-3.5 h-3.5" />
                    {order.buyer.phone}
                  </a>
                )}
              </div>

              {order.items && order.items.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                  {order.items.slice(0, 4).map((item) => {
                    const productImage = item.product?.image_url
                    const productName = item.product?.name || 'Product'
                    return (
                      <div key={item.id} className="flex-shrink-0 w-14 text-center">
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 mb-1">
                          {productImage ? (
                            <img
                              src={productImage}
                              alt={productName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <CubeIcon className="w-4 h-4 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate" title={productName}>
                          {productName}
                        </p>
                        <p className="text-xs text-gray-400">×{item.quantity}</p>
                      </div>
                    )
                  })}
                  {order.items.length > 4 && (
                    <div className="flex-shrink-0 w-14 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-500">
                          +{order.items.length - 4}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => onAcceptOrder(order.id)}
                  disabled={processingAction === order.id || timeRemaining.expired}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-semibold text-sm rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[48px] shadow-sm shadow-green-200"
                >
                  <CheckIcon className="w-5 h-5" />
                  {t('vendor.dashboard.quickActions.accept', 'Accept')}
                </button>
                <button
                  onClick={() => onRejectOrder(order.id)}
                  disabled={processingAction === order.id || timeRemaining.expired}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white font-semibold text-sm rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[48px] shadow-sm shadow-red-200"
                >
                  <XMarkIcon className="w-5 h-5" />
                  {t('vendor.dashboard.quickActions.reject', 'Reject')}
                </button>
                <button
                  onClick={() => onViewOrder(order.id)}
                  className="px-4 py-3 bg-white border border-gray-200 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-50 transition-colors min-h-[48px] min-w-[48px] flex items-center justify-center"
                  aria-label="View details"
                >
                  <EyeIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}