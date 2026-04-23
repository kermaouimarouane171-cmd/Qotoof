import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; connect-src 'self' https: wss:; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com blob:; font-src 'self' https://fonts.gstatic.com data:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
}

export default defineConfig({
  plugins: [
    react({
      fastRefresh: true,
      jsxRuntime: 'automatic',
    }),
    VitePWA({
      registerType: 'autoUpdate',
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
        clientsClaim: true,
        skipWaiting: true,
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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          const modulePath = id.split('node_modules/')[1]
          const packageName = modulePath.startsWith('@')
            ? modulePath.split('/').slice(0, 2).join('/')
            : modulePath.split('/')[0]

          // ── 1. React core ────────────────────────────────────────────────────────
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('/use-sync-external-store/')
          ) return 'vendor-react'

          // ── 2. Router ────────────────────────────────────────────────────────────
          if (id.includes('react-router') || id.includes('@remix-run')) return 'vendor-router'

          // ── 3. Supabase ──────────────────────────────────────────────────────────
          if (
            id.includes('@supabase') ||
            id.includes('/ws/') ||
            id.includes('cross-fetch')
          ) return 'vendor-supabase'

          // ── 4. Packages with internal circular deps → each gets its own chunk ───
          // These MUST NOT be grouped together — TDZ errors result from shared init
          if (id.includes('@react-pdf')) return 'chunk-react-pdf'
          if (id.includes('mammoth')) return 'chunk-mammoth'
          if (id.includes('xlsx') || id.includes('exceljs')) return 'chunk-excel'
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'chunk-pdf-export'
          if (id.includes('@sentry')) return 'chunk-sentry'
          if (id.includes('firebase')) return 'chunk-firebase'

          // ── 5. Split remaining ecosystem dependencies by domain ─────────────────
          if (['chart.js', 'react-chartjs-2', 'recharts'].includes(packageName)) return 'vendor-charts'
          if (['leaflet', 'react-leaflet'].includes(packageName)) return 'vendor-maps'
          if (['i18next', 'react-i18next', 'i18next-browser-languagedetector'].includes(packageName)) return 'vendor-i18n'
          if (['react-hook-form', '@hookform/resolvers'].includes(packageName)) return 'vendor-forms'
          if (packageName === '@tanstack/react-query') return 'vendor-query'
          if (['@heroicons/react', '@headlessui/react'].includes(packageName)) return 'vendor-ui-kit'
          if (['date-fns', 'zod', 'clsx', 'tailwind-merge'].includes(packageName)) return 'vendor-utils'
          if (['axios', 'algoliasearch', 'papaparse'].includes(packageName)) return 'vendor-data'

          // ── 6. Package-level fallback to avoid oversized generic vendor chunks ──
          return `vendor-${packageName.replace('@', '').replace('/', '-')}`
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
