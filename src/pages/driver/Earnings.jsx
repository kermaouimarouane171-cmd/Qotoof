import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { Card, LoadingSpinner } from '@/components/ui'
import {
  CurrencyDollarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import { formatPrice } from '@/utils/currency'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const DEFAULT_PRICING = {
  base_price: 15.0,
  price_per_km: 2.0,
  min_price: 10.0,
  max_price: 200.0,
  max_distance_km: 50,
  rush_hour_multiplier: 1.5,
  rush_hour_start: '12:00',
  rush_hour_end: '14:00',
  evening_multiplier: 1.3,
  evening_start: '20:00',
  evening_end: '06:00',
  is_custom_pricing: false,
}

const DriverEarnings = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [rateCardOpen, setRateCardOpen] = useState(false)
  const [pricing, setPricing] = useState(DEFAULT_PRICING)
  const [pricingLoaded, setPricingLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [calculator, setCalculator] = useState({ distance: 10, time: '13:00' })
  const [calculatedPrice, setCalculatedPrice] = useState(null)

  useEffect(() => {
    if (!rateCardOpen || pricingLoaded) return
    const loadPricing = async () => {
      try {
        const { data, error } = await supabase
          .from('driver_pricing')
          .select('*')
          .eq('driver_id', user.id)
          .single()
        if (error && error.code !== 'PGRST116') throw error
        if (data) setPricing(data)
      } catch (error) {
        logger.error('Load pricing error:', error)
      } finally {
        setPricingLoaded(true)
      }
    }
    loadPricing()
  }, [rateCardOpen])

  const calculatePrice = () => {
    const distance = parseFloat(calculator.distance)
    const [hour, minute] = calculator.time.split(':').map(Number)
    const currentMinutes = hour * 60 + minute
    let timeMultiplier = 1.0

    const [rushSH, rushSM] = pricing.rush_hour_start.split(':').map(Number)
    const [rushEH, rushEM] = pricing.rush_hour_end.split(':').map(Number)
    if (currentMinutes >= rushSH * 60 + rushSM && currentMinutes <= rushEH * 60 + rushEM) {
      timeMultiplier = pricing.rush_hour_multiplier
    }

    const [eveSH, eveSM] = pricing.evening_start.split(':').map(Number)
    const [eveEH, eveEM] = pricing.evening_end.split(':').map(Number)
    const eveStart = eveSH * 60 + eveSM
    const eveEnd = eveEH * 60 + eveEM
    if (eveStart < eveEnd) {
      if (currentMinutes >= eveStart && currentMinutes <= eveEnd)
        timeMultiplier = Math.max(timeMultiplier, pricing.evening_multiplier)
    } else {
      if (currentMinutes >= eveStart || currentMinutes <= eveEnd)
        timeMultiplier = Math.max(timeMultiplier, pricing.evening_multiplier)
    }

    const distancePrice = distance * pricing.price_per_km
    let total = (pricing.base_price + distancePrice) * timeMultiplier
    total = Math.min(Math.max(total, pricing.min_price), pricing.max_price)

    setCalculatedPrice({
      base: pricing.base_price.toFixed(2),
      distance: distancePrice.toFixed(2),
      multiplier: timeMultiplier.toFixed(2),
      total: total.toFixed(2),
    })
  }

  const handleSavePricing = async () => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('driver_pricing')
        .upsert({ driver_id: user.id, ...pricing })
      if (error) throw error
      toast.success(t('driver.pricing.saveSuccess', 'Pricing settings saved!'))
    } catch (error) {
      logger.error('Save pricing error:', error)
      toast.error(t('driver.pricing.saveFailed', 'Failed to save pricing'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('driver.earnings.title', 'Earnings')}</h1>

      {/* Earnings Overview */}
      <Card className="p-6 mb-6">
        <CurrencyDollarIcon className="w-12 h-12 text-gray-300 mb-4" />
        <h3 className="font-semibold mb-2">{t('driver.earnings.overview', 'Earnings Overview')}</h3>
        <p className="text-3xl font-bold text-green-600 mb-4">{formatPrice(0)}</p>
        <p className="text-gray-500">{t('driver.earnings.completeDeliveries', 'Complete deliveries to start earning')}</p>
      </Card>

      {/* Rate Card — collapsible */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setRateCardOpen(!rateCardOpen)}
          className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <span className="font-semibold text-gray-900">{t('driver.pricing.title', 'My Rate Card')}</span>
          {rateCardOpen
            ? <ChevronUpIcon className="w-5 h-5 text-gray-500" />
            : <ChevronDownIcon className="w-5 h-5 text-gray-500" />}
        </button>

        {rateCardOpen && (
          <div className="p-6">
            {!pricingLoaded ? (
              <div className="flex justify-center py-8"><LoadingSpinner size="md" /></div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Settings */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Base Pricing */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
                      {t('driver.pricing.basePricing', 'Base Pricing')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="input-label">{t('driver.pricing.basePrice', 'Base Price (MAD)')}</label>
                        <input type="number" value={pricing.base_price}
                          onChange={(e) => setPricing({ ...pricing, base_price: parseFloat(e.target.value) || 0 })}
                          className="input" step="0.5" min="0" />
                        <p className="text-xs text-gray-500 mt-1">{t('driver.pricing.basePriceDesc', 'Fixed fee for every delivery')}</p>
                      </div>
                      <div>
                        <label className="input-label">{t('driver.pricing.pricePerKm', 'Price per KM (MAD)')}</label>
                        <input type="number" value={pricing.price_per_km}
                          onChange={(e) => setPricing({ ...pricing, price_per_km: parseFloat(e.target.value) || 0 })}
                          className="input" step="0.5" min="0" />
                      </div>
                      <div>
                        <label className="input-label">{t('driver.pricing.minPrice', 'Minimum Price (MAD)')}</label>
                        <input type="number" value={pricing.min_price}
                          onChange={(e) => setPricing({ ...pricing, min_price: parseFloat(e.target.value) || 0 })}
                          className="input" step="1" min="0" />
                      </div>
                      <div>
                        <label className="input-label">{t('driver.pricing.maxPrice', 'Maximum Price (MAD)')}</label>
                        <input type="number" value={pricing.max_price}
                          onChange={(e) => setPricing({ ...pricing, max_price: parseFloat(e.target.value) || 0 })}
                          className="input" step="5" min="0" />
                      </div>
                      <div>
                        <label className="input-label">{t('driver.pricing.maxDistance', 'Max Distance (KM)')}</label>
                        <input type="number" value={pricing.max_distance_km}
                          onChange={(e) => setPricing({ ...pricing, max_distance_km: parseFloat(e.target.value) || 0 })}
                          className="input" step="5" min="1" />
                      </div>
                    </div>
                  </div>

                  {/* Rush Hour */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <ClockIcon className="w-5 h-5 text-orange-600" />
                      {t('driver.pricing.rushHour', 'Rush Hour Pricing')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="input-label">{t('driver.pricing.multiplier', 'Multiplier')}</label>
                        <input type="number" value={pricing.rush_hour_multiplier}
                          onChange={(e) => setPricing({ ...pricing, rush_hour_multiplier: parseFloat(e.target.value) || 1 })}
                          className="input" step="0.1" min="1" max="3" />
                        <p className="text-xs text-gray-500 mt-1">e.g. 1.5x = 50% more</p>
                      </div>
                      <div>
                        <label className="input-label">{t('driver.pricing.startTime', 'Start Time')}</label>
                        <input type="time" value={pricing.rush_hour_start}
                          onChange={(e) => setPricing({ ...pricing, rush_hour_start: e.target.value })}
                          className="input" />
                      </div>
                      <div>
                        <label className="input-label">{t('driver.pricing.endTime', 'End Time')}</label>
                        <input type="time" value={pricing.rush_hour_end}
                          onChange={(e) => setPricing({ ...pricing, rush_hour_end: e.target.value })}
                          className="input" />
                      </div>
                    </div>
                  </div>

                  {/* Evening */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <ClockIcon className="w-5 h-5 text-purple-600" />
                      {t('driver.pricing.evening', 'Evening/Night Pricing')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="input-label">{t('driver.pricing.multiplier', 'Multiplier')}</label>
                        <input type="number" value={pricing.evening_multiplier}
                          onChange={(e) => setPricing({ ...pricing, evening_multiplier: parseFloat(e.target.value) || 1 })}
                          className="input" step="0.1" min="1" max="3" />
                      </div>
                      <div>
                        <label className="input-label">{t('driver.pricing.startTime', 'Start Time')}</label>
                        <input type="time" value={pricing.evening_start}
                          onChange={(e) => setPricing({ ...pricing, evening_start: e.target.value })}
                          className="input" />
                      </div>
                      <div>
                        <label className="input-label">{t('driver.pricing.endTime', 'End Time')}</label>
                        <input type="time" value={pricing.evening_end}
                          onChange={(e) => setPricing({ ...pricing, evening_end: e.target.value })}
                          className="input" />
                      </div>
                    </div>
                  </div>

                  <button onClick={handleSavePricing} disabled={saving} className="btn-primary w-full disabled:opacity-50">
                    {saving ? t('driver.pricing.saving', 'Saving...') : t('driver.pricing.save', 'Save Rate Card')}
                  </button>
                </div>

                {/* Price Calculator */}
                <div>
                  <Card className="p-5">
                    <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                      <AdjustmentsHorizontalIcon className="w-5 h-5 text-blue-600" />
                      {t('driver.pricing.calculator', 'Price Calculator')}
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="input-label">{t('driver.pricing.distance', 'Distance (KM)')}</label>
                        <input type="number" value={calculator.distance}
                          onChange={(e) => setCalculator({ ...calculator, distance: e.target.value })}
                          className="input" min="1" max="100" />
                      </div>
                      <div>
                        <label className="input-label">{t('driver.pricing.deliveryTime', 'Delivery Time')}</label>
                        <input type="time" value={calculator.time}
                          onChange={(e) => setCalculator({ ...calculator, time: e.target.value })}
                          className="input" />
                      </div>
                      <button onClick={calculatePrice} className="btn-secondary w-full">
                        {t('driver.pricing.calculate', 'Calculate Price')}
                      </button>
                      {calculatedPrice && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircleIcon className="w-5 h-5 text-green-600" />
                            <span className="font-semibold text-green-900">{t('driver.pricing.priceBreakdown', 'Price Breakdown')}</span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-green-700">{t('driver.pricing.base', 'Base Price')}:</span>
                              <span className="font-medium">{calculatedPrice.base} MAD</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-green-700">{t('driver.pricing.distanceLabel', 'Distance')} ({calculator.distance} km):</span>
                              <span className="font-medium">{calculatedPrice.distance} MAD</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-green-700">{t('driver.pricing.timeMultiplier', 'Time Multiplier')}:</span>
                              <span className="font-medium">{calculatedPrice.multiplier}x</span>
                            </div>
                            <div className="border-t border-green-200 pt-2 flex justify-between">
                              <span className="font-semibold text-green-900">{t('driver.pricing.total', 'Total')}:</span>
                              <span className="font-bold text-green-900 text-lg">{calculatedPrice.total} MAD</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex items-start gap-2">
                        <InformationCircleIcon className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-800">
                          <p className="font-medium mb-1">{t('driver.pricing.howPricingWorks', 'How pricing works:')}</p>
                          <ul className="space-y-0.5">
                            <li>{t('driver.pricing.rule1', 'Base price + (distance × price/km)')}</li>
                            <li>{t('driver.pricing.rule2', 'Rush hour: higher prices during busy times')}</li>
                            <li>{t('driver.pricing.rule3', 'Evening: extra charge for night deliveries')}</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DriverEarnings
