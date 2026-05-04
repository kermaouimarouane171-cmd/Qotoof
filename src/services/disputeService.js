import { supabase } from '@/services/supabase'
import { notificationsApi } from '@/services/notifications'
import trustScoreService from '@/services/trustScoreService'
import { logger } from '@/utils/logger'

const DISPUTE_BUCKET = 'dispute-evidence'
const DEFAULT_VENDOR_PENALTY = 20

const getAdmins = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  if (error) throw error
  return data || []
}

const notifyUsers = async (notifications) => {
  await Promise.all(
    notifications.map((notification) => notificationsApi.create(notification))
  )
}

const getDisputes = async () => {
  const { data, error } = await supabase
    .from('payment_disputes')
    .select(`
      *,
      order:orders(*),
      buyer:profiles!payment_disputes_buyer_id_fkey(first_name, last_name, email, phone, city, address),
      vendor:profiles!payment_disputes_vendor_id_fkey(store_name, first_name, last_name, email, phone),
      resolver:profiles!payment_disputes_resolved_by_fkey(first_name, last_name)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Failed to load payment disputes:', error)
    throw error
  }

  return data || []
}

const getDisputeById = async (disputeId) => {
  const { data, error } = await supabase
    .from('payment_disputes')
    .select(`
      *,
      order:orders(*),
      buyer:profiles!payment_disputes_buyer_id_fkey(first_name, last_name, email, phone, city, address),
      vendor:profiles!payment_disputes_vendor_id_fkey(store_name, first_name, last_name, email, phone),
      resolver:profiles!payment_disputes_resolved_by_fkey(first_name, last_name)
    `)
    .eq('id', disputeId)
    .single()

  if (error) {
    logger.error('Failed to load dispute by id:', error)
    throw error
  }

  return data
}

const uploadEvidenceFiles = async ({ disputeId, userId, files = [] }) => {
  if (!files.length) return []

  const uploadedPaths = []

  for (const file of files) {
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const storagePath = `${userId}/${disputeId}/${Date.now()}-${crypto.randomUUID()}.${fileExtension}`

    const { error } = await supabase.storage
      .from(DISPUTE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (error) {
      logger.error('Failed to upload dispute evidence:', error)
      throw error
    }

    uploadedPaths.push(storagePath)
  }

  return uploadedPaths
}

const createDispute = async ({
  orderId,
  vendorId,
  description,
  disputeType = 'not_paid',
  evidencePaths = [],
}) => {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, buyer_id, vendor_id, order_number, payment_disputed')
    .eq('id', orderId)
    .eq('vendor_id', vendorId)
    .single()

  if (orderError) {
    logger.error('Failed to validate order before dispute creation:', orderError)
    throw orderError
  }

  if (order.payment_disputed) {
    throw new Error('يوجد نزاع مفتوح بالفعل على هذا الطلب.')
  }

  const { data: dispute, error: disputeError } = await supabase
    .from('payment_disputes')
    .insert({
      order_id: orderId,
      vendor_id: vendorId,
      buyer_id: order.buyer_id,
      dispute_type: disputeType,
      description,
      evidence_urls: evidencePaths,
      status: 'open',
    })
    .select('*')
    .single()

  if (disputeError) {
    logger.error('Failed to create dispute:', disputeError)
    throw disputeError
  }

  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({
      payment_disputed: true,
      payment_dispute_opened_at: new Date().toISOString(),
      payment_dispute_reason: description,
    })
    .eq('id', orderId)

  if (orderUpdateError) {
    logger.error('Failed to update order dispute flags:', orderUpdateError)
    throw orderUpdateError
  }

  const admins = await getAdmins()
  await notifyUsers([
    {
      user_id: order.buyer_id,
      title: 'تم فتح نزاع دفع على طلبك',
      message: `قام البائع بفتح نزاع على الطلب #${order.order_number || order.id.slice(0, 8)}.`,
      type: 'payment_dispute',
      data: { dispute_id: dispute.id, order_id: order.id },
    },
    ...admins.map((admin) => ({
      user_id: admin.id,
      title: 'نزاع دفع جديد',
      message: `تم فتح نزاع جديد على الطلب #${order.order_number || order.id.slice(0, 8)} ويحتاج مراجعة.`,
      type: 'payment_dispute',
      data: { dispute_id: dispute.id, order_id: order.id },
    })),
  ])

  return dispute
}

