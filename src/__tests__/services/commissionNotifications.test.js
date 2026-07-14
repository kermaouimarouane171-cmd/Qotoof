import { commissionNotifications } from '@/modules/commissions'

jest.mock('@/services/notifications', () => ({
  notificationsApi: {
    create: jest.fn(),
  },
}))

jest.mock('@/services/emailService', () => ({
  emailService: {
    sendEmail: jest.fn(),
  },
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
    })),
  },
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}))

const { notificationsApi } = require('@/services/notifications')
const { emailService } = require('@/services/emailService')
const { supabase } = require('@/services/supabase')
const { logger } = require('@/utils/logger')

describe('commissionNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // Helper to set up supabase profile query mock
  const mockProfileSuccess = (profile = {}) => {
    const singleMock = jest.fn().mockResolvedValue({
      data: {
        first_name: 'Ahmed',
        last_name: 'Bennani',
        email: 'ahmed@example.com',
        ...profile,
      },
      error: null,
    })
    const eqMock = jest.fn(() => ({ single: singleMock }))
    const selectMock = jest.fn(() => ({ eq: eqMock }))
    supabase.from.mockReturnValue({ select: selectMock })
    return { singleMock, eqMock, selectMock }
  }

  const mockProfileError = (errorMsg = 'row not found') => {
    const singleMock = jest.fn().mockResolvedValue({
      data: null,
      error: { message: errorMsg },
    })
    const eqMock = jest.fn(() => ({ single: singleMock }))
    const selectMock = jest.fn(() => ({ eq: eqMock }))
    supabase.from.mockReturnValue({ select: selectMock })
    return { singleMock }
  }

  const mockProfileNoEmail = () => {
    const singleMock = jest.fn().mockResolvedValue({
      data: { first_name: 'Test', last_name: 'User', email: null },
      error: null,
    })
    const eqMock = jest.fn(() => ({ single: singleMock }))
    const selectMock = jest.fn(() => ({ eq: eqMock }))
    supabase.from.mockReturnValue({ select: selectMock })
    return { singleMock }
  }

  describe('afterConfirmedSale', () => {
    test('sends in-app notification with correct payload', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-1' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.afterConfirmedSale({
        vendorId: 'vendor-123',
        saleAmount: 500,
        commissionSoFar: 15,
        orderId: 'order-456',
      })

      expect(notificationsApi.create).toHaveBeenCalledWith({
        user_id: 'vendor-123',
        title: '✅ تم تسجيل بيع جديد',
        message: expect.stringContaining('500.00 درهم'),
        type: 'commission',
        data: { event: 'sale_confirmed', order_id: 'order-456' },
        is_read: false,
      })
    })

    test('sends email notification with correct payload', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-1' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.afterConfirmedSale({
        vendorId: 'vendor-123',
        saleAmount: 500,
        commissionSoFar: 15,
        orderId: 'order-456',
      })

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'ahmed@example.com',
        toName: 'Ahmed Bennani',
        subject: '✅ تم تسجيل بيع جديد',
        template: 'commission_notification',
        data: {
          message: expect.stringContaining('500.00 درهم'),
          orderId: 'order-456',
          saleAmount: 500,
          commissionSoFar: 15,
        },
      })
    })

    test('queries profiles table for vendor email', async () => {
      const { singleMock } = mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-1' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.afterConfirmedSale({
        vendorId: 'vendor-123',
        saleAmount: 500,
        commissionSoFar: 15,
        orderId: 'order-456',
      })

      expect(supabase.from).toHaveBeenCalledWith('profiles')
      expect(singleMock).toHaveBeenCalled()
    })

    test('continues if email fails (Promise.allSettled)', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-1' })
      emailService.sendEmail.mockRejectedValue(new Error('email service down'))

      await expect(
        commissionNotifications.afterConfirmedSale({
          vendorId: 'vendor-123',
          saleAmount: 500,
          commissionSoFar: 15,
          orderId: 'order-456',
        })
      ).resolves.not.toThrow()

      expect(notificationsApi.create).toHaveBeenCalled()
    })

    test('continues if in-app notification fails (Promise.allSettled)', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockRejectedValue(new Error('db error'))
      emailService.sendEmail.mockResolvedValue({ success: true })

      await expect(
        commissionNotifications.afterConfirmedSale({
          vendorId: 'vendor-123',
          saleAmount: 500,
          commissionSoFar: 15,
          orderId: 'order-456',
        })
      ).resolves.not.toThrow()

      expect(emailService.sendEmail).toHaveBeenCalled()
    })
  })

  describe('monthEndSummary', () => {
    test('sends in-app notification with month_end event', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-2' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.monthEndSummary({
        vendorId: 'vendor-123',
        monthName: 'يونيو',
        totalSales: 10000,
        commissionDue: 300,
        dueDate: '2026-07-07',
        monthlySaleId: 'sale-789',
      })

      expect(notificationsApi.create).toHaveBeenCalledWith({
        user_id: 'vendor-123',
        title: '📋 ملخص يونيو',
        message: expect.stringContaining('10000.00 درهم'),
        type: 'commission',
        data: { event: 'month_end', monthly_sale_id: 'sale-789' },
        is_read: false,
      })
    })

    test('sends email with summary data', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-2' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.monthEndSummary({
        vendorId: 'vendor-123',
        monthName: 'يونيو',
        totalSales: 10000,
        commissionDue: 300,
        dueDate: '2026-07-07',
        monthlySaleId: 'sale-789',
      })

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'ahmed@example.com',
        toName: 'Ahmed Bennani',
        subject: '📋 ملخص يونيو',
        template: 'commission_notification',
        data: {
          message: expect.any(String),
          totalSales: 10000,
          commissionDue: 300,
          dueDate: '2026-07-07',
        },
      })
    })
  })

  describe('reminder3Days', () => {
    test('sends in-app notification with reminder_3days event', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-3' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.reminder3Days({
        vendorId: 'vendor-123',
        amountDue: 300,
        dueDate: '2026-07-07',
        monthlySaleId: 'sale-789',
      })

      expect(notificationsApi.create).toHaveBeenCalledWith({
        user_id: 'vendor-123',
        title: '⚠️ تذكير قبل 3 أيام',
        message: expect.stringContaining('300.00 درهم'),
        type: 'commission',
        data: { event: 'reminder_3days', monthly_sale_id: 'sale-789' },
        is_read: false,
      })
    })

    test('sends email with reminder data', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-3' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.reminder3Days({
        vendorId: 'vendor-123',
        amountDue: 300,
        dueDate: '2026-07-07',
        monthlySaleId: 'sale-789',
      })

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'ahmed@example.com',
        toName: 'Ahmed Bennani',
        subject: '⚠️ تذكير قبل 3 أيام',
        template: 'commission_notification',
        data: {
          message: expect.any(String),
          amountDue: 300,
          dueDate: '2026-07-07',
        },
      })
    })
  })

  describe('dueToday', () => {
    test('sends in-app notification with due_today event', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-4' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.dueToday({
        vendorId: 'vendor-123',
        amountDue: 300,
        monthlySaleId: 'sale-789',
      })

      expect(notificationsApi.create).toHaveBeenCalledWith({
        user_id: 'vendor-123',
        title: '🚨 آخر يوم للدفع',
        message: expect.stringContaining('300.00 درهم'),
        type: 'commission',
        data: { event: 'due_today', monthly_sale_id: 'sale-789' },
        is_read: false,
      })
    })

    test('sends email with amountDue only', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-4' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.dueToday({
        vendorId: 'vendor-123',
        amountDue: 300,
        monthlySaleId: 'sale-789',
      })

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'ahmed@example.com',
        toName: 'Ahmed Bennani',
        subject: '🚨 آخر يوم للدفع',
        template: 'commission_notification',
        data: {
          message: expect.any(String),
          amountDue: 300,
        },
      })
    })
  })

  describe('accountFrozen', () => {
    test('sends in-app notification with account_frozen event', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-5' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.accountFrozen({
        vendorId: 'vendor-123',
        amountDue: 300,
        monthlySaleId: 'sale-789',
      })

      expect(notificationsApi.create).toHaveBeenCalledWith({
        user_id: 'vendor-123',
        title: '🔴 تم تجميد الحساب',
        message: expect.stringContaining('300.00 درهم'),
        type: 'commission',
        data: { event: 'account_frozen', monthly_sale_id: 'sale-789' },
        is_read: false,
      })
    })

    test('sends email with amountDue only', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-5' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.accountFrozen({
        vendorId: 'vendor-123',
        amountDue: 300,
        monthlySaleId: 'sale-789',
      })

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'ahmed@example.com',
        toName: 'Ahmed Bennani',
        subject: '🔴 تم تجميد الحساب',
        template: 'commission_notification',
        data: {
          message: expect.any(String),
          amountDue: 300,
        },
      })
    })
  })

  describe('paymentConfirmed', () => {
    test('sends in-app notification with paid_confirmed event', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-6' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.paymentConfirmed({
        vendorId: 'vendor-123',
        paidAmount: 300,
        monthlySaleId: 'sale-789',
      })

      expect(notificationsApi.create).toHaveBeenCalledWith({
        user_id: 'vendor-123',
        title: 'تم دفع ضريبة التطبيق Qotoof بنجاح',
        message: 'تم دفع ضريبة التطبيق Qotoof بنجاح',
        type: 'commission',
        data: { event: 'paid_confirmed', monthly_sale_id: 'sale-789' },
        is_read: false,
      })
    })

    test('sends email with paidAmount only', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-6' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.paymentConfirmed({
        vendorId: 'vendor-123',
        paidAmount: 300,
        monthlySaleId: 'sale-789',
      })

      expect(emailService.sendEmail).toHaveBeenCalledWith({
        to: 'ahmed@example.com',
        toName: 'Ahmed Bennani',
        subject: 'تم دفع ضريبة التطبيق Qotoof بنجاح',
        template: 'commission_notification',
        data: {
          message: 'تم دفع ضريبة التطبيق Qotoof بنجاح',
          paidAmount: 300,
        },
      })
    })
  })

  describe('sendEmailNotification — profile lookup behavior', () => {
    test('skips email and logs warning when profile has error', async () => {
      mockProfileError('row not found')
      notificationsApi.create.mockResolvedValue({ id: 'notif-7' })

      await commissionNotifications.afterConfirmedSale({
        vendorId: 'vendor-123',
        saleAmount: 500,
        commissionSoFar: 15,
        orderId: 'order-456',
      })

      expect(logger.warn).toHaveBeenCalledWith(
        'تعذر إرسال بريد عمولة: البريد غير متوفر',
        { vendorId: 'vendor-123', error: 'row not found' }
      )
      expect(emailService.sendEmail).not.toHaveBeenCalled()
    })

    test('skips email when vendor email is null', async () => {
      mockProfileNoEmail()
      notificationsApi.create.mockResolvedValue({ id: 'notif-8' })

      await commissionNotifications.afterConfirmedSale({
        vendorId: 'vendor-123',
        saleAmount: 500,
        commissionSoFar: 15,
        orderId: 'order-456',
      })

      expect(logger.warn).toHaveBeenCalledWith(
        'تعذر إرسال بريد عمولة: البريد غير متوفر',
        { vendorId: 'vendor-123', error: undefined }
      )
      expect(emailService.sendEmail).not.toHaveBeenCalled()
    })

    test('handles missing first_name and last_name gracefully', async () => {
      mockProfileSuccess({ first_name: null, last_name: null, email: 'test@example.com' })
      notificationsApi.create.mockResolvedValue({ id: 'notif-9' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.afterConfirmedSale({
        vendorId: 'vendor-123',
        saleAmount: 500,
        commissionSoFar: 15,
        orderId: 'order-456',
      })

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          toName: '',
        })
      )
    })
  })

  describe('formatMad (via method output)', () => {
    test('formats saleAmount with 2 decimal places and درهم suffix', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-10' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.afterConfirmedSale({
        vendorId: 'vendor-123',
        saleAmount: 1234.5,
        commissionSoFar: 37.05,
        orderId: 'order-456',
      })

      const callArgs = notificationsApi.create.mock.calls[0][0]
      expect(callArgs.message).toContain('1234.50 درهم')
      expect(callArgs.message).toContain('37.05 درهم')
    })

    test('handles null/undefined amounts as 0.00', async () => {
      mockProfileSuccess()
      notificationsApi.create.mockResolvedValue({ id: 'notif-11' })
      emailService.sendEmail.mockResolvedValue({ success: true })

      await commissionNotifications.afterConfirmedSale({
        vendorId: 'vendor-123',
        saleAmount: null,
        commissionSoFar: undefined,
        orderId: 'order-456',
      })

      const callArgs = notificationsApi.create.mock.calls[0][0]
      expect(callArgs.message).toContain('0.00 درهم')
    })
  })

  describe('default export', () => {
    test('default export is the same object as named export', () => {
      const { commissionNotificationsDefault } = require('@/modules/commissions')
      expect(commissionNotificationsDefault).toBe(commissionNotifications)
    })
  })
})
