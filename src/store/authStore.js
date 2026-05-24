import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createAuthActions } from '@/services/authActionsService'
import { createSessionActions, sessionInitialState } from '@/store/authSessionStore'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      session: null,
      loading: true,
      _signingInProgress: false,
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
