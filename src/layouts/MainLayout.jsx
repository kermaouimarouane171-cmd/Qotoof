import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useLanguageStore } from '@/store/languageStore'
import { useDarkMode } from '@/hooks/useDarkMode'
import {
  Bars3Icon,
  XMarkIcon,
  ShoppingCartIcon,
  GlobeAltIcon,
  ArrowRightOnRectangleIcon,
  ChartBarSquareIcon,
  ShoppingBagIcon,
  HomeIcon,
  BuildingStorefrontIcon,
  MagnifyingGlassIcon,
  UserIcon,
  HeartIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline'
import { MoroccoNotice } from '@/components/ui'
import CookieConsent from '@/components/CookieConsent'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useFavoritesStore } from '@/store/favoritesStore'
import { APP_CONFIG } from '@/config/appConfig'

const MainLayout = () => {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  const { user, profile, signOut } = useAuthStore()
  const { getItemCount } = useCartStore()
  const { getCount: getFavoritesCount } = useFavoritesStore()
  const { language, setLanguage } = useLanguageStore()
  const { isDark, toggle: toggleDarkMode } = useDarkMode()

  const cartCount = getItemCount()
  const favoritesCount = getFavoritesCount()
  
  const languages = [
    { code: 'en', label: 'EN', flag: '🇺🇸' },
    { code: 'fr', label: 'FR', flag: '🇫🇷' },
    { code: 'ar', label: 'AR', flag: '🇲🇦' },
  ]
  
  const isActive = (path) => location.pathname === path
  
  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      window.location.href = `/marketplace?search=${encodeURIComponent(searchQuery)}`
    }
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Morocco Availability Banner */}
      <MoroccoNotice variant="banner" />

      {/* Modern Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 dark:bg-gray-900 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-18">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                <span className="text-white font-bold text-lg">Q</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent dark:from-green-400 dark:to-emerald-400 hidden sm:block">
                Qotoof
              </span>
            </Link>
            
            {/* Search Bar - Centered */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl mx-8">
              <div className="relative w-full">
                <MagnifyingGlassIcon className="absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search plants, vegetables, fruits..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 rtl:pl-4 rtl:pr-12 py-3 bg-gray-100 dark:bg-gray-800 border-0 rounded-2xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:bg-white dark:focus:bg-gray-700 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
            </form>
            
            {/* Right Side */}
            <div className="flex items-center gap-2">
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? (
                  <SunIcon className="w-5 h-5" />
                ) : (
                  <MoonIcon className="w-5 h-5" />
                )}
              </button>

              {/* Language Selector */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                  className="p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <GlobeAltIcon className="w-5 h-5" />
                </button>
                
                {languageMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close language menu"
                      className="fixed inset-0 z-10"
                      onClick={() => setLanguageMenuOpen(false)}
                    />
                    <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-20 overflow-hidden">
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code)
                            setLanguageMenuOpen(false)
                          }}
                          className={`w-full px-4 py-2.5 text-left rtl:text-right flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            language === lang.code ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <span className="text-lg">{lang.flag}</span>
                          <span className="text-sm font-medium">{lang.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              
              {/* Cart */}
              <Link
                to="/cart"
                className="relative p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <ShoppingCartIcon className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 rtl:-right-auto rtl:-left-0.5 min-w-[18px] h-[18px] bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {cartCount}
                  </span>
                )}
              </Link>

              {/* Favorites */}
              {user && (
                <Link
                  to="/favorites"
                  className="relative p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  <HeartIcon className="w-5 h-5" />
                  {favoritesCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 rtl:-right-auto rtl:-left-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {favoritesCount > 99 ? '99+' : favoritesCount}
                    </span>
                  )}
                </Link>
              )}

              {/* User Menu */}
              {user ? (
                <div className="relative hidden sm:block">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-1.5 pr-3 rtl:pr-1.5 rtl:pl-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {profile?.first_name}
                    </span>
                  </button>
                  
                  {userMenuOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Close user menu"
                        className="fixed inset-0 z-10"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 py-2 z-20 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{profile?.first_name} {profile?.last_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{profile?.email}</p>
                        </div>

                        <Link
                          to="/profile"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rtl:flex-row-reverse"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <UserIcon className="w-4 h-4" />
                          Profile
                        </Link>

                        {profile?.role === 'buyer' && (
                          <Link
                            to="/buyer/orders"
                            className="flex items-center rtl:flex-row-reverse gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <ChartBarSquareIcon className="w-4 h-4" />
                            My Orders
                          </Link>
                        )}

                        {profile?.role === 'vendor' && (
                          <Link
                            to="/vendor/dashboard"
                            className="flex items-center rtl:flex-row-reverse gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <ChartBarSquareIcon className="w-4 h-4" />
                            Vendor Dashboard
                          </Link>
                        )}

                        {profile?.role === 'driver' && (
                          <Link
                            to="/driver/dashboard"
                            className="flex items-center rtl:flex-row-reverse gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <ChartBarSquareIcon className="w-4 h-4" />
                            Driver Dashboard
                          </Link>
                        )}

                        {profile?.role === 'admin' && (
                          <Link
                            to="/admin/dashboard"
                            className="flex items-center rtl:flex-row-reverse gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <ChartBarSquareIcon className="w-4 h-4" />
                            Admin Panel
                          </Link>
                        )}

                        <hr className="my-2 border-gray-100 dark:border-gray-700" />

                        <button
                          onClick={() => {
                            signOut()
                            setUserMenuOpen(false)
                          }}
                          className="w-full px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center rtl:flex-row-reverse gap-3 transition-colors"
                        >
                          <ArrowRightOnRectangleIcon className="w-4 h-4 rtl-flip" />
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Link to="/login" className="hidden sm:flex btn-primary rounded-xl dark:from-green-600 dark:to-emerald-600">
                  Sign In
                </Link>
              )}
              
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                {mobileMenuOpen ? (
                  <XMarkIcon className="w-5 h-5" />
                ) : (
                  <Bars3Icon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="px-4 py-4 space-y-1">
              {/* Mobile Search */}
              <form onSubmit={handleSearch} className="mb-4">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 rtl:pl-4 rtl:pr-12 py-3 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500/50 dark:placeholder:text-gray-500"
                  />
                </div>
              </form>
              
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive('/')
                    ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <HomeIcon className="w-5 h-5" />
                Home
              </Link>
              <Link
                to="/marketplace"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive('/marketplace')
                    ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <BuildingStorefrontIcon className="w-5 h-5" />
                Marketplace
              </Link>
              <Link
                to="/stores"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive('/stores')
                    ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <BuildingStorefrontIcon className="w-5 h-5" />
                Stores
              </Link>
              <Link
                to="/tracking"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <ShoppingBagIcon className="w-5 h-5" />
                Track Order
              </Link>
              
              {/* Mobile Language Selector */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-4">Language</p>
                <div className="flex gap-2 px-4">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        language === lang.code
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {lang.flag} {lang.label}
                    </button>
                  ))}
                </div>
              </div>
              
              {user && (
                <>
                  <hr className="my-2 border-gray-100 dark:border-gray-700" />
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl"
                  >
                    <UserIcon className="w-5 h-5" />
                    Profile
                  </Link>
                  <Link
                    to={profile?.role === 'admin' ? '/admin/dashboard' : profile?.role === 'vendor' ? '/vendor/dashboard' : profile?.role === 'driver' ? '/driver/dashboard' : '/buyer/orders'}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl"
                  >
                    <ChartBarSquareIcon className="w-5 h-5" />
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      signOut()
                      setMobileMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                  >
                    <ArrowRightOnRectangleIcon className="w-5 h-5 rtl-flip" />
                    Sign Out
                  </button>
                </>
              )}

              {/* Mobile Footer Links */}
              <hr className="my-4 border-gray-100 dark:border-gray-800" />

              {/* Morocco Notice for Mobile */}
              <div className="px-4 pb-2">
                <MoroccoNotice variant="compact" />
              </div>

              <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                <Link to="/about" onClick={() => setMobileMenuOpen(false)} className="text-center py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400">About</Link>
                <Link to="/contact" onClick={() => setMobileMenuOpen(false)} className="text-center py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400">Contact</Link>
                <Link to="/help#faq" onClick={() => setMobileMenuOpen(false)} className="text-center py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400">FAQ</Link>
              </div>
            </div>
          </div>
        )}
      </header>
      
      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer - Desktop */}
      <footer className="hidden md:block bg-gray-900 text-white">
        {/* Main Footer */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">Q</span>
                </div>
                <span className="text-xl font-bold">Qotoof</span>
              </Link>
              <p className="text-gray-400 text-sm mb-4">
                Morocco's premier B2B wholesale marketplace for fresh produce.
              </p>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <PhoneIcon className="w-4 h-4 text-green-500" />
                  <span>{APP_CONFIG.supportPhoneDisplay}</span>
                </div>
                <div className="flex items-center gap-2">
                  <EnvelopeIcon className="w-4 h-4 text-green-500" />
                  <span>{APP_CONFIG.supportEmail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-green-500" />
                  <span>Casablanca, Morocco</span>
                </div>
              </div>
            </div>

            {/* Marketplace */}
            <div>
              <h4 className="font-semibold mb-4 text-white">Marketplace</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><Link to="/marketplace" className="hover:text-green-400 transition-colors">All Products</Link></li>
                <li><Link to="/stores" className="hover:text-green-400 transition-colors">All Stores</Link></li>
                <li><Link to="/marketplace?category=plants" className="hover:text-green-400 transition-colors">Plants & Trees</Link></li>
                <li><Link to="/marketplace?category=vegetables" className="hover:text-green-400 transition-colors">Vegetables</Link></li>
                <li><Link to="/marketplace?category=fruits" className="hover:text-green-400 transition-colors">Fruits</Link></li>
              </ul>
            </div>

            {/* For Buyers */}
            <div>
              <h4 className="font-semibold mb-4 text-white">For Buyers</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><Link to="/cart" className="hover:text-green-400 transition-colors">Shopping Cart</Link></li>
                <li><Link to="/checkout" className="hover:text-green-400 transition-colors">Checkout</Link></li>
                <li><Link to="/tracking" className="hover:text-green-400 transition-colors">Track Order</Link></li>
                <li><Link to="/returns" className="hover:text-green-400 transition-colors">Returns</Link></li>
                <li><Link to="/shipping" className="hover:text-green-400 transition-colors">Shipping Info</Link></li>
              </ul>
            </div>

            {/* For Vendors */}
            <div>
              <h4 className="font-semibold mb-4 text-white">For Vendors</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><Link to="/become-vendor" className="hover:text-green-400 transition-colors">Become a Vendor</Link></li>
                <li><Link to="/vendor/dashboard" className="hover:text-green-400 transition-colors">Vendor Dashboard</Link></li>
                <li><Link to="/vendor/products" className="hover:text-green-400 transition-colors">Manage Products</Link></li>
                <li><Link to="/help#faq" className="hover:text-green-400 transition-colors">FAQ</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4 text-white">Company</h4>
              <ul className="space-y-2.5 text-sm text-gray-400">
                <li><Link to="/about" className="hover:text-green-400 transition-colors">About Us</Link></li>
                <li><Link to="/contact" className="hover:text-green-400 transition-colors">Contact Us</Link></li>
                <li><Link to="/help#faq" className="hover:text-green-400 transition-colors">FAQ</Link></li>
                <li><Link to="/terms" className="hover:text-green-400 transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-green-400 transition-colors">Privacy Policy</Link></li>
                <li><Link to="/returns" className="hover:text-green-400 transition-colors">Return Policy</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Qotoof. All rights reserved.</p>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <MapPinIcon className="w-4 h-4 text-green-500" />
              <span>Available exclusively in</span>
              <span className="text-white font-medium">🇲🇦 Morocco</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <Link to="/terms" className="hover:text-green-400 transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-green-400 transition-colors">Privacy</Link>
              <Link to="/contact" className="hover:text-green-400 transition-colors">Contact</Link>
              <Link to="/shipping" className="hover:text-green-400 transition-colors">Shipping</Link>
              <Link to="/returns" className="hover:text-green-400 transition-colors">Returns</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Modern Mobile Bottom Navigation - Glovo Style */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 z-40 safe-bottom">
        <div className="flex items-center justify-around py-2 px-2">
          <Link to="/" className={`flex flex-col items-center py-1.5 px-3 rounded-xl transition-colors ${isActive('/') ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
            <HomeIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium mt-0.5 text-gray-600 dark:text-gray-400">Home</span>
          </Link>
          <Link to="/marketplace" className={`flex flex-col items-center py-1.5 px-3 rounded-xl transition-colors ${isActive('/marketplace') ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
            <BuildingStorefrontIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium mt-0.5 text-gray-600 dark:text-gray-400">Browse</span>
          </Link>
          <Link to="/cart" className="relative flex flex-col items-center py-1.5 px-3 rounded-xl text-gray-400 dark:text-gray-500">
            <div className="relative">
              <ShoppingCartIcon className="w-6 h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 rtl:-right-auto rtl:-left-1.5 min-w-[16px] h-4 bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium mt-0.5 text-gray-600 dark:text-gray-400">Cart</span>
          </Link>
          {user ? (
            <Link
              to={profile?.role === 'admin' ? '/admin/dashboard' : profile?.role === 'vendor' ? '/vendor/dashboard' : profile?.role === 'driver' ? '/driver/dashboard' : '/buyer/orders'}
              className={`flex flex-col items-center py-1.5 px-3 rounded-xl transition-colors ${
                location.pathname.includes('/dashboard') || location.pathname.includes('/vendor') || location.pathname.includes('/admin') || location.pathname.includes('/driver') || location.pathname.includes('/buyer')
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <ChartBarSquareIcon className="w-6 h-6" />
              <span className="text-[10px] font-medium mt-0.5 text-gray-600 dark:text-gray-400">Dashboard</span>
            </Link>
          ) : (
            <Link to="/login" className="flex flex-col items-center py-1.5 px-3 rounded-xl text-gray-400 dark:text-gray-500">
              <UserIcon className="w-6 h-6" />
              <span className="text-[10px] font-medium mt-0.5 text-gray-600 dark:text-gray-400">Sign In</span>
            </Link>
          )}
        </div>
      </nav>
    <ErrorBoundary>
      <CookieConsent />
    </ErrorBoundary>
    </div>
  )
}

export default MainLayout
