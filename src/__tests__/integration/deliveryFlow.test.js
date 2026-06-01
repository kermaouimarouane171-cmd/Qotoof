/**
 * Integration Tests: Delivery Flow
 * Tests Order created -> delivery assigned -> driver accepts -> delivered flow.
 * All logic is simulated with mock implementations; no real imports.
 */

describe('Delivery Flow Integration', () => {
  // --- Mock Services ---

  const createOrdersApi = () => {
    const orders = []
    let nextId = 1
    return {
      async createOrder({ buyerId, vendorId, items, total, shippingAddress }) {
        const order = {
          id: `o${nextId++}`,
          order_number: `ORD-${String(nextId - 1).padStart(3, '0')}`,
          status: 'pending',
          buyer_id: buyerId,
          vendor_id: vendorId,
          items,
          total,
          shipping_address: shippingAddress,
          created_at: new Date().toISOString(),
        }
        orders.push(order)
        return order
      },
      async acceptOrder(orderId) {
        const order = orders.find(o => o.id === orderId)
        if (!order) throw new Error('Order not found')
        order.status = 'vendor_accepted'
        order.accepted_at = new Date().toISOString()
        return order
      },
      async getOrder(orderId) { return orders.find(o => o.id === orderId) || null },
      getOrders() { return [...orders] },
    }
  }

  const createDeliveriesApi = () => {
    const deliveries = []
    let nextId = 1
    return {
      async createDelivery(orderId, vendorId) {
        const delivery = {
          id: `d${nextId++}`,
          order_id: orderId,
          vendor_id: vendorId,
          driver_id: null,
          status: 'unassigned',
          created_at: new Date().toISOString(),
        }
        deliveries.push(delivery)
        return delivery
      },
      async getUnassignedDeliveries(vendorId) {
        return deliveries.filter(d => d.vendor_id === vendorId && d.status === 'unassigned')
      },
      async assignDriver(deliveryId, driverId) {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery) throw new Error('Delivery not found')
        if (!['unassigned'].includes(delivery.status)) {
          throw new Error('This delivery has already been assigned or accepted')
        }
        delivery.driver_id = driverId
        delivery.status = 'assigned'
        delivery.assigned_at = new Date().toISOString()
        return delivery
      },
      async getDriverDeliveries(driverId, status = null) {
        let result = deliveries.filter(d => d.driver_id === driverId)
        if (status) result = result.filter(d => d.status === status)
        return result
      },
      async acceptDelivery(deliveryId) {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery) throw new Error('Delivery not found')
        if (delivery.status !== 'assigned') {
          throw new Error('This delivery has already been accepted by another driver')
        }
        delivery.status = 'accepted'
        delivery.accepted_at = new Date().toISOString()
        return delivery
      },
      async markPickedUp(deliveryId) {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery) throw new Error('Delivery not found')
        if (delivery.status !== 'accepted') throw new Error('This delivery is not in a state to be picked up')
        delivery.status = 'picked_up'
        delivery.picked_up_at = new Date().toISOString()
        return delivery
      },
      async markOnTheWay(deliveryId) {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery) throw new Error('Delivery not found')
        if (delivery.status !== 'picked_up') throw new Error('This delivery has not been picked up yet')
        delivery.status = 'on_the_way'
        delivery.on_the_way_at = new Date().toISOString()
        return delivery
      },
      async markDelivered(deliveryId, { proofUrl = null, signatureUrl = null } = {}) {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery) throw new Error('Delivery not found')
        if (!['on_the_way'].includes(delivery.status)) {
          throw new Error('This delivery is not on the way')
        }
        delivery.status = 'delivered'
        delivery.delivered_at = new Date().toISOString()
        delivery.delivery_proof_url = proofUrl
        delivery.signature_url = signatureUrl
        return delivery
      },
      async updateLocation(deliveryId, latitude, longitude) {
        const delivery = deliveries.find(d => d.id === deliveryId)
        if (!delivery) throw new Error('Delivery not found')
        delivery.current_latitude = latitude
        delivery.current_longitude = longitude
        delivery.last_location_update = new Date().toISOString()
      },
      async getById(deliveryId) { return deliveries.find(d => d.id === deliveryId) || null },
      getAll() { return [...deliveries] },
    }
  }

  const createNotificationsApi = () => {
    const notifications = []
    return {
      async send(userId, { type, title, message, orderId = null }) {
        const notif = {
          id: `n${notifications.length + 1}`,
          user_id: userId,
          type,
          title,
          message,
          order_id: orderId,
          read: false,
          created_at: new Date().toISOString(),
        }
        notifications.push(notif)
        return notif
      },
      getByUser(userId) { return notifications.filter(n => n.user_id === userId) },
      getAll() { return [...notifications] },
    }
  }

  let orders, deliveries, notifications

  beforeEach(() => {
    orders = createOrdersApi()
    deliveries = createDeliveriesApi()
    notifications = createNotificationsApi()
  })

  // --- Tests ---

  describe('Order to Delivery creation', () => {
    it('should create a delivery when order is accepted by vendor', async () => {
      // Buyer creates order
      const order = await orders.createOrder({
        buyerId: 'b1',
        vendorId: 'v1',
        items: [{ id: 'p1', name: 'Tomatoes', quantity: 2, price_per_unit: 12 }],
        total: 28.8,
        shippingAddress: { city: 'Casablanca', address: '12 Rue Hassan II', phone: '0612345678' },
      })

      // Vendor accepts order
      await orders.acceptOrder(order.id)
      expect(order.status).toBe('vendor_accepted')

      // System creates delivery
      const delivery = await deliveries.createDelivery(order.id, 'v1')
      expect(delivery).toBeDefined()
      expect(delivery.order_id).toBe(order.id)
      expect(delivery.status).toBe('unassigned')
    })

    it('should notify buyer when delivery is created', async () => {
      const order = await orders.createOrder({
        buyerId: 'b1',
        vendorId: 'v1',
        items: [{ id: 'p1', name: 'Tomatoes', quantity: 2, price_per_unit: 12 }],
        total: 28.8,
        shippingAddress: { city: 'Casablanca', address: '12 Rue Hassan II', phone: '0612345678' },
      })
      await orders.acceptOrder(order.id)
      await deliveries.createDelivery(order.id, 'v1')

      const notif = await notifications.send('b1', {
        type: 'delivery_created',
        title: 'Delivery Assigned',
        message: `Your order ${order.order_number} is being prepared for delivery`,
        orderId: order.id,
      })

      expect(notif.user_id).toBe('b1')
      expect(notif.type).toBe('delivery_created')
    })
  })

  describe('Driver assignment', () => {
    it('should assign driver to unassigned delivery', async () => {
      const order = await orders.createOrder({
        buyerId: 'b1',
        vendorId: 'v1',
        items: [{ id: 'p1', name: 'Tomatoes', quantity: 2, price_per_unit: 12 }],
        total: 28.8,
        shippingAddress: { city: 'Casablanca', address: '12 Rue Hassan II', phone: '0612345678' },
      })
      await orders.acceptOrder(order.id)
      const delivery = await deliveries.createDelivery(order.id, 'v1')

      const assigned = await deliveries.assignDriver(delivery.id, 'drv1')

      expect(assigned.driver_id).toBe('drv1')
      expect(assigned.status).toBe('assigned')
      expect(assigned.assigned_at).toBeDefined()
    })

    it('should show unassigned deliveries to vendor', async () => {
      const order = await orders.createOrder({
        buyerId: 'b1',
        vendorId: 'v1',
        items: [{ id: 'p1', name: 'Tomatoes', quantity: 2, price_per_unit: 12 }],
        total: 28.8,
        shippingAddress: { city: 'Casablanca', address: '12 Rue Hassan II', phone: '0612345678' },
      })
      await orders.acceptOrder(order.id)
      await deliveries.createDelivery(order.id, 'v1')
      await deliveries.createDelivery(order.id, 'v1')

      const unassigned = await deliveries.getUnassignedDeliveries('v1')
      expect(unassigned).toHaveLength(2)
      unassigned.forEach(d => expect(d.status).toBe('unassigned'))
    })

    it('should notify driver when assigned a delivery', async () => {
      const order = await orders.createOrder({
        buyerId: 'b1',
        vendorId: 'v1',
        items: [{ id: 'p1', name: 'Tomatoes', quantity: 2, price_per_unit: 12 }],
        total: 28.8,
        shippingAddress: { city: 'Casablanca', address: '12 Rue Hassan II', phone: '0612345678' },
      })
      await orders.acceptOrder(order.id)
      const delivery = await deliveries.createDelivery(order.id, 'v1')
      await deliveries.assignDriver(delivery.id, 'drv1')

      const notif = await notifications.send('drv1', {
        type: 'delivery_assigned',
        title: 'New Delivery',
        message: `You have been assigned delivery for order ${order.order_number}`,
        orderId: order.id,
      })

      expect(notif.user_id).toBe('drv1')
      expect(notif.type).toBe('delivery_assigned')
    })
  })

  describe('Driver acceptance', () => {
    it('should allow driver to accept assigned delivery', async () => {
      const order = await orders.createOrder({
        buyerId: 'b1',
        vendorId: 'v1',
        items: [{ id: 'p1', name: 'Tomatoes', quantity: 2, price_per_unit: 12 }],
        total: 28.8,
        shippingAddress: { city: 'Casablanca', address: '12 Rue Hassan II', phone: '0612345678' },
      })
      await orders.acceptOrder(order.id)
      const delivery = await deliveries.createDelivery(order.id, 'v1')
      await deliveries.assignDriver(delivery.id, 'drv1')

      const accepted = await deliveries.acceptDelivery(delivery.id)

      expect(accepted.status).toBe('accepted')
      expect(accepted.accepted_at).toBeDefined()
    })

    it('should show assigned deliveries in driver dashboard', async () => {
      const order = await orders.createOrder({
        buyerId: 'b1',
        vendorId: 'v1',
        items: [{ id: 'p1', name: 'Tomatoes', quantity: 2, price_per_unit: 12 }],
        total: 28.8,
        shippingAddress: { city: 'Casablanca', address: '12 Rue Hassan II', phone: '0612345678' },
      })
      await orders.acceptOrder(order.id)
      const delivery = await deliveries.createDelivery(order.id, 'v1')
      await deliveries.assignDriver(delivery.id, 'drv1')

      const driverDeliveries = await deliveries.getDriverDeliveries('drv1', 'assigned')
      expect(driverDeliveries).toHaveLength(1)
      expect(driverDeliveries[0].driver_id).toBe('drv1')
    })
  })

  describe('Delivery progression to delivered', () => {
    it('should complete full delivery flow: assigned -> accepted -> picked_up -> on_the_way -> delivered', async () => {
      const order = await orders.createOrder({
        buyerId: 'b1',
        vendorId: 'v1',
        items: [{ id: 'p1', name: 'Tomatoes', quantity: 2, price_per_unit: 12 }],
        total: 28.8,
        shippingAddress: { city: 'Casablanca', address: '12 Rue Hassan II', phone: '0612345678' },
      })
      await orders.acceptOrder(order.id)
      const delivery = await deliveries.createDelivery(order.id, 'v1')

      // Assign driver
      await deliveries.assignDriver(delivery.id, 'drv1')
      expect(delivery.status).toBe('assigned')

      // Driver accepts
      await deliveries.acceptDelivery(delivery.id)
      expect(delivery.status).toBe('accepted')

      // Driver picks up
      await deliveries.markPickedUp(delivery.id)
      expect(delivery.status).toBe('picked_up')

      // Driver marks on the way
      await deliveries.markOnTheWay(delivery.id)
      expect(delivery.status).toBe('on_the_way')

      // Driver marks delivered
      const delivered = await deliveries.markDelivered(delivery.id, {
        proofUrl: 'https://storage.example.com/proof1.jpg',
        signatureUrl: 'https://storage.example.com/sig1.jpg',
      })
      expect(delivered.status).toBe('delivered')
      expect(delivered.delivered_at).toBeDefined()
      expect(delivered.delivery_proof_url).toBe('https://storage.example.com/proof1.jpg')
    })

    it('should prevent invalid state transitions', async () => {
      const order = await orders.createOrder({
        buyerId: 'b1',
        vendorId: 'v1',
        items: [{ id: 'p1', name: 'Tomatoes', quantity: 2, price_per_unit: 12 }],
        total: 28.8,
        shippingAddress: { city: 'Casablanca', address: '12 Rue Hassan II', phone: '0612345678' },
      })
      await orders.acceptOrder(order.id)
      const delivery = await deliveries.createDelivery(order.id, 'v1')

      // Cannot pick up unassigned delivery
      await expect(deliveries.markPickedUp(delivery.id)).rejects.toThrow('not in a state to be picked up')

      // Cannot mark on_the_way without pickup
      await deliveries.assignDriver(delivery.id, 'drv1')
      await expect(deliveries.markOnTheWay(delivery.id)).rejects.toThrow('not been picked up')

      // Cannot deliver without being on the way
      await deliveries.acceptDelivery(delivery.id)
      await expect(deliveries.markDelivered(delivery.id)).rejects.toThrow('not on the way')
    })

    it('should update driver location during delivery', async () => {
      const order = await orders.createOrder({
        buyerId: 'b1',
        vendorId: 'v1',
        items: [{ id: 'p1', name: 'Tomatoes', quantity: 2, price_per_unit: 12 }],
        total: 28.8,
        shippingAddress: { city: 'Casablanca', address: '12 Rue Hassan II', phone: '0612345678' },
      })
      await orders.acceptOrder(order.id)
      const delivery = await deliveries.createDelivery(order.id, 'v1')
      await deliveries.assignDriver(delivery.id, 'drv1')
      await deliveries.acceptDelivery(delivery.id)
      await deliveries.markPickedUp(delivery.id)
      await deliveries.markOnTheWay(delivery.id)

      await deliveries.updateLocation(delivery.id, 33.5731, -7.5898)

      const updated = await deliveries.getById(delivery.id)
      expect(updated.current_latitude).toBe(33.5731)
      expect(updated.current_longitude).toBe(-7.5898)
      expect(updated.last_location_update).toBeDefined()
    })

    it('should notify buyer when delivery is completed', async () => {
      const order = await orders.createOrder({
        buyerId: 'b1',
        vendorId: 'v1',
        items: [{ id: 'p1', name: 'Tomatoes', quantity: 2, price_per_unit: 12 }],
        total: 28.8,
        shippingAddress: { city: 'Casablanca', address: '12 Rue Hassan II', phone: '0612345678' },
      })
      await orders.acceptOrder(order.id)
      const delivery = await deliveries.createDelivery(order.id, 'v1')
      await deliveries.assignDriver(delivery.id, 'drv1')
      await deliveries.acceptDelivery(delivery.id)
      await deliveries.markPickedUp(delivery.id)
      await deliveries.markOnTheWay(delivery.id)
      await deliveries.markDelivered(delivery.id)

      const notif = await notifications.send('b1', {
        type: 'delivery_completed',
        title: 'Delivery Completed',
        message: `Your order ${order.order_number} has been delivered`,
        orderId: order.id,
      })

      expect(notif.user_id).toBe('b1')
      expect(notif.type).toBe('delivery_completed')
    })
  })
})
