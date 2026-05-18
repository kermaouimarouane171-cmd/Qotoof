/**
 * AdvancedFiltersPanel — dropdown filter panel for the buyer orders page.
 *
 * Extracted from src/pages/buyer/Orders.jsx.
 */

import { useState, useEffect, useRef } from 'react'
import { AdjustmentsHorizontalIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

const PAYMENT_STATUS_OPTIONS = [
  { id: '', label: 'All Payments' },
  { id: 'paid', label: 'Paid' },
  { id: 'pending', label: 'Pending' },
  { id: 'cod', label: 'Cash on Delivery' },
]

const AdvancedFiltersPanel = ({ filters, onChange, onClear, orderCount, t }) => {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.priceMin || filters.priceMax || filters.paymentStatus

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
          hasActiveFilters
            ? 'border-green-300 bg-green-50 text-green-700'
            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <AdjustmentsHorizontalIcon className="w-4 h-4" />
        {t('buyer.orders.advancedFilters', 'Filters')}
        {hasActiveFilters && (
          <span className="w-5 h-5 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {[filters.dateFrom, filters.dateTo, filters.priceMin, filters.priceMax, filters.paymentStatus].filter(Boolean).length}
          </span>
        )}
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{t('buyer.orders.advancedFilters', 'Advanced Filters')}</h3>
            {hasActiveFilters && (
              <button onClick={onClear} className="text-xs text-green-600 hover:underline">
                {t('buyer.orders.clearFilters', 'Clear all')}
              </button>
            )}
          </div>

          {/* Date Range */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('buyer.orders.filters.dateRange', 'Date Range')}</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={filters.dateFrom || ''} onChange={(e) => onChange('dateFrom', e.target.value)} className="input text-xs py-2" />
              <input type="date" value={filters.dateTo || ''} onChange={(e) => onChange('dateTo', e.target.value)} className="input text-xs py-2" />
            </div>
          </div>

          {/* Price Range */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('buyer.orders.filters.priceRange', 'Price Range (MAD)')}</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder={t('buyer.orders.filters.min', 'Min')}
                min="0"
                value={filters.priceMin || ''}
                onChange={(e) => { const v = e.target.value; if (v === '' || parseFloat(v) >= 0) onChange('priceMin', v) }}
                className="input text-xs py-2"
              />
              <input
                type="number"
                placeholder={t('buyer.orders.filters.max', 'Max')}
                min="0"
                value={filters.priceMax || ''}
                onChange={(e) => { const v = e.target.value; if (v === '' || parseFloat(v) >= 0) onChange('priceMax', v) }}
                className="input text-xs py-2"
              />
            </div>
          </div>

          {/* Payment Status */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5">{t('buyer.orders.filters.paymentStatus', 'Payment Status')}</label>
            <select value={filters.paymentStatus || ''} onChange={(e) => onChange('paymentStatus', e.target.value)} className="input text-xs py-2 w-full">
              {PAYMENT_STATUS_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{t(`buyer.orders.paymentStatus.${opt.id || 'all'}`, opt.label)}</option>
              ))}
            </select>
          </div>

          {/* Results count */}
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {t('buyer.orders.orderCount', 'Showing {{count}} order(s)', { count: orderCount })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdvancedFiltersPanel
