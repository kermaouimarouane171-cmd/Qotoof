#!/usr/bin/env node
// Migration verification script - checks Supabase setup and delivery zones
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Parse .env file manually
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

const SUPABASE_URL = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Missing Supabase credentials in .env file')
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function checkConnection() {
  console.log('🔌 Testing Supabase connection...')
  console.log(`   URL: ${SUPABASE_URL}`)
  
  const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true })
  
  if (error) {
    console.error('❌ Connection failed:', error.message)
    return false
  }
  
  console.log('✅ Supabase connection successful')
  return true
}

async function checkDeliveryZonesTable() {
  console.log('\n📋 Checking delivery_zones table...')
  
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('city, zone_name, zone_code, base_price, price_per_km, max_distance_km, is_active')
    .order('city')
  
  if (error) {
    if (error.message.includes('relation') || error.message.includes('does not exist')) {
      console.error('❌ delivery_zones table does not exist')
      console.error('   Please run the migration SQL files manually in Supabase Dashboard')
      return null
    }
    console.error('❌ Error querying delivery_zones:', error.message)
    return null
  }
  
  console.log(`✅ Found ${data.length} delivery zones\n`)
  
  // Group by city
  const zonesByCity = {}
  data.forEach(zone => {
    if (!zonesByCity[zone.city]) zonesByCity[zone.city] = []
    zonesByCity[zone.city].push(zone)
  })
  
  for (const [city, zones] of Object.entries(zonesByCity).sort()) {
    console.log(`  📍 ${city}: ${zones.length} zones`)
    zones.forEach(zone => {
      console.log(`     - ${zone.zone_name} (${zone.zone_code}): ${zone.base_price} MAD base + ${zone.price_per_km} MAD/km`)
    })
  }
  
  return data
}

async function checkRelatedTables() {
  console.log('\n🔍 Checking related tables...')
  
  const tables = ['deliveries', 'delivery_driver_assignments', 'delivery_location_updates']
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('count', { count: 'exact', head: true })
    
    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        console.log(`   ⚠️  ${table}: Table does not exist`)
      } else {
        console.log(`   ❌ ${table}: Error - ${error.message}`)
      }
    } else {
      console.log(`   ✅ ${table}: Exists (${data} records)`)
    }
  }
}

async function main() {
  console.log('🚀 GreenMarket Migration Verification')
  console.log('='.repeat(60))
  
  const connected = await checkConnection()
  if (!connected) {
    console.error('\n❌ Cannot connect to Supabase. Please check your credentials.')
    process.exit(1)
  }
  
  await checkDeliveryZonesTable()
  await checkRelatedTables()
  
  console.log('\n' + '='.repeat(60))
  console.log('📝 Next Steps:')
  console.log('='.repeat(60))
  console.log('If tables are missing, run the migration manually:')
  console.log('1. Go to: https://oyaiiyekfkflesdmcvvo.supabase.co/project/default/editor/sql')
  console.log('2. Copy and paste the SQL from:')
  console.log('   - database/migrations/005-add-delivery-tracking.sql')
  console.log('   - database/migrations/007-add-delivery-zones-morocco.sql')
  console.log('3. Click "Run" to execute the migrations')
  console.log('\n✨ Verification complete!')
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
