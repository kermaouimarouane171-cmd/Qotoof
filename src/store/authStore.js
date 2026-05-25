import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createAuthActions } from '@/services/authActionsService'
import { createSessionActions, sessionInitialState } from '@/store/authSessionStore'
import {
  clearPendingPhoneVerification,
  getPendingPhoneVerification,
  setPendingPhoneVerification,
} from '@/services/phoneOtpService'
import { setPendingAuthRedirect } from '@/utils/authRedirects'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      session: null,
      loading: true,
      _signingInProgress: false,
      setPendingPhoneVerification: (context) => setPendingPhoneVerification(context),
      getPendingPhoneVerification: () => getPendingPhoneVerification(),
      clearPendingPhoneVerification: () => clearPendingPhoneVerification(),
      setPostVerifyRedirect: (path) => setPendingAuthRedirect(path),
      ...sessionInitialState,
      ...createSessionActions(set, get),
      ...createAuthActions(set, get),
    }),
    {
      name: 'auth-store',
      partialize: () => ({}),
    }
  )
)
