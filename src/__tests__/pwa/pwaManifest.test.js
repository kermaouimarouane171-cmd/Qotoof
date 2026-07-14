import fs from 'fs'
import path from 'path'

describe('PWA manifest and offline readiness', () => {
  const viteConfigPath = path.resolve(__dirname, '../../../vite.config.js')
  const offlineHtmlPath = path.resolve(__dirname, '../../../public/offline.html')
  const publicDir = path.resolve(__dirname, '../../../public')

  test('offline.html exists and is referenced correctly', () => {
    expect(fs.existsSync(offlineHtmlPath)).toBe(true)
    const offlineHtml = fs.readFileSync(offlineHtmlPath, 'utf-8')
    expect(offlineHtml).toContain('<title>')
    expect(offlineHtml).toContain('theme-color')
  })

  test('VitePWA manifest is configured with required fields', () => {
    const configSource = fs.readFileSync(viteConfigPath, 'utf-8')

    expect(configSource).toContain('VitePWA')
    expect(configSource).toContain('manifest:')
    expect(configSource).toContain('name:')
    expect(configSource).toContain('short_name:')
    expect(configSource).toContain('theme_color:')
    expect(configSource).toContain('background_color:')
    expect(configSource).toContain('display:')
    expect(configSource).toContain('start_url:')
    expect(configSource).toContain('icons:')
  })

  test('VitePWA manifest includes required icon sizes', () => {
    const configSource = fs.readFileSync(viteConfigPath, 'utf-8')
    expect(configSource).toContain('192x192')
    expect(configSource).toContain('512x512')
  })

  test('offline.html is included in PWA assets or precache', () => {
    const configSource = fs.readFileSync(viteConfigPath, 'utf-8')
    const includesOffline =
      configSource.includes("'offline.html'") ||
      configSource.includes('"offline.html"') ||
      /globPatterns.*html/.test(configSource)
    expect(includesOffline).toBe(true)
  })

  test('PWA icon files exist in public directory', () => {
    const configSource = fs.readFileSync(viteConfigPath, 'utf-8')
    const iconMatches = configSource.match(/\/icon-[^'"]+\.(png|svg|jpg)/g) || []
    expect(iconMatches.length).toBeGreaterThan(0)

    iconMatches.forEach((src) => {
      const filename = src.replace(/^\//, '')
      const iconPath = path.join(publicDir, filename)
      expect(fs.existsSync(iconPath)).toBe(true)
    })
  })
})
