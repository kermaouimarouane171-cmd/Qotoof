/* global process */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const REQUIRED_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SENTRY_DSN',
  'RESEND_API_KEY',
  'VITE_GOOGLE_MAPS_KEY',
  'VITE_APP_NAME',
  'VITE_SUPPORT_EMAIL',
  'VITE_SUPPORT_PHONE',
  'VITE_COMMISSION_RATE',
  'VITE_DELIVERY_BASE_FEE',
  'VITE_DELIVERY_PER_KM_FEE',
]

const REQUIRED_TABLES = [
  'profiles',
  'products',
  'orders',
  'order_items',
  'notifications',
  'notification_preferences',
  'vendor_monthly_sales',
  'confirmed_transactions',
  'vendor_contracts',
  'commission_notifications',
  'driver_locations',
  'delivery_schedules',
  'partnership_requests',
  'payment_disputes',
  'payment_terms_acceptance',
  'product_condition_photos',
  'fraud_reports',
  'store_evolution_log',
  'cancellation_policies',
  'cancellation_log',
  'refund_policies',
  'loyalty_points',
  'loyalty_transactions',
  'referrals',
  'stock_movements',
  'restock_waitlist',
  'reviews',
  'invoices',
  'discounts',
  'support_tickets',
  'phone_otp',
  'user_activity_log',
  'active_sessions',
  'return_requests',
]

const TABLE_ALIASES = {
  store_evolution_log: ['store_type_evolution_log'],
  delivery_schedules: ['vendor_delivery_slots', 'vendor_schedules'],
  cancellation_policies: ['vendor_cancellation_policies'],
  stock_movements: ['stock_history'],
  restock_waitlist: ['product_waitlists'],
  discounts: ['coupons'],
}

const REQUIRED_RLS_TABLES = [
  'vendor_monthly_sales',
  'confirmed_transactions',
  'vendor_contracts',
  'commission_notifications',
  'payment_disputes',
  'payment_terms_acceptance',
  'refund_policies',
  'support_tickets',
  'phone_otp',
  'user_activity_log',
  'active_sessions',
]

