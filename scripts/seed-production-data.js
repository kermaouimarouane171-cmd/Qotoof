#!/usr/bin/env node
/**
 * Seed script for launch-readiness data.
 * Ensures minimum required counts for vendors/drivers/products.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const parseEnvFile = (path) => {
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

const env = parseEnvFile(resolve(process.cwd(), '.env.production'))

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

const hasKey = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

const getExistingUserByEmail = async (email) => {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (error) {
    throw new Error(`listUsers failed: ${error.message}`)
  }

  return (data?.users || []).find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null
}

const ensureAuthUser = async (email, password, role) => {
  const create = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  })

  if (!create.error && create.data?.user?.id) {
    return create.data.user
  }

  const alreadyExists = /already|exists|registered/i.test(create.error?.message || '')
  if (!alreadyExists) {
    throw new Error(`createUser(${email}) failed: ${create.error?.message || 'unknown error'}`)
  }

  const existing = await getExistingUserByEmail(email)
  if (!existing?.id) {
    throw new Error(`createUser(${email}) reported existing user but user was not found`)
  }

  return existing
}

const getProfileTemplate = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(1)

  if (error) {
    throw new Error(`profiles template load failed: ${error.message}`)
  }

  return data?.[0] || {}
}

const getProductTemplate = async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(1)

  if (error) {
    throw new Error(`products template load failed: ${error.message}`)
  }

  return data?.[0] || {}
}

const moroccanCities = [
  { name: 'Casablanca', lat: 33.5731, lng: -7.5898 },
  { name: 'Fes', lat: 34.0333, lng: -5.0000 },
  { name: 'Marrakech', lat: 31.6295, lng: -8.0100 },
  { name: 'Tangier', lat: 35.7595, lng: -5.8336 },
  { name: 'Agadir', lat: 30.4278, lng: -9.5982 },
  { name: 'Rabat', lat: 34.0209, lng: -6.8416 },
  { name: 'Meknes', lat: 33.8869, lng: -5.5542 },
  { name: 'Oujda', lat: 34.6740, lng: -1.9130 },
  { name: 'Sale', lat: 34.0333, lng: -6.8667 },
  { name: 'Tetouan', lat: 35.5731, lng: -5.3598 },
  { name: 'Kenitra', lat: 34.2603, lng: -6.5796 },
  { name: 'Safi', lat: 32.2657, lng: -8.7658 },
]

const productImages = [
  'https://cdn.pixabay.com/photo/2015/04/09/15/07/vegetables-715538.jpg',
  'https://cdn.pixabay.com/photo/2016/07/22/09/59/vegetables-1534676.jpg',
  'https://cdn.pixabay.com/photo/2015/02/19/08/06/vegetables-642078.jpg',
  'https://cdn.pixabay.com/photo/2014/04/05/11/35/salad-314281.jpg',
  'https://cdn.pixabay.com/photo/2015/05/31/12/51/vegetables-790122.jpg',
  'https://cdn.pixabay.com/photo/2016/01/07/14/48/vegetables-1125156.jpg',
  'https://cdn.pixabay.com/photo/2016/11/22/19/11/vegetables-1850092.jpg',
  'https://cdn.pixabay.com/photo/2017/03/22/23/15/strawberries-2167541.jpg',
  'https://cdn.pixabay.com/photo/2017/03/23/19/57/fruits-2169305.jpg',
  'https://cdn.pixabay.com/photo/2016/11/21/16/00/oranges-1846081.jpg',
  'https://cdn.pixabay.com/photo/2018/04/10/18/54/fruit-3307069.jpg',
  'https://cdn.pixabay.com/photo/2018/05/14/17/50/papaya-3401265.jpg',
  'https://cdn.pixabay.com/photo/2019/07/10/17/42/banana-4330436.jpg',
  'https://cdn.pixabay.com/photo/2017/09/24/10/30/watermelon-2776619.jpg',
  'https://cdn.pixabay.com/photo/2017/10/25/15/47/tomatoes-2881799.jpg',
  'https://cdn.pixabay.com/photo/2018/01/14/16/55/potatoes-3082321.jpg',
  'https://cdn.pixabay.com/photo/2015/09/30/16/13/pepper-963033.jpg',
  'https://cdn.pixabay.com/photo/2016/04/02/14/12/flower-1303229.jpg',
  'https://cdn.pixabay.com/photo/2017/08/01/11/48/garlic-2564072.jpg',
]

const products = [
  { name: 'Tomatoes (kg)', price: 5.50 },
  { name: 'Carrots (kg)', price: 3.20 },
  { name: 'Lettuce (head)', price: 2.10 },
  { name: 'Potatoes (kg)', price: 2.80 },
  { name: 'Oranges (kg)', price: 6.50 },
  { name: 'Apples (kg)', price: 7.00 },
  { name: 'Bananas (kg)', price: 4.50 },
  { name: 'Watermelons (unit)', price: 12.00 },
  { name: 'Cucumbers (kg)', price: 3.50 },
  { name: 'Peppers (kg)', price: 5.00 },
  { name: 'Onions (kg)', price: 2.50 },
  { name: 'Garlic (kg)', price: 8.00 },
  { name: 'Strawberries (kg)', price: 15.00 },
  { name: 'Cabbage (kg)', price: 3.00 },
  { name: 'Spinach (bundle)', price: 4.00 },
  { name: 'Broccoli (kg)', price: 6.00 },
  { name: 'Zucchini (kg)', price: 4.50 },
  { name: 'Eggplant (kg)', price: 5.50 },
  { name: 'Green Beans (kg)', price: 6.50 },
]

const makeProfilePayload = ({ userId, email, role, index, city, lat, lng }, template) => {
  const payload = { id: userId }

  if (hasKey(template, 'email')) payload.email = email
  if (hasKey(template, 'role')) payload.role = role
  if (hasKey(template, 'verification_status')) payload.verification_status = 'verified'
  if (hasKey(template, 'is_active')) payload.is_active = true
  if (hasKey(template, 'full_name')) payload.full_name = `${role} ${index + 1}`
  if (hasKey(template, 'first_name')) payload.first_name = role === 'vendor' ? 'Vendor' : 'Driver'
  if (hasKey(template, 'last_name')) payload.last_name = `${index + 1}`
  if (hasKey(template, 'phone_number')) payload.phone_number = `+2126${String(10000000 + index).slice(0, 8)}`
  if (hasKey(template, 'latitude')) payload.latitude = lat
  if (hasKey(template, 'longitude')) payload.longitude = lng
  if (hasKey(template, 'store_address')) payload.store_address = `${city.name}, Morocco`

  return payload
}

const makeProductPayload = ({ vendorId, product, imageUrl, index }, template) => {
  const payload = {}

  if (hasKey(template, 'vendor_id')) payload.vendor_id = vendorId
  if (hasKey(template, 'name')) payload.name = product.name
  if (hasKey(template, 'description')) payload.description = `Fresh ${product.name} - launch sample`
  if (hasKey(template, 'category')) payload.category = 'produce'
  if (hasKey(template, 'stock_quantity')) payload.stock_quantity = 100 + index
  if (hasKey(template, 'available_quantity')) payload.available_quantity = 100 + index
  if (hasKey(template, 'is_active')) payload.is_active = true
  if (hasKey(template, 'is_available')) payload.is_available = true
  if (hasKey(template, 'price')) payload.price = product.price
  if (hasKey(template, 'price_per_unit')) payload.price_per_unit = product.price
  if (hasKey(template, 'unit_type')) payload.unit_type = 'kg'
  if (hasKey(template, 'image_url')) payload.image_url = imageUrl

  return payload
}

const seedVendors = async (profileTemplate) => {
  console.log('Creating vendors...')
  const vendors = []
  
  for (let i = 0; i < 12; i++) {
    const city = moroccanCities[i % moroccanCities.length]
    const lat = city.lat + (Math.random() - 0.5) * 0.1
    const lng = city.lng + (Math.random() - 0.5) * 0.1
    const email = `launch.vendor.${i + 1}@qotoof.local`
    const authUser = await ensureAuthUser(email, 'LaunchVendor123!', 'vendor')

    const payload = makeProfilePayload({
      userId: authUser.id,
      email,
      role: 'vendor',
      index: i,
      city,
      lat,
      lng,
    }, profileTemplate)

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('id')

    if (error) {
      console.error(`Error upserting vendor ${i + 1}:`, error.message)
    } else if (data && data[0]) {
      vendors.push(data[0])
      console.log(`✓ Vendor ready: ${email}`)
    }
  }
  return vendors
}

const seedDrivers = async (profileTemplate) => {
  console.log('\nCreating drivers...')
  const drivers = []
  
  for (let i = 0; i < 12; i++) {
    const city = moroccanCities[i % moroccanCities.length]
    const lat = city.lat + (Math.random() - 0.5) * 0.1
    const lng = city.lng + (Math.random() - 0.5) * 0.1
    const email = `launch.driver.${i + 1}@qotoof.local`
    const authUser = await ensureAuthUser(email, 'LaunchDriver123!', 'driver')

    const payload = makeProfilePayload({
      userId: authUser.id,
      email,
      role: 'driver',
      index: i,
      city,
      lat,
      lng,
    }, profileTemplate)

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('id')

    if (error) {
      console.error(`Error upserting driver ${i + 1}:`, error.message)
    } else if (data && data[0]) {
      drivers.push(data[0])
      console.log(`✓ Driver ready: ${email}`)
    }
  }
  return drivers
}

const seedProducts = async (vendors, productTemplate) => {
  console.log('\nCreating products...')
  const created = []

  if (vendors.length === 0) {
    console.log('No vendors available for product creation')
    return created
  }
  
  for (let i = 0; i < products.length && i < 19; i++) {
    const vendor = vendors[i % vendors.length]
    const imageUrl = productImages[i % productImages.length]
    
    const payload = makeProductPayload({
      vendorId: vendor.id,
      product: products[i],
      imageUrl,
      index: i,
    }, productTemplate)

    const { data, error } = await supabase
      .from('products')
      .insert([payload])
      .select()

    if (error) {
      console.error(`Error creating product ${i + 1}:`, error.message)
    } else if (data && data[0]) {
      created.push(data[0])
      console.log(`✓ Created product: ${data[0].name}`)
    }
  }
  return created
}

const main = async () => {
  try {
    console.log('════════════════════════════════════════')
    console.log('Qotoof Production Seed Data')
    console.log('════════════════════════════════════════\n')
    
    const { data: test, error: testError } = await supabase
      .from('profiles')
      .select('id', { head: true, count: 'exact' })
      .limit(1)
    
    if (testError) {
      console.error('❌ Cannot connect to Supabase:', testError)
      process.exit(1)
    }
    
    console.log('✓ Connected to Supabase\n')
    
    const profileTemplate = await getProfileTemplate()
    const productTemplate = await getProductTemplate()

    const vendors = await seedVendors(profileTemplate)
    const drivers = await seedDrivers(profileTemplate)
    const productsData = await seedProducts(vendors, productTemplate)
    
    console.log('\n════════════════════════════════════════')
    console.log('✅ Seeding complete!')
    console.log(`   Vendors: ${vendors.length}`)
    console.log(`   Drivers: ${drivers.length}`)
    console.log(`   Products: ${productsData.length}`)
    console.log('════════════════════════════════════════\n')
    
  } catch (error) {
    console.error('❌ Error during seeding:', error)
    process.exit(1)
  }
}

main()
