/**
 * @domain identity
 * @side-effects Supabase auth state mutation; writes to `profiles` table
 * @auth-required false (signIn/signUp), true (signOut, OTP)
 */

import { useAuthStore } from '@/store/authStore';
export { sendPhoneOTP, verifyPhoneOTP } from '@/services/phoneOtpService';

/** Sign in with email + password. */
export const signIn  = (email, password) => useAuthStore.getState().signIn(email, password);

/** Sign out the current user. */
export const signOut = ()                => useAuthStore.getState().signOut();
