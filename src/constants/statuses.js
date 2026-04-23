/**
 * Shared status configurations for orders, products, deliveries, etc.
 * Centralizes duplicated status configs from:
 * - pages/OrderDetail.jsx
 * - pages/Orders.jsx
 * - pages/vendor/Dashboard.jsx
 * - pages/admin/Orders.jsx
 * - pages/buyer/Orders.jsx
 * - pages/Tracking.jsx
 */

import {
  ShoppingBagIcon,
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  XMarkIcon,
  UserIcon,
} from '@heroicons/react/24/outline'

// ============================================================
// ORDER STATUS CONFIGURATION (Full - for OrderDetail, Tracking)
// ============================================================
export const ORDER_STATUS_CONFIG = {
  pending: {
    label: 'orderDetail.status.pending',
    labelDefault: 'Order Placed',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    dotColor: 'bg-yellow-500',
    icon: ShoppingBagIcon,
    stepIndex: 0,
  },
  confirmed: {
    label: 'orderDetail.status.confirmed',
    labelDefault: 'Confirmed',
    color: 'bg-blue-100 text-blue-800 border border-blue-200',
    dotColor: 'bg-blue-500',
    icon: CheckCircleIcon,
    stepIndex: 1,
  },
  preparing: {
    label: 'orderDetail.status.preparing',
    labelDefault: 'Preparing',
    color: 'bg-purple-100 text-purple-800 border border-purple-200',
    dotColor: 'bg-purple-500',
    icon: ClockIcon,
    stepIndex: 2,
  },
  shipped: {
    label: 'orderDetail.status.shipped',
    labelDefault: 'On the Way',
    color: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    dotColor: 'bg-indigo-500',
    icon: TruckIcon,
    stepIndex: 3,
  },
  on_the_way: {
    label: 'orderDetail.status.shipped',
    labelDefault: 'On the Way',
    color: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    dotColor: 'bg-indigo-500',
    icon: TruckIcon,
    stepIndex: 3,
  },
  delivered: {
    label: 'orderDetail.status.delivered',
    labelDefault: 'Delivered',
    color: 'bg-green-100 text-green-800 border border-green-200',
    dotColor: 'bg-green-500',
    icon: CheckCircleIcon,
    stepIndex: 4,
  },
  cancelled: {
    label: 'orderDetail.status.cancelled',
    labelDefault: 'Cancelled',
    color: 'bg-red-100 text-red-800 border border-red-200',
    dotColor: 'bg-red-500',
    icon: XMarkIcon,
    stepIndex: -1,
  },
  vendor_accepted: {
    label: 'orderDetail.status.vendor_accepted',
    labelDefault: 'Vendor Accepted',
    color: 'bg-blue-100 text-blue-800 border border-blue-200',
    dotColor: 'bg-blue-500',
    icon: CheckCircleIcon,
    stepIndex: 1,
  },
  vendor_rejected: {
    label: 'orderDetail.status.vendor_rejected',
    labelDefault: 'Vendor Rejected',
    color: 'bg-red-100 text-red-800 border border-red-200',
    dotColor: 'bg-red-500',
    icon: XMarkIcon,
    stepIndex: -1,
  },
  driver_assigned: {
    label: 'orderDetail.status.driver_assigned',
    labelDefault: 'Driver Assigned',
    color: 'bg-purple-100 text-purple-800 border border-purple-200',
    dotColor: 'bg-purple-500',
    icon: UserIcon,
    stepIndex: 2,
  },
  driver_accepted: {
    label: 'orderDetail.status.driver_accepted',
    labelDefault: 'Driver Accepted',
    color: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    dotColor: 'bg-indigo-500',
    icon: CheckCircleIcon,
    stepIndex: 3,
  },
  driver_picked_up: {
    label: 'orderDetail.status.driver_picked_up',
    labelDefault: 'Picked Up',
    color: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    dotColor: 'bg-indigo-500',
    icon: TruckIcon,
    stepIndex: 3,
  },
  awaiting_driver: {
    label: 'orderDetail.status.awaiting_driver',
    labelDefault: 'Awaiting Driver',
    color: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    dotColor: 'bg-yellow-500',
    icon: ClockIcon,
    stepIndex: 2,
  },
}

