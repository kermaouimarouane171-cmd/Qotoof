import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

/**
 * Admin Audit Report Service
 * Provides functions for querying and exporting admin activity logs
 */

/**
 * Get audit logs with filters and pagination
 * @param {Object} filters - Filter options
 * @param {string} filters.actorId - Filter by specific admin ID
 * @param {string} filters.actorRole - Filter by role (admin, vendor, driver, buyer)
 * @param {string} filters.actionCategory - Filter by action category (create, update, delete, etc.)
 * @param {string} filters.targetTable - Filter by target table
 * @param {string} filters.targetId - Filter by target record ID
 * @param {string} filters.startDate - Filter by start date (ISO string)
 * @param {string} filters.endDate - Filter by end date (ISO string)
 * @param {string} filters.severity - Filter by severity (low, info, medium, high, critical)
 * @param {Object} pagination - Pagination options
 * @param {number} pagination.page - Page number (1-based)
 * @param {number} pagination.pageSize - Items per page
 * @returns {Promise<Object>} { data, count, error }
 */
async function getAuditLogs(filters = {}, pagination = { page: 1, pageSize: 50 }) {
  try {
    const { page = 1, pageSize = 50 } = pagination
    const offset = (page - 1) * pageSize

    let query = supabase
      .from('admin_audit_logs_view')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters.actorId) {
      query = query.eq('actor_id', filters.actorId)
    }

    if (filters.actorRole) {
      query = query.eq('actor_role', filters.actorRole)
    }

    if (filters.actionCategory) {
      query = query.eq('action_category', filters.actionCategory)
    }

    if (filters.targetTable) {
      query = query.eq('target_table', filters.targetTable)
    }

    if (filters.targetId) {
      query = query.eq('target_id', filters.targetId)
    }

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate)
    }

    if (filters.severity) {
      query = query.eq('severity', filters.severity)
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1)

    const { data, error, count } = await query

    if (error) throw error

    return {
      data: data || [],
      count: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize)
    }
  } catch (error) {
    logger.error('auditReportService.getAuditLogs error:', error)
    return {
      data: [],
      count: 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: 0,
      error: error.message
    }
  }
}

/**
 * Get audit log statistics for dashboard
 * @returns {Promise<Object>} Statistics by action category, role, severity
 */
async function getAuditStatistics() {
  try {
    // Get stats by action category
    const { data: categoryStats, error: categoryError } = await supabase
      .from('admin_audit_logs_view')
      .select('action_category')
      .not('action_category', 'is', null)

    // Get stats by actor role
    const { data: roleStats, error: roleError } = await supabase
      .from('admin_audit_logs_view')
      .select('actor_role')
      .not('actor_role', 'is', null)

    // Get stats by severity
    const { data: severityStats, error: severityError } = await supabase
      .from('admin_audit_logs_view')
      .select('severity')
      .not('severity', 'is', null)

    if (categoryError || roleError || severityError) {
      throw new Error('Failed to fetch statistics')
    }

    // Count occurrences
    const countBy = (array, key) => {
      return (array || []).reduce((acc, item) => {
        const value = item[key]
        acc[value] = (acc[value] || 0) + 1
        return acc
      }, {})
    }

    return {
      byActionCategory: countBy(categoryStats, 'action_category'),
      byActorRole: countBy(roleStats, 'actor_role'),
      bySeverity: countBy(severityStats, 'severity')
    }
  } catch (error) {
    logger.error('auditReportService.getAuditStatistics error:', error)
    return {
      byActionCategory: {},
      byActorRole: {},
      bySeverity: {}
    }
  }
}

/**
 * Get audit log details by ID
 * @param {string} logId - Audit log ID
 * @returns {Promise<Object>} Audit log details
 */
async function getAuditLogById(logId) {
  try {
    const { data, error } = await supabase
      .from('admin_audit_logs_view')
      .select('*')
      .eq('id', logId)
      .single()

    if (error) throw error

    return data
  } catch (error) {
    logger.error('auditReportService.getAuditLogById error:', error)
    return null
  }
}

/**
 * Export audit logs to CSV
 * @param {Object} filters - Filter options (same as getAuditLogs)
 * @returns {Promise<string>} CSV string
 */
async function exportAuditLogsToCSV(filters = {}) {
  try {
    // Fetch all matching logs (no pagination for export)
    const { data, error } = await supabase
      .from('admin_audit_logs_view')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Apply filters manually (since we can't use range for export)
    let filteredData = data || []

    if (filters.actorId) {
      filteredData = filteredData.filter(log => log.actor_id === filters.actorId)
    }

    if (filters.actorRole) {
      filteredData = filteredData.filter(log => log.actor_role === filters.actorRole)
    }

    if (filters.actionCategory) {
      filteredData = filteredData.filter(log => log.action_category === filters.actionCategory)
    }

    if (filters.targetTable) {
      filteredData = filteredData.filter(log => log.target_table === filters.targetTable)
    }

    if (filters.targetId) {
      filteredData = filteredData.filter(log => log.target_id === filters.targetId)
    }

    if (filters.startDate) {
      filteredData = filteredData.filter(log => log.created_at >= filters.startDate)
    }

    if (filters.endDate) {
      filteredData = filteredData.filter(log => log.created_at <= filters.endDate)
    }

    if (filters.severity) {
      filteredData = filteredData.filter(log => log.severity === filters.severity)
    }

    // Convert to CSV
    const headers = [
      'ID',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Action',
      'Action Category',
      'Target Table',
      'Target ID',
      'Severity',
      'IP Address',
      'User Agent',
      'Created At'
    ]

    const rows = filteredData.map(log => [
      log.id,
      log.actor_name || '',
      log.actor_email || '',
      log.actor_role || '',
      log.action || '',
      log.action_category || '',
      log.target_table || '',
      log.target_id || '',
      log.severity || '',
      log.ip_address || '',
      log.user_agent || '',
      log.created_at || ''
    ])

    // Escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const csvRows = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ]

    return csvRows.join('\n')
  } catch (error) {
    logger.error('auditReportService.exportAuditLogsToCSV error:', error)
    throw error
  }
}

/**
 * Get available filter options (distinct values)
 * @returns {Promise<Object>} { actorRoles, actionCategories, targetTables, severities }
 */
async function getFilterOptions() {
  try {
    const [rolesResult, categoriesResult, tablesResult, severitiesResult] = await Promise.all([
      supabase.from('admin_audit_logs_view').select('actor_role').not('actor_role', 'is', null),
      supabase.from('admin_audit_logs_view').select('action_category').not('action_category', 'is', null),
      supabase.from('admin_audit_logs_view').select('target_table').not('target_table', 'is', null),
      supabase.from('admin_audit_logs_view').select('severity').not('severity', 'is', null)
    ])

    const extractDistinct = (result, key) => {
      return [...new Set((result.data || []).map(item => item[key]))].filter(Boolean).sort()
    }

    return {
      actorRoles: extractDistinct(rolesResult, 'actor_role'),
      actionCategories: extractDistinct(categoriesResult, 'action_category'),
      targetTables: extractDistinct(tablesResult, 'target_table'),
      severities: extractDistinct(severitiesResult, 'severity')
    }
  } catch (error) {
    logger.error('auditReportService.getFilterOptions error:', error)
    return {
      actorRoles: [],
      actionCategories: [],
      targetTables: [],
      severities: []
    }
  }
}

// Named export (not default) to match existing pattern in reportService.js
export const auditReportService = {
  getAuditLogs,
  getAuditStatistics,
  getAuditLogById,
  exportAuditLogsToCSV,
  getFilterOptions
}
