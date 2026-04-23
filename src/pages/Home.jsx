import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/services/supabase'
import { ProductCard, MoroccoNotice } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useAuthStore } from '@/store/authStore'
import SEO from '@/components/SEO/SEO'
import {
  TruckIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ArrowRightIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'

const HomePage = () => {
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [stats, setStats] = useState({ products: 0, vendors: 0, orders: 0 })

  // SEO Meta Tags
  useEffect(() => {
    // Document title - uses i18n for language switching
    document.title = t('home.meta.title', 'قطوف - Qotoof | Morocco\'s #1 B2B Wholesale Marketplace for Fresh Produce')

    // Meta description
    let metaDescription = document.querySelector('meta[name="description"]')
    if (!metaDescription) {
      metaDescription = document.createElement('meta')
      metaDescription.name = 'description'
      document.head.appendChild(metaDescription)
    }
    metaDescription.content = t('home.meta.description', 'Connect directly with Moroccan farmers. Buy plants, vegetables & fruits in bulk at wholesale prices. Fast delivery nationwide.')

    // Open Graph tags
    const ogTags = {
      'og:title': t('home.meta.ogTitle', 'قطوف - Qotoof | B2B Wholesale Marketplace'),
      'og:description': t('home.meta.ogDescription', 'Connect directly with Moroccan farmers. Buy plants, vegetables & fruits in bulk.'),
      'og:type': 'website',
      'og:url': window.location.origin,
      'og:locale': 'ar_MA',
      'og:locale:alternate': 'fr_MA,en_US',
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

    // Twitter Card tags
    const twitterTags = {
      'twitter:card': 'summary_large_image',
      'twitter:title': t('home.meta.twitterTitle', 'قطوف - Qotoof | B2B Wholesale Marketplace'),
      'twitter:description': t('home.meta.twitterDescription', 'Connect directly with Moroccan farmers for wholesale produce.'),
    }

    Object.entries(twitterTags).forEach(([name, content]) => {
      let meta = document.querySelector(`meta[name="${name}"]`)
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', name)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    })

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', window.location.origin + '/')
  }, [])

  useEffect(() => {
    loadFeaturedProducts()
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
        logger.warn('Supabase not configured - using demo stats')
        setStats({ products: 0, vendors: 0, orders: 0 })
        return
      }

      const [{ count: productsCount }, { count: vendorsCount }, { count: ordersCount }] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_available', true).eq('approval_status', 'approved'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'vendor'),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
      ])
      setStats({
        products: productsCount || 0,
        vendors: vendorsCount || 0,
        orders: ordersCount || 0,
      })
    } catch (error) {
      logger.error('Error loading stats:', error)
      // Don't crash - stats will remain 0
      setStats({ products: 0, vendors: 0, orders: 0 })
    } finally {
      setStatsLoading(false)
    }
  }

  const loadFeaturedProducts = async () => {
    try {
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
        logger.warn('Supabase not configured - no products to load')
        setProducts([])
        return
      }

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images(url, is_primary)
        `)
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .limit(8)

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      logger.error('Error loading products:', error)
      setProducts([]) // Ensure empty array on error
    } finally {
      setLoading(false)
    }
  }
  
  const categories = [
    {
      id: 'plants',
      name: t('home.categories.plants'),
      emoji: '🌱',
      count: t('home.categories.items', { count: 2500 }),
      image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400'
    },
    {
      id: 'vegetables',
      name: t('home.categories.vegetables'),
      emoji: '🥬',
      count: t('home.categories.items', { count: 3200 }),
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400'
    },
    {
      id: 'fruits',
      name: t('home.categories.fruits'),
      emoji: '🍊',
      count: t('home.categories.items', { count: 1800 }),
      image: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400'
    },
    {
      id: 'herbs',
      name: t('home.categories.herbs'),
      emoji: '🌿',
      count: t('home.categories.items', { count: 900 }),
      image: 'https://images.unsplash.com/photo-1515586838455-8f8f940d6853?w=400'
    },
    {
      id: 'seeds',
      name: t('home.categories.seeds'),
      emoji: '🌰',
      count: t('home.categories.items', { count: 1200 }),
      image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400'
    },
  ]

  const features = [
    {
      icon: TruckIcon,
      title: t('home.features.directFromFarm.title'),
      description: t('home.features.directFromFarm.description'),
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      icon: CurrencyDollarIcon,
      title: t('home.features.wholesalePrices.title'),
      description: t('home.features.wholesalePrices.description'),
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      icon: ShieldCheckIcon,
      title: t('home.features.qualityVerified.title'),
      description: t('home.features.qualityVerified.description'),
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
    {
      icon: ClockIcon,
      title: t('home.features.fastDelivery.title'),
      description: t('home.features.fastDelivery.description'),
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
    },
  ]
  
  return (
    <div className="bg-white">
      <SEO
        title="الصفحة الرئيسية"
        description="اكتشف أفضل المنتجات الطازجة والعضوية من موردين موثوقين في قطوف – سوق المغرب الإلكتروني."
        keywords="سوق إلكتروني، منتجات طازجة، خضروات، فواكه، المغرب"
        url="/"
      />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}></div>
        </div>
        
        <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-10 right-20 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse delay-1000"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-6">
                <SparklesIcon className="w-4 h-4" />
                <span>{t('home.badge.text')}</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
                {t('home.hero.title')}
                <span className="block text-yellow-300">{t('home.hero.subtitle')}</span>
              </h1>

              <p className="text-lg sm:text-xl text-green-100 mb-8 max-w-xl mx-auto lg:mx-0">
                {t('home.hero.description')}
              </p>

              {/* Hero CTAs based on user state */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start px-2 sm:px-0">
                {!user ? (
                  // Not logged in
                  <>
                    <Link to="/marketplace" className="btn-lg bg-white text-green-600 hover:bg-gray-50 shadow-xl shadow-black/10 rounded-2xl font-semibold text-sm sm:text-base whitespace-nowrap">
                      {t('home.hero.cta')}
                      <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                    </Link>
                    <Link to="/register?role=vendor" className="btn-lg bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 border-2 border-white/30 rounded-2xl font-semibold text-sm sm:text-base whitespace-nowrap">
                      {t('home.hero.sellCta')}
                    </Link>
                  </>
                ) : profile?.role === 'vendor' ? (
                  // Already a vendor
                  <>
                    <Link to="/vendor/dashboard" className="btn-lg bg-white text-green-600 hover:bg-gray-50 shadow-xl shadow-black/10 rounded-2xl font-semibold text-sm sm:text-base whitespace-nowrap">
                      {t('home.hero.goToDashboard', 'Go to Dashboard')}
                      <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                    </Link>
                    <Link to="/vendor/products" className="btn-lg bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 border-2 border-white/30 rounded-2xl font-semibold text-sm sm:text-base whitespace-nowrap">
                      {t('home.hero.manageProducts', 'Manage Products')}
                    </Link>
                  </>
                ) : (
                  // Buyer or other role
                  <>
                    <Link to="/marketplace" className="btn-lg bg-white text-green-600 hover:bg-gray-50 shadow-xl shadow-black/10 rounded-2xl font-semibold text-sm sm:text-base whitespace-nowrap">
                      {t('home.hero.cta')}
                      <ArrowRightIcon className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                    </Link>
                    <Link to="/register?role=vendor" className="btn-lg bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 border-2 border-white/30 rounded-2xl font-semibold text-sm sm:text-base whitespace-nowrap">
                      {t('home.hero.becomeVendor', 'Become a Vendor')}
                    </Link>
                  </>
                )}
              </div>

              {/* Stats with loading state */}
              <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-white/20">
                <div className="text-center">
                  <div className="text-xl sm:text-2xl sm:text-3xl font-bold text-white min-h-[2rem] sm:min-h-[3rem] flex items-center justify-center">
                    {statsLoading ? (
                      <span className="inline-block w-12 sm:w-16 h-6 sm:h-8 bg-white/20 rounded animate-pulse"></span>
                    ) : stats.products > 0 ? (
                      stats.products.toLocaleString()
                    ) : (
                      '—'
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-green-200 mt-1">{t('home.stats.products')}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl sm:text-3xl font-bold text-white min-h-[2rem] sm:min-h-[3rem] flex items-center justify-center">
                    {statsLoading ? (
                      <span className="inline-block w-12 sm:w-16 h-6 sm:h-8 bg-white/20 rounded animate-pulse"></span>
                    ) : stats.vendors > 0 ? (
                      stats.vendors.toLocaleString()
                    ) : (
                      '—'
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-green-200 mt-1">{t('home.stats.vendors')}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl sm:text-2xl sm:text-3xl font-bold text-white min-h-[2rem] sm:min-h-[3rem] flex items-center justify-center">
                    {statsLoading ? (
                      <span className="inline-block w-12 sm:w-16 h-6 sm:h-8 bg-white/20 rounded animate-pulse"></span>
                    ) : stats.orders > 0 ? (
                      stats.orders.toLocaleString()
                    ) : (
                      '—'
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-green-200 mt-1">{t('home.stats.orders')}</div>
                </div>
              </div>
            </div>

            {/* Mobile hero image (single, shown only on mobile/tablet) */}
            <div className="lg:hidden order-2 mt-8">
              <div className="rounded-2xl overflow-hidden shadow-2xl mx-auto max-w-sm">
                {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                <img 
                  src="https://images.unsplash.com/photo-1546470427-e26264c9656a?w=600" 
                  alt={t('home.hero.images.freshProduce', 'Fresh produce from local farms')}
                  className="w-full h-48 sm:h-64 object-cover"
                  onError={(e) => { 
                    e.target.style.display = 'none'
                    e.target.parentElement.style.background = 'linear-gradient(135deg, #10b981, #059669)'
                    e.target.parentElement.style.minHeight = '12rem'
                  }} 
                />
              </div>
            </div>

            {/* Desktop image grid (hidden on mobile) */}
            <div className="hidden lg:grid grid-cols-2 gap-4 order-2">
              <div className="space-y-4">
                <div className="rounded-3xl overflow-hidden shadow-2xl transform hover:scale-105 transition-transform duration-500">
                  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                  <img src="https://images.unsplash.com/photo-1546470427-e26264c9656a?w=400" alt={t('home.hero.images.vegetables', 'Fresh vegetables')} className="w-full h-48 object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'linear-gradient(135deg, #10b981, #059669)'; e.target.parentElement.style.minHeight = '12rem'; }} />
                </div>
                <div className="rounded-3xl overflow-hidden shadow-2xl transform hover:scale-105 transition-transform duration-500">
                  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                  <img src="https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=400" alt={t('home.hero.images.plants', 'Plants and trees')} className="w-full h-64 object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'linear-gradient(135deg, #10b981, #059669)'; e.target.parentElement.style.minHeight = '16rem'; }} />
                </div>
              </div>
              <div className="space-y-4 pt-8">
                <div className="rounded-3xl overflow-hidden shadow-2xl transform hover:scale-105 transition-transform duration-500">
                  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                  <img src="https://images.unsplash.com/photo-1547514701-42782101795e?w=400" alt={t('home.hero.images.fruits', 'Fresh fruits')} className="w-full h-64 object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'linear-gradient(135deg, #10b981, #059669)'; e.target.parentElement.style.minHeight = '16rem'; }} />
                </div>
                <div className="rounded-3xl overflow-hidden shadow-2xl transform hover:scale-105 transition-transform duration-500">
                  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                  <img src="https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400" alt={t('home.hero.images.avocados', 'Avocados')} className="w-full h-48 object-cover" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.style.background = 'linear-gradient(135deg, #10b981, #059669)'; e.target.parentElement.style.minHeight = '12rem'; }} />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 50L48 45C96 40 192 30 288 35C384 40 480 60 576 65C672 70 768 60 864 50C960 40 1056 30 1152 35C1248 40 1344 60 1392 70L1440 80V100H0V50Z" fill="white"/>
          </svg>
        </div>
      </section>
      
      {/* Categories */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('home.categories.title')}</h2>
              <p className="text-gray-500 mt-1">{t('home.categories.subtitle')}</p>
            </div>
            <Link to="/marketplace" className="text-green-600 font-medium hover:underline flex items-center gap-1">
              {t('common.viewAll')}
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/marketplace?category=${category.id}`}
                className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="aspect-square overflow-hidden">
                  <img 
                    src={category.image} 
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="text-2xl mb-1">{category.emoji}</div>
                  <h3 className="text-white font-semibold">{category.name}</h3>
                  <p className="text-white/70 text-xs">{category.count} items</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      
      {/* Featured Products */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('home.products.featured')}</h2>
              <p className="text-gray-500 mt-1">{t('home.products.subtitle')}</p>
            </div>
            <Link to="/marketplace" className="text-green-600 font-medium hover:underline flex items-center gap-1">
              {t('home.products.seeAll')}
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card animate-pulse">
                  <div className="aspect-square bg-gray-200 rounded-t-2xl"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-gray-500">{t('home.products.noProducts')}</p>
              <Link to="/marketplace" className="btn-primary mt-4 inline-block">
                {t('home.products.browseMarketplace')}
              </Link>
            </div>
          )}
        </div>
      </section>
      
      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{t('home.features.title')}</h2>
            <p className="text-gray-500 max-w-2xl mx-auto">{t('home.features.subtitle')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="group p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <div className={`w-14 h-14 ${feature.iconBg} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-7 h-7 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Morocco Notice */}
          <div className="mb-8">
            <MoroccoNotice variant="default" />
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-green-600 to-emerald-600 p-8 sm:p-12 lg:p-16">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative text-center max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">
                {t('home.cta.readyToGrow')}
              </h2>
              <p className="text-lg text-green-100 mb-8">
                {t('home.cta.joinThousands')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/register?role=vendor" className="btn-lg bg-white text-green-600 hover:bg-gray-50 shadow-xl rounded-2xl font-semibold">
                  {t('home.cta.becomeVendor')}
                </Link>
                <Link to="/marketplace" className="btn-lg bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 border-2 border-white/30 rounded-2xl font-semibold">
                  {t('home.cta.startBuying')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">Q</span>
                </div>
                <span className="text-xl font-bold">قطوف - Qotoof</span>
              </div>
              <p className="text-gray-400 text-sm">
                {t('home.footer.description')}
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">{t('home.footer.marketplace')}</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/marketplace" className="hover:text-white transition-colors">{t('home.footer.allProducts')}</Link></li>
                <li><Link to="/marketplace?category=plants" className="hover:text-white transition-colors">{t('home.footer.plants')}</Link></li>
                <li><Link to="/marketplace?category=vegetables" className="hover:text-white transition-colors">{t('home.footer.vegetables')}</Link></li>
                <li><Link to="/marketplace?category=fruits" className="hover:text-white transition-colors">{t('home.footer.fruits')}</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">{t('home.footer.company')}</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/about" className="hover:text-white transition-colors">{t('home.footer.aboutUs')}</Link></li>
                <li><Link to="/register?role=vendor" className="hover:text-white transition-colors">{t('home.footer.becomeVendor')}</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">{t('home.footer.contact')}</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">{t('home.footer.support')}</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link to="/help" className="hover:text-white transition-colors">{t('home.footer.helpCenter')}</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">{t('home.footer.terms')}</Link></li>
                <li><Link to="/privacy" className="hover:text-white transition-colors">{t('home.footer.privacy')}</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">{t('home.footer.copyright', { year: new Date().getFullYear() })}</p>
            <div className="flex items-center gap-4">
              <a href="https://facebook.com/qotoof" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" aria-label="Facebook">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="https://instagram.com/qotoof" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" aria-label="Instagram">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
              <a href="https://wa.me/212522123456" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors" aria-label="WhatsApp">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const HomePageWithErrorBoundary = () => (
  <ErrorBoundary componentName="HomePage">
    <HomePage />
  </ErrorBoundary>
)

export default HomePageWithErrorBoundary
