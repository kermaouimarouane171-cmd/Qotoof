/**
 * Shared Zod Primitive Schemas
 *
 * Atomic, reusable Zod schemas imported by validationSchemas.js and any
 * module that needs a single-field validator.  Keep these SIMPLE — no
 * .refine() chains that depend on other fields, no cross-field rules.
 */

import { z } from 'zod'

// ── Email ─────────────────────────────────────────────────────────────────────
// Base email: validates format, lowercases and trims.
// For stricter length requirements, chain .min()/.max() BEFORE the transform
// in the consuming schema.
export const emailPrimitive = z
  .string()
  .email('Invalid email address')
  .transform(email => email.toLowerCase().trim())

// ── Password (strict) ─────────────────────────────────────────────────────────
// Enforces OWASP minimum: 8-128 chars + upper + lower + digit + special char.
export const strictPasswordPrimitive = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

// ── Moroccan phone ────────────────────────────────────────────────────────────
// Accepts +212XXXXXXXXX, 212XXXXXXXXX, or 0[5-7]XXXXXXXX.
// Normalises to international +212 format.
export const moroccanPhonePrimitive = z
  .string()
  .refine(
    (phone) => {
      const cleaned = phone.replace(/[^\d+]/g, '')
      return (
        /^\+212\d{9}$/.test(cleaned) ||
        /^212\d{9}$/.test(cleaned) ||
        /^0[5-7]\d{8}$/.test(cleaned)
      )
    },
    'Invalid Moroccan phone number format'
  )
  .transform((phone) => {
    const cleaned = phone.replace(/[^\d+]/g, '')
    if (cleaned.startsWith('+212')) return cleaned
    if (cleaned.startsWith('212')) return `+${cleaned}`
    if (cleaned.startsWith('0')) return `+212${cleaned.slice(1)}`
    return cleaned
  })

// ── UUID ──────────────────────────────────────────────────────────────────────
export const uuidPrimitive = z.string().uuid('Invalid ID format')
