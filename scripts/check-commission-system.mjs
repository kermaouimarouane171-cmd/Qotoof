/* global process, console */

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('❌ Missing env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)')
  process.exit(1)
}

const supabase = createClient(url, key)

const formatMoney = (value) =>
  new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const checks = []

const runCheck = async (name, fn) => {
  try {
    const details = await fn()
    checks.push({ name, status: 'PASS', details })
  } catch (error) {
    checks.push({ name, status: 'FAIL', details: error.message })
  }
}

await runCheck('Table vendor_monthly_sales exists', async () => {
  const { error } = await supabase.from('vendor_monthly_sales').select('id', { head: true, count: 'exact' }).limit(1)
  if (error) throw error
  return 'reachable'
})

await runCheck('Table confirmed_transactions exists', async () => {
  const { error } = await supabase.from('confirmed_transactions').select('id', { head: true, count: 'exact' }).limit(1)
  if (error) throw error
  return 'reachable'
})

await runCheck('Table vendor_contracts exists', async () => {
  const { error } = await supabase.from('vendor_contracts').select('id', { head: true, count: 'exact' }).limit(1)
  if (error) throw error
  return 'reachable'
})

await runCheck('Order status payment_received usable', async () => {
  const { error } = await supabase.from('orders').select('id').eq('status', 'payment_received').limit(1)
  if (error) throw error
  return 'status accepted by schema'
})

await runCheck('Pending/overdue commission snapshot', async () => {
  const { data, error } = await supabase
    .from('vendor_monthly_sales')
    .select('status, commission_due')
    .in('status', ['pending', 'overdue'])

  if (error) throw error

  const totalDue = (data || []).reduce((sum, row) => sum + Number(row.commission_due || 0), 0)
  return `rows=${data?.length || 0}, total_due=${formatMoney(totalDue)}`
})

await runCheck('Vendors missing digital contract', async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, vendor_agreement_accepted')
    .eq('role', 'vendor')

  if (error) throw error

  const missing = (data || []).filter((row) => !row.vendor_agreement_accepted).length
  return `missing=${missing}`
})

console.log('\n=== COMMISSION SYSTEM VALIDATION REPORT ===')
for (const check of checks) {
  const icon = check.status === 'PASS' ? '✅' : '❌'
  console.log(`${icon} ${check.name}`)
  console.log(`   ${check.details}`)
}

const failed = checks.filter((c) => c.status === 'FAIL').length
console.log('\nSummary:')
console.log(`- Passed: ${checks.length - failed}`)
console.log(`- Failed: ${failed}`)

if (failed > 0) {
  process.exit(1)
}
