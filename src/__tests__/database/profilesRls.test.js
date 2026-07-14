import fs from 'fs'
import path from 'path'

describe('FG-001 — profiles_public_select exposure', () => {
  const migrationsDir = path.resolve(__dirname, '../../../database/migrations')
  const supabaseMigrationsDir = path.resolve(__dirname, '../../../supabase/migrations')

  test('migration 038 drops profiles_public_select and keeps only public_profiles as public-safe view', () => {
    const latestMigration = path.resolve(migrationsDir, '038-fix-profiles-public-select-exposure.sql')
    expect(fs.existsSync(latestMigration)).toBe(true)
    const content = fs.readFileSync(latestMigration, 'utf-8')
    expect(content).toContain('DROP POLICY IF EXISTS "profiles_public_select" ON public.profiles')
    expect(content).toContain('CREATE OR REPLACE VIEW public.public_profiles')
    expect(content).toContain('GRANT SELECT ON public.public_profiles TO authenticated, anon')
  })

  test('no later migration re-introduces the blanket profiles_public_select policy', () => {
    const files = [
      ...fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).map((f) => path.join(migrationsDir, f)),
      ...fs.readdirSync(supabaseMigrationsDir).filter((f) => f.endsWith('.sql')).map((f) => path.join(supabaseMigrationsDir, f)),
    ]

    const badPattern = /CREATE\s+POLICY\s+["']?profiles_public_select["']?\s+ON\s+.*?\s+FOR\s+SELECT\s+.*?\s+USING\s*\(\s*true\s*\)/is
    const numberedPattern = /^(\d+)-/

    const offenders = []
    for (const file of files) {
      const basename = path.basename(file)
      const match = basename.match(numberedPattern)
      if (!match) continue
      const number = Number(match[1])
      if (number <= 38) continue
      const content = fs.readFileSync(file, 'utf-8')
      if (badPattern.test(content)) {
        offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })
})
