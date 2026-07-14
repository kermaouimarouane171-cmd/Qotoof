import fs from 'fs'
import path from 'path'

const storeDetailPath = path.resolve(__dirname, '../../pages/StoreDetail.jsx')
const storeDetailSource = fs.readFileSync(storeDetailPath, 'utf-8')

describe('StoreDetail.jsx — follow/unfollow temporarily disabled', () => {
  test('does not query store_follows in active code', () => {
    // Check for active (uncommented) store_follows queries
    const lines = storeDetailSource.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip comment lines and lines inside block comments
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue
      }
      // Inside multi-line comments, skip
      // Simple heuristic: if line has /* before store_follows but no */, it's likely inside comment
      if (line.includes('store_follows')) {
        // Check if this line is inside a block comment
        const beforeLine = lines.slice(0, i + 1).join('\n')
        const commentStarts = (beforeLine.match(/\/\*/g) || []).length
        const commentEnds = (beforeLine.match(/\*\//g) || []).length
        if (commentStarts > commentEnds) {
          continue // inside block comment
        }
        throw new Error(`Found active store_follows reference on line ${i + 1}: ${line}`)
      }
    }
  })

  test('contains TEMPORARILY DISABLED comment explaining follow removal', () => {
    expect(storeDetailSource).toContain('TEMPORARILY DISABLED: store_follows.store_id references stores.id')
  })

  test('checkFollowStatus is a no-op (returns early)', () => {
    // After the function definition, the first active statement should be `return`
    const funcMatch = storeDetailSource.match(/const _checkFollowStatus = useCallback\(async \(\) => \{([\s\S]*?)\}, \[\]\)/)
    expect(funcMatch).toBeTruthy()
    const funcBody = funcMatch[1]
    const activeLines = funcBody
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('//') && !l.startsWith('*'))
    expect(activeLines[0]).toBe('return')
  })

  test('handleFollowStore is a no-op (returns early)', () => {
    const funcMatch = storeDetailSource.match(/const _handleFollowStore = async \(\) => \{([\s\S]*?)\n  \}/)
    expect(funcMatch).toBeTruthy()
    const funcBody = funcMatch[1]
    const activeLines = funcBody
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('//') && !l.startsWith('*'))
    expect(activeLines[0]).toBe('return')
  })

  test('follow button is commented out in JSX', () => {
    // Find the button area and ensure it's wrapped in {/* ... */}
    const buttonArea = storeDetailSource.substring(
      storeDetailSource.indexOf('Follow Button'),
      storeDetailSource.indexOf('Call Seller')
    )
    expect(buttonArea).toContain('{/*')
    expect(buttonArea).toContain('*/}')
  })

  test('store profile loading via /stores/:id uses public_vendor_profiles view for guest access', () => {
    expect(storeDetailSource).toMatch(/\.from\(['"]public_vendor_profiles['"]\)/)
    expect(storeDetailSource).not.toMatch(/\.from\(['"]profiles['"]\)/)
  })

  test('products still load by vendor_id', () => {
    expect(storeDetailSource).toContain(".eq('vendor_id', id)")
  })

  test('reviews still load by vendor_id', () => {
    expect(storeDetailSource).toMatch(/\.eq\(['"]vendor_id['"],\s*id\)/)
  })
})
