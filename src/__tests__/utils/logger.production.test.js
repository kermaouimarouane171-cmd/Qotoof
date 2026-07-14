import { logger } from '@/utils/logger'
import fs from 'fs'
import path from 'path'

describe('Logger production observability', () => {
  test('logger has all required methods', () => {
    expect(typeof logger.log).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.info).toBe('function')
  })

  test('logger.warn is suppressed in test mode (current environment)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('test warning')
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  test('logger.error is suppressed in test mode (current environment)', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('test error')
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  test('logger.warn uses !isTest guard (not isDev) — verified by source code inspection', () => {
    const loggerSource = fs.readFileSync(
      path.resolve('src/utils/logger.js'),
      'utf-8'
    )
    expect(loggerSource).toContain('!isTest && console.warn')
    expect(loggerSource).not.toContain('isDev && console.warn')
  })
})
