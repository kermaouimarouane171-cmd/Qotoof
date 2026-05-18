/**
 * Payment constants for Qotoof marketplace.
 * Centralizes all payment-related constants:
 * - Payment methods (active methods plus historical aliases)
 * - Payment statuses
 * - Status colors (Tailwind + hex)
 *
 * @module constants/payment
 */

import { getPayPalClientId } from '@/lib/config'

// ============================================================
// PAYMENT METHODS
// ============================================================

/**
 * Available payment method identifiers.
 */
export const PAYMENT_METHOD = {
  CASH: 'cod',
  BANK_TRANSFER: 'bank',
  PAYPAL: 'paypal',
  CMI: 'cmi',
}

/**
 * Full configuration for each payment method.
 * Used to render method selectors in checkout UI.
 */
export const PAYMENT_METHODS = [
  {
    id: PAYMENT_METHOD.CASH,
    label: 'الدفع عند الاستلام',
    labelFr: 'Paiement à la livraison',
    labelEn: 'Cash on Delivery',
    icon: '💵',
    available: true,
    requiresRedirect: false,
    descriptionAr: 'ادفع نقداً عند استلام طلبك',
  },
  {
    id: PAYMENT_METHOD.BANK_TRANSFER,
    label: 'تحويل بنكي',
    labelFr: 'Virement bancaire',
    labelEn: 'Moroccan Bank Transfer',
    icon: '🏦',
    available: true,
    requiresRedirect: false,
    descriptionAr: 'حوّل المبلغ إلى حساب بنكي مغربي معتمد',
  },
  {
    id: PAYMENT_METHOD.PAYPAL,
    label: 'PayPal',
    labelFr: 'PayPal',
    labelEn: 'PayPal',
    icon: '🅿️',
    get available() {
      return Boolean(getPayPalClientId() || import.meta.env.VITE_PAYPAL_CLIENT_ID)
    },
    requiresRedirect: true,
    descriptionAr: 'ادفع عبر بوابة PayPal الآمنة',
  },
  {
    id: PAYMENT_METHOD.CMI,
    label: 'CMI (المغرب)',
    labelFr: 'CMI (Maroc)',
    labelEn: 'CMI (Morocco)',
    icon: '🇲🇦',
    available: false,
    requiresRedirect: true,
    descriptionAr: 'بوابة قديمة محتفظ بها فقط من أجل السجلات التاريخية',
  },
]

// ============================================================
// PAYMENT STATUS
// ============================================================

/**
 * Payment status string values stored in the database.
 */
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  AWAITING_TRANSFER: 'awaiting_transfer',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled',
}

// ============================================================
// STATUS COLORS
// ============================================================

/**
 * Tailwind CSS badge classes for each payment status.
 * Used in order/payment list views.
 */
export const PAYMENT_STATUS_BADGE = {
  [PAYMENT_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  [PAYMENT_STATUS.PROCESSING]: 'bg-blue-100 text-blue-800 border border-blue-200',
  [PAYMENT_STATUS.AWAITING_TRANSFER]: 'bg-orange-100 text-orange-800 border border-orange-200',
  [PAYMENT_STATUS.COMPLETED]: 'bg-green-100 text-green-800 border border-green-200',
  [PAYMENT_STATUS.FAILED]: 'bg-red-100 text-red-800 border border-red-200',
  [PAYMENT_STATUS.REFUNDED]: 'bg-purple-100 text-purple-800 border border-purple-200',
  [PAYMENT_STATUS.CANCELLED]: 'bg-gray-100 text-gray-800 border border-gray-200',
}

/**
 * Hex colors for payment status indicators (charts, badges).
 */
export const PAYMENT_STATUS_HEX = {
  [PAYMENT_STATUS.PENDING]: '#F59E0B',
  [PAYMENT_STATUS.PROCESSING]: '#3B82F6',
  [PAYMENT_STATUS.AWAITING_TRANSFER]: '#F97316',
  [PAYMENT_STATUS.COMPLETED]: '#10B981',
  [PAYMENT_STATUS.FAILED]: '#EF4444',
  [PAYMENT_STATUS.REFUNDED]: '#8B5CF6',
  [PAYMENT_STATUS.CANCELLED]: '#6B7280',
}

/**
 * Human-readable labels for each payment status (Arabic).
 */
export const PAYMENT_STATUS_LABEL_AR = {
  [PAYMENT_STATUS.PENDING]: 'في الانتظار',
  [PAYMENT_STATUS.PROCESSING]: 'قيد المعالجة',
  [PAYMENT_STATUS.AWAITING_TRANSFER]: 'ينتظر التحويل',
  [PAYMENT_STATUS.COMPLETED]: 'مكتمل',
  [PAYMENT_STATUS.FAILED]: 'فشل',
  [PAYMENT_STATUS.REFUNDED]: 'مُسترجع',
  [PAYMENT_STATUS.CANCELLED]: 'ملغى',
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Get available payment methods based on env configuration.
 * @returns {Array} Array of available payment method configs
 */
export const getAvailablePaymentMethods = () =>
  PAYMENT_METHODS.filter((m) => m.available)

/**
 * Get payment method config by id.
 * @param {string} id - Method id (e.g. 'cod', 'cmi')
 * @returns {Object|undefined}
 */
export const getPaymentMethodById = (id) =>
  PAYMENT_METHODS.find((m) => m.id === id)

/**
 * Get Tailwind badge class for a payment status.
 * Falls back to gray if status is unknown.
 * @param {string} status
 * @returns {string}
 */
export const getPaymentStatusBadge = (status) =>
  PAYMENT_STATUS_BADGE[status] ?? PAYMENT_STATUS_BADGE[PAYMENT_STATUS.CANCELLED]

/**
 * Get hex color for a payment status.
 * @param {string} status
 * @returns {string}
 */
export const getPaymentStatusColor = (status) =>
  PAYMENT_STATUS_HEX[status] ?? PAYMENT_STATUS_HEX[PAYMENT_STATUS.CANCELLED]
