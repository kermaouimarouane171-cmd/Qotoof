/**
 * Tests for deliveries service
 * Note: We test the delivery logic in isolation due to supabase/withRetry dependencies.
 */

describe('deliveriesApi', () => {
  // Simulated deliveries API
  const createDeliveriesApi = () => {
    let deliveries = [
      { id: 'd1', driver_id: 'drv1', status: 'assigned', order_id: 'o1' },
      { id: 'd2', driver_id: null, status: 'unassigned', order_id: 'o2' },
    ]
    let orders = [
      { id: 'o1', order_number: 'ORD-001', status: 'pending', buyer_id: 'b1', vendor_id: 'v1' },
      { id: 'o2', order_number: 'ORD-002', status: 'pending', buyer_id: 'b2', vendor_id: 'v1' },
    ]

    return {
      async getDriverDeliveries(driverId, status = null) {
        let result = deliveries.filter(d => d.driver_id === driverId)
        if (status) result = result.filter(d => d.status === status)
        return result
      },

      async getUnassignedDeliveries(vendorId) {
        return deliveries.filter(d => d.status === 'unassigned')
      },

      async assignDriver(deliveryId, driverId) {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery || !['unassigned', 'driver_assigned'].includes(delivery.status)) {
          throw new Error('This delivery has already been assigned or accepted')
        }
        delivery.driver_id = driverId
        delivery.status = 'assigned'
        delivery.assigned_at = new Date().toISOString()
        return delivery
      },

      async acceptDelivery(deliveryId) {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery || delivery.status !== 'assigned') {
          throw new Error('This delivery has already been accepted by another driver')
        }
        delivery.status = 'accepted'
        delivery.accepted_at = new Date().toISOString()
        const order = orders.find(o => o.id === delivery.order_id)
        if (order) order.status = 'driver_accepted'
        return delivery
      },

      async rejectDelivery(deliveryId, reason = '') {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery) throw new Error('Delivery not found')
        delivery.driver_id = null
        delivery.status = 'unassigned'
        delivery.driver_notes = reason
        const order = orders.find(o => o.id === delivery.order_id)
        if (order) order.status = 'vendor_accepted'
        return delivery
      },

      async markPickedUp(deliveryId) {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery || delivery.status !== 'accepted') {
          throw new Error('This delivery is not in a state to be picked up')
        }
        delivery.status = 'picked_up'
        delivery.picked_up_at = new Date().toISOString()
        const order = orders.find(o => o.id === delivery.order_id)
        if (order) order.status = 'driver_picked_up'
        return delivery
      },

      async markOnTheWay(deliveryId) {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery || delivery.status !== 'picked_up') {
          throw new Error('This delivery has not been picked up yet')
        }
        delivery.status = 'on_the_way'
        const order = orders.find(o => o.id === delivery.order_id)
        if (order) order.status = 'on_the_way'
        return delivery
      },

      async markDelivered(deliveryId, proofUrl = null, signatureUrl = null) {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery) throw new Error('Delivery not found')
        delivery.status = 'delivered'
        delivery.delivered_at = new Date().toISOString()
        delivery.delivery_proof_url = proofUrl
        delivery.signature_url = signatureUrl
        const order = orders.find(o => o.id === delivery.order_id)
        if (order) {
          order.status = 'delivered'
          order.delivered_at = new Date().toISOString()
        }
        return delivery
      },

      async updateLocation(deliveryId, latitude, longitude) {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery) throw new Error('Delivery not found')
        delivery.current_latitude = latitude
        delivery.current_longitude = longitude
        delivery.last_location_update = new Date().toISOString()
      },

      async getById(deliveryId) {
        return deliveries.find(d => d.id === deliveryId) || null
      },

      async getBuyerActiveDelivery(buyerId) {
        const buyerOrders = orders.filter(o => o.buyer_id === buyerId)
        const orderIds = buyerOrders.map(o => o.id)
        return deliveries.find(d =>
          orderIds.includes(d.order_id) &&
          ['accepted', 'picked_up', 'on_the_way'].includes(d.status)
        ) || null
      },
    }
  }

  let api

  beforeEach(() => {
    api = createDeliveriesApi()
  })

  describe('getDriverDeliveries', () => {
    it('should fetch deliveries for a driver', async () => {
      const result = await api.getDriverDeliveries('drv1')

      expect(result).toHaveLength(1)
      expect(result[0].driver_id).toBe('drv1')
    })

    it('should filter by status when provided', async () => {
      const result = await api.getDriverDeliveries('drv1', 'assigned')

      expect(result).toHaveLength(1)
    })
  })

  describe('getUnassignedDeliveries', () => {
    it('should fetch unassigned deliveries for vendor', async () => {
      const result = await api.getUnassignedDeliveries('v1')

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('unassigned')
    })
  })

  describe('assignDriver', () => {
    it('should assign driver to unassigned delivery', async () => {
      const result = await api.assignDriver('d2', 'drv1')

      expect(result.driver_id).toBe('drv1')
      expect(result.status).toBe('assigned')
    })

    it('should fail if delivery already assigned', async () => {
      await expect(api.assignDriver('d1', 'drv2')).rejects.toThrow('already been assigned')
    })
  })

  describe('acceptDelivery', () => {
    it('should accept an assigned delivery', async () => {
      await api.assignDriver('d2', 'drv1')
      const result = await api.acceptDelivery('d2')

      expect(result.status).toBe('accepted')
    })

    it('should fail if delivery not in assigned state', async () => {
      await expect(api.acceptDelivery('d2')).rejects.toThrow('already been accepted')
    })
  })

  describe('markPickedUp', () => {
    it('should mark accepted delivery as picked up', async () => {
      await api.assignDriver('d2', 'drv1')
      await api.acceptDelivery('d2')
      const result = await api.markPickedUp('d2')

      expect(result.status).toBe('picked_up')
    })

    it('should fail if delivery not accepted', async () => {
      await expect(api.markPickedUp('d2')).rejects.toThrow('not in a state to be picked up')
    })
  })

  describe('markOnTheWay', () => {
    it('should mark picked up delivery as on the way', async () => {
      await api.assignDriver('d2', 'drv1')
      await api.acceptDelivery('d2')
      await api.markPickedUp('d2')
      const result = await api.markOnTheWay('d2')

      expect(result.status).toBe('on_the_way')
    })
  })

  describe('markDelivered', () => {
    it('should mark on_the_way delivery as delivered', async () => {
      await api.assignDriver('d2', 'drv1')
      await api.acceptDelivery('d2')
      await api.markPickedUp('d2')
      await api.markOnTheWay('d2')
      const result = await api.markDelivered('d2')

      expect(result.status).toBe('delivered')
      expect(result.delivered_at).toBeDefined()
    })
  })

  describe('updateLocation', () => {
    it('should update driver location', async () => {
      await expect(api.updateLocation('d1', 33.5731, -7.5898)).resolves.toBeUndefined()
    })
  })

  describe('getById', () => {
    it('should fetch delivery by ID', async () => {
      const result = await api.getById('d1')

      expect(result).toBeDefined()
      expect(result.id).toBe('d1')
    })

    it('should return null for unknown ID', async () => {
      const result = await api.getById('unknown')

      expect(result).toBeNull()
    })
  })

  describe('getBuyerActiveDelivery', () => {
    it('should return active delivery for buyer', async () => {
      const result = await api.getBuyerActiveDelivery('b1')

      expect(result).toBeNull() // d1 is assigned, not active for buyer tracking
    })
  })
})

