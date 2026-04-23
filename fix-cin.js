/**
 * Fix CIN for test accounts
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

async function fixCIN() {
  const accounts = [
    { email: 'qa.buyer@qotoof.ma', cin: 'AB12345' },
    { email: 'qa.vendor@qotoof.ma', cin: 'FA23456' },
    { email: 'qa.driver@qotoof.ma', cin: 'YM34567' },
  ]

  for (const account of accounts) {
    // Get user ID
    const { data: users, error: userError } = await supabase.auth.admin.listUsers()
    const user = users.users.find(u => u.email === account.email)
    
    if (!user) {
      console.log(`❌ User not found: ${account.email}`)
      continue
    }

    // Update CIN
    const { error } = await supabase
      .from('profiles')
      .update({ cin: account.cin })
      .eq('id', user.id)

    if (error) {
      console.log(`❌ ${account.email}: ${error.message}`)
    } else {
      console.log(`✅ ${account.email}: CIN = ${account.cin}`)
    }
  }
}

fixCIN()
