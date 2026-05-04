#!/usr/bin/env node
/* global console, process */

/**
 * فحص ما قبل النشر على Vercel
 * شغّله قبل كل deploy:
 * node scripts/pre-deploy-check.mjs
 */

import { readFileSync, existsSync } from 'fs'

const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'

let errors   = 0
let warnings = 0

const check = (condition, message, isWarning = false) => {
  if (condition) {
    console.log(`${GREEN}✅${RESET} ${message}`)
  } else {
    if (isWarning) {
      console.log(`${YELLOW}⚠️${RESET}  ${message}`)
      warnings++
    } else {
      console.log(`${RED}❌${RESET} ${message}`)
      errors++
    }
  }
}

console.log(`\n${BOLD}══════════════════════════════════════${RESET}`)
console.log(`${BOLD}🔍 Qotoof — فحص ما قبل النشر${RESET}`)
console.log(`${BOLD}══════════════════════════════════════${RESET}\n`)

// ── فحص الملفات الأساسية ──
console.log(`${BOLD}📁 الملفات الأساسية:${RESET}`)
check(existsSync('vercel.json'),     'vercel.json موجود')
check(existsSync('.env.example'),    '.env.example موجود')
check(existsSync('vite.config.js')
  || existsSync('vite.config.ts'),   'vite.config موجود')
check(existsSync('package.json'),    'package.json موجود')
check(existsSync('index.html'),      'index.html موجود')
check(existsSync('src/main.jsx')
  || existsSync('src/main.tsx'),     'main entry موجود')

// ── فحص .gitignore ──
console.log(`\n${BOLD}🔒 الأمان:${RESET}`)
if (existsSync('.gitignore')) {
  const gitignore = readFileSync('.gitignore', 'utf-8')
  check(gitignore.includes('.env'),
    '.env مُضاف لـ .gitignore')
  check(!existsSync('.env')
    || !readFileSync('.env', 'utf-8')
        .includes('sk_live'),
    'لا توجد مفاتيح Live في .env')
} else {
  check(false, '.gitignore موجود')
}

// ── فحص package.json ──
console.log(`\n${BOLD}📦 Package.json:${RESET}`)
const pkg = JSON.parse(
  readFileSync('package.json', 'utf-8')
)
check(pkg.scripts?.build,
  'build script موجود')
check(pkg.scripts?.dev,
  'dev script موجود')
check(!pkg.dependencies?.['react']
  ?.includes('latest'),
  'React version محددة (لا latest)')

// ── فحص متغيرات البيئة ──
console.log(`\n${BOLD}⚙️  متغيرات البيئة:${RESET}`)
if (existsSync('.env')) {
  const env = readFileSync('.env', 'utf-8')

  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_APP_NAME',
    'VITE_SUPPORT_EMAIL',
    'VITE_SUPPORT_PHONE',
    'RESEND_API_KEY',
    'VITE_COMMISSION_RATE',
    'VITE_DELIVERY_BASE_FEE',
    'VITE_DELIVERY_PER_KM_FEE'
  ]

  const optionalVars = [
    'VITE_PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'VITE_SENTRY_DSN'
  ]

  for (const v of requiredVars) {
    const hasVar = env.includes(v + '=')
    const isEmpty = env.includes(v + '=\n')
      || env.includes(v + '=your_')
      || env.includes(v + '=XXX')
    check(hasVar && !isEmpty,
      `${v} موجود وله قيمة`)
  }

  for (const v of optionalVars) {
    const hasVar = env.includes(v + '=')
    check(hasVar, `${v} موجود`, true)
  }
} else {
  check(false,
    'ملف .env موجود — أنشئه من .env.example')
}

// ── النتيجة النهائية ──
console.log(`\n${BOLD}══════════════════════════════════════${RESET}`)
if (errors === 0 && warnings === 0) {
  console.log(
    `${GREEN}${BOLD}✅ جاهز للنشر على Vercel!${RESET}`
  )
} else if (errors === 0) {
  console.log(
    `${YELLOW}${BOLD}⚠️  جاهز مع ${warnings} تحذير${RESET}`
  )
  console.log(
    `${YELLOW}يمكن النشر لكن راجع التحذيرات${RESET}`
  )
} else {
  console.log(
    `${RED}${BOLD}❌ ${errors} مشكلة تمنع النشر${RESET}`
  )
  console.log(
    `${RED}أصلح المشاكل قبل النشر${RESET}`
  )
}
console.log(
  `${BOLD}══════════════════════════════════════${RESET}\n`
)

process.exit(errors > 0 ? 1 : 0)
