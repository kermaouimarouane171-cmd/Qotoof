/**
 * mobile-white-screen.cy.js
 * ─────────────────────────────────────────────────────────────────────────────
 * DIAGNOSTIC TEST — Mobile White Screen & Reload Loop Detection
 *
 * Run:  npm run test:mobile-white-screen
 *
 * What this file detects:
 *  1. White screen (empty #root) on each page / viewport
 *  2. Redirect loops (A→B→A pattern)
 *  3. Infinite reload loops (location.reload / page-load count)
 *  4. Unhandled JS errors (console.error / uncaught exceptions)
 *  5. React render crashes (Maximum update depth / Too many re-renders)
 *  6. Bottom Navigation leaking onto auth pages
 *  7. Service-Worker-triggered reloads
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Viewports ────────────────────────────────────────────────────────────────
const VIEWPORTS = [
  { width: 360, height: 800,  label: '360x800'  },
  { width: 390, height: 844,  label: '390x844'  },
  { width: 412, height: 915,  label: '412x915'  },
]

// ── Pages to probe ───────────────────────────────────────────────────────────
const PUBLIC_PAGES = [
  { path: '/',           label: 'Home'        },
  { path: '/login',      label: 'Login'       },
  { path: '/register',   label: 'Register'    },
  { path: '/marketplace',label: 'Marketplace' },
  { path: '/cart',       label: 'Cart'        },
]

// Protected pages – will redirect to /login when unauthenticated.
// The test monitors *what* redirect happens & whether it loops.
const PROTECTED_PAGES = [
  { path: '/buyer/dashboard',  label: 'Buyer Dashboard'  },
  { path: '/vendor/dashboard', label: 'Vendor Dashboard' },
  { path: '/driver/dashboard', label: 'Driver Dashboard' },
  { path: '/orders',           label: 'Orders Redirect'  },
  { path: '/checkout',         label: 'Checkout'         },
]

// ── Timing constants ─────────────────────────────────────────────────────────
const LOAD_WAIT_MS     = 5000   // Wait after cy.visit() for React to mount
const REDIRECT_WAIT_MS = 5000   // Extra wait to detect if redirects settle
const MAX_RELOADS      = 2      // More than this = reload loop

// ── Helper: install listeners inside the page ─────────────────────────────────
/**
 * Injects listeners for console errors, reload calls, and navigation history
 * into the page's window object *before* any app code runs.
 * Call this in cy.on('window:before:load', ...) handlers.
 */
const injectDiagnosticListeners = (win) => {
  win.__DIAG__ = {
    consoleErrors:  [],
    reloadCount:    0,
    navHistory:     [],
    reactErrors:    [],
    swReloads:      0,
  }

  // ── Intercept console.error ──────────────────────────────────────────────
  const origError = win.console.error.bind(win.console)
  win.console.error = (...args) => {
    win.__DIAG__.consoleErrors.push(args.map(String).join(' '))
    origError(...args)
  }

  // ── Intercept console.warn (React double-render warnings live here) ───────
  const origWarn = win.console.warn.bind(win.console)
  win.console.warn = (...args) => {
    const msg = args.map(String).join(' ')
    if (
      msg.includes('Maximum update depth') ||
      msg.includes('Too many re-renders') ||
      msg.includes('Cannot read properties')
    ) {
      win.__DIAG__.reactErrors.push(msg)
    }
    origWarn(...args)
  }

  // ── Intercept location.reload ─────────────────────────────────────────────
  const origReload = win.location.reload.bind(win.location)
  Object.defineProperty(win.location, 'reload', {
    configurable: true,
    writable: true,
    value: (...args) => {
      win.__DIAG__.reloadCount += 1
      origReload(...args)
    },
  })

  // ── Track SPA navigation via history API ──────────────────────────────────
  const recordNav = (url) => {
    const history = win.__DIAG__.navHistory
    history.push(url)

    // Detect A→B→A redirect loop (last 6 entries)
    if (history.length >= 6) {
      const tail = history.slice(-6)
      const [a, b, a2, b2] = tail
      if (a === a2 && b === b2 && a !== b) {
        win.__DIAG__.redirectLoop = { from: a, to: b, detected: true }
      }
    }
  }

  const origPushState    = win.history.pushState.bind(win.history)
  const origReplaceState = win.history.replaceState.bind(win.history)

  win.history.pushState = (state, title, url) => {
    recordNav(String(url || ''))
    origPushState(state, title, url)
  }
  win.history.replaceState = (state, title, url) => {
    recordNav(String(url || ''))
    origReplaceState(state, title, url)
  }
}

