import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/modules/cart'
import { useLanguageStore } from '@/store/languageStore'
import { Logo } from '@/components/ui'
import {
  ShoppingCartIcon,
  HeartIcon,
  UserCircleIcon,
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
  SunIcon,
  MoonIcon,
  ArrowRightOnRectangleIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import {
  ShoppingCartIcon as ShoppingCartSolid,
} from '@heroicons/react/24/solid'
import { useDarkMode } from '@/hooks/useDarkMode'
import NotificationLink from '@/components/notifications/NotificationLink'
import { canAccessRoleDashboard } from '@/utils/permissions'
import { USER_ROLES } from '@/constants/roles'

const LANGS = [
  { code: 'ar', label: 'عربي', dir: 'rtl' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' },
]

export const getOrdersLinkForRole = (role) => {
  return {
    [USER_ROLES.BUYER]: '/buyer/orders',
    [USER_ROLES.VENDOR]: '/vendor/orders',
    [USER_ROLES.ADMIN]: '/admin/orders',
    [USER_ROLES.DRIVER]: '/driver/history',
  }[role] || '/orders'
}

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const { user, profile, signOut } = useAuthStore()
  const cartItems = useCartStore((s) => s.items)
  const cartCount = cartItems.length
  const { language, setLanguage } = useLanguageStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const { isDark: dark, toggle: toggleDark } = useDarkMode()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const userMenuRef = useRef(null)

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false)
    setUserMenuOpen(false)
  }, [pathname])

  const handleSearch = (e) => {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`)
      setSearch('')
    }
  }

  const handleLogout = async () => {
    setUserMenuOpen(false)
    await signOut()
    navigate('/')
  }

  const switchLang = (code) => {
    setLanguage(code)
  }

  const getDashboardLink = () => {
    const effectiveProfile = profile || { role: user?.user_metadata?.role }
    // canAccessRoleDashboard excludes BUYER — buyers navigate via /marketplace directly
    if (!canAccessRoleDashboard(effectiveProfile)) return null

    return {
      [USER_ROLES.VENDOR]: '/vendor/dashboard',
      [USER_ROLES.DRIVER]: '/driver/dashboard',
      [USER_ROLES.ADMIN]: '/admin/dashboard',
    }[effectiveProfile.role] || null
  }

  const avatarLetter = (profile?.full_name || profile?.name || user?.email || 'U')[0].toUpperCase()

  const navLinks = [
    { to: '/', label: t('nav.home', 'الرئيسية') },
    { to: '/marketplace', label: t('nav.marketplace', 'السوق') },
    { to: '/stores', label: t('nav.stores', 'المتاجر') },
  ]

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label={t('nav.mainNavigation', 'Main navigation')}>
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ─────────────────────────────────── */}
          <Logo size="sm" textClass="text-gray-900 dark:text-white" />

          {/* ── Desktop Nav Links ─────────────────────── */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                aria-current={pathname === to ? 'page' : undefined}
                className={`text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded ${
                  pathname === to
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* ── Search ───────────────────────────────── */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xs mx-4">
            <div className="relative w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('nav.search', 'ابحث عن منتج...')}
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </form>

          {/* ── Right Actions ─────────────────────────── */}
          <div className="flex items-center gap-2">

            {/* Dark Mode */}
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={dark ? t('nav.lightMode', 'Light mode') : t('nav.darkMode', 'Dark mode')}
            >
              {dark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>

            {/* Language Switcher */}
            <div className="hidden sm:flex items-center gap-1 text-xs font-medium">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => switchLang(l.code)}
                  className={`px-2 py-1 rounded transition-colors ${
                    language === l.code || i18n.language === l.code
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {l.code.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Cart */}
            <Link
              to="/cart"
              className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label={t('nav.cart', 'السلة')}
            >
              {cartCount > 0 ? (
                <ShoppingCartSolid className="w-5 h-5 text-primary-600" />
              ) : (
                <ShoppingCartIcon className="w-5 h-5" />
              )}
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </Link>

            {/* Favorites */}
            <Link
              to="/favorites"
              className="hidden sm:flex p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label={t('nav.favorites', 'المفضلة')}
            >
              <HeartIcon className="w-5 h-5" />
            </Link>

            {/* Notifications */}
            {user && (
              <NotificationLink
                className="hidden sm:flex relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                iconClassName="w-5 h-5"
                badgeClassName="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
                ariaLabel={t('nav.notifications', 'الإشعارات')}
              />
            )}

            {/* User Menu / Auth Buttons */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  aria-expanded={userMenuOpen}
                  aria-label={t('nav.openUserMenu', 'Open user menu')}
                  data-testid="user-menu"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {avatarLetter}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[100px] truncate">
                    {profile?.full_name || profile?.name || user.email}
                  </span>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {profile?.full_name || profile?.name || user.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-0.5">
                        {profile?.role || USER_ROLES.BUYER}
                      </p>
                    </div>

                    {(() => {
                      // canAccessRoleDashboard now excludes BUYER, so no double-check needed
                      const dashboardLink = getDashboardLink()
                      if (dashboardLink) {
                        return (
                          <Link to={dashboardLink} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <ChartBarIcon className="w-4 h-4 text-gray-400" />
                            {t('nav.dashboard', 'لوحة التحكم')}
                          </Link>
                        )
                      }
                      return null
                    })()}
                    <Link to="/profile" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <UserCircleIcon className="w-4 h-4 text-gray-400" />
                      {t('nav.profile', 'الملف الشخصي')}
                    </Link>
                    <Link to={getOrdersLinkForRole(profile?.role)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <ClipboardDocumentListIcon className="w-4 h-4 text-gray-400" />
                      {t('nav.orders', 'طلباتي')}
                    </Link>
                    <Link to="/favorites" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <HeartIcon className="w-4 h-4 text-gray-400" />
                      {t('nav.wishlist', 'المفضلة')}
                    </Link>

                    <div className="border-t border-gray-100 dark:border-gray-700 mt-1" />

                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      data-testid="logout-button"
                    >
                      <ArrowRightOnRectangleIcon className="w-4 h-4" />
                      {t('nav.logout', 'تسجيل الخروج')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {t('nav.login', 'تسجيل الدخول')}
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                  {t('nav.register', 'إنشاء حساب')}
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label={menuOpen ? t('nav.closeMenu', 'Close menu') : t('nav.openMenu', 'Open menu')}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation-menu"
            >
              {menuOpen ? <XMarkIcon className="w-5 h-5" /> : <Bars3Icon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile Menu ────────────────────────────────── */}
        {menuOpen && (
          <div id="mobile-navigation-menu" className="md:hidden border-t border-gray-200 dark:border-gray-700 py-3 space-y-1">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="px-2 mb-3">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('nav.search', 'ابحث عن منتج...')}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </form>

            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="block px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
              >
                {label}
              </Link>
            ))}

            {!user && (
              <>
                <hr className="border-gray-200 dark:border-gray-700 my-2" />
                <Link to="/login" className="block px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t('nav.login', 'تسجيل الدخول')}
                </Link>
                <Link to="/register" className="block mx-2 px-4 py-2.5 text-sm font-medium text-center text-white bg-primary-600 hover:bg-primary-700 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
                  {t('nav.register', 'إنشاء حساب')}
                </Link>
              </>
            )}

            {/* Mobile lang switcher */}
            <div className="flex items-center gap-2 px-4 pt-2">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => switchLang(l.code)}
                  className={`px-2 py-1 text-xs rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    language === l.code || i18n.language === l.code
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-gray-500'
                  }`}
                >
                  {l.code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
