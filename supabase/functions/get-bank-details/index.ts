// Supabase Edge Function: get-bank-details
// Returns Moroccan bank details for bank transfer payments
// Deploy: supabase functions deploy get-bank-details --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// Environment Configuration
// ============================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// ============================================
// CORS Headers Helper
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { value: unknown; expiresAt: number }>()
const rateLimit = new Map<string, { count: number; resetAt: number }>()

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (!['GET', 'POST'].includes(req.method)) {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }

    // Basic per-IP rate limiting to reduce abuse on a public endpoint
    const forwardedFor = req.headers.get('x-forwarded-for') || ''
    const clientIp = forwardedFor.split(',')[0]?.trim() || 'unknown'
    const now = Date.now()
    const rlRecord = rateLimit.get(clientIp)
    if (!rlRecord || now > rlRecord.resetAt) {
      rateLimit.set(clientIp, { count: 1, resetAt: now + 60_000 })
    } else {
      rlRecord.count += 1
      if (rlRecord.count > 60) {
        return new Response(
          JSON.stringify({ error: 'Too many requests, try again later' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
              ...corsHeaders,
            },
          }
        )
      }
    }

    // Initialize Supabase client
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase configuration error')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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
          ...corsHeaders,
        },
      })
    }

    const { data: banks, error: banksError } = await query

    if (banksError) {
      console.error('Failed to fetch bank details:', banksError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch bank details', details: banksError.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      )
    }

    // If a specific bank was requested but not found, return error
    if (bankCode && (!banks || banks.length === 0)) {
      return new Response(
        JSON.stringify({ error: `Bank not found: ${bankCode}` }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
          ...corsHeaders,
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
        ...corsHeaders,
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
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    )
  }
})