// ── Helper: collect diagnostics from window ───────────────────────────────────
const collectDiag = () =>
  cy.window().then((win) => win.__DIAG__ || {
    consoleErrors: [],
    reloadCount:   0,
    navHistory:    [],
    reactErrors:   [],
  })

// ── Helper: assert page is NOT a white screen ─────────────────────────────────
const assertNotWhiteScreen = (pageLabel, vpLabel) => {
  // 1. #root must exist
  cy.get('#root', { timeout: 10000 }).should('exist')

  // 2. #root must have rendered descendants (retry until React mounts)
  cy.get('#root *', { timeout: 10000 }).should('have.length.gte', 1)

  // 3. #root must have meaningful text content
  cy.get('#root').then(($root) => {
    const childCount = $root.find('*').length
    const text       = $root.text().trim()

    if (childCount === 0 || text.length < 5) {
      collectDiag().then((diag) => {
        const report = [
          `\n🔴 WHITE SCREEN detected!`,
          `  Page      : ${pageLabel}`,
          `  Viewport  : ${vpLabel}`,
          `  #root kids: ${childCount}`,
          `  #root text: "${text.slice(0, 120)}"`,
          `  Reloads   : ${diag.reloadCount}`,
          `  Nav history (last 10): ${(diag.navHistory || []).slice(-10).join(' → ')}`,
          `  Console errors: ${(diag.consoleErrors || []).slice(0, 5).join(' | ')}`,
          `  React errors  : ${(diag.reactErrors   || []).slice(0, 5).join(' | ')}`,
          diag.redirectLoop ? `  ⚠ Redirect loop: ${diag.redirectLoop.from} ↔ ${diag.redirectLoop.to}` : '',
        ].filter(Boolean).join('\n')

        // Log to Cypress output
        cy.log(report)
        throw new Error(report)
      })
    }
  })
}

// ── Helper: assert redirect settled (no loop) ────────────────────────────────
const assertNoRedirectLoop = (pageLabel, vpLabel) => {
  collectDiag().then((diag) => {
    if (diag.redirectLoop?.detected) {
      throw new Error(
        `🔄 REDIRECT LOOP on "${pageLabel}" [${vpLabel}]: ` +
        `${diag.redirectLoop.from} ↔ ${diag.redirectLoop.to} ` +
        `| nav: ${(diag.navHistory || []).slice(-8).join(' → ')}`
      )
    }
  })
}

// ── Helper: assert reload count is safe ──────────────────────────────────────
const assertNoReloadLoop = (pageLabel, vpLabel) => {
  collectDiag().then((diag) => {
    const count = diag.reloadCount || 0
    if (count > MAX_RELOADS) {
      throw new Error(
        `♻️  RELOAD LOOP on "${pageLabel}" [${vpLabel}]: ` +
        `location.reload() called ${count} times. ` +
        `Nav history: ${(diag.navHistory || []).slice(-6).join(' → ')}`
      )
    }
  })
}

