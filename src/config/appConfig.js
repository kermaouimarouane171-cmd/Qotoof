const supportPhone = import.meta.env.VITE_SUPPORT_PHONE || '+212674841248'

const formatDisplayPhone = (phone) => {
  if (phone === '+212674841248') return '+212 674 841 248'
  return phone
}

export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || 'Qotoof',
  domain: 'qotoof.ma',
  siteUrl: import.meta.env.VITE_APP_URL || 'https://qotoof.ma',
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || 'support@qotoof.ma',
  supportPhone,
  supportPhoneDisplay: formatDisplayPhone(supportPhone),
  supportWhatsapp: supportPhone,
  supportWhatsappDisplay: formatDisplayPhone(supportPhone),
  commissionRate: Number(import.meta.env.VITE_COMMISSION_RATE || 0.03),
  taxRate: Number(import.meta.env.VITE_TAX_RATE ?? 0),
  deliveryBaseFee: Number(import.meta.env.VITE_DELIVERY_BASE_FEE || 10),
  deliveryPerKmFee: Number(import.meta.env.VITE_DELIVERY_PER_KM_FEE || 5),
  headquarters: 'Casablanca, Morocco',
}

export const getWhatsappUrl = (message = '') => {
  const url = `https://wa.me/${APP_CONFIG.supportWhatsapp.replace(/\D/g, '')}`
  if (!message) return url
  return `${url}?text=${encodeURIComponent(message)}`
}