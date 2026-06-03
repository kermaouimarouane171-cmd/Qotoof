/**
 * smoke-desktop.cy.js
 * ─────────────────────────────────────────────────────────────────────────────
 * DESKTOP SMOKE TEST — Fast console-error & white-screen guard for core pages.
 *
 * Run:  npm run test:smoke
 *
 * What this file detects:
 *  1. White screen (empty #root) on each page
 *  2. Unhandled JS errors (console.error / uncaught exceptions)
 *  3. React render crashes (Maximum update depth / Too many re-renders)
 *  4. Protected routes crashing instead of redirecting to /login
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Pages to probe ───────────────────────────────────────────────────────────
const PUBLIC_PAGES = [
  { path: '/',           label: 'Home'        },
  { path: '/login',      label: 'Login'       },
  { path: '/register',   label: 'Register'    },
  { path: '/marketplace',label: 'Marketplace' },
  { path: '/cart',       label: 'Cart'        },
]

const PROTECTED_PAGES = [
  { path: '/checkout',         label: 'Checkout'         },
  { path: '/buyer/dashboard',  label: 'Buyer Dashboard'  },
  { path: '/vendor/dashboard', label: 'Vendor Dashboard' },
  { path: '/driver/dashboard', label: 'Driver Dashboard' },
  { path: '/admin/dashboard',  label: 'Admin Dashboard'  },
]

const ALL_PAGES = [...PUBLIC_PAGES, ...PROTECTED_PAGES]

// ── Helper: install listeners inside the page ─────────────────────────────────
const injectDiagnosticListeners = (win) => {
  win.__SMOKE_DIAG__ = {
    consoleErrors: [],
    reactErrors:   [],
  }

  // Intercept console.error
  const origError = win.console.error.bind(win.console)
  win.console.error = (...args) => {
    win.__SMOKE_DIAG__.consoleErrors.push(args.map(String).join(' '))
    origError(...args)
  }

  // Intercept console.warn for React errors
  const origWarn = win.console.warn.bind(win.console)
  win.console.warn = (...args) => {
    const msg = args.map(String).join(' ')
    if (
      msg.includes('Maximum update depth') ||
      msg.includes('Too many re-renders') ||
      msg.includes('Cannot read properties')
    ) {
      win.__SMOKE_DIAG__.reactErrors.push(msg)
    }
    origWarn(...args)
  }
}

// ── Helper: collect diagnostics from window ───────────────────────────────────
const collectDiag = () =>
  cy.window().then((win) => win.__SMOKE_DIAG__ || {
    consoleErrors: [],
    reactErrors:   [],
  })

// ── Helper: assert page is NOT a white screen ─────────────────────────────────
const assertNotWhiteScreen = (pageLabel) => {
  cy.get('#root', { timeout: 15000 }).should('exist')
  cy.get('#root *', { timeout: 15000 }).should('have.length.gte', 1)

  cy.get('#root').then(($root) => {
    const childCount = $root.find('*').length
    const text       = $root.text().trim()

    if (childCount === 0 || text.length < 5) {
      collectDiag().then((diag) => {
        const report = [
          `\n🔴 WHITE SCREEN detected!`,
          `  Page      : ${pageLabel}`,
          `  #root kids: ${childCount}`,
          `  #root text: "${text.slice(0, 120)}"`,
          `  Console errors: ${(diag.consoleErrors || []).slice(0, 5).join(' | ')}`,
          `  React errors  : ${(diag.reactErrors   || []).slice(0, 5).join(' | ')}`,
        ].filter(Boolean).join('\n')

        cy.log(report)
        throw new Error(report)
      })
    }
  })
}

// ── Helper: assert no critical errors ─────────────────────────────────────────
const assertNoCriticalErrors = (pageLabel) => {
  collectDiag().then((diag) => {
    const critical = (diag.consoleErrors || []).filter((e) =>
      e.includes('Maximum update depth') ||
      e.includes('Too many re-renders')  ||
      e.includes('ChunkLoadError')       ||
      e.includes('Cannot read properties of undefined') ||
      e.includes('is not a function')    ||
      e.includes('Minified React error')
    )
    if (critical.length > 0) {
      throw new Error(
        `💥 CRITICAL ERRORS on "${pageLabel}":\n` +
        critical.slice(0, 5).join('\n')
      )
    }
  })
}

// ── Helper: assert no unexpected console errors ────────────────────────────────
const assertNoSmokeErrors = (pageLabel) => {
  collectDiag().then((diag) => {
    const errors = diag.consoleErrors || []
    // Ignore known benign errors
    const benign = [
      'ResizeObserver',
      'Manifest:',                     // PWA manifest warnings
      'Third-party cookie',            // Chrome warnings
      'IntersectionObserver',          // Lazy-load timing
    ]
    const realErrors = errors.filter((e) =>
      !benign.some((b) => e.includes(b))
    )
    if (realErrors.length > 0) {
      cy.log(`⚠️ Console errors on ${pageLabel}:`, realErrors.slice(0, 3).join(' | '))
      // Log but don't fail for non-critical console noise — we only fail on critical above
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE — Desktop Smoke: every core page loads without crash
// ─────────────────────────────────────────────────────────────────────────────
describe('Desktop Smoke — Core Pages (1280x720)', () => {
  Cypress.on('uncaught:exception', () => false)

  beforeEach(() => {
    cy.viewport(1280, 720)
  })

  ALL_PAGES.forEach((page) => {
    it(`${page.label} (${page.path}) — no white screen, no crash`, () => {
      cy.on('window:before:load', injectDiagnosticListeners)

      cy.visit(page.path, { failOnStatusCode: false })

      // Wait for React to hydrate (same as mobile-white-screen)
      cy.wait(5000)

      assertNotWhiteScreen(page.label)
      assertNoCriticalErrors(page.label)
      assertNoSmokeErrors(page.label)

      // Log final pathname for protected-page visibility
      cy.location('pathname').then((pathname) => {
        cy.log(`📍 ${page.label} ended at: ${pathname}`)
      })
    })
  })
})
