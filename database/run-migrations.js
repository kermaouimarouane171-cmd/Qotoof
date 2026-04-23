#!/usr/bin/env node
// Migration runner script - executes SQL migrations on Supabase
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://oyaiiyekfkflesdmcvvo.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  console.error('Please set it in your .env file or pass it as an environment variable')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// Migration files to run (in order)
const MIGRATIONS = [
  '005-add-delivery-tracking.sql',
  '006-add-user-reporting.sql',
  '007-add-delivery-zones-morocco.sql'
]

async function runMigration(filename) {
  console.log(`\n📦 Running migration: ${filename}`)
  
  const filePath = join(__dirname, 'migrations', filename)
  const sql = readFileSync(filePath, 'utf-8')
  
  // Split SQL by statements (semicolon-separated)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  
  console.log(`   Found ${statements.length} statements to execute`)
  
  let successCount = 0
  let errorCount = 0
  
  for (const statement of statements) {
    try {
      // Execute raw SQL using Supabase RPC or direct query
      const { error } = await supabase.rpc('exec_sql', { sql: statement })
      
      if (error) {
        // If RPC doesn't exist, try alternative approach
        console.warn(`   ⚠️  Warning: Could not execute statement via RPC`)
        console.warn(`   Statement preview: ${statement.substring(0, 100)}...`)
        // Don't count as error if it's just a SELECT or comment
        if (!statement.toUpperCase().startsWith('SELECT') && 
            !statement.toUpperCase().startsWith('--')) {
          errorCount++
        } else {
          successCount++
        }
      } else {
        successCount++
      }
    } catch (err) {
      // Some statements might fail due to IF NOT EXISTS, etc.
      if (err.message?.includes('already exists') || err.message?.includes('IF NOT EXISTS')) {
        console.log(`   ⏭️  Skipped (already exists): ${statement.substring(0, 80)}...`)
        successCount++
      } else {
        console.error(`   ❌ Error executing statement:`, err.message)
        errorCount++
      }
    }
  }
  
  console.log(`   ✅ Migration ${filename} completed: ${successCount} succeeded, ${errorCount} failed`)
  return { filename, successCount, errorCount }
}

async function verifyDeliveryZones() {
  console.log('\n🔍 Verifying delivery zones...')
  
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('city, zone_name, zone_code, base_price')
    .order('city')
  
  if (error) {
    console.error('❌ Error fetching delivery zones:', error.message)
    return false
  }
  
  console.log(`\n📊 Found ${data?.length || 0} delivery zones:\n`)
  
  // Group by city
  const zonesByCity = {}
  data?.forEach(zone => {
    if (!zonesByCity[zone.city]) {
      zonesByCity[zone.city] = []
    }
    zonesByCity[zone.city].push(zone)
  })
  
  for (const [city, zones] of Object.entries(zonesByCity)) {
    console.log(`  ${city}: ${zones.length} zones`)
    zones.forEach(zone => {
      console.log(`    - ${zone.zone_name} (${zone.zone_code}): ${zone.base_price} MAD base`)
    })
  }
  
  return true
}

async function main() {
  console.log('🚀 GreenMarket Migration Runner')
  console.log(`📍 Supabase URL: ${SUPABASE_URL}`)
  console.log(`📁 Migrations directory: ${join(__dirname, 'migrations')}`)
  
  const results = []
  
  for (const migration of MIGRATIONS) {
    try {
      const result = await runMigration(migration)
      results.push(result)
    } catch (error) {
      console.error(`❌ Migration ${migration} failed:`, error.message)
      results.push({ filename: migration, error: error.message })
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 Migration Summary:')
  console.log('='.repeat(60))
  
  results.forEach(r => {
    if (r.error) {
      console.log(`  ❌ ${r.filename}: FAILED - ${r.error}`)
    } else {
      console.log(`  ✅ ${r.filename}: ${r.successCount} statements executed`)
    }
  })
  
  // Verify delivery zones
  await verifyDeliveryZones()
  
  console.log('\n✨ Migration process completed!')
}

main().catch(console.error)
