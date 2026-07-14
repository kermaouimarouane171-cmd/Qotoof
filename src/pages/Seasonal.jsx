/**
 * pages/Seasonal.jsx
 * Morocco Seasonal Agricultural Calendar — public marketplace page.
 *
 * Shows what produce is in season right now and month-by-month,
 * helping buyers plan bulk purchases at peak quality & lowest price.
 */

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'
import {
  MOROCCAN_SEASONS,
  ARABIC_MONTHS,
  getProductsInMonth,
  getPeakProducts,
  getAvailabilityStatus,
} from '@/modules/marketplace'
import { PRODUCT_CATEGORIES } from '@/modules/catalog'
import {
  CalendarIcon,
  MapPinIcon,
  LightBulbIcon,
  ShoppingCartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'

// ─── Constants ───────────────────────────────────────────────────────────────

const AVAILABILITY_STYLES = {
  peak:        { bg: 'bg-green-500',  text: 'text-white',        label: 'ذروة الموسم' },
  available:   { bg: 'bg-green-200',  text: 'text-green-800',    label: 'متوفر' },
  unavailable: { bg: 'bg-gray-100',   text: 'text-gray-400',     label: 'غير متوفر' },
}

const ALL_CAT = { id: '', label: 'الكل', labelAr: 'الكل', icon: '🌾' }
const FILTER_CATS = [ALL_CAT, ...PRODUCT_CATEGORIES]

// ─── Sub-components ──────────────────────────────────────────────────────────

function AvailabilityBar({ product, selectedMonth }) {
  return (
    <div className="flex gap-0.5 mt-2">
      {Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        const status = getAvailabilityStatus(product, m)
        const style = AVAILABILITY_STYLES[status]
        const isSelected = m === selectedMonth
        return (
          <div
            key={m}
            title={`${ARABIC_MONTHS[i]}: ${style.label}`}
            className={`h-2 flex-1 rounded-sm ${style.bg} ${isSelected ? 'ring-2 ring-offset-1 ring-green-700' : ''}`}
          />
        )
      })}
    </div>
  )
}

