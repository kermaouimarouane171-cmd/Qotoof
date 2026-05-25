import fs from 'node:fs'
import path from 'node:path'

describe('CSP policy', () => {
  it('allows pixabay images used by seeded product data', () => {
    const indexPath = path.resolve(__dirname, '../../../index.html')
    const html = fs.readFileSync(indexPath, 'utf-8')

    expect(html).toContain('img-src')
    expect(html).toContain('https://cdn.pixabay.com')
  })
})
