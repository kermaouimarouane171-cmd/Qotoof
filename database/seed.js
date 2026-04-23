/**
 * Seed Script - Populates Supabase with sample data
 * Run with: node database/seed.js
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
  console.error('❌ Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const sampleProducts = [
  {
    name: 'Fresh Organic Tomatoes',
    description: 'Premium quality organic tomatoes grown in Agadir. Hand-picked at peak ripeness.',
    category: 'vegetables',
    price_per_unit: 2.50,
    unit_type: 'kg',
    min_order_quantity: 50,
    available_quantity: 5000,
    is_available: true,
  },
  {
    name: 'Premium Olive Trees',
    description: 'High-quality olive trees perfect for nurseries and gardens.',
    category: 'plants',
    price_per_unit: 45.00,
    unit_type: 'piece',
    min_order_quantity: 10,
    available_quantity: 500,
    is_available: true,
  },
  {
    name: 'Fresh Oranges Navel',
    description: 'Sweet navel oranges from Berkane, perfect for juice and fresh consumption.',
    category: 'fruits',
    price_per_unit: 3.20,
    unit_type: 'kg',
    min_order_quantity: 100,
    available_quantity: 10000,
    is_available: true,
  },
  {
    name: 'Organic Avocados',
    description: 'Premium Hass avocados, rich and creamy.',
    category: 'fruits',
    price_per_unit: 8.00,
    unit_type: 'kg',
    min_order_quantity: 25,
    available_quantity: 3000,
    is_available: true,
  },
  {
    name: 'Red Onions Premium',
    description: 'Fresh red onions, perfect for wholesale and restaurants.',
    category: 'vegetables',
    price_per_unit: 1.80,
    unit_type: 'kg',
    min_order_quantity: 200,
    available_quantity: 8000,
    is_available: true,
  },
  {
    name: 'Lemon Eureka',
    description: 'Fresh lemons, perfect for juice and cooking.',
    category: 'fruits',
    price_per_unit: 2.90,
    unit_type: 'kg',
    min_order_quantity: 75,
    available_quantity: 6000,
    is_available: true,
  },
  {
    name: 'Palm Trees Date',
    description: 'Date palm trees, various sizes available.',
    category: 'plants',
    price_per_unit: 120.00,
    unit_type: 'piece',
    min_order_quantity: 5,
    available_quantity: 100,
    is_available: true,
  },
  {
    name: 'Fresh Carrots',
    description: 'Organic carrots, washed and packed.',
    category: 'vegetables',
    price_per_unit: 1.50,
    unit_type: 'kg',
    min_order_quantity: 150,
    available_quantity: 7000,
    is_available: true,
  },
]

const sampleImages = [
  'https://images.unsplash.com/photo-1546470427-e26264c9656a?w=800',
  'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800',
  'https://images.unsplash.com/photo-1547514701-42782101795e?w=800',
  'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=800',
  'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800',
  'https://images.unsplash.com/photo-1590502593747-42a996133562?w=800',
  'https://images.unsplash.com/photo-1580974852861-c381510a1e7c?w=800',
  'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800',
]

async function seed() {
  console.log('🌱 Starting Qotoof seed...\n')
  
  try {
    // Get first vendor user
    const { data: vendors, error: vendorError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .eq('role', 'vendor')
      .limit(1)
    
    if (vendorError) {
      console.error('❌ Error fetching vendors:', vendorError.message)
      process.exit(1)
    }
    
    if (!vendors || vendors.length === 0) {
      console.log('⚠️  No vendor found. Please create a vendor user first via signup.')
      console.log('   Go to: http://localhost:3000/register?role=vendor\n')
      process.exit(0)
    }
    
    const vendor = vendors[0]
    console.log(`✅ Found vendor: ${vendor.first_name} ${vendor.last_name} (${vendor.email})`)
    
    // Insert products
    console.log('\n📦 Inserting products...')
    const insertedProducts = []
    
    for (let i = 0; i < sampleProducts.length; i++) {
      const product = sampleProducts[i]
      
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...product,
          vendor_id: vendor.id,
        })
        .select()
        .single()
      
      if (error) {
        console.error(`❌ Error inserting product ${i + 1}:`, error.message)
        continue
      }
      
      insertedProducts.push(data)
      console.log(`  ✅ ${product.name}`)
      
      // Insert image
      if (sampleImages[i]) {
        await supabase
          .from('product_images')
          .insert({
            product_id: data.id,
            url: sampleImages[i],
            is_primary: true,
          })
      }
    }
    
    console.log(`\n✅ Successfully inserted ${insertedProducts.length} products!`)
    
    // Summary
    console.log('\n📊 Summary:')
    console.log(`   Products: ${insertedProducts.length}`)
    console.log(`   Images: ${insertedProducts.length}`)
    console.log('\n🎉 Seed completed successfully!')
    console.log('\n👉 Visit: http://localhost:3000/marketplace to see the products\n')
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    process.exit(1)
  }
}

seed()
