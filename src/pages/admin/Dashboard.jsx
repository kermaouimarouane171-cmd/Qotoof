import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Card, LoadingSpinner } from '@/components/ui'
import { formatPrice } from '@/utils/currency'
import {
  UserGroupIcon,
  BuildingStorefrontIcon,
  CubeIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckIcon,
  XMarkIcon,
  BoltIcon,
  ArrowTrendingUpIcon,
  CursorArrowRaysIcon,
} from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'

const AdminDashboard = () => {
  const { t } = useTranslation()
  const { _profile } = useAuthStore()
  const channelRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVendors: 0,
    totalProducts: 0,
    totalRevenue: 0,
    activeUsers: 0,
    ordersPerMinute: 0,
  })
  const [pendingVendors, setPendingVendors] = useState([])
  const [recentOrders, setRecentOrders] = useState([])

  useEffect(() => {
    loadDashboard()

    // Set up real-time subscriptions
    setupRealtimeSubscriptions()

    // Cleanup on unmount
    return () => {
      cleanupRealtimeSubscriptions()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // NOTE: Role protection is handled by <ProtectedRoute allowedRoles={['admin']}> in App.jsx.
  // A redundant post-mount useEffect check here was removed because:
  // 1. It caused a brief render of admin UI before redirect (info leak)
  // 2. It used window.location.href which breaks React Router state
  // 3. ProtectedRoute already redirects non-admins before this component mounts

  const loadDashboard = async () => {
    try {
      // ✅ FIX 1: Parallel data fetching using Promise.all
      const [
        usersResult,
        vendorsResult,
        productsResult,
        ordersResult,
        recentOrdersResult,
        activeUsersResult,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'vendor'),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('total'),
        supabase
          .from('orders')
          .select('order_number, total, status, created_at, buyer_id')
          .order('created_at', { ascending: false })
          .limit(5),
        // Count users active in the last 5 minutes
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('last_sign_in_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()),
      ])

      const totalRevenue = ordersResult.data?.reduce((sum, o) => sum + (o.total || 0), 0) || 0

      // Calculate orders per minute (last 10 minutes average)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { count: recentOrdersCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', tenMinutesAgo)

      const ordersPerMinute = recentOrdersCount ? (recentOrdersCount / 10).toFixed(1) : 0

      // Fetch pending vendor approvals
      const { data: pendingData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, city, store_name, created_at')
        .eq('role', 'vendor')
        .eq('is_verified', false)
        .order('created_at', { ascending: false })
        .limit(10)

      setStats({
        totalUsers: usersResult.count || 0,
        totalVendors: vendorsResult.count || 0,
        totalProducts: productsResult.count || 0,
        totalRevenue,
        activeUsers: activeUsersResult.count || 0,
        ordersPerMinute: parseFloat(ordersPerMinute),
      })
      setPendingVendors(pendingData || [])
      setRecentOrders(recentOrdersResult.data || [])
    } catch (error) {
      logger.error('Error loading admin dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  // ✅ FIX 3: Real-time subscriptions for live metrics
  const setupRealtimeSubscriptions = () => {
    // Subscribe to orders table changes (for ordersPerMinute updates)
    const ordersChannel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        () => {
          // Recalculate orders per minute on new order
          recalculateOrdersPerMinute()
        }
      )
      .subscribe()

    channelRef.current = ordersChannel
  }

  const recalculateOrdersPerMinute = async () => {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', tenMinutesAgo)

      const opm = count ? (count / 10).toFixed(1) : 0
      setStats(prev => ({ ...prev, ordersPerMinute: parseFloat(opm) }))
    } catch (error) {
      logger.error('Error recalculating orders per minute:', error)
    }
  }

  const cleanupRealtimeSubscriptions = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }
  }

  const handleApproveVendor = async (vendorId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_verified: true })
        .eq('id', vendorId)

      if (error) throw error

      toast.success('تمت الموافقة على البائع بنجاح')
      
      // Remove from pending list
      setPendingVendors(prev => prev.filter(v => v.id !== vendorId))
      
      // Reload stats
      await loadDashboard()
    } catch (error) {
      logger.error('Error approving vendor:', error)
      toast.error('حدث خطأ أثناء الموافقة')
    }
  }

  const handleRejectVendor = async (vendorId) => {
    try {
      // Soft-delete the vendor's products to prevent orphaned records
      // (products with a vendor_id pointing to a buyer would break listings)
      const { error: productsError } = await supabase
        .from('products')
        .update({ is_available: false, deleted_at: new Date().toISOString() })
        .eq('vendor_id', vendorId)

      if (productsError) {
        logger.error('Error deactivating vendor products:', productsError)
        // Non-fatal: continue with role downgrade even if product update fails
      }

      // Downgrade role from vendor back to buyer
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'buyer', is_verified: false, store_name: null })
        .eq('id', vendorId)

      if (error) throw error

      toast.success('تم رفض طلب البائع وتعطيل منتجاته')

      // Remove from pending list
      setPendingVendors(prev => prev.filter(v => v.id !== vendorId))

      // Reload stats
      await loadDashboard()
    } catch (error) {
      logger.error('Error rejecting vendor:', error)
      toast.error('حدث خطأ أثناء الرفض')
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" />
  }

  const statsCards = [
    { title: t('admin.dashboard.totalUsers'), value: stats.totalUsers.toLocaleString(), icon: UserGroupIcon, color: 'bg-blue-100 text-blue-600' },
    { title: t('admin.dashboard.totalVendors'), value: stats.totalVendors.toLocaleString(), icon: BuildingStorefrontIcon, color: 'bg-green-100 text-green-600' },
    { title: t('admin.dashboard.totalProducts'), value: stats.totalProducts.toLocaleString(), icon: CubeIcon, color: 'bg-purple-100 text-purple-600' },
    { title: t('admin.dashboard.totalRevenue'), value: formatPrice(stats.totalRevenue), icon: CurrencyDollarIcon, color: 'bg-yellow-100 text-yellow-600' },
    { title: 'Active Users (5m)', value: stats.activeUsers.toLocaleString(), icon: CursorArrowRaysIcon, color: 'bg-cyan-100 text-cyan-600' },
    { title: 'Orders/Min', value: stats.ordersPerMinute, icon: BoltIcon, color: 'bg-orange-100 text-orange-600' },
  ]
  
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('admin.dashboard.title')}</h1>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        {statsCards.map((stat, index) => (
          <Card key={index} className="p-6">
            <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-1">{stat.title}</p>
          </Card>
        ))}
      </div>

      {/* Pending Vendor Approvals */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <ClockIcon className="w-5 h-5 text-yellow-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {t('admin.dashboard.pendingApprovals')} ({pendingVendors.length})
          </h3>
        </div>

        {pendingVendors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No pending vendor approvals</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Store Name</th>
                  <th>Email</th>
                  <th>Location</th>
                  <th>Applied Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingVendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td className="font-medium">{vendor.store_name || `${vendor.first_name} ${vendor.last_name}`}</td>
                    <td>{vendor.email}</td>
                    <td>{vendor.city || 'N/A'}</td>
                    <td className="text-gray-500">{new Date(vendor.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveVendor(vendor.id)}
                          className="btn-sm btn-primary flex items-center gap-1"
                        >
                          <CheckIcon className="w-4 h-4" />
                          موافقة
                        </button>
                        <button
                          onClick={() => handleRejectVendor(vendor.id)}
                          className="btn-sm btn-outline flex items-center gap-1"
                        >
                          <XMarkIcon className="w-4 h-4" />
                          رفض
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent Orders (Real-Time) */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <ArrowTrendingUpIcon className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Recent Orders (Live)
          </h3>
          <span className="ml-auto flex items-center gap-1 text-sm text-green-600">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live
          </span>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No orders yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id || order.order_number}>
                    <td className="font-medium">{order.order_number}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="font-bold text-green-600">{formatPrice(order.total)}</td>
                    <td className="text-gray-500">{new Date(order.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

export default AdminDashboard
