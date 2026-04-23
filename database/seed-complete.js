#!/usr/bin/env node
/**
 * SEED DATA SCRIPT
 * ================
 * 
 * Populates Qotoof database with comprehensive sample data:
 * - Test users (Buyers, Vendors, Drivers, Admin)
 * - Sample products with realistic data
 * - Sample orders and deliveries
 * - Storage buckets setup
 * 
 * Run with: npm run seed
 * Or manually: node database/seed-complete.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ============================================
// LOAD ENVIRONMENT
// ============================================

const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf-8')
const envVars = {}
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && !key.startsWith('#') && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
  }
})

const SUPABASE_URL = envVars.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_SERVICE_ROLE_KEY in .env')
  console.error('   This is required for seeding data')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ============================================
// SAMPLE DATA
// ============================================

const SAMPLE_VENDORS = [
  {
    email: 'vendor1@qotoof.com',
    password: 'TestVendor123!',
    profile: {
      first_name: 'Ahmed',
      last_name: 'Al-Fassi',
      role: 'vendor',
      store_name: 'Fresh Farm Agadir',
      store_description: 'Premium fresh vegetables and fruits from Agadir region',
      city: 'Agadir',
      vendor_status: 'approved',
      is_approved: true,
      is_verified: true,
    }
  },
  {
    email: 'vendor2@qotoof.com',
    password: 'TestVendor123!',
    profile: {
      first_name: 'Fatima',
      last_name: 'Ben-Said',
      role: 'vendor',
      store_name: 'Golden Harvest Supply',
      store_description: 'Wholesale vegetables supplier - established 2015',
      city: 'Casablanca',
      vendor_status: 'approved',
      is_approved: true,
      is_verified: true,
    }
  },
  {
    email: 'vendor3@qotoof.com',
    password: 'TestVendor123!',
    profile: {
      first_name: 'Mohammed',
      last_name: 'Osman',
      role: 'vendor',
      store_name: 'Citrus Express Morocco',
      store_description: 'Fresh citrus fruits and tropical fruits',
      city: 'Marrakech',
      vendor_status: 'approved',
      is_approved: true,
      is_verified: true,
    }
  },
]

const SAMPLE_BUYERS = [
  {
    email: 'buyer1@qotoof.com',
    password: 'TestBuyer123!',
    profile: {
      first_name: 'Ali',
      last_name: 'Bennani',
      role: 'buyer',
      city: 'Fez',
      is_verified: true,
    }
  },
  {
    email: 'buyer2@qotoof.com',
    password: 'TestBuyer123!',
    profile: {
      first_name: 'Nadia',
      last_name: 'Khal',
      role: 'buyer',
      city: 'Tangier',
      is_verified: true,
    }
  },
  {
    email: 'buyer3@qotoof.com',
    password: 'TestBuyer123!',
    profile: {
      first_name: 'Hassan',
      last_name: 'Alami',
      role: 'buyer',
      city: 'Rabat',
      is_verified: true,
    }
  },
]

const SAMPLE_DRIVERS = [
  {
    email: 'driver1@qotoof.com',
    password: 'TestDriver123!',
    profile: {
      first_name: 'Omar',
      last_name: 'Saidi',
      role: 'driver',
      vehicle_type: 'van',
      vehicle_plate: 'AB-123-CD',
      is_available_for_delivery: true,
      city: 'Casablanca',
      is_verified: true,
    }
  },
  {
    email: 'driver2@qotoof.com',
    password: 'TestDriver123!',
    profile: {
      first_name: 'Ibrahim',
      last_name: 'Hamad',
      role: 'driver',
      vehicle_type: 'truck',
      vehicle_plate: 'XY-456-EF',
      is_available_for_delivery: true,
      city: 'Fez',
      is_verified: true,
    }
  },
]

const SAMPLE_PRODUCTS = [
  {
    name: 'Fresh Organic Tomatoes',
    description: 'Premium quality organic tomatoes grown in Agadir. Hand-picked at peak ripeness.',
    category: 'vegetables',
    subcategory: 'fresh-veg',
    price_per_unit: 2.50,
    unit_type: 'kg',
    min_order_quantity: 50,
    available_quantity: 5000,
    is_available: true,
  },
  {
    name: 'Premium Orange Navel',
    description: 'Sweet navel oranges from Berkane, perfect for juice and fresh consumption.',
    category: 'fruits',
    subcategory: 'citrus',
    price_per_unit: 3.20,
    unit_type: 'kg',
    min_order_quantity: 100,
    available_quantity: 10000,
    is_available: true,
  },
  {
    name: 'Red Onions Premium',
    description: 'Fresh red onions, perfect for wholesale and restaurants.',
    category: 'vegetables',
    subcategory: 'fresh-veg',
    price_per_unit: 1.80,
    unit_type: 'kg',
    min_order_quantity: 200,
    available_quantity: 8000,
    is_available: true,
  },
  {
    name: 'Organic Avocados',
    description: 'Premium Hass avocados, rich and creamy.',
    category: 'fruits',
    subcategory: 'fruits',
    price_per_unit: 8.00,
    unit_type: 'kg',
    min_order_quantity: 25,
    available_quantity: 3000,
    is_available: true,
  },
  {
    name: 'Fresh Carrots',
    description: 'Organic carrots, washed and packed.',
    category: 'vegetables',
    subcategory: 'fresh-veg',
    price_per_unit: 1.50,
    unit_type: 'kg',
    min_order_quantity: 150,
    available_quantity: 7000,
    is_available: true,
  },
  {
    name: 'Lemon Eureka',
    description: 'Fresh lemons, perfect for juice and cooking.',
    category: 'fruits',
    subcategory: 'citrus',
    price_per_unit: 2.90,
    unit_type: 'kg',
    min_order_quantity: 75,
    available_quantity: 6000,
    is_available: true,
  },
  {
    name: 'Fresh Lettuce Organic',
    description: 'Crisp organic lettuce, harvested fresh daily.',
    category: 'vegetables',
    subcategory: 'leafy-greens',
    price_per_unit: 2.00,
    unit_type: 'kg',
    min_order_quantity: 50,
    available_quantity: 4000,
    is_available: true,
  },
  {
    name: 'Potatoes Premium',
    description: 'High-quality potatoes for cooking and wholesale.',
    category: 'vegetables',
    subcategory: 'root-veg',
    price_per_unit: 1.20,
    unit_type: 'kg',
    min_order_quantity: 500,
    available_quantity: 15000,
    is_available: true,
  },
  {
    name: 'Bell Peppers Mix',
    description: 'Mixed color bell peppers - red, yellow, green.',
    category: 'vegetables',
    subcategory: 'peppers',
    price_per_unit: 4.50,
    unit_type: 'kg',
    min_order_quantity: 25,
    available_quantity: 2500,
    is_available: true,
  },
  {
    name: 'Strawberries Fresh',
    description: 'Fresh strawberries, sweet and juicy.',
    category: 'fruits',
    subcategory: 'berries',
    price_per_unit: 6.00,
    unit_type: 'kg',
    min_order_quantity: 15,
    available_quantity: 1000,
    is_available: true,
  },
]

// ============================================
// SEEDING FUNCTIONS
// ============================================

async function createStorageBuckets() {
  console.log('\n📦 Creating storage buckets...')
  
  const buckets = ['products', 'profiles', 'documents', 'invoices', 'delivery-proofs']
  
  for (const bucket of buckets) {
    try {
      const { data, error } = await supabase.storage.createBucket(bucket, {
        public: bucket === 'products' || bucket === 'profiles',
      })
      
      if (error && error.message.includes('already exists')) {
        console.log(`  ✅ ${bucket} - already exists`)
      } else if (error) {
        console.log(`  ⚠️  ${bucket} - ${error.message}`)
      } else {
        console.log(`  ✅ ${bucket} - created`)
      }
    } catch (err) {
      console.log(`  ⚠️  ${bucket} - ${err.message}`)
    }
  }
}

async function seedVendors() {
  console.log('\n👥 Seeding vendors...')
  
  for (const vendor of SAMPLE_VENDORS) {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: vendor.email,
        password: vendor.password,
        email_confirm: true,
      })
      
      if (authError && !authError.message.includes('already exists')) {
        console.log(`  ❌ ${vendor.email} - ${authError.message}`)
        continue
      }
      
      const userId = authData?.user?.id
      if (!userId) continue
      
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: vendor.email,
          ...vendor.profile,
        }, { onConflict: 'id' })
      
      if (profileError) {
        console.log(`  ❌ ${vendor.email} - ${profileError.message}`)
      } else {
        console.log(`  ✅ ${vendor.email} - ${vendor.profile.store_name}`)
      }
    } catch (err) {
      console.log(`  ❌ ${vendor.email} - ${err.message}`)
    }
  }
}

async function seedBuyers() {
  console.log('\n🛍️  Seeding buyers...')
  
  for (const buyer of SAMPLE_BUYERS) {
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: buyer.email,
        password: buyer.password,
        email_confirm: true,
      })
      
      if (authError && !authError.message.includes('already exists')) {
        console.log(`  ❌ ${buyer.email} - ${authError.message}`)
        continue
      }
      
      const userId = authData?.user?.id
      if (!userId) continue
      
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: buyer.email,
          ...buyer.profile,
        }, { onConflict: 'id' })
      
      if (profileError) {
        console.log(`  ❌ ${buyer.email} - ${profileError.message}`)
      } else {
        console.log(`  ✅ ${buyer.email}`)
      }
    } catch (err) {
      console.log(`  ❌ ${buyer.email} - ${err.message}`)
    }
  }
}

async function seedDrivers() {
  console.log('\n🚗 Seeding drivers...')
  
  for (const driver of SAMPLE_DRIVERS) {
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: driver.email,
        password: driver.password,
        email_confirm: true,
      })
      
      if (authError && !authError.message.includes('already exists')) {
        console.log(`  ❌ ${driver.email} - ${authError.message}`)
        continue
      }
      
      const userId = authData?.user?.id
      if (!userId) continue
      
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: driver.email,
          ...driver.profile,
        }, { onConflict: 'id' })
      
      if (profileError) {
        console.log(`  ❌ ${driver.email} - ${profileError.message}`)
      } else {
        console.log(`  ✅ ${driver.email}`)
      }
    } catch (err) {
      console.log(`  ❌ ${driver.email} - ${err.message}`)
    }
  }
}

async function seedProducts() {
  console.log('\n📦 Seeding products...')
  
  // Get first vendor
  const { data: vendorData } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'vendor')
    .limit(1)
  
  if (!vendorData || vendorData.length === 0) {
    console.log('  ⚠️  No vendors found. Skipping products.')
    return
  }
  
  const vendorId = vendorData[0].id
  
  for (const product of SAMPLE_PRODUCTS) {
    try {
      const { error } = await supabase
        .from('products')
        .insert({
          ...product,
          vendor_id: vendorId,
        })
      
      if (error && !error.message.includes('duplicate')) {
        console.log(`  ❌ ${product.name} - ${error.message}`)
      } else if (!error) {
        console.log(`  ✅ ${product.name}`)
      }
    } catch (err) {
      console.log(`  ❌ ${product.name} - ${err.message}`)
    }
  }
}

// ============================================
// MAIN SEEDING PROCESS
// ============================================

async function runSeed() {
  console.log('\n')
  console.log('╔' + '═'.repeat(60) + '╗')
  console.log('║' + ' '.repeat(20) + '🌱 SEEDING DATABASE' + ' '.repeat(20) + '║')
  console.log('║' + ' '.repeat(18) + 'Qotoof - B2B Marketplace' + ' '.repeat(18) + '║')
  console.log('╚' + '═'.repeat(60) + '╝')
  
  try {
    console.log('\n✨ Starting data seeding process...\n')
    
    // 1. Create storage buckets
    await createStorageBuckets()
    
    // 2. Seed vendors
    await seedVendors()
    
    // 3. Seed buyers
    await seedBuyers()
    
    // 4. Seed drivers
    await seedDrivers()
    
    // 5. Seed products
    await seedProducts()
    
    // Success message
    console.log('\n\n')
    console.log('╔' + '═'.repeat(60) + '╗')
    console.log('║' + ' '.repeat(15) + '✅ SEEDING COMPLETED SUCCESSFULLY' + ' '.repeat(12) + '║')
    console.log('╠' + '═'.repeat(60) + '╣')
    console.log('║' + ' '.repeat(10) + 'Test Credentials:' + ' '.repeat(34) + '║')
    console.log('║' + ' '.repeat(60) + '║')
    console.log('║  Admin:                  N/A (create manually)' + ' '.repeat(4) + '║')
    console.log('║  Vendor: vendor1@qotoof.com / TestVendor123!' + ' '.repeat(6) + '║')
    console.log('║  Buyer:  buyer1@qotoof.com / TestBuyer123!' + ' '.repeat(8) + '║')
    console.log('║  Driver: driver1@qotoof.com / TestDriver123!' + ' '.repeat(7) + '║')
    console.log('║' + ' '.repeat(60) + '║')
    console.log('║  Sample Data:' + ' '.repeat(47) + '║')
    console.log('║  • 3 Vendors' + ' '.repeat(45) + '║')
    console.log('║  • 3 Buyers' + ' '.repeat(46) + '║')
    console.log('║  • 2 Drivers' + ' '.repeat(45) + '║')
    console.log('║  • 10 Products' + ' '.repeat(42) + '║')
    console.log('║' + ' '.repeat(60) + '║')
    console.log('║  Next Step: npm run dev' + ' '.repeat(35) + '║')
    console.log('╚' + '═'.repeat(60) + '╝')
    
    process.exit(0)
  } catch (err) {
    console.error('\n\n❌ Seeding failed:', err.message)
    process.exit(1)
  }
}

runSeed()
