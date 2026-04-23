import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  ArchiveBoxIcon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ClockIcon,
  Cog6ToothIcon,
  CubeIcon,
  FireIcon,
  GiftIcon,
  InformationCircleIcon,
  ShoppingBagIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  StarIcon,
  TrashIcon,
  TruckIcon,
  CreditCardIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import { Card, LoadingSpinner } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useAuthStore } from '@/store/authStore'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORY_OPTIONS,
  NOTIFICATION_PREFERENCE_FIELDS,
  dispatchNotificationBadgeUpdate,
  isWithinQuietHours,
  notificationsApi,
  normalizeNotificationPreferences,
} from '@/services/notifications'

const NOTIFICATIONS_PER_PAGE = 20

const CATEGORY_STYLES = {
  order_update: {
    label: 'الطلبات',
    icon: ShoppingBagIcon,
    iconColor: 'text-blue-600',
    bgColor: 'bg-blue-100',
    chipColor: 'bg-blue-50 text-blue-700',
  },
  payment: {
    label: 'المدفوعات',
    icon: CreditCardIcon,
    iconColor: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    chipColor: 'bg-emerald-50 text-emerald-700',
  },
  delivery: {
    label: 'التوصيل',
    icon: TruckIcon,
    iconColor: 'text-orange-600',
    bgColor: 'bg-orange-100',
    chipColor: 'bg-orange-50 text-orange-700',
  },
  review: {
    label: 'التقييمات',
    icon: StarIcon,
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-100',
    chipColor: 'bg-amber-50 text-amber-700',
  },
  loyalty: {
    label: 'الولاء',
    icon: GiftIcon,
    iconColor: 'text-pink-600',
    bgColor: 'bg-pink-100',
    chipColor: 'bg-pink-50 text-pink-700',
  },
  promotion: {
    label: 'العروض',
    icon: TagIcon,
    iconColor: 'text-fuchsia-600',
    bgColor: 'bg-fuchsia-100',
    chipColor: 'bg-fuchsia-50 text-fuchsia-700',
  },
  inventory: {
    label: 'المخزون',
    icon: CubeIcon,
    iconColor: 'text-lime-600',
    bgColor: 'bg-lime-100',
    chipColor: 'bg-lime-50 text-lime-700',
  },
  message: {
    label: 'الرسائل',
    icon: ChatBubbleLeftRightIcon,
    iconColor: 'text-violet-600',
    bgColor: 'bg-violet-100',
    chipColor: 'bg-violet-50 text-violet-700',
  },
  system: {
    label: 'النظام',
    icon: InformationCircleIcon,
    iconColor: 'text-slate-600',
    bgColor: 'bg-slate-100',
    chipColor: 'bg-slate-100 text-slate-700',
  },
}

const PRIORITY_STYLES = {
  high: 'bg-red-50 text-red-700',
  urgent: 'bg-red-100 text-red-800',
  normal: 'bg-gray-100 text-gray-600',
  low: 'bg-gray-50 text-gray-500',
}

const mergeNotifications = (currentNotifications, nextNotifications) => {
  const seenIds = new Set(currentNotifications.map((notification) => notification.id))
  const uniqueNotifications = nextNotifications.filter((notification) => !seenIds.has(notification.id))
  return [...currentNotifications, ...uniqueNotifications]
}

