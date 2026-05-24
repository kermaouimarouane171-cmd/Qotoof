/**
 * @domain payments
 * @side-effects Writes to `payments` table and invokes Edge Functions
 * @auth-required true
 * @edge-function confirm-order-payment, register-payment-receipt, confirm-bank-transfer
 */

export {
  confirmOrderPayment,
  registerPaymentReceipt,
  confirmBankTransfer,
} from '@/services/paymentService';
