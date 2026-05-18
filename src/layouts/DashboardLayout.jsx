import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useDarkMode } from '@/hooks/useDarkMode'
import NotificationLink from '@/components/notifications/NotificationLink'
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  ShoppingBagIcon,
  ChartBarSquareIcon,
  CubeIcon,
  UserGroupIcon,
  ArrowLeftOnRectangleIcon,
  Cog6ToothIcon,
  TruckIcon,
  UserIcon,
  StarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  BoltIcon,
  SunIcon,
  MoonIcon,
  TagIcon,
  MapPinIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'

const DashboardLayout = () => {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const { isDark, toggle: toggleDark } = useDarkMode()
  const { t } = useTranslation()

  const { profile, signOut } = useAuthStore()
  
  const isAdmin = profile?.role === 'admin'
  const isVendor = profile?.role === 'vendor'
  const isDriver = profile?.role === 'driver'
  
  // 6 items: Dashboard | Products | Orders | Analytics | Coupons | Profile
  // Reviews → tab inside Orders   |   Location/Hours/Security/Preferences → tabs inside Profile
  const vendorNavItems = [
    { to: '/vendor/dashboard', label: t('layout.vendor.links.dashboard', 'Dashboard'), icon: HomeIcon },
    { to: '/vendor/products', label: t('layout.vendor.links.products', 'My Products'), icon: CubeIcon },
    { to: '/vendor/orders', label: t('layout.vendor.links.orders', 'Orders'), icon: ShoppingBagIcon },
    { to: '/vendor/analytics', label: t('layout.vendor.links.analytics', 'Analytics'), icon: ChartBarSquareIcon },
    { to: '/vendor/coupons', label: t('layout.vendor.links.coupons', 'Coupons'), icon: TagIcon },
    { to: '/vendor/subscription', label: t('layout.vendor.links.premium', 'Premium'), icon: BoltIcon },
    { to: '/vendor/rfqs', label: t('layout.vendor.links.rfqBoard', 'RFQ Board'), icon: DocumentTextIcon },
    { to: '/vendor/profile', label: t('layout.vendor.links.profile', 'Profile'), icon: UserIcon },
  ]

  // 6 items: Dashboard | Available | Active | History | Earnings | Profile
  // Settings/Security/Pricing → tabs inside Profile (Pricing already redirected in Phase 2)
  const driverNavItems = [
    { to: '/driver/dashboard', label: t('layout.driver.links.dashboard', 'Dashboard'), icon: HomeIcon },
    { to: '/driver/available', label: t('layout.driver.links.available', 'Available Orders'), icon: TruckIcon },
    { to: '/driver/active', label: t('layout.driver.links.active', 'Active Deliveries'), icon: ClockIcon },
    { to: '/driver/history', label: t('layout.driver.links.history', 'History'), icon: ClipboardDocumentListIcon },
    { to: '/driver/earnings', label: t('layout.driver.links.earnings', 'Earnings'), icon: CurrencyDollarIcon },
    { to: '/driver/profile', label: t('layout.driver.links.profile', 'Profile'), icon: UserIcon },
  ]

  // 10 items: Dashboard | Users | Products | Orders | Reviews | Payouts | Analytics | Drivers | Security | Settings
  // Vendors → /admin/users?role=vendor   |   Commissions → Payouts tab   |   Moderation → Reviews tab
  const adminNavItems = [
    { to: '/admin/dashboard', label: t('layout.admin.links.dashboard', 'Dashboard'), icon: HomeIcon },
    { to: '/admin/users', label: t('layout.admin.links.users', 'Users'), icon: UserGroupIcon },
    { to: '/admin/products', label: t('layout.admin.links.products', 'Products'), icon: CubeIcon },
    { to: '/admin/orders', label: t('layout.admin.links.orders', 'Orders'), icon: ShoppingBagIcon },
    { to: '/admin/reviews', label: t('layout.admin.links.reviews', 'Reviews'), icon: StarIcon },
    { to: '/admin/payouts', label: t('layout.admin.links.payouts', 'Payouts'), icon: BanknotesIcon },
    { to: '/admin/analytics', label: t('layout.admin.links.analytics', 'Analytics'), icon: ChartBarSquareIcon },
    { to: '/admin/drivers', label: t('layout.admin.links.drivers', 'Drivers'), icon: TruckIcon },
    { to: '/admin/security', label: t('layout.admin.links.security', 'Security'), icon: ShieldCheckIcon },
    { to: '/admin/settings', label: t('layout.admin.links.settings', 'Settings'), icon: Cog6ToothIcon },
  ]

  // 6 items: Dashboard | Orders | Addresses | Shopping Lists | Loyalty | Settings
  // Security → tab inside Settings
  const buyerNavItems = [
    { to: '/buyer/dashboard', label: t('layout.buyer.links.dashboard', 'Dashboard'), icon: HomeIcon },
    { to: '/buyer/orders', label: t('layout.buyer.links.orders', 'Orders'), icon: ShoppingBagIcon },
    { to: '/buyer/addresses', label: t('layout.buyer.links.addresses', 'Addresses'), icon: MapPinIcon },
    { to: '/buyer/shopping-lists', label: t('layout.buyer.links.shoppingLists', 'Shopping Lists'), icon: ClipboardDocumentListIcon },
    { to: '/buyer/rfq', label: t('layout.buyer.links.myRequests', 'My Requests'), icon: DocumentTextIcon },
    { to: '/buyer/loyalty', label: t('layout.buyer.links.loyalty', 'Loyalty'), icon: StarIcon },
    { to: '/buyer/settings', label: t('layout.buyer.links.settings', 'Settings'), icon: Cog6ToothIcon },
  ]

  const roleLabels = {
    admin: t('layout.dashboard.roles.admin', 'Admin'),
    vendor: t('layout.dashboard.roles.vendor', 'Vendor'),
    driver: t('layout.dashboard.roles.driver', 'Driver'),
    buyer: t('layout.dashboard.roles.buyer', 'Buyer'),
  }
  
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
            {sidebarOpen && <span>{isAdmin ? t('layout.admin.links.settings', 'Settings') : t('layout.dashboard.preferences', 'Preferences')}</span>}
          </Link>
          <button
            onClick={signOut}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors ${
              !sidebarOpen && 'justify-center'
            }`}
          >
            <ArrowLeftOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span>{t('nav.logout', 'Sign Out')}</span>}
          </button>
        </div>
      </aside>
      
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t('layout.dashboard.closeMenu', 'Close menu')}
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
                aria-label={t('layout.dashboard.closeMenu', 'Close menu')}
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
                aria-label={isDark ? t('layout.main.switchToLightMode', 'Switch to light mode') : t('layout.main.switchToDarkMode', 'Switch to dark mode')}
              >
                {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              </button>

              {/* Notifications */}
              <NotificationLink
                className="relative p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                iconClassName="w-5 h-5"
                badgeClassName="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
                ariaLabel={t('nav.notifications', 'Notifications')}
              />

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
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{roleLabels[profile?.role] ?? profile?.role}</p>
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
