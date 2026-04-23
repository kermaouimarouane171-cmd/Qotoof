/**
 * Script to hash existing backup codes
 * Run: npm run hash:backup-codes
 * 
 * This script:
 * 1. Connects to Supabase
 * 2. Fetches all users with unhashed backup codes
 * 3. Hashes each code using SHA-256
 * 4. Updates the database with hashed codes
 * 5. Logs the process
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Hash a single backup code using SHA-256
 */
function hashBackupCode(code) {
  if (!code || typeof code !== 'string') {
    throw new Error('Invalid backup code')
  }
  
  return crypto
    .createHash('sha256')
    .update(code.trim())
    .digest('hex')
}

/**
 * Hash multiple backup codes
 */
function hashBackupCodes(codes) {
  if (!Array.isArray(codes)) {
    throw new Error('Codes must be an array')
  }
  
  return codes.map(code => hashBackupCode(code))
}

/**
 * Main process
 */
async function hashBackupCodesProcess() {
  console.log('🔐 Starting backup codes hashing process...')
  
  try {
    // 1. Get all users with unhashed backup codes
    console.log('📋 Fetching users with unhashed backup codes...')
    
    const { data: settings, error: fetchError } = await supabase
      .from('mfa_settings')
      .select('user_id, totp_backup_codes, totp_backup_codes_hashed')
      .eq('totp_backup_codes_hashed', false)
      .not('totp_backup_codes', 'is', null)
    
    if (fetchError) {
      throw new Error(`Failed to fetch backup codes: ${fetchError.message}`)
    }
    
    if (!settings || settings.length === 0) {
      console.log('✅ No unhashed backup codes found!')
      return
    }
    
    console.log(`Found ${settings.length} users with unhashed backup codes`)
    
    // 2. Process each user
    let successCount = 0
    let errorCount = 0
    
    for (const setting of settings) {
      try {
        const { user_id, totp_backup_codes } = setting
        
        // Skip if codes are not an array
        if (!Array.isArray(totp_backup_codes)) {
          console.warn(`⚠️ User ${user_id} has invalid backup codes format (not an array)`)
          errorCount++
          continue
        }
        
        // Hash each code
        const hashedCodes = hashBackupCodes(totp_backup_codes)
        
        // Update database
        const { error: updateError } = await supabase
          .from('mfa_settings')
          .update({
            totp_backup_codes: hashedCodes,
            totp_backup_codes_hashed: true
          })
          .eq('user_id', user_id)
        
        if (updateError) {
          throw new Error(`Failed to update codes: ${updateError.message}`)
        }
        
        console.log(`✓ User ${user_id} - ${totp_backup_codes.length} codes hashed`)
        successCount++
        
      } catch (error) {
        console.error(`✗ Error processing user ${setting.user_id}: ${error.message}`)
        errorCount++
      }
    }
    
    // 3. Summary
    console.log(`\n📊 Summary:`)
    console.log(`✅ Successfully processed: ${successCount}`)
    console.log(`❌ Failed: ${errorCount}`)
    console.log(`Total: ${successCount + errorCount}`)
    
    if (errorCount === 0) {
      console.log('\n🎉 All backup codes have been successfully hashed!')
    } else {
      console.log(`\n⚠️ ${errorCount} users still need manual review`)
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    process.exit(1)
  }
}

// Run the process
hashBackupCodesProcess()
