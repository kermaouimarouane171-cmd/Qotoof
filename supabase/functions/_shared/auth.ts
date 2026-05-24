import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export async function requireAuth(req: Request): Promise<{ userId: string; role: string }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) throw new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 })

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  return { userId: user.id, role: profile?.role ?? 'buyer' }
}

export async function requireRole(req: Request, allowedRoles: string[]): Promise<{ userId: string; role: string }> {
  const auth = await requireAuth(req)
  if (!allowedRoles.includes(auth.role)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
  }
  return auth
}
