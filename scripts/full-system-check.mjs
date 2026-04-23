/* global console, process */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const checks = []

const addResult = (name, status, details) => {
  checks.push({ name, status, details })
}

const runCheck = async (name, fn) => {
  try {
    const details = await fn()
    addResult(name, 'PASS', details)
  } catch (error) {
    addResult(name, 'FAIL', error.message)
  }
}

const runSkippedCheck = (name, details) => {
  addResult(name, 'SKIP', details)
}

const readProjectFile = async (relativePath) => {
  return fs.readFile(path.join(projectRoot, relativePath), 'utf8')
}

const getMissingFiles = async (files) => {
  const missing = []

  await Promise.all(
    files.map(async (file) => {
      try {
        await fs.access(path.join(projectRoot, file))
      } catch {
        missing.push(file)
      }
    })
  )

  return missing
}

const ensureSnippets = (content, snippets, label = 'مقتطفات') => {
  const missing = snippets.filter((snippet) => !content.includes(snippet))

  if (missing.length > 0) {
    throw new Error(`${label} ناقصة: ${missing.join(', ')}`)
  }
}

const ensureAbsentSnippets = (content, snippets, label = 'مقتطفات') => {
  const present = snippets.filter((snippet) => content.includes(snippet))

  if (present.length > 0) {
    throw new Error(`${label} يجب ألا تبقى موجودة: ${present.join(', ')}`)
  }
}

const getNestedValue = (object, dottedPath) => {
  return dottedPath.split('.').reduce((current, key) => current?.[key], object)
}