// ============================================================
// ORDER STATUS CONFIGURATION (Simple - for order lists)
// ============================================================
export const ORDER_STATUS_SIMPLE = {
  pending: { label: 'Order Placed', color: 'badge-warning', icon: ClockIcon },
  confirmed: { label: 'Confirmed', color: 'badge-info', icon: CheckCircleIcon },
  preparing: { label: 'Preparing', color: 'badge-indigo', icon: ClockIcon },
  shipped: { label: 'On the Way', color: 'badge-info', icon: TruckIcon },
  on_the_way: { label: 'On the Way', color: 'badge-info', icon: TruckIcon },
  delivered: { label: 'Delivered', color: 'badge-success', icon: CheckCircleIcon },
  cancelled: { label: 'Cancelled', color: 'badge-danger', icon: XMarkIcon },
  vendor_accepted: { label: 'Accepted', color: 'badge-info', icon: CheckCircleIcon },
  vendor_rejected: { label: 'Rejected', color: 'badge-danger', icon: XMarkIcon },
  driver_assigned: { label: 'Driver Assigned', color: 'badge-indigo', icon: TruckIcon },
  driver_accepted: { label: 'Driver Accepted', color: 'badge-indigo', icon: CheckCircleIcon },
  driver_picked_up: { label: 'Picked Up', color: 'badge-info', icon: TruckIcon },
  awaiting_driver: { label: 'Awaiting Driver', color: 'badge-warning', icon: ClockIcon },
}

// ============================================================
// ORDER STATUS FLOW (valid transitions)
// ============================================================
export const ORDER_STATUS_FLOW = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'on_the_way', 'cancelled'],
  shipped: ['on_the_way', 'delivered'],
  on_the_way: ['delivered'],
  delivered: [],
  cancelled: [],
  vendor_accepted: ['driver_assigned', 'cancelled'],
  vendor_rejected: [],
  driver_assigned: ['driver_accepted', 'cancelled'],
  driver_accepted: ['driver_picked_up'],
  driver_picked_up: ['delivered'],
  awaiting_driver: ['driver_assigned'],
}

// ============================================================
// PRODUCT APPROVAL STATUS
// ============================================================
export const PRODUCT_APPROVAL_STATUS = {
  pending: {
    label: 'admin.products.statuses.pending',
    labelDefault: 'Pending Review',
    color: 'bg-yellow-100 text-yellow-800',
  },
  approved: {
    label: 'admin.products.statuses.approved',
    labelDefault: 'Approved',
    color: 'bg-green-100 text-green-800',
  },
  rejected: {
    label: 'admin.products.statuses.rejected',
    labelDefault: 'Rejected',
    color: 'bg-red-100 text-red-800',
  },
  suspended: {
    label: 'admin.products.statuses.suspended',
    labelDefault: 'Suspended',
    color: 'bg-gray-100 text-gray-800',
  },
}

// ============================================================
// DELIVERY STATUS
// ============================================================
export const DELIVERY_STATUS = {
  pending: {
    label: 'Pending',
    labelDefault: 'Pending',
    color: 'bg-yellow-100 text-yellow-800',
  },
  in_transit: {
    label: 'In Transit',
    labelDefault: 'In Transit',
    color: 'bg-blue-100 text-blue-800',
  },
  delivered: {
    label: 'Delivered',
    labelDefault: 'Delivered',
    color: 'bg-green-100 text-green-800',
  },
  failed: {
    label: 'Failed',
    labelDefault: 'Failed',
    color: 'bg-red-100 text-red-800',
  },
}

// ============================================================
// HELPER: Get status config safely
// ============================================================
export const getStatusConfig = (status, config = ORDER_STATUS_CONFIG) => {
  return config[status] || config.pending || {
    label: status,
    labelDefault: status,
    color: 'bg-gray-100 text-gray-800',
    dotColor: 'bg-gray-500',
    icon: ClockIcon,
    stepIndex: -1,
  }
}
