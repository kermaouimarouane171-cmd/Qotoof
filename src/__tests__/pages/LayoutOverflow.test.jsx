import fs from 'fs'
import path from 'path'

describe('MainLayout pages do not force full viewport height', () => {
  it('OrderDetail.jsx avoids min-h-screen inside MainLayout', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../pages/OrderDetail.jsx'), 'utf-8')
    expect(source).not.toMatch(/className="[^"]*min-h-screen[^"]*"/)
  })

  it('OrderTracking.jsx avoids min-h-screen inside MainLayout', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../pages/OrderTracking.jsx'), 'utf-8')
    expect(source).not.toMatch(/className="[^"]*min-h-screen[^"]*"/)
  })

  it('Tracking.jsx avoids min-h-screen inside MainLayout', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../pages/Tracking.jsx'), 'utf-8')
    expect(source).not.toMatch(/className="[^"]*min-h-screen[^"]*"/)
  })

  it('Favorites.jsx avoids min-h-screen inside MainLayout', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../pages/Favorites.jsx'), 'utf-8')
    expect(source).not.toMatch(/className="[^"]*min-h-screen[^"]*"/)
  })
})
