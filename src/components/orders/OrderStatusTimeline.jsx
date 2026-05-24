import OrderTimeline from '@/components/orders/OrderTimeline'

/**
 * Extracted OrderDetail timeline section.
 */
export default function OrderStatusTimeline({ statusHistory = [], currentStatus, t }) {
  void t

  return (
    <OrderTimeline
      statusHistory={statusHistory}
      currentStatus={currentStatus}
    />
  )
}
