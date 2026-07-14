import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeftIcon, ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline'

const ROUTE_LABELS = {
  '/marketplace': { key: 'nav.marketplace', fallback: 'Marketplace' },
  '/cart': { key: 'nav.cart', fallback: 'Cart' },
  '/checkout': { key: 'checkout.title', fallback: 'Checkout' },
  '/favorites': { key: 'nav.favorites', fallback: 'Favorites' },
  '/stores': { key: 'nav.stores', fallback: 'Stores' },
  '/search': { key: 'nav.search', fallback: 'Search' },
  '/buyer/orders': { key: 'layout.buyer.links.orders', fallback: 'My Orders' },
  '/buyer/addresses': { key: 'layout.buyer.links.addresses', fallback: 'Addresses' },
  '/buyer/coupons': { key: 'layout.buyer.links.coupons', fallback: 'Coupons' },
  '/buyer/loyalty': { key: 'layout.buyer.links.loyalty', fallback: 'Loyalty' },
  '/buyer/settings': { key: 'layout.buyer.links.settings', fallback: 'Settings' },
  '/buyer/security': { key: 'layout.buyer.links.security', fallback: 'Security' },
  '/buyer/shopping-lists': { key: 'layout.buyer.links.shoppingLists', fallback: 'Shopping Lists' },
  '/buyer/rfq': { key: 'layout.buyer.links.rfq', fallback: 'RFQ' },
  '/buyer/tracking': { key: 'layout.buyer.mobileTabs.tracking', fallback: 'Tracking' },
  '/buyer/negotiations': { key: 'nav.negotiations', fallback: 'Negotiations' },
  '/profile': { key: 'layout.buyer.links.profile', fallback: 'Profile' },
  '/notifications': { key: 'nav.notifications', fallback: 'Notifications' },
  '/returns': { key: 'nav.returns', fallback: 'Returns' },
  '/messages': { key: 'nav.messages', fallback: 'Messages' },
  '/help': { key: 'nav.help', fallback: 'Help Center' },
  '/contact': { key: 'nav.contact', fallback: 'Contact Us' },
  '/order-confirmation': { key: 'checkout.orderConfirmation', fallback: 'Order Confirmation' },
  '/marketplace/seasonal': { key: 'nav.seasonal', fallback: 'Seasonal Calendar' },
}

export default function Breadcrumbs({ customItems = [], className = '' }) {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const isArabic = (i18n?.language || 'ar').toLowerCase().startsWith('ar')
  const Separator = isArabic ? ChevronLeftIcon : ChevronRightIcon

  const segments = pathname.split('/').filter(Boolean)
  const items = []

  items.push({ to: '/', label: t('layout.buyer.mobileTabs.home', 'Home'), icon: HomeIcon })

  if (customItems.length > 0) {
    items.push(...customItems)
  } else {
    let currentPath = ''
    for (const segment of segments) {
      currentPath += '/' + segment
      const routeInfo = ROUTE_LABELS[currentPath]
      if (routeInfo) {
        items.push({ to: currentPath, label: t(routeInfo.key, routeInfo.fallback) })
      } else if (segment.match(/^[0-9a-f-]{36}$/) || segment.match(/^\d+$/)) {
        // ID segments — skip adding a label, will be handled by customItems
        continue
      } else {
        // Try parent path
        const parentPath = '/' + segments.slice(0, segments.indexOf(segment) + 1).join('/')
        const parentInfo = ROUTE_LABELS[parentPath]
        if (parentInfo) {
          items.push({ to: parentPath, label: t(parentInfo.key, parentInfo.fallback) })
        }
      }
    }
  }

  if (items.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className={`mb-4 ${className}`}>
      <ol className="flex items-center flex-wrap gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const Icon = item.icon
          return (
            <li key={item.to || index} className="flex items-center gap-1">
              {index > 0 && <Separator className="w-4 h-4 text-gray-300" aria-hidden="true" />}
              {isLast ? (
                <span className="text-gray-900 font-medium flex items-center gap-1" aria-current="page">
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="text-gray-500 hover:text-primary-600 transition-colors flex items-center gap-1"
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
