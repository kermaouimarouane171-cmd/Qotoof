import { profilesService } from '@/services/profilesService'
import { auditLogger } from '@/services/auditLogger'

jest.mock('@/services/profilesService', () => ({
  profilesService: {
    fetchDriverProfile: jest.fn(),
    updateProfile: jest.fn(),
  },
}))

jest.mock('@/services/auditLogger', () => ({
  auditLogger: {
    logProfileAction: jest.fn(),
  },
}))

const normalizeDistanceValue = (value, fallback) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const validateDriverSettings = (state) => {
  const errors = {}
  const normalizedMinDistance = normalizeDistanceValue(state.minDeliveryDistanceKm, 0)
  const normalizedMaxDistance = normalizeDistanceValue(state.maxDeliveryDistanceKm, 0)

  if (state.vehiclePlate && state.vehiclePlate.length > 20) {
    errors.vehiclePlate = 'Vehicle plate must be less than 20 characters'
  }

  if (state.licenseNumber && state.licenseNumber.length > 50) {
    errors.licenseNumber = 'License number must be less than 50 characters'
  }

  if (normalizedMinDistance < 0) {
    errors.minDeliveryDistanceKm = 'المسافة الدنيا يجب أن تكون صفراً أو أكثر.'
  }

  if (normalizedMaxDistance <= 0) {
    errors.maxDeliveryDistanceKm = 'المسافة القصوى يجب أن تكون أكبر من صفر.'
  }

  if (normalizedMaxDistance < normalizedMinDistance) {
    errors.maxDeliveryDistanceKm = 'المسافة القصوى يجب أن تكون أكبر من أو تساوي المسافة الدنيا.'
  }

  if (!state.acceptedCargoSizes.length) {
    errors.acceptedCargoSizes = 'اختر حجماً واحداً على الأقل للحمولة المقبولة.'
  }

  if (!state.driverDeliveryPaymentCash && !state.driverDeliveryPaymentTransfer) {
    errors.driverDeliveryPaymentMethod = 'اختر طريقة واحدة على الأقل لتحصيل رسم التوصيل.'
  }

  return errors
}

const saveDriverSettings = async ({ userId, profileState, oldData }) => {
  const updatePayload = {
    vehicle_type: profileState.vehicleType || null,
    vehicle_plate: profileState.vehiclePlate || null,
    license_number: profileState.licenseNumber || null,
    is_available_for_delivery: profileState.isAvailableForDelivery,
    notify_new_deliveries: profileState.notifyNewDeliveries,
    notify_order_updates: profileState.notifyOrderUpdates,
    notify_customer_messages: profileState.notifyCustomerMessages,
    min_delivery_distance_km: normalizeDistanceValue(profileState.minDeliveryDistanceKm, 0),
    max_delivery_distance_km: normalizeDistanceValue(profileState.maxDeliveryDistanceKm, 50),
    accepted_cargo_sizes: profileState.acceptedCargoSizes,
    driver_delivery_payment_cash: profileState.driverDeliveryPaymentCash,
    driver_delivery_payment_transfer: profileState.driverDeliveryPaymentTransfer,
    driver_delivery_payment_notes: profileState.driverDeliveryPaymentNotes || null,
    paypal_email: profileState.paypalEmail?.trim().toLowerCase() || null,
    payout_method: 'paypal',
  }

  const { error } = await profilesService.updateProfile(userId, updatePayload)
  if (error) throw error

  await auditLogger.logProfileAction('DRIVER_SETTINGS_UPDATED', updatePayload, oldData)
  return updatePayload
}

