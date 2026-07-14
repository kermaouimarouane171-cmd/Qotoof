import { useTranslation } from 'react-i18next'
import { ShieldCheckIcon, LockClosedIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export default function CheckoutTrustBadges({ className = '' }) {
  const { t } = useTranslation()

  const badges = [
    { icon: ShieldCheckIcon, label: t('checkout.trust.secure', 'Secure Checkout') },
    { icon: LockClosedIcon, label: t('checkout.trust.encrypted', 'Encrypted Payment') },
    { icon: ArrowPathIcon, label: t('checkout.trust.refundable', '48h Refund Policy') },
  ]

  return (
    <div className={`flex flex-wrap items-center justify-center gap-4 ${className}`} data-testid="checkout-trust-badges">
      {badges.map((badge) => (
        <div key={badge.label} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
          <badge.icon className="w-4 h-4 text-primary-500" />
          {badge.label}
        </div>
      ))}
    </div>
  )
}
