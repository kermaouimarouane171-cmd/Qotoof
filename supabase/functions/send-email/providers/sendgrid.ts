import type { ProviderSuccess, SendProviderArgs } from '../types.ts'
import { fetchWithTimeout, readResponseBodySafe } from '../utils/http.ts'

export async function sendWithSendGrid(args: SendProviderArgs): Promise<ProviderSuccess> {
  const response = await fetchWithTimeout(
    'https://api.sendgrid.com/v3/mail/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: args.to, name: args.toName }] }],
        from: { email: args.from, name: args.fromName },
        subject: args.content.subject,
        content: [{ type: 'text/html', value: args.content.html }],
      }),
    },
    args.timeoutMs,
  )

  const bodyText = await readResponseBodySafe(response)

  if (!response.ok) {
    throw new Error(`SendGrid failed with ${response.status}: ${bodyText || 'empty response'}`)
  }

  return {
    provider: 'sendgrid',
  }
}
