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
  const { user, profile, loading } = useAuthStore();

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
    if (user?.id && pendingPhoneVerification?.userId === user.id && profile?.phone_verified) {
      clearPendingPhoneVerification();
    }
  }, [pendingPhoneVerification?.userId, profile?.phone_verified, user?.id]);

  const requiresPhoneVerification = Boolean(
    user?.id &&
    pendingPhoneVerification?.userId === user.id &&
    profile?.phone_verified !== true
  );

  // 3. Redirect to /verify-phone while phone verification is outstanding
  useEffect(() => {
    if (!requiresPhoneVerification) return;
    if (location.pathname !== '/verify-phone') {
      navigate('/verify-phone', { replace: true });
    }
  }, [location.pathname, navigate, requiresPhoneVerification]);

  // 4. Determine whether onboarding is required for the current user/role
  useEffect(() => {
    const role = profile?.role;
    const supportsOnboarding = ONBOARDING_ROLES.includes(role);

    if (loading) {
      setOnboardingResolved(false);
      return;
    }

    if (!user?.id || !supportsOnboarding) {
      setNeedsOnboarding(false);
      setOnboardingResolved(true);
      return;
    }

    let cancelled = false;
    setOnboardingResolved(false);

    checkOnboardingNeeded(user.id, role)
      .then((required) => { if (!cancelled) setNeedsOnboarding(required); })
      .catch(() => {
        if (!cancelled) setNeedsOnboarding(Boolean(profile && !profile.onboarding_completed));
      })
      .finally(() => { if (!cancelled) setOnboardingResolved(true); });

    return () => { cancelled = true; };
  }, [loading, profile?.onboarding_completed, profile?.role, user?.id, profile]); // profile added for completeness

  // 5. Redirect to/from the onboarding path based on resolved state
  useEffect(() => {
    const role = profile?.role;
    const supportsOnboarding = ONBOARDING_ROLES.includes(role);

    if (!user?.id || !supportsOnboarding || !onboardingResolved) return;

    const isOnboardingPath = location.pathname.startsWith('/onboarding');

    if (needsOnboarding) {
      const targetPath = getOnboardingPathForRole(role);
      if (targetPath && location.pathname !== targetPath) {
        navigate(targetPath, { replace: true });
      }
      return;
    }

    if (!needsOnboarding && isOnboardingPath) {
      navigate(getPostOnboardingPath(role), { replace: true });
    }
  }, [location.pathname, navigate, needsOnboarding, onboardingResolved, profile?.role, user?.id]);

  // Block rendering while phone verification or onboarding state is unresolved
  const shouldBlockForOnboarding = Boolean(
    user?.id &&
    ONBOARDING_ROLES.includes(profile?.role) &&
    (
      !onboardingResolved ||
      (needsOnboarding  && !location.pathname.startsWith('/onboarding')) ||
      (!needsOnboarding &&  location.pathname.startsWith('/onboarding'))
    )
  );

  const shouldBlockForPhoneVerification =
    requiresPhoneVerification && location.pathname !== '/verify-phone';

  return { isBlocking: shouldBlockForPhoneVerification || shouldBlockForOnboarding };
}
