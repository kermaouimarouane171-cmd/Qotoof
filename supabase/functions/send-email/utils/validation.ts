import type { EmailRequest, EmailRequestBody } from '../types.ts'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function escapeHtml(input: unknown): string {
  const value = String(input ?? '')
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function stripDangerousHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '')
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

export function parseAndValidateRequest(body: EmailRequestBody): { value?: EmailRequest; error?: string } {
  const to = asString(body.to)
  const subject = asString(body.subject)

  if (!to || !subject) {
    return { error: 'Missing required fields: to, subject' }
  }

  if (!EMAIL_REGEX.test(to)) {
    return { error: 'Invalid recipient email' }
  }

  if (subject.length > 200) {
    return { error: 'Invalid subject' }
  }

  const from = asString(body.from)
  if (from && !EMAIL_REGEX.test(from)) {
    return { error: 'Invalid from email' }
  }

  const html = asString(body.html)

  return {
    value: {
      to,
      toName: asString(body.toName),
      from,
      fromName: asString(body.fromName),
      subject,
      template: asString(body.template) || asString(body.type),
      data: asRecord(body.data),
      html,
    },
  }
}
