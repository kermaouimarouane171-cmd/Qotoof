/**
 * خدمة CMI Payment الخاصة بـ Qotoof Marketplace.
 * توفر تهيئة الدفع، التحقق من callback، واستعلام حالة الدفع.
 */

import { supabase } from '@/services/supabase'

const CMI_MERCHANT_ID = import.meta.env.VITE_CMI_MERCHANT_ID
const CMI_SECRET_KEY = import.meta.env.VITE_CMI_SECRET_KEY
const CMI_GATEWAY_URL = import.meta.env.VITE_CMI_GATEWAY_URL || 'https://paiement.cmi.co.ma/fim/est3Dgate'
const CMI_STATUS_ENDPOINT = import.meta.env.VITE_CMI_STATUS_ENDPOINT || ''

/**
 * تحويل النص إلى hex string.
 */
const toHex = (buffer) => {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * إنشاء HMAC-SHA256 باستخدام Web Crypto API.
 */
const hmacSha256 = async (message, secretKey) => {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secretKey)
  const messageData = encoder.encode(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  return toHex(signature)
}

/**
 * دالة initCMIPayment(order)
 * تبني payload جاهز للإرسال إلى CMI.
 */
export const initCMIPayment = async (order) => {
  if (!CMI_MERCHANT_ID || !CMI_SECRET_KEY) {
    throw new Error('بيانات CMI غير مكتملة: تحقق من VITE_CMI_MERCHANT_ID و VITE_CMI_SECRET_KEY')
  }

  if (!order?.id || !order?.total) {
    throw new Error('بيانات الطلب غير كافية لتهيئة CMI')
  }

  const amount = Number(order.total).toFixed(2)
  const currency = order.currency || 'MAD'
  const orderId = String(order.id)
  const timestamp = new Date().toISOString()

  // صيغة hash المعتمدة داخليا: merchant|order|amount|currency|timestamp
  const hashSource = `${CMI_MERCHANT_ID}|${orderId}|${amount}|${currency}|${timestamp}`
  const hash = await hmacSha256(hashSource, CMI_SECRET_KEY)

  const payload = {
    merchantId: CMI_MERCHANT_ID,
    orderId,
    amount,
    currency,
    customerEmail: order.customer_email || order.customerEmail || '',
    customerPhone: order.shipping_phone || order.customerPhone || '',
    returnUrl: `${window.location.origin}/checkout/cmi/return`,
    cancelUrl: `${window.location.origin}/checkout/cmi/cancel`,
    notifyUrl: `${window.location.origin}/api/cmi/callback`,
    timestamp,
    hash,
  }

  return {
    gatewayUrl: CMI_GATEWAY_URL,
    payload,
  }
}

/**
 * دالة verifyCMICallback(data, secretKey)
 * تتحقق من hash القادم من callback.
 */
export const verifyCMICallback = async (data, secretKey = CMI_SECRET_KEY) => {
  if (!secretKey) {
    throw new Error('لا يمكن التحقق من CMI callback بدون secret key')
  }

  const callbackHash = (data?.hash || '').toLowerCase()
  if (!callbackHash) {
    return { valid: false, reason: 'hash غير موجود في callback' }
  }

  const normalizedAmount = Number(data?.amount || 0).toFixed(2)
  const hashSource = `${data?.merchantId || ''}|${data?.orderId || ''}|${normalizedAmount}|${data?.currency || 'MAD'}|${data?.timestamp || ''}`
  const expectedHash = (await hmacSha256(hashSource, secretKey)).toLowerCase()

  return {
    valid: expectedHash === callbackHash,
    expectedHash,
    receivedHash: callbackHash,
  }
}

/**
 * دالة getCMIStatus(orderId)
 * تستعلم حالة الدفع من endpoint خارجي إن توفر، أو من جدول payments كـ fallback.
 */
export const getCMIStatus = async (orderId) => {
  if (!orderId) {
    throw new Error('orderId مطلوب لاستعلام حالة CMI')
  }

  // المسار المفضل: endpoint خارجي من الـ backend
  if (CMI_STATUS_ENDPOINT) {
    const url = `${CMI_STATUS_ENDPOINT}?orderId=${encodeURIComponent(orderId)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-CMI-Merchant': CMI_MERCHANT_ID || '',
      },
    })

    if (!response.ok) {
      throw new Error(`فشل استعلام CMI عبر API: ${response.status}`)
    }

    const data = await response.json()
    return data
  }

  // fallback: قراءة آخر حالة دفع من Supabase
  const { data, error } = await supabase
    .from('payments')
    .select('id, order_id, status, method, transaction_id, updated_at')
    .eq('order_id', orderId)
    .eq('method', 'cmi')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`فشل استعلام حالة الدفع من قاعدة البيانات: ${error.message}`)
  }

  return data || {
    order_id: orderId,
    status: 'unknown',
    message: 'لا توجد معاملة CMI مسجلة لهذا الطلب بعد',
  }
}

// TODO (CMI Morocco onboarding):
// 1) فتح حساب تاجر لدى البنك المغربي الشريك مع CMI.
// 2) طلب Merchant ID و Secret Key وبيئة Sandbox من CMI.
// 3) تفعيل returnUrl/cancelUrl/notifyUrl على نفس الدومين الإنتاجي.
// 4) اختبار سيناريوهات: نجاح، فشل، إلغاء، timeout في Sandbox.
// 5) تفعيل Production credentials بعد اعتماد اختبارات UAT.
// 6) تفعيل webhook endpoint آمن في backend والتحقق من hash على السيرفر.
