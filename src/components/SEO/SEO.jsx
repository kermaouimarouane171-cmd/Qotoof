import { Helmet } from 'react-helmet-async'

const DEFAULT_SITE = 'قطوف – سوق المنتجات الطازجة'
const DEFAULT_DESC = 'اكتشف أفضل المنتجات الطازجة والعضوية من موردين موثوقين في سوق قطوف الإلكتروني.'
const DEFAULT_IMAGE = '/og-image.png'
const BASE_URL = import.meta.env.VITE_APP_URL || 'https://greenmarket-marketplace.web.app'

/**
 * SEO component – wraps react-helmet-async Helmet with defaults
 * 
 * @param {string} title        - Page title (appended to site name)
 * @param {string} description  - Meta description (155 chars max recommended)
 * @param {string} keywords     - Meta keywords
 * @param {string} image        - OG image URL (absolute or relative)
 * @param {string} url          - Canonical URL path
 * @param {string} type         - OG type ('website' | 'article' | 'product')
 * @param {boolean} noindex     - Set true for private/admin pages
 * @param {object} jsonLd       - JSON-LD structured data object
 */
export default function SEO({
  title,
  description = DEFAULT_DESC,
  keywords = '',
  image = DEFAULT_IMAGE,
  url = '',
  type = 'website',
  noindex = false,
  jsonLd = null
}) {
  const fullTitle = title ? `${title} | ${DEFAULT_SITE}` : DEFAULT_SITE
  const canonicalUrl = url ? `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}` : BASE_URL
  const absImage = image?.startsWith('http') ? image : `${BASE_URL}${image}`

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absImage} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={DEFAULT_SITE} />
      <meta property="og:locale" content="ar_MA" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absImage} />

      {/* Robots */}
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  )
}
