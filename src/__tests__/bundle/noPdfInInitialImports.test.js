import fs from 'fs'
import path from 'path'

describe('bundle: no @react-pdf/renderer in initial imports', () => {
  const distDir = path.resolve(__dirname, '../../../dist')

  it('does not statically import @capacitor/core from persistStorage.js', () => {
    const file = fs.readFileSync(
      path.resolve(__dirname, '../../utils/persistStorage.js'),
      'utf8'
    )
    expect(file).not.toMatch(/import\s.*['"]@capacitor\/core['"]/)
  })

  it('index chunk does not import from vendor-polyfills', () => {
    if (!fs.existsSync(distDir)) return // skip if no build
    const jsDir = path.join(distDir, 'assets/js')
    if (!fs.existsSync(jsDir)) return // skip if no assets/js
    const idxFile = fs.readdirSync(jsDir).find(f => f.startsWith('index-') && f.endsWith('.js') && !f.endsWith('.js.map'))
    if (!idxFile) return
    const code = fs.readFileSync(path.join(jsDir, idxFile), 'utf8')
    expect(code).not.toMatch(/import\{[^}]+\}from"[^"]*vendor-polyfills/)
  })
})
