import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import productSearchService from '@/services/search/productSearchService'
import { profilesService } from '@/modules/users'
import { formatPrice } from '@/utils/currency.jsx'
import { logger } from '@/utils/logger'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BuildingStorefrontIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  StarIcon,
  TruckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

const categories = [
  { id: 'vegetables', i18nKey: 'vegetables', emoji: '🥬' },
  { id: 'fruits', i18nKey: 'fruits', emoji: '🍊' },
  { id: 'plants', i18nKey: 'plants', emoji: '🌱' },
  { id: 'herbs', i18nKey: 'herbs', emoji: '🌿' },
  { id: 'spices', i18nKey: 'spices', emoji: '🫚' },
  { id: 'seeds', i18nKey: 'seeds', emoji: '🌾' },
]

const buyerSteps = [
  { id: 'searchProduct', icon: MagnifyingGlassIcon },
  { id: 'chooseQuantity', icon: ShoppingCartIcon },
  { id: 'confirmOrder', icon: ShieldCheckIcon },
  { id: 'trackDelivery', icon: TruckIcon },
]

const ProductSkeletonCard = () => (
  <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm animate-pulse">
    <div className="h-36 w-full rounded-xl bg-emerald-100/70" />
    <div className="mt-4 h-4 w-3/4 rounded bg-emerald-100/70" />
    <div className="mt-2 h-3 w-1/2 rounded bg-emerald-100/60" />
    <div className="mt-4 h-5 w-24 rounded bg-emerald-100/70" />
  </div>
)

const VendorSkeletonCard = () => (
  <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm animate-pulse">
    <div className="flex items-center gap-3">
      <div className="h-12 w-12 rounded-full bg-emerald-100/70" />
      <div className="flex-1">
        <div className="h-4 w-32 rounded bg-emerald-100/70" />
        <div className="mt-2 h-3 w-20 rounded bg-emerald-100/60" />
      </div>
    </div>
    <div className="mt-4 h-3 w-full rounded bg-emerald-100/60" />
    <div className="mt-2 h-3 w-2/3 rounded bg-emerald-100/60" />
  </div>
)