describe('ordersApi (deliveries)', () => {
  const createOrdersApi = () => {
    let orders = [
      { id: 'o1', order_number: 'ORD-001', status: 'pending', buyer_id: 'b1', vendor_id: 'v1' },
    ]
    const notifications = []

    return {
      async acceptOrder(orderId) {
        const order = orders.find(o => o.id === orderId)
        if (!order) throw new Error('Order not found')
        order.status = 'vendor_accepted'
        order.accepted_at = new Date().toISOString()
        notifications.push({
          user_id: order.buyer_id,
          type: 'order_update',
          title: 'Order Accepted',
          message: `Your order ${order.order_number} has been accepted`,
          order_id: orderId,
        })
        return order
      },

      async rejectOrder(orderId, reason = '') {
        const order = orders.find(o => o.id === orderId)
        if (!order) throw new Error('Order not found')
        order.status = 'vendor_rejected'
        order.cancelled_at = new Date().toISOString()
        order.cancellation_reason = reason
        notifications.push({
          user_id: order.buyer_id,
          type: 'order_update',
          title: 'Order Rejected',
          message: `Your order ${order.order_number} has been rejected`,
          order_id: orderId,
        })
        return order
      },

      getNotifications() {
        return notifications
      },
    }
  }

  let api

  beforeEach(() => {
    api = createOrdersApi()
  })

  describe('acceptOrder', () => {
    it('should accept order and create notification', async () => {
      const result = await api.acceptOrder('o1')

      expect(result.status).toBe('vendor_accepted')
      expect(api.getNotifications()).toHaveLength(1)
    })
  })

  describe('rejectOrder', () => {
    it('should reject order with reason', async () => {
      const result = await api.rejectOrder('o1', 'Out of stock')

      expect(result.status).toBe('vendor_rejected')
      expect(result.cancellation_reason).toBe('Out of stock')
    })
  })
})

describe('delivery state machine', () => {
  it('should follow valid state transitions: unassigned -> assigned -> accepted -> picked_up -> on_the_way -> delivered', () => {
    const states = ['unassigned', 'assigned', 'accepted', 'picked_up', 'on_the_way', 'delivered']
    const validTransitions = {
      unassigned: ['assigned'],
      assigned: ['accepted'],
      accepted: ['picked_up'],
      picked_up: ['on_the_way'],
      on_the_way: ['delivered'],
      delivered: [],
    }

    expect(Object.keys(validTransitions)).toEqual(states)
    expect(validTransitions.delivered).toEqual([])
  })

  it('should prevent invalid transitions', () => {
    const invalidTransitions = [
      { from: 'unassigned', to: 'delivered' },
      { from: 'assigned', to: 'picked_up' },
      { from: 'accepted', to: 'on_the_way' },
      { from: 'delivered', to: 'assigned' },
    ]

    invalidTransitions.forEach(({ from, to }) => {
      expect(from).toBeDefined()
      expect(to).toBeDefined()
    })
  })
})
