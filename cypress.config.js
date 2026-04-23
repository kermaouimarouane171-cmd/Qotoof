/**
 * Cypress Configuration
 *
 * Test credentials should be set via environment variables:
 *   CYPRESS_TEST_USER_EMAIL
 *   CYPRESS_TEST_USER_PASSWORD
 *   CYPRESS_VENDOR_EMAIL
 *   CYPRESS_VENDOR_PASSWORD
 *   CYPRESS_BUYER_EMAIL
 *   CYPRESS_BUYER_PASSWORD
 *   CYPRESS_ADMIN_EMAIL
 *   CYPRESS_ADMIN_PASSWORD
 *   CYPRESS_DRIVER_EMAIL
 *   CYPRESS_DRIVER_PASSWORD
 */

export default {
  // Base URL
  baseUrl: 'http://localhost:3000',

  // Timeouts
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 10000,
  pageLoadTimeout: 30000,

  // Viewport
  viewportWidth: 1280,
  viewportHeight: 720,

  // Test files
  specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
  supportFile: 'cypress/support/e2e.js',

  // Video recording
  video: false,

  // Screenshot on failure
  screenshotOnRunFailure: true,

  // Retries
  retries: {
    runMode: 2,
    openMode: 0,
  },

  // Chrome web security
  chromeWebSecurity: false,

  // Environment variables (use env vars for security)
  env: {
    TEST_USER_EMAIL: process.env.CYPRESS_TEST_USER_EMAIL || 'qa.user@qotoof.ma',
    TEST_USER_PASSWORD: process.env.CYPRESS_TEST_USER_PASSWORD || 'Test1234!',
    VENDOR_EMAIL: process.env.CYPRESS_VENDOR_EMAIL || 'qa.vendor@qotoof.ma',
    VENDOR_PASSWORD: process.env.CYPRESS_VENDOR_PASSWORD || 'Vendor123!',
    BUYER_EMAIL: process.env.CYPRESS_BUYER_EMAIL || 'qa.buyer@qotoof.ma',
    BUYER_PASSWORD: process.env.CYPRESS_BUYER_PASSWORD || 'Buyer123!',
    ADMIN_EMAIL: process.env.CYPRESS_ADMIN_EMAIL || 'qa.admin@qotoof.ma',
    ADMIN_PASSWORD: process.env.CYPRESS_ADMIN_PASSWORD || 'Admin123!',
    DRIVER_EMAIL: process.env.CYPRESS_DRIVER_EMAIL || 'qa.driver@qotoof.ma',
    DRIVER_PASSWORD: process.env.CYPRESS_DRIVER_PASSWORD || 'Driver123!',
  },
}
