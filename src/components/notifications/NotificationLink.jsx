import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BellIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  dispatchNotificationBadgeUpdate,
  normalizeNotificationPreferences,
  notificationEvents,
  notificationsApi,
  shouldMuteNotificationPreview,
} from '@/services/notifications'

const DEFAULT_LINK_CLASSNAME = 'relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
const DEFAULT_BADGE_CLASSNAME = 'absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1'

export default function NotificationLink({
  className = DEFAULT_LINK_CLASSNAME,
  iconClassName = 'w-5 h-5',
  badgeClassName = DEFAULT_BADGE_CLASSNAME,
  ariaLabel = 'الإشعارات',
}) {
  const location = useLocation()
  const { user } = useAuthStore()
  const [unreadCount, setUnreadCount] = useState(0)
  const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES)
  const unreadCountRef = useRef(0)
  const preferencesRef = useRef(DEFAULT_NOTIFICATION_PREFERENCES)
  const pathnameRef = useRef(location.pathname)
  const refreshPromiseRef = useRef(null)
  const lastRefreshAtRef = useRef(0)

  useEffect(() => {
    pathnameRef.current = location.pathname
  }, [location.pathname])

  useEffect(() => {
    if (!user?.id) {
      unreadCountRef.current = 0
      setUnreadCount(0)
      return undefined
    }

    let isMounted = true

    const updateUnreadCount = (count, forceDispatch = false) => {
      const nextCount = Number(count || 0)
      const shouldDispatch = forceDispatch || nextCount !== unreadCountRef.current
      unreadCountRef.current = nextCount

      if (!isMounted) return nextCount

      setUnreadCount(nextCount)
      if (shouldDispatch) {
        dispatchNotificationBadgeUpdate(nextCount)
      }

      return nextCount
    }

    const refreshUnreadCount = async (force = false) => {
      const now = Date.now()

      if (!force && refreshPromiseRef.current) {
        return refreshPromiseRef.current
      }

      if (!force && now - lastRefreshAtRef.current < 1500) {
        return unreadCountRef.current
      }

      try {
        refreshPromiseRef.current = notificationsApi.getUnreadCount(user.id)
        const count = await refreshPromiseRef.current
        lastRefreshAtRef.current = Date.now()
        return updateUnreadCount(count, force)
      } catch {
        return updateUnreadCount(0, force)
      } finally {
        refreshPromiseRef.current = null
      }
    }

    const loadPreferences = async () => {
      try {
        const data = await notificationsApi.getPreferences(user.id)
        const normalizedPreferences = normalizeNotificationPreferences(data)
        if (isMounted) {
          preferencesRef.current = normalizedPreferences
          setPreferences(normalizedPreferences)
        }
      } catch {
        if (isMounted) {
          preferencesRef.current = DEFAULT_NOTIFICATION_PREFERENCES
          setPreferences(DEFAULT_NOTIFICATION_PREFERENCES)
        }
      }
    }

    const handleBadgeUpdate = (event) => {
      if (!isMounted) return
      updateUnreadCount(event.detail?.unreadCount, false)
    }

    const handlePreferencesUpdate = (event) => {
      if (!isMounted) return
      const normalizedPreferences = normalizeNotificationPreferences(event.detail?.preferences || {})
      preferencesRef.current = normalizedPreferences
      setPreferences(normalizedPreferences)
    }

    window.addEventListener(notificationEvents.badge, handleBadgeUpdate)
    window.addEventListener(notificationEvents.preferences, handlePreferencesUpdate)

    refreshUnreadCount(true)
    loadPreferences()

    const unsubscribe = notificationsApi.subscribe(user.id, async ({ eventType, new: notification }) => {
      await refreshUnreadCount()

      if (
        eventType === 'INSERT' &&
        notification &&
        pathnameRef.current !== '/notifications' &&
        !shouldMuteNotificationPreview(preferencesRef.current, notification)
      ) {
        toast(notification.message || notification.title || 'إشعار جديد')
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
      window.removeEventListener(notificationEvents.badge, handleBadgeUpdate)
      window.removeEventListener(notificationEvents.preferences, handlePreferencesUpdate)
    }
  }, [user?.id])

  if (!user) return null

  return (
    <Link to="/notifications" className={className} aria-label={ariaLabel}>
      <BellIcon className={iconClassName} />
      {unreadCount > 0 && (
        <span className={badgeClassName}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}