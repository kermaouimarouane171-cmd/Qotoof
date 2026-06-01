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

function App() {
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

export default App;

