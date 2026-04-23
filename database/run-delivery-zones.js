#!/usr/bin/env node
// Run delivery zones migration
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env file
const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf-8')
const envVars = {}
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim()
  }
})

const SUPABASE_URL = envVars.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Delivery zones data from migration 007
const deliveryZones = [
  // Casablanca
  { city: 'Casablanca', zone_name: 'Centre Ville', zone_code: 'CASA-C', base_price: 15.0, price_per_km: 2.0, max_distance_km: 50 },
  { city: 'Casablanca', zone_name: 'Ain Diab', zone_code: 'CASA-AD', base_price: 18.0, price_per_km: 2.5, max_distance_km: 50 },
  { city: 'Casablanca', zone_name: 'Anfa', zone_code: 'CASA-AN', base_price: 16.0, price_per_km: 2.0, max_distance_km: 50 },
  { city: 'Casablanca', zone_name: 'Maarif', zone_code: 'CASA-MA', base_price: 15.0, price_per_km: 2.0, max_distance_km: 50 },
  { city: 'Casablanca', zone_name: 'Hay Hassani', zone_code: 'CASA-HH', base_price: 14.0, price_per_km: 1.8, max_distance_km: 50 },
  { city: 'Casablanca', zone_name: 'Sidi Bernoussi', zone_code: 'CASA-SB', base_price: 13.0, price_per_km: 1.5, max_distance_km: 50 },
  { city: 'Casablanca', zone_name: 'Ain Sebaa', zone_code: 'CASA-AS', base_price: 13.0, price_per_km: 1.5, max_distance_km: 50 },
  { city: 'Casablanca', zone_name: "Ben M'sik", zone_code: 'CASA-BM', base_price: 12.0, price_per_km: 1.5, max_distance_km: 50 },
  { city: 'Casablanca', zone_name: 'Sidi Othmane', zone_code: 'CASA-SO', base_price: 12.0, price_per_km: 1.5, max_distance_km: 50 },
  { city: 'Casablanca', zone_name: 'Moulay Rachid', zone_code: 'CASA-MR', base_price: 12.0, price_per_km: 1.5, max_distance_km: 50 },
  // Rabat
  { city: 'Rabat', zone_name: 'Centre Ville', zone_code: 'RABAT-C', base_price: 12.0, price_per_km: 1.8, max_distance_km: 40 },
  { city: 'Rabat', zone_name: 'Agdal', zone_code: 'RABAT-AG', base_price: 13.0, price_per_km: 1.8, max_distance_km: 40 },
  { city: 'Rabat', zone_name: 'Hassan', zone_code: 'RABAT-HA', base_price: 12.0, price_per_km: 1.8, max_distance_km: 40 },
  { city: 'Rabat', zone_name: 'Souissi', zone_code: 'RABAT-SO', base_price: 15.0, price_per_km: 2.0, max_distance_km: 40 },
  { city: 'Rabat', zone_name: 'Yacoub El Mansour', zone_code: 'RABAT-YM', base_price: 11.0, price_per_km: 1.5, max_distance_km: 40 },
  { city: 'Rabat', zone_name: 'Ocean', zone_code: 'RABAT-OC', base_price: 12.0, price_per_km: 1.8, max_distance_km: 40 },
  { city: 'Rabat', zone_name: 'Akkray', zone_code: 'RABAT-AK', base_price: 11.0, price_per_km: 1.5, max_distance_km: 40 },
  // Marrakech
  { city: 'Marrakech', zone_name: 'Medina', zone_code: 'MARR-ME', base_price: 10.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Marrakech', zone_name: 'Gueliz', zone_code: 'MARR-GU', base_price: 12.0, price_per_km: 1.8, max_distance_km: 30 },
  { city: 'Marrakech', zone_name: 'Menara', zone_code: 'MARR-MN', base_price: 11.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Marrakech', zone_name: 'Hivernage', zone_code: 'MARR-HI', base_price: 13.0, price_per_km: 2.0, max_distance_km: 30 },
  { city: 'Marrakech', zone_name: 'Sidi Youssef', zone_code: 'MARR-SY', base_price: 10.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Marrakech', zone_name: 'Massira', zone_code: 'MARR-MS', base_price: 10.0, price_per_km: 1.5, max_distance_km: 30 },
  // Tangier
  { city: 'Tangier', zone_name: 'Centre Ville', zone_code: 'TANG-C', base_price: 12.0, price_per_km: 2.0, max_distance_km: 40 },
  { city: 'Tangier', zone_name: 'Malabata', zone_code: 'TANG-ML', base_price: 14.0, price_per_km: 2.0, max_distance_km: 40 },
  { city: 'Tangier', zone_name: 'Boukhalef', zone_code: 'TANG-BK', base_price: 13.0, price_per_km: 2.0, max_distance_km: 40 },
  { city: 'Tangier', zone_name: 'Iberia', zone_code: 'TANG-IB', base_price: 12.0, price_per_km: 1.8, max_distance_km: 40 },
  { city: 'Tangier', zone_name: 'Beni Makada', zone_code: 'TANG-BM', base_price: 11.0, price_per_km: 1.5, max_distance_km: 40 },
  // Fes
  { city: 'Fes', zone_name: 'Medina', zone_code: 'FES-ME', base_price: 10.0, price_per_km: 1.5, max_distance_km: 35 },
  { city: 'Fes', zone_name: 'Ville Nouvelle', zone_code: 'FES-VN', base_price: 12.0, price_per_km: 1.8, max_distance_km: 35 },
  { city: 'Fes', zone_name: 'Zouagha', zone_code: 'FES-ZO', base_price: 11.0, price_per_km: 1.5, max_distance_km: 35 },
  { city: 'Fes', zone_name: 'Saiss', zone_code: 'FES-SA', base_price: 11.0, price_per_km: 1.5, max_distance_km: 35 },
  { city: 'Fes', zone_name: 'Agdal', zone_code: 'FES-AG', base_price: 12.0, price_per_km: 1.8, max_distance_km: 35 },
  // Agadir
  { city: 'Agadir', zone_name: 'Centre', zone_code: 'AGAD-C', base_price: 11.0, price_per_km: 1.8, max_distance_km: 35 },
  { city: 'Agadir', zone_name: 'Sonaba', zone_code: 'AGAD-SN', base_price: 12.0, price_per_km: 1.8, max_distance_km: 35 },
  { city: 'Agadir', zone_name: 'Founty', zone_code: 'AGAD-FO', base_price: 13.0, price_per_km: 2.0, max_distance_km: 35 },
  { city: 'Agadir', zone_name: 'Ben Sergao', zone_code: 'AGAD-BS', base_price: 10.0, price_per_km: 1.5, max_distance_km: 35 },
  { city: 'Agadir', zone_name: 'Tikiouine', zone_code: 'AGAD-TI', base_price: 10.0, price_per_km: 1.5, max_distance_km: 35 },
  // Meknes
  { city: 'Meknes', zone_name: 'Medina', zone_code: 'MEKN-ME', base_price: 10.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Meknes', zone_name: 'Ville Nouvelle', zone_code: 'MEKN-VN', base_price: 11.0, price_per_km: 1.8, max_distance_km: 30 },
  { city: 'Meknes', zone_name: 'Hamria', zone_code: 'MEKN-HA', base_price: 11.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Meknes', zone_name: 'Toulal', zone_code: 'MEKN-TO', base_price: 10.0, price_per_km: 1.5, max_distance_km: 30 },
  // Oujda
  { city: 'Oujda', zone_name: 'Centre', zone_code: 'OUJD-C', base_price: 10.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Oujda', zone_name: 'Hay Al Qods', zone_code: 'OUJD-HQ', base_price: 10.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Oujda', zone_name: 'Sidi Yahya', zone_code: 'OUJD-SY', base_price: 11.0, price_per_km: 1.5, max_distance_km: 30 },
  // Kenitra
  { city: 'Kenitra', zone_name: 'Centre', zone_code: 'KENI-C', base_price: 10.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Kenitra', zone_name: 'Mimosas', zone_code: 'KENI-MI', base_price: 11.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Kenitra', zone_name: 'Val Fleuri', zone_code: 'KENI-VF', base_price: 11.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Kenitra', zone_name: 'Ouled Oujih', zone_code: 'KENI-OO', base_price: 10.0, price_per_km: 1.5, max_distance_km: 30 },
  // Tetouan
  { city: 'Tetouan', zone_name: 'Medina', zone_code: 'TET-ME', base_price: 10.0, price_per_km: 1.5, max_distance_km: 25 },
  { city: 'Tetouan', zone_name: 'Centre', zone_code: 'TET-C', base_price: 11.0, price_per_km: 1.8, max_distance_km: 25 },
  { city: 'Tetouan', zone_name: "M'hannech", zone_code: 'TET-MH', base_price: 11.0, price_per_km: 1.5, max_distance_km: 25 },
  { city: 'Tetouan', zone_name: 'Azla', zone_code: 'TET-AZ', base_price: 10.0, price_per_km: 1.5, max_distance_km: 25 },
  // Temara
  { city: 'Temara', zone_name: 'Centre', zone_code: 'TEMA-C', base_price: 11.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Temara', zone_name: 'Harhoura', zone_code: 'TEMA-HA', base_price: 13.0, price_per_km: 2.0, max_distance_km: 30 },
  { city: 'Temara', zone_name: 'Wafaa', zone_code: 'TEMA-WA', base_price: 11.0, price_per_km: 1.5, max_distance_km: 30 },
  // Sale
  { city: 'Sale', zone_name: 'Medina', zone_code: 'SALE-ME', base_price: 10.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Sale', zone_name: 'Tabriquet', zone_code: 'SALE-TA', base_price: 11.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Sale', zone_name: 'Bettana', zone_code: 'SALE-BE', base_price: 11.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Sale', zone_name: 'Hay Salam', zone_code: 'SALE-HS', base_price: 10.0, price_per_km: 1.5, max_distance_km: 30 },
  { city: 'Sale', zone_name: 'Kariat', zone_code: 'SALE-KA', base_price: 10.0, price_per_km: 1.5, max_distance_km: 30 },
  // Nador
  { city: 'Nador', zone_name: 'Centre', zone_code: 'NADO-C', base_price: 10.0, price_per_km: 1.5, max_distance_km: 25 },
  { city: 'Nador', zone_name: 'Al Aarar', zone_code: 'NADO-AA', base_price: 10.0, price_per_km: 1.5, max_distance_km: 25 },
  { city: 'Nador', zone_name: 'Ben Ansar', zone_code: 'NADO-BA', base_price: 11.0, price_per_km: 1.5, max_distance_km: 25 },
  // Settat
  { city: 'Settat', zone_name: 'Centre', zone_code: 'SETT-C', base_price: 10.0, price_per_km: 1.5, max_distance_km: 25 },
  { city: 'Settat', zone_name: 'Hay Hassani', zone_code: 'SETT-HH', base_price: 10.0, price_per_km: 1.5, max_distance_km: 25 },
  // El Jadida
  { city: 'El Jadida', zone_name: 'Centre', zone_code: 'ELJA-C', base_price: 10.0, price_per_km: 1.5, max_distance_km: 25 },
  { city: 'El Jadida', zone_name: 'Haouzia', zone_code: 'ELJA-HA', base_price: 11.0, price_per_km: 1.5, max_distance_km: 25 },
  // Beni Mellal
  { city: 'Beni Mellal', zone_name: 'Centre', zone_code: 'BENI-C', base_price: 10.0, price_per_km: 1.5, max_distance_km: 25 },
  { city: 'Beni Mellal', zone_name: 'Hay Salam', zone_code: 'BENI-HS', base_price: 10.0, price_per_km: 1.5, max_distance_km: 25 },
  // Mohammedia
  { city: 'Mohammedia', zone_name: 'Centre', zone_code: 'MOHA-C', base_price: 12.0, price_per_km: 1.8, max_distance_km: 30 },
  { city: 'Mohammedia', zone_name: 'Corniche', zone_code: 'MOHA-CO', base_price: 14.0, price_per_km: 2.0, max_distance_km: 30 },
  // Khouribga
  { city: 'Khouribga', zone_name: 'Centre', zone_code: 'KHOU-C', base_price: 10.0, price_per_km: 1.5, max_distance_km: 25 },
  { city: 'Khouribga', zone_name: 'Oued Zem', zone_code: 'KHOU-OZ', base_price: 11.0, price_per_km: 1.5, max_distance_km: 25 },
  // Tiznit
  { city: 'Tiznit', zone_name: 'Centre', zone_code: 'TIZN-C', base_price: 10.0, price_per_km: 1.5, max_distance_km: 20 },
  // Essaouira
  { city: 'Essaouira', zone_name: 'Medina', zone_code: 'ESSA-ME', base_price: 10.0, price_per_km: 1.5, max_distance_km: 20 },
  { city: 'Essaouira', zone_name: 'Centre', zone_code: 'ESSA-C', base_price: 11.0, price_per_km: 1.5, max_distance_km: 20 },
]

async function insertDeliveryZones() {
  console.log('📦 Inserting delivery zones...')
  console.log(`   Total zones to insert: ${deliveryZones.length}`)
  
  // Insert with ON CONFLICT DO NOTHING
  const { data, error } = await supabase
    .from('delivery_zones')
    .upsert(deliveryZones, { 
      onConflict: 'city,zone_name',
      ignoreDuplicates: true 
    })
  
  if (error) {
    console.error('❌ Error inserting delivery zones:', error.message)
    return false
  }
  
  console.log('✅ Delivery zones inserted successfully')
  return true
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
    console.log(`  ✅ ${city}: ${zones.length} zones`)
  }
  
  console.log(`\n✨ Total: ${data?.length} zones across ${Object.keys(zonesByCity).length} cities`)
  return true
}

async function main() {
  console.log('🚀 GreenMarket Delivery Zones Migration')
  console.log('='.repeat(60))
  
  const inserted = await insertDeliveryZones()
  
  if (inserted) {
    await verifyDeliveryZones()
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('✨ Migration completed!')
  console.log('='.repeat(60))
}

main().catch(console.error)
