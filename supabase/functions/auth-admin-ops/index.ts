import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLEANUP_WINDOW_MS = 30 * 60 * 1000

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  ...CORS_HEADERS,
}

type Action = 'delete-user' | 'confirm-email' | 'cleanup-pending-signup'

interface RequestBody {
  action?: Action
  userId?: string
  email?: string
  otp?: string
}

interface AuthResult {
  user: { id: string }
  profile: { id: string; role: string }
}

type OtpSource = 'otp_codes' | 'otp_tokens'

interface EmailVerificationOtpRecord {
  id: string
  user_id: string
  source: OtpSource
}

function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function isSchemaCompatibilityError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false
  }

  const message = (error.message || '').toLowerCase()
  return error.code === '42P01'
    || error.code === '42703'
    || message.includes('does not exist')
    || message.includes('could not find')
}

async function findEmailVerificationOtp(
  adminClient: ReturnType<typeof createClient>,
  normalizedEmail: string,
  normalizedOtp: string,
): Promise<{ record: EmailVerificationOtpRecord | null; error: string | null }> {
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (profileError) {
    return { record: null, error: profileError.message }
  }

  if (!profile) {
    return { record: null, error: null }
  }

  const expiresAfter = new Date().toISOString()

  const otpCodesAttempts = [
    () => adminClient
      .from('otp_codes')
      .select('id, user_id')
      .eq('user_id', profile.id)
      .eq('code', normalizedOtp)
      .in('purpose', ['email_verify', 'email_verification'])
      .eq('used', false)
      .gt('expires_at', expiresAfter)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    () => adminClient
      .from('otp_codes')
      .select('id, user_id')
      .eq('user_id', profile.id)
      .eq('code', normalizedOtp)
      .gt('expires_at', expiresAfter)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]

  for (const executeQuery of otpCodesAttempts) {
    const { data, error } = await executeQuery()

    if (data) {
      return {
        record: { ...data, source: 'otp_codes' },
        error: null,
      }
    }

    if (error && !isSchemaCompatibilityError(error)) {
      return { record: null, error: error.message }
    }
  }

  const { data: legacyOtpRecord, error: legacyOtpError } = await adminClient
    .from('otp_tokens')
    .select('id, user_id')
    .eq('user_id', profile.id)
    .eq('token', normalizedOtp)
    .gt('expires_at', expiresAfter)
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (legacyOtpError) {
    if (isSchemaCompatibilityError(legacyOtpError)) {
      return { record: null, error: null }
    }

    return { record: null, error: legacyOtpError.message }
  }

  if (!legacyOtpRecord) {
    return { record: null, error: null }
  }

  return {
    record: { ...legacyOtpRecord, source: 'otp_tokens' },
    error: null,
  }
}

async function consumeEmailVerificationOtp(
  adminClient: ReturnType<typeof createClient>,
  otpRecord: EmailVerificationOtpRecord,
): Promise<string | null> {
  if (otpRecord.source === 'otp_codes') {
    const { error: markUsedError } = await adminClient
      .from('otp_codes')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('id', otpRecord.id)

    if (!markUsedError) {
      return null
    }

    if (!isSchemaCompatibilityError(markUsedError)) {
      return markUsedError.message
    }

    const { error: deleteFallbackError } = await adminClient
      .from('otp_codes')
      .delete()
      .eq('id', otpRecord.id)

    return deleteFallbackError?.message || null
  }

  const { error: deleteError } = await adminClient
    .from('otp_tokens')
    .delete()
    .eq('id', otpRecord.id)

  return deleteError?.message || null
}

async function requireAdmin(
  adminClient: ReturnType<typeof createClient>,
  authHeader: string | null,
): Promise<AuthResult | Response> {
  if (!authHeader?.startsWith('Bearer ')) {
    return respond({ error: 'Missing authorization header' }, 401)
  }

  const callerJwt = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await adminClient.auth.getUser(callerJwt)

  if (authError || !user) {
    return respond({ error: 'Invalid or expired token' }, 401)
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return respond({ error: 'Unable to load caller profile' }, 403)
  }

  if (profile.role !== 'admin') {
    return respond({ error: 'Forbidden: admin role required' }, 403)
  }

  return {
    user: { id: user.id },
    profile,
  }
}

