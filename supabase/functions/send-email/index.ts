// Supabase Edge Function: send-email
// Sends emails using Resend, SendGrid, or SMTP
// Deploy: supabase functions deploy send-email

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enforceServerRateLimit, getClientIp } from '../_shared/serverRateLimit.ts'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const SMTP_CONFIG = {
  host: Deno.env.get('SMTP_HOST'),
  port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
  username: Deno.env.get('SMTP_USERNAME'),
  password: Deno.env.get('SMTP_PASSWORD'),
}

// CORS headers are resolved dynamically per-request origin via getCorsHeaders(origin).
// See supabase/functions/_shared/cors.ts and the ALLOWED_ORIGINS Edge Function secret.

const EMAIL_REQUEST_LIMIT = {
  maxAttempts: 60,
  windowSeconds: 60,
  blockSeconds: 60,
}

function jsonResponse(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json', ...extraHeaders },
  })
}

// Email templates
const templates = {
  order_confirmation: (data) => ({
    subject: data.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">🎉 تم تأكيد طلبك</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 18px; color: #111827;">مرحباً ${data.customerName || 'عميلنا الكريم'},</p>
          <p style="color: #4b5563;">تم استلام طلبك بنجاح!</p>
          
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827;">تفاصيل الطلب</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">رقم الطلب:</td>
                <td style="padding: 8px 0; font-weight: bold;">#${data.orderNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">التاريخ:</td>
                <td style="padding: 8px 0;">${data.orderDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">الإجمالي:</td>
                <td style="padding: 8px 0; font-weight: bold; color: #16a34a;">${data.total} MAD</td>
              </tr>
            </table>
          </div>

          ${data.items ? `
            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #111827;">المنتجات</h3>
              ${data.items.map(item => `
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>${item.name}</strong><br>
                  <span style="color: #6b7280;">الكمية: ${item.quantity}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #111827;">عنوان التوصيل</h3>
            <p style="color: #4b5563; margin: 0;">${data.shippingAddress}</p>
            <p style="color: #4b5563; margin: 5px 0 0 0;">${data.shippingCity}</p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${data.trackingUrl || '#'}" style="background: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
              تتبع طلبك
            </a>
          </div>
        </div>
        <div style="background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="margin: 0;">شكراً لاختيارك قطوف 🌿</p>
        </div>
      </div>
    `,
  }),

  order_status_update: (data) => ({
    subject: data.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
        <div style="background: #16a34a; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">📦 تحديث حالة الطلب</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #111827;">طلبك #${data.orderNumber}</p>
          <p style="font-size: 18px; color: #16a34a; font-weight: bold;">${data.message}</p>
          ${data.trackingUrl ? `
            <a href="${data.trackingUrl}" style="background: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 20px;">
              تتبع الطلب
            </a>
          ` : ''}
        </div>
      </div>
    `,
  }),

  password_reset: (data) => ({
    subject: data.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
        <div style="background: #3b82f6; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">🔑 إعادة تعيين كلمة المرور</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>اضغط على الرابط أدناه لإعادة تعيين كلمة المرور:</p>
          <a href="${data.resetUrl}" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
            إعادة تعيين كلمة المرور
          </a>
          <p style="color: #6b7280; margin-top: 20px;">هذا الرابط صالح لمدة ${data.expiryHours} ساعة.</p>
          <p style="color: #6b7280;">إذا لم تطلب هذا، تجاهل هذه الرسالة.</p>
        </div>
      </div>
    `,
  }),

  welcome: (data) => ({
    subject: data.subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">🎉 مرحباً بك في قطوف!</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>مرحباً ${data.name}،</p>
          <p>يسعدنا انضمامك إلى قطوف - سوق الجملة الأول في المغرب.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.marketplaceUrl}" style="background: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 5px;">
              تصفح المنتجات
            </a>
            <a href="${data.becomeVendorUrl}" style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 5px;">
              كن بائعاً
            </a>
          </div>
        </div>
      </div>
    `,
  }),

  otp_verification: (data) => ({
    subject: data.subject || '🔐 رمز التحقق الخاص بك - Qotoof',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
        <div style="background: linear-gradient(135deg, #3b82f6, #2563eb); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">🔐 رمز التحقق - Qotoof</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p style="font-size: 16px; color: #111827;">مرحباً،</p>
          <p style="color: #4b5563; margin: 20px 0;">تم طلب رمز التحقق الخاص بك. استخدم الرمز أدناه للتحقق من حسابك:</p>
          
          <div style="background: white; padding: 30px; border-radius: 10px; margin: 30px 0; text-align: center; border: 2px solid #3b82f6;">
            <div style="font-size: 48px; letter-spacing: 8px; font-weight: bold; color: #2563eb; font-family: 'Courier New', monospace;">
              ${data.otp}
            </div>
            <p style="color: #6b7280; margin-top: 20px; font-size: 14px;">الرمز صالح لمدة ${data.expiryMinutes || 10} دقائق</p>
          </div>

          <p style="color: #6b7280; margin: 20px 0; font-size: 14px;">
            <strong>تحذير أمني:</strong> لا تشارك هذا الرمز مع أي شخص. قطوف لن يطلبه منك أبداً.
          </p>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              إذا لم تطلب هذا الرمز، يرجى تجاهل هذه الرسالة أو الاتصال بـ فريق الدعم فوراً.
            </p>
          </div>
        </div>
        <div style="background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px;">
          <p style="margin: 0;">© 2024 قطوف - Qotoof | سوق الجملة الأول في المغرب</p>
        </div>
      </div>
    `,
  }),
}

// Default template
const defaultTemplate = (data) => ({
  subject: data.subject || 'إشعار من قطوف',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl; text-align: right;">
      <div style="background: #16a34a; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">🌿 قطوف - Qotoof</h1>
      </div>
      <div style="padding: 30px; background: #f9fafb;">
        <p>${data.message || 'لديك إشعار جديد'}</p>
      </div>
    </div>
  `,
})

serve(async (req) => {
  try {
    // CORS headers
    const optionsResponse = handleOptions(req)
    if (optionsResponse) return optionsResponse

    if (req.method !== 'POST') {
      return jsonResponse(req, { error: 'Method not allowed' }, 405)
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(req, { error: 'Supabase environment variables are not configured' }, 500)
    }

    const clientIp = getClientIp(req)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const rateLimitResult = await enforceServerRateLimit({
      supabase,
      scope: 'send_email_request',
      identifierParts: ['send-email', clientIp],
      maxAttempts: EMAIL_REQUEST_LIMIT.maxAttempts,
      windowSeconds: EMAIL_REQUEST_LIMIT.windowSeconds,
      blockSeconds: EMAIL_REQUEST_LIMIT.blockSeconds,
    })

    if (!rateLimitResult.allowed) {
      return jsonResponse(
        req,
        { error: 'Too many requests, try again later' },
        429,
        { 'Retry-After': String(rateLimitResult.retry_after_seconds || EMAIL_REQUEST_LIMIT.blockSeconds) },
      )
    }

    const { to, toName, from, fromName, subject, template, data } = await req.json()

    if (!to || !subject) {
      return jsonResponse(req, { error: 'Missing required fields: to, subject' }, 400)
    }

    if (typeof to !== 'string' || !to.includes('@')) {
      return jsonResponse(req, { error: 'Invalid recipient email' }, 400)
    }

    if (typeof subject !== 'string' || subject.length > 200) {
      return jsonResponse(req, { error: 'Invalid subject' }, 400)
    }

    // Get template
    const templateFn = templates[template] || defaultTemplate
    const emailContent = templateFn({ ...data, subject })

    // Send email using Resend (recommended for production)
    if (RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName || 'قطوف'} <${from || 'noreply@qotoof.ma'}>`,
          to: [to],
          subject: emailContent.subject,
          html: emailContent.html,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to send email')
      }

      return jsonResponse(req, { success: true, messageId: result.id }, 200)
    }

    // Fallback: Send using SendGrid
    if (SENDGRID_API_KEY) {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to, name: toName }] }],
          from: { email: from || 'noreply@qotoof.ma', name: fromName || 'قطوف' },
          subject: emailContent.subject,
          content: [{ type: 'text/html', value: emailContent.html }],
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(error)
      }

      return jsonResponse(req, { success: true }, 200)
    }

    // No email provider configured
    return jsonResponse(req, { success: true, skipped: true, message: 'No email provider configured' }, 200)

  } catch (error) {
    return jsonResponse(req, { error: error.message || 'Failed to send email' }, 500)
  }
})
