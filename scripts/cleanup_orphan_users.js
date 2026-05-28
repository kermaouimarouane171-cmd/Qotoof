#!/usr/bin/env node
/**
 * scripts/cleanup_orphan_users.js
 *
 * Finds auth.users that have no matching profiles row (orphan auth accounts)
 * and reports them. With --fix flag, deletes them.
 *
 * Usage:
 *   node scripts/cleanup_orphan_users.js            # dry run (report only)
 *   node scripts/cleanup_orphan_users.js --fix       # delete orphans
 *   node scripts/cleanup_orphan_users.js --fix --max 50  # delete up to 50
 *
 * Requirements: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env or .env file
 */

'use strict'

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const fs = require('fs')

// Load .env if present
const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const match = line.match(/^\s*([\w]+)\s*=\s*(.+)\s*$/)
    if (match) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
}

const SUPABASE_URL             = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

const args    = process.argv.slice(2)
const FIX     = args.includes('--fix')
const maxIdx  = args.indexOf('--max')
const MAX_DELETE = maxIdx !== -1 && args[maxIdx + 1] ? parseInt(args[maxIdx + 1], 10) : Infinity

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function listAllAuthUsers() {
  const users = []
  let page = 1
  const perPage = 1000

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    if (!data?.users?.length) break
    users.push(...data.users)
    if (data.users.length < perPage) break
    page++
  }

  return users
}

async function getProfileIds() {
  const ids = new Set()
  let rangeStart = 0
  const batchSize = 1000

  while (true) {
    const { data, error } = await adminClient
      .from('profiles')
      .select('id')
      .range(rangeStart, rangeStart + batchSize - 1)
    if (error) throw new Error(`profiles select failed: ${error.message}`)
    if (!data?.length) break
    for (const row of data) ids.add(row.id)
    if (data.length < batchSize) break
    rangeStart += batchSize
  }

  return ids
}

async function main() {
  console.log('=== Orphan Auth User Cleanup ===')
  console.log(`Mode: ${FIX ? 'FIX (will delete)' : 'DRY RUN (report only)'}`)
  console.log('')

  console.log('Fetching auth users...')
  const authUsers = await listAllAuthUsers()
  console.log(`  Found ${authUsers.length} auth users`)

  console.log('Fetching profile IDs...')
  const profileIds = await getProfileIds()
  console.log(`  Found ${profileIds.size} profiles`)

  const orphans = authUsers.filter((u) => !profileIds.has(u.id))

  console.log('')
  console.log(`Orphan auth users (no matching profile): ${orphans.length}`)

  if (!orphans.length) {
    console.log('No orphans found. Database is clean.')
    return
  }

  // Print table
  console.log('')
  console.log('ID                                   | Email                        | Created At')
  console.log('-'.repeat(90))
  for (const u of orphans) {
    console.log(`${u.id} | ${(u.email ?? '(no email)').padEnd(28)} | ${u.created_at}`)
  }

  if (!FIX) {
    console.log('')
    console.log('Run with --fix to delete these users.')
    return
  }

  console.log('')
  const toDelete = orphans.slice(0, MAX_DELETE === Infinity ? orphans.length : MAX_DELETE)
  console.log(`Deleting ${toDelete.length} orphan(s)...`)

  let deleted = 0
  let failed  = 0

  for (const u of toDelete) {
    const { error } = await adminClient.auth.admin.deleteUser(u.id)
    if (error) {
      console.error(`  FAILED ${u.id} (${u.email}): ${error.message}`)
      failed++
    } else {
      console.log(`  Deleted ${u.id} (${u.email})`)
      deleted++
    }
  }

  console.log('')
  console.log(`Done. Deleted: ${deleted}, Failed: ${failed}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
