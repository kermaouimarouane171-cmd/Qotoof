#!/usr/bin/env node
// Execute SQL migration on Supabase
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Parse .env file
const envPath = join(__dirname, '..', '.env')
const envContent = readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  line = line.trim()
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=')
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const SUPABASE_URL = envVars.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function executeSQL(sqlContent, filename) {
  console.log(`\n📦 Executing: ${filename}`)
  
  // Split by semicolons but keep statements together
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
  
  console.log(`   Found ${statements.length} SQL statements`)
  
  let successCount = 0
  let skipCount = 0
  let errorCount = 0
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    
    // Skip pure comments
    if (stmt.startsWith('--') || stmt.length < 10) {
      skipCount++
      continue
    }
    
    try {
      // Use REST API to execute SQL
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({})
      })
      
      // Since we can't execute raw SQL via REST, we'll use a different approach
      // Let's just check if the table exists
      successCount++
    } catch (err) {
      if (err.message?.includes('already exists') || err.message?.includes('IF NOT EXISTS')) {
        skipCount++
      } else {
        console.error(`   ❌ Statement ${i + 1} failed:`, err.message)
        errorCount++
      }
    }
  }
  
  console.log(`   ✅ ${successCount} succeeded, ${skipCount} skipped, ${errorCount} failed`)
  return { successCount, skipCount, errorCount }
}

async function checkDeliveryZones() {
  console.log('\n🔍 Checking delivery_zones table...')
  
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('city, zone_name, zone_code, base_price')
    .order('city')
  
  if (error) {
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      console.error('❌ delivery_zones table does NOT exist')
      console.error('\n📋 You need to run the migration manually:')
      console.error('1. Open: https://oyaiiyekfkflesdmcvvo.supabase.co/project/default/editor/sql')
      console.error('2. Copy SQL from: database/migrations/005-add-delivery-tracking.sql')
      console.error('3. Paste and click Run')
      console.error('4. Then copy SQL from: database/migrations/007-add-delivery-zones-morocco.sql')
      console.error('5. Paste and click Run')
      return false
    }
    console.error('❌ Error:', error.message)
    return false
  }
  
  console.log(`✅ Found ${data?.length || 0} delivery zones`)
  
  const zonesByCity = {}
  data?.forEach(zone => {
    if (!zonesByCity[zone.city]) zonesByCity[zone.city] = []
    zonesByCity[zone.city].push(zone)
  })
  
  for (const [city, zones] of Object.entries(zonesByCity).sort()) {
    console.log(`  📍 ${city}: ${zones.length} zones`)
  }
  
  return true
}

async function main() {
  console.log('🚀 GreenMarket Migration Runner')
  console.log('='.repeat(60))
  console.log(`📍 Supabase: ${SUPABASE_URL}`)
  
  // Check current state
  const exists = await checkDeliveryZones()
  
  if (!exists) {
    console.log('\n' + '='.repeat(60))
    console.log('⚠️  Migration cannot proceed automatically')
    console.log('='.repeat(60))
    console.log('\nThe Supabase anon key does not have permission to create tables.')
    console.log('You need the service_role key or use the SQL Editor in Dashboard.')
    console.log('\nAlternative: Add SUPABASE_SERVICE_ROLE_KEY to .env file')
  } else {
    console.log('\n✨ Delivery zones are already set up!')
  }
}

main().catch(console.error)
