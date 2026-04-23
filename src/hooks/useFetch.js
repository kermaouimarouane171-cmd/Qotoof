/**
 * @module hooks/useFetch
 * Data fetching hooks for generic and Supabase-specific queries.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

/**
 * Generic data fetching hook with stale-time caching.
 *
 * @param {Function} queryFn - Async function that returns data
 * @param {object}  [options]
 * @param {boolean} [options.enabled=true]         - Skip fetch when false
 * @param {boolean} [options.refetchOnMount=true]  - Re-fetch on every mount
 * @param {number}  [options.staleTime=60000]      - ms before data is considered stale
 * @returns {{ data, loading, error, refetch }}
 */
export const useFetch = (queryFn, options = {}) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const {
    enabled = true,
    refetchOnMount = true,
    staleTime = 60000,
  } = options

  const lastFetchTime = useRef(0)

  const execute = useCallback(async (force = false) => {
    if (!enabled) return

    const now = Date.now()
    if (!force && now - lastFetchTime.current < staleTime && data) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const result = await queryFn()
      setData(result)
      lastFetchTime.current = now
    } catch (err) {
      setError(err)
      logger.error('useFetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [queryFn, enabled, staleTime, data])

  useEffect(() => {
    if (refetchOnMount || !data) {
      execute()
    }
  }, [refetchOnMount, data, execute])

  const refetch = useCallback(() => execute(true), [execute])

  return { data, loading, error, refetch }
}

/**
 * Hook for Supabase table queries, backed by useFetch.
 *
 * @param {string}   table         - Supabase table name
 * @param {Function} [queryBuilder] - Receives the query object and returns it (for filters/ordering)
 * @param {object}  [options]
 * @param {boolean} [options.enabled=true]
 * @param {string}  [options.select='*']
 * @returns {{ data, loading, error, refetch }}
 */
export const useSupabaseQuery = (table, queryBuilder, options = {}) => {
  const { enabled = true, select = '*' } = options

  const queryFn = useCallback(async () => {
    let query = supabase.from(table).select(select)

    if (queryBuilder) {
      query = queryBuilder(query)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  }, [table, select, queryBuilder])

  return useFetch(queryFn, { enabled })
}

/**
 * Hook for fetching a single Supabase record by id.
 *
 * @param {string} table  - Supabase table name
 * @param {string} id     - Record primary key
 * @param {string} [select='*']
 * @returns {{ data, loading, error, refetch }}
 */
export const useSupabaseSingle = (table, id, select = '*') => {
  const queryFn = useCallback(async () => {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }, [table, id, select])

  return useFetch(queryFn, { enabled: !!id })
}
