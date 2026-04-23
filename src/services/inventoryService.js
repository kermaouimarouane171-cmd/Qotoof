import { supabase } from './supabase'
import { logger } from '@/utils/logger'

const ACTIVE_WAITLIST_STATUS = 'active'

const normalizeInventoryItem = (product) => {
  const stock = Number(product.stock_quantity ?? product.available_quantity ?? 0)
  const threshold = Number(product.stock_alert_threshold ?? 10)
  const waitlistCount = Number(product.waitlist_count ?? 0)

  return {
    ...product,
    currentStock: stock,
    threshold,
    waitlistCount,
  }
}

const isMissingRelationError = (error) => {
  const message = error?.message || ''
  return error?.code === '42P01' || /relation .* does not exist/i.test(message)
}

export const buildInventorySummary = (products = []) => {
  const items = products.map(normalizeInventoryItem)

  return {
    totalProducts: items.length,
    inStock: items.filter((item) => item.currentStock > item.threshold).length,
    lowStock: items.filter((item) => item.currentStock > 0 && item.currentStock <= item.threshold).length,
    outOfStock: items.filter((item) => item.currentStock <= 0 || item.is_available === false).length,
    activeWaitlists: items.reduce((total, item) => total + item.waitlistCount, 0),
    inventoryValue: Number(
      items.reduce((total, item) => total + (Number(item.price_per_unit || 0) * Math.max(item.currentStock, 0)), 0).toFixed(2)
    ),
  }
}

export const shouldNotifyWaitlist = ({ previousQuantity, nextQuantity, waitlistCount }) => {
  return Number(previousQuantity || 0) <= 0 && Number(nextQuantity || 0) > 0 && Number(waitlistCount || 0) > 0
}

const fetchWaitlistEntries = async (productId) => {
  const { data, error } = await supabase
    .from('product_waitlists')
    .select('id, user_id, requested_quantity, status')
    .eq('product_id', productId)
    .eq('status', ACTIVE_WAITLIST_STATUS)

  if (error) throw error
  return data || []
}

const sendRestockNotification = async ({ userId, productId, productName, availableQuantity }) => {
  const payload = {
    p_user_id: userId,
    p_title: 'عاد المنتج للمخزون',
    p_message: `المنتج "${productName}" متوفر الآن بكمية ${Number(availableQuantity || 0).toFixed(2)}.`,
    p_type: 'inventory',
    p_category: 'inventory',
    p_data: {
      product_id: productId,
      available_quantity: availableQuantity,
    },
    p_channel: 'in_app',
    p_priority: 'high',
    p_action_url: `/products/${productId}`,
    p_action_label: 'عرض المنتج',
  }

  const { error } = await supabase.rpc('create_user_notification', payload)
  if (!error) return

  const { error: insertError } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title: 'عاد المنتج للمخزون',
      message: `المنتج "${productName}" متوفر الآن بكمية ${Number(availableQuantity || 0).toFixed(2)}.`,
      type: 'inventory',
      category: 'inventory',
      channel: 'in_app',
      priority: 'high',
      action_url: `/products/${productId}`,
      action_label: 'عرض المنتج',
      data: {
        product_id: productId,
        available_quantity: availableQuantity,
      },
      is_read: false,
    })

  if (insertError) {
    throw insertError
  }
}

const markWaitlistEntriesNotified = async (entryIds = []) => {
  if (entryIds.length === 0) return

  const { error } = await supabase
    .from('product_waitlists')
    .update({
      status: 'notified',
      notified_at: new Date().toISOString(),
    })
    .in('id', entryIds)

  if (error) throw error
}

const insertStockHistory = async ({ productId, vendorId, oldQuantity, newQuantity, reason, changedBy, changeType }) => {
  try {
    const { error } = await supabase
      .from('stock_history')
      .insert({
        product_id: productId,
        vendor_id: vendorId,
        changed_by: changedBy,
        change_type: changeType,
        old_quantity: oldQuantity,
        new_quantity: newQuantity,
        quantity_delta: Number((newQuantity - oldQuantity).toFixed(2)),
        reason,
      })

    if (error) throw error
  } catch (error) {
    if (!isMissingRelationError(error)) {
      logger.warn('Unable to insert stock history entry:', error)
    }
  }
}

