/**
 * OnboardingOrchestrator — phone verification gate + onboarding redirect logic.
 *
 * Responsibilities:
 *   1. Sync `pendingPhoneVerification` state from localStorage on custom events
 *   2. Clear the pending record once the user's phone is confirmed
 *   3. Redirect to /verify-phone while phone verification is outstanding
 *   4. Query `checkOnboardingNeeded` and redirect to the role-specific onboarding path
 *   5. Redirect away from /onboarding/* once onboarding is complete
 *
 * Usage: call `useOnboardingGate()` inside `ProtectedRoute`.
 * Returns `{ isBlocking: boolean }` — render a loading fallback while true.
 * This is a logic-only hook — no JSX is rendered here.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { USER_ROLES } from '@/constants/roles';
import {
  checkOnboardingNeeded,
  getOnboardingPathForRole,
  getPostOnboardingPath,
} from '@/services/onboardingService';
import {
  clearPendingPhoneVerification,
  getPendingPhoneVerification,
  PHONE_VERIFICATION_EVENT,
} from '@/services/phoneOtpService';

const ONBOARDING_ROLES = [USER_ROLES.BUYER, USER_ROLES.VENDOR, USER_ROLES.DRIVER];

export function useOnboardingGate() {
  const navigate = useNavigate();
  const location = useLocation();

  // Select only primitives — avoids re-running effects when Zustand creates
  // a new `profile` object reference for unrelated state changes (e.g. deviceFingerprint).
  const userId              = useAuthStore((s) => s.user?.id);
  const loading             = useAuthStore((s) => s.loading);
  const profileRole         = useAuthStore((s) => s.profile?.role);
  const onboardingCompleted = useAuthStore((s) => s.profile?.onboarding_completed);
  const phoneVerified       = useAuthStore((s) => s.profile?.phone_verified);
  // profileError: set to true by fetchProfile when the DB/network call fails.
  // When true the profile will never arrive — stop blocking to avoid a
  // permanent white-screen spinner.
  const profileError        = useAuthStore((s) => s.profileError);

  // Kept as full objects only where identity comparison is intentional:
  const user    = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);

  const [pendingPhoneVerification, setPendingPhoneVerification] = useState(
    () => getPendingPhoneVerification()
  );
  const [onboardingResolved, setOnboardingResolved] = useState(false);
  const [needsOnboarding,    setNeedsOnboarding]    = useState(false);

  // 1. Keep pendingPhoneVerification in sync with localStorage
  useEffect(() => {
    const sync = () => setPendingPhoneVerification(getPendingPhoneVerification());
    window.addEventListener(PHONE_VERIFICATION_EVENT, sync);
    return () => window.removeEventListener(PHONE_VERIFICATION_EVENT, sync);
  }, []);

  // 2. Clear pending phone verification once the user's phone is confirmed
  useEffect(() => {
    if (userId && pendingPhoneVerification?.userId === userId && phoneVerified) {
      clearPendingPhoneVerification();
    }
  }, [pendingPhoneVerification?.userId, phoneVerified, userId]);

  const requiresPhoneVerification = Boolean(
    userId &&
    pendingPhoneVerification?.userId === userId &&
    phoneVerified !== true
  );

  // 3. Redirect to /verify-phone while phone verification is outstanding
  useEffect(() => {
    if (!requiresPhoneVerification) return;
    if (location.pathname !== '/verify-phone') {
      navigate('/verify-phone', { replace: true });
    }
  }, [location.pathname, navigate, requiresPhoneVerification]);

  // 4. Determine whether onboarding is required for the current user/role
  // IMPORTANT: only depend on primitive Zustand-selector values, NOT the full `profile`
  // object — Zustand creates a new object reference on every store update (even for
  // unrelated fields like `deviceFingerprint`), which would re-trigger this effect
  // endlessly and cause an infinite loading-spinner loop.
  useEffect(() => {
    const supportsOnboarding = ONBOARDING_ROLES.includes(profileRole);

    if (loading) {
      setOnboardingResolved(false);
      return;
    }

    if (!userId || !supportsOnboarding) {
      setNeedsOnboarding(false);
      setOnboardingResolved(true);
      return;
    }

    let cancelled = false;
    let timeoutId = null;
    setOnboardingResolved(false);

    const onboardingPromise = checkOnboardingNeeded(userId, profileRole);
    const timeoutPromise = new Promise((resolve) => {
      timeoutId = setTimeout(() => resolve('timeout'), 5000);
    });

    Promise.race([onboardingPromise, timeoutPromise])
      .then((result) => {
        if (cancelled) return;
        if (result === 'timeout') {
          setNeedsOnboarding(!onboardingCompleted);
        } else {
          setNeedsOnboarding(result);
        }
      })
      .catch(() => {
        if (!cancelled) setNeedsOnboarding(!onboardingCompleted);
      })
      .finally(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (!cancelled) setOnboardingResolved(true);
      });

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, onboardingCompleted, profileRole, userId]);

  // 5. Redirect to/from the onboarding path based on resolved state
  useEffect(() => {
    const supportsOnboarding = ONBOARDING_ROLES.includes(profileRole);

    if (!userId || !supportsOnboarding || !onboardingResolved) return;

    const isOnboardingPath = location.pathname.startsWith('/onboarding');

    if (needsOnboarding) {
      const targetPath = getOnboardingPathForRole(profileRole);
      if (targetPath && location.pathname !== targetPath) {
        navigate(targetPath, { replace: true });
      }
      return;
    }

    if (!needsOnboarding && isOnboardingPath) {
      navigate(getPostOnboardingPath(profileRole), { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, navigate, needsOnboarding, onboardingResolved, profileRole, userId]);

  // Block rendering while phone verification or onboarding state is unresolved.
  // Also block when user is authenticated but profile hasn't loaded yet —
  // this prevents ProtectedRoute from doing a premature /unauthorized redirect
  // before the profile (and role) has been fetched from Supabase.
  // Do NOT block when profileError=true: the profile fetch has permanently
  // failed (e.g. RLS error, network down) so we must let the app render
  // rather than spinning forever on a white screen.
  const profileNotYetLoaded = Boolean(userId && !profile && !loading && !profileError);

  const isAuthEntryPath = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname)

  const shouldBlockForOnboarding = profileNotYetLoaded || Boolean(
    userId &&
    ONBOARDING_ROLES.includes(profileRole) &&
    !isAuthEntryPath &&
    (
      !onboardingResolved ||
      (needsOnboarding && !location.pathname.startsWith('/onboarding')) ||
      (!needsOnboarding && location.pathname.startsWith('/onboarding'))
    )
  );

  const shouldBlockForPhoneVerification =
    requiresPhoneVerification && location.pathname !== '/verify-phone';

  return { isBlocking: shouldBlockForPhoneVerification || shouldBlockForOnboarding };
}
