import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0)
      return undefined
    }

    let isMounted = true

    const refreshUnreadCount = async () => {
      try {
        const count = await notificationsApi.getUnreadCount(user.id)
        if (!isMounted) return
        setUnreadCount(count)
        dispatchNotificationBadgeUpdate(count)
      } catch {
        if (isMounted) {
          setUnreadCount(0)
        }
      }
    }

    const loadPreferences = async () => {
      try {
        const data = await notificationsApi.getPreferences(user.id)
        if (isMounted) {
          setPreferences(normalizeNotificationPreferences(data))
        }
      } catch {
        if (isMounted) {
          setPreferences(DEFAULT_NOTIFICATION_PREFERENCES)
        }
      }
    }

    const handleBadgeUpdate = (event) => {
      if (!isMounted) return
      setUnreadCount(Number(event.detail?.unreadCount || 0))
    }

    const handlePreferencesUpdate = (event) => {
      if (!isMounted) return
      setPreferences(normalizeNotificationPreferences(event.detail?.preferences || {}))
    }

    window.addEventListener(notificationEvents.badge, handleBadgeUpdate)
    window.addEventListener(notificationEvents.preferences, handlePreferencesUpdate)

    refreshUnreadCount()
    loadPreferences()

    const unsubscribe = notificationsApi.subscribe(user.id, async ({ eventType, new: notification }) => {
      await refreshUnreadCount()

      if (
        eventType === 'INSERT' &&
        notification &&
        location.pathname !== '/notifications' &&
        !shouldMuteNotificationPreview(preferences, notification)
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
  }, [location.pathname, preferences, user?.id])

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