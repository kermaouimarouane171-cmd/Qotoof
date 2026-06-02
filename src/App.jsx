/**
 * App.jsx — root composition layer.
 *
 * Responsibilities (this file only):
 *   1. Bootstrap auth via useAuthOrchestrator()
 *   2. Provide the TanStack Query client
 *   3. Render the route tree via <AppRouter />
 *
 * Routing lives in:      src/router/AppRouter.jsx
 * Auth lifecycle lives in: src/orchestrators/AuthOrchestrator.jsx
 * Onboarding gate lives in: src/orchestrators/OnboardingOrchestrator.jsx
 */

import { QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from '@/components/ErrorBoundary';
import queryClient from '@/services/queryClient';
import { useAuthOrchestrator } from '@/orchestrators/AuthOrchestrator';
import { AppRouter } from '@/router/AppRouter';
import { isSupabaseConfigured, supabaseConfigError } from '@/services/supabase';

function ConfigErrorPage({ message }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full rounded-lg bg-white p-6 shadow-lg">
        <h1 className="mb-4 text-xl font-bold text-red-600">Configuration Error</h1>
        <p className="mb-4 text-gray-700">{message}</p>
        <p className="text-sm text-gray-500">Please check your environment variables and restart the dev server.</p>
      </div>
    </div>
  );
}

function ErrorButton() {
  return (
    <button
      onClick={() => {
        throw new Error('This is your first error!');
      }}
      className="fixed bottom-4 right-4 z-50 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-red-700"
      type="button"
    >
      Break the world
    </button>
  );
}

function AuthenticatedApp() {
  useAuthOrchestrator();
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
        {import.meta.env.DEV && <ErrorButton />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function App() {
  if (!isSupabaseConfigured) {
    return <ConfigErrorPage message={supabaseConfigError || 'Supabase is not configured correctly. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'} />;
  }

  return <AuthenticatedApp />;
}

export default App;

