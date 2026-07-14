export const DELIVERY_STATUS_COLORS = {
  assigned:   'bg-yellow-100 text-yellow-700',
  accepted:   'bg-green-100 text-green-700',
  picked_up:  'bg-purple-100 text-purple-700',
  on_the_way: 'bg-blue-100 text-blue-700',
  delivered:  'bg-gray-100 text-gray-700',
  completed:  'bg-gray-100 text-gray-700',
  cancelled:  'bg-red-100 text-red-700',
}

export const DELIVERY_STATUS_LABEL_KEYS = {
  assigned:   'driver.status.assigned',
  accepted:   'driver.status.accepted',
  picked_up:  'driver.status.pickedUp',
  on_the_way: 'driver.status.onTheWay',
  delivered:  'driver.status.delivered',
  completed:  'driver.status.completed',
  cancelled:  'driver.status.cancelled',
}

export const DELIVERY_STATUS_DEFAULT_LABELS = {
  assigned:   'Assigned',
  accepted:   'Accepted',
  picked_up:  'Picked Up',
  on_the_way: 'On the Way',
  delivered:  'Delivered',
  completed:  'Completed',
  cancelled:  'Cancelled',
}

export const ACTIVE_DELIVERY_STATUSES = ['assigned', 'accepted', 'picked_up', 'on_the_way']
export const COMPLETED_DELIVERY_STATUSES = ['delivered', 'completed']
