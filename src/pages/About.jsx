import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import ErrorBoundary from '@/components/ErrorBoundary'
import { ShoppingBagIcon, TruckIcon, CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'

// ============================================================
// ANIMATED COUNTER COMPONENT
// ============================================================
const AnimatedCounter = ({ end, duration = 2000, suffix = '' }) => {
  const { i18n } = useTranslation()
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible || end === 0) return

    let startTime = null
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      // Ease out cubic for smooth animation
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * end))

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [isVisible, end, duration])

  return (
    <div ref={ref} className="text-3xl font-bold text-green-600 mb-1">
      {count.toLocaleString(i18n.language || 'en')}{suffix}
    </div>
  )
}

// ============================================================
// STAT CARD COMPONENT
// ============================================================
const StatCard = ({ label, value, suffix, loading }) => {
  const { t } = useTranslation()

  return (
    <div className="card p-6 text-center">
      {loading ? (
        <>
          <div className="text-3xl font-bold text-green-600 mb-1 animate-pulse">...</div>
          <div className="text-sm text-gray-500 animate-pulse">{t('about.stats.loading', 'Loading...')}</div>
        </>
      ) : (
        <>
          <AnimatedCounter end={value} suffix={suffix} />
          <div className="text-sm text-gray-500">{label}</div>
        </>
      )}
    </div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
const About = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [stats, setStats] = useState({
    vendors: 0,
    products: 0,
    cities: 0,
    orders: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)

  // ============================================================
  // SEO META TAGS
  // ============================================================
  useEffect(() => {
    // Update page title
    document.title = t('about.pageTitle', 'About Qotoof - Morocco\'s #1 B2B Agricultural Marketplace')

    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]')
    if (!metaDescription) {
      metaDescription = document.createElement('meta')
      metaDescription.name = 'description'
      document.head.appendChild(metaDescription)
    }
    metaDescription.content = t(
      'about.pageDescription',
      'Qotoof connects Moroccan farmers directly with buyers. Fresh produce, fair prices, reliable delivery.'
    )

    // Open Graph tags
    const ogTags = {
      'og:title': 'About Qotoof - Morocco\'s B2B Agricultural Marketplace',
      'og:description': 'Connecting Moroccan farmers directly with buyers for fresh produce.',
      'og:type': 'website',
      'og:url': `${window.location.origin}/about`,
      'og:image': `${window.location.origin}/about-og.jpg`,
    }

    Object.entries(ogTags).forEach(([property, content]) => {
      let meta = document.querySelector(`meta[property="${property}"]`)
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('property', property)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    })

    // Cleanup on unmount
    return () => {}
  }, [t])

  // ============================================================
  // LOAD STATS FROM API
  // ============================================================
  const loadStats = useCallback(async () => {
    try {
      const requests = [
        supabase.from('public_vendor_profiles').select('*', { count: 'exact', head: true }).eq('role', 'vendor'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_available', true).eq('approval_status', 'published'),
      ]

      // Orders are restricted to authenticated participants; skip the count for guests.
      if (user) {
        requests.push(supabase.from('orders').select('*', { count: 'exact', head: true }))
      }

      const [vendorsResult, productsResult, ordersResult] = await Promise.all(requests)

      // Get unique cities count from the public-safe vendor view
      const { data: citiesData } = await supabase
        .from('public_vendor_profiles')
        .select('city')
        .eq('role', 'vendor')
        .not('city', 'is', null)

      const uniqueCities = new Set(citiesData?.map(c => c.city).filter(Boolean) || [])

      setStats({
        vendors: vendorsResult.count || 0,
        products: productsResult.count || 0,
        cities: uniqueCities.size || 0,
        orders: ordersResult?.count || 0,
      })
    } catch (error) {
      logger.error('Error loading about stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section with Image */}
      <div className="relative mb-12 rounded-2xl overflow-hidden">
        <div className="aspect-[16/6] bg-gray-100">
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <img
            src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200"
            alt={t('about.hero.imageAlt', 'Fresh vegetables and fruits at a Moroccan marketplace')}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.parentElement.style.background = 'linear-gradient(135deg, #16a34a, #059669)'
              e.target.parentElement.style.minHeight = '16rem'
            }}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            {t('about.hero.title', 'About Qotoof')}
          </h1>
          <p className="text-lg text-white/90 max-w-2xl">
            {t('about.hero.subtitle', 'Connecting Moroccan farmers, wholesalers, and buyers through a modern digital marketplace')}
          </p>
        </div>
      </div>

      {/* Mission Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {t('about.mission.title', 'Our Mission')}
          </h2>
          <p className="text-gray-600 leading-relaxed">
            {t(
              'about.mission.description',
              'قطوف (Qotoof) هو السوق المغربي الأول للمنتجات الزراعية. نربط المزارعين المحليين والمنتجين مباشرة مع المشترين، مما يلغي الوسطاء ويضمن أسعاراً عادلة للجميع. تمنح منصتنا البائعين أدوات قوية لإدارة متاجرهم، مع توفير تجربة تسوق سلسة للمشترين وخدمات توصيل موثوقة.'
            )}
          </p>
        </div>
        <div className="rounded-2xl overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <img
            src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=600"
            alt={t('about.mission.imageAlt', 'Local Moroccan farmer harvesting fresh produce')}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.parentElement.style.background = 'linear-gradient(135deg, #16a34a, #059669)'
              e.target.parentElement.style.minHeight = '16rem'
            }}
          />
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        <StatCard
          label={t('about.stats.vendors', 'Active Vendors')}
          value={stats.vendors}
          suffix="+"
          loading={statsLoading}
        />
        <StatCard
          label={t('about.stats.products', 'Products')}
          value={stats.products}
          suffix="+"
          loading={statsLoading}
        />
        <StatCard
          label={t('about.stats.cities', 'Cities Covered')}
          value={stats.cities}
          suffix="+"
          loading={statsLoading}
        />
        <StatCard
          label={t('about.stats.orders', 'Orders Delivered')}
          value={stats.orders}
          suffix="+"
          loading={statsLoading}
        />
      </div>

      {/* How It Works */}
      <div className="card p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {t('about.howItWorks.title', 'How It Works')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShoppingBagIcon className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">
              {t('about.howItWorks.step1.title', 'Browse Products')}
            </h3>
            <p className="text-sm text-gray-500">
              {t('about.howItWorks.step1.desc', 'Explore thousands of fresh products from local vendors')}
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">
              {t('about.howItWorks.step2.title', 'Place Orders')}
            </h3>
            <p className="text-sm text-gray-500">
              {t('about.howItWorks.step2.desc', 'Add to cart and checkout with secure payment options')}
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <TruckIcon className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">
              {t('about.howItWorks.step3.title', 'Get Delivered')}
            </h3>
            <p className="text-sm text-gray-500">
              {t('about.howItWorks.step3.desc', 'Track your order and receive it at your doorstep')}
            </p>
          </div>
        </div>
      </div>

      {/* Values */}
      <div className="card p-8 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {t('about.values.title', 'Our Values')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-green-600 mb-2">
              🌱 {t('about.values.sustainability', 'Sustainability')}
            </h3>
            <p className="text-sm text-gray-600">
              {t('about.values.sustainabilityDesc', 'Supporting local agriculture and reducing food miles')}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-green-600 mb-2">
              🤝 {t('about.values.fairTrade', 'Fair Trade')}
            </h3>
            <p className="text-sm text-gray-600">
              {t('about.values.fairTradeDesc', 'Ensuring fair prices for farmers and buyers')}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-green-600 mb-2">
              ✅ {t('about.values.quality', 'Quality')}
            </h3>
            <p className="text-sm text-gray-600">
              {t('about.values.qualityDesc', 'Verified vendors and quality-checked products')}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-green-600 mb-2">
              🚚 {t('about.values.reliability', 'Reliability')}
            </h3>
            <p className="text-sm text-gray-600">
              {t('about.values.reliabilityDesc', 'On-time delivery with real-time tracking')}
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 p-8 sm:p-12 text-center text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
        <div className="relative">
          <h2 className="text-2xl font-bold mb-4">
            {t('about.cta.title', 'Ready to Get Started?')}
          </h2>
          <p className="text-green-100 mb-6 max-w-xl mx-auto">
            {t('about.cta.desc', 'Join thousands of vendors and buyers on Morocco\'s leading wholesale marketplace.')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register?role=vendor"
              className="btn-lg bg-white text-green-600 hover:bg-gray-50 shadow-xl rounded-2xl font-semibold inline-flex items-center gap-2"
            >
              {t('about.cta.becomeVendor', 'Become a Vendor')}
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
            <Link
              to="/marketplace"
              className="btn-lg bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 border-2 border-white/30 rounded-2xl font-semibold"
            >
              {t('about.cta.startBuying', 'Start Buying')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const AboutWithErrorBoundary = () => (
  <ErrorBoundary componentName="AboutPage">
    <About />
  </ErrorBoundary>
)

export default AboutWithErrorBoundary
