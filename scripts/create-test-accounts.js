/**
 * Create test accounts for all roles
 * Run with: node scripts/create-test-accounts.js
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Parse .env file manually
const envContent = readFileSync('.env', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=')
    env[key.trim()] = valueParts.join('=').trim()
  }
})

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

const testAccounts = [
  {
    role: 'buyer',
    firstName: 'Ahmed',
    lastName: 'Benali',
    email: 'qa.buyer@qotoof.ma',
    password: 'Test@1234',
    phone: '+212661234567',
    cin: 'AB12345',
  },
  {
    role: 'vendor',
    firstName: 'Fatima',
    lastName: 'Alaoui',
    email: 'qa.vendor@qotoof.ma',
    password: 'Test@1234',
    phone: '+212662345678',
    cin: 'FA23456',
  },
  {
    role: 'driver',
    firstName: 'Youssef',
    lastName: 'Mansouri',
    email: 'qa.driver@qotoof.ma',
    password: 'Test@1234',
    phone: '+212663456789',
    cin: 'YM34567',
    vehicleType: 'van',
    vehiclePlate: 'ABC-1234',
  },
]

async function createAccounts() {
  console.log('🚀 Creating test accounts...\n')

  for (const account of testAccounts) {
    console.log(`📝 Creating ${account.role} account: ${account.email}`)
    console.log(`   Name: ${account.firstName} ${account.lastName}`)
    console.log(`   Password: ${account.password}`)
    console.log(`   Phone: ${account.phone}`)
    console.log(`   CIN: ${account.cin}`)
    if (account.role === 'driver') {
      console.log(`   Vehicle: ${account.vehicleType} (${account.vehiclePlate})`)
    }

    // 1. Create auth user (using admin API to bypass rate limits)
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true, // Skip email verification
      user_metadata: {
        first_name: account.firstName,
        last_name: account.lastName,
        role: account.role,
      }
    })

    if (error) {
      if (error.message.includes('already registered')) {
        console.log(`   ⚠️  Account already exists, skipping...\n`)
        continue
      }
      console.log(`   ❌ Error: ${error.message}\n`)
      continue
    }

    // 2. Create profile
    if (data.user) {
      const profileData = {
        id: data.user.id,
        first_name: account.firstName,
        last_name: account.lastName,
        email: account.email,
        role: account.role,
        phone: account.phone,
        cin: account.cin,
      }

      if (account.role === 'driver') {
        profileData.vehicle_type = account.vehicleType
        profileData.vehicle_plate = account.vehiclePlate
        profileData.is_available_for_delivery = true
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileData)

      if (profileError) {
        console.log(`   ⚠️  Profile error: ${profileError.message}`)
      } else {
        console.log(`   ✅ Profile created`)
      }
    }

    console.log('')
  }

  console.log('✅ Done!\n')
  console.log('📋 Summary:')
  console.log('─────────────────────────────────────────────')
  for (const account of testAccounts) {
    console.log(`\n${account.role.toUpperCase()}:`)
    console.log(`  Email:    ${account.email}`)
    console.log(`  Password: ${account.password}`)
    console.log(`  Name:     ${account.firstName} ${account.lastName}`)
    console.log(`  Phone:    ${account.phone}`)
    console.log(`  CIN:      ${account.cin}`)
    if (account.role === 'driver') {
      console.log(`  Vehicle:  ${account.vehicleType} (${account.vehiclePlate})`)
    }
  }
  console.log('\n─────────────────────────────────────────────')
}

createAccounts()
