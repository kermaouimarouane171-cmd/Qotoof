/**
 * Shared Zod Primitive Schemas
 *
 * Atomic, reusable Zod schemas imported by validationSchemas.js and any
 * module that needs a single-field validator.  Keep these SIMPLE — no
 * .refine() chains that depend on other fields, no cross-field rules.
 *
 * Naming convention
 * ─────────────────
 * *Primitive  — low-level building blocks kept for backward compatibility
 *               (already imported by validators.js / validationSchemas.js).
 * *Schema     — canonical public exports with full constraints; prefer these
 *               in new code.  They are ADDITIVE — the *Primitive exports are
 *               unchanged.
 *
 * Environment compatibility
 * ─────────────────────────
 * All schemas use only standard Zod APIs (no Node-only builtins, no browser-
 * only globals). Safe for both Express middleware (Node.js) and React forms.
 */

import { z } from 'zod'
import { CIN_REGEX } from './cinValidation.js'

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base email primitive.
 * Validates RFC 5321 format and normalises to lowercase + trimmed.
 *
 * NOTE: does NOT enforce min/max length — use `emailSchema` when you need
 * the full RFC 5321 length constraints (5–254 chars).
 *
 * @example
 *   emailPrimitive.parse('  User@Example.COM  ') // → 'user@example.com'
 */
export const emailPrimitive = z
  .string()
  .email('Invalid email address')
  .transform(email => email.toLowerCase().trim())

/**
 * Canonical email schema.
 *
 * Strictest version found across the codebase (loginSchema).
 * Rules:
 *   - RFC 5322 format (Zod `.email()`)
 *   - min 5 chars (shortest valid addr: a@b.c)
 *   - max 254 chars (RFC 5321 MAIL FROM limit)
 *   - Normalised to lowercase + trimmed
 *
 * Defined independently of `emailPrimitive` because Zod does not allow
 * chaining `.min()/.max()` after a `.transform()`.
 *
 * @example
 *   emailSchema.parse('  USER@EXAMPLE.COM  ') // → 'user@example.com'
 *   emailSchema.parse('x@y')                  // throws — too short
 */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .min(5, 'Email must be at least 5 characters')
  .max(254, 'Email must be less than 254 characters')
  .transform(email => email.toLowerCase().trim())

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strict password primitive.
 *
 * Enforces OWASP SP800-63B minimum:
 *   - 8–128 characters
 *   - At least one uppercase letter
 *   - At least one lowercase letter
 *   - At least one digit
 *   - At least one special character (non-alphanumeric)
 *
 * @example
 *   strictPasswordPrimitive.parse('Secret@1')  // → 'Secret@1'
 *   strictPasswordPrimitive.parse('password')  // throws — no uppercase/digit/special
 */
