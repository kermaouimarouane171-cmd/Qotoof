jest.mock('@/utils/withRetry', () => ({
  withRetry: (fn) => fn,
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    removeChannel: jest.fn(),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn(),
    })),
  },
}))

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getNotificationPreferenceKey,
  isWithinQuietHours,
  normalizeNotification,
  normalizeNotificationCategory,
  normalizeNotificationPreferences,
  notificationsApi,
  resolveNotificationLink,
  shouldMuteNotificationPreview,
} from '@/services/notifications'
import { supabase } from '@/services/supabase'

describe('notifications helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('normalizes legacy categories to the new canonical set', () => {
    expect(normalizeNotificationCategory('order')).toBe('order_update')
    expect(normalizeNotificationCategory('review_updates')).toBe('review')
    expect(normalizeNotificationCategory('commission')).toBe('payment')
    expect(normalizeNotificationCategory('delivery_assignment')).toBe('delivery')
    expect(normalizeNotificationCategory('messages')).toBe('message')
    expect(normalizeNotificationCategory('unknown_value')).toBe('system')
  })

  test('maps categories to the correct preference key', () => {
    expect(getNotificationPreferenceKey('order')).toBe('order_updates')
    expect(getNotificationPreferenceKey('review')).toBe('review_updates')
    expect(getNotificationPreferenceKey('delivery')).toBe('delivery_updates')
    expect(getNotificationPreferenceKey('message')).toBe('system_updates')
  })

  test('normalizes preferences and sanitizes quiet-hours values', () => {
    const result = normalizeNotificationPreferences({
      email_enabled: false,
      quiet_hours_start: '22:30:00',
      quiet_hours_end: '06:15:00',
    })

    expect(result).toEqual({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      email_enabled: false,
      quiet_hours_start: '22:30',
      quiet_hours_end: '06:15',
    })
  })

  test('detects quiet hours within same-day window', () => {
    expect(isWithinQuietHours({ quiet_hours_start: '09:00', quiet_hours_end: '17:00' }, new Date('2026-04-22T10:30:00'))).toBe(true)
    expect(isWithinQuietHours({ quiet_hours_start: '09:00', quiet_hours_end: '17:00' }, new Date('2026-04-22T18:30:00'))).toBe(false)
  })

  test('detects quiet hours across midnight', () => {
    expect(isWithinQuietHours({ quiet_hours_start: '22:00', quiet_hours_end: '06:00' }, new Date('2026-04-22T23:15:00'))).toBe(true)
    expect(isWithinQuietHours({ quiet_hours_start: '22:00', quiet_hours_end: '06:00' }, new Date('2026-04-22T04:45:00'))).toBe(true)
    expect(isWithinQuietHours({ quiet_hours_start: '22:00', quiet_hours_end: '06:00' }, new Date('2026-04-22T14:45:00'))).toBe(false)
  })

  test('normalizes a notification payload for the center UI', () => {
    const notification = normalizeNotification({
      id: 'n1',
      type: 'order',
      category: 'order_updates',
      title: 'Order accepted',
      message: 'Your order was accepted',
      order_id: 'o1',
      data: { order_id: 'o1' },
      created_at: '2026-04-22T12:00:00Z',
      is_read: false,
    })

    expect(notification.category).toBe('order_update')
    expect(notification.is_read).toBe(false)
    expect(notification.action_url).toBe('/orders/o1')
    expect(notification.action_label).toBe('عرض الطلب')
  })

  test('resolves links from explicit actions and fallback order/message data', () => {
    expect(resolveNotificationLink({ action_url: '/vendor/reviews' })).toBe('/vendor/reviews')
    expect(resolveNotificationLink({ data: { order_id: 'o55' } })).toBe('/orders/o55')
    expect(resolveNotificationLink({ data: { conversation_id: 'c12' } })).toBe('/messages?conversation=c12')
  })

  test('mutes preview toasts when category is disabled', () => {
    const muted = shouldMuteNotificationPreview(
      { ...DEFAULT_NOTIFICATION_PREFERENCES, delivery_updates: false },
      { category: 'delivery' },
      new Date('2026-04-22T12:00:00')
    )

    expect(muted).toBe(true)
  })

  test('mutes preview toasts during quiet hours but keeps daytime notifications active', () => {
    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quiet_hours_start: '22:00',
      quiet_hours_end: '06:00',
    }

    expect(shouldMuteNotificationPreview(preferences, { category: 'system' }, new Date('2026-04-22T23:30:00'))).toBe(true)
    expect(shouldMuteNotificationPreview(preferences, { category: 'system' }, new Date('2026-04-22T14:30:00'))).toBe(false)
  })

  test('uses distinct realtime channels for multiple notification consumers', () => {
    const callback = jest.fn()

    const unsubscribeBadge = notificationsApi.subscribe('user-1', callback, { scope: 'badge' })
    const unsubscribeCenter = notificationsApi.subscribe('user-1', callback, { scope: 'center' })

    expect(supabase.channel).toHaveBeenNthCalledWith(1, 'notifications:user-1:badge:1')
    expect(supabase.channel).toHaveBeenNthCalledWith(2, 'notifications:user-1:center:2')

    unsubscribeBadge()
    unsubscribeCenter()

    expect(supabase.removeChannel).toHaveBeenCalledTimes(2)
  })

  test('scopes notification mutations to the current user id', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null })
    const select = jest.fn(() => ({ maybeSingle }))
    const eqById = jest.fn(() => ({ select }))
    const eqByUser = jest.fn(() => ({ eq: eqById }))
    const update = jest.fn(() => ({ eq: eqByUser }))

    supabase.from.mockReturnValue({ update })

    await notificationsApi.markAsRead('user-1', 'notification-1')
    await notificationsApi.delete('user-1', 'notification-2')

    expect(supabase.from).toHaveBeenNthCalledWith(1, 'notifications')
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'notifications')
    expect(eqByUser).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eqById).toHaveBeenCalledWith('id', 'notification-1')
    expect(eqById).toHaveBeenCalledWith('id', 'notification-2')
  })
})