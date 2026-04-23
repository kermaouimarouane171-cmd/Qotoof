import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { Card, LoadingSpinner, ProductCard } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import { supabase } from '@/services/supabase'
import { realtimeService } from '@/services/realtime'
import { deliveriesApi } from '@/services/deliveries'
import { formatPrice } from '@/utils/currency'
import {
  ShoppingBagIcon,
  ClockIcon,
  TruckIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  HeartIcon,
  MapPinIcon,
  Cog6ToothIcon,
  SparklesIcon,
  FireIcon,
  BuildingStorefrontIcon,
  BoltIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  TagIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'

// ============================================
// Quick Action Item
// ============================================

const QUICK_ACTIONS = [
  { id: 'orders', label: 'Orders', icon: ShoppingBagIcon, path: '/buyer/orders', color: 'bg-green-100 text-green-600 hover:bg-green-200' },
  { id: 'favorites', label: 'Favorites', icon: HeartIcon, path: '/favorites', color: 'bg-red-100 text-red-600 hover:bg-red-200' },
  { id: 'addresses', label: 'Addresses', icon: MapPinIcon, path: '/buyer/addresses', color: 'bg-blue-100 text-blue-600 hover:bg-blue-200' },
  { id: 'reorder', label: 'Re-order', icon: ArrowPathIcon, path: null, color: 'bg-amber-100 text-amber-600 hover:bg-amber-200' },
  { id: 'settings', label: 'Settings', icon: Cog6ToothIcon, path: '/buyer/settings', color: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
]

// ============================================
// Stat Card Component
// ============================================

const StatCard = ({ icon: Icon, value, label, color, onClick }) => (
  <Card
    className={`p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer ${onClick ? '' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  </Card>
)

// ============================================
// Product Skeleton
// ============================================

const ProductSkeleton = () => (
  <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
    <div className="aspect-[4/3] bg-gray-200" />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="h-6 bg-gray-200 rounded w-1/3" />
    </div>
  </div>
)

// ============================================
// Main Buyer Dashboard
// ============================================

const BuyerDashboard = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const { addItem } = useCartStore()

  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    activeDeliveries: 0,
    totalSpent: 0,
  })
  const [recentOrders, setRecentOrders] = useState([])
  const [activeDelivery, setActiveDelivery] = useState(null)
  const [recommendedProducts, setRecommendedProducts] = useState([])
  const [seasonalProducts, setSeasonalProducts] = useState([])
  const [favoriteStores, setFavoriteStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)

  const loadRecommendations = useCallback(async () => {
    setProductsLoading(true)
    try {
      // ✅ STEP 1: Get past orders (needed for recommendations logic)
      const { data: pastOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('status', 'delivered')
        .limit(10)

      // ✅ STEP 2: Get past items (depends on pastOrders)
      let vendorIds = []
      if (pastOrders && pastOrders.length > 0) {
        const { data: pastItems } = await supabase
          .from('order_items')
          .select('product_id, product:products(vendor_id, category)')
          .in('order_id', pastOrders.map(o => o.id))
          .limit(20)

        if (pastItems && pastItems.length > 0) {
          vendorIds = [...new Set(pastItems.map(i => i.product?.vendor_id).filter(Boolean))].slice(0, 5)
        }
      }

      // ✅ STEP 3: Run independent queries in parallel with Promise.allSettled
      const buildProductsQuery = () => {
        let query = supabase
          .from('products')
          .select(`
            *,
            vendor:profiles!products_vendor_id_fkey(first_name, last_name, city, store_name, is_verified),
            images:product_images(url, is_primary)
          `)
          .eq('is_available', true)

        if (vendorIds.length > 0) {
          query = query.in('vendor_id', vendorIds)
        }

        return query.order('created_at', { ascending: false }).limit(6)
      }

      const [recommendedResult, seasonalResult, storesResult] = await Promise.allSettled([
        // Recommended products
        buildProductsQuery(),

        // Seasonal products (currently popular)
        supabase
          .from('products')
          .select(`
            *,
            vendor:profiles!products_vendor_id_fkey(first_name, last_name, city, store_name, is_verified),
            images:product_images(url, is_primary)
          `)
          .eq('is_available', true)
          .order('created_at', { ascending: false })
          .limit(4),

        // Favorite/recently visited stores
        supabase
          .from('profiles')
          .select('id, first_name, last_name, store_name, store_logo, city, description, is_verified')
          .eq('role', 'vendor')
          .order('created_at', { ascending: false })
          .limit(4),
      ])

      // Handle results
      if (recommendedResult.status === 'fulfilled' && !recommendedResult.value.error) {
        setRecommendedProducts(recommendedResult.value.data || [])
      }

      if (seasonalResult.status === 'fulfilled' && !seasonalResult.value.error) {
        setSeasonalProducts(seasonalResult.value.data || [])
      }

      if (storesResult.status === 'fulfilled' && !storesResult.value.error) {
        setFavoriteStores(storesResult.value.data || [])
      }
    } catch (error) {
      logger.error('Error loading recommendations:', error)
    } finally {
      setProductsLoading(false)
    }
  }, [user.id])

  const loadDashboard = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // ✅ PERFORMANCE: Run all independent queries in parallel with Promise.allSettled
      const [
        recentResult,
        statsResult,
        deliveryResult,
      ] = await Promise.allSettled([
        // 1️⃣ Recent orders (limited to 5)
        supabase
          .from('orders')
          .select(`
            *,
            vendor:profiles!orders_vendor_id_fkey(store_name, first_name, last_name),
            items:order_items(count)
          `)
          .eq('buyer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),

        // 2️⃣ All orders for stats calculation
        supabase
          .from('orders')
          .select('status, total, delivered_at')
          .eq('buyer_id', user.id),

        // 3️⃣ Active delivery
        deliveriesApi.getBuyerActiveDelivery(user.id),
      ])

      // Handle recent orders
      if (recentResult.status === 'fulfilled' && !recentResult.value.error) {
        setRecentOrders(recentResult.value.data || [])
      } else {
        logger.error('Error loading recent orders:', recentResult.reason || recentResult.value?.error)
        setRecentOrders([])
      }

      // Handle stats
      if (statsResult.status === 'fulfilled' && statsResult.value.data) {
        const allOrders = statsResult.value.data
        setStats({
          totalOrders: allOrders.length,
          pendingOrders: allOrders.filter(o => o.status === 'pending').length,
          activeDeliveries: allOrders.filter(o =>
            ['vendor_accepted', 'driver_assigned', 'driver_accepted', 'driver_picked_up', 'on_the_way'].includes(o.status)
          ).length,
          totalSpent: allOrders.reduce((sum, o) => sum + (o.total || 0), 0),
        })
      }

      // Handle active delivery
      if (deliveryResult.status === 'fulfilled') {
        setActiveDelivery(deliveryResult.value)
      } else {
        setActiveDelivery(null)
      }

      // ✅ Load recommendations in parallel (doesn't depend on above)
      loadRecommendations()
    } catch (error) {
      logger.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [loadRecommendations, user])

  // ============================================
  // Load Dashboard Data
  // ============================================

  useEffect(() => {
    loadDashboard()

    if (user) {
      realtimeService.initialize()
    }
  }, [loadDashboard, user])

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return

    const unsubscribe = realtimeService.subscribeToOrders(
      user.id,
      async (payload) => {
        logger.info('Realtime order update for buyer:', payload)
        await loadDashboard()
      }
    )

    return () => unsubscribe()
  }, [loadDashboard, user?.id])

  // ============================================
  // Actions
  // ============================================

  const handleQuickAction = useCallback((action) => {
    if (action.id === 'reorder') {
      // Navigate to orders page for re-ordering
      navigate('/buyer/orders')
      return
    }
    if (action.path) {
      navigate(action.path)
    }
  }, [navigate])

  const handleAddToCart = useCallback((product) => {
    addItem(product, product.min_order_quantity || 1)
  }, [addItem])

  // ============================================
  // Derived State
  // ============================================

  const activeOrderMessage = useMemo(() => {
    if (!activeDelivery) {
      // Check if there's a pending order
      const pending = recentOrders.find(o => o.status === 'pending')
      if (pending) return { order: pending, text: t('buyerDashboard.orderStatus.pending', 'Pending') + `: Order #${pending.order_number?.slice(-6) || pending.id.slice(0, 6)}` }

      const accepted = recentOrders.find(o => o.status === 'vendor_accepted')
      if (accepted) return { order: accepted, text: t('buyerDashboard.orderStatus.vendor_accepted', 'Accepted') + `: Order #${accepted.order_number?.slice(-6) || accepted.id.slice(0, 6)}` }

      return null
    }

    const statusTexts = {
      accepted: t('buyerDashboard.orderStatus.accepted', 'Driver accepted your order — preparing for pickup'),
      picked_up: t('buyerDashboard.orderStatus.picked_up', 'Driver picked up your order — getting ready to deliver'),
      on_the_way: t('buyerDashboard.orderStatus.on_the_way', 'Your order is on the way — expected delivery soon'),
    }

    return {
      order: activeDelivery.order,
      text: statusTexts[activeDelivery.status] || t('buyerDashboard.orderStatus.default', 'Your order is being processed'),
    }
  }, [activeDelivery, recentOrders, t])

  // ============================================
  // Loading State
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className="space-y-8">
      {/* ===== Welcome Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {t('buyerDashboard.welcome', 'Welcome back, {{name}}! 👋', { name: profile?.first_name || 'Buyer' })}
          </h1>
          <p className="text-gray-500 mt-1">{t('buyerDashboard.accountOverview', "Here's an overview of your account")}</p>
        </div>
        <button
          onClick={() => navigate('/marketplace')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 self-start"
        >
          <SparklesIcon className="w-4 h-4" />
          {t('buyerDashboard.startShopping', 'Start Shopping')}
        </button>
      </div>

      {/* ===== Quick Actions Bar ===== */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {QUICK_ACTIONS.map(action => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action)}
              className={`flex flex-col items-center gap-1.5 min-w-[72px] px-3 py-3 rounded-xl transition-all duration-200 ${action.color} hover:scale-105 active:scale-95`}
              aria-label={t(`buyerDashboard.actions.${action.id}`, action.label)}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium whitespace-nowrap">{t(`buyerDashboard.actions.${action.id}`, action.label)}</span>
            </button>
          )
        })}
      </div>

      {/* ===== Active Order Alert ===== */}
      {activeOrderMessage && (
        <Card
          className="p-4 border-2 border-green-200 bg-green-50/50 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate(`/orders/${activeOrderMessage.order.id}`)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <TruckIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                Order #{activeOrderMessage.order.order_number?.slice(-6) || activeOrderMessage.order.id.slice(0, 6)}
              </p>
              <p className="text-xs text-gray-600">{activeOrderMessage.text}</p>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
          </div>
        </Card>
      )}

      {/* ===== Stats Grid ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ShoppingBagIcon}
          value={stats.totalOrders}
          label={t('buyerDashboard.stats.totalOrders', 'Total Orders')}
          color="bg-blue-100 text-blue-600"
          onClick={() => navigate('/buyer/orders')}
        />
        <StatCard
          icon={ClockIcon}
          value={stats.pendingOrders}
          label={t('buyerDashboard.stats.pending', 'Pending')}
          color="bg-amber-100 text-amber-600"
          onClick={() => navigate('/buyer/orders?filter=active')}
        />
        <StatCard
          icon={TruckIcon}
          value={stats.activeDeliveries}
          label={t('buyerDashboard.stats.inTransit', 'In Transit')}
          color="bg-orange-100 text-orange-600"
          onClick={() => navigate('/buyer/orders?filter=active')}
        />
        <StatCard
          icon={CurrencyDollarIcon}
          value={formatPrice(stats.totalSpent)}
          label={t('buyerDashboard.stats.totalSpent', 'Total Spent')}
          color="bg-emerald-100 text-emerald-600"
          onClick={() => navigate('/buyer/orders?filter=delivered')}
        />
      </div>

      {/* ===== Recent Orders ===== */}
      <Card>
        <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-lg">{t('buyerDashboard.recentOrders.title', 'Recent Orders')}</h2>
          <button
            onClick={() => navigate('/buyer/orders')}
            className="text-sm text-green-600 hover:underline font-medium inline-flex items-center gap-1"
          >
            {t('buyerDashboard.recentOrders.viewAll', 'View All')}
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>

        {recentOrders.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {recentOrders.map((order) => {
              const statusConfig = getStatusConfig(order.status)
              const StatusIcon = statusConfig.icon

              return (
                <button
                  type="button"
                  key={order.id}
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${statusConfig.bg} ${statusConfig.text}`}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">
                        Order #{order.order_number?.slice(-6) || order.id.slice(0, 6)}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {order.vendor?.store_name || `${order.vendor?.first_name || ''} ${order.vendor?.last_name || ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="font-semibold text-sm text-gray-900">{formatPrice(order.total)}</p>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                      {statusConfig.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBagIcon className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('buyerDashboard.recentOrders.emptyTitle', 'No orders yet')}
            </h3>
            <p className="text-gray-500 mb-6">
              {t('buyerDashboard.recentOrders.emptyDesc', 'Browse the marketplace to place your first order')}
            </p>
            <button
              onClick={() => navigate('/marketplace')}
              className="btn-primary inline-flex items-center gap-2"
            >
              <ShoppingBagIcon className="w-5 h-5" />
              {t('buyerDashboard.startShopping', 'Start Shopping')}
            </button>
          </div>
        )}
      </Card>

      {/* ===== Recommendations Section ===== */}
      {!productsLoading && (recommendedProducts.length > 0 || seasonalProducts.length > 0 || favoriteStores.length > 0) && (
        <>
          {/* Recommended Products */}
          {recommendedProducts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-green-600" />
                  {t('buyerDashboard.recommendations.title', 'Recommended for You')}
                </h2>
                <button
                  onClick={() => navigate('/marketplace')}
                  className="text-sm text-green-600 hover:underline font-medium"
                >
                  {t('buyerDashboard.seeAll', 'See All')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendedProducts.slice(0, 3).map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}

          {/* Seasonal Offers */}
          {seasonalProducts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FireIcon className="w-5 h-5 text-orange-500" />
                  {t('buyerDashboard.seasonal.title', 'Seasonal Offers')}
                </h2>
                <button
                  onClick={() => navigate('/marketplace')}
                  className="text-sm text-green-600 hover:underline font-medium"
                >
                  {t('buyerDashboard.seeAll', 'See All')}
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {seasonalProducts.map(product => (
                  <SeasonalProductCard
                    key={product.id}
                    product={product}
                    onAdd={() => handleAddToCart(product)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Favorite Stores */}
          {favoriteStores.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <BuildingStorefrontIcon className="w-5 h-5 text-blue-600" />
                  {t('buyerDashboard.stores.title', 'Popular Stores')}
                </h2>
                <button
                  onClick={() => navigate('/stores')}
                  className="text-sm text-green-600 hover:underline font-medium"
                >
                  {t('buyerDashboard.seeAll', 'See All')}
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {favoriteStores.map(store => (
                  <StoreCard
                    key={store.id}
                    store={store}
                    onClick={() => navigate(`/stores/${store.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading skeletons for recommendations */}
      {productsLoading && (
        <div>
          <div className="h-7 bg-gray-200 rounded w-48 mb-4 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <ProductSkeleton key={i} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// Wrap with Error Boundary
const BuyerDashboardWithErrorBoundary = () => (
  <ErrorBoundary componentName="BuyerDashboard">
    <BuyerDashboard />
  </ErrorBoundary>
)

export default BuyerDashboardWithErrorBoundary

// ============================================
// Status Config Helper
// ============================================

const getStatusConfig = (status) => {
  const configs = {
    pending:            { label: 'Pending',       icon: ClockIcon,          bg: 'bg-amber-100', text: 'text-amber-700',    dot: 'bg-amber-500' },
    vendor_accepted:    { label: 'Accepted',      icon: CheckCircleIcon,    bg: 'bg-green-100', text: 'text-green-700',    dot: 'bg-green-500' },
    vendor_rejected:    { label: 'Rejected',      icon: ExclamationTriangleIcon, bg: 'bg-red-100', text: 'text-red-700',    dot: 'bg-red-500' },
    driver_assigned:    { label: 'Driver Assigned', icon: TruckIcon,        bg: 'bg-orange-100', text: 'text-orange-700',  dot: 'bg-orange-500' },
    driver_accepted:    { label: 'Driver Accepted', icon: CheckCircleIcon,  bg: 'bg-orange-100', text: 'text-orange-700',  dot: 'bg-orange-500' },
    driver_picked_up:   { label: 'Picked Up',     icon: ShoppingBagIcon,    bg: 'bg-orange-100', text: 'text-orange-700',  dot: 'bg-orange-500' },
    on_the_way:         { label: 'On the Way',    icon: TruckIcon,          bg: 'bg-blue-100',  text: 'text-blue-700',     dot: 'bg-blue-500 animate-pulse' },
    delivered:          { label: 'Delivered',     icon: CheckCircleIcon,    bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    cancelled:          { label: 'Cancelled',     icon: ExclamationTriangleIcon, bg: 'bg-red-100', text: 'text-red-700',    dot: 'bg-red-500' },
  }
  return configs[status] || { label: status, icon: ClockIcon, bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' }
}

// ============================================
// Seasonal Product Card
// ============================================

const SeasonalProductCard = ({ product, onAdd }) => {
  const primaryImage = product.images?.find(img => img.is_primary) || product.images?.[0]

  return (
    <Card className="group overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🌱</div>
        )}
        {/* Seasonal Badge */}
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white rounded-md text-[10px] font-bold uppercase tracking-wide">
            <TagIcon className="w-3 h-3" />
            Seasonal
          </span>
        </div>
        {/* Quick Add */}
        {product.is_available && (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd() }}
            className="absolute bottom-2 right-2 w-8 h-8 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
            aria-label={`Add ${product.name} to cart`}
          >
            <BoltIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm text-gray-900 line-clamp-1 group-hover:text-green-600 transition-colors">
          {product.name}
        </h3>
        <div className="flex items-center justify-between mt-2">
          <span className="text-base font-bold text-gray-900">{formatPrice(product.price_per_unit)}</span>
          <span className="text-xs text-gray-400">/{product.unit_type}</span>
        </div>
      </div>
    </Card>
  )
}

// ============================================
// Store Card
// ============================================

const StoreCard = ({ store, onClick }) => {
  const displayName = store.store_name || `${store.first_name || ''} ${store.last_name || ''}`

  return (
    <Card
      className="group cursor-pointer border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 overflow-hidden"
      onClick={onClick}
    >
      {/* Store Image / Placeholder */}
      <div className="aspect-video bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center relative overflow-hidden">
        {store.store_logo ? (
          <img
            src={store.store_logo}
            alt={displayName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <span className="text-3xl font-bold text-green-300">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
        {/* Verified Badge */}
        {store.is_verified && (
          <div className="absolute top-2 right-2">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircleIcon className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        )}
      </div>
      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-gray-900 truncate group-hover:text-green-600 transition-colors">
          {displayName}
        </h3>
        {store.city && (
          <div className="flex items-center gap-1 mt-1">
            <MapPinIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 truncate">{store.city}</span>
          </div>
        )}
        <div className="flex items-center gap-1 mt-2 text-green-600 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          <EyeIcon className="w-3 h-3" />
          Visit Store
        </div>
      </div>
    </Card>
  )
}
