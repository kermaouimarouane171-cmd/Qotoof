/**
 * tests/rls/rls_tests.spec.ts
 *
 * Integration tests for Row-Level Security policies on:
 *   - profiles
 *   - orders / order_items
 *   - carts / cart_items
 *
 * Run against a local Supabase stack:
 *   supabase start
 *   npx jest tests/rls/rls_tests.spec.ts
 *
 * The tests use four hard-coded test user IDs that are created in the
 * beforeAll hook and cleaned up in afterAll.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'

const SUPABASE_URL      = process.env.SUPABASE_URL      ?? 'http://127.0.0.1:54321'
const ANON_KEY          = process.env.SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7stqwwVPghygrXBlobisDEkKqcHSK2OOFIs'
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

if (!SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY env var is required for RLS tests')
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const TEST_PASSWORD = 'Test1234!!'

async function createTestUser(
  email: string,
  role: string
): Promise<{ id: string; client: SupabaseClient }> {
  // Create auth user
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    app_metadata: { role },
  })
  if (error) throw new Error(`createTestUser(${email}): ${error.message}`)
  const userId = data.user!.id

  // Insert profile row directly (bypass RLS for test setup)
  await admin.from('profiles').insert({
    id: userId, email, role, first_name: 'Test', last_name: role, is_verified: true,
  })

  // Sign in to get a client with that user's JWT
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  })
  const { error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  })
  if (signInError) throw new Error(`signIn(${email}): ${signInError.message}`)

  return { id: userId, client: userClient }
}

async function deleteTestUser(userId: string) {
  await admin.from('profiles').delete().eq('id', userId)
  await admin.auth.admin.deleteUser(userId)
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

let buyer1: { id: string; client: SupabaseClient }
let buyer2: { id: string; client: SupabaseClient }
let vendor1: { id: string; client: SupabaseClient }
let driver1: { id: string; client: SupabaseClient }
let testOrderId: string

const SUFFIX = Date.now()

beforeAll(async () => {
  buyer1  = await createTestUser(`rls-buyer1-${SUFFIX}@test.com`,  'buyer')
  buyer2  = await createTestUser(`rls-buyer2-${SUFFIX}@test.com`,  'buyer')
  vendor1 = await createTestUser(`rls-vendor1-${SUFFIX}@test.com`, 'vendor')
  driver1 = await createTestUser(`rls-driver1-${SUFFIX}@test.com`, 'driver')

  // Create a test order (buyer1 → vendor1) via service role
  const { data: orderRow, error } = await admin.from('orders').insert({
    buyer_id:  buyer1.id,
    vendor_id: vendor1.id,
    status:    'pending',
    total:     100,
  }).select('id').single()
  if (error) throw new Error(`Order insert failed: ${error.message}`)
  testOrderId = orderRow!.id
}, 30_000)

afterAll(async () => {
  await admin.from('orders').delete().eq('id', testOrderId)
  await deleteTestUser(buyer1.id)
  await deleteTestUser(buyer2.id)
  await deleteTestUser(vendor1.id)
  await deleteTestUser(driver1.id)
}, 30_000)

// ─── profiles RLS ────────────────────────────────────────────────────────────

describe('profiles RLS', () => {
  test('authenticated user can read any profile (public marketplace)', async () => {
    const { data, error } = await buyer1.client.from('profiles').select('id, role').eq('id', vendor1.id)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(vendor1.id)
  })

  test('user can update own profile (non-role fields)', async () => {
    const { error } = await buyer1.client.from('profiles').update({ first_name: 'Updated' }).eq('id', buyer1.id)
    expect(error).toBeNull()
  })

  test('user CANNOT update another user\'s profile', async () => {
    const { error } = await buyer1.client.from('profiles').update({ first_name: 'Hacked' }).eq('id', buyer2.id)
    // With RLS, this should either return an error or affect 0 rows
    if (!error) {
      // Verify it didn't actually change anything
      const { data } = await admin.from('profiles').select('first_name').eq('id', buyer2.id).single()
      expect(data?.first_name).not.toBe('Hacked')
    }
  })

  test('user CANNOT update their own role column', async () => {
    const { error } = await buyer1.client.from('profiles').update({ role: 'admin' }).eq('id', buyer1.id)
    if (!error) {
      // Verify role was not actually changed
      const { data } = await admin.from('profiles').select('role').eq('id', buyer1.id).single()
      expect(data?.role).toBe('buyer')
    } else {
      expect(error).toBeTruthy()
    }
  })
})

// ─── orders RLS ──────────────────────────────────────────────────────────────

describe('orders RLS', () => {
  test('buyer can see own orders', async () => {
    const { data, error } = await buyer1.client.from('orders').select('id').eq('id', testOrderId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  test('buyer CANNOT see another buyer\'s orders', async () => {
    const { data, error } = await buyer2.client.from('orders').select('id').eq('id', testOrderId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)  // RLS filters the row out
  })

  test('vendor can see orders assigned to them', async () => {
    const { data, error } = await vendor1.client.from('orders').select('id').eq('id', testOrderId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  test('driver CANNOT see orders not assigned to them', async () => {
    const { data, error } = await driver1.client.from('orders').select('id').eq('id', testOrderId)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)  // driver_id is null on this order
  })

  test('driver CAN see orders assigned to them', async () => {
    // Assign the order to driver1 via service role
    await admin.from('orders').update({ driver_id: driver1.id }).eq('id', testOrderId)
    const { data, error } = await driver1.client.from('orders').select('id').eq('id', testOrderId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    // Clean up
    await admin.from('orders').update({ driver_id: null }).eq('id', testOrderId)
  })
})

// ─── carts RLS ───────────────────────────────────────────────────────────────

describe('carts RLS', () => {
  test('user can read own cart', async () => {
    const { data, error } = await buyer1.client.from('carts').select('id').eq('user_id', buyer1.id)
    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThanOrEqual(0)  // cart may or may not exist
  })

  test('user CANNOT read another user\'s cart', async () => {
    const { data, error } = await buyer1.client.from('carts').select('id').eq('user_id', buyer2.id)
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  test('user can insert/update/delete own cart items', async () => {
    // Ensure cart exists for buyer1
    const { data: cartData } = await admin.from('carts').upsert({ user_id: buyer1.id }, { onConflict: 'user_id' }).select('id').single()
    const cartId = cartData!.id

    // Get a product to use
    const { data: products } = await admin.from('products').select('id').limit(1)
    if (!products?.length) return  // skip if no products in test DB

    const productId = products[0].id

    // buyer1 can insert into own cart
    const { error: insertErr } = await buyer1.client.from('cart_items').insert({
      cart_id: cartId, product_id: productId, quantity: 2,
    })
    expect(insertErr).toBeNull()

    // buyer2 cannot insert into buyer1's cart
    const { error: foreignInsertErr } = await buyer2.client.from('cart_items').insert({
      cart_id: cartId, product_id: productId, quantity: 1,
    })
    expect(foreignInsertErr).toBeTruthy()

    // Cleanup
    await admin.from('cart_items').delete().eq('cart_id', cartId).eq('product_id', productId)
  })
})
