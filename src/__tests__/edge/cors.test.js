import fs from 'fs'
import path from 'path'

describe('FG-002 — Edge Function CORS uses allowed origins, no wildcard', () => {
  const functionsDir = path.resolve(__dirname, '../../../supabase/functions')

  test('no Edge Function sets Access-Control-Allow-Origin to wildcard', () => {
    const functionFiles = []
    const walkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'node_modules') {
          walkDir(fullPath)
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          functionFiles.push(fullPath)
        }
      }
    }
    walkDir(functionsDir)

    const wildcardPattern = /Access-Control-Allow-Origin\s*:\s*['"]?\*/
    const violatingFiles = []
    for (const file of functionFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      if (wildcardPattern.test(content)) {
        violatingFiles.push(file)
      }
    }
    expect(violatingFiles).toEqual([])
  })

  test('shared CORS helper uses allowed origins and rejects unknown origins', () => {
    const corsSource = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/functions/_shared/cors.ts'),
      'utf-8'
    )
    expect(corsSource).toContain('ALLOWED_ORIGINS')
    expect(corsSource).toContain('isAllowedOrigin')
    expect(corsSource).not.toMatch(/ALLOWED_ORIGINS\[0\]\s*\?\?/)
    expect(corsSource).toMatch(/ALLOWED_ORIGINS\.includes\(requestOrigin\)/)
  })
})
