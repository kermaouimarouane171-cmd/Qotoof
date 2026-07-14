import fs from 'fs'
import path from 'path'

describe('Guest/anon RLS hardening — migration 040', () => {
  const migrationsDir = path.resolve(__dirname, '../../../database/migrations')
  const supabaseMigrationsDir = path.resolve(__dirname, '../../../supabase/migrations')

  test('migration 040 exists and fixes remaining anon RLS exposures', () => {
    const migration = path.resolve(migrationsDir, '040-fix-remaining-anon-rls.sql')
    expect(fs.existsSync(migration)).toBe(true)
    const content = fs.readFileSync(migration, 'utf-8')

    // driver_locations: remove public_select, add authenticated-only select
    expect(content).toContain('DROP POLICY IF EXISTS "driver_locations_public_select" ON public.driver_locations')
    expect(content).toContain('CREATE POLICY "driver_locations_authenticated_select"')
    expect(content).toContain('TO authenticated')

    // payment_methods: remove public_select / read_all, add authenticated-only select
    expect(content).toContain('DROP POLICY IF EXISTS "payment_methods_public_select" ON public.payment_methods')
    expect(content).toContain('DROP POLICY IF EXISTS "payment_methods_read_all" ON public.payment_methods')
    expect(content).toContain('CREATE POLICY "payment_methods_authenticated_select"')

    // contact_messages: remove public_insert, add authenticated-only insert
    expect(content).toContain('DROP POLICY IF EXISTS "contact_messages_public_insert" ON public.contact_messages')
    expect(content).toContain('CREATE POLICY "contact_messages_authenticated_insert"')

    // MFA functions: revoke PUBLIC, grant authenticated
    expect(content).toContain('REVOKE ALL ON FUNCTION public.verify_mfa_code(UUID, TEXT, TEXT DEFAULT \'email\') FROM PUBLIC')
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.verify_mfa_code(UUID, TEXT, TEXT DEFAULT \'email\') TO authenticated')
    expect(content).toContain('REVOKE ALL ON FUNCTION public.verify_otp(UUID, TEXT, TEXT DEFAULT \'mfa_verify\') FROM PUBLIC')
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.verify_otp(UUID, TEXT, TEXT DEFAULT \'mfa_verify\') TO authenticated')
  })

  test('no later migration re-introduces blanket anon access for the fixed tables', () => {
    const files = [
      ...fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).map((f) => path.join(migrationsDir, f)),
      ...fs.readdirSync(supabaseMigrationsDir).filter((f) => f.endsWith('.sql')).map((f) => path.join(supabaseMigrationsDir, f)),
    ]

    const badPatterns = [
      // driver_locations open to anon
      /CREATE\s+POLICY\s+["']?driver_locations_public_select["']?\s+ON\s+.*driver_locations\s+FOR\s+SELECT\s+.*\b(anon|public)\b/is,
      // payment_methods open to anon
      /CREATE\s+POLICY\s+["']?(payment_methods_public_select|payment_methods_read_all)["']?\s+ON\s+.*payment_methods\s+FOR\s+SELECT\s+.*\b(anon|public)\b/is,
      // contact_messages open to anon
      /CREATE\s+POLICY\s+["']?contact_messages_public_insert["']?\s+ON\s+.*contact_messages\s+FOR\s+INSERT\s+.*\b(anon|public)\b/is,
    ]

    const numberedPattern = /^(\d+)-/
    const offenders = []

    for (const file of files) {
      const basename = path.basename(file)
      const match = basename.match(numberedPattern)
      if (!match) continue
      const number = Number(match[1])
      if (number <= 40) continue
      const content = fs.readFileSync(file, 'utf-8')
      for (const pattern of badPatterns) {
        if (pattern.test(content)) {
          offenders.push(file)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
