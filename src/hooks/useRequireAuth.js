import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

/**
 * useRequireAuth — centralized hook for action-level auth checks.
 *
 * Returns:
 *   isAuthenticated {boolean}
 *   requireAuth({ from, onUnauthorized, preventNavigation }) {function}
 *     - Checks the current user from the auth store.
 *     - If unauthenticated, optionally calls onUnauthorized and/or navigates
 *       to /login with `state.from` preserved.
 *     - Returns true if authenticated, false otherwise.
 */
const useRequireAuth = () => {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)

  const isAuthenticated = Boolean(user)

  const requireAuth = useCallback(
    (options = {}) => {
      const { from, onUnauthorized, preventNavigation } = options

      if (user) return true

      if (typeof onUnauthorized === 'function') {
        onUnauthorized()
      }

      if (!preventNavigation) {
        navigate('/login', {
          state: { from: from || window.location.pathname },
        })
      }

      return false
    },
    [user, navigate]
  )

  return { isAuthenticated, requireAuth }
}

export default useRequireAuth
