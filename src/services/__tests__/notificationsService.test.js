import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

jest.mock('react-hot-toast', () => {
  const toast = jest.fn()
  return {
    __esModule: true,
    default: toast,
  }
})

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('@/utils/withRetry', () => ({
  withRetry: (fn) => {
    const execute = async (...args) => fn(...args)
    const wrapped = (...args) => execute(...args)
    wrapped.then = (onFulfilled, onRejected) => execute().then(onFulfilled, onRejected)
    wrapped.catch = (onRejected) => execute().catch(onRejected)
    wrapped.finally = (onFinally) => execute().finally(onFinally)
    return wrapped
  },
}))

jest.mock('@/services/supabase', () => {
  const tableQueues = new Map()
  const rpcQueue = []
  const channelState = {
    callback: null,
    channelObject: null,
  }

  const dequeueTableResponse = (table) => {
    const queue = tableQueues.get(table) || []
    if (queue.length === 0) {
      return { data: [], error: null, count: 0 }
    }
    return queue.shift()
  }

  const makeBuilder = (table) => {
    const builder = {
      _table: table,
      _insertPayload: null,
      _updatePayload: null,
      _upsertPayload: null,
      _eqCalls: [],
      select: jest.fn(() => builder),
      insert: jest.fn((payload) => {
        builder._insertPayload = payload
        return builder
      }),
      upsert: jest.fn((payload) => {
        builder._upsertPayload = payload
        return builder
      }),
      update: jest.fn((payload) => {
        builder._updatePayload = payload
        return builder
      }),
      eq: jest.fn((key, value) => {
        builder._eqCalls.push([key, value])
        return builder
      }),
      is: jest.fn(() => builder),
      not: jest.fn(() => builder),
      order: jest.fn(() => builder),
      range: jest.fn(() => builder),
      or: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      single: jest.fn(() => builder),
      maybeSingle: jest.fn(() => builder),
      then: (onFulfilled, onRejected) => Promise.resolve(dequeueTableResponse(table)).then(onFulfilled, onRejected),
    }

    globalThis.__notificationLastBuilderByTable = globalThis.__notificationLastBuilderByTable || {}
    globalThis.__notificationLastBuilderByTable[table] = builder

    return builder
  }

  const supabase = {
    from: jest.fn((table) => makeBuilder(table)),
    rpc: jest.fn((_name, _args) => {
      if (rpcQueue.length === 0) {
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve(rpcQueue.shift())
    }),
    channel: jest.fn((name) => {
      const obj = {
        _name: name,
        on: jest.fn((_event, _filter, callback) => {
          channelState.callback = callback
          return obj
        }),
        subscribe: jest.fn(() => obj),
        unsubscribe: jest.fn(),
      }
      channelState.channelObject = obj
      return obj
    }),
    removeChannel: jest.fn(),
    functions: {
      invoke: jest.fn(),
    },
  }

  globalThis.__notificationSupabase = supabase
  globalThis.__notificationTableQueues = tableQueues
  globalThis.__notificationRpcQueue = rpcQueue
  globalThis.__notificationChannelState = channelState

  return { supabase }
})

import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { emailService } from '@/services/emailService'
import {
  dispatchNotificationBadgeUpdate,
  notificationEvents,
  notificationsApi,
} from '@/services/notifications'
import NotificationLink from '@/components/notifications/NotificationLink'

const mockSupabase = globalThis.__notificationSupabase
const tableQueues = globalThis.__notificationTableQueues
const rpcQueue = globalThis.__notificationRpcQueue
const channelState = globalThis.__notificationChannelState

const enqueueTable = (table, response) => {
  if (!tableQueues.has(table)) {
    tableQueues.set(table, [])
  }
  tableQueues.get(table).push(response)
}

describe('notifications and email system', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    tableQueues.clear()
    rpcQueue.length = 0
    channelState.callback = null
    channelState.channelObject = null

    emailService.enabled = true
    emailService.fromEmail = 'support@qotoof.ma'

    mockSupabase.functions.invoke.mockResolvedValue({ response: { messageId: 'msg-1' }, error: null })

    useAuthStore.mockReturnValue({
      user: { id: 'user-1' },
      profile: { id: 'user-1' },
    })
  })

  describe('emailService — Order Notifications', () => {
    it('sendOrderConfirmation() sends email to buyer with Arabic subject and order details', async () => {
      const order = {
        id: 'order-1',
        order_number: 'Q-1001',
        created_at: '2026-05-25T10:00:00.000Z',
        total: 320,
        items: [{ name: 'Tomato', qty: 10 }],
        shipping_address: 'Hay Riyad',
        shipping_city: 'Rabat',
        payment_method: 'cod',
      }

      const result = await emailService.sendOrderConfirmation(order, {
        email: 'buyer@test.ma',
        name: 'Buyer Name',
      })

      expect(result.success).toBe(true)
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('send-email', {
        body: expect.objectContaining({
          to: 'buyer@test.ma',
          subject: 'تأكيد طلبك #Q-1001',
          template: 'order_confirmation',
        }),
      })
    })

    it('sendNewOrderToVendor() sends vendor alert with new-order subject', async () => {
      await emailService.sendNewOrderToVendor(
        {
          id: 'order-2',
          order_number: 'Q-2002',
          created_at: '2026-05-25T10:00:00.000Z',
          total: 450,
          items: [],
          customer_name: 'Buyer',
          customer_phone: '+212611111111',
          shipping_city: 'Casablanca',
        },
        { email: 'vendor@test.ma', name: 'Vendor Name' },
      )

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('send-email', {
        body: expect.objectContaining({
          to: 'vendor@test.ma',
          subject: expect.stringContaining('طلب جديد'),
          template: 'vendor_new_order',
        }),
      })
    })

    it('sendOrderStatusUpdate() sends updates for confirmed/cancelled/picked_up/delivered', async () => {
      const order = { id: 'order-3', order_number: 'Q-3003' }
      const customer = { email: 'buyer@test.ma', name: 'Buyer' }

      await emailService.sendOrderStatusUpdate(order, customer, 'confirmed')
      await emailService.sendOrderStatusUpdate(order, customer, 'cancelled')
      await emailService.sendOrderStatusUpdate(order, customer, 'picked_up')
      await emailService.sendOrderStatusUpdate(order, customer, 'delivered')

      const subjects = mockSupabase.functions.invoke.mock.calls.map(([, payload]) => payload.body.subject)
      expect(subjects.some((s) => String(s).includes('تأكيد') || String(s).includes('تحديث'))).toBe(true)
      expect(subjects.some((s) => String(s).includes('إلغاء') || String(s).includes('❌'))).toBe(true)
      expect(subjects.some((s) => String(s).includes('تسليم') || String(s).includes('✓'))).toBe(true)
    })

    it('email service handles Supabase Edge Function invocation correctly', async () => {
      await emailService.sendEmail({
        to: 'buyer@test.ma',
        toName: 'Buyer',
        subject: 'Subject',
        template: 'order_confirmation',
        data: { orderNumber: 'Q-1' },
      })

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('send-email', {
        body: expect.objectContaining({
          from: 'support@qotoof.ma',
          fromName: 'Qotoof',
        }),
      })
    })

    it('gracefully handles email failure (returns error object without throwing)', async () => {
      mockSupabase.functions.invoke.mockResolvedValueOnce({
        response: null,
        error: { message: 'edge function failed' },
      })

      const result = await emailService.sendOrderConfirmation(
        {
          id: 'order-4',
          order_number: 'Q-4004',
          created_at: '2026-05-25T10:00:00.000Z',
          total: 250,
          items: [],
        },
        { email: 'buyer@test.ma', name: 'Buyer' },
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('edge function failed')
    })
  })

  describe('emailService — Language Handling', () => {
    it('sends Arabic subject for ar preference', async () => {
      await emailService.sendOrderConfirmation(
        {
          id: 'order-ar',
          order_number: 'Q-AR',
          created_at: '2026-05-25T10:00:00.000Z',
          total: 100,
          items: [],
        },
        { email: 'ar@test.ma', name: 'AR Buyer', language: 'ar' },
      )

      const subject = mockSupabase.functions.invoke.mock.calls[0][1].body.subject
      expect(subject).toContain('تأكيد طلبك')
    })

    it('keeps default localized subject for fr preference in current implementation', async () => {
      await emailService.sendOrderConfirmation(
        {
          id: 'order-fr',
          order_number: 'Q-FR',
          created_at: '2026-05-25T10:00:00.000Z',
          total: 100,
          items: [],
        },
        { email: 'fr@test.ma', name: 'FR Buyer', language: 'fr' },
      )

      const subject = mockSupabase.functions.invoke.mock.calls[0][1].body.subject
      expect(subject).toContain('تأكيد طلبك')
    })

    it('falls back safely when language preference is unknown', async () => {
      await emailService.sendOrderConfirmation(
        {
          id: 'order-unknown',
          order_number: 'Q-UNK',
          created_at: '2026-05-25T10:00:00.000Z',
          total: 100,
          items: [],
        },
        { email: 'unknown@test.ma', name: 'Unknown Buyer', language: 'zz' },
      )

      const subject = mockSupabase.functions.invoke.mock.calls[0][1].body.subject
      expect(subject).toContain('تأكيد طلبك')
    })
  })

  describe('in-app notifications via Supabase Realtime', () => {
    it('creates notification record with expected fields', async () => {
      rpcQueue.push({ data: null, error: { message: 'rpc unavailable' } })
      enqueueTable('notifications', {
        data: {
          id: 'notif-1',
          user_id: 'user-1',
          type: 'order',
          title: 'Order update',
          message: 'Order confirmed',
          data: { order_id: 'order-1' },
          is_read: false,
          created_at: '2026-05-25T10:00:00.000Z',
        },
        error: null,
      })

      const created = await notificationsApi.create({
        user_id: 'user-1',
        type: 'order',
        title: 'Order update',
        message: 'Order confirmed',
        data: { order_id: 'order-1' },
      })

      expect(created).toEqual(
        expect.objectContaining({
          user_id: 'user-1',
          type: 'order',
          title: 'Order update',
          data: expect.objectContaining({ order_id: 'order-1' }),
        }),
      )
    })

    it('subscribe creates realtime subscription and callback receives new notification', () => {
      const callback = jest.fn()
      const unsubscribe = notificationsApi.subscribe('user-1', callback, { scope: 'unit' })

      expect(mockSupabase.channel).toHaveBeenCalled()
      expect(typeof channelState.callback).toBe('function')

      channelState.callback({
        eventType: 'INSERT',
        new: {
          id: 'notif-2',
          user_id: 'user-1',
          title: 'New message',
          message: 'Message body',
          type: 'message',
          created_at: '2026-05-25T10:00:00.000Z',
        },
        old: null,
      })

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'INSERT',
          new: expect.objectContaining({ id: 'notif-2' }),
        }),
      )

      unsubscribe()
      expect(mockSupabase.removeChannel).toHaveBeenCalled()
    })

    it('markAsRead updates notification read status', async () => {
      enqueueTable('notifications', {
        data: {
          id: 'notif-3',
          user_id: 'user-1',
          is_read: true,
          read_at: '2026-05-25T10:00:00.000Z',
        },
        error: null,
      })

      const result = await notificationsApi.markAsRead('user-1', 'notif-3')

      expect(result).toEqual(expect.objectContaining({ id: 'notif-3', is_read: true }))
    })

    it('markAllAsRead marks all unread notifications', async () => {
      enqueueTable('notifications', { data: null, error: null })

      await expect(notificationsApi.markAllAsRead('user-1')).resolves.toBeUndefined()
      const builder = globalThis.__notificationLastBuilderByTable.notifications
      expect(builder._updatePayload).toEqual(expect.objectContaining({ is_read: true }))
    })

    it('getUnreadCount returns count from notifications table', async () => {
      enqueueTable('notifications', { data: [], error: null, count: 7 })

      const count = await notificationsApi.getUnreadCount('user-1')

      expect(count).toBe(7)
    })

    it('deleteNotification soft-deletes notification record', async () => {
      enqueueTable('notifications', {
        data: {
          id: 'notif-delete',
          user_id: 'user-1',
          deleted_at: '2026-05-25T10:00:00.000Z',
        },
        error: null,
      })

      const result = await notificationsApi.delete('user-1', 'notif-delete')

      expect(result).toEqual(expect.objectContaining({ id: 'notif-delete' }))
    })
  })

  describe('Notification Badge in Navbar (NotificationLink)', () => {
    const renderNotificationLink = () =>
      render(
        <MemoryRouter>
          <NotificationLink />
        </MemoryRouter>,
      )

    it('shows red badge with unread count when count > 0', async () => {
      enqueueTable('notifications', { data: [], error: null, count: 5 })
      enqueueTable('notification_preferences', { data: { user_id: 'user-1' }, error: null })

      renderNotificationLink()

      expect(await screen.findByText('5')).toBeInTheDocument()
    })

    it('shows no badge when count is 0', async () => {
      enqueueTable('notifications', { data: [], error: null, count: 0 })
      enqueueTable('notification_preferences', { data: { user_id: 'user-1' }, error: null })

      renderNotificationLink()

      await waitFor(() => {
        expect(screen.queryByText('0')).not.toBeInTheDocument()
      })
    })

    it('badge count updates in real-time via badge event', async () => {
      enqueueTable('notifications', { data: [], error: null, count: 1 })
      enqueueTable('notification_preferences', { data: { user_id: 'user-1' }, error: null })

      renderNotificationLink()
      expect(await screen.findByText('1')).toBeInTheDocument()

      act(() => {
        dispatchNotificationBadgeUpdate(42)
      })

      expect(await screen.findByText('42')).toBeInTheDocument()
    })

    it('badge shows 99+ when count exceeds 99', async () => {
      enqueueTable('notifications', { data: [], error: null, count: 1 })
      enqueueTable('notification_preferences', { data: { user_id: 'user-1' }, error: null })

      renderNotificationLink()

      act(() => {
        window.dispatchEvent(new CustomEvent(notificationEvents.badge, {
          detail: { unreadCount: 120 },
        }))
      })

      expect(await screen.findByText('99+')).toBeInTheDocument()
    })

    it('shows toast for incoming INSERT notification when not on /notifications', async () => {
      enqueueTable('notifications', { data: [], error: null, count: 1 })
      enqueueTable('notification_preferences', { data: { user_id: 'user-1' }, error: null })
      enqueueTable('notifications', { data: [], error: null, count: 2 })

      renderNotificationLink()
      await screen.findByText('1')

      act(() => {
        channelState.callback({
          eventType: 'INSERT',
          new: {
            id: 'notif-live-1',
            user_id: 'user-1',
            title: 'Driver assigned',
            message: 'A driver is assigned',
            type: 'delivery_assignment',
            created_at: '2026-05-25T10:00:00.000Z',
          },
          old: null,
        })
      })

      await waitFor(() => {
        expect(toast).toHaveBeenCalled()
      })
    })
  })
})