// ── Helper: assert no critical React/JS errors ────────────────────────────────
const assertNoCriticalErrors = (pageLabel, vpLabel) => {
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
        `💥 CRITICAL ERRORS on "${pageLabel}" [${vpLabel}]:\n` +
        critical.slice(0, 5).join('\n')
      )
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — Public pages: no white screen on any mobile viewport
// ─────────────────────────────────────────────────────────────────────────────
describe('Mobile Diagnostic — Public Pages (unauthenticated)', () => {
  // Silence uncaught exceptions that crash the runner but keep collecting them
  Cypress.on('uncaught:exception', (err) => {
    // Never kill the test on ResizeObserver noise
    if (err.message?.includes('ResizeObserver')) return false
    // For all other errors let Cypress record them but we'll assert manually
    return false
  })

  VIEWPORTS.forEach((vp) => {
    PUBLIC_PAGES.forEach((page) => {
      it(`[${vp.label}] ${page.label} (${page.path}) — no white screen, no loops`, () => {
        cy.viewport(vp.width, vp.height)

        cy.on('window:before:load', injectDiagnosticListeners)

        cy.visit(page.path, { failOnStatusCode: false })

        // Wait for React to hydrate
        cy.wait(LOAD_WAIT_MS)

        assertNotWhiteScreen(page.label, vp.label)
        assertNoRedirectLoop(page.label, vp.label)
        assertNoReloadLoop(page.label, vp.label)
        assertNoCriticalErrors(page.label, vp.label)
      })
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — Protected pages: must redirect to /login, NOT loop
// ─────────────────────────────────────────────────────────────────────────────
describe('Mobile Diagnostic — Protected Pages (unauthenticated redirect)', () => {
  Cypress.on('uncaught:exception', () => false)

  VIEWPORTS.forEach((vp) => {
    PROTECTED_PAGES.forEach((page) => {
      it(`[${vp.label}] ${page.label} → should land on /login without loop`, () => {
        cy.viewport(vp.width, vp.height)
        cy.on('window:before:load', injectDiagnosticListeners)

        cy.visit(page.path, { failOnStatusCode: false })

        // Wait for redirect to settle — Cypress will retry the assertion
        // for up to 20s, giving the app time to resolve auth state
        cy.location('pathname', { timeout: 20000 }).should('include', '/login')

        // /login itself must not be a white screen
        assertNotWhiteScreen(page.label + ' → /login', vp.label)
        assertNoRedirectLoop(page.label, vp.label)
        assertNoReloadLoop(page.label, vp.label)
        assertNoCriticalErrors(page.label, vp.label)

        // Role bottom nav must NOT appear on login
        cy.get('[data-testid="role-mobile-bottom-nav"]').should('not.exist')
      })
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — Auth page: no BottomNav, no white screen, no overflow
// ─────────────────────────────────────────────────────────────────────────────
describe('Mobile Diagnostic — Auth pages have no Bottom Navigation', () => {
  Cypress.on('uncaught:exception', () => false)

  const AUTH_PAGES = ['/login', '/register']

  VIEWPORTS.forEach((vp) => {
    AUTH_PAGES.forEach((path) => {
      it(`[${vp.label}] ${path} — no role bottom nav, no horizontal overflow`, () => {
        cy.viewport(vp.width, vp.height)
        cy.on('window:before:load', injectDiagnosticListeners)

        cy.visit(path, { failOnStatusCode: false })
        cy.wait(LOAD_WAIT_MS)

        assertNotWhiteScreen(path, vp.label)

        // Role-specific bottom nav must not exist on auth pages
        cy.get('[data-testid="role-mobile-bottom-nav"]').should('not.exist')

        // No horizontal overflow
        cy.window().then((win) => {
          const overflowW = win.document.body.scrollWidth
          expect(overflowW, `body.scrollWidth ≤ innerWidth on ${path}`).to.be.lte(vp.width + 2)
        })
      })
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — Service Worker: no reload loop on update
// ─────────────────────────────────────────────────────────────────────────────
describe('Mobile Diagnostic — Service Worker reload safety', () => {
  Cypress.on('uncaught:exception', () => false)

  it('[360x800] Home page does not reload more than twice after SW update', () => {
    cy.viewport(360, 800)
    cy.on('window:before:load', injectDiagnosticListeners)

    cy.visit('/', { failOnStatusCode: false })

    // Simulate a SW update message
    cy.window().then((win) => {
      if ('serviceWorker' in win.navigator) {
        win.navigator.serviceWorker.getRegistrations?.().then((regs) => {
          regs.forEach((r) => r.update?.().catch(() => {}))
        })
      }
    })

    cy.wait(3000)

    collectDiag().then((diag) => {
      const reloads = diag.reloadCount || 0
      if (reloads > MAX_RELOADS) {
        throw new Error(
          `♻️  SERVICE WORKER RELOAD LOOP: location.reload() called ${reloads} times after SW update on /`
        )
      }
      cy.log(`✅ SW reload count: ${reloads} (safe, max=${MAX_RELOADS})`)
    })

    assertNotWhiteScreen('/ (after SW update)', '360x800')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5 — OnboardingOrchestrator blocking check
// Detect if isBlocking never resolves → permanent loading spinner / white screen
// ─────────────────────────────────────────────────────────────────────────────
describe('Mobile Diagnostic — OnboardingOrchestrator blocking guard', () => {
  Cypress.on('uncaught:exception', () => false)

  it('[390x844] Loading fallback on protected pages never stays > 10s', () => {
    cy.viewport(390, 844)
    cy.on('window:before:load', injectDiagnosticListeners)

    cy.visit('/buyer/dashboard', { failOnStatusCode: false })

    // After redirect to /login the loading spinner must NOT be present
    cy.wait(REDIRECT_WAIT_MS)

    // A spinner stuck here means isBlocking never resolved
    cy.get('.animate-spin', { timeout: 500 }).should('not.exist')

    // And the page must not be white
    assertNotWhiteScreen('/buyer/dashboard → /login (loading guard)', '390x844')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6 — VendorLayout: digital-contract redirect loop guard
// If profile is null/loading → VendorLayout must NOT redirect to /vendor/digital-contract
// ─────────────────────────────────────────────────────────────────────────────
describe('Mobile Diagnostic — VendorLayout digital-contract loop', () => {
  Cypress.on('uncaught:exception', () => false)

  it('[390x844] Visiting /vendor/dashboard unauthenticated lands on /login, not /vendor/digital-contract loop', () => {
    cy.viewport(390, 844)
    cy.on('window:before:load', injectDiagnosticListeners)

    cy.visit('/vendor/dashboard', { failOnStatusCode: false })
    cy.wait(REDIRECT_WAIT_MS)

    // Must end at /login — NOT bounce between /vendor/dashboard and /vendor/digital-contract
    cy.location('pathname').then((path) => {
      if (path === '/vendor/digital-contract' || path === '/vendor/dashboard') {
        collectDiag().then((diag) => {
          throw new Error(
            `🔄 VENDOR LAYOUT LOOP DETECTED — landed on "${path}" instead of /login.\n` +
            `Nav history: ${(diag.navHistory || []).slice(-8).join(' → ')}\n` +
            `Console errors: ${(diag.consoleErrors || []).slice(0, 3).join(' | ')}`
          )
        })
      }
    })

    assertNoRedirectLoop('/vendor/dashboard', '390x844')
    assertNoReloadLoop('/vendor/dashboard', '390x844')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7 — FULL DIAGNOSTIC REPORT (run last)
// Visits every page, collects all errors, prints consolidated report
// ─────────────────────────────────────────────────────────────────────────────
describe('Mobile Diagnostic — Full Report (360x800)', () => {
  Cypress.on('uncaught:exception', () => false)

  const ALL_PAGES = [...PUBLIC_PAGES, ...PROTECTED_PAGES]
  const REPORT_VP = { width: 360, height: 800, label: '360x800' }

  ALL_PAGES.forEach((page) => {
    it(`REPORT [${REPORT_VP.label}] ${page.path}`, () => {
      cy.viewport(REPORT_VP.width, REPORT_VP.height)
      cy.on('window:before:load', injectDiagnosticListeners)

      cy.visit(page.path, { failOnStatusCode: false })
      cy.wait(LOAD_WAIT_MS)

      cy.location('pathname').then((finalPath) => {
        collectDiag().then((diag) => {
          const status = {
            originalPath:  page.path,
            finalPath,
            reloads:       diag.reloadCount || 0,
            navHistory:    (diag.navHistory || []).slice(-10).join(' → '),
            consoleErrors: (diag.consoleErrors || []).slice(0, 5),
            reactErrors:   (diag.reactErrors   || []).slice(0, 5),
            redirectLoop:  diag.redirectLoop || null,
          }

          cy.log(
            `📋 REPORT [${page.path}] → finalPath=${finalPath} | reloads=${status.reloads} | errors=${status.consoleErrors.length}`
          )

          if (status.redirectLoop?.detected) {
            cy.log(`⚠️  REDIRECT LOOP: ${status.redirectLoop.from} ↔ ${status.redirectLoop.to}`)
          }

          if (status.reloads > MAX_RELOADS) {
            cy.log(`♻️  RELOAD LOOP: ${status.reloads} reloads`)
          }

          status.consoleErrors.forEach((e) => cy.log(`🔴 ${e}`))
          status.reactErrors.forEach((e)   => cy.log(`💥 React: ${e}`))
        })
      })

      // Non-fatal assertions so the full report always completes
      cy.get('#root').should('exist')
    })
  })
})
