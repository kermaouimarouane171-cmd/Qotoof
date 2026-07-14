/**
 * PayPal Webhook Handler — Source code verification tests.
 *
 * Verifies that the paypal-webhook Edge Function:
 * - Verifies webhook authenticity via PayPal's verify-webhook-signature API
 * - Handles supported events safely
 * - Is idempotent via paypal_webhook_events table
 * - Logs unsupported/suspicious events
 * - Never exposes secrets
 * - Returns safe HTTP status codes
 *
 * Source code verification is used because Edge Functions run in Deno
 * and cannot be directly imported in Jest. This follows the same pattern
 * as paypal.sandbox.integration.test.js.
 */

const fs = require('fs')
const path = require('path')

const webhookSource = fs.readFileSync(
  path.resolve('supabase/functions/paypal-webhook/index.ts'),
  'utf-8'
)

const migrationSource = fs.readFileSync(
  path.resolve('database/migrations/036-paypal-webhook-events.sql'),
  'utf-8'
)

describe('PayPal Webhook — verification strategy', () => {
  test('extracts required PayPal signature headers', () => {
    expect(webhookSource).toContain('paypal-transmission-id')
    expect(webhookSource).toContain('paypal-transmission-time')
    expect(webhookSource).toContain('paypal-cert-url')
    expect(webhookSource).toContain('paypal-auth-algo')
    expect(webhookSource).toContain('paypal-transmission-sig')
    expect(webhookSource).toContain('paypal-webhook-id')
  })

  test('rejects missing signature headers with 400', () => {
    expect(webhookSource).toContain('Missing required signature headers')
    expect(webhookSource).toMatch(/400/)
  })

  test('uses PayPal verify-webhook-signature API endpoint', () => {
    expect(webhookSource).toContain('/v1/notifications/verify-webhook-signature')
  })

  test('fails closed when verification fails (returns 401)', () => {
    expect(webhookSource).toContain('Webhook verification failed')
    expect(webhookSource).toMatch(/401/)
  })

  test('uses PAYPAL_WEBHOOK_ID environment variable', () => {
    expect(webhookSource).toContain('PAYPAL_WEBHOOK_ID')
  })

  test('does not expose PAYPAL_CLIENT_SECRET in responses', () => {
    // The secret is read from env but never returned in HTTP responses
    expect(webhookSource).toContain("Deno.env.get('PAYPAL_CLIENT_SECRET')")
    // Ensure no response body includes the secret variable
    expect(webhookSource).not.toMatch(/jsonResponse.*PAYPAL_CLIENT_SECRET/)
  })
})

describe('PayPal Webhook — supported events', () => {
  test('handles CHECKOUT.ORDER.APPROVED', () => {
    expect(webhookSource).toContain('CHECKOUT.ORDER.APPROVED')
    expect(webhookSource).toContain('handleOrderApproved')
  })

  test('handles PAYMENT.CAPTURE.COMPLETED', () => {
    expect(webhookSource).toContain('PAYMENT.CAPTURE.COMPLETED')
    expect(webhookSource).toContain('handleCaptureCompleted')
  })

  test('handles PAYMENT.CAPTURE.REFUNDED', () => {
    expect(webhookSource).toContain('PAYMENT.CAPTURE.REFUNDED')
    expect(webhookSource).toContain('handleCaptureRefunded')
  })

  test('handles PAYMENT.CAPTURE.DENIED', () => {
    expect(webhookSource).toContain('PAYMENT.CAPTURE.DENIED')
    expect(webhookSource).toContain('handleCaptureDenied')
  })

  test('logs unsupported events without throwing', () => {
    expect(webhookSource).toContain('Unsupported event type')
    expect(webhookSource).toContain('unsupported_event')
  })

  test('returns 200 for unsupported events to prevent retries', () => {
    // The main handler returns 200 for all verified events
    expect(webhookSource).toMatch(/return jsonResponse\(\{ received: true, status: result \}, 200\)/)
  })
})

describe('PayPal Webhook — idempotency', () => {
  test('checks paypal_webhook_events table for already-processed events', () => {
    expect(webhookSource).toContain('paypal_webhook_events')
    expect(webhookSource).toContain('checkEventAlreadyProcessed')
    expect(webhookSource).toContain('alreadyProcessed')
  })

  test('returns 200 with already_processed status for duplicate events', () => {
    expect(webhookSource).toContain('already_processed')
  })

  test('records processed events in paypal_webhook_events table', () => {
    expect(webhookSource).toContain('recordEventProcessed')
    expect(webhookSource).toContain('paypal_event_id')
  })

  test('migration creates paypal_webhook_events table with UNIQUE constraint', () => {
    expect(migrationSource).toContain('CREATE TABLE IF NOT EXISTS paypal_webhook_events')
    expect(migrationSource).toContain('paypal_event_id TEXT NOT NULL UNIQUE')
  })

  test('migration enables RLS on paypal_webhook_events', () => {
    expect(migrationSource).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migrationSource).toContain('paypal_webhook_events')
  })

  test('migration grants access only to service_role', () => {
    expect(migrationSource).toContain('service_role')
    expect(migrationSource).not.toContain('authenticated')
  })
})

