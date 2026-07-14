/**
 * @domain identity
 * @auth-required true (fetchProfile, getCurrentUser)
 */

export { fetchProfile } from '@/modules/users';

/** Returns the currently authenticated Supabase user, or null. */
export const getCurrentUser = () => useAuthStore.getState().user;

import { useAuthStore } from '@/store/authStore';
