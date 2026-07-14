import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import AdvancedFiltersPanel from '@/components/orders/AdvancedFiltersPanel'

export default function OrderFilters({
  t,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onSearchFocus,
  onSearchBlur,
  showSuggestions,
  suggestions,
  onSuggestionClick,
  filter,
  onFilterChange,
  filterTabs,
  advancedFilters,
  onAdvancedFilterChange,
  onClearAdvancedFilters,
  totalCount,
}) {
  return (
    <div className="mb-6 space-y-4">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={t('buyer.orders.searchPlaceholder', 'Search by order number, vendor, or product...')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={onSearchFocus}
          onBlur={onSearchBlur}
          className="input pl-12 pr-10 py-3"
          aria-label={t('buyer.orders.searchPlaceholder', 'Search orders')}
          role="combobox"
          aria-expanded={showSuggestions}
          aria-controls="buyer-orders-search-suggestions"
        />
        {searchQuery && (
          <button
            onClick={onClearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2"
            aria-label={t('buyer.orders.clearSearchAria', 'Clear search')}
          >
            <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div id="buyer-orders-search-suggestions" className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-20 overflow-hidden">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onMouseDown={() => onSuggestionClick(suggestion)}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="truncate">{suggestion}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin flex-1" data-cy="filter-status-select">
          {filterTabs.map((tab) => {
            const isActive = filter === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onFilterChange(tab.id)}
                data-cy={`filter-status-select-${tab.id}`}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t(`buyer.orders.filters.${tab.id}`, tab.label)}
              </button>
            )
          })}
        </div>

        <AdvancedFiltersPanel
          filters={advancedFilters}
          onChange={onAdvancedFilterChange}
          onClear={onClearAdvancedFilters}
          orderCount={totalCount}
          t={t}
        />
      </div>
    </div>
  )
}