function ProductCard({ product, selectedMonth }) {
  const status = getAvailabilityStatus(product, selectedMonth)
  const style  = AVAILABILITY_STYLES[status]

  return (
    <Card className={`p-4 border-2 transition-shadow hover:shadow-md ${
      status === 'peak' ? 'border-green-400 shadow-green-100' : 'border-gray-200'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{product.icon}</span>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{product.nameAr}</h3>
            <p className="text-xs text-gray-400">{product.nameFr}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>

      <AvailabilityBar product={product} selectedMonth={selectedMonth} />

      {product.region && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
          <MapPinIcon className="w-3 h-3 shrink-0" />
          <span>{product.region}</span>
        </div>
      )}

      {product.tips && (
        <div className="flex items-start gap-1 mt-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
          <LightBulbIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{product.tips}</span>
        </div>
      )}
    </Card>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SeasonalPage = () => {
  const currentMonth = new Date().getMonth() + 1 // 1-12
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [activeCategory, setActiveCategory] = useState('')

  const productsInMonth = useMemo(
    () => getProductsInMonth(selectedMonth).filter(
      (p) => !activeCategory || p.category === activeCategory
    ),
    [selectedMonth, activeCategory]
  )

  const peakCount      = useMemo(() => getPeakProducts(selectedMonth, activeCategory).length, [selectedMonth, activeCategory])
  const availableCount = useMemo(() => productsInMonth.filter((p) => p.availableMonths.includes(selectedMonth)).length, [productsInMonth, selectedMonth])

  const prevMonth = () => setSelectedMonth((m) => m === 1 ? 12 : m - 1)
  const nextMonth = () => setSelectedMonth((m) => m === 12 ? 1  : m + 1)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-green-700 to-green-500 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-extrabold mb-2">التقويم الزراعي المغربي</h1>
          <p className="text-green-100 text-sm max-w-xl mx-auto">
            اكتشف ما هو في موسمه الآن — اشترِ في ذروة الجودة وأدنى سعر.
            يُحدَّث شهرياً حسب المواسم الفعلية في المغرب.
          </p>
          <Link
            to="/marketplace"
            className="mt-5 inline-flex items-center gap-2 bg-white text-green-700 font-semibold px-5 py-2.5 rounded-xl shadow hover:bg-green-50 transition text-sm"
          >
            <ShoppingCartIcon className="w-4 h-4" />
            اطلب من الموسم الحالي
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── Month Selector ── */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
              aria-label="الشهر السابق"
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-600" />
            </button>

            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-1.5 justify-center min-w-max mx-auto">
                {ARABIC_MONTHS.map((name, i) => {
                  const m = i + 1
                  const isSelected = m === selectedMonth
                  const isCurrent  = m === currentMonth
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMonth(m)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-green-600 text-white shadow-sm'
                          : isCurrent
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {name}
                      {isCurrent && !isSelected && (
                        <span className="block h-1 w-1 bg-green-500 rounded-full mx-auto mt-0.5" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition"
              aria-label="الشهر التالي"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-center gap-6 mt-4 text-sm">
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{peakCount}</p>
              <p className="text-xs text-gray-500">في ذروة الموسم</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-xl font-bold text-gray-700">{availableCount}</p>
              <p className="text-xs text-gray-500">متوفر هذا الشهر</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <div className="flex items-center gap-1.5 justify-center">
                <CalendarIcon className="w-4 h-4 text-gray-500" />
                <p className="text-sm font-semibold text-gray-700">
                  {ARABIC_MONTHS[selectedMonth - 1]}
                  {selectedMonth === currentMonth && (
                    <span className="mr-1 text-xs text-green-600">(الآن)</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Legend ── */}
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(AVAILABILITY_STYLES).map(([key, style]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded-sm ${style.bg}`} />
              <span className="text-gray-600">{style.label}</span>
            </div>
          ))}
          <span className="text-gray-400 mr-2">الشريط الملوّن = 12 شهر (يناير → ديسمبر)</span>
        </div>

        {/* ── Category Filter ── */}
        <div className="flex flex-wrap gap-2">
          {FILTER_CATS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                activeCategory === cat.id
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
              }`}
            >
              <span>{cat.icon}</span>
              {cat.labelAr}
            </button>
          ))}
        </div>

        {/* ── Products Grid ── */}
        {productsInMonth.length === 0 ? (
          <Card className="p-10 text-center text-gray-500">
            <p className="text-lg font-medium">لا توجد منتجات متوفرة في هذه الفئة لهذا الشهر</p>
            <p className="text-sm mt-1">جرّب تصفية أخرى أو شهراً مختلفاً.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {productsInMonth.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                selectedMonth={selectedMonth}
              />
            ))}
          </div>
        )}

        {/* ── Full Year Overview (accordion) ── */}
        <Card className="p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">نظرة عامة على السنة الكاملة</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-right py-1.5 pr-2 font-semibold text-gray-600 w-28">المنتج</th>
                  {ARABIC_MONTHS.map((m, i) => (
                    <th
                      key={i}
                      className={`text-center py-1.5 px-0.5 font-medium w-8 ${
                        i + 1 === selectedMonth ? 'text-green-700' : 'text-gray-400'
                      }`}
                    >
                      {m.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOROCCAN_SEASONS
                  .filter((p) => !activeCategory || p.category === activeCategory)
                  .map((product) => (
                    <tr key={product.id} className="border-t border-gray-100">
                      <td className="py-1.5 pr-2 font-medium text-gray-800 whitespace-nowrap">
                        {product.icon} {product.nameAr}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = i + 1
                        const status = getAvailabilityStatus(product, m)
                        const style  = AVAILABILITY_STYLES[status]
                        return (
                          <td key={m} className="text-center px-0.5 py-1">
                            <div
                              className={`w-5 h-5 rounded mx-auto ${style.bg} ${
                                m === selectedMonth ? 'ring-2 ring-green-600 ring-offset-1' : ''
                              }`}
                              title={`${ARABIC_MONTHS[i]}: ${style.label}`}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </div>
  )
}

export default SeasonalPage