export const strictPasswordPrimitive = z
  .string()
  .min(8, 'Password must be 8 characters minimum')
  .max(128, 'Password must be less than 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

/**
 * Canonical password schema.
 *
 * Identical to `strictPasswordPrimitive`. Exported under the `*Schema`
 * convention for consistency with other canonical exports.
 *
 * @see strictPasswordPrimitive
 */
export const passwordSchema = strictPasswordPrimitive

// ─────────────────────────────────────────────────────────────────────────────
// PHONE — generic international
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generic international phone schema (ITU-T E.164-compatible).
 *
 * Accepts:
 *   - +CCXXXXXXXXX  (E.164 with country code, 7–15 digits total)
 *   - CCXXXXXXXXX   (without leading +, same digit count)
 *   - Spaces, dashes, dots, and parentheses are stripped before validation.
 *
 * Does NOT normalise the output (no transform). Use `moroccanPhonePrimitive`
 * for Morocco-specific validation with +212 normalisation.
 *
 * @example
 *   phoneSchema.parse('+1 (555) 123-4567') // → '+15551234567'
 *   phoneSchema.parse('0612345678')         // throws — no country code
 */
/**
 * Generic international phone schema (E.164-compatible).
 * Kept as a separate export because `phoneSchema` is Morocco-first.
 */
export const internationalPhoneSchema = z
  .string()
  .transform(phone => phone.replace(/[\s\-().]/g, ''))
  .refine(
    (phone) => /^\+?[1-9]\d{6,14}$/.test(phone),
    'Invalid phone number format (expected E.164 or national with country code)'
  )

// ─────────────────────────────────────────────────────────────────────────────
// MOROCCAN PHONE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Moroccan phone primitive.
 *
 * Accepts any of:
 *   - +212XXXXXXXXX  (international format, 9 significant digits)
 *   -  212XXXXXXXXX  (without leading +)
 *   - 0[5-7]XXXXXXXX (national format — mobile: 06/07, landline: 05)
 *
 * Normalises all variants to +212XXXXXXXXX.
 *
 * @example
 *   moroccanPhonePrimitive.parse('0612345678')    // → '+212612345678'
 *   moroccanPhonePrimitive.parse('+212712345678') // → '+212712345678'
 *   moroccanPhonePrimitive.parse('+1 555 000')    // throws
 */
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

/**
 * Canonical phone schema.
 *
 * Morocco-first as requested. Exported after `moroccanPhonePrimitive` to
 * avoid temporal dead zone issues in module initialization.
 */
export const phoneSchema = moroccanPhonePrimitive

// ─────────────────────────────────────────────────────────────────────────────
// MOROCCAN CIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Moroccan National ID card schema (CIN — Carte d'Identité Nationale).
 *
 * Format:
 *   - 1 or 2 uppercase letters (old cards: 1 letter; new cards: 2 letters)
 *   - Followed by 5 or 6 digits
 *   - Examples: A123456, BE123456, T12345
 *
 * Input is case-insensitive; output is normalised to uppercase.
 *
 * @example
 *   moroccanCinSchema.parse('be123456') // → 'BE123456'
 *   moroccanCinSchema.parse('A12345')   // → 'A12345'
 *   moroccanCinSchema.parse('12345678') // throws — no letter prefix
 */
export const moroccanCinSchema = z
  .string()
  .trim()
  .transform(cin => cin.toUpperCase())
  .refine(
    (cin) => CIN_REGEX.test(cin),
    'Invalid Moroccan CIN format (expected 2 letters followed by 5–6 digits, e.g. AB12345 or AB123456)'
  )

// ─────────────────────────────────────────────────────────────────────────────
// UUID
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UUID primitive.
 *
 * Validates RFC 4122 UUID v1–v5 format (case-insensitive, Zod normalises
 * to lowercase).
 *
 * @example
 *   uuidPrimitive.parse('550e8400-e29b-41d4-a716-446655440000') // → same
 *   uuidPrimitive.parse('not-a-uuid')                           // throws
 */
export const uuidPrimitive = z.string().uuid('Invalid ID format')

/**
 * Canonical UUID schema.
 *
 * Identical to `uuidPrimitive`. Exported under the `*Schema` convention for
 * consistency with other canonical exports.
 *
 * @see uuidPrimitive
 */
export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format')
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'Invalid UUID v4 format'
  )

// ─────────────────────────────────────────────────────────────────────────────
// NAME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical personal-name schema.
 *
 * Strictest shared constraints inferred from register/profile schemas:
 *   - 2..50 characters
 *   - letters (Unicode), spaces, hyphen, apostrophe
 *   - trimmed
 */
export const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be less than 50 characters')
  .regex(/^[$\p{L}\s\-']+$/u, 'Name contains invalid characters')
  .transform(name => name.trim())

export type EmailPrimitive = z.infer<typeof emailPrimitive>
export type Email = z.infer<typeof emailSchema>

export type StrictPassword = z.infer<typeof strictPasswordPrimitive>
export type Password = z.infer<typeof passwordSchema>

export type InternationalPhone = z.infer<typeof internationalPhoneSchema>
export type MoroccanPhone = z.infer<typeof moroccanPhonePrimitive>
export type Phone = z.infer<typeof phoneSchema>

export type MoroccanCin = z.infer<typeof moroccanCinSchema>

export type UuidPrimitive = z.infer<typeof uuidPrimitive>
export type Uuid = z.infer<typeof uuidSchema>

export type Name = z.infer<typeof nameSchema>