const REQUIRED_TRIGGERS = [
  {
    label: 'trigger_update_store_type',
    patterns: [
      /trigger_update_store_type/i,
      /trg_refresh_vendor_store_type_after_product_change/i,
      /refresh_vendor_store_type_after_product_change/i,
      /refresh_vendor_store_type\s*\(/i,
    ],
  },
  {
    label: 'trigger_decrease_stock',
    patterns: [
      /trigger_decrease_stock/i,
      /log_product_stock_change/i,
      /log_stock_change\s*\(/i,
    ],
  },
  {
    label: 'close_month_commissions',
    patterns: [/close_month_commissions/i],
  },
  {
    label: 'freeze_overdue_vendors',
    patterns: [/freeze_overdue_vendors/i],
  },
  {
    label: 'update_trust_score',
    patterns: [/update_trust_score/i],
  },
  {
    label: 'generate_invoice_number',
    patterns: [/generate_invoice_number/i],
  },
]

const REQUIRED_INDEXES = [
  { label: 'orders(buyer_id)', patterns: [/on\s+orders\s*\(buyer_id/i] },
  { label: 'orders(vendor_id)', patterns: [/on\s+orders\s*\(vendor_id/i] },
  { label: 'orders(driver_id)', patterns: [/on\s+orders\s*\(driver_id/i] },
  { label: 'orders(status)', patterns: [/on\s+orders\s*\(status/i] },
  { label: 'products(vendor_id)', patterns: [/on\s+products\s*\(vendor_id/i] },
  { label: 'products(is_active)', patterns: [/on\s+products\s*\((?:is_active|is_available)/i] },
  { label: 'driver_locations(order_id, recorded_at)', patterns: [/on\s+driver_locations\s*\(order_id,\s*recorded_at/i] },
  { label: 'notifications(user_id, is_read)', patterns: [/on\s+notifications\s*\(user_id,\s*is_read/i, /on\s+notifications\s*\(user_id,\s*read_at/i] },
  { label: 'vendor_monthly_sales(vendor_id, month, year)', patterns: [/on\s+vendor_monthly_sales\s*\(vendor_id,\s*year,\s*month/i, /on\s+vendor_monthly_sales\s*\(vendor_id,\s*month,\s*year/i] },
]

const REQUIRED_LEGAL_FILES = [
  'src/pages/Terms.jsx',
  'src/pages/Privacy.jsx',
  'src/pages/Contact.jsx',
  'src/layouts/MainLayout.jsx',
]

const PLACEHOLDER_PATTERNS = [
  /test@/i,
  /example@/i,
  /demo@/i,
  /john doe/i,
  /test user/i,
  /0600000000/,
  /0612345678/,
  /example\.com/i,
  /yourdomain\.com/i,
  /your-project/i,
  /your_[a-z0-9_]+/i,
  /your-[a-z0-9-]+/i,
  /company_name/i,
  /your_name/i,
]

const OFFICIAL_EMAIL = 'Qotoof273@gmail.com'
const OFFICIAL_PHONE = '+212674841248'
const OFFICIAL_PHONE_DISPLAY = '+212 674 841 248'

const report = []

const addLine = (line = '') => report.push(line)

const walk = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath))
    } else {
      files.push(fullPath)
    }
  }

  return files
}

const readFileSafe = async (relativePath) => {
  try {
    return await fs.readFile(path.join(projectRoot, relativePath), 'utf8')
  } catch {
    return ''
  }
}

const parseEnv = async (relativePath) => {
  const content = await readFileSafe(relativePath)
  const env = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const separator = trimmed.indexOf('=')
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    env[key] = value
  }

  return env
}

const mergeEnv = async () => {
  const envFiles = ['.env', '.env.local', '.env.production', '.env.example']
  const values = await Promise.all(envFiles.map(parseEnv))
  return Object.assign({}, ...values)
}

const isPlaceholderValue = (value) => {
  if (!value) return true
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))
}

const hasAnyPattern = (content, patterns) => patterns.some((pattern) => pattern.test(content))

const stripSqlComments = (content) => content
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^\s*--.*$/gm, ' ')

const sanitizeContentForPlaceholderScan = (file, content) => {
  if (file.endsWith('.sql')) return stripSqlComments(content)
  return content
}

const formatStatus = (pass, message) => `${pass ? '✅' : '❌'} ${message}`

const sqlFiles = async () => {
  const files = await walk(projectRoot)
  return files.filter((file) => file.endsWith('.sql'))
}

const buildSqlCorpus = async () => {
  const files = await sqlFiles()
  const contents = await Promise.all(files.map((file) => fs.readFile(file, 'utf8')))
  return contents.join('\n\n').toLowerCase()
}

const tableExistsInSql = (tableName, corpus) => {
  const aliases = TABLE_ALIASES[tableName] || []
  const names = [tableName, ...aliases]
  return names.some((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:create table(?: if not exists)?|alter table|on)\\s+${escaped}\\b`, 'i').test(corpus)
      || new RegExp(`\\b${escaped}\\b`, 'i').test(corpus)
  })
}

const rlsEnabledInSql = (tableName, corpus) => {
  const aliases = TABLE_ALIASES[tableName] || []
  const names = [tableName, ...aliases]
  return names.some((name) => new RegExp(`alter table\\s+${name}\\s+enable row level security`, 'i').test(corpus))
}

const policyExistsInSql = (tableName, corpus) => {
  const aliases = TABLE_ALIASES[tableName] || []
  const names = [tableName, ...aliases]
  return names.some((name) => new RegExp(`create policy[\\s\\S]{0,200}?on\\s+${name}\\b`, 'i').test(corpus))
}

const main = async () => {
  const today = new Intl.DateTimeFormat('ar-MA', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date())

  const env = await mergeEnv()
  const sqlCorpus = await buildSqlCorpus()
  const allFiles = await walk(projectRoot)
  const scannedFiles = allFiles.filter((file) => /\.(js|jsx|ts|tsx|json|html|mjs|sql|md)$/.test(file) || file.endsWith('.env') || file.endsWith('.env.example'))
  const runtimeFiles = scannedFiles.filter((file) => {
    const relative = path.relative(projectRoot, file)
    if (file.endsWith('.md') || file.endsWith('.eslint-current.json') || file.endsWith('.env.example')) return false
    if (relative === '.env' || relative === '.env.local' || relative === '.env.production') return false
    if (relative.startsWith('cypress/')) return false
    if (relative.includes('/__tests__/')) return false
    if (relative.startsWith('coverage/')) return false
    if (relative === 'scripts/final-launch-check.mjs' || relative === 'scripts/full-system-check.mjs') return false
    if (['create-test-accounts.js', 'fix-cin.js', 'diagnose-profiles.js'].includes(relative)) return false
    if (relative.startsWith('database/seed')) return false
    return true
  })
  const scannedContents = await Promise.all(scannedFiles.map((file) => fs.readFile(file, 'utf8').catch(() => '')))
  const runtimeContents = await Promise.all(runtimeFiles.map((file) => fs.readFile(file, 'utf8').catch(() => '')))
  const joinedScanned = runtimeContents.join('\n')

  addLine('══════════════════════════════════════════')
  addLine('🔍 Qotoof — فحص الإطلاق النهائي')
  addLine(`التاريخ: ${today}`)
  addLine('══════════════════════════════════════════')
  addLine('')

  const foundTables = REQUIRED_TABLES.filter((table) => tableExistsInSql(table, sqlCorpus))
  const missingTables = REQUIRED_TABLES.filter((table) => !foundTables.includes(table))
  const rlsTables = REQUIRED_RLS_TABLES.filter((table) => rlsEnabledInSql(table, sqlCorpus) && policyExistsInSql(table, sqlCorpus))
  const triggerHits = REQUIRED_TRIGGERS.filter((entry) => hasAnyPattern(sqlCorpus, entry.patterns))
  const missingTriggers = REQUIRED_TRIGGERS
    .filter((entry) => !triggerHits.includes(entry))
    .map((entry) => entry.label)
  const indexHits = REQUIRED_INDEXES.filter((entry) => hasAnyPattern(sqlCorpus, entry.patterns))

  addLine('قاعدة البيانات:')
  addLine(formatStatus(foundTables.length === REQUIRED_TABLES.length, `الجداول (${foundTables.length}/${REQUIRED_TABLES.length} موجودة)`))
  addLine(formatStatus(rlsTables.length === REQUIRED_RLS_TABLES.length, `RLS مفعّل على الجداول المطلوبة (${rlsTables.length}/${REQUIRED_RLS_TABLES.length})`))
  addLine(formatStatus(triggerHits.length === REQUIRED_TRIGGERS.length, `Triggers المطلوبة (${triggerHits.length}/${REQUIRED_TRIGGERS.length})`))
  addLine(formatStatus(indexHits.length === REQUIRED_INDEXES.length, `Indexes المطلوبة (${indexHits.length}/${REQUIRED_INDEXES.length})`))
  if (missingTables.length > 0) addLine(`المفقود من الجداول: ${missingTables.join('، ')}`)
  if (missingTriggers.length > 0) addLine(`المفقود من التريغرز/الدوال: ${missingTriggers.join('، ')}`)
  addLine('')

  const officialEmailPresent = joinedScanned.includes(OFFICIAL_EMAIL)
  const officialPhonePresent = joinedScanned.includes(OFFICIAL_PHONE) || joinedScanned.includes(OFFICIAL_PHONE_DISPLAY)
  const runtimePlaceholderMatches = runtimeFiles.filter((file, index) => {
    const content = sanitizeContentForPlaceholderScan(file, runtimeContents[index])
    return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(content))
  })
  const docPlaceholderMatches = scannedFiles
    .filter((file) => file.endsWith('.md') || file.endsWith('.eslint-current.json'))
    .filter((file, index) => {
      const contentIndex = scannedFiles.indexOf(file)
      const content = sanitizeContentForPlaceholderScan(file, scannedContents[contentIndex])
      return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(content))
    })

  addLine('البيانات الحقيقية:')
  addLine(formatStatus(officialEmailPresent, 'الإيميل الحقيقي مضبوط'))
  addLine(formatStatus(officialPhonePresent, 'رقم الهاتف الحقيقي مضبوط'))
  addLine(formatStatus(runtimePlaceholderMatches.length === 0, 'لا توجد بيانات وهمية في الملفات التشغيلية'))
  addLine('')

  const firebaseJson = await readFileSafe('firebase.json')
  const viteConfig = await readFileSafe('vite.config.js')
  const otpPresent = /phone_otp|verify_otp|otp/i.test(sqlCorpus) && /phone_otp/i.test(joinedScanned)
  const headersReady = ['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options'].every((header) => firebaseJson.includes(header) || viteConfig.includes(header))

  addLine('الأمان:')
  addLine(formatStatus(rlsTables.length === REQUIRED_RLS_TABLES.length, 'RLS على الجداول المطلوبة'))
  addLine(formatStatus(headersReady, 'Security Headers مضبوطة'))
  addLine(formatStatus(otpPresent, 'OTP موجود في المخطط والكود'))
  addLine('')

  const notificationCode = await readFileSafe('src/hooks/queries/useNotificationQueries.js')
  const emailFunction = await readFileSafe('supabase/functions/send-email/index.ts')
  const smsFunction = await readFileSafe('supabase/functions/send-sms/index.ts')

  addLine('الإشعارات:')
  addLine(formatStatus(/from\('notifications'\)/.test(notificationCode), 'إشعارات داخلية'))
  addLine(formatStatus(/send-sms|sms/i.test(smsFunction), 'SMS'))
  addLine(formatStatus(/resend|send-email|mailersend/i.test(emailFunction), 'إيميل'))
  addLine('')

  const arLocale = await readFileSafe('src/i18n/locales/ar.json')
  const frLocale = await readFileSafe('src/i18n/locales/fr.json')
  const enLocale = await readFileSafe('src/i18n/locales/en.json')
  const translationChecks = [
    { label: 'العربية كاملة', content: arLocale },
    { label: 'الفرنسية كاملة', content: frLocale },
    { label: 'الإنجليزية كاملة', content: enLocale },
  ]

  addLine('الترجمات:')
  for (const item of translationChecks) {
    addLine(formatStatus(item.content.includes(OFFICIAL_EMAIL) && (item.content.includes(OFFICIAL_PHONE_DISPLAY) || item.content.includes(OFFICIAL_PHONE)), item.label))
  }
  addLine('')

  const legalFiles = await Promise.all(REQUIRED_LEGAL_FILES.map(readFileSafe))
  const termsReady = (legalFiles[0].includes(OFFICIAL_EMAIL) || legalFiles[0].includes('APP_CONFIG.supportEmail'))
    && (legalFiles[0].includes('3%') || legalFiles[0].includes('3% commission'))
    && /Casablanca|الدار البيضاء/i.test(legalFiles[0])
  const privacyReady = (legalFiles[1].includes(OFFICIAL_EMAIL) || legalFiles[1].includes('APP_CONFIG.supportEmail'))
    && /09-08|law and legal support|القانون المغربي/i.test(legalFiles[1])
  const contactReady = (legalFiles[2].includes(OFFICIAL_EMAIL) || legalFiles[2].includes('APP_CONFIG.supportEmail'))
    && (legalFiles[2].includes(OFFICIAL_PHONE_DISPLAY) || legalFiles[2].includes('APP_CONFIG.supportPhoneDisplay'))
  addLine('الصفحات القانونية:')
  addLine(formatStatus(termsReady, 'Terms مكتملة'))
  addLine(formatStatus(privacyReady, 'Privacy مكتملة'))
  addLine(formatStatus(contactReady, 'Contact بيانات حقيقية'))
  addLine('')

  const envPass = REQUIRED_ENV_KEYS.every((key) => {
    if (!(key in env)) return false
    if (key === 'VITE_APP_NAME') return env[key] === 'Qotoof'
    if (key === 'VITE_SUPPORT_EMAIL') return env[key] === OFFICIAL_EMAIL
    if (key === 'VITE_SUPPORT_PHONE') return env[key] === OFFICIAL_PHONE
    if (['VITE_COMMISSION_RATE', 'VITE_DELIVERY_BASE_FEE', 'VITE_DELIVERY_PER_KM_FEE'].includes(key)) return Boolean(env[key])
    return !isPlaceholderValue(env[key])
  })

  addLine('متغيرات البيئة:')
  addLine(formatStatus(envPass, 'كل المتغيرات موجودة'))
  addLine('')
  addLine('══════════════════════════════════════════')

  const criticalIssues = []
  if (foundTables.length !== REQUIRED_TABLES.length) criticalIssues.push('نقص في الجداول المطلوبة')
  if (rlsTables.length !== REQUIRED_RLS_TABLES.length) criticalIssues.push('RLS غير مكتمل')
  if (runtimePlaceholderMatches.length > 0) criticalIssues.push('ما زالت توجد placeholders في الملفات التشغيلية')
  if (!envPass) criticalIssues.push('متغيرات البيئة غير مكتملة او ما زالت placeholder')
  if (!headersReady) criticalIssues.push('Security headers غير مكتملة')

  addLine('النتيجة الإجمالية:')
  if (criticalIssues.length === 0) {
    addLine('✅ جاهز للإطلاق')
  } else {
    addLine(`❌ ${criticalIssues.length} مشكلة حرجة تمنع الإطلاق`)
    addLine(`الأسباب: ${criticalIssues.join('، ')}`)
  }
  addLine('══════════════════════════════════════════')

  if (runtimePlaceholderMatches.length > 0) {
    addLine('')
    addLine('ملفات تشغيلية تحتاج تنظيف placeholders:')
    for (const file of runtimePlaceholderMatches.slice(0, 20)) {
      addLine(`- ${path.relative(projectRoot, file)}`)
    }
  }

  if (docPlaceholderMatches.length > 0) {
    addLine('')
    addLine('ملفات توثيق ما زالت تحتوي أمثلة أو placeholders:')
    for (const file of docPlaceholderMatches.slice(0, 20)) {
      addLine(`- ${path.relative(projectRoot, file)}`)
    }
  }

  console.log(report.join('\n'))

  if (criticalIssues.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('❌ فشل تشغيل فحص الإطلاق النهائي')
  console.error(error)
  process.exit(1)
})