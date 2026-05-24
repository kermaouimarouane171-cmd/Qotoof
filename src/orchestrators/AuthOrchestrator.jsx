/**
 * AuthOrchestrator — auth initialization and session lifecycle.
 *
 * Responsibilities:
 *   1. Bootstrap Supabase auth (initialize + subscribe to auth state changes)
 *   2. Redirect to /login when a session-expired event fires
 *
 * Usage: call `useAuthOrchestrator()` once, at the top of App.jsx.
 * This is a logic-only hook — no JSX is rendered here.
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const AUTH_SESSION_EXPIRED_EVENT = 'auth:sessionExpired';

export function useAuthOrchestrator() {
  const navigate  = useNavigate();
  const location  = useLocation();

  // 1. Initialize the auth session and subscribe to subsequent auth changes.
  useEffect(() => {
    let cleanup;
    const { initialize, setupAuthListener } = useAuthStore.getState();
    initialize().then(() => {
      cleanup = setupAuthListener();
    });
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, []);

  // 2. Listen for a session-expired custom event and redirect to login.
  useEffect(() => {
    const handleSessionExpired = () => {
      if (location.pathname === '/login') return;
      navigate('/login?expired=true', {
        replace: true,
        state: { from: `${location.pathname}${location.search}${location.hash}` },
      });
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [location.hash, location.pathname, location.search, navigate]);
}
