/**
 * Service Tests: Audit Logger – Schema & Resilience Regression
 * Verifies auditLogger.jsx matches the real DB schema (details, not metadata)
 * and handles user_id=null gracefully.
 */

import fs from 'fs'
import path from 'path'

const auditLoggerPath = path.resolve(__dirname, '../../services/auditLogger.jsx')
const auditLoggerSource = fs.readFileSync(auditLoggerPath, 'utf8')

describe('Audit Logger – Schema Regression', () => {
  test('payload uses details instead of metadata', () => {
    // The payload object must not contain a metadata key
    expect(auditLoggerSource).not.toMatch(/metadata:\s*resolvedMetadata/)
    expect(auditLoggerSource).not.toMatch(/metadata:\s*details/)

    // It must contain details key in the payload object
    expect(auditLoggerSource).toMatch(/details,/)
  })

  test('metadata is mapped into details before building payload', () => {
    // resolvedMetadata should be transformed into details
    expect(auditLoggerSource).toMatch(/const details = resolvedMetadata/)
  })

  test('user_id=null skips insert with logger.warn', () => {
    // Must have early return when userId is missing
    expect(auditLoggerSource).toContain('Audit log skipped: user_id is null')
    expect(auditLoggerSource).toContain('logger.warn')

    // Must guard against null user_id before building signature or payload
    // Use createSignature( to match the call, not the import declaration
    const nullCheckIndex = auditLoggerSource.indexOf('if (!userId)')
    const signatureCallIndex = auditLoggerSource.indexOf('createSignature(')
    expect(nullCheckIndex).toBeGreaterThan(-1)
    expect(signatureCallIndex).toBeGreaterThan(-1)
    expect(nullCheckIndex).toBeLessThan(signatureCallIndex)
  })

  test('sendToServer wraps insert in try-catch', () => {
    const sendToServerMatch = auditLoggerSource.match(
      /async sendToServer\(auditLog\) \{([\s\S]*?)\n  \}/
    )
    expect(sendToServerMatch).toBeTruthy()
    const body = sendToServerMatch[1]
    expect(body).toContain('try')
    expect(body).toContain('catch')
    expect(body).toContain('.from(\'audit_logs\')')
    expect(body).toContain('.insert(auditLog)')
  })

  test('flush wraps insert in try-catch', () => {
    const flushMatch = auditLoggerSource.match(
      /async flush\(\) \{([\s\S]*?)\n  \}/
    )
    expect(flushMatch).toBeTruthy()
    const body = flushMatch[1]
    expect(body).toContain('try')
    expect(body).toContain('catch')
  })
})
