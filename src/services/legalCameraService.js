import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

export const PRODUCT_CONDITION_STAGE_ORDER = [
  'vendor_release',
  'driver_loading',
  'driver_dropoff',
  'buyer_receipt',
]

export const PRODUCT_CONDITION_STAGES = {
  vendor_release: {
    label: 'تسليم البائع للسائق',
    description: 'صورة قانونية عند خروج السلعة من عهدة البائع.',
    allowedRoles: ['vendor', 'admin'],
  },
  driver_loading: {
    label: 'تحميل السائق للبضاعة',
    description: 'صورة قانونية بعد وضع الحمولة في وسيلة النقل.',
    allowedRoles: ['driver', 'admin'],
  },
  driver_dropoff: {
    label: 'قبل تسليم السائق للمشتري',
    description: 'صورة قانونية للحالة النهائية قبل التسليم.',
    allowedRoles: ['driver', 'admin'],
  },
  buyer_receipt: {
    label: 'استلام المشتري',
    description: 'صورة قانونية بعد تأكيد المشتري الاستلام.',
    allowedRoles: ['buyer', 'admin'],
  },
}

export const PRODUCT_CONDITION_ROLE_LABELS = {
  vendor: 'البائع',
  driver: 'السائق',
  buyer: 'المشتري',
  admin: 'الإدارة',
}

const PRODUCT_CONDITION_BUCKET = 'product-conditions'

const formatTimestamp = (value) => {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleString('ar-MA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const safeText = (value, fallback = '-') => String(value || fallback).trim()

const createCanvasBlob = (canvas, type = 'image/jpeg', quality = 0.92) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('تعذر إنشاء ملف الصورة القانونية.'))
      return
    }

    resolve(blob)
  }, type, quality)
})

const buildStoragePath = ({ userId, orderId, captureStage }) => {
  const timestamp = Date.now()
  return `${userId}/${orderId}/${captureStage}_${timestamp}.jpg`
}

export const getProductConditionStageLabel = (captureStage) => {
  return PRODUCT_CONDITION_STAGES[captureStage]?.label || captureStage
}

export const buildLegalWatermarkText = ({
  orderNumber,
  captureStage,
  actorRole,
  capturedAt,
  latitude,
  longitude,
  address,
}) => {
  return [
    `قطوف | ${safeText(orderNumber, 'بدون رقم طلب')}`,
    `${getProductConditionStageLabel(captureStage)} | ${safeText(PRODUCT_CONDITION_ROLE_LABELS[actorRole], actorRole)}`,
    `التاريخ: ${formatTimestamp(capturedAt)}`,
    `GPS: ${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`,
    safeText(address, 'الموقع قيد التحديد'),
  ]
}

export const getCurrentGeoPosition = async () => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('المتصفح الحالي لا يدعم تحديد الموقع الجغرافي.')
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
        })
      },
      () => reject(new Error('يجب تفعيل تحديد الموقع لالتقاط الصورة القانونية.')),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    )
  })
}