const parseEnvFile = async (relativePath) => {
  try {
    const content = await readProjectFile(relativePath)
    const env = {}

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue

      const separatorIndex = line.indexOf('=')
      if (separatorIndex === -1) continue

      const key = line.slice(0, separatorIndex).trim()
      const rawValue = line.slice(separatorIndex + 1).trim()
      const cleanedValue = rawValue.replace(/^['"]|['"]$/g, '')

      env[key] = cleanedValue
    }

    return env
  } catch {
    return {}
  }
}

const loadProjectEnv = async () => {
  const envFiles = ['.env', '.env.local', '.env.production']
  const loaded = await Promise.all(envFiles.map((file) => parseEnvFile(file)))
  return Object.assign({}, ...loaded)
}

const getEnvValue = (loadedEnv, key) => {
  return process.env[key] || loadedEnv[key] || ''
}

await runCheck('الملفات النهائية الأساسية موجودة', async () => {
  const requiredFiles = [
    'SUPABASE_FINAL_MIGRATION.sql',
    'supabase/migrations/20260422000014_final_marketplace_features.sql',
    'scripts/full-system-check.mjs',
    'src/App.jsx',
    'src/components/ProtectedRoute.jsx',
    'src/pages/vendor/DigitalContract.jsx',
    'src/services/commissionService.js',
    'src/components/vendor/CommissionDashboard.jsx',
    'src/pages/admin/CommissionManagement.jsx',
    'src/services/driverLocationService.js',
    'src/components/maps/LiveDriverMap.jsx',
    'src/pages/OrderDetail.jsx',
    'src/pages/driver/DeliveryTracking.jsx',
    'src/pages/vendor/FindDriver.jsx',
    'src/pages/driver/FindVendor.jsx',
    'src/components/shared/PartnershipRequests.jsx',
    'src/i18n/locales/ar.json',
    'src/i18n/locales/en.json',
    'src/i18n/locales/fr.json',
  ]

  const missing = await getMissingFiles(requiredFiles)
  if (missing.length > 0) {
    throw new Error(`ملفات مفقودة: ${missing.join(', ')}`)
  }

  return `${requiredFiles.length} ملفات مؤكدة`
})

await runCheck('الهجرة النهائية تغطي العمولات والعقد والتتبع والشراكات', async () => {
  const migrationFiles = [
    'SUPABASE_FINAL_MIGRATION.sql',
    'supabase/migrations/20260422000014_final_marketplace_features.sql',
  ]

  const requiredSnippets = [
    'vendor_contracts (',
    'vendor_monthly_sales (',
    'confirmed_transactions (',
    'partnership_requests (',
    'driver_location_history (',
    'driver_broadcast_events (',
    'add column if not exists payment_received_at',
    'add column if not exists recorded_at',
    'status::text',
  ]

  for (const file of migrationFiles) {
    const content = (await readProjectFile(file)).toLowerCase()
    ensureSnippets(content, requiredSnippets, `الهجرة ${file}`)
  }

  return 'ملفا الهجرة يحتويان نقاط الحسم المطلوبة'
})

await runCheck('المسارات النهائية مربوطة في App.jsx', async () => {
  const content = await readProjectFile('src/App.jsx')

  ensureSnippets(content, [
    'path="find-driver"',
    'path="digital-contract"',
    'path="find-vendor"',
    'path="delivery/:id/tracking"',
    'path="commissions"',
  ], 'مسارات التطبيق')

  return 'مسارات العقد والعمولات والشراكة والتتبع مسجلة'
})

await runCheck('بوابة البائع تعتمد agreement_accepted الصحيح', async () => {
  const content = await readProjectFile('src/components/ProtectedRoute.jsx')

  ensureSnippets(content, [
    'const hasAcceptedContract = Boolean(profile?.agreement_accepted)',
    '<Navigate to="/vendor/digital-contract" replace />',
  ], 'حماية لوحة البائع')
  ensureAbsentSnippets(content, ['vendor_agreement_accepted'], 'الاسم القديم للحقل')

  return 'تم تأكيد استخدام agreement_accepted فقط في حماية البائع'
})

await runCheck('صفحة العقد الرقمي تزامن الحالة محلياً وفي قاعدة البيانات', async () => {
  const content = await readProjectFile('src/pages/vendor/DigitalContract.jsx')

  ensureSnippets(content, [
    'useAuthStore.setState',
    'agreement_accepted: true',
    'agreement_accepted_at: nowIso',
    "agreed_commission_rate: 0.03",
    "contract_version: 'v1.0'",
  ], 'العقد الرقمي')

  return 'تفعيل العقد يحدث في الواجهة والملف الشخصي مع نسبة 3%'
})

await runCheck('خدمة العمولات تطبق دورة 3% الكاملة', async () => {
  const content = await readProjectFile('src/services/commissionService.js')

  ensureSnippets(content, [
    'const COMMISSION_RATE = 0.03',
    'async confirmSaleAndCalculate(orderId, vendorId, saleAmount)',
    'async closeMonthAndNotify()',
    'async checkOverdueCommissions()',
    'async submitPaymentNotice(vendorId, monthlySaleId, paymentMethod, paymentReference, note = \'\')',
    'async confirmCommissionPayment(vendorId, month, year, paymentMethod, paymentReference)',
    'async getCurrentMonthSummary(vendorId)',
    'async manuallyUnfreezeVendor(vendorId, monthlySaleId, note, graceDays = MANUAL_UNFREEZE_GRACE_DAYS)',
    'export const submitPaymentNotice = (...args) => commissionService.submitPaymentNotice(...args)',
    'export const manuallyUnfreezeVendor = (...args) => commissionService.manuallyUnfreezeVendor(...args)',
  ], 'خدمة العمولات')

  return 'خدمة العمولات تغطي البيع المؤكد والإشعار والدفع ورفع التجميد'
})

await runCheck('لوحة البائع تعرض ملفات العمولة المفتوحة والإشعار بالدفع', async () => {
  const content = await readProjectFile('src/components/vendor/CommissionDashboard.jsx')

  ensureSnippets(content, [
    'const previousMonths = useMemo',
    'const openInvoice = useMemo',
    'const activeInvoice = selectedInvoice || openInvoice',
    'const handleSubmitPaymentNotice = async () => {',
    'commissionService.submitPaymentNotice(',
    'balance_remaining',
    'marketplaceFeatures.commissionDashboard.title',
  ], 'لوحة عمولات البائع')

  return 'اللوحة تعرض التراكم الحالي والفترات السابقة وإشعار الدفع'
})

await runCheck('لوحة الإدارة تدعم التصفية والتأكيد والتصدير ورفع التجميد', async () => {
  const content = await readProjectFile('src/pages/admin/CommissionManagement.jsx')

  ensureSnippets(content, [
    'import { csvExport } from \'@/services/reports/csvExport\'',
    "city: 'all'",
    'commissionService.confirmCommissionPayment(',
    'commissionService.manuallyUnfreezeVendor(',
    'const handleExportCSV = () => {',
    'payment_reference',
    'vendor?.city',
  ], 'لوحة إدارة العمولات')

  return 'لوحة الإدارة تغطي الفلاتر والدفعات والتصدير ورفع التجميد'
})

await runCheck('خدمة الموقع الحي تدعم التتبع حسب السائق أو الطلب أو التوصيل', async () => {
  const content = await readProjectFile('src/services/driverLocationService.js')

  ensureSnippets(content, [
    'async getCurrentTrackedLocation({ driverId = null, deliveryId = null, orderId = null })',
    'subscribeToTrackedLocation({ driverId = null, deliveryId = null, orderId = null }, callback)',
    'async startBrowserTracking({',
    'stopBrowserTracking({',
    'this.stopBrowserTracking({ driverId, deliveryId, orderId, suppressStateChange: true })',
  ], 'خدمة الموقع الحي')

  return 'خدمة الموقع تدعم التتبع العام والبث من المتصفح للتوصيل الذاتي'
})

await runCheck('الخريطة الحية المشتركة تدعم orderId و deliveryId وتنبيه الخمول', async () => {
  const content = await readProjectFile('src/components/maps/LiveDriverMap.jsx')

  ensureSnippets(content, [
    'orderId = null',
    'deliveryId = null',
    'staleAfterMs = 45000',
    'driverLocationService.subscribeToTrackedLocation',
    'location?.lastUpdated',
  ], 'الخريطة الحية المشتركة')

  return 'الخريطة الحية تعرض التتبع حسب الطلب أو التوصيل وتكشف التحديثات القديمة'
})

await runCheck('تفاصيل الطلب تحفظ الدفع وتدمج الخريطة والبث الذاتي', async () => {
  const content = await readProjectFile('src/pages/OrderDetail.jsx')

  ensureSnippets(content, [
    "import LiveDriverMap from '@/components/maps/LiveDriverMap'",
    "nextOrderPayload.status = 'payment_received'",
    'const handleStartSelfDeliveryTracking = async () => {',
    "const handleStopSelfDeliveryTracking = async (eventType = 'paused') => {",
    "const routeAndTrackingStatuses = ['confirmed', 'preparing', 'payment_received'",
    '<LiveDriverMap',
  ], 'تفاصيل الطلب')

  if (
    !content.includes('payment_received_at: new Date().toISOString()') &&
    !content.includes('nextOrderPayload.payment_received_at = new Date().toISOString()')
  ) {
    throw new Error('تفاصيل الطلب ناقصة: payment_received_at: new Date().toISOString()')
  }

  return 'تفاصيل الطلب تحافظ على مسار التسليم وتعرض التتبع الحي والبث الذاتي'
})

await runCheck('صفحة تتبع السائق تستخدم الخريطة المشتركة بالطلب والتوصيل', async () => {
  const content = await readProjectFile('src/pages/driver/DeliveryTracking.jsx')

  ensureSnippets(content, [
    "import LiveDriverMap from '@/components/maps/LiveDriverMap'",
    '<LiveDriverMap',
    'driverId={user?.id}',
    'orderId={delivery?.order?.id || delivery?.order_id || null}',
    'deliveryId={id}',
  ], 'تتبع السائق')

  return 'صفحة السائق تستخدم نفس الخريطة الحية مع تعريف الطلب والتوصيل'
})

await runCheck('صفحات البحث عن شريك تدعم الرسالة القابلة للتحرير وحالة الطلبات', async () => {
  const files = [
    'src/pages/vendor/FindDriver.jsx',
    'src/pages/driver/FindVendor.jsx',
  ]

  for (const file of files) {
    const content = await readProjectFile(file)
    ensureSnippets(content, [
      "import PartnershipRequests from '@/components/shared/PartnershipRequests'",
      "import { Card, LoadingSpinner, Modal } from '@/components/ui'",
      'const [outgoingRequests, setOutgoingRequests] = useState([])',
      'const [incomingRequests, setIncomingRequests] = useState([])',
      'const [requestMessage, setRequestMessage] = useState(\'\')',
      'const openRequestModal = (',
      '<PartnershipRequests',
      '<Modal',
    ], `صفحة البحث ${file}`)
  }

  return 'صفحتا البحث تدعمان الرسائل القابلة للتحرير وإدارة الطلبات داخل الصفحة'
})

await runCheck('لوحة طلبات الشراكة ترتب المعلّق أولاً وتدعم التحديث', async () => {
  const content = await readProjectFile('src/components/shared/PartnershipRequests.jsx')

  ensureSnippets(content, [
    'const loadRequests = useCallback(async () => {',
    "if (left.status === 'pending' && right.status !== 'pending') return -1",
    'onClick={loadRequests}',
    'responded_at || request.created_at',
    'await partnershipService.cancelRequest(requestId, currentUserId)',
    'await partnershipService.respondToRequest(requestId, currentUserId, status)',
  ], 'لوحة طلبات الشراكة')

  return 'الطلبات الواردة والصادرة قابلة للتحديث والترتيب والمعالجة من نفس اللوحة'
})

await runCheck('ملفات الترجمة الأساسية متسقة مع نسبة 3% والتتبع الجديد', async () => {
  const locales = {
    ar: JSON.parse(await readProjectFile('src/i18n/locales/ar.json')),
    en: JSON.parse(await readProjectFile('src/i18n/locales/en.json')),
    fr: JSON.parse(await readProjectFile('src/i18n/locales/fr.json')),
  }

  const includeChecks = [
    { path: 'admin.commissions.subtitle', expected: '3%' },
    { path: 'admin.commissions.commission', expected: '3%' },
    { path: 'orderDetail.platformFee', expected: '3%' },
    { path: 'orderDetail.vendorCommission', expected: '3%' },
  ]

  for (const [locale, messages] of Object.entries(locales)) {
    for (const check of includeChecks) {
      const value = getNestedValue(messages, check.path)
      if (typeof value !== 'string' || !value.includes(check.expected)) {
        throw new Error(`الترجمة ${locale}.${check.path} لا تحتوي ${check.expected}`)
      }
    }

    const liveMapLabel = getNestedValue(messages, 'driver.tracking.liveMap')
    const paymentReceivedLabel = getNestedValue(messages, 'orderDetail.status.payment_received')

    if (typeof liveMapLabel !== 'string' || !liveMapLabel.trim()) {
      throw new Error(`الترجمة ${locale}.driver.tracking.liveMap مفقودة أو فارغة`)
    }

    if (typeof paymentReceivedLabel !== 'string' || !paymentReceivedLabel.trim()) {
      throw new Error(`الترجمة ${locale}.orderDetail.status.payment_received مفقودة أو فارغة`)
    }
  }

  return 'ملفات AR/EN/FR الأساسية متوافقة مع عمولة 3% وحالة الدفع والخريطة الحية'
})

const loadedEnv = await loadProjectEnv()
const supabaseUrl = getEnvValue(loadedEnv, 'SUPABASE_URL') || getEnvValue(loadedEnv, 'VITE_SUPABASE_URL')
const serviceRoleKey = getEnvValue(loadedEnv, 'SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !serviceRoleKey || serviceRoleKey.includes('your-supabase-service-role-key')) {
  runSkippedCheck(
    'فحص قاعدة البيانات النهائية',
    'تم تخطيه لعدم توفر SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY صالحين في البيئة'
  )
} else {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  await runCheck('الجداول والأعمدة النهائية متاحة في Supabase', async () => {
    const results = await Promise.all([
      supabase.from('profiles').select('agreement_accepted, agreement_accepted_at, is_active').limit(1),
      supabase.from('orders').select('payment_received_at, payment_received_amount, preferred_driver_id, preferred_driver_status').limit(1),
      supabase.from('vendor_contracts').select('agreed_commission_rate, agreed_payment_deadline, device_fingerprint').limit(1),
      supabase.from('vendor_monthly_sales').select('commission_due, commission_paid, payment_method, payment_reference, due_date, status').limit(1),
      supabase.from('confirmed_transactions').select('order_id, vendor_id, buyer_id, commission_amount, confirmed_at').limit(1),
      supabase.from('partnership_requests').select('requester_id, target_id, status, responded_at').limit(1),
      supabase.from('driver_locations').select('delivery_id, order_id, vendor_id, buyer_id, broadcast_status, recorded_at').limit(1),
      supabase.from('driver_location_history').select('driver_id, delivery_id, order_id, recorded_at').limit(1),
      supabase.from('driver_broadcast_events').select('driver_id, delivery_id, order_id, event_type').limit(1),
    ])

    const failed = results.find((result) => result.error)
    if (failed?.error) {
      throw failed.error
    }

    return 'تمت قراءة الجداول النهائية المطلوبة وأعمدتها الأساسية بنجاح'
  })
}

console.log('\n=== تقرير التحقق النهائي ===')
for (const check of checks) {
  const icon = check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : '⏭️'
  console.log(`${icon} ${check.name}`)
  console.log(`   ${check.details}`)
}

const passedCount = checks.filter((check) => check.status === 'PASS').length
const failedCount = checks.filter((check) => check.status === 'FAIL').length
const skippedCount = checks.filter((check) => check.status === 'SKIP').length

console.log('\nالملخص:')
console.log(`- نجح: ${passedCount}`)
console.log(`- فشل: ${failedCount}`)
console.log(`- تم تخطيه: ${skippedCount}`)

if (failedCount > 0) {
  process.exit(1)
}