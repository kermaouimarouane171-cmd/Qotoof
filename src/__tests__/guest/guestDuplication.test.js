const fs = require('fs')
const path = require('path')

const readSrc = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '../../../', relativePath), 'utf-8')

describe('Guest/visitor duplication fixes', () => {
  test('AuthGate component exists and is reusable', () => {
    const source = readSrc('src/components/auth/AuthGate.jsx')
    expect(source).toContain('export default AuthGate')
    expect(source).toContain("variant = 'card'")
    expect(source).toContain("variant === 'fullscreen'")
    expect(source).toContain("variant === 'modal'")
  })

  test('Returns.jsx uses the shared AuthGate instead of a local one', () => {
    const source = readSrc('src/pages/Returns.jsx')
    expect(source).toContain("import AuthGate from '@/components/auth/AuthGate'")
    expect(source).not.toMatch(/const AuthGate = \(/)
  })

  test('Contact.jsx uses the shared AuthGate for guest prompt', () => {
    const source = readSrc('src/pages/Contact.jsx')
    expect(source).toContain("import AuthGate from '@/components/auth/AuthGate'")
    expect(source).toContain('<AuthGate')
  })

  test('Tracking.jsx uses the shared AuthGate for the fullscreen guest screen', () => {
    const source = readSrc('src/pages/Tracking.jsx')
    expect(source).toContain("import AuthGate from '@/components/auth/AuthGate'")
    expect(source).toContain('variant="fullscreen"')
  })

  test('Cart.jsx uses the shared AuthGate for the guest checkout modal', () => {
    const source = readSrc('src/pages/Cart.jsx')
    expect(source).toContain("import AuthGate from '@/components/auth/AuthGate'")
    expect(source).toContain('variant="modal"')
  })

  test('ProductDetail.jsx uses useRequireAuth hook instead of inline navigate', () => {
    const source = readSrc('src/pages/ProductDetail.jsx')
    expect(source).toContain("import useRequireAuth from '@/hooks/useRequireAuth'")
    expect(source).toContain('const { requireAuth } = useRequireAuth()')
    expect(source).toContain('requireAuth({')
  })

  test('StoreDetail.jsx uses useRequireAuth hook instead of inline navigate', () => {
    const source = readSrc('src/pages/StoreDetail.jsx')
    expect(source).toContain("import useRequireAuth from '@/hooks/useRequireAuth'")
    expect(source).toContain('const { requireAuth } = useRequireAuth()')
    expect(source).toContain('requireAuth({')
  })

  test('HelpCenter.jsx uses useRequireAuth hook instead of redirectToLogin helper', () => {
    const source = readSrc('src/pages/HelpCenter.jsx')
    expect(source).toContain("import useRequireAuth from '@/hooks/useRequireAuth'")
    expect(source).toContain('const { requireAuth } = useRequireAuth()')
    expect(source).not.toMatch(/const redirectToLogin = /)
  })

  test('ProductCard.jsx allows guests to toggle favorites locally and uses i18n key instead of hardcoded text', () => {
    const source = readSrc('src/components/ui/ProductCard.jsx')
    expect(source).toContain('const { user } = useAuthStore()')
    expect(source).toContain('await toggleProduct(user?.id || null, product.id)')
    expect(source).not.toContain("toast.error('Please login to add favorites')")
  })

  test('Unauthorized component is not duplicated — components/Unauthorized re-exports pages/Unauthorized', () => {
    const componentsSource = readSrc('src/components/Unauthorized.jsx')
    expect(componentsSource).toContain("export { default } from '@/pages/Unauthorized'")
  })

  test('NotFound component is not duplicated — components/NotFound re-exports pages/NotFound', () => {
    const componentsSource = readSrc('src/components/NotFound.jsx')
    expect(componentsSource).toContain("export { default } from '@/pages/NotFound'")
  })

  test('authHelpers.js exists and exports centralized helpers', () => {
    const source = readSrc('src/utils/authHelpers.js')
    expect(source).toContain('export const requireUser')
    expect(source).toContain('export const unauthenticatedResponse')
  })

  test('authActionsService.js uses requireUser/unauthenticatedResponse helpers', () => {
    const source = readSrc('src/services/authActionsService.js')
    expect(source).toContain("import { requireUser, unauthenticatedResponse } from '@/utils/authHelpers'")
    expect(source).toContain('requireUser(user)')
    expect(source).toContain('unauthenticatedResponse()')
  })

  test('authServices.js uses unauthenticatedResponse helper', () => {
    const source = readSrc('src/services/authServices.js')
    expect(source).toContain("import { unauthenticatedResponse } from '@/utils/authHelpers'")
    expect(source).toContain('return unauthenticatedResponse()')
  })

  test('common.loginRequired key exists in all locale files', () => {
    const en = JSON.parse(readSrc('src/i18n/locales/en.json'))
    const ar = JSON.parse(readSrc('src/i18n/locales/ar.json'))
    const fr = JSON.parse(readSrc('src/i18n/locales/fr.json'))
    expect(en.common.loginRequired).toBeTruthy()
    expect(ar.common.loginRequired).toBeTruthy()
    expect(fr.common.loginRequired).toBeTruthy()
  })

  test('legacy loginRequired keys are removed from locale files', () => {
    const en = readSrc('src/i18n/locales/en.json')
    const ar = readSrc('src/i18n/locales/ar.json')
    const fr = readSrc('src/i18n/locales/fr.json')
    for (const content of [en, ar, fr]) {
      expect(content).not.toContain('"productDetail.waitlist.loginRequired"')
      expect(content).not.toContain('"productDetail.reviews.loginRequired"')
      expect(content).not.toContain('"storeDetail.reviews.loginRequired"')
      expect(content).not.toContain('"helpCenter.loginRequired"')
    }
  })
})
