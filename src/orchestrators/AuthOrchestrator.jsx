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

import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const AUTH_SESSION_EXPIRED_EVENT = 'auth:sessionExpired';

export function useAuthOrchestrator() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const hasInitialized = useRef(false);
  const navigateRef = useRef(navigate);
  const locationRef = useRef(location);

  useEffect(() => {
    navigateRef.current = navigate;
    locationRef.current = location;
  }, [navigate, location]);

  // 1. Initialize auth and setup auth listener once.
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const { initialize, setupAuthListener } = useAuthStore.getState();
    initialize();
    const cleanup = setupAuthListener();

    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, []);

  // 2. Listen for a session-expired custom event and redirect to login.
  useEffect(() => {
    const handleSessionExpired = () => {
      const currentLocation = locationRef.current;
      if (currentLocation.pathname === '/login') return;

      navigateRef.current('/login?expired=true', {
        replace: true,
        state: { from: `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}` },
      });
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);
}