const HomePage = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')

  const isArabic = (i18n.language || 'ar').toLowerCase().startsWith('ar')

  // SM-1 fix: استخدام TanStack Query بدلاً من useEffect+useState
  // البيانات تُكاش لمدة 5 دقائق → لا إعادة جلب عند كل navigation
  const { data: featuredProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ['home', 'featured-products'],
    queryFn: async () => {
      const result = await productSearchService.getFeaturedProducts(8)
      return (Array.isArray(result) ? result : []).filter((p) => p?.is_available !== false).slice(0, 8)
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    onError: (error) => logger.error('Error loading featured products:', error),
  })

  const { data: trustedVendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['home', 'trusted-vendors'],
    queryFn: async () => {
      const result = await profilesService.fetchActiveVerifiedVendors()
      return (Array.isArray(result?.data) ? result.data : [])
        .filter((v) => v?.is_approved !== false)
        .sort((a, b) => Number(b?.rating || 0) - Number(a?.rating || 0))
        .slice(0, 6)
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    onError: (error) => logger.error('Error loading trusted vendors:', error),
  })

  const primaryCta = { to: '/register', label: t('home.cta.startNow', 'ابدأ الآن') }
  const secondaryCta = { to: '/marketplace', label: t('home.cta.browseMarketplace', 'تصفح السوق') }

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    const query = searchQuery.trim()
    if (!query) {
      navigate('/marketplace')
      return
    }
    navigate(`/marketplace?search=${encodeURIComponent(query)}`)
  }

  return (
    <main dir={isArabic ? 'rtl' : 'ltr'} className="bg-[#f7fbf8] text-gray-900">
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600">
        <div className="absolute -top-24 left-8 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 right-8 h-72 w-72 rounded-full bg-teal-200/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="mb-4 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1 text-sm text-white/95 backdrop-blur">
            {t('home.hero.badge', 'Qotoof B2B Marketplace')}
          </p>

          <h1 className="max-w-3xl text-3xl font-black leading-tight text-white sm:text-5xl">
            {t('home.title', 'سوق الجملة للخضر والفواكه في المغرب')}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50 sm:text-base">
            {t('home.subtitle', 'منصة قطوف تربط المشترين المهنيين بالموردين الموثوقين عبر تجربة شراء سريعة، أسعار جملة واضحة، وتتبع طلبات كامل.')}
          </p>

          <form onSubmit={handleSearchSubmit} className="mt-8 max-w-2xl rounded-2xl bg-white p-2 shadow-2xl shadow-emerald-900/20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center rtl:sm:flex-row-reverse">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t('home.searchPlaceholder', 'ابحث عن خضر، فواكه، موردين...')}
                  aria-label={t('home.searchAria', 'ابحث في السوق')}
                  className="h-11 w-full rounded-xl border border-emerald-100 bg-emerald-50/30 pr-10 pl-3 text-sm outline-none ring-emerald-300 transition focus:ring"
                />
              </div>
              <button type="submit" className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700">
                {t('home.searchButton', 'بحث')}
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={primaryCta.to} className="inline-flex items-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
              {primaryCta.label}
            </Link>
            <Link to={secondaryCta.to} className="inline-flex items-center rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20">
              {secondaryCta.label}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('home.categories.title', 'التصنيفات')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('home.categories.subtitle', 'اختر القسم المناسب لبدء الشراء بسرعة')}</p>
          </div>
          <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            {t('home.categories.viewAll', 'عرض الكل')}
            {isArabic ? <ArrowRightIcon className="h-4 w-4" /> : <ArrowLeftIcon className="h-4 w-4" />}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/marketplace?category=${category.id}`}
              className="group rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-3xl">{category.emoji}</div>
              <h3 className="mt-3 text-sm font-semibold text-gray-900">{t(`home.categories.${category.i18nKey}`, category.i18nKey)}</h3>
              <p className="mt-1 text-xs text-gray-500">{t('home.categories.wholesaleItems', 'منتجات جملة')}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('home.featuredProducts.title', 'منتجات مميزة')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('home.featuredProducts.subtitle', 'أفضل عروض اليوم من الموردين المعتمدين')}</p>
          </div>
          <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            {t('home.featuredProducts.viewAll', 'المزيد')}
            {isArabic ? <ArrowRightIcon className="h-4 w-4" /> : <ArrowLeftIcon className="h-4 w-4" />}
          </Link>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <ProductSkeletonCard key={`product-skeleton-${index}`} />
            ))}
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
            {t('home.featuredProducts.noProducts', 'لا توجد منتجات مميزة حالياً. تصفح السوق للاطلاع على كامل العروض.')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => {
              const primaryImage = product?.product_images?.find((img) => img?.is_primary)?.url
                || product?.product_images?.[0]?.url

              return (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="h-36 overflow-hidden rounded-xl bg-emerald-50">
                    {primaryImage ? (
                      <img src={primaryImage} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-emerald-500">{t('home.featuredProducts.noImage', 'صورة غير متوفرة')}</div>
                    )}
                  </div>

                  <h3 className="mt-4 line-clamp-1 text-sm font-semibold text-gray-900">{product.name}</h3>
                  <p className="mt-1 line-clamp-1 text-xs text-gray-500">{product.category || t('home.featuredProducts.freshProduct', 'منتج طازج')}</p>

                  <div className="mt-4 flex items-end justify-between">
                    <p className="text-sm font-bold text-emerald-700">{formatPrice(product.price_per_unit || 0)}</p>
                    <p className="text-xs text-gray-500">{t('home.featuredProducts.minOrder', 'حد أدنى: {{min}} {{unit}}', { min: product.min_order_quantity || 1, unit: product.unit_type || '' })}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('home.trustedVendors.title', 'بائعون موثوقون')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('home.trustedVendors.subtitle', 'متاجر فعالة مع تقييمات إيجابية من المشترين')}</p>
          </div>
          <Link to="/stores" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            {t('home.trustedVendors.viewAll', 'كل المتاجر')}
            {isArabic ? <ArrowRightIcon className="h-4 w-4" /> : <ArrowLeftIcon className="h-4 w-4" />}
          </Link>
        </div>

        {vendorsLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <VendorSkeletonCard key={`vendor-skeleton-${index}`} />
            ))}
          </div>
        ) : trustedVendors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
            {t('home.trustedVendors.noVendors', 'لا توجد متاجر متاحة حالياً.')}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trustedVendors.map((vendor) => {
              const rating = Number(vendor.rating || 0)
              const vendorName = vendor.store_name || `${vendor.first_name || ''} ${vendor.last_name || ''}`.trim() || t('home.trustedVendors.unknownVendor', 'متجر')

              return (
                <Link
                  key={vendor.id}
                  to={`/stores/${vendor.id}`}
                  className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <BuildingStorefrontIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="line-clamp-1 text-sm font-semibold text-gray-900">{vendorName}</h3>
                      <p className="text-xs text-gray-500">{vendor.city || t('home.trustedVendors.morocco', 'المغرب')}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-1 text-amber-500">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <StarIcon key={`${vendor.id}-star-${idx}`} className={`h-4 w-4 ${idx < Math.round(rating) ? 'opacity-100' : 'opacity-25'}`} />
                    ))}
                    <span className="ms-2 text-xs font-semibold text-gray-700">{rating.toFixed(1)}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                      <UserGroupIcon className="h-3.5 w-3.5" />
                      {t('home.trustedVendors.verifiedBadge', 'مورد معتمد')}
                    </span>
                    {vendor.is_verified && (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <ShieldCheckIcon className="h-4 w-4" />
                        {t('home.trustedVendors.verified', 'موثّق')}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">{t('home.roles.title', 'اكتشف دورك المناسب')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('home.roles.subtitle', 'انضم إلى منصة قطوف بالدور الذي يناسبك')}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-3xl">🛒</div>
            <h3 className="text-lg font-bold text-gray-900">{t('home.roles.buyer.title', 'مشتري')}</h3>
            <p className="mt-2 text-sm text-gray-600">{t('home.roles.buyer.description', 'اشترِ المنتجات الطازجة بالجملة مباشرة من الموردين')}</p>
            <ul className="mt-4 space-y-2 text-xs text-gray-600">
              <li className="flex items-center gap-2">✓ {t('home.roles.buyer.feature1', 'شراء بالجملة بأسعار تنافسية')}</li>
              <li className="flex items-center gap-2">✓ {t('home.roles.buyer.feature2', 'تتبع الطلبات في الوقت الفعلي')}</li>
              <li className="flex items-center gap-2">✓ {t('home.roles.buyer.feature3', 'نقاط ولاء ومكافآت')}</li>
              <li className="flex items-center gap-2">✓ {t('home.roles.buyer.feature4', 'طلب عروض أسعار مخصصة')}</li>
            </ul>
            <Link to="/register?role=buyer" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">
              {t('home.roles.buyer.cta', 'سجل كمشتري')}
            </Link>
          </div>

          <div className="rounded-2xl border border-teal-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-3xl">🏪</div>
            <h3 className="text-lg font-bold text-gray-900">{t('home.roles.vendor.title', 'بائع')}</h3>
            <p className="mt-2 text-sm text-gray-600">{t('home.roles.vendor.description', 'اعرض منتجاتك وأدر متجرك على منصة وطنية')}</p>
            <ul className="mt-4 space-y-2 text-xs text-gray-600">
              <li className="flex items-center gap-2">✓ {t('home.roles.vendor.feature1', 'إدارة المتجر والمنتجات')}</li>
              <li className="flex items-center gap-2">✓ {t('home.roles.vendor.feature2', 'تحليلات المبيعات والتقارير')}</li>
              <li className="flex items-center gap-2">✓ {t('home.roles.vendor.feature3', 'تواصل مباشر مع المشترين')}</li>
              <li className="flex items-center gap-2">✓ {t('home.roles.vendor.feature4', 'شحن وتوصيل متكامل')}</li>
            </ul>
            <Link to="/register?role=vendor" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700">
              {t('home.roles.vendor.cta', 'سجل كبائع')}
            </Link>
          </div>

          <div className="rounded-2xl border border-cyan-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-3xl">🚚</div>
            <h3 className="text-lg font-bold text-gray-900">{t('home.roles.driver.title', 'سائق')}</h3>
            <p className="mt-2 text-sm text-gray-600">{t('home.roles.driver.description', 'اوصل الطلبات وحقق دخلاً إضافياً بمرونة تامة')}</p>
            <ul className="mt-4 space-y-2 text-xs text-gray-600">
              <li className="flex items-center gap-2">✓ {t('home.roles.driver.feature1', 'مرونة في الجدول والعمل')}</li>
              <li className="flex items-center gap-2">✓ {t('home.roles.driver.feature2', 'أرباح تنافسية')}</li>
              <li className="flex items-center gap-2">✓ {t('home.roles.driver.feature3', 'تتبع التوصيلات والمسارات')}</li>
              <li className="flex items-center gap-2">✓ {t('home.roles.driver.feature4', 'تقييمات وسمعة')}</li>
            </ul>
            <Link to="/register?role=driver" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-700">
              {t('home.roles.driver.cta', 'سجل كسائق')}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900">{t('home.howItWorks.title', 'كيف تعمل المنصة للمشتري؟')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('home.howItWorks.subtitle', '4 خطوات فقط من البحث حتى الاستلام')}</p>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {buyerSteps.map((step, index) => (
              <article key={step.id} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                  <step.icon className="h-5 w-5" />
                </div>
                <p className="mb-2 text-xs font-bold text-emerald-700">{t('home.howItWorks.step', 'الخطوة {{number}}', { number: index + 1 })}</p>
                <h3 className="text-sm font-semibold text-gray-900">{t(`home.howItWorks.steps.${step.id}.title`, step.id)}</h3>
                <p className="mt-2 text-xs leading-6 text-gray-600">{t(`home.howItWorks.steps.${step.id}.description`, '')}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default HomePage
