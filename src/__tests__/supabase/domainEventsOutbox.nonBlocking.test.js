import fs from 'fs'
import path from 'path'

describe('domain_events_outbox inserts are non-blocking in Edge Functions', () => {
  const functions = [
    {
      name: 'register-payment-receipt',
      filePath: path.resolve(__dirname, '../../../supabase/functions/register-payment-receipt/index.ts'),
    },
    {
      name: 'mark-delivery-delivered',
      filePath: path.resolve(__dirname, '../../../supabase/functions/mark-delivery-delivered/index.ts'),
    },
    {
      name: 'accept-order',
      filePath: path.resolve(__dirname, '../../../supabase/functions/accept-order/index.ts'),
    },
    {
      name: 'reject-order',
      filePath: path.resolve(__dirname, '../../../supabase/functions/reject-order/index.ts'),
    },
    {
      name: 'assign-driver',
      filePath: path.resolve(__dirname, '../../../supabase/functions/assign-driver/index.ts'),
    },
  ]

  functions.forEach(({ name, filePath }) => {
    const source = fs.readFileSync(filePath, 'utf-8')

    test(`${name} contains a domain_events_outbox insert`, () => {
      expect(source).toMatch(/from\(['"]domain_events_outbox['"]\)\s*\.\s*insert\(/)
    })

    test(`${name} outbox insert is inside an isolated try block`, () => {
      const outboxIdx = source.indexOf("from('domain_events_outbox')")
      expect(outboxIdx).toBeGreaterThan(-1)

      // Find try before outbox
      const tryBefore = source.lastIndexOf('try {', outboxIdx)
      expect(tryBefore).toBeGreaterThan(-1)

      // Find catch(outboxError) after outbox
      const catchAfter = source.indexOf('catch (outboxError)', outboxIdx)
      expect(catchAfter).toBeGreaterThan(-1)

      // Ensure the catch is before any outer catch
      const outerCatch = source.indexOf('catch (error)', outboxIdx)
      if (outerCatch > -1) {
        expect(catchAfter).toBeLessThan(outerCatch)
      }
    })

    test(`${name} has console.warn on outbox failure`, () => {
      expect(source).toContain("console.warn('[outbox] insert failed; continuing without blocking main operation'")
    })

    test(`${name} does NOT throw directly from outbox insert`, () => {
      const outboxIdx = source.indexOf("from('domain_events_outbox')")
      expect(outboxIdx).toBeGreaterThan(-1)

      const tryStart = source.lastIndexOf('try {', outboxIdx)
      const catchEnd = source.indexOf('}', source.indexOf('catch (outboxError)', outboxIdx))
      const outboxSection = source.slice(tryStart, catchEnd + 1)
      expect(outboxSection).not.toMatch(/throw\s+new\s+Error/)
    })

    test(`${name} response does not depend on outbox success`, () => {
      const catchAfter = source.indexOf('catch (outboxError)')
      expect(catchAfter).toBeGreaterThan(-1)

      // There should be a return after the outbox catch block
      const returnAfter = source.indexOf('return', catchAfter)
      expect(returnAfter).toBeGreaterThan(-1)
    })
  })
})
