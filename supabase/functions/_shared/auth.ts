import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from './cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function corsResponse(req: Request, body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req.headers.get('Origin')),
      'Content-Type': 'application/json',
    },
  })
}

export async function requireAuth(req: Request): Promise<{ userId: string; role: string }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw corsResponse(req, { error: 'Unauthorized' }, 401)
  }
  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) throw corsResponse(req, { error: 'Invalid token' }, 401)

  const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profileError || !profile) {
    throw corsResponse(req, { error: 'User profile not found' }, 403)
  }
  return { userId: user.id, role: profile.role }
}

export async function requireRole(req: Request, allowedRoles: string[]): Promise<{ userId: string; role: string }> {
  const auth = await requireAuth(req)
  if (!allowedRoles.includes(auth.role)) {
    throw corsResponse(req, { error: 'Forbidden' }, 403)
  }
  return auth
}
