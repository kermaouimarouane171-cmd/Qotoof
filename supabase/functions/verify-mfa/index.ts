import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const ENCODER = new TextEncoder()

const json = (body: unknown, status = 200, req?: Request) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(req ? getCorsHeaders(req.headers.get('Origin')) : {}),
      'Content-Type': 'application/json',
    },
  })

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyText = Deno.env.get('TOTP_SECRET_KEY')
  if (!keyText) throw new Error('TOTP_SECRET_KEY not configured')
  const keyBuffer = await crypto.subtle.digest('SHA-256', ENCODER.encode(keyText))
  return crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

async function decryptSecret(cipherText: string): Promise<string> {
  const key = await getEncryptionKey()
  const combined = Uint8Array.from(atob(cipherText), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const cipher = combined.slice(12)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  return new TextDecoder().decode(plain)
}

function base32Decode(secret: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of secret.toUpperCase().replace(/=+$/, '')) {
    const val = alphabet.indexOf(char)
    if (val === -1) continue
    bits += val.toString(2).padStart(5, '0')
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  }
  return bytes
}

async function validateTOTP(secret: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false
  const key = base32Decode(secret)
  const hmacKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const now = Math.floor(Date.now() / 1000)
  const counter = Math.floor(now / 30)
  for (const window of [-1, 0, 1]) {
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    const n = counter + window
    view.setUint32(0, 0, false)
    view.setUint32(4, n, false)
    const signature = await crypto.subtle.sign('HMAC', hmacKey, buffer)
    const digest = new Uint8Array(signature)
    const offset = digest[digest.length - 1] & 0x0f
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)
    const otp = (binary % 1000000).toString().padStart(6, '0')
    if (otp === code) return true
  }
  return false
}

async function getMfaSettings(adminClient: any, userId: string) {
  const { data, error } = await adminClient
    .from('mfa_settings')
    .select('failed_attempts, locked_until, totp_secret, is_enabled, method')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function logAudit(adminClient: any, userId: string, action: string, metadata: Record<string, unknown> = {}) {
  try {
    await adminClient.rpc('log_audit', {
      p_user_id: userId,
      p_action: action,
      p_entity_type: 'mfa',
      p_entity_id: userId,
      p_new_values: metadata,
    })
  } catch (err) {
    console.error('Failed to log MFA audit event:', err)
  }
}

serve(async (req) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405, req)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase configuration missing')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ success: false, error: 'Authentication required' }, 401, req)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)

    if (authError || !user) {
      return json({ success: false, error: 'Invalid or expired token' }, 401, req)
    }

    const body = await req.json()
    const method = typeof body?.method === 'string' ? body.method.trim() : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''

    if (!code || method !== 'totp') {
      return json({ success: false, error: 'TOTP method and code are required' }, 400, req)
    }

    const settings = await getMfaSettings(adminClient, user.id)
    if (!settings?.is_enabled || settings.method !== 'totp') {
      return json({ success: false, error: 'TOTP MFA is not enabled' }, 400, req)
    }

    if (settings?.locked_until && new Date(settings.locked_until).getTime() > Date.now()) {
      const retryAfter = Math.max(0, Math.floor((new Date(settings.locked_until).getTime() - Date.now()) / 1000))
      await logAudit(adminClient, user.id, 'MFA_VERIFY_LOCKED', { locked_until: settings.locked_until, method: 'totp' })
      return json({ success: false, locked: true, retryAfter, error: 'Account locked. Please try again later.' }, 429, req)
    }

    if (!settings?.totp_secret) {
      return json({ success: false, error: 'TOTP secret not configured' }, 400, req)
    }

    let decryptedSecret: string
    try {
      decryptedSecret = await decryptSecret(settings.totp_secret)
    } catch (_err) {
      return json({ success: false, error: 'Failed to decrypt TOTP secret' }, 500, req)
    }

    const isValid = await validateTOTP(decryptedSecret, code)
    if (!isValid) {
      const failedAttempts = (settings?.failed_attempts || 0) + 1
      const lockedUntil = failedAttempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
        : null
      const { error: updateError } = await adminClient
        .from('mfa_settings')
        .update({ failed_attempts: failedAttempts, locked_until: lockedUntil })
        .eq('user_id', user.id)
      if (updateError) throw updateError

      await logAudit(adminClient, user.id, 'MFA_VERIFY_FAILED', { failed_attempts: failedAttempts, locked_until: lockedUntil, method: 'totp' })
      return json(
        {
          success: false,
          locked: lockedUntil !== null,
          lockedUntil,
          retryAfter: lockedUntil ? Math.floor((new Date(lockedUntil).getTime() - Date.now()) / 1000) : 0,
          attemptsRemaining: Math.max(0, MAX_ATTEMPTS - failedAttempts),
          error: lockedUntil ? 'Too many attempts. Account locked.' : 'Invalid or expired code',
        },
        200,
        req
      )
    }

    const { error: resetError } = await adminClient
      .from('mfa_settings')
      .update({ failed_attempts: 0, locked_until: null, last_used_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (resetError) throw resetError

    await logAudit(adminClient, user.id, 'MFA_VERIFIED', { method: 'totp' })
    return json({ success: true }, 200, req)
  } catch (error) {
    console.error('verify-mfa error:', error)
    return json({ success: false, error: error instanceof Error ? error.message : 'Failed to verify MFA' }, 500, req)
  }
})
