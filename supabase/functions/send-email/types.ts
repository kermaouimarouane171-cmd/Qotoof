export type TemplateName =
  | 'order_confirmation'
  | 'order_status_update'
  | 'password_reset'
  | 'welcome'
  | 'otp_verification'

export type EmailRequestBody = {
  to?: unknown
  toName?: unknown
  from?: unknown
  fromName?: unknown
  subject?: unknown
  template?: unknown
  type?: unknown
  data?: unknown
  html?: unknown
}

export type EmailRequest = {
  to: string
  toName?: string
  from?: string
  fromName?: string
  subject: string
  template?: string
  data: Record<string, unknown>
  html?: string
}

export type EmailContent = {
  subject: string
  html: string
}

export type ProviderSuccess = {
  provider: 'resend' | 'sendgrid'
  messageId?: string
}

export type SendProviderArgs = {
  apiKey: string
  to: string
  toName?: string
  from: string
  fromName: string
  content: EmailContent
  timeoutMs: number
}
