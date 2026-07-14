import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enforceServerRateLimit, getClientIp } from '../_shared/serverRateLimit.ts'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'
import { sendWithResend } from './providers/resend.ts'
import { sendWithSendGrid } from './providers/sendgrid.ts'
import { buildEmailContent } from './templates/index.ts'
import type { EmailRequestBody } from './types.ts'
import { parseAndValidateRequest } from './utils/validation.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const EMAIL_REQUEST_LIMIT = {
  maxAttempts: 60,
  windowSeconds: 60,
  blockSeconds: 60,
}

const PROVIDER_TIMEOUT_MS = 10000
const DEFAULT_FROM_EMAIL = 'noreply@greenmarket-marketplace.web.app'
const DEFAULT_FROM_NAME = 'Qotoof'

function jsonResponse(req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req.headers.get('Origin')),
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) {
    return optionsResponse
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, { success: false, error: 'Method not allowed' }, 405)
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(req, {
      success: false,
      error: 'Supabase environment variables are not configured',
      missing: {
        SUPABASE_URL: !SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !SUPABASE_SERVICE_ROLE_KEY,
      },
    }, 500)
  }

  try {
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
        { success: false, error: 'Too many requests, try again later' },
        429,
        { 'Retry-After': String(rateLimitResult.retry_after_seconds || EMAIL_REQUEST_LIMIT.blockSeconds) },
      )
    }

    // Require authenticated user to prevent open email relay abuse
    try {
      await requireAuth(req)
    } catch (error) {
      if (error instanceof Response) return error
      return jsonResponse(req, { success: false, error: 'Authentication required' }, 401)
    }

    let rawBody: EmailRequestBody
    try {
      rawBody = await req.json()
    } catch {
      return jsonResponse(req, { success: false, error: 'Invalid JSON payload' }, 400)
    }

    const parsed = parseAndValidateRequest(rawBody)
    if (!parsed.value) {
      return jsonResponse(req, { success: false, error: parsed.error || 'Invalid request body' }, 400)
    }

    const { to, toName, from, fromName, subject, template, data, html } = parsed.value
    const content = buildEmailContent({
      subject,
      html,
      template,
      data,
    })

    const resolvedFrom = from || DEFAULT_FROM_EMAIL
    const resolvedFromName = fromName || DEFAULT_FROM_NAME

    const providerErrors: string[] = []

    if (RESEND_API_KEY) {
      try {
        const resendResult = await sendWithResend({
          apiKey: RESEND_API_KEY,
          to,
          toName,
          from: resolvedFrom,
          fromName: resolvedFromName,
          content,
          timeoutMs: PROVIDER_TIMEOUT_MS,
        })

        return jsonResponse(req, {
          success: true,
          provider: resendResult.provider,
          messageId: resendResult.messageId,
        }, 200)
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Resend failed'
        providerErrors.push(errMsg)

        // Fallback: if the domain is not verified (403), retry with
        // Resend's sandbox sender onboarding@resend.dev which works
        // without domain verification. Remove once greenmarket-marketplace.web.app is verified.
        if (errMsg.includes('403') && errMsg.includes('not verified')) {
          try {
            const fallbackResult = await sendWithResend({
              apiKey: RESEND_API_KEY,
              to,
              toName,
              from: 'onboarding@resend.dev',
              fromName: resolvedFromName,
              content,
              timeoutMs: PROVIDER_TIMEOUT_MS,
            })

            return jsonResponse(req, {
              success: true,
              provider: fallbackResult.provider,
              messageId: fallbackResult.messageId,
              fallback: true,
              fallbackFrom: 'onboarding@resend.dev',
            }, 200)
          } catch (fallbackError) {
            providerErrors.push(
              `Fallback (onboarding@resend.dev) failed: ${fallbackError instanceof Error ? fallbackError.message : 'unknown error'}`
            )
          }
        }
      }
    }

    if (SENDGRID_API_KEY) {
      try {
        const sendgridResult = await sendWithSendGrid({
          apiKey: SENDGRID_API_KEY,
          to,
          toName,
          from: resolvedFrom,
          fromName: resolvedFromName,
          content,
          timeoutMs: PROVIDER_TIMEOUT_MS,
        })

        return jsonResponse(req, {
          success: true,
          provider: sendgridResult.provider,
        }, 200)
      } catch (error) {
        providerErrors.push(error instanceof Error ? error.message : 'SendGrid failed')
      }
    }

    if (!RESEND_API_KEY && !SENDGRID_API_KEY) {
      return jsonResponse(req, {
        success: false,
        error: 'No email provider configured',
        missing: {
          RESEND_API_KEY: true,
          SENDGRID_API_KEY: true,
        },
      }, 503)
    }

    return jsonResponse(req, {
      success: false,
      error: 'All configured email providers failed',
      providerErrors,
    }, 400)
  } catch (error) {
    return jsonResponse(req, {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }, 500)
  }
})
