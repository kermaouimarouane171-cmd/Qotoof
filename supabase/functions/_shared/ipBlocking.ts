/**
 * IP blocking helpers for Supabase Edge Functions.
 *
 * Uses the same database tables (`blocked_ips`, `security_alerts`) as the
 * client-side `src/services/ipBlocking.js`, but works with a service-role
 * admin client so it can be used inside edge functions.
 */

export type SecurityAlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export type SecurityAlertInput = {
  alertType: string
  severity: SecurityAlertSeverity
  title: string
  description?: string
  sourceIp?: string
  userAgent?: string
  requestPath?: string
  requestMethod?: string
  metadata?: Record<string, unknown>
}

/**
 * Check whether an IP address is currently blocked.
 * Falls back to `false` on any error so the edge function stays available.
 */
export const isIpBlocked = async (supabase: any, ip: string): Promise<boolean> => {
  if (!ip || ip === 'unknown') {
    return false
  }

  try {
    const { data, error } = await supabase.rpc('is_ip_blocked', { p_ip: ip }).single()

    if (error) {
      console.error('is_ip_blocked rpc error:', error)
      return false
    }

    return data === true
  } catch (error) {
    console.error('isIpBlocked exception:', error)
    return false
  }
}

/**
 * Log a security alert to the `security_alerts` table.
 * Never throws so it cannot break the request handling flow.
 */
export const logSecurityAlert = async (
  supabase: any,
  input: SecurityAlertInput,
): Promise<void> => {
  try {
    await supabase.rpc('create_security_alert', {
      p_alert_type: input.alertType,
      p_severity: input.severity,
      p_title: input.title,
      p_description: input.description || null,
      p_source_ip: input.sourceIp || null,
      p_user_agent: input.userAgent || null,
      p_request_path: input.requestPath || null,
      p_request_method: input.requestMethod || null,
      p_metadata: input.metadata || {},
    })
  } catch (error) {
    console.error('logSecurityAlert exception:', error)
  }
}
