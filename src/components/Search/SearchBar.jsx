import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { algoliaService } from '@/services/search/algoliaService'
import { logger } from '@/utils/logger'

const DEBOUNCE_MS = 300

const SearchBar = memo(function SearchBar({ placeholder, className = '', onSearch, initialValue = '' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [query, setQuery] = useState(initialValue)
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef(null)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setQuery(initialValue || '')
  }, [initialValue])

  const fetchSuggestions = useCallback(async (q) => {
    if (!q || q.length < 2) { setSuggestions([]); return }
    setLoading(true)
    try {
      const hits = await algoliaService.getSearchSuggestions(q)
      setSuggestions(hits.slice(0, 6))
    } catch (err) {
      logger.error('SearchBar suggestions error', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setActiveIndex(-1)
    setOpen(true)

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), DEBOUNCE_MS)
  }

  const handleSubmit = (searchQuery) => {
    const q = (searchQuery || query).trim()
    if (!q) return
    setOpen(false)
    if (onSearch) {
      onSearch(q)
    } else {
      navigate(`/search?q=${encodeURIComponent(q)}`)
    }
  }

  const handleKeyDown = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        handleSubmit(suggestions[activeIndex].name)
      } else {
        handleSubmit()
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const clearQuery = () => {
    setQuery('')
    setSuggestions([])
    if (onSearch) onSearch('')
    inputRef.current?.focus()
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`} data-testid="search-bar">
      <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 px-3 py-2 focus-within:ring-2 focus-within:ring-green-500 gap-2">
        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={placeholder || t('search.placeholder', 'ابحث عن منتجات...')}
          className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none"
          aria-label={t('search.label', 'بحث')}
          autoComplete="off"
        />
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-500 border-t-transparent shrink-0" />
        )}
        {query && !loading && (
          <button onClick={clearQuery} className="p-0.5 hover:text-gray-600 text-gray-400 shrink-0">
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => handleSubmit()}
          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors shrink-0"
        >
          {t('search.search', 'بحث')}
        </button>
      </div>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <ul
          className="absolute top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 overflow-hidden"
          role="listbox"
        >
          {suggestions.map((hit, i) => (
            <li
              key={hit.objectID}
              role="none"
              aria-selected={i === activeIndex}
              onMouseDown={() => handleSubmit(hit.name)}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm ${
                i === activeIndex
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 shrink-0" />
              <span
                dangerouslySetInnerHTML={{
                  __html: hit._highlightResult?.name?.value || hit.name
                }}
              />
              {hit.category && (
                <span className="text-xs text-gray-400 ml-auto shrink-0">{hit.category}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})

export default SearchBar
