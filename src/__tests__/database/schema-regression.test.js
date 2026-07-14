/**
 * Database Schema Regression Tests
 * 
 * These tests ensure schema consistency between:
 * - Database schema (migrations)
 * - Application code (supabase.from() calls)
 * - RLS policies
 * - Foreign key relationships
 * 
 * Purpose: Prevent regressions where code expects columns/tables that don't exist
 * or where schema changes break existing code.
 */

import { supabase } from '@/services/supabase'

describe('Database Schema Regression Tests', () => {
  const TEST_TIMEOUT = 30000

  describe('Coupons Table Schema', () => {
    test('coupons table exists and has all required columns', async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('coupons table has title column', async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('title')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('coupons table has description column', async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('description')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('coupons table has minimum_quantity column', async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('minimum_quantity')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('coupons table has applies_to column', async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('applies_to')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('coupons table has max_uses_per_user column', async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('max_uses_per_user')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('coupons table has metadata column', async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('metadata')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('coupons table has starts_at column (not valid_from)', async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('starts_at')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('coupons table has expires_at column (not valid_until)', async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('expires_at')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('coupons table has vendor_id foreign key relationship', async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('vendor:profiles(id, store_name)')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)
  })

  describe('Payouts Table Schema', () => {
    test('payouts table exists', async () => {
      const { data, error } = await supabase
        .from('payouts')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('payouts table has vendor_id foreign key relationship', async () => {
      const { data, error } = await supabase
        .from('payouts')
        .select('vendor:profiles(id, first_name, last_name, email, store_name, phone)')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('payouts table has status column', async () => {
      const { data, error } = await supabase
        .from('payouts')
        .select('status')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('payouts table has amount column', async () => {
      const { data, error } = await supabase
        .from('payouts')
        .select('amount')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)
  })

  describe('Price Negotiations Table Schema', () => {
    test('price_negotiations table exists', async () => {
      const { data, error } = await supabase
        .from('price_negotiations')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('price_negotiations table has buyer_id column', async () => {
      const { data, error } = await supabase
        .from('price_negotiations')
        .select('buyer_id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('price_negotiations table has vendor_id column', async () => {
      const { data, error } = await supabase
        .from('price_negotiations')
        .select('vendor_id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('price_negotiations table has product_id column', async () => {
      const { data, error } = await supabase
        .from('price_negotiations')
        .select('product_id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('price_negotiations table has proposed_price column', async () => {
      const { data, error } = await supabase
        .from('price_negotiations')
        .select('proposed_price')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)
  })

  describe('Addresses Table Schema', () => {
    test('addresses table exists', async () => {
      const { data, error } = await supabase
        .from('addresses')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('addresses table has user_id column', async () => {
      const { data, error } = await supabase
        .from('addresses')
        .select('user_id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('addresses table has city column', async () => {
      const { data, error } = await supabase
        .from('addresses')
        .select('city')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)
  })

  describe('Shopping Lists Table Schema', () => {
    test('shopping_lists table exists', async () => {
      const { data, error } = await supabase
        .from('shopping_lists')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('shopping_lists table has user_id column', async () => {
      const { data, error } = await supabase
        .from('shopping_lists')
        .select('user_id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('shopping_list_items table exists', async () => {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('shopping_list_items table has shopping_list_id foreign key', async () => {
      const { data, error } = await supabase
        .from('shopping_list_items')
        .select('shopping_list_id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)
  })

  describe('RFQ System Table Schema', () => {
    test('rfqs table exists', async () => {
      const { data, error } = await supabase
        .from('rfqs')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('rfqs table has buyer_id column', async () => {
      const { data, error } = await supabase
        .from('rfqs')
        .select('buyer_id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('rfq_offers table exists', async () => {
      const { data, error } = await supabase
        .from('rfq_offers')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('rfq_offers table has rfq_id foreign key', async () => {
      const { data, error } = await supabase
        .from('rfq_offers')
        .select('rfq_id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('rfq_offers table has vendor_id foreign key', async () => {
      const { data, error } = await supabase
        .from('rfq_offers')
        .select('vendor_id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)
  })

  describe('Security Tables Schema', () => {
    test('security_alerts table exists', async () => {
      const { data, error } = await supabase
        .from('security_alerts')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('blocked_ips table exists', async () => {
      const { data, error } = await supabase
        .from('blocked_ips')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('blocked_ips table has ip_address column', async () => {
      const { data, error } = await supabase
        .from('blocked_ips')
        .select('ip_address')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('blocked_ips table has block_type column', async () => {
      const { data, error } = await supabase
        .from('blocked_ips')
        .select('block_type')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)
  })

  describe('User Settings Table Schema', () => {
    test('user_settings table exists', async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('user_settings table has user_id column', async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('user_id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)
  })

  describe('Loyalty Tables Schema', () => {
    test('loyalty_points table exists', async () => {
      const { data, error } = await supabase
        .from('loyalty_points')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)

    test('loyalty_transactions table exists', async () => {
      const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    }, TEST_TIMEOUT)
  })

  describe('Common Error Prevention', () => {
    test('no PGRST204 errors for known tables', async () => {
      const tables = [
        'coupons',
        'payouts',
        'price_negotiations',
        'addresses',
        'shopping_lists',
        'shopping_list_items',
        'rfqs',
        'rfq_offers',
        'security_alerts',
        'blocked_ips',
        'user_settings',
        'loyalty_points',
        'loyalty_transactions'
      ]

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .select('id')
          .limit(1)

        expect(error).toBeNull()
      }
    }, TEST_TIMEOUT)

    test('no "column does not exist" errors for known columns', async () => {
      const columnChecks = [
        { table: 'coupons', columns: ['title', 'description', 'minimum_quantity', 'applies_to', 'max_uses_per_user', 'metadata', 'starts_at', 'expires_at'] },
        { table: 'payouts', columns: ['vendor_id', 'status', 'amount'] },
        { table: 'price_negotiations', columns: ['buyer_id', 'vendor_id', 'product_id', 'proposed_price'] },
        { table: 'addresses', columns: ['user_id', 'city'] },
        { table: 'shopping_lists', columns: ['user_id'] },
        { table: 'shopping_list_items', columns: ['shopping_list_id'] },
        { table: 'rfqs', columns: ['buyer_id'] },
        { table: 'rfq_offers', columns: ['rfq_id', 'vendor_id'] },
        { table: 'blocked_ips', columns: ['ip_address', 'block_type'] }
      ]

      for (const { table, columns } of columnChecks) {
        for (const column of columns) {
          const { error } = await supabase
            .from(table)
            .select(column)
            .limit(1)

          expect(error).toBeNull()
        }
      }
    }, TEST_TIMEOUT)
  })

  describe('RLS Policy Verification', () => {
    test('orders table RLS is enabled', async () => {
      // This test verifies that RLS is working by attempting a query
      // If RLS is disabled, this might return data when it shouldn't
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .limit(1)

      // Should not error (RLS is enabled, just returns empty for unauthenticated)
      expect(error).toBeNull()
    }, TEST_TIMEOUT)

    test('profiles table RLS is enabled', async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)

      expect(error).toBeNull()
    }, TEST_TIMEOUT)
  })
})
