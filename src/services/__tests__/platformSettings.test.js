/**
 * Regression test for platformSettings key-value schema alignment
 */

let nextDbResult = { data: null, error: null, count: 0 }
let upsertResult = { error: null }
let insertResult = { error: null }

const mockFrom = jest.fn()
const mockSelect = jest.fn()
const mockInsert = jest.fn()
const mockUpsert = jest.fn()
const mockOrder = jest.fn()
const mockRange = jest.fn()
const mockSingle = jest.fn()

function createBuilder() {
  const builder = {
    select: mockSelect.mockImplementation(() => builder),
    insert: mockInsert.mockImplementation(() => Promise.resolve(insertResult)),
    upsert: mockUpsert.mockImplementation((data, opts) => Promise.resolve(upsertResult)),
    order: mockOrder.mockImplementation(() => builder),
    range: mockRange.mockImplementation(() => Promise.resolve(nextDbResult)),
    single: mockSingle.mockImplementation(() => Promise.resolve(nextDbResult)),
  }
  // Make the builder thenable so await works on the final object
  builder.then = (onFulfilled, onRejected) => Promise.resolve(nextDbResult).then(onFulfilled, onRejected)
  return builder
}

mockFrom.mockImplementation(() => createBuilder())

jest.mock('@/services/supabase', () => ({
  supabase: { from: mockFrom },
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/config/appConfig', () => ({
  APP_CONFIG: {
    name: 'Qotoof',
    supportEmail: 'support@qotoof.ma',
    supportPhoneDisplay: '+212 5XX-XXXXXX',
    commissionRate: 0.1,
  },
}))

// Prevent localStorage errors in test environment
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true })

function requireFresh() {
  jest.resetModules()
  return require('@/services/platformSettings')
}

describe('platformSettings', () => {
  let platformSettings

  beforeEach(() => {
    jest.clearAllMocks()
    nextDbResult = { data: null, error: null, count: 0 }
    upsertResult = { error: null }
    insertResult = { error: null }
    localStorageMock.getItem.mockReturnValue(null)
    platformSettings = requireFresh()
  })

  describe('getSettings', () => {
    it('merges key-value DB rows with defaults', async () => {
      nextDbResult = {
        data: [
          { setting_key: 'platform_name', setting_value: 'TestPlatform' },
          { setting_key: 'maintenance_mode', setting_value: true },
        ],
        error: null,
      }

      const settings = await platformSettings.getSettings()

      expect(settings.platform_name).toBe('TestPlatform')
      expect(settings.maintenance_mode).toBe(true)
      expect(settings.currency).toBe('MAD')
      expect(settings.language).toBe('ar')
    })

    it('returns defaults when DB query fails', async () => {
      nextDbResult = { data: null, error: { message: 'table missing' } }

      const settings = await platformSettings.getSettings()

      expect(settings.platform_name).toBe('Qotoof')
      expect(settings.currency).toBe('MAD')
    })
  })

  describe('updateSettings', () => {
    it('upserts key-value rows with onConflict setting_key', async () => {
      nextDbResult = {
        data: [{ setting_key: 'commission_rate', setting_value: 10 }],
        error: null,
      }
      await platformSettings.getSettings()

      const result = await platformSettings.updateSettings(
        { commission_rate: 12, unsupported_field: 'x' },
        'admin-1',
        'Admin Name'
      )

      expect(result.success).toBe(true)
      expect(mockUpsert).toHaveBeenCalled()
      const upsertCall = mockUpsert.mock.calls[0]
      expect(upsertCall[1]).toEqual({ onConflict: 'setting_key' })
      const rows = upsertCall[0]
      expect(rows).toHaveLength(1)
      expect(rows[0].setting_key).toBe('commission_rate')
      expect(rows[0].setting_value).toBe(12)
    })
  })

  describe('getSettingsAuditLog', () => {
    it('orders by created_at (not changed_at)', async () => {
      nextDbResult = { data: [], error: null, count: 0 }

      await platformSettings.getSettingsAuditLog(10, 0)

      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    })
  })
})
