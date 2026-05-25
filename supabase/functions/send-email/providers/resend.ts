import type { ProviderSuccess, SendProviderArgs } from '../types.ts'
import { fetchWithTimeout, readResponseBodySafe } from '../utils/http.ts'

export async function sendWithResend(args: SendProviderArgs): Promise<ProviderSuccess> {
  const response = await fetchWithTimeout(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${args.fromName} <${args.from}>`,
        to: [args.to],
        subject: args.content.subject,
        html: args.content.html,
      }),
    },
    args.timeoutMs,
  )

  const bodyText = await readResponseBodySafe(response)

  if (!response.ok) {
    throw new Error(`Resend failed with ${response.status}: ${bodyText || 'empty response'}`)
  }

  let payload: Record<string, unknown> = {}
  try {
    payload = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    payload = {}
  }

  return {
    provider: 'resend',
    messageId: typeof payload.id === 'string' ? payload.id : undefined,
  }
}
