import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Logo } from '@/components/ui'
import FeatureList from '@/components/auth/FeatureList'

const AuthLayout = () => {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Left Side - Hero (hidden on mobile) */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-700 via-emerald-700 to-teal-800" />

        {/* Background image with overlay */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200"
            alt={t('authLayout.hero.imageAlt', 'Fresh produce')}
            className="w-full h-full object-cover mix-blend-overlay opacity-30"
            loading="lazy"
          />
        </div>

        {/* Decorative blurred orbs */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-32 right-24 w-48 h-48 bg-yellow-300/10 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <Logo size="xl" textClass="text-white tracking-tight" whiteBg={true} />

          {/* Main content */}
          <div className="max-w-md">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-sm font-medium text-white mb-8 border border-white/10">
              <span>🌱</span>
              <span>{t('authLayout.hero.badge', '#1 B2B Marketplace')}</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
              {t('authLayout.hero.title', 'من المزرعة')}
              <span className="block text-yellow-300 mt-1">
                {t('authLayout.hero.subtitle', 'إلى تجارتك')}
              </span>
            </h1>

            <p className="text-lg text-green-100/90 mb-10 leading-relaxed">
              {t(
                'authLayout.hero.description',
                'تواصل مباشر مع المزارعين والمشاتل. اشترِ بالجملة ووفّر أكثر.'
              )}
            </p>

            <FeatureList />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-8">
            <div>
              <div className="text-3xl font-bold text-white">+10K</div>
              <div className="text-sm text-green-200/80">
                {t('authLayout.hero.stats.activeProducts', 'تاجر نشط')}
              </div>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div>
              <div className="text-3xl font-bold text-white">+2K</div>
              <div className="text-sm text-green-200/80">
                {t('authLayout.hero.stats.verifiedVendors', 'مورد موثق')}
              </div>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div>
              <div className="text-3xl font-bold text-white">98%</div>
              <div className="text-sm text-green-200/80">
                {t('authLayout.hero.stats.satisfactionRate', 'رضا العملاء')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 relative">
        {/* Mobile logo (visible only on mobile) */}
        <div className="lg:hidden absolute top-6 left-1/2 -translate-x-1/2">
          <Logo size="lg" textClass="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent" />
        </div>

        {/* Form container */}
        <div className="w-full max-w-md pt-16 lg:pt-0">
          <div className="auth-fade-in">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
