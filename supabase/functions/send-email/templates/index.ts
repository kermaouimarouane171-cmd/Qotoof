import type { EmailContent, TemplateName } from '../types.ts'
import { escapeHtml, stripDangerousHtml } from '../utils/validation.ts'

function getText(data: Record<string, unknown>, key: string, fallback = ''): string {
  return escapeHtml(data[key] ?? fallback)
}

function getItemsHtml(data: Record<string, unknown>): string {
  const rawItems = data.items
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return ''
  }

  const itemsHtml = rawItems
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return ''
      }

      const row = item as Record<string, unknown>
      const name = escapeHtml(row.name ?? 'منتج')
      const quantity = escapeHtml(row.quantity ?? 1)
      return `<div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>${name}</strong><br><span style="color: #6b7280;">الكمية: ${quantity}</span></div>`
    })
    .filter(Boolean)
    .join('')

  if (!itemsHtml) {
    return ''
  }

  return `<div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;"><h3 style="margin-top: 0; color: #111827;">المنتجات</h3>${itemsHtml}</div>`
}

const defaultTemplate = (subject: string, data: Record<string, unknown>): EmailContent => ({
  subject,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
      <div style="background: #16a34a; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">Qotoof</h1>
      </div>
      <div style="padding: 30px; background: #f9fafb;">
        <p>${getText(data, 'message', 'لديك إشعار جديد')}</p>
      </div>
    </div>
  `,
})

const renderers: Record<TemplateName, (subject: string, data: Record<string, unknown>) => EmailContent> = {
  order_confirmation: (subject, data) => ({
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">تم تأكيد طلبك</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 18px; color: #111827;">مرحباً ${getText(data, 'customerName', 'عميلنا الكريم')}</p>
          <p style="color: #4b5563;">تم استلام طلبك بنجاح.</p>
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827;">تفاصيل الطلب</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #6b7280;">رقم الطلب:</td><td style="padding: 8px 0; font-weight: bold;">#${getText(data, 'orderNumber')}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">التاريخ:</td><td style="padding: 8px 0;">${getText(data, 'orderDate')}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">الإجمالي:</td><td style="padding: 8px 0; font-weight: bold; color: #16a34a;">${getText(data, 'total')} MAD</td></tr>
            </table>
          </div>
          ${getItemsHtml(data)}
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827;">عنوان التوصيل</h3>
            <p style="color: #4b5563; margin: 0;">${getText(data, 'shippingAddress')}</p>
            <p style="color: #4b5563; margin: 5px 0 0 0;">${getText(data, 'shippingCity')}</p>
          </div>
        </div>
      </div>
    `,
  }),
  order_status_update: (subject, data) => ({
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
        <div style="background: #16a34a; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">تحديث حالة الطلب</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #111827;">طلبك #${getText(data, 'orderNumber')}</p>
          <p style="font-size: 18px; color: #16a34a; font-weight: bold;">${getText(data, 'message')}</p>
        </div>
      </div>
    `,
  }),
  password_reset: (subject, data) => ({
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
        <div style="background: #3b82f6; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">إعادة تعيين كلمة المرور</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>اضغط على الرابط أدناه لإعادة تعيين كلمة المرور:</p>
          <a href="${getText(data, 'resetUrl', '#')}" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">إعادة التعيين</a>
          <p style="color: #6b7280; margin-top: 20px;">هذا الرابط صالح لمدة ${getText(data, 'expiryHours', '1')} ساعة.</p>
        </div>
      </div>
    `,
  }),
  welcome: (subject, data) => ({
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">مرحباً بك في قطوف</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>مرحباً ${getText(data, 'name', 'عميلنا الكريم')}</p>
          <p>يسعدنا انضمامك إلى قطوف.</p>
        </div>
      </div>
    `,
  }),
  otp_verification: (subject, data) => ({
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
        <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">رمز التحقق</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p style="color: #4b5563; margin: 20px 0;">استخدم هذا الرمز للتحقق:</p>
          <div style="background: white; padding: 30px; border-radius: 10px; margin: 30px 0; text-align: center; border: 2px solid #3b82f6;">
            <div style="font-size: 48px; letter-spacing: 8px; font-weight: bold; color: #2563eb; font-family: 'Courier New', monospace;">${getText(data, 'otp')}</div>
            <p style="color: #6b7280; margin-top: 20px; font-size: 14px;">الرمز صالح لمدة ${getText(data, 'expiryMinutes', '10')} دقائق</p>
          </div>
        </div>
      </div>
    `,
  }),
}

export function buildEmailContent(input: {
  subject: string
  html?: string
  template?: string
  data: Record<string, unknown>
}): EmailContent {
  const { subject, html, template, data } = input

  if (html) {
    return {
      subject,
      html: stripDangerousHtml(html),
    }
  }

  if (template && template in renderers) {
    const renderer = renderers[template as TemplateName]
    return renderer(subject, data)
  }

  return defaultTemplate(subject, data)
}
