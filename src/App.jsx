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

function App() {
  useAuthOrchestrator();
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

