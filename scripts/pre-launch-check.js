#!/usr/bin/env node
/**
 * فاحص جاهزية ما قبل الإطلاق لتطبيق Qotoof.
 * يفحص Supabase والبيانات الأساسية ومتغيرات البيئة واتصال Resend.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = process.cwd()
const envPath = resolve(root, '.env')

const parseEnvFile = (path) => {
  if (!existsSync(path)) return {}

  const raw = readFileSync(path, 'utf-8')
  const map = {}

  raw.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const idx = trimmed.indexOf('=')
    if (idx === -1) return

    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    map[key] = value
  })

  return map
}

const envFile = parseEnvFile(envPath)
const env = {
  ...envFile,
  ...process.env,
}

const printResult = (label, status, details = '') => {
  const icon = status === 'ok' ? '✅' : status === 'warn' ? '⚠️' : '❌'
  const msg = details ? ` - ${details}` : ''
  console.log(`${icon} ${label}${msg}`)
}

const hasColumn = async (supabase, table, column) => {
  const { error } = await supabase.from(table).select(column).limit(1)
  if (!error) return true
  if (String(error.message || '').toLowerCase().includes('column')) return false
  return false
}

const requiredEnv = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'RESEND_API_KEY',
]

const run = async () => {
  console.log('')
  console.log('==================================================')
  console.log('🚀 فحص جاهزية ما قبل الإطلاق - Qotoof Marketplace')
  console.log('==================================================')
  console.log('')

  // 1) Environment variables
  let envOk = true
  for (const key of requiredEnv) {
    if (env[key]) {
      printResult(`متغير البيئة ${key}`, 'ok')
    } else {
      envOk = false
      printResult(`متغير البيئة ${key}`, 'error', 'غير موجود')
    }
  }

  const supabaseUrl = env.VITE_SUPABASE_URL
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('')
    console.log('❌ لا يمكن إكمال الفحص بدون إعدادات Supabase الأساسية.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // 2) Supabase connectivity
  try {
    const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' }).limit(1)
    if (error) throw error
    printResult('الاتصال بـ Supabase', 'ok')
  } catch (error) {
    printResult('الاتصال بـ Supabase', 'error', error.message)
  }

  // 3) Active vendors >= 10
  try {
    const hasIsActive = await hasColumn(supabase, 'profiles', 'is_active')

    let query = supabase
      .from('profiles')
      .select('id', { head: true, count: 'exact' })
      .eq('role', 'vendor')
      .eq('verification_status', 'verified')

    if (hasIsActive) {
      query = query.eq('is_active', true)
    }

    const { count, error } = await query

    if (error) throw error
    if ((count || 0) >= 10) {
      printResult('وجود 10+ بائعين نشطين', 'ok', `${count} بائع`) 
    } else {
      printResult('وجود 10+ بائعين نشطين', 'warn', `المتوفر حالياً: ${count || 0}`)
    }
  } catch (error) {
    printResult('وجود 10+ بائعين نشطين', 'error', error.message)
  }

  // 4) Active drivers >= 10
  try {
    const hasIsActive = await hasColumn(supabase, 'profiles', 'is_active')

    let query = supabase
      .from('profiles')
      .select('id', { head: true, count: 'exact' })
      .eq('role', 'driver')
      .eq('verification_status', 'verified')

    if (hasIsActive) {
      query = query.eq('is_active', true)
    }

    const { count, error } = await query

    if (error) throw error
    if ((count || 0) >= 10) {
      printResult('وجود 10+ سائقين نشطين', 'ok', `${count} سائق`)
    } else {
      printResult('وجود 10+ سائقين نشطين', 'warn', `المتوفر حالياً: ${count || 0}`)
    }
  } catch (error) {
    printResult('وجود 10+ سائقين نشطين', 'error', error.message)
  }

  // 5) 19 products with non-unsplash images
  try {
    const hasImageUrl = await hasColumn(supabase, 'products', 'image_url')
    let validCount = 0

    if (hasImageUrl) {
      const { data, error } = await supabase
        .from('products')
        .select('id, image_url')

      if (error) throw error
      validCount = (data || []).filter((p) => p.image_url && !String(p.image_url).includes('unsplash.com')).length
    } else {
      const { data, error } = await supabase
        .from('product_images')
        .select('product_id, url')
        .eq('is_primary', true)

      if (error) throw error

      const unique = new Set(
        (data || [])
          .filter((img) => img.url && !String(img.url).includes('unsplash.com'))
          .map((img) => img.product_id),
      )
      validCount = unique.size
    }

    if (validCount >= 19) {
      printResult('وجود 19 منتج بصور غير Unsplash', 'ok', `${validCount} منتج مطابق`)
    } else {
      printResult('وجود 19 منتج بصور غير Unsplash', 'warn', `المطابق حالياً: ${validCount}`)
    }
  } catch (error) {
    printResult('وجود 19 منتج بصور غير Unsplash', 'error', error.message)
  }

  // 6) New columns existence
  try {
    const requiredColumns = [
      ['orders', 'shipping_latitude'],
      ['orders', 'shipping_longitude'],
      ['orders', 'vendor_latitude'],
      ['orders', 'vendor_longitude'],
      ['profiles', 'latitude'],
      ['profiles', 'longitude'],
      ['profiles', 'store_address'],
    ]

    const missing = []
    for (const [table, col] of requiredColumns) {
      const exists = await hasColumn(supabase, table, col)
      if (!exists) missing.push(`${table}.${col}`)
    }

    if (missing.length === 0) {
      printResult('وجود الأعمدة الجديدة في orders/profiles', 'ok')
    } else {
      printResult('وجود الأعمدة الجديدة في orders/profiles', 'warn', `ناقص: ${missing.join(', ')}`)
    }
  } catch (error) {
    printResult('وجود الأعمدة الجديدة في orders/profiles', 'error', error.message)
  }

  // 7) Resend connectivity
  try {
    if (!env.RESEND_API_KEY) {
      printResult('اتصال Resend API', 'warn', 'المفتاح غير موجود')
    } else {
      const response = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        printResult('اتصال Resend API', 'ok')
      } else {
        printResult('اتصال Resend API', 'warn', `HTTP ${response.status}`)
      }
    }
  } catch (error) {
    printResult('اتصال Resend API', 'error', error.message)
  }

  console.log('')
  printResult('فحص متغيرات البيئة الأساسية', envOk ? 'ok' : 'warn')
  console.log('')
  console.log('انتهى الفحص. راجع العلامات أعلاه قبل الإطلاق النهائي.')
  console.log('')
}

run().catch((error) => {
  console.error('❌ حدث خطأ أثناء تشغيل الفحص:', error)
  process.exit(1)
})
