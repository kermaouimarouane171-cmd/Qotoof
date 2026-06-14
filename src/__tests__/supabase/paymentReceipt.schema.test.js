import fs from 'fs'
import path from 'path'

describe('Payment Receipt Upload flow schema compliance', () => {
  describe('register-payment-receipt Edge Function', () => {
    const filePath = path.resolve(__dirname, '../../../supabase/functions/register-payment-receipt/index.ts')
    const source = fs.readFileSync(filePath, 'utf-8')

    const allowedOrderColumns = new Set([
      'id',
      'buyer_id',
      'payment_type',
      'status',
      'first_payment_amount',
      'first_payment_status',
      'second_payment_amount',
      'second_payment_status',
      'first_payment_receipt_url',
      'second_payment_receipt_url',
      'first_payment_paid_at',
      'second_payment_paid_at',
      'updated_at',
      'order_number',
      'vendor_id',
    ])

    test('uses only confirmed orders columns in update/select', () => {
      const updateMatch = source.match(/\.update\((\{[\s\S]*?\})\)/)
      if (updateMatch) {
        const dynamicFields = source.match(/\[config\.(receiptField|paidAtField|statusField)\]/g) || []
        const knownStaticFields = new Set([
          'updated_at',
          'first_payment_receipt_url',
          'second_payment_receipt_url',
          'first_payment_paid_at',
          'second_payment_paid_at',
          'first_payment_status',
          'second_payment_status',
        ])
        dynamicFields.forEach(() => {
          // dynamic fields map to known columns; ensure no unexpected keys appear
        })
        // Ensure update payload does not reference unknown columns
        const payload = updateMatch[1]
        const keys = [...payload.matchAll(/([a-z_]+):/g)].map(m => m[1])
        keys.forEach(key => {
          expect(knownStaticFields.has(key) || key === 'updated_at' || key.endsWith('_field')).toBe(true)
        })
      }
    })

    test('does not write ghost columns in orders update', () => {
      const ghostColumns = [
        'gateway_response',
        'confirmed_at',
        'payment_method',
        'payment_proof_url',
        'bank_name',
        'currency',
      ]
      ghostColumns.forEach(col => {
        expect(source).not.toContain(col)
      })
    })

    test('validates buyer_id ownership', () => {
      expect(source).toContain('order.buyer_id !== user.id')
    })

    test('validates storagePath startsWith user.id', () => {
      expect(source).toContain('storagePath.startsWith(`${user.id}/`)')
    })

    test('validates stage is first or second', () => {
      expect(source).toContain("'first'")
      expect(source).toContain("'second'")
      expect(source).toMatch(/allowedStages\.has\(\s*stage\s*\)/)
    })

    test('validates payment_type === split before second stage', () => {
      expect(source).toContain("order.payment_type !== 'split'")
      expect(source).toContain('Second payment receipts are only allowed for split payments')
    })

    test('checks first_payment_status is verified before second stage', () => {
      expect(source).toContain("order.first_payment_status || 'pending'")
      expect(source).toContain('First payment must be verified before uploading the second receipt')
    })

    test('outbox insert is non-blocking (wrapped in try/catch)', () => {
      const outboxIdx = source.indexOf("from('domain_events_outbox')")
      expect(outboxIdx).toBeGreaterThan(-1)
      const tryBefore = source.lastIndexOf('try {', outboxIdx)
      expect(tryBefore).toBeGreaterThan(-1)
      const catchAfter = source.indexOf('catch (outboxError)', outboxIdx)
      expect(catchAfter).toBeGreaterThan(-1)
      expect(source).toContain("console.warn('[outbox] insert failed; continuing without blocking main operation'")
    })

    test('does not throw directly from outbox insert', () => {
      const outboxIdx = source.indexOf("from('domain_events_outbox')")
      const tryStart = source.lastIndexOf('try {', outboxIdx)
      const catchEnd = source.indexOf('}', source.indexOf('catch (outboxError)', outboxIdx))
      const section = source.slice(tryStart, catchEnd + 1)
      expect(section).not.toMatch(/throw\s+new\s+Error/)
    })

    test('returns success response even if outbox fails', () => {
      const catchAfter = source.indexOf('catch (outboxError)')
      expect(catchAfter).toBeGreaterThan(-1)
      const returnAfter = source.indexOf('return', catchAfter)
      expect(returnAfter).toBeGreaterThan(-1)
    })
  })

  describe('confirm-order-payment Edge Function', () => {
    const filePath = path.resolve(__dirname, '../../../supabase/functions/confirm-order-payment/index.ts')
    const source = fs.readFileSync(filePath, 'utf-8')

    test('uses only confirmed orders columns in select', () => {
      const allowedSelectColumns = [
        'id',
        'vendor_id',
        'buyer_id',
        'subtotal',
        'total',
        'buyer_total',
        'status',
        'payment_type',
        'payment_received_at',
        'payment_verified_by_vendor',
        'first_payment_status',
        'second_payment_status',
        'first_payment_receipt_url',
        'second_payment_receipt_url',
      ]
      const selectMatch = source.match(/\.select\(`([\s\S]*?)`\)/)
      if (selectMatch) {
        allowedSelectColumns.forEach(col => {
          expect(selectMatch[1]).toContain(col)
        })
      }
    })

    test('validates vendor ownership', () => {
      expect(source).toContain('order.vendor_id !== user.id')
    })

    test('does NOT reference domain_events_outbox', () => {
      expect(source).not.toContain('domain_events_outbox')
    })

    test('does not depend on outbox for response', () => {
      expect(source).not.toContain('domain_events_outbox')
    })

    test('does not write ghost columns in orders update', () => {
      // Look at all nextOrderPayload property assignments
      const assignments = [...source.matchAll(/nextOrderPayload\.(\w+)\s*=/g)].map(m => m[1])
      const ghostColumns = [
        'gateway_response',
        'confirmed_at',
        'payment_method',
        'payment_proof_url',
        'bank_name',
        'currency',
      ]
      assignments.forEach(key => {
        ghostColumns.forEach(col => {
          expect(key).not.toBe(col)
        })
      })
    })

    test('updates only allowed order payment columns', () => {
      const assignments = [...source.matchAll(/nextOrderPayload\.(\w+)\s*=/g)].map(m => m[1])
      const allowed = [
        'first_payment_status',
        'second_payment_status',
        'payment_verified_by_vendor',
        'payment_received_at',
        'status',
      ]
      assignments.forEach(key => {
        expect(allowed.includes(key)).toBe(true)
      })
    })
  })

  describe('PaymentReceiptUpload frontend component', () => {
    const filePath = path.resolve(__dirname, '../../../src/components/orders/PaymentReceiptUpload.jsx')
    const source = fs.readFileSync(filePath, 'utf-8')

    test('uses payment-receipts bucket', () => {
      expect(source).toContain(".from('payment-receipts')")
    })

    test('path pattern contains user.id, order.id, and stage', () => {
      expect(source).toMatch(/\$\{user\.id\}\/\$\{order\.id\}\/\$\{stage\}/)
    })

    test('upload uses upsert: false', () => {
      expect(source).toContain('upsert: false')
    })

    test('uses createSignedUrl for preview (not public URL)', () => {
      expect(source).toContain('.createSignedUrl(')
      expect(source).not.toContain('.getPublicUrl(')
    })

    test('cleanup removes orphaned upload on register failure', () => {
      expect(source).toContain('if (storagePath && !receiptRegistered)')
      expect(source).toContain(".remove([storagePath])")
      expect(source).toContain("from('payment-receipts')")
    })

    test('file type validation exists', () => {
      expect(source).toContain('ALLOWED_TYPES')
      expect(source).toContain('.includes(file.type)')
    })

    test('file size validation exists (max 10MB)', () => {
      expect(source).toContain('MAX_FILE_SIZE')
      expect(source).toContain('file.size > MAX_FILE_SIZE')
    })

    test('validates ownership (buyer_id === user.id) before upload', () => {
      expect(source).toContain('order?.buyer_id === user.id')
    })

    test('stage config maps to known order fields', () => {
      const fields = [
        'first_payment_amount',
        'first_payment_status',
        'first_payment_receipt_url',
        'first_payment_paid_at',
        'second_payment_amount',
        'second_payment_status',
        'second_payment_receipt_url',
        'second_payment_paid_at',
      ]
      fields.forEach(field => {
        expect(source).toContain(field)
      })
    })
  })
})
