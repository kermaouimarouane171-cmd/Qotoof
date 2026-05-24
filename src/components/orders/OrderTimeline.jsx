import { ShoppingBagIcon, CheckCircleIcon, ClockIcon, TruckIcon } from '@heroicons/react/24/outline'
import OrderProgressTimeline from '@/components/orders/OrderProgressTimeline'

const STATUS_STEP_INDEX = {
  pending: 0,
  confirmed: 1,
  payment_received: 3,
  preparing: 2,
  shipped: 3,
  on_the_way: 3,
  delivered: 4,
  cancelled: -1,
  vendor_accepted: 1,
  vendor_rejected: -1,
  driver_assigned: 2,
  driver_accepted: 2,
  driver_picked_up: 3,
  awaiting_driver: 2,
}

const TIMELINE_STEPS = [
  { key: 'pending', label: 'orderDetail.timeline.orderPlaced', labelDefault: 'Order Placed', icon: ShoppingBagIcon },
  { key: 'confirmed', label: 'orderDetail.timeline.confirmed', labelDefault: 'Confirmed', icon: CheckCircleIcon },
  { key: 'preparing', label: 'orderDetail.timeline.preparing', labelDefault: 'Preparing', icon: ClockIcon },
  { key: 'shipped', label: 'orderDetail.timeline.shipped', labelDefault: 'On the Way', icon: TruckIcon },
  { key: 'delivered', label: 'orderDetail.timeline.delivered', labelDefault: 'Delivered', icon: CheckCircleIcon },
]

/**
 * Presentational order timeline wrapper.
 *
 * @param {{
 *   statusHistory: Array<{ status: string, created_at: string }>;
 *   currentStatus: string;
 *   driver?: Object | null;
 * }} props
 */
const OrderTimeline = ({ statusHistory = [], currentStatus, driver = null }) => {
  const currentStepIndex = STATUS_STEP_INDEX[currentStatus] ?? 0
  const isCancelled = currentStatus === 'cancelled' || currentStatus === 'vendor_rejected'

  return (
    <OrderProgressTimeline
      steps={TIMELINE_STEPS}
      currentStepIndex={currentStepIndex}
      isCancelled={isCancelled}
      timeline={statusHistory}
      driver={driver}
    />
  )
}

export default OrderTimeline
