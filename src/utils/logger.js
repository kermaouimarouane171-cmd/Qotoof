/* eslint-disable no-console */
const isDev = import.meta.env.DEV
const isTest = import.meta.env.MODE === 'test'

export const logger = {
  log: (...args) => isDev && console.log('[Qotoof]', ...args),
  warn: (...args) => isDev && console.warn('[Qotoof]', ...args),
  error: (...args) => !isTest && console.error('[Qotoof]', ...args),
  debug: (...args) => isDev && console.debug('[Qotoof]', ...args),
  info: (...args) => isDev && console.info('[Qotoof]', ...args),
}