const inventoryService = {
  async getVendorInventory(vendorId) {
    const { data, error } = await supabase
      .from('products')
      .select('id, vendor_id, name, unit_type, price_per_unit, available_quantity, stock_quantity, stock_alert_threshold, waitlist_enabled, waitlist_count, is_available, is_active, updated_at')
      .eq('vendor_id', vendorId)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return (data || []).map(normalizeInventoryItem)
  },

  async getInventorySummary(vendorId) {
    const items = await this.getVendorInventory(vendorId)
    return {
      items,
      summary: buildInventorySummary(items),
    }
  },

  async updateProductStock({ productId, vendorId, nextQuantity, reason = 'تم تحديث المخزون يدوياً', changeType = 'manual_update' }) {
    const quantity = Number(nextQuantity)
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error('الكمية غير صالحة')
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, vendor_id, available_quantity, stock_quantity, stock_alert_threshold, waitlist_count, is_available, is_active, last_restocked_at')
      .eq('id', productId)
      .eq('vendor_id', vendorId)
      .single()

    if (productError) throw productError

    const previousQuantity = Number(product.stock_quantity ?? product.available_quantity ?? 0)
    const threshold = Number(product.stock_alert_threshold ?? 10)
    const now = new Date().toISOString()

    const updatePayload = {
      available_quantity: quantity,
      stock_quantity: quantity,
      is_available: quantity > 0,
      is_active: quantity > 0,
      last_stock_alert_at: quantity > 0 && quantity > threshold ? null : now,
    }

    if (quantity > previousQuantity) {
      updatePayload.last_restocked_at = now
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', productId)
      .eq('vendor_id', vendorId)
      .select('id, name, vendor_id, unit_type, price_per_unit, available_quantity, stock_quantity, stock_alert_threshold, waitlist_enabled, waitlist_count, is_available, is_active, updated_at')
      .single()

    if (updateError) throw updateError

    await insertStockHistory({
      productId,
      vendorId,
      oldQuantity: previousQuantity,
      newQuantity: quantity,
      reason,
      changedBy: vendorId,
      changeType,
    })

    if (shouldNotifyWaitlist({
      previousQuantity,
      nextQuantity: quantity,
      waitlistCount: product.waitlist_count,
    })) {
      await this.notifyWaitlistUsers({
        productId,
        productName: updatedProduct.name,
        availableQuantity: quantity,
      })
    }

    return normalizeInventoryItem(updatedProduct)
  },

  async bulkUpdateStock({ vendorId, updates = [], reason = 'تحديث جماعي للمخزون' }) {
    return Promise.all(
      updates.map((item) => this.updateProductStock({
        productId: item.productId,
        vendorId,
        nextQuantity: item.nextQuantity,
        reason,
        changeType: 'bulk_update',
      }))
    )
  },

  async getUserWaitlistEntry(productId, userId) {
    const { data, error } = await supabase
      .from('product_waitlists')
      .select('id, product_id, user_id, requested_quantity, status, created_at, notified_at')
      .eq('product_id', productId)
      .eq('user_id', userId)
      .in('status', [ACTIVE_WAITLIST_STATUS, 'notified'])
      .maybeSingle()

    if (error) throw error
    return data || null
  },

  async joinWaitlist({ productId, userId, requestedQuantity = 0, note = '', notifySms = false }) {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, is_available, available_quantity, waitlist_enabled')
      .eq('id', productId)
      .single()

    if (productError) throw productError

    const availableQuantity = Number(product.available_quantity ?? 0)
    if (product.waitlist_enabled === false) {
      throw new Error('قائمة الانتظار غير مفعلة لهذا المنتج')
    }

    if (product.is_available && availableQuantity > 0) {
      throw new Error('المنتج متوفر حالياً ولا يحتاج إلى قائمة انتظار')
    }

    const payload = {
      product_id: productId,
      user_id: userId,
      requested_quantity: Number(requestedQuantity || 0),
      note: note?.trim() || null,
      notify_in_app: true,
      notify_sms: Boolean(notifySms),
      status: ACTIVE_WAITLIST_STATUS,
      notified_at: null,
    }

    const { data, error } = await supabase
      .from('product_waitlists')
      .upsert(payload, { onConflict: 'product_id,user_id' })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async notifyWaitlistUsers({ productId, productName, availableQuantity }) {
    const entries = await fetchWaitlistEntries(productId)
    if (entries.length === 0) return 0

    await Promise.all(
      entries.map((entry) => sendRestockNotification({
        userId: entry.user_id,
        productId,
        productName,
        availableQuantity,
      }))
    )

    await markWaitlistEntriesNotified(entries.map((entry) => entry.id))
    return entries.length
  },
}

export default inventoryService