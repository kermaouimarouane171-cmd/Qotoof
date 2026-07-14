import {
  CheckCircleIcon,
  TruckIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

const FeatureList = () => {
  const { t } = useTranslation()

  const features = [
    {
      icon: CheckCircleIcon,
      title: t('authLayout.features.freshProducts', 'منتجات طازجة'),
      desc: t('authLayout.features.freshProductsDesc', 'جودة مضمونة من المزرعة'),
    },
    {
      icon: CurrencyDollarIcon,
      title: t('authLayout.features.competitivePrices', 'أسعار تنافسية'),
      desc: t('authLayout.features.competitivePricesDesc', 'أسعار الجملة المباشرة'),
    },
    {
      icon: TruckIcon,
      title: t('authLayout.features.fastDelivery', 'توصيل سريع'),
      desc: t('authLayout.features.fastDeliveryDesc', 'إلى باب متجرك'),
    },
    {
      icon: ShieldCheckIcon,
      title: t('authLayout.features.trustedSuppliers', 'موردون موثوقون'),
      desc: t('authLayout.features.trustedSuppliersDesc', 'موردون موثقون ومفحوصون'),
    },
  ]

  return (
    <ul className="space-y-4">
      {features.map((feature) => (
        <li key={feature.title} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <feature.icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{feature.title}</p>
            <p className="text-xs text-green-100/80">{feature.desc}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default FeatureList
