// Supabase Edge Function: get-bank-details
// Returns Moroccan bank details for bank transfer payments
// Deploy: supabase functions deploy get-bank-details --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enforceServerRateLimit, getClientIp } from '../_shared/serverRateLimit.ts'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

// ============================================
// Environment Configuration
// ============================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// ============================================
// CORS Headers Helper
// ============================================

// CORS headers are resolved dynamically per-request origin via getCorsHeaders(origin).
// See supabase/functions/_shared/cors.ts and the ALLOWED_ORIGINS Edge Function secret.

const corsHeaders = (req: Request): HeadersInit => ({
  ...getCorsHeaders(req.headers.get('Origin')),
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
})

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { value: unknown; expiresAt: number }>()
const BANK_DETAILS_REQUEST_LIMIT = {
  maxAttempts: 60,
  windowSeconds: 60,
  blockSeconds: 60,
}

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  try {
    // Handle CORS preflight
    const optionsResponse = handleOptions(req)
    if (optionsResponse) {
      return new Response('ok', { headers: corsHeaders(req) })
    }

    if (!['GET', 'POST'].includes(req.method)) {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
        }
      )
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase configuration error')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
        }
      )
    }

    // Public endpoint abuse protection must be distributed, not instance-local.
    const clientIp = getClientIp(req)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const rateLimitResult = await enforceServerRateLimit({
      supabase,
      scope: 'get_bank_details_request',
      identifierParts: ['get-bank-details', clientIp],
      maxAttempts: BANK_DETAILS_REQUEST_LIMIT.maxAttempts,
      windowSeconds: BANK_DETAILS_REQUEST_LIMIT.windowSeconds,
      blockSeconds: BANK_DETAILS_REQUEST_LIMIT.blockSeconds,
    })

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests, try again later' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitResult.retry_after_seconds || BANK_DETAILS_REQUEST_LIMIT.blockSeconds),
            ...corsHeaders(req),
          },
        }
      )
    }

    const now = Date.now()

    // Parse request body (optional bankCode filter)
    let bankCode: string | undefined
    let referenceNumber: string | undefined

    if (req.method === 'POST') {
      try {
        const body = await req.json()
        bankCode = body.bankCode
        referenceNumber = body.referenceNumber
      } catch {
        // No body provided, that's ok — return all banks
      }
    }

    // Build query
    let query = supabase
      .from('moroccan_banks')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    // Filter by bank code if provided
    if (bankCode) {
      query = query.eq('bank_code', bankCode)
    }

    const cacheKey = bankCode ? `bank:${bankCode}` : 'bank:all'
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return new Response(JSON.stringify(cached.value), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          ...corsHeaders(req),
        },
      })
    }

    let banks: unknown[] | null = null
    let banksError: Error | null = null

    try {
      const result = await query
      banks = result.data
      banksError = result.error
    } catch (error) {
      console.error('Failed to fetch bank details:', error)
      banksError = error instanceof Error ? error : new Error('Failed to fetch bank details')
    }

    // If the table is missing or schema mismatch, return fallback hardcoded list
    // rather than a 500 error so the frontend can still display bank options.
    if (banksError) {
      console.warn('moroccan_banks table unavailable, returning fallback bank details:', banksError.message)
    }

    // If a specific bank was requested and the table is unavailable, return error.
    if (bankCode && banksError) {
      return new Response(
        JSON.stringify({ error: `Bank lookup failed: ${bankCode}`, details: banksError.message }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
        }
      )
    }

    // If a specific bank was requested but not found in the database, return error
    if (bankCode && (!banks || banks.length === 0)) {
      return new Response(
        JSON.stringify({ error: `Bank not found: ${bankCode}` }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
        }
      )
    }

    // If no banks found in database, return fallback hardcoded list
    // (This ensures the frontend always has bank info even if the table is empty)
    if (!banks || banks.length === 0) {
      const fallbackBanks = [
        {
          bank_code: 'BMCE',
          bank_name: 'BMCE Bank of Africa',
          bank_name_ar: 'بنك أفريقيا',
          iban: 'MA64010500000000000000000000',
          bic: 'BMCEMAMC',
          account_number: '0000000000000000',
          display_order: 1,
          is_active: true,
        },
        {
          bank_code: 'BCP',
          bank_name: 'Banque Centrale Populaire',
          bank_name_ar: 'البنك المركزي الشعبي',
          iban: 'MA64001000000000000000000000',
          bic: 'BCPOMAMC',
          account_number: '0000000000000000',
          display_order: 2,
          is_active: true,
        },
        {
          bank_code: 'CIH',
          bank_name: 'CIH Bank',
          bank_name_ar: 'بنك CIH',
          iban: 'MA64007000000000000000000000',
          bic: 'CIHMMAMC',
          account_number: '0000000000000000',
          display_order: 3,
          is_active: true,
        },
        {
          bank_code: 'ATTIJARI',
          bank_name: 'Attijariwafa Bank',
          bank_name_ar: 'التجاري وفا بنك',
          iban: 'MA64002000000000000000000000',
          bic: 'BCMAMAMC',
          account_number: '0000000000000000',
          display_order: 4,
          is_active: true,
        },
        {
          bank_code: 'SGMA',
          bank_name: 'Société Générale Marocaine de Banques',
          bank_name_ar: 'الشركة العامة للبنوك بالمغرب',
          iban: 'MA64003000000000000000000000',
          bic: 'SGMAMAMC',
          account_number: '0000000000000000',
          display_order: 5,
          is_active: true,
        },
      ]

      const payload = {
        success: true,
        banks: fallbackBanks,
        referenceNumber: referenceNumber || null,
        source: 'fallback',
        message: 'Bank details from fallback configuration',
      }
      cache.set(cacheKey, { value: payload, expiresAt: now + CACHE_TTL_MS })

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          ...corsHeaders(req),
        },
      })
    }

    // Return bank details
    const payload = {
      success: true,
      banks,
      referenceNumber: referenceNumber || null,
      source: 'database',
      message: 'Bank details retrieved successfully',
    }
    cache.set(cacheKey, { value: payload, expiresAt: now + CACHE_TTL_MS })

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        ...corsHeaders(req),
      },
    })

  } catch (error) {
    console.error('Get bank details error:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to fetch bank details',
        code: 'BANK_DETAILS_ERROR',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(req) },
      }
    )
  }
})