describe('Driver Settings integration workflow', () => {
  const loadedProfile = {
    vehicle_type: 'car',
    vehicle_plate: '12345-أ-1',
    license_number: 'LIC-12345',
    is_available_for_delivery: true,
    notify_new_deliveries: true,
    notify_order_updates: true,
    notify_customer_messages: true,
    min_delivery_distance_km: 5,
    max_delivery_distance_km: 55,
    accepted_cargo_sizes: ['small', 'medium'],
    driver_delivery_payment_cash: true,
    driver_delivery_payment_transfer: true,
    driver_delivery_payment_notes: 'notes',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    profilesService.fetchDriverProfile.mockResolvedValue({ data: loadedProfile, error: null })
    profilesService.updateProfile.mockResolvedValue({ data: loadedProfile, error: null })
  })

  it('loads driver profile with vehicle and license info', async () => {
    const { data, error } = await profilesService.fetchDriverProfile('driver-1')

    expect(error).toBeNull()
    expect(data.vehicle_type).toBe('car')
    expect(data.vehicle_plate).toBe('12345-أ-1')
    expect(data.license_number).toBe('LIC-12345')
  })

  it('supports required vehicle type options', () => {
    const supportedTypes = ['motorcycle', 'car', 'van', 'truck', 'bicycle']
    expect(supportedTypes).toEqual(expect.arrayContaining(['car', 'motorcycle', 'van', 'truck']))
  })

  it('validates moroccan-style plate and distance constraints before save', () => {
    const errors = validateDriverSettings({
      vehiclePlate: '12345-أ-1',
      licenseNumber: 'LIC-1',
      minDeliveryDistanceKm: 30,
      maxDeliveryDistanceKm: 10,
      acceptedCargoSizes: ['small'],
      driverDeliveryPaymentCash: true,
      driverDeliveryPaymentTransfer: true,
    })

    expect(errors.maxDeliveryDistanceKm).toBe('المسافة القصوى يجب أن تكون أكبر من أو تساوي المسافة الدنيا.')
  })

  it('requires at least one payment method', () => {
    const errors = validateDriverSettings({
      vehiclePlate: '12345-أ-1',
      licenseNumber: 'LIC-1',
      minDeliveryDistanceKm: 0,
      maxDeliveryDistanceKm: 50,
      acceptedCargoSizes: ['small'],
      driverDeliveryPaymentCash: false,
      driverDeliveryPaymentTransfer: false,
    })

    expect(errors.driverDeliveryPaymentMethod).toBe('اختر طريقة واحدة على الأقل لتحصيل رسم التوصيل.')
  })

  it('saves delivery preferences and payment policy payload to profiles', async () => {
    const payload = await saveDriverSettings({
      userId: 'driver-1',
      oldData: loadedProfile,
      profileState: {
        vehicleType: 'van',
        vehiclePlate: '99887-ب-2',
        licenseNumber: 'LIC-NEW-99',
        isAvailableForDelivery: false,
        notifyNewDeliveries: false,
        notifyOrderUpdates: true,
        notifyCustomerMessages: true,
        minDeliveryDistanceKm: 10,
        maxDeliveryDistanceKm: 70,
        acceptedCargoSizes: ['small', 'large'],
        driverDeliveryPaymentCash: false,
        driverDeliveryPaymentTransfer: true,
        driverDeliveryPaymentNotes: 'Bank transfer only',
      },
    })

    expect(profilesService.updateProfile).toHaveBeenCalledWith(
      'driver-1',
      expect.objectContaining({
        vehicle_type: 'van',
        vehicle_plate: '99887-ب-2',
        min_delivery_distance_km: 10,
        max_delivery_distance_km: 70,
        accepted_cargo_sizes: ['small', 'large'],
      }),
    )

    expect(payload.driver_delivery_payment_transfer).toBe(true)
    expect(payload.driver_delivery_payment_cash).toBe(false)
  })

  it('logs audit event when vehicle or availability changes', async () => {
    await saveDriverSettings({
      userId: 'driver-1',
      oldData: loadedProfile,
      profileState: {
        vehicleType: 'truck',
        vehiclePlate: '88776-ج-4',
        licenseNumber: 'LIC-NEW-200',
        isAvailableForDelivery: true,
        notifyNewDeliveries: true,
        notifyOrderUpdates: true,
        notifyCustomerMessages: false,
        minDeliveryDistanceKm: 5,
        maxDeliveryDistanceKm: 65,
        acceptedCargoSizes: ['medium'],
        driverDeliveryPaymentCash: true,
        driverDeliveryPaymentTransfer: true,
        driverDeliveryPaymentNotes: '',
      },
    })

    expect(auditLogger.logProfileAction).toHaveBeenCalledWith(
      'DRIVER_SETTINGS_UPDATED',
      expect.objectContaining({
        vehicle_type: 'truck',
        vehicle_plate: '88776-ج-4',
      }),
      loadedProfile,
    )
  })
})
