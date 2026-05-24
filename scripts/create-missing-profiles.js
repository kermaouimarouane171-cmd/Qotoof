/**
 * Create missing profiles for existing users
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function createMissingProfiles() {
  console.log('🔍 Checking for users without profiles...\n')

  // Get all users
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    console.log('❌ Error listing users:', usersError.message)
    return
  }

  console.log(`Found ${users.length} users\n`)

  for (const user of users) {
    // Check if profile exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profile) {
      console.log(`✅ ${user.email}: Profile exists`)
      continue
    }

    // Create profile
    const metadata = user.user_metadata || {}
    const firstName = metadata.first_name || 'User'
    const lastName = metadata.last_name || ''
    const role = metadata.role || 'buyer'

    const { error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        first_name: firstName,
        last_name: lastName,
        role: role,
        created_at: user.created_at,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      console.log(`❌ ${user.email}: ${error.message}`)
    } else {
      console.log(`✅ ${user.email}: Profile created (${role})`)
    }
  }

  console.log('\n✅ Done!')
}

createMissingProfiles()