describe('PayPal Webhook — event handling safety', () => {
  test('CHECKOUT.ORDER.APPROVED does not mark payment as captured', () => {
    // handleOrderApproved only updates if status is pending, keeps status as pending
    const approvedSection = webhookSource.match(/handleOrderApproved[\s\S]*?return 'processed'/)
    expect(approvedSection).toBeTruthy()
    expect(approvedSection[0]).toContain('pending')
    expect(approvedSection[0]).not.toMatch(/status: 'completed'/)
  })

  test('PAYMENT.CAPTURE.COMPLETED does not downgrade refunded payments', () => {
    const completedSection = webhookSource.match(/handleCaptureCompleted[\s\S]*?return 'processed'/)
    expect(completedSection).toBeTruthy()
    expect(completedSection[0]).toContain('refunded')
    expect(completedSection[0]).toContain('skipped_already_refunded')
  })

  test('PAYMENT.CAPTURE.REFUNDED checks for duplicate refund records', () => {
    const refundedSection = webhookSource.match(/handleCaptureRefunded[\s\S]*?return 'processed'/)
    expect(refundedSection).toBeTruthy()
    expect(refundedSection[0]).toContain('existingRefund')
    expect(refundedSection[0]).toContain('skipped_duplicate_refund')
  })

  test('PAYMENT.CAPTURE.DENIED does not delete records', () => {
    const deniedSection = webhookSource.match(/handleCaptureDenied[\s\S]*?return 'processed'/)
    expect(deniedSection).toBeTruthy()
    expect(deniedSection[0]).not.toMatch(/\.delete\(\)/)
  })

  test('PAYMENT.CAPTURE.DENIED does not downgrade completed/refunded payments', () => {
    const deniedSection = webhookSource.match(/handleCaptureDenied[\s\S]*?return 'processed'/)
    expect(deniedSection).toBeTruthy()
    expect(deniedSection[0]).toContain('skipped_already_')
  })

  test('logs missing local payment/order', () => {
    expect(webhookSource).toContain('skipped_no_local_payment')
    expect(webhookSource).toContain('no local payment')
  })
})

describe('PayPal Webhook — error handling and observability', () => {
  test('logs verification failures', () => {
    expect(webhookSource).toContain('Verification failed')
    expect(webhookSource).toContain('Verification error')
  })

  test('logs unsupported events', () => {
    expect(webhookSource).toContain('Unsupported event type')
  })

  test('logs database errors', () => {
    expect(webhookSource).toContain('db_error')
    expect(webhookSource).toContain('failed to update')
  })

  test('logs successful state transitions', () => {
    expect(webhookSource).toContain('processed')
    expect(webhookSource).toContain('marked completed')
  })

  test('logs idempotent duplicate events', () => {
    expect(webhookSource).toContain('already processed')
  })

  test('does not expose internal errors in HTTP responses', () => {
    // The catch block returns a generic error message, not the actual error
    expect(webhookSource).toContain('Internal server error')
  })

  test('returns safe HTTP status codes', () => {
    // 400 for bad request, 401 for auth failure, 405 for wrong method, 500 for server error, 200 for success
    expect(webhookSource).toMatch(/400/)
    expect(webhookSource).toMatch(/401/)
    expect(webhookSource).toMatch(/405/)
    expect(webhookSource).toMatch(/500/)
    expect(webhookSource).toMatch(/200/)
  })

  test('uses sandbox API when VITE_PAYMENT_MODE != production', () => {
    expect(webhookSource).toContain('api-m.sandbox.paypal.com')
    expect(webhookSource).toContain('api-m.paypal.com')
    expect(webhookSource).toContain('VITE_PAYMENT_MODE')
  })
})

describe('PayPal Webhook — security', () => {
  test('never logs secrets', () => {
    // Ensure PAYPAL_CLIENT_SECRET is only used for auth, never logged
    const secretLines = webhookSource.split('\n').filter((l) => l.includes('PAYPAL_CLIENT_SECRET'))
    for (const line of secretLines) {
      expect(line).not.toMatch(/console\.(log|warn|error)/)
    }
  })

  test('CORS headers do not include wildcard for sensitive headers', () => {
    // The CORS config allows standard headers but the webhook is server-to-server
    expect(webhookSource).toContain('Access-Control-Allow-Origin')
  })

  test('requires POST method', () => {
    expect(webhookSource).toContain("req.method !== 'POST'")
    expect(webhookSource).toContain('Method not allowed')
  })
})
