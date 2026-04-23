import { useState, useRef, useEffect } from 'react'

// Major Moroccan cities
const MOROCCAN_CITIES = [
  'Casablanca', 'Rabat', 'Fes', 'Marrakech', 'Tangier', 'Agadir', 'Meknes', 'Oujda',
  'Kenitra', 'Tetouan', 'Safi', 'Mohammedia', 'El Jadida', 'Beni Mellal', 'Nador',
  'Khouribga', 'Settat', 'Larache', 'Ksar El Kebir', 'Khemisset', 'Guelmim',
  'Berrechid', 'Fquih Ben Salah', 'Taza', 'Errachidia', 'Ouarzazate', 'Sidi Kacem',
  'Sidi Slimane', 'Essaouira', 'Al Hoceima', 'Taroudant', 'Chefchaouen', 'Dakhla',
  'Laayoune', 'Ifrane', 'Azrou', 'Midelt', 'Erfoud', 'Tiznit', 'Tan-Tan',
  'Sidi Ifni', 'Zagora', 'Ouezzane', 'Guercif', 'Jerada', 'Berkane', 'Taourirt',
  'Fnideq', 'Martil', 'M\'diq', 'Asilah', 'Had Soualem', 'Mediouna', 'Bouskoura',
  'Dar Bouazza', 'Ain Harrouda', 'Tit Mellil', 'Benslimane', 'Sidi Yahya El Gharb',
  'Souk El Arbaa', 'Kariat', 'Mechra Bel Ksiri', 'Sidi Allal Tazi', 'El Hajeb',
  'Ain Taoujdate', 'Agourai', 'Ribat El Kheir', 'Imouzzer Kandar', 'Missour',
  'Boulemane', 'Sefrou', 'Bhalil', 'Moulay Yacoub', 'Arbaoua', 'Mehdia',
  'Skhirat', 'Temsia', 'Ait Melloul', 'Inezgane', 'Ben Guerir', 'Youssoufia',
  'Chichaoua', 'Amizmiz', 'Tahannaout', 'Lalla Takerkoust', 'Skoura', 'Kelaat M\'Gouna',
  'Boumalne Dades', 'Tinghir', 'Zaio', 'Beni Ansar', 'Selouane', 'Ain Bni Mathar',
  'Aklim', 'Talsint', 'Figuig', 'Bouarfa', 'Tafraout', 'Biougra', 'Ait Ourir',
  'Oulad Teima', 'Bni Ayat', 'Smimou', 'Jorf Lasfar', 'Azemmour', 'Bir Jdid'
]

const CityAutocomplete = ({ value, onChange, placeholder = 'Search for a city...', required = false }) => {
  const [inputValue, setInputValue] = useState(value || '')
  const [filteredCities, setFilteredCities] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)

  // Sync with external value
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '')
    }
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)

    if (newValue.trim()) {
      const filtered = MOROCCAN_CITIES.filter(city =>
        city.toLowerCase().includes(newValue.toLowerCase())
      ).slice(0, 10)
      setFilteredCities(filtered)
      setIsOpen(filtered.length > 0)
      setHighlightedIndex(-1)
    } else {
      setFilteredCities([])
      setIsOpen(false)
      setHighlightedIndex(-1)
    }
  }

  const handleSelectCity = (city) => {
    setInputValue(city)
    onChange(city)
    setIsOpen(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (!isOpen || filteredCities.length === 0) {
      if (e.key === 'Enter' && inputValue.trim()) {
        onChange(inputValue)
        setIsOpen(false)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev < filteredCities.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredCities.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredCities.length) {
          handleSelectCity(filteredCities[highlightedIndex])
        } else if (inputValue.trim()) {
          onChange(inputValue)
          setIsOpen(false)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  const handleFocus = () => {
    if (inputValue.trim() && filteredCities.length > 0) {
      setIsOpen(true)
    }
  }

  // Highlight matching text
  const highlightMatch = (cityName) => {
    if (!inputValue.trim()) return cityName
    const regex = new RegExp(`(${inputValue})`, 'gi')
    const parts = cityName.split(regex)
    
    return (
      <>
        {parts.map((part, index) => {
          const key = `${cityName}-${index}-${part}`
          return regex.test(part) ? (
            <span key={key} className="font-semibold text-green-700">{part}</span>
          ) : (
            <span key={key}>{part}</span>
          )
        })}
      </>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        className="input pr-10"
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="city-autocomplete-list"
      />
      
      {/* Dropdown icon */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Dropdown list */}
      {isOpen && filteredCities.length > 0 && (
        <ul
          id="city-autocomplete-list"
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {filteredCities.map((city, index) => (
            <li
              key={city}
              role="option"
              aria-selected={index === highlightedIndex}
              className={`px-4 py-2.5 cursor-pointer transition-colors ${
                index === highlightedIndex
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => handleSelectCity(city)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectCity(city) }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{highlightMatch(city)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CityAutocomplete
