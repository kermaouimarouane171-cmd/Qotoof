import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
const BACKUP_CODE_LENGTH = 8
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

async function encryptSecret(plain: string): Promise<string> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, ENCODER.encode(plain))
  const cipherBytes = new Uint8Array(cipher)
  const combined = new Uint8Array(iv.length + cipherBytes.length)
  combined.set(iv)
  combined.set(cipherBytes, iv.length)
  return btoa(String.fromCharCode(...combined))
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

function base32Encode(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0')
  }
  let result = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    result += alphabet[parseInt(bits.slice(i, i + 5), 2)]
  }
  return result
}

function generateTOTPSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  return base32Encode(bytes)
}

function generateBackupCode(): string {
  const digits = '0123456789'
  let code = ''
  for (let i = 0; i < BACKUP_CODE_LENGTH; i++) {
    code += digits[Math.floor(Math.random() * digits.length)]
  }
  return code
}

async function hashBackupCode(code: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', ENCODER.encode(code.trim()))
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function getMfaSettings(adminClient: any, userId: string) {
  const { data, error } = await adminClient
    .from('mfa_settings')
    .select('failed_attempts, locked_until')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function ensureMfaSettings(adminClient: any, userId: string, method: string | null = null) {
  const { data: existing, error: selectError } = await adminClient
    .from('mfa_settings')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return

  const { error: insertError } = await adminClient
    .from('mfa_settings')
    .insert({ user_id: userId, is_enabled: false, method, failed_attempts: 0 })
  if (insertError) throw insertError
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
    const action = typeof body?.action === 'string' ? body.action.trim() : 'enable'

    // ── Ensure action: create an empty mfa_settings row without side effects ─
    if (action === 'ensure') {
      await ensureMfaSettings(adminClient, user.id, method || 'totp')
      await logAudit(adminClient, user.id, 'MFA_SETTINGS_CREATED', { method: method || 'totp' })
      return json({ success: true }, 200, req)
    }

    // ── Generate action: create a TOTP secret on the server ──────────────────
    if (action === 'generate') {
      if (method !== 'totp') {
        return json({ success: false, error: 'TOTP method is required for secret generation' }, 400, req)
      }
      const secret = generateTOTPSecret()
      const qrCodeUrl = `otpauth://totp/Qotoof:${user.email}?secret=${secret}&issuer=Qotoof`
      return json({ success: true, secret, qrCodeUrl }, 200, req)
    }

    // ── Disable action: turn off MFA and clear secrets ───────────────────────
    if (action === 'disable') {
      const { error: disableError } = await adminClient
        .from('mfa_settings')
        .update({
          is_enabled: false,
          method: null,
          totp_secret: null,
          totp_backup_codes: null,
          failed_attempts: 0,
          locked_until: null,
        })
        .eq('user_id', user.id)
      if (disableError) throw disableError

      await logAudit(adminClient, user.id, 'MFA_DISABLED', { method: method || 'unknown' })
      return json({ success: true }, 200, req)
    }

    // ── Regenerate backup codes action ────────────────────────────────────────
    if (action === 'regenerate-backup-codes') {
      const plainBackupCodes = Array.from({ length: 10 }, generateBackupCode)
      const hashedBackupCodes = await Promise.all(plainBackupCodes.map(hashBackupCode))

      const { error: updateError } = await adminClient
        .from('mfa_settings')
        .update({ totp_backup_codes: hashedBackupCodes })
        .eq('user_id', user.id)
      if (updateError) throw updateError

      await logAudit(adminClient, user.id, 'MFA_BACKUP_CODES_REGENERATED', {})
      return json({ success: true, backupCodes: plainBackupCodes }, 200, req)
    }

    // ── Email MFA: initiate (generate OTP + send email, do NOT enable yet) ────
    if (action === 'initiate-email') {
      await ensureMfaSettings(adminClient, user.id, 'email')

      // Generate OTP via RPC
      const { data: otp, error: otpError } = await adminClient.rpc('generate_otp', {
        p_user_id: user.id,
        p_purpose: 'mfa_verify',
      })
      if (otpError) throw otpError
      if (!otp) throw new Error('Failed to generate OTP')

      // Send OTP email via Edge Function invocation
      // Pass the user's JWT so send-email's requireAuth can validate them.
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: user.email,
          toName: user.user_metadata?.full_name || user.email.split('@')[0],
          subject: '🔐 رمز التحقق الخاص بك - Qotoof',
          template: 'otp_verification',
          data: { otp, expiryMinutes: 10, appName: 'Qotoof' },
        }),
      })

      if (!emailResponse.ok) {
        const emailErr = await emailResponse.json().catch(() => ({}))
        await logAudit(adminClient, user.id, 'MFA_EMAIL_INITIATE_FAILED', { error: emailErr.error || 'email send failed' })
        return json({ success: false, error: 'Failed to send OTP email. MFA was NOT enabled.' }, 500, req)
      }

      await logAudit(adminClient, user.id, 'MFA_EMAIL_INITIATED', { method: 'email' })
      return json({ success: true, message: 'OTP sent to your email' }, 200, req)
    }

    // ── Email MFA: verify OTP and enable MFA + generate backup codes ──────────
    if (action === 'verify-email') {
      const emailCode = typeof body?.code === 'string' ? body.code.trim() : ''
      if (!emailCode) {
        return json({ success: false, error: 'Verification code is required' }, 400, req)
      }

      await ensureMfaSettings(adminClient, user.id, 'email')

      const settings = await getMfaSettings(adminClient, user.id)
      if (settings?.locked_until && new Date(settings.locked_until).getTime() > Date.now()) {
        const retryAfter = Math.max(0, Math.floor((new Date(settings.locked_until).getTime() - Date.now()) / 1000))
        await logAudit(adminClient, user.id, 'MFA_ENABLE_LOCKED', { locked_until: settings.locked_until })
        return json({ success: false, locked: true, retryAfter, error: 'Account locked. Please try again later.' }, 429, req)
      }

      // Verify OTP via RPC
      const { data: otpValid, error: verifyError } = await adminClient.rpc('verify_otp', {
        p_user_id: user.id,
        p_code: emailCode,
        p_purpose: 'mfa_verify',
      })
      if (verifyError) throw verifyError

      if (!otpValid) {
        const failedAttempts = (settings?.failed_attempts || 0) + 1
        const lockedUntil = failedAttempts >= MAX_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
          : null
        const { error: updateErr } = await adminClient
          .from('mfa_settings')
          .update({ failed_attempts: failedAttempts, locked_until: lockedUntil })
          .eq('user_id', user.id)
        if (updateErr) throw updateErr

        await logAudit(adminClient, user.id, 'MFA_ENABLE_FAILED', { failed_attempts: failedAttempts, locked_until: lockedUntil, method: 'email' })
        return json({
          success: false,
          locked: lockedUntil !== null,
          retryAfter: lockedUntil ? LOCKOUT_MINUTES * 60 : 0,
          attemptsRemaining: Math.max(0, MAX_ATTEMPTS - failedAttempts),
          error: lockedUntil ? 'Too many attempts. Account locked.' : 'Invalid or expired code',
        }, 200, req)
      }

      // OTP verified — generate backup codes and enable MFA
      const plainBackupCodes = Array.from({ length: 10 }, generateBackupCode)
      const hashedBackupCodes = await Promise.all(plainBackupCodes.map(hashBackupCode))

      const { error: enableError } = await adminClient
        .from('mfa_settings')
        .update({
          is_enabled: true,
          method: 'email',
          totp_backup_codes: hashedBackupCodes,
          failed_attempts: 0,
          locked_until: null,
          enabled_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
      if (enableError) throw enableError

      await logAudit(adminClient, user.id, 'MFA_ENABLED', { method: 'email' })
      return json({ success: true, backupCodes: plainBackupCodes }, 200, req)
    }

    if (method !== 'totp') {
      return json({ success: false, error: 'Unsupported MFA method' }, 400, req)
    }

    const secret = typeof body?.secret === 'string' ? body.secret.trim() : ''
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!secret || !code) {
      return json({ success: false, error: 'TOTP secret and verification code are required' }, 400, req)
    }

    await ensureMfaSettings(adminClient, user.id, 'totp')

    const settings = await getMfaSettings(adminClient, user.id)
    if (settings?.locked_until && new Date(settings.locked_until).getTime() > Date.now()) {
      const retryAfter = Math.max(0, Math.floor((new Date(settings.locked_until).getTime() - Date.now()) / 1000))
      await logAudit(adminClient, user.id, 'MFA_ENABLE_LOCKED', { locked_until: settings.locked_until })
      return json({ success: false, locked: true, retryAfter, error: 'Account locked. Please try again later.' }, 429, req)
    }

    const isValid = await validateTOTP(secret, code)
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

      await logAudit(adminClient, user.id, 'MFA_ENABLE_FAILED', { failed_attempts: failedAttempts, locked_until: lockedUntil })
      return json(
        {
          success: false,
          locked: lockedUntil !== null,
          retryAfter: lockedUntil ? LOCKOUT_MINUTES * 60 : 0,
          attemptsRemaining: Math.max(0, MAX_ATTEMPTS - failedAttempts),
          error: lockedUntil ? 'Too many attempts. Account locked.' : 'Invalid TOTP code',
        },
        200,
        req
      )
    }

    const encryptedSecret = await encryptSecret(secret)
    const plainBackupCodes = Array.from({ length: 10 }, generateBackupCode)
    const hashedBackupCodes = await Promise.all(plainBackupCodes.map(hashBackupCode))

    const { error: updateError } = await adminClient
      .from('mfa_settings')
      .update({
        is_enabled: true,
        method: 'totp',
        totp_secret: encryptedSecret,
        totp_backup_codes: hashedBackupCodes,
        failed_attempts: 0,
        locked_until: null,
        enabled_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
    if (updateError) throw updateError

    await logAudit(adminClient, user.id, 'MFA_ENABLED', { method: 'totp' })

    return json({ success: true, backupCodes: plainBackupCodes }, 200, req)
  } catch (error) {
    console.error('enable-mfa error:', error)
    return json({ success: false, error: error instanceof Error ? error.message : 'Failed to enable MFA' }, 500, req)
  }
})
