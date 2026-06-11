import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

/**
 * Generate sales report for a date range
 */
async function generateSalesReport({ startDate, endDate, vendorId = null } = {}) {
  try {
    let query = supabase
      .from('orders')
      .select(`
        id, created_at, total, status,
        buyer:profiles!orders_buyer_id_fkey(first_name, last_name, email),
        items:order_items(quantity, unit_price, product:products(name, category))
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .in('status', ['delivered', 'completed'])
      .order('created_at', { ascending: false })

    if (vendorId) {
      query = query.eq('vendor_id', vendorId)
    }

    const { data, error } = await query
    if (error) throw error

    const total = (data || []).reduce((sum, o) => sum + (o.total || 0), 0)
    const count = data?.length || 0

    return {
      rows: data || [],
      summary: {
        totalRevenue: total,
        orderCount: count,
        avgOrderValue: count > 0 ? total / count : 0
      }
    }
  } catch (err) {
    logger.error('reportService.generateSalesReport', err)
    throw err
  }
}

/**
 * Generate user/customer report
 */
async function generateUserReport({ startDate, endDate } = {}) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { rows: data || [] }
  } catch (err) {
    logger.error('reportService.generateUserReport', err)
    throw err
  }
}

/**
 * Generate product inventory report
 */
async function generateInventoryReport({ vendorId = null } = {}) {
  try {
    let query = supabase
      .from('products')
      .select(`
        id, name, category, price, stock_quantity, created_at,
        vendor:profiles!products_vendor_id_fkey(first_name, last_name, store_name)
      `)
      .order('stock_quantity', { ascending: true })

    if (vendorId) query = query.eq('vendor_id', vendorId)

    const { data, error } = await query
    if (error) throw error
    return { rows: data || [] }
  } catch (err) {
    logger.error('reportService.generateInventoryReport', err)
    throw err
  }
}

/**
 * Generate delivery performance report
 */
async function generateDeliveryReport({ startDate, endDate } = {}) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, created_at, status, delivered_at,
        driver:profiles!orders_driver_id_fkey(first_name, last_name),
        buyer:profiles!orders_buyer_id_fkey(first_name, last_name, city)
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('driver_id', 'is', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    const delivered = (data || []).filter(o => o.status === 'delivered' || o.status === 'completed')
    const failed = (data || []).filter(o => o.status === 'cancelled')

    return {
      rows: data || [],
      summary: {
        totalDeliveries: data?.length || 0,
        successRate: data?.length ? ((delivered.length / data.length) * 100).toFixed(1) : 0,
        failed: failed.length
      }
    }
  } catch (err) {
    logger.error('reportService.generateDeliveryReport', err)
    throw err
  }
}

export const reportService = {
  generateSalesReport,
  generateUserReport,
  generateInventoryReport,
  generateDeliveryReport
}
