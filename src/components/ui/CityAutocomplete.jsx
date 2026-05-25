import { useState, useRef, useEffect } from 'react'
import { MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline'

// 221 Moroccan cities in Arabic — organized by region
export const MOROCCAN_CITIES = [
  // الدار البيضاء-سطات
  'الدار البيضاء', 'المحمدية', 'سطات', 'برشيد', 'بنسليمان', 'بوسكورة', 'دار بوعزة',
  'مديونة', 'تيط مليل', 'عين الحروضة', 'الحد سواللم', 'أزمور', 'الجديدة',
  'سيدي بنور', 'وادي زم', 'ابن أحمد', 'بوزنيقة', 'بير جديد', 'جورف الأصفر',
  'الزمامرة', 'بنسليمان', 'سيدي رحال', 'عين حرودة',

  // الرباط-سلا-القنيطرة
  'الرباط', 'سلا', 'تمارة', 'القنيطرة', 'الصخيرات', 'الخميسات', 'سيدي قاسم',
  'سيدي سليمان', 'سوق الأربعاء', 'مشرع بلقصيري', 'سيدي علال طازي',
  'سيدي يحيى الغرب', 'مهدية', 'بوقنادل', 'سيدي علال البحراوي',

  // طنجة-تطوان-الحسيمة
  'طنجة', 'تطوان', 'الحسيمة', 'القصر الكبير', 'العرائش', 'شفشاون', 'الفنيدق',
  'مرتيل', 'أصيلة', 'المضيق', 'وادي لاو', 'ترغيست', 'بني أنصار', 'باب برد',
  'أكنول', 'الغفساي', 'بني بوعياش', 'تزرين', 'جبل الحبيب',

  // الشرق
  'وجدة', 'الناظور', 'بركان', 'تاورير', 'جرادة', 'الدريوش', 'زايو',
  'عين بني مطهر', 'أركمان', 'بوعرفة', 'السعيدية', 'فجيج', 'تافوغالت',
  'أكلو', 'عين بني مطهر', 'بني درار', 'مداغ', 'ملوية', 'مزگيطم',

  // فاس-مكناس
  'فاس', 'مكناس', 'تازة', 'صفرو', 'الحاجب', 'أزرو', 'إيفران', 'إيموزر كندر',
  'أكورأي', 'ريبات الخير', 'ميسور', 'مولاي يعقوب', 'بلمان', 'مولاي إدريس زرهون',
  'تيسة', 'أكنول', 'سيدي قاسم', 'أولاد أيياش', 'سبع عيون', 'الواد العشر',

  // بني ملال-خنيفرة
  'بني ملال', 'خنيفرة', 'الفقيه بن صالح', 'أزيلال', 'قصبة تادلة', 'بجاد',
  'دمنات', 'تادلة', 'خريبكة', 'ابن جرير', 'أحنصال', 'سيدي حجاج',
  'بريكة', 'أيت عتاب', 'فيخت', 'تيزي نيسلي',

  // مراكش-آسفي
  'مراكش', 'أسفي', 'قلعة السراغنة', 'شيشاوة', 'الصويرة', 'تاحناوت', 'أمزميز',
  'يوسفية', 'بن جرير', 'أيت عورير', 'تحنصالت', 'العطاوية', 'أيت أودار',
  'الحوز', 'شيشاوة', 'اكدال', 'تالسينت', 'إمنتانوت', 'ورزازات (جهة مراكش)',

  // درعة-تافيلالت
  'الرشيدية', 'ورزازات', 'زاكورة', 'تنغير', 'ميدلت', 'ارفود', 'تنجداد',
  'الريصاني', 'بومالن داديس', 'قلعة مڭونة', 'طينجداد', 'نكوب', 'أيت بنهادو',
  'تودرا', 'إملشيل', 'توانت', 'أيت ورير',

  // سوس-ماسة
  'أكادير', 'إنزكان', 'أيت ملول', 'تيزنيت', 'تارودانت', 'تافراوت', 'بيوكرى',
  'أولاد تيمة', 'تالوين', 'أركمان', 'أمسكرود', 'سيدي إفني', 'الصويرة المدينة',
  'ماسة', 'طيوت', 'أكا', 'أيت باها', 'إغرم', 'تازناخت', 'آيت عبدو',

  // كلميم-واد نون
  'كلميم', 'طانطان', 'سيدي إفني', 'أسا', 'بوئيزكرن', 'تانتان', 'أسا الزاگ',
  'طاطا', 'أكادير إيزرير', 'فم الحصن',

  // العيون-الساقية الحمراء
  'العيون', 'السمارة', 'بوجدور', 'طرفاية', 'حوزة', 'بوكراع',

  // الداخلة-وادي الذهب
  'الداخلة', 'آوسرد', 'لكويرة',
]

// Normalize Arabic text for fuzzy matching (remove diacritics, normalize alef variants)
const normalizeArabic = (text) => {
  return text
    .replace(/[\u064B-\u065F]/g, '') // remove tashkeel/diacritics
    .replace(/[\u0622\u0623\u0625]/g, '\u0627') // normalize alef variants → ا
    .replace(/\u0649/g, '\u064A') // normalize alef maqsura → ي
    .replace(/\u0629/g, '\u0647') // normalize taa marbuta → ه
    .toLowerCase()
}

const CityAutocomplete = ({
  value,
  onChange,
  placeholder = 'ابحث عن مدينتك...',
  required = false,
  error = null,
  label = null,
}) => {
  const [inputValue, setInputValue] = useState(value || '')
  const [filteredCities, setFilteredCities] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Sync with external value
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex]
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex])

  const filterCities = (query) => {
    if (!query.trim()) return MOROCCAN_CITIES
    const norm = normalizeArabic(query)
    // Exact starts-with first, then contains
    const startsWith = MOROCCAN_CITIES.filter(c => normalizeArabic(c).startsWith(norm))
    const contains = MOROCCAN_CITIES.filter(c => !normalizeArabic(c).startsWith(norm) && normalizeArabic(c).includes(norm))
    return [...startsWith, ...contains]
  }

  const handleInputChange = (e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    const results = filterCities(newValue)
    setFilteredCities(results)
    setIsOpen(true)
    setHighlightedIndex(-1)
  }

  const handleSelectCity = (city) => {
    setInputValue(city)
    onChange(city)
    setIsOpen(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (!isOpen) return

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
    const results = filterCities(inputValue)
    setFilteredCities(results)
    setIsOpen(true)
  }

  // Highlight matching text
  const highlightMatch = (cityName) => {
    if (!inputValue.trim()) return cityName
    const norm = normalizeArabic(inputValue)
    const normCity = normalizeArabic(cityName)
    const idx = normCity.indexOf(norm)
    if (idx === -1) return cityName
    return (
      <>
        {cityName.slice(0, idx)}
        <span className="font-bold text-green-700">{cityName.slice(idx, idx + inputValue.length)}</span>
        {cityName.slice(idx + inputValue.length)}
      </>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label className="input-label">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </label>
      )}
      <div className="relative">
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
          <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`input pr-10 ${error ? 'border-red-400 focus:border-red-500' : ''}`}
          required={required}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="city-autocomplete-list"
          data-testid="register-city-select"
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Dropdown list */}
      {isOpen && filteredCities.length > 0 && (
        <ul
          ref={listRef}
          id="city-autocomplete-list"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-auto"
        >
          {!inputValue.trim() && (
            <li className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100 flex items-center gap-1">
              <MapPinIcon className="w-3.5 h-3.5" />
              {filteredCities.length} مدينة متاحة — ابدأ بالكتابة للبحث
            </li>
          )}
          {filteredCities.map((city, index) => (
            <li
              key={city}
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
              role="option"
              aria-selected={index === highlightedIndex}
              className={`px-4 py-2.5 cursor-pointer transition-colors text-sm ${
                index === highlightedIndex
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              onClick={() => handleSelectCity(city)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectCity(city) }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="flex items-center gap-2">
                <MapPinIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
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
