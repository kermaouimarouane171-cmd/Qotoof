/**
 * Diagnose and fix the profiles table trigger
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

async function diagnose() {
  console.log('🔍 Diagnosing profiles table...\n')

  // 1. Check if profiles table exists
  const { data: tables, error: tableError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1)

  if (tableError) {
    console.log('❌ profiles table error:', tableError.message)
  } else {
    console.log('✅ profiles table exists')
  }

  // 2. Check existing triggers
  const { data: triggers, error: triggerError } = await supabase.rpc('get_triggers')
  if (triggerError) {
    console.log('⚠️  Cannot check triggers via RPC')
  }

  // 3. Try to create a test user directly
  console.log('\n📝 Attempting to create diagnostic user...')
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'diagnostic.user@qotoof.ma',
    password: 'Test@1234',
    email_confirm: true,
    user_metadata: {
      first_name: 'Diagnostic',
      last_name: 'User',
      role: 'buyer',
    }
  })

  if (error) {
    console.log('❌ Error:', error.message)
    console.log('\n💡 This means the trigger on auth.users is failing.')
    console.log('\n🔧 Solution: Run this SQL in Supabase SQL Editor:')
    console.log(`
-- Check the trigger function
SELECT pg_get_functiondef('handle_new_user()'::regproc);

-- Check if trigger exists
SELECT * FROM information_schema.triggers 
WHERE event_object_table = 'users' 
AND trigger_schema = 'auth';

-- Recreate the trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`)
  } else {
    console.log('✅ Test user created:', data.user.id)
    console.log('   Email:', data.user.email)
  }
}

diagnose()