const resolveInVendorFavor = async ({ disputeId, adminId, resolution, adminNotes, releaseBuyerData = true }) => {
  const dispute = await getDisputeById(disputeId)

  const { data: updatedDispute, error: disputeError } = await supabase
    .from('payment_disputes')
    .update({
      status: 'resolved_vendor',
      resolution,
      admin_notes: adminNotes,
      resolved_at: new Date().toISOString(),
      resolved_by: adminId,
      buyer_data_released: releaseBuyerData,
      legal_action_flag: releaseBuyerData,
    })
    .eq('id', disputeId)
    .select('*')
    .single()

  if (disputeError) {
    logger.error('Failed to resolve dispute in vendor favor:', disputeError)
    throw disputeError
  }

  const { error: orderError } = await supabase
    .from('orders')
    .update({
      payment_disputed: false,
    })
    .eq('id', dispute.order_id)

  if (orderError) {
    logger.error('Failed to clear dispute flag on order:', orderError)
    throw orderError
  }

  await trustScoreService.registerFailedPayment(dispute.order.buyer_id, {
    penalty: DEFAULT_VENDOR_PENALTY,
    restrictionDays: 45,
  })

  await notifyUsers([
    {
      user_id: dispute.vendor_id,
      title: 'تم حسم النزاع لصالحك',
      message: `تم قبول النزاع الخاص بالطلب #${dispute.order.order_number || dispute.order.id.slice(0, 8)} لصالحك.`,
      type: 'payment_dispute',
      data: { dispute_id: disputeId, order_id: dispute.order_id },
    },
    {
      user_id: dispute.buyer_id,
      title: 'تم حسم النزاع ضدك',
      message: `تم حسم النزاع الخاص بالطلب #${dispute.order.order_number || dispute.order.id.slice(0, 8)} ضدك وتم تطبيق أثر على درجة الثقة.`,
      type: 'payment_dispute',
      data: { dispute_id: disputeId, order_id: dispute.order_id },
    },
  ])

  return {
    dispute: updatedDispute,
    buyerData: releaseBuyerData ? dispute.buyer : null,
  }
}

const resolveInBuyerFavor = async ({ disputeId, adminId, resolution, adminNotes }) => {
  const dispute = await getDisputeById(disputeId)

  const { data: updatedDispute, error: disputeError } = await supabase
    .from('payment_disputes')
    .update({
      status: 'resolved_buyer',
      resolution,
      admin_notes: adminNotes,
      resolved_at: new Date().toISOString(),
      resolved_by: adminId,
      buyer_data_released: false,
      legal_action_flag: false,
    })
    .eq('id', disputeId)
    .select('*')
    .single()

  if (disputeError) {
    logger.error('Failed to resolve dispute in buyer favor:', disputeError)
    throw disputeError
  }

  const { error: orderError } = await supabase
    .from('orders')
    .update({
      payment_disputed: false,
    })
    .eq('id', dispute.order_id)

  if (orderError) {
    logger.error('Failed to clear dispute flag on order:', orderError)
    throw orderError
  }

  await trustScoreService.updateTrustScore(dispute.buyer_id, 5)
  await trustScoreService.syncCodEligibility(dispute.buyer_id)

  await notifyUsers([
    {
      user_id: dispute.buyer_id,
      title: 'تم حسم النزاع لصالحك',
      message: `تم إثبات صحة موقفك في النزاع الخاص بالطلب #${dispute.order.order_number || dispute.order.id.slice(0, 8)}.`,
      type: 'payment_dispute',
      data: { dispute_id: disputeId, order_id: dispute.order_id },
    },
    {
      user_id: dispute.vendor_id,
      title: 'تم رفض النزاع',
      message: `تم رفض النزاع الخاص بالطلب #${dispute.order.order_number || dispute.order.id.slice(0, 8)} بعد المراجعة الإدارية.`,
      type: 'payment_dispute',
      data: { dispute_id: disputeId, order_id: dispute.order_id },
    },
  ])

  return updatedDispute
}

export const openDispute = async (orderId, vendorId, reason, files = []) => {
  const dispute = await createDispute({
    orderId,
    vendorId,
    description: reason,
    disputeType: 'not_paid',
    evidencePaths: [],
  })

  if (files.length > 0) {
    const uploadedPaths = await uploadEvidenceFiles({
      disputeId: dispute.id,
      userId: vendorId,
      files,
    })

    if (uploadedPaths.length > 0) {
      const { data: updatedDispute, error } = await supabase
        .from('payment_disputes')
        .update({ evidence_urls: uploadedPaths })
        .eq('id', dispute.id)
        .select('*')
        .single()

      if (error) throw error
      return updatedDispute
    }
  }

  return dispute
}

export const releaseBuyerDataToVendor = async (disputeId, adminId) => {
  return resolveInVendorFavor({
    disputeId,
    adminId,
    resolution: 'release_buyer_data',
    adminNotes: 'تم الإفراج عن بيانات المشتري بناءً على قرار الإدارة.',
    releaseBuyerData: true,
  })
}

export const applyDisputePenalty = async (buyerId, resolution = {}) => {
  const penalty = Number(resolution?.penalty ?? DEFAULT_VENDOR_PENALTY)
  const restrictionDays = Number(resolution?.restrictionDays ?? 45)

  return trustScoreService.registerFailedPayment(buyerId, {
    penalty,
    restrictionDays,
  })
}

const disputeService = {
  applyDisputePenalty,
  createDispute,
  getDisputeById,
  getDisputes,
  openDispute,
  releaseBuyerDataToVendor,
  resolveInBuyerFavor,
  resolveInVendorFavor,
  uploadEvidenceFiles,
}

export default disputeService