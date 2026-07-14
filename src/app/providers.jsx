/**
 * providers.jsx — App-level provider composition.
 *
 * This component encapsulates the global provider tree that wraps the
 * entire application. It is designed to be used in main.jsx:
 *
 *   <AppProviders>
 *     <App />
 *   </AppProviders>
 *
 * Currently, the provider tree lives inline in src/main.jsx.
 * This component is provided as a ready-to-use wrapper for future
 * migration. It is NOT yet used by main.jsx to avoid changing
 * bootstrapping behavior in Phase 1.2.
 *
 * Providers included:
 * - HelmetProvider (SEO/meta tags)
 * - BrowserRouter (client-side routing)
 * - ErrorBoundary (global error catch)
 *
 * Note: Sentry.ErrorBoundary, Toaster, and SkipLink remain in main.jsx
 * because they are tightly coupled to the bootstrap process (Sentry init,
 * SW registration toast, etc.). They will be migrated in a later phase.
 */

import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter } from 'react-router-dom'
import ErrorBoundary from '@/components/ErrorBoundary'

export function AppProviders({ children }) {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </BrowserRouter>
    </HelmetProvider>
  )
}

export default AppProviders
