import { USER_ROLES } from '@/modules/auth'

export const canViewAdminDashboard = (userLike) => {
  const role = userLike?.role
  return role === USER_ROLES.ADMIN
}

export const canEditProduct = (userLike, product) => {
  if (!userLike) return false
  if (userLike.role === USER_ROLES.ADMIN) return true
  if (userLike.role === USER_ROLES.VENDOR && product?.vendor_id) {
    return product.vendor_id === userLike.id
  }
  return false
}

export const canDeleteOrder = (userLike, order) => {
  if (!userLike || !order) return false
  if (userLike.role === USER_ROLES.ADMIN) return true

  if (userLike.role === USER_ROLES.VENDOR) {
    return order.vendor_id === userLike.id
  }

  if (userLike.role === USER_ROLES.BUYER) {
    return order.buyer_id === userLike.id
  }

  return false
}

// Returns true only for roles that have a dedicated dashboard route.
// BUYER intentionally excluded: buyers navigate via /marketplace, not a dashboard.
export const canAccessRoleDashboard = (userLike) => {
  if (!userLike?.role) return false
  return [USER_ROLES.ADMIN, USER_ROLES.VENDOR, USER_ROLES.DRIVER].includes(userLike.role)
}
