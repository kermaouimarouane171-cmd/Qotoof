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

import { defineConfig } from 'cypress'
import { addMatchImageSnapshotPlugin } from 'cypress-image-snapshot/plugin.js'

const localQaPassword = ['Test', '123456'].join('@')

export default defineConfig({
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 10000,
  pageLoadTimeout: 30000,

  viewportWidth: 1280,
  viewportHeight: 720,

  video: false,
  screenshotOnRunFailure: true,
  retries: {
    runMode: 2,
    openMode: 0,
  },
  chromeWebSecurity: false,
  env: {
    TEST_USER_EMAIL: process.env.CYPRESS_TEST_USER_EMAIL || 'buyer@greenmarket.test',
    TEST_USER_PASSWORD: process.env.CYPRESS_TEST_USER_PASSWORD || localQaPassword,
    VENDOR_EMAIL: process.env.CYPRESS_VENDOR_EMAIL || 'vendor@greenmarket.test',
    VENDOR_PASSWORD: process.env.CYPRESS_VENDOR_PASSWORD || localQaPassword,
    BUYER_EMAIL: process.env.CYPRESS_BUYER_EMAIL || 'buyer@greenmarket.test',
    BUYER_PASSWORD: process.env.CYPRESS_BUYER_PASSWORD || localQaPassword,
    ADMIN_EMAIL: process.env.CYPRESS_ADMIN_EMAIL || 'admin@greenmarket.test',
    ADMIN_PASSWORD: process.env.CYPRESS_ADMIN_PASSWORD || localQaPassword,
    DRIVER_EMAIL: process.env.CYPRESS_DRIVER_EMAIL || 'driver@greenmarket.test',
    DRIVER_PASSWORD: process.env.CYPRESS_DRIVER_PASSWORD || localQaPassword,
  },
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js',
    setupNodeEvents(on, config) {
      addMatchImageSnapshotPlugin(on, config)
      return config
    },
  },
})
