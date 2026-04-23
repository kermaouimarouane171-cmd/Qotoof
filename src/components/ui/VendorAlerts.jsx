import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import {
  ExclamationTriangleIcon,
  ClockIcon,
  CubeIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'

const VendorAlerts = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadAlerts()
  }, [user])

  const loadAlerts = async () => {
    if (!user) return
    setLoading(true)
    const newAlerts = []

    try {
      // Check low stock products
      const { data: lowStock } = await supabase
        .from('products')
        .select('id, name, available_quantity, unit_type')
        .eq('vendor_id', user.id)
        .eq('is_available', true)
        .lte('available_quantity', 10)
        .order('available_quantity', { ascending: true })
        .limit(5)

      if (lowStock && lowStock.length > 0) {
        newAlerts.push({
          type: 'warning',
          icon: CubeIcon,
          title: `Low Stock Alert (${lowStock.length} products)`,
          message: `The following products have low stock: ${lowStock.map(p => p.name).join(', ')}`,
          action: { label: 'Manage Stock', onClick: () => navigate('/vendor/products') },
          items: lowStock,
        })
      }

      // Check pending orders (not confirmed within 24h)
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('id, created_at, status, total')
        .eq('vendor_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (pendingOrders && pendingOrders.length > 0) {
        const overdueOrders = pendingOrders.filter(o => {
          const hoursSince = (Date.now() - new Date(o.created_at).getTime()) / 3600000
          return hoursSince > 24
        })

        if (overdueOrders.length > 0) {
          newAlerts.push({
            type: 'error',
            icon: ExclamationTriangleIcon,
            title: `Overdue Orders (${overdueOrders.length})`,
            message: `${overdueOrders.length} order(s) have not been confirmed within 24 hours. Please respond immediately.`,
            action: { label: 'View Orders', onClick: () => navigate('/vendor/orders') },
          })
        }

        if (pendingOrders.length > overdueOrders.length) {
          newAlerts.push({
            type: 'info',
            icon: ClockIcon,
            title: `Pending Orders (${pendingOrders.length - overdueOrders.length})`,
            message: `You have ${pendingOrders.length - overdueOrders.length} order(s) awaiting confirmation.`,
            action: { label: 'Review Orders', onClick: () => navigate('/vendor/orders') },
          })
        }
      }

      // Check unfulfilled orders past deadline
      const { data: unfulfilled } = await supabase
        .from('orders')
        .select('id, created_at, status, total')
        .eq('vendor_id', user.id)
        .in('status', ['vendor_accepted', 'driver_assigned', 'driver_accepted'])
        .order('created_at', { ascending: true })

      if (unfulfilled && unfulfilled.length > 0) {
        const overdue = unfulfilled.filter(o => {
          const hoursSince = (Date.now() - new Date(o.created_at).getTime()) / 3600000
          return hoursSince > 48 // 48 hour fulfillment window
        })

        if (overdue.length > 0) {
          newAlerts.push({
            type: 'error',
            icon: ClockIcon,
            title: `Fulfillment Deadline Exceeded (${overdue.length} orders)`,
            message: `${overdue.length} order(s) are past the 48-hour fulfillment deadline. Please prepare them immediately.`,
            action: { label: 'View Orders', onClick: () => navigate('/vendor/orders') },
          })
        }
      }

      // Check out of stock products still listed as available
      const { data: outOfStock } = await supabase
        .from('products')
        .select('id, name')
        .eq('vendor_id', user.id)
        .eq('is_available', true)
        .eq('available_quantity', 0)

      if (outOfStock && outOfStock.length > 0) {
        newAlerts.push({
          type: 'warning',
          icon: CubeIcon,
          title: `Out of Stock (${outOfStock.length} products still listed)`,
          message: `These products are out of stock but still visible: ${outOfStock.map(p => p.name).join(', ')}`,
          action: { label: 'Update Products', onClick: () => navigate('/vendor/products') },
        })
      }

      setAlerts(newAlerts)
    } catch (error) {
      logger.error('Error loading alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return null
  if (alerts.length === 0) return null

  const typeStyles = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      titleColor: 'text-red-800',
      textColor: 'text-red-700',
      buttonBg: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-800',
      textColor: 'text-amber-700',
      buttonBg: 'bg-amber-600 hover:bg-amber-700',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-800',
      textColor: 'text-blue-700',
      buttonBg: 'bg-blue-600 hover:bg-blue-700',
    },
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => {
        const style = typeStyles[alert.type]
        const Icon = alert.icon
        return (
          <div key={i} className={`${style.bg} ${style.border} border rounded-xl p-4`}>
            <div className="flex items-start gap-3">
              <div className={`${style.iconBg} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${style.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-semibold ${style.titleColor} mb-1`}>{alert.title}</h3>
                <p className={`text-sm ${style.textColor} mb-3`}>{alert.message}</p>

                {/* Low stock items list */}
                {alert.items && (
                  <div className="space-y-1 mb-3">
                    {alert.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className={style.textColor}>{item.name}</span>
                        <span className={`font-semibold ${style.titleColor}`}>
                          {item.available_quantity} {item.unit_type} left
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={alert.action.onClick}
                  className={`inline-flex items-center gap-2 px-4 py-2 ${style.buttonBg} text-white rounded-lg text-sm font-medium transition-colors`}
                >
                  {alert.action.label}
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default VendorAlerts