const groupNotificationsByDate = (notifications, t) => {
  const groups = {}
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  notifications.forEach((notification) => {
    const notificationDate = new Date(notification.created_at)
    let label = t('notifications.groups.older', 'أقدم')

    if (notificationDate.toDateString() === today.toDateString()) {
      label = t('notifications.groups.today', 'اليوم')
    } else if (notificationDate.toDateString() === yesterday.toDateString()) {
      label = t('notifications.groups.yesterday', 'أمس')
    } else if (notificationDate > weekAgo) {
      label = t('notifications.groups.thisWeek', 'هذا الأسبوع')
    } else {
      label = notificationDate.toLocaleDateString('ar-MA', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }

    if (!groups[label]) {
      groups[label] = []
    }

    groups[label].push(notification)
  })

  return groups
}

const Toggle = ({ checked, onChange, label, description }) => (
  <label className="flex items-start justify-between gap-4 py-3 cursor-pointer">
    <div>
      <p className="text-sm font-medium text-gray-900">{label}</p>
      {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-green-600' : 'bg-gray-300'}`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </label>
)

const NotificationPreferencesPanel = ({
  preferences,
  setPreferences,
  savingPreferences,
  onSave,
  t,
}) => {
  const quietHoursActive = isWithinQuietHours(preferences)

  return (
    <Card className="p-6 mb-6 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t('notifications.preferences.title', 'تفضيلات الإشعارات')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {t('notifications.preferences.subtitle', 'اختر القنوات والفئات التي تريد استلامها، واضبط ساعات الهدوء للتنبيهات الفورية.')}
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${quietHoursActive ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
          {quietHoursActive ? <SpeakerXMarkIcon className="w-4 h-4" /> : <SpeakerWaveIcon className="w-4 h-4" />}
          {quietHoursActive
            ? t('notifications.preferences.quietHoursActive', 'ساعات الهدوء مفعلة الآن')
            : t('notifications.preferences.quietHoursInactive', 'التنبيهات الفورية نشطة')}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-5 border border-gray-100 shadow-none">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            {t('notifications.preferences.channels', 'قنوات الإشعار')}
          </h3>
          <div className="divide-y divide-gray-100">
            <Toggle
              checked={preferences.in_app_enabled}
              onChange={(value) => setPreferences((current) => ({ ...current, in_app_enabled: value }))}
              label={t('notifications.preferences.inApp', 'داخل التطبيق')}
              description={t('notifications.preferences.inAppDesc', 'تظهر في مركز الإشعارات وتتحكم كذلك في التنبيهات اللحظية.')}
            />
            <Toggle
              checked={preferences.email_enabled}
              onChange={(value) => setPreferences((current) => ({ ...current, email_enabled: value }))}
              label={t('notifications.preferences.email', 'البريد الإلكتروني')}
              description={t('notifications.preferences.emailDesc', 'يُستخدم عندما تتوفر قناة بريد لنوع الإشعار.')}
            />
            <Toggle
              checked={preferences.sms_enabled}
              onChange={(value) => setPreferences((current) => ({ ...current, sms_enabled: value }))}
              label={t('notifications.preferences.sms', 'الرسائل النصية')}
              description={t('notifications.preferences.smsDesc', 'للإشعارات الحرجة فقط عند توفر تكامل SMS.')}
            />
          </div>
        </Card>

        <Card className="p-5 border border-gray-100 shadow-none">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            {t('notifications.preferences.quietHours', 'ساعات الهدوء')}
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            {t('notifications.preferences.quietHoursDesc', 'تؤثر على التنبيهات الفورية والـ toast فقط. تبقى الإشعارات محفوظة داخل المركز.')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                {t('notifications.preferences.quietStart', 'من')}
              </span>
              <input
                type="time"
                value={preferences.quiet_hours_start || ''}
                onChange={(event) => setPreferences((current) => ({ ...current, quiet_hours_start: event.target.value || null }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                {t('notifications.preferences.quietEnd', 'إلى')}
              </span>
              <input
                type="time"
                value={preferences.quiet_hours_end || ''}
                onChange={(event) => setPreferences((current) => ({ ...current, quiet_hours_end: event.target.value || null }))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setPreferences((current) => ({ ...current, quiet_hours_start: null, quiet_hours_end: null }))}
            className="mt-4 text-sm text-gray-500 hover:text-gray-700"
          >
            {t('notifications.preferences.clearQuietHours', 'إلغاء ساعات الهدوء')}
          </button>
        </Card>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          {t('notifications.preferences.categories', 'فئات الإشعارات')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {NOTIFICATION_PREFERENCE_FIELDS.map((field) => (
            <Card key={field.key} className="p-4 border border-gray-100 shadow-none">
              <Toggle
                checked={preferences[field.key]}
                onChange={(value) => setPreferences((current) => ({ ...current, [field.key]: value }))}
                label={field.label}
              />
            </Card>
          ))}
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          type="button"
          onClick={onSave}
          disabled={savingPreferences}
          className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
        >
          {savingPreferences ? (
            <>
              <LoadingSpinner size="sm" />
              {t('notifications.preferences.saving', 'جارٍ الحفظ...')}
            </>
          ) : (
            <>
              <CheckIcon className="w-4 h-4" />
              {t('notifications.preferences.save', 'حفظ التفضيلات')}
            </>
          )}
        </button>
      </div>
    </Card>
  )
}

const Notifications = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const observerTarget = useRef(null)

  const [notifications, setNotifications] = useState([])
  const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showPreferences, setShowPreferences] = useState(false)

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) return
    const count = await notificationsApi.getUnreadCount(user.id)
    setUnreadCount(count)
    dispatchNotificationBadgeUpdate(count)
  }, [user?.id])

  const loadPreferences = useCallback(async () => {
    if (!user?.id) return
    const data = await notificationsApi.getPreferences(user.id)
    setPreferences(normalizeNotificationPreferences(data))
  }, [user?.id])

  const loadNotifications = useCallback(async (pageNumber = 1, append = false) => {
    if (!user?.id) return

    try {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      const { data } = await notificationsApi.getUserNotifications(user.id, {
        limit: NOTIFICATIONS_PER_PAGE,
        offset: (pageNumber - 1) * NOTIFICATIONS_PER_PAGE,
        category: categoryFilter === 'all' ? null : categoryFilter,
        unreadOnly: statusFilter === 'unread',
        readOnly: statusFilter === 'read',
      })

      const nextNotifications = data || []

      setNotifications((currentNotifications) => (
        append ? mergeNotifications(currentNotifications, nextNotifications) : nextNotifications
      ))
      setHasMore(nextNotifications.length === NOTIFICATIONS_PER_PAGE)
      setPage(pageNumber)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [categoryFilter, statusFilter, user?.id])

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/notifications' } })
      return
    }

    Promise.all([
      loadPreferences(),
      refreshUnreadCount(),
    ]).catch(() => {
      toast.error(t('notifications.errors.loadFailed', 'تعذر تحميل مركز الإشعارات'))
    })
  }, [loadPreferences, navigate, refreshUnreadCount, t, user])

  useEffect(() => {
    if (!user?.id) return undefined

    const unsubscribe = notificationsApi.subscribe(user.id, async () => {
      try {
        await Promise.all([
          loadNotifications(1, false),
          refreshUnreadCount(),
        ])
      } catch {
        toast.error(t('notifications.errors.syncFailed', 'تعذر مزامنة الإشعارات الجديدة'))
      }
    })

    return () => {
      unsubscribe()
    }
  }, [loadNotifications, refreshUnreadCount, t, user?.id])

  useEffect(() => {
    if (!user?.id) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadNotifications(page + 1, true).catch(() => {
            toast.error(t('notifications.errors.loadMoreFailed', 'تعذر تحميل المزيد من الإشعارات'))
          })
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loadNotifications, loadingMore, page, t, user?.id])

  useEffect(() => {
    if (!user?.id) return

    loadNotifications(1, false).catch(() => {
      toast.error(t('notifications.errors.filterFailed', 'تعذر تحديث الفلاتر'))
    })
  }, [categoryFilter, loadNotifications, statusFilter, t, user?.id])

  const handleSavePreferences = async () => {
    if (!user?.id) return

    setSavingPreferences(true)
    try {
      const savedPreferences = await notificationsApi.savePreferences({
        userId: user.id,
        preferences,
      })

      setPreferences(savedPreferences)
      toast.success(t('notifications.preferences.saved', 'تم حفظ تفضيلات الإشعارات'))
    } catch {
      toast.error(t('notifications.errors.preferencesFailed', 'تعذر حفظ تفضيلات الإشعارات'))
    } finally {
      setSavingPreferences(false)
    }
  }

  const handleMarkAsRead = async (notificationId) => {
    setActionLoading(`read:${notificationId}`)
    try {
      await notificationsApi.markAsRead(notificationId)
      await Promise.all([
        loadNotifications(1, false),
        refreshUnreadCount(),
      ])
    } catch {
      toast.error(t('notifications.errors.markAsReadFailed', 'تعذر تعليم الإشعار كمقروء'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleArchiveNotification = async (notificationId) => {
    setActionLoading(`archive:${notificationId}`)
    try {
      await notificationsApi.delete(notificationId)
      await Promise.all([
        loadNotifications(1, false),
        refreshUnreadCount(),
      ])
      toast.success(t('notifications.archived', 'تمت أرشفة الإشعار'))
    } catch {
      toast.error(t('notifications.errors.archiveFailed', 'تعذر أرشفة الإشعار'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return

    setActionLoading('mark-all')
    try {
      await notificationsApi.markAllAsRead(user.id, {
        category: categoryFilter === 'all' ? null : categoryFilter,
      })
      await Promise.all([
        loadNotifications(1, false),
        refreshUnreadCount(),
      ])
      toast.success(t('notifications.allMarkedRead', 'تم تعليم الإشعارات كمقروءة'))
    } catch {
      toast.error(t('notifications.errors.markAllFailed', 'تعذر تحديث الإشعارات'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleArchiveRead = async () => {
    if (!user?.id) return
    if (!window.confirm(t('notifications.confirmArchiveRead', 'هل تريد أرشفة كل الإشعارات المقروءة؟'))) {
      return
    }

    setActionLoading('archive-read')
    try {
      await notificationsApi.deleteAllRead(user.id)
      await Promise.all([
        loadNotifications(1, false),
        refreshUnreadCount(),
      ])
      toast.success(t('notifications.readArchived', 'تمت أرشفة الإشعارات المقروءة'))
    } catch {
      toast.error(t('notifications.errors.archiveReadFailed', 'تعذر أرشفة الإشعارات المقروءة'))
    } finally {
      setActionLoading(null)
    }
  }

  const handleNotificationOpen = async (notification) => {
    if (!notification.is_read) {
      try {
        await notificationsApi.markAsRead(notification.id)
        await refreshUnreadCount()
      } catch {
        toast.error(t('notifications.errors.markAsReadFailed', 'تعذر تعليم الإشعار كمقروء'))
      }
    }

    if (notification.action_url) {
      navigate(notification.action_url)
    }
  }

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const groupedNotifications = groupNotificationsByDate(notifications, t)
  const statusTabs = [
    { id: 'all', label: t('notifications.filters.all', 'الكل') },
    { id: 'unread', label: t('notifications.filters.unread', 'غير المقروءة') },
    { id: 'read', label: t('notifications.filters.read', 'المقروءة') },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center">
              <BellIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('notifications.title', 'مركز الإشعارات')}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {unreadCount > 0
                  ? t('notifications.unreadSummary', 'لديك {{count}} إشعارات غير مقروءة', { count: unreadCount })
                  : t('notifications.readSummary', 'كل شيء محدّث حتى الآن')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPreferences((current) => !current)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Cog6ToothIcon className="w-4 h-4" />
            {showPreferences
              ? t('notifications.preferences.hide', 'إخفاء التفضيلات')
              : t('notifications.preferences.show', 'إدارة التفضيلات')}
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={actionLoading === 'mark-all'}
              className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-60"
            >
              <CheckIcon className="w-4 h-4" />
              {t('notifications.markAllRead', 'تعليم الكل كمقروء')}
            </button>
          )}

          <button
            type="button"
            onClick={handleArchiveRead}
            disabled={actionLoading === 'archive-read'}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <ArchiveBoxIcon className="w-4 h-4" />
            {t('notifications.archiveRead', 'أرشفة المقروءة')}
          </button>
        </div>
      </div>

      {showPreferences && (
        <NotificationPreferencesPanel
          preferences={preferences}
          setPreferences={setPreferences}
          savingPreferences={savingPreferences}
          onSave={handleSavePreferences}
          t={t}
        />
      )}

      <Card className="p-4 mb-6 border border-gray-200 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              {t('notifications.filters.status', 'الحالة')}
            </p>
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => setStatusFilter(status.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === status.id ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              {t('notifications.filters.category', 'الفئة')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${categoryFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {t('notifications.filters.allCategories', 'كل الفئات')}
              </button>
              {NOTIFICATION_CATEGORY_OPTIONS.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryFilter(category.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${categoryFilter === category.id ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {notifications.length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedNotifications).map(([groupLabel, groupedItems]) => (
            <div key={groupLabel}>
              <div className="flex items-center gap-2 mb-3">
                <ClockIcon className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-500">{groupLabel}</h2>
              </div>
              <div className="space-y-3">
                {groupedItems.map((notification) => {
                  const categoryStyle = CATEGORY_STYLES[notification.category] || CATEGORY_STYLES.system
                  const Icon = categoryStyle.icon
                  const unread = !notification.is_read

                  return (
                    <Card
                      key={notification.id}
                      className={`p-4 border transition-colors ${notification.action_url ? 'cursor-pointer hover:border-green-200 hover:bg-green-50/40' : ''} ${unread ? 'border-green-200 bg-green-50/60' : 'border-gray-200'}`}
                      onClick={() => handleNotificationOpen(notification)}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${unread ? categoryStyle.bgColor : 'bg-gray-100'}`}>
                          <Icon className={`w-5 h-5 ${unread ? categoryStyle.iconColor : 'text-gray-400'}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <p className={`text-sm ${unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                              {notification.title}
                            </p>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryStyle.chipColor}`}>
                              {categoryStyle.label}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLES[notification.priority] || PRIORITY_STYLES.normal}`}>
                              {notification.priority === 'high' || notification.priority === 'urgent' ? <FireIcon className="w-3 h-3" /> : null}
                              {notification.priority === 'high'
                                ? t('notifications.priority.high', 'عالي')
                                : notification.priority === 'urgent'
                                  ? t('notifications.priority.urgent', 'عاجل')
                                  : notification.priority === 'low'
                                    ? t('notifications.priority.low', 'منخفض')
                                    : t('notifications.priority.normal', 'عادي')}
                            </span>
                            {unread && (
                              <span className="inline-flex items-center rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-medium text-white">
                                {t('notifications.unreadBadge', 'جديد')}
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-gray-600 leading-6">{notification.message}</p>

                          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-400">
                            <span>{new Date(notification.created_at).toLocaleString('ar-MA')}</span>
                            {notification.channel && (
                              <span>{t('notifications.channelLabel', 'القناة')}: {notification.channel}</span>
                            )}
                          </div>

                          {notification.action_url && notification.action_label && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleNotificationOpen(notification)
                              }}
                              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
                            >
                              {notification.action_label}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {!notification.is_read && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleMarkAsRead(notification.id)
                              }}
                              disabled={actionLoading === `read:${notification.id}`}
                              className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 disabled:opacity-50"
                              title={t('notifications.markAsRead', 'تعليم كمقروء')}
                            >
                              {actionLoading === `read:${notification.id}` ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                <CheckIcon className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleArchiveNotification(notification.id)
                            }}
                            disabled={actionLoading === `archive:${notification.id}`}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                            title={t('notifications.archive', 'أرشفة')}
                          >
                            {actionLoading === `archive:${notification.id}` ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <TrashIcon className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center border border-dashed border-gray-200 shadow-none">
          <BellIcon className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('notifications.empty.title', 'لا توجد إشعارات حالياً')}
          </h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {categoryFilter !== 'all' || statusFilter !== 'all'
              ? t('notifications.empty.filtered', 'لا توجد إشعارات مطابقة للفلاتر الحالية.')
              : t('notifications.empty.description', 'عندما يصل شيء جديد سيظهر هنا مع إمكانية فتحه أو أرشفته مباشرة.')}
          </p>
        </Card>
      )}

      {loadingMore && (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {hasMore && <div ref={observerTarget} className="h-4" />}

      {!hasMore && notifications.length > 0 && (
        <p className="text-center text-sm text-gray-500 py-4">
          {t('notifications.noMore', 'وصلت إلى آخر الإشعارات')}
        </p>
      )}
    </div>
  )
}

const NotificationsWithErrorBoundary = () => (
  <ErrorBoundary componentName="NotificationsPage">
    <Notifications />
  </ErrorBoundary>
)

export default NotificationsWithErrorBoundary