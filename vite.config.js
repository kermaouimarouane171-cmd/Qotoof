import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const getPackageName = (id) => {
  const modulePath = id.split('node_modules/')[1]
  if (!modulePath) return ''

  return modulePath.startsWith('@')
    ? modulePath.split('/').slice(0, 2).join('/')
    : modulePath.split('/')[0]
}

const matchesPackage = (packageName, packages) => packages.includes(packageName)

const matchesPrefix = (packageName, prefixes) => (
  prefixes.some((prefix) => packageName === prefix || packageName.startsWith(`${prefix}/`))
)

const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; connect-src 'self' https: wss:; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com blob:; font-src 'self' https://fonts.gstatic.com data:; frame-src 'self' https://www.google.com https://www.gstatic.com; child-src 'self' https://www.google.com https://www.gstatic.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
}

export default defineConfig({
  plugins: [
    react({
      fastRefresh: true,
      jsxRuntime: 'automatic',
    }),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Qotoof - B2B Plant Marketplace',
        short_name: 'Qotoof',
        description: 'Wholesale marketplace for plants, vegetables, and fruits in Morocco',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/?source=pwa',
        categories: ['shopping', 'business', 'food'],
        icons: [
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Navigate fallback for SPA
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//],
        // Cleanup old caches on update
        cleanupOutdatedCaches: true,
        // Skip waiting and claim clients for immediate updates
        clientsClaim: false,
        skipWaiting: false,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      // Auto-register service worker
      devOptions: {
        enabled: false, // Disable in development
        type: 'module',
      },
    }),
    visualizer({
      open: false,
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js', 'zustand'],
  },
  server: {
    port: 3000,
    open: true,
    cors: true,
    headers: securityHeaders,
    hmr: { overlay: true },
    watch: {
      ignored: ['**/cypress/screenshots/**', '**/cypress/videos/**', '**/cypress/downloads/**'],
    },
  },
  logLevel: 'info',
  preview: {
    port: 4173,
    open: true,
    cors: true,
    headers: securityHeaders,
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: { drop_debugger: true, dead_code: true, unused: true, passes: 2 },
      output: { comments: false },
    },
    sourcemap: false,
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          const packageName = getPackageName(id)
          if (!packageName) return undefined

          // ── 1. React core ────────────────────────────────────────────────────────
          if (matchesPackage(packageName, ['react', 'react-dom', 'scheduler', 'use-sync-external-store'])) {
            return 'vendor-react'
          }

          // ── 2. Router ────────────────────────────────────────────────────────────
          if (matchesPackage(packageName, ['react-router', 'react-router-dom']) || matchesPrefix(packageName, ['@remix-run'])) {
            return 'vendor-router'
          }

          // ── 3. Supabase ──────────────────────────────────────────────────────────
          if (matchesPrefix(packageName, ['@supabase']) || matchesPackage(packageName, ['ws', 'cross-fetch'])) {
            return 'vendor-supabase'
          }

          // ── 4. Packages with internal circular deps → each gets its own chunk ───
          // These MUST NOT be grouped together — TDZ errors result from shared init
          if (matchesPrefix(packageName, ['@react-pdf']) || matchesPackage(packageName, ['fontkit', 'unicode-properties', 'dfa', 'clone', 'yoga-layout', 'bidi-js'])) {
            return 'chunk-react-pdf'
          }
          if (matchesPackage(packageName, ['mammoth'])) return 'chunk-mammoth'
          if (matchesPackage(packageName, ['xlsx', 'exceljs', 'jszip'])) return 'chunk-excel'
          if (matchesPackage(packageName, ['jspdf', 'html2canvas', 'canvg', 'stackblur-canvas', 'rgbcolor', 'svg-pathdata', 'abs-svg-path', 'parse-svg-path', 'normalize-svg-path', 'svg-arc-to-cubic-bezier'])) {
            return 'chunk-pdf-export'
          }
          if (matchesPrefix(packageName, ['@sentry', '@sentry-internal'])) return 'chunk-sentry'
          if (matchesPackage(packageName, ['firebase']) || matchesPrefix(packageName, ['@firebase'])) return 'chunk-firebase'

          // ── 5. Split remaining ecosystem dependencies by domain ─────────────────
          if (
            matchesPackage(packageName, ['chart.js', 'react-chartjs-2', 'recharts', 'recharts-scale', 'victory-vendor', 'internmap', '@kurkle/color']) ||
            packageName.startsWith('d3-')
          ) return 'vendor-charts'

          if (matchesPackage(packageName, ['leaflet', 'react-leaflet', '@react-leaflet/core'])) return 'vendor-maps'

          if (matchesPackage(packageName, ['i18next', 'react-i18next', 'i18next-browser-languagedetector'])) return 'vendor-i18n'

          if (matchesPackage(packageName, ['react-hook-form', '@hookform/resolvers'])) return 'vendor-forms'

          if (matchesPrefix(packageName, ['@tanstack'])) return 'vendor-query'

          if (
            matchesPackage(packageName, ['react-transition-group', 'dom-helpers', 'tabbable', 'react-aria', 'react-stately']) ||
            matchesPrefix(packageName, ['@heroicons', '@headlessui', '@floating-ui', '@react-aria', '@react-stately'])
          ) return 'vendor-ui-kit'

          if (matchesPackage(packageName, ['zustand'])) return 'vendor-state'

          if (
            matchesPackage(packageName, [
              'goober',
              'react-hot-toast',
              'react-helmet-async',
              'react-error-boundary',
              'react-google-recaptcha',
              'react-async-script',
              'react-infinite-scroll-component',
              'react-fast-compare',
              'invariant',
              'shallowequal',
              'hoist-non-react-statics',
              'prop-types',
              'react-is',
              'iceberg-js',
              'dompurify'
            ])
          ) return 'vendor-client'

          if (matchesPackage(packageName, ['date-fns', 'zod', 'clsx', 'tailwind-merge', 'lodash', 'underscore', 'tslib', 'void-elements', 'html-parse-stringify', 'is-url', 'emoji-regex'])) {
            return 'vendor-utils'
          }

          if (matchesPackage(packageName, ['axios', 'algoliasearch', 'papaparse']) || matchesPrefix(packageName, ['@algolia'])) {
            return 'vendor-data'
          }

          // ── 5b. Payment SDKs ────────────────────────────────────────────────────────
          if (matchesPackage(packageName, ['@paypal/react-paypal-js']) || matchesPrefix(packageName, ['@paypal'])) {
            return 'vendor-payments'
          }

          // ── 6. Split remainder to avoid a single oversized vendor-misc chunk ──
          // Packages are split alphabetically so shared deps tend to stay together
          // while the total chunk size is reduced for better caching.
          const firstChar = packageName.charCodeAt(0)
          if (firstChar <= 109) return 'vendor-misc'
          return 'vendor-misc-2'
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        compact: true,
      },
    },
    commonjsOptions: { transformMixedEsModules: true },
  },
  css: { devSourcemap: false },
  json: { namedExports: true, stringify: true },
  esbuild: {
    drop: ['debugger'],
    legalComments: 'none',
    target: 'es2020',
  },
})