async function handleDeleteUser(
  adminClient: ReturnType<typeof createClient>,
  authHeader: string | null,
  userId?: string,
): Promise<Response> {
  if (!userId) {
    return respond({ error: 'Missing required field: userId' }, 400)
  }

  const authResult = await requireAdmin(adminClient, authHeader)
  if (authResult instanceof Response) {
    return authResult
  }

  const { data: targetProfile, error: targetProfileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()

  if (targetProfileError) {
    return respond({ error: targetProfileError.message }, 500)
  }

  if (!targetProfile) {
    return respond({ error: 'User not found' }, 404)
  }

  if (targetProfile.role === 'admin') {
    return respond({ error: 'Admin accounts cannot be deleted through this endpoint' }, 403)
  }

  if (authResult.user.id === userId) {
    return respond({ error: 'You cannot delete your own account through this endpoint' }, 403)
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
  if (deleteError) {
    return respond({ error: deleteError.message }, 500)
  }

  return respond({ success: true, userId })
}

async function handleConfirmEmail(
  adminClient: ReturnType<typeof createClient>,
  email?: string,
  otp?: string,
): Promise<Response> {
  const normalizedEmail = email?.trim().toLowerCase()
  const normalizedOtp = otp?.trim()

  if (!normalizedEmail || !normalizedOtp) {
    return respond({ error: 'Missing required fields: email, otp' }, 400)
  }

  const { record: otpRecord, error: otpLookupError } = await findEmailVerificationOtp(
    adminClient,
    normalizedEmail,
    normalizedOtp,
  )

  if (otpLookupError) {
    return respond({ error: otpLookupError }, 500)
  }

  if (!otpRecord) {
    return respond({ error: 'Invalid or expired OTP' }, 400)
  }

  const { error: confirmError } = await adminClient.auth.admin.updateUserById(otpRecord.user_id, {
    email_confirm: true,
  })

  if (confirmError) {
    return respond({ error: confirmError.message }, 500)
  }

  const consumeOtpError = await consumeEmailVerificationOtp(adminClient, otpRecord)
  if (consumeOtpError) {
    return respond({ error: consumeOtpError }, 500)
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', otpRecord.user_id)
    .maybeSingle()

  return respond({
    success: true,
    verified: true,
    profile,
  })
}

async function handleCleanupPendingSignup(
  adminClient: ReturnType<typeof createClient>,
  userId?: string,
  email?: string,
): Promise<Response> {
  const normalizedEmail = email?.trim().toLowerCase()

  if (!userId || !normalizedEmail) {
    return respond({ error: 'Missing required fields: userId, email' }, 400)
  }

  const { data: existingProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    return respond({ error: profileError.message }, 500)
  }

  if (existingProfile) {
    return respond({ success: true, skipped: true, reason: 'profile-exists' })
  }

  const { data: authUserResult, error: authUserError } = await adminClient.auth.admin.getUserById(userId)
  if (authUserError) {
    return respond({ success: true, skipped: true, reason: 'auth-user-not-found' })
  }

  const authUser = authUserResult.user
  if (!authUser) {
    return respond({ success: true, skipped: true, reason: 'auth-user-not-found' })
  }

  const authEmail = authUser.email?.trim().toLowerCase()
  if (authEmail !== normalizedEmail) {
    return respond({ success: true, skipped: true, reason: 'email-mismatch' })
  }

  if (authUser.email_confirmed_at) {
    return respond({ success: true, skipped: true, reason: 'email-already-confirmed' })
  }

  if (authUser.created_at) {
    const ageMs = Date.now() - new Date(authUser.created_at).getTime()
    if (Number.isFinite(ageMs) && ageMs > CLEANUP_WINDOW_MS) {
      return respond({ success: true, skipped: true, reason: 'cleanup-window-expired' })
    }
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
  if (deleteError) {
    return respond({ error: deleteError.message }, 500)
  }

  return respond({ success: true, deleted: true, userId })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return respond({ error: 'Invalid JSON body' }, 400)
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const authHeader = req.headers.get('Authorization')

  switch (body.action) {
    case 'delete-user':
      return await handleDeleteUser(adminClient, authHeader, body.userId)
    case 'confirm-email':
      return await handleConfirmEmail(adminClient, body.email, body.otp)
    case 'cleanup-pending-signup':
      return await handleCleanupPendingSignup(adminClient, body.userId, body.email)
    default:
      return respond({ error: 'Invalid action' }, 400)
  }
})