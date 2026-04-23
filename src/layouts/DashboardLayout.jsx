import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useDarkMode } from '@/hooks/useDarkMode'
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  ShoppingBagIcon,
  ChartBarSquareIcon,
  CubeIcon,
  UserGroupIcon,
  ArrowLeftOnRectangleIcon,
  BellIcon,
  Cog6ToothIcon,
  TruckIcon,
  UserIcon,
  StarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  SunIcon,
  MoonIcon,
  TagIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'

const DashboardLayout = () => {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [notificationBadge, setNotificationBadge] = useState(0)
  const { isDark, toggle: toggleDark } = useDarkMode()

  const { profile, signOut } = useAuthStore()

  // Listen for notification badge updates from Notifications page
  useEffect(() => {
    const handleBadgeUpdate = (e) => {
      setNotificationBadge(e.detail.unreadCount)
    }

    window.addEventListener('notification-badge-update', handleBadgeUpdate)
    return () => window.removeEventListener('notification-badge-update', handleBadgeUpdate)
  }, [])
  
  const isAdmin = profile?.role === 'admin'
  const isVendor = profile?.role === 'vendor'
  const isDriver = profile?.role === 'driver'
  
  // 6 items: Dashboard | Products | Orders | Analytics | Coupons | Profile
  // Reviews → tab inside Orders   |   Location/Hours/Security/Preferences → tabs inside Profile
  const vendorNavItems = [
    { to: '/vendor/dashboard', label: 'Dashboard', icon: HomeIcon },
    { to: '/vendor/products', label: 'Products', icon: CubeIcon },
    { to: '/vendor/orders', label: 'Orders', icon: ShoppingBagIcon },
    { to: '/vendor/analytics', label: 'Analytics', icon: ChartBarSquareIcon },
    { to: '/vendor/coupons', label: 'Coupons', icon: TagIcon },
    { to: '/vendor/profile', label: 'Profile', icon: UserIcon },
  ]

  // 6 items: Dashboard | Available | Active | History | Earnings | Profile
  // Settings/Security/Pricing → tabs inside Profile (Pricing already redirected in Phase 2)
  const driverNavItems = [
    { to: '/driver/dashboard', label: 'Dashboard', icon: HomeIcon },
    { to: '/driver/available', label: 'Available', icon: TruckIcon },
    { to: '/driver/active', label: 'Active', icon: ClockIcon },
    { to: '/driver/history', label: 'History', icon: ClipboardDocumentListIcon },
    { to: '/driver/earnings', label: 'Earnings', icon: CurrencyDollarIcon },
    { to: '/driver/profile', label: 'Profile', icon: UserIcon },
  ]

  // 10 items: Dashboard | Users | Products | Orders | Reviews | Payouts | Analytics | Drivers | Security | Settings
  // Vendors → /admin/users?role=vendor   |   Commissions → Payouts tab   |   Moderation → Reviews tab
  const adminNavItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: HomeIcon },
    { to: '/admin/users', label: 'Users', icon: UserGroupIcon },
    { to: '/admin/products', label: 'Products', icon: CubeIcon },
    { to: '/admin/orders', label: 'Orders', icon: ShoppingBagIcon },
    { to: '/admin/reviews', label: 'Reviews', icon: StarIcon },
    { to: '/admin/finance/payouts', label: 'Payouts', icon: BanknotesIcon },
    { to: '/admin/analytics', label: 'Analytics', icon: ChartBarSquareIcon },
    { to: '/admin/drivers', label: 'Drivers', icon: TruckIcon },
    { to: '/admin/security', label: 'Security', icon: ShieldCheckIcon },
    { to: '/admin/settings', label: 'Settings', icon: Cog6ToothIcon },
  ]

  // 6 items: Dashboard | Orders | Addresses | Shopping Lists | Loyalty | Settings
  // Security → tab inside Settings
  const buyerNavItems = [
    { to: '/buyer/dashboard', label: 'Dashboard', icon: HomeIcon },
    { to: '/buyer/orders', label: 'Orders', icon: ShoppingBagIcon },
    { to: '/buyer/addresses', label: 'Addresses', icon: MapPinIcon },
    { to: '/buyer/shopping-lists', label: 'Shopping Lists', icon: ClipboardDocumentListIcon },
    { to: '/buyer/loyalty', label: 'Loyalty', icon: StarIcon },
    { to: '/buyer/settings', label: 'Settings', icon: Cog6ToothIcon },
  ]
  
  const navItems = isAdmin ? adminNavItems : isDriver ? driverNavItems : isVendor ? vendorNavItems : buyerNavItems
  
  const isActive = (path) => location.pathname === path
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white dark:bg-gray-900 border-r rtl:border-r-0 rtl:border-l border-gray-100 dark:border-gray-800 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 dark:border-gray-800">
          {sidebarOpen && (
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <span className="text-white font-bold text-lg">Q</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Qotoof</span>
            </Link>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <Bars3Icon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center rtl:flex-row-reverse gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(item.to)
                  ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-300'
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive(item.to) ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>
        
        {/* Bottom Actions */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
          <Link
            to={isAdmin ? '/admin/settings' : isDriver ? '/driver/profile' : isVendor ? '/vendor/profile' : '/buyer/settings'}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
              !sidebarOpen && 'justify-center'
            }`}
          >
            <Cog6ToothIcon className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>{isAdmin ? 'Settings' : 'Preferences'}</span>}
          </Link>
          <button
            onClick={signOut}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors ${
              !sidebarOpen && 'justify-center'
            }`}
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
      
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 bg-black/50 dark:bg-gray-900 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-gray-900 z-50 shadow-xl">
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 dark:border-gray-800">
              <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileSidebarOpen(false)}>
                <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">Q</span>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Qotoof</span>
              </Link>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <nav className="py-4 px-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive(item.to)
                      ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <Bars3Icon className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 ml-auto">
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDark}
                className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                aria-label="Toggle dark mode"
              >
                {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              </button>

              {/* Notifications */}
              <Link to="/notifications" className="relative p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
                <BellIcon className="w-5 h-5" />
                {notificationBadge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {notificationBadge > 99 ? '99+' : notificationBadge}
                  </span>
                )}
              </Link>

              {/* User */}
              <div className="flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-gray-700">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                  <span className="text-white text-xs font-bold">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-300">
                    {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{profile?.role}</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
