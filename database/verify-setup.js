#!/usr/bin/env node
// Verify Supabase setup and delivery zones
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env file manually
const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf-8')
const envVars = {}
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const SUPABASE_URL = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: Supabase credentials not found in .env file')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function verifySupabaseConnection() {
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

async function verifyDeliveryZonesTable() {
  console.log('\n📋 Checking delivery_zones table...')
  
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('count', { count: 'exact', head: true })
  
  if (error) {
    console.error('❌ delivery_zones table does not exist or is not accessible')
    console.error('   Error:', error.message)
    console.log('\n📝 You need to run the migration manually:')
    console.log('   1. Go to Supabase Dashboard: https://oyaiiyekfkflesdmcvvo.supabase.co')
    console.log('   2. Navigate to SQL Editor')
    console.log('   3. Run the following files in order:')
    console.log('      - database/migrations/005-add-delivery-tracking.sql')
    console.log('      - database/migrations/006-add-user-reporting.sql')
    console.log('      - database/migrations/007-add-delivery-zones-morocco.sql')
    return false
  }
  
  console.log('✅ delivery_zones table exists')
  return true
}

async function verifyDeliveryZonesData() {
  console.log('\n🔍 Verifying delivery zones data...')
  
  const { data, error } = await supabase
    .from('delivery_zones')
    .select('city, zone_name, zone_code, base_price')
    .order('city')
    .limit(100)
  
  if (error) {
    console.error('❌ Error fetching delivery zones:', error.message)
    return false
  }
  
  if (!data || data.length === 0) {
    console.log('⚠️  delivery_zones table is empty')
    console.log('\n📝 You need to insert delivery zones data:')
    console.log('   Run: database/migrations/007-add-delivery-zones-morocco.sql')
    return false
  }
  
  console.log(`\n📊 Found ${data.length} delivery zones:\n`)
  
  // Group by city
  const zonesByCity = {}
  data.forEach(zone => {
    if (!zonesByCity[zone.city]) {
      zonesByCity[zone.city] = []
    }
    zonesByCity[zone.city].push(zone)
  })
  
  for (const [city, zones] of Object.entries(zonesByCity)) {
    console.log(`  ${city}: ${zones.length} zones`)
  }
  
  return true
}

async function verifyOtherTables() {
  console.log('\n📋 Checking other required tables...')
  
  const tables = ['profiles', 'products', 'orders', 'deliveries', 'notifications']
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('count', { count: 'exact', head: true })
    
    if (error) {
      console.log(`  ❌ ${table}: NOT FOUND - ${error.message}`)
    } else {
      console.log(`  ✅ ${table}: EXISTS`)
    }
  }
}

async function main() {
  console.log('🚀 GreenMarket Supabase Verification')
  console.log('='.repeat(60))
  
  const connected = await verifySupabaseConnection()
  
  if (!connected) {
    console.log('\n❌ Cannot connect to Supabase. Please check your credentials.')
    process.exit(1)
  }
  
  const tableExists = await verifyDeliveryZonesTable()
  
  if (tableExists) {
    await verifyDeliveryZonesData()
  }
  
  await verifyOtherTables()
  
  console.log('\n' + '='.repeat(60))
  console.log('✨ Verification completed!')
  console.log('='.repeat(60))
}

main().catch(console.error)