export const reverseGeocodePosition = async ({ latitude, longitude }) => {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', latitude)
    url.searchParams.set('lon', longitude)
    url.searchParams.set('accept-language', 'ar')

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed with status ${response.status}`)
    }

    const payload = await response.json()
    return payload?.display_name || ''
  } catch (error) {
    logger.warn('Failed to reverse geocode product condition capture:', error)
    return ''
  }
}

export const renderWatermarkedCapture = async ({ videoElement, watermarkLines = [] }) => {
  const videoWidth = videoElement?.videoWidth || 1280
  const videoHeight = videoElement?.videoHeight || 720
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  canvas.width = videoWidth
  canvas.height = videoHeight

  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height)

  const fontSize = Math.max(20, Math.round(canvas.width * 0.018))
  const lineHeight = fontSize + 8
  const overlayHeight = Math.max(140, watermarkLines.length * lineHeight + 28)

  context.fillStyle = 'rgba(0, 0, 0, 0.68)'
  context.fillRect(0, canvas.height - overlayHeight, canvas.width, overlayHeight)

  context.fillStyle = '#ffffff'
  context.font = `600 ${fontSize}px sans-serif`
  context.textBaseline = 'top'

  watermarkLines.forEach((line, index) => {
    context.fillText(line, 24, canvas.height - overlayHeight + 18 + index * lineHeight)
  })

  return createCanvasBlob(canvas)
}

const createSignedStorageUrl = async (storagePath) => {
  if (!storagePath) return ''

  const { data, error } = await supabase.storage
    .from(PRODUCT_CONDITION_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  if (error) {
    logger.warn('Failed to create signed product condition URL:', error)
    return ''
  }

  return data?.signedUrl || ''
}

export const getOrderConditionPhotos = async (orderId) => {
  if (!orderId) return []

  const { data, error } = await supabase
    .from('product_condition_photos')
    .select('*')
    .eq('order_id', orderId)
    .order('captured_at', { ascending: false })

  if (error) {
    logger.error('Failed to load product condition photos:', error)
    throw error
  }

  const signedRows = await Promise.all((data || []).map(async (row) => ({
    ...row,
    signed_url: await createSignedStorageUrl(row.storage_path),
  })))

  return signedRows
}

export const getConditionStageSummary = (photos = []) => {
  return PRODUCT_CONDITION_STAGE_ORDER.reduce((summary, stage) => {
    const stagePhotos = photos.filter((photo) => photo.capture_stage === stage)
    summary[stage] = {
      exists: stagePhotos.length > 0,
      count: stagePhotos.length,
      latest: stagePhotos[0] || null,
    }
    return summary
  }, {})
}

export const hasStageCapture = async ({ orderId, deliveryId = null, captureStage }) => {
  if (!orderId || !captureStage) return false

  let query = supabase
    .from('product_condition_photos')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('capture_stage', captureStage)

  if (deliveryId) {
    query = query.eq('delivery_id', deliveryId)
  }

  const { count, error } = await query
  if (error) {
    logger.error('Failed to verify product condition stage:', error)
    throw error
  }

  return Number(count || 0) > 0
}

export const saveProductConditionCapture = async ({
  orderId,
  deliveryId = null,
  vendorId = null,
  driverId = null,
  buyerId = null,
  capturedBy,
  actorRole,
  captureStage,
  blob,
  capturedAt,
  latitude,
  longitude,
  address,
  watermarkText,
  notes,
  metadata = {},
}) => {
  if (!orderId || !capturedBy || !actorRole || !captureStage || !blob) {
    throw new Error('بيانات الصورة القانونية غير مكتملة.')
  }

  const storagePath = buildStoragePath({
    userId: capturedBy,
    orderId,
    captureStage,
  })

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_CONDITION_BUCKET)
    .upload(storagePath, blob, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    logger.error('Failed to upload product condition capture:', uploadError)
    throw uploadError
  }

  const insertPayload = {
    order_id: orderId,
    delivery_id: deliveryId,
    vendor_id: vendorId,
    driver_id: driverId,
    buyer_id: buyerId,
    captured_by: capturedBy,
    actor_role: actorRole,
    capture_stage: captureStage,
    storage_path: storagePath,
    gps_latitude: latitude,
    gps_longitude: longitude,
    captured_address: address || null,
    watermark_text: Array.isArray(watermarkText) ? watermarkText.join(' | ') : watermarkText,
    notes: notes || null,
    metadata,
    captured_at: capturedAt || new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('product_condition_photos')
    .insert(insertPayload)
    .select('*')
    .single()

  if (error) {
    logger.error('Failed to insert product condition photo row:', error)
    throw error
  }

  return {
    ...data,
    signed_url: await createSignedStorageUrl(storagePath),
  }
}

export const drawWatermark = (ctx, canvas, data = {}) => {
  const watermarkLines = buildLegalWatermarkText({
    orderNumber: data.orderNumber || data.orderId,
    captureStage: data.stage || data.captureStage,
    actorRole: data.userRole || data.actorRole,
    capturedAt: data.capturedAt || new Date().toISOString(),
    latitude: data.latitude,
    longitude: data.longitude,
    address: data.address,
  })

  const fontSize = Math.max(20, Math.round(canvas.width * 0.018))
  const lineHeight = fontSize + 8
  const overlayHeight = Math.max(140, watermarkLines.length * lineHeight + 28)

  ctx.fillStyle = 'rgba(0, 0, 0, 0.68)'
  ctx.fillRect(0, canvas.height - overlayHeight, canvas.width, overlayHeight)

  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${fontSize}px sans-serif`
  ctx.textBaseline = 'top'

  watermarkLines.forEach((line, index) => {
    ctx.fillText(line, 24, canvas.height - overlayHeight + 18 + index * lineHeight)
  })

  return watermarkLines
}

export const captureLegalPhoto = async ({
  userId,
  userName,
  userRole,
  orderId,
  stage,
  videoElement,
  deliveryId = null,
  vendorId = null,
  driverId = null,
  buyerId = null,
  notes = '',
}) => {
  if (!videoElement) {
    throw new Error('videoElement مطلوب لالتقاط الصورة القانونية.')
  }

  const geo = await getCurrentGeoPosition()
  const capturedAt = new Date().toISOString()
  const address = await reverseGeocodePosition(geo)
  const watermarkLines = buildLegalWatermarkText({
    orderNumber: orderId,
    captureStage: stage,
    actorRole: userRole,
    capturedAt,
    latitude: geo.latitude,
    longitude: geo.longitude,
    address,
  })

  const blob = await renderWatermarkedCapture({
    videoElement,
    watermarkLines,
  })

  return saveProductConditionCapture({
    orderId,
    deliveryId,
    vendorId,
    driverId,
    buyerId,
    capturedBy: userId,
    actorRole: userRole,
    captureStage: stage,
    blob,
    capturedAt,
    latitude: geo.latitude,
    longitude: geo.longitude,
    address,
    watermarkText: watermarkLines,
    notes: notes || (userName ? `Captured by ${userName}` : ''),
    metadata: {
      user_name: userName || null,
    },
  })
}
