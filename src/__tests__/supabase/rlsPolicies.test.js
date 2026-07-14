import fs from 'fs'
import path from 'path'

describe('RLS policies — P0 security fixes (SEC-001, SEC-002, SEC-003)', () => {
  const migration037Path = path.resolve(__dirname, '../../../database/migrations/037-fix-open-insert-rls-policies.sql')
  const migration031Path = path.resolve(__dirname, '../../../database/migrations/031-unified-rls-policies.sql')
  const migration037 = fs.readFileSync(migration037Path, 'utf-8')
  const migration031 = fs.readFileSync(migration031Path, 'utf-8')

  describe('SEC-001 — payments_system_insert restricted to service_role', () => {
    test('migration 037 drops the old open payments_system_insert policy', () => {
      expect(migration037).toContain('DROP POLICY IF EXISTS "payments_system_insert" ON payments')
    })

    test('migration 037 creates payments_service_insert restricted to service_role', () => {
      expect(migration037).toContain('CREATE POLICY "payments_service_insert" ON payments FOR INSERT TO service_role')
    })

    test('migration 031 originally had open payments_system_insert with WITH CHECK (true)', () => {
      expect(migration031).toContain('payments_system_insert')
      expect(migration031).toContain('payments FOR INSERT WITH CHECK (true)')
    })

    test('no authenticated or anon INSERT policy on payments remains in migration 037', () => {
      const lines = migration037.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes('CREATE POLICY') && line.includes('payments') && line.includes('INSERT')) {
          if (!line.includes('service_role')) {
            throw new Error(
              `Found non-service_role INSERT policy on payments at line ${i + 1}: ${line.trim()}`
            )
          }
        }
      }
    })

    test('buyer cannot insert completed payment manually (policy is service_role only)', () => {
      expect(migration037).not.toMatch(/payments.*INSERT.*TO\s+authenticated/)
      expect(migration037).not.toMatch(/payments.*INSERT.*TO\s+anon/)
    })
  })

  describe('SEC-002 — deliveries_system_insert restricted to service_role', () => {
    test('migration 037 drops the old open deliveries_system_insert policy', () => {
      expect(migration037).toContain('DROP POLICY IF EXISTS "deliveries_system_insert" ON deliveries')
    })

    test('migration 037 creates deliveries_service_insert restricted to service_role', () => {
      expect(migration037).toContain('CREATE POLICY "deliveries_service_insert" ON deliveries FOR INSERT TO service_role')
    })

    test('no authenticated or anon INSERT policy on deliveries remains in migration 037', () => {
      const lines = migration037.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes('CREATE POLICY') && line.includes('deliveries') && line.includes('INSERT')) {
          if (!line.includes('service_role')) {
            throw new Error(
              `Found non-service_role INSERT policy on deliveries at line ${i + 1}: ${line.trim()}`
            )
          }
        }
      }
    })

    test('buyer cannot insert fake delivery records (policy is service_role only)', () => {
      expect(migration037).not.toMatch(/deliveries.*INSERT.*TO\s+authenticated/)
      expect(migration037).not.toMatch(/deliveries.*INSERT.*TO\s+anon/)
    })
  })

  describe('SEC-003 — notifications_system_insert restricted to service_role', () => {
    test('migration 037 drops the old open notifications_system_insert policy', () => {
      expect(migration037).toContain('DROP POLICY IF EXISTS "notifications_system_insert" ON notifications')
    })

    test('migration 037 creates notifications_service_insert restricted to service_role', () => {
      expect(migration037).toContain('CREATE POLICY "notifications_service_insert" ON notifications FOR INSERT TO service_role')
    })

    test('no authenticated or anon INSERT policy on notifications remains in migration 037', () => {
      const lines = migration037.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.includes('CREATE POLICY') && line.includes('notifications') && line.includes('INSERT')) {
          if (!line.includes('service_role')) {
            throw new Error(
              `Found non-service_role INSERT policy on notifications at line ${i + 1}: ${line.trim()}`
            )
          }
        }
      }
    })

    test('buyer cannot spam notifications to other users (policy is service_role only)', () => {
      expect(migration037).not.toMatch(/notifications.*INSERT.*TO\s+authenticated/)
      expect(migration037).not.toMatch(/notifications.*INSERT.*TO\s+anon/)
    })
  })

  describe('SEC-004 — order_timeline_system_insert also restricted (P1 bonus)', () => {
    test('migration 037 drops the old open order_timeline_system_insert policy', () => {
      expect(migration037).toContain('DROP POLICY IF EXISTS "order_timeline_system_insert" ON order_timeline')
    })

    test('migration 037 creates order_timeline_service_insert restricted to service_role', () => {
      expect(migration037).toContain('CREATE POLICY "order_timeline_service_insert" ON order_timeline FOR INSERT TO service_role')
    })
  })

  describe('Users can still read/update their own notifications', () => {
    test('migration 031 has notifications_user_select for own notifications', () => {
      expect(migration031).toContain('notifications_user_select')
      expect(migration031).toContain('user_id = auth.uid()')
    })

    test('migration 031 has notifications_user_update for own notifications', () => {
      expect(migration031).toContain('notifications_user_update')
    })
  })

  describe('RLS is not disabled on any of the secured tables', () => {
    test('payments RLS is enabled in migration 031', () => {
      expect(migration031).toContain('ALTER TABLE payments ENABLE ROW LEVEL SECURITY')
    })

    test('deliveries RLS is enabled in migration 031', () => {
      expect(migration031).toContain('ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY')
    })

    test('notifications RLS is enabled in migration 031', () => {
      expect(migration031).toContain('ALTER TABLE notifications ENABLE ROW LEVEL SECURITY')
    })
  })
})
