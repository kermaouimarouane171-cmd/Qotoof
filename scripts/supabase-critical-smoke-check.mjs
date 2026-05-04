#!/usr/bin/env node

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const schemaDumpPath = path.join(os.tmpdir(), `qotoof-public-schema-${process.pid}.sql`)

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

const results = []

const addResult = (name, passed, details) => {
  results.push({ name, passed, details })
}

const runCheck = (name, validator) => {
  try {
    const details = validator()
    addResult(name, true, details)
  } catch (error) {
    addResult(name, false, error.message)
  }
}

const ensureIncludes = (content, snippet, message) => {
  if (!content.includes(snippet)) {
    throw new Error(message)
  }
}

const ensureAbsent = (content, snippet, message) => {
  if (content.includes(snippet)) {
    throw new Error(message)
  }
}

const extractSection = (content, anchor, sectionLength = 500) => {
  const start = content.indexOf(anchor)
  if (start === -1) return ''
  return content.slice(start, start + sectionLength)
}

const runSupabase = (args) => {
  const result = spawnSync('supabase', args, {
    cwd: projectRoot,
    encoding: 'utf8',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `supabase ${args.join(' ')} failed`)
  }

  return result
}

const printResults = () => {
  console.log(`${CYAN}Supabase critical smoke check${RESET}`)
  for (const result of results) {
    const color = result.passed ? GREEN : RED
    const symbol = result.passed ? 'PASS' : 'FAIL'
    console.log(`${color}${symbol}${RESET} ${result.name}: ${result.details}`)
  }
}

try {
  console.log('Dumping linked public schema for critical policy verification...')
  runSupabase(['db', 'dump', '--linked', '--schema', 'public', '--file', schemaDumpPath])

  const schema = await fs.readFile(schemaDumpPath, 'utf8')

  runCheck('delivery_zones unique constraint exists', () => {
    ensureIncludes(
      schema,
      'ADD CONSTRAINT "delivery_zones_city_zone_name_key" UNIQUE ("city", "zone_name")',
      'delivery_zones_city_zone_name_key is missing from the dumped schema'
    )
    return 'delivery_zones_city_zone_name_key is present'
  })

  runCheck('payments admin policy is role-gated', () => {
    const paymentsSection = extractSection(schema, 'CREATE POLICY "Admins can view all payments" ON "public"."payments"')
    ensureIncludes(paymentsSection, '"profiles"."role" = \'admin\'::"public"."user_role"', 'payments admin policy is missing the admin role gate')
    return 'payments policy still requires an authenticated admin profile'
  })

  runCheck('driver location policies are narrowed', () => {
    ensureIncludes(schema, 'CREATE POLICY "driver_owns_location" ON "public"."driver_locations"', 'driver_owns_location policy is missing')
    ensureIncludes(schema, 'CREATE POLICY "order_parties_see_location" ON "public"."driver_locations"', 'order_parties_see_location policy is missing')
    ensureIncludes(schema, 'CREATE POLICY "admin_see_driver_locations" ON "public"."driver_locations"', 'admin_see_driver_locations policy is missing')
    ensureAbsent(schema, 'CREATE POLICY "Anyone can view available drivers"', 'legacy public driver location policy still exists')
    ensureAbsent(schema, 'CREATE POLICY "Admins can view all locations"', 'legacy admin driver location policy still exists')
    return 'critical driver location policies look correct'
  })

  runCheck('delivery request policies are narrowed', () => {
    const deliveryInsertSection = extractSection(schema, 'CREATE POLICY "service_creates_delivery_requests" ON "public"."delivery_requests"')
    ensureIncludes(schema, 'CREATE POLICY "own_delivery_requests" ON "public"."delivery_requests"', 'own_delivery_requests policy is missing')
    ensureIncludes(schema, 'CREATE POLICY "assigned_delivery_requests" ON "public"."delivery_requests"', 'assigned_delivery_requests policy is missing')
    ensureIncludes(schema, 'CREATE POLICY "update_assigned_delivery_requests" ON "public"."delivery_requests"', 'update_assigned_delivery_requests policy is missing')
    ensureIncludes(schema, 'CREATE POLICY "admin_delivery_requests" ON "public"."delivery_requests"', 'admin_delivery_requests policy is missing')
    ensureIncludes(deliveryInsertSection, '"auth"."role"() = \'service_role\'::"text"', 'service_creates_delivery_requests is no longer service-role bound')
    ensureAbsent(schema, 'CREATE POLICY "Admins can view all delivery requests"', 'legacy admin delivery request policy still exists')
    ensureAbsent(schema, 'CREATE POLICY "System can create delivery requests"', 'legacy service delivery request policy still exists')
    return 'critical delivery request policies look correct'
  })

  printResults()

  const hasFailure = results.some((result) => !result.passed)
  process.exit(hasFailure ? 1 : 0)
} catch (error) {
  console.error(`${RED}Smoke check failed before validation:${RESET} ${error.message}`)
  process.exit(1)
} finally {
  await fs.rm(schemaDumpPath, { force: true })
}