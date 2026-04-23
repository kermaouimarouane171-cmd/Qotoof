import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import deliveryScheduleService from '@/services/deliveryScheduleService'
import { Card, LoadingSpinner } from '@/components/ui'
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const DAYS = [
  { id: 0, name: 'Sunday', nameAr: 'الأحد' },
  { id: 1, name: 'Monday', nameAr: 'الإثنين' },
  { id: 2, name: 'Tuesday', nameAr: 'الثلاثاء' },
  { id: 3, name: 'Wednesday', nameAr: 'الأربعاء' },
  { id: 4, name: 'Thursday', nameAr: 'الخميس' },
  { id: 5, name: 'Friday', nameAr: 'الجمعة' },
  { id: 6, name: 'Saturday', nameAr: 'السبت' },
]

const DEFAULT_OPEN = '09:00'
const DEFAULT_CLOSE = '18:00'

const createDraftSlot = (dayOfWeek) => ({
  id: null,
  draftKey: `draft-${dayOfWeek}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  day_of_week: dayOfWeek,
  slot_label: 'فترة توصيل',
  start_time: '09:00',
  end_time: '12:00',
  cutoff_hours: 2,
  max_orders: '',
  is_active: true,
})

const getSlotKey = (slot) => slot.id || slot.draftKey

const VendorSchedules = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [schedules, setSchedules] = useState(
    DAYS.map(day => ({
      day_of_week: day.id,
      is_open: day.id >= 1 && day.id <= 5, // Mon-Fri open by default
      open_time: DEFAULT_OPEN,
      close_time: DEFAULT_CLOSE,
    }))
  )
  const [hasChanges, setHasChanges] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [savingSlots, setSavingSlots] = useState(false)
  const [deliverySlots, setDeliverySlots] = useState([])
  const [hasSlotChanges, setHasSlotChanges] = useState(false)

  // ============================================
  // Load Schedules
  // ============================================

  const loadSchedules = useCallback(async () => {
    if (!user) return

    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('vendor_schedules')
        .select('*')
        .eq('vendor_id', user.id)
        .order('day_of_week', { ascending: true })

      if (error) {
        // Table might not exist yet — use defaults
        if (error.code === '42P01') {
          logger.warn('vendor_schedules table not found, using defaults')
          return
        }
        throw error
      }

      if (data && data.length > 0) {
        // Merge loaded schedules with all days
        const merged = DAYS.map(day => {
          const existing = data.find(s => s.day_of_week === day.id)
          return existing || {
            day_of_week: day.id,
            is_open: day.id >= 1 && day.id <= 5,
            open_time: DEFAULT_OPEN,
            close_time: DEFAULT_CLOSE,
          }
        })
        setSchedules(merged)
      }
    } catch (error) {
      logger.error('Error loading schedules:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  const loadDeliverySlots = useCallback(async () => {
    if (!user) return

    try {
      setLoadingSlots(true)
      const slots = await deliveryScheduleService.getVendorDeliverySlots(user.id)
      setDeliverySlots(slots)
      setHasSlotChanges(false)
    } catch (error) {
      logger.error('Error loading delivery slots:', error)
      toast.error(t('vendor.schedules.deliverySlotsLoadFailed', 'Failed to load delivery slots'))
    } finally {
      setLoadingSlots(false)
    }
  }, [t, user])

  useEffect(() => {
    loadDeliverySlots()
  }, [loadDeliverySlots])

  // ============================================
  // Schedule Changes
  // ============================================

  const handleToggleDay = (dayOfWeek) => {
    setSchedules(prev =>
      prev.map(s =>
        s.day_of_week === dayOfWeek
          ? { ...s, is_open: !s.is_open }
          : s
      )
    )
    setHasChanges(true)
  }

  const handleTimeChange = (dayOfWeek, field, value) => {
    setSchedules(prev =>
      prev.map(s =>
        s.day_of_week === dayOfWeek
          ? { ...s, [field]: value }
          : s
      )
    )
    setHasChanges(true)
  }

  const handleSetAllOpen = () => {
    setSchedules(prev =>
      prev.map(s => ({
        ...s,
        is_open: true,
        open_time: DEFAULT_OPEN,
        close_time: DEFAULT_CLOSE,
      }))
    )
    setHasChanges(true)
  }

  const handleSetAllClosed = () => {
    setSchedules(prev =>
      prev.map(s => ({ ...s, is_open: false }))
    )
    setHasChanges(true)
  }

  const handleAddDeliverySlot = (dayOfWeek) => {
    setDeliverySlots((prev) => [...prev, createDraftSlot(dayOfWeek)])
    setHasSlotChanges(true)
  }

  const handleDeliverySlotChange = (slotKey, field, value) => {
    setDeliverySlots((prev) =>
      prev.map((slot) =>
        getSlotKey(slot) === slotKey
          ? { ...slot, [field]: value }
          : slot
      )
    )
    setHasSlotChanges(true)
  }

  const handleRemoveDeliverySlot = (slotKey) => {
    setDeliverySlots((prev) => prev.filter((slot) => getSlotKey(slot) !== slotKey))
    setHasSlotChanges(true)
  }

  // ============================================
  // Save
  // ============================================

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      // Upsert all schedules
      const { error } = await supabase
        .from('vendor_schedules')
        .upsert(
          schedules.map(s => ({
            vendor_id: user.id,
            day_of_week: s.day_of_week,
            is_open: s.is_open,
            open_time: s.is_open ? s.open_time : null,
            close_time: s.is_open ? s.close_time : null,
          })),
          {
            onConflict: 'vendor_id,day_of_week',
          }
        )

      if (error) throw error

      // Also update business_hours JSON in profiles for quick display
      const businessHours = {}
      schedules.forEach(s => {
        const dayName = DAYS.find(d => d.id === s.day_of_week)?.name || `Day ${s.day_of_week}`
        businessHours[dayName] = s.is_open
          ? `${s.open_time} - ${s.close_time}`
          : 'Closed'
      })

      await supabase
        .from('profiles')
        .update({ business_hours: businessHours })
        .eq('id', user.id)

      toast.success(t('vendor.schedules.savedSuccess', 'Schedule saved successfully!'))
      setHasChanges(false)
    } catch (error) {
      logger.error('Error saving schedule:', error)
      toast.error(t('vendor.schedules.saveFailed', 'Failed to save schedule'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDeliverySlots = async () => {
    if (!user) return

    setSavingSlots(true)
    try {
      const savedSlots = await deliveryScheduleService.saveVendorDeliverySlots({
        vendorId: user.id,
        slots: deliverySlots,
      })

      setDeliverySlots(savedSlots)
      setHasSlotChanges(false)
      toast.success(t('vendor.schedules.deliverySlotsSaved', 'Delivery slots saved successfully!'))
    } catch (error) {
      logger.error('Error saving delivery slots:', error)
      toast.error(error.message || t('vendor.schedules.deliverySlotsSaveFailed', 'Failed to save delivery slots'))
    } finally {
      setSavingSlots(false)
    }
  }

  // ============================================
  // Loading State
  // ============================================

  if (loading || loadingSlots) {
    return <LoadingSpinner size="lg" />
  }

  // ============================================
  // Main Render
  // ============================================

  const today = new Date().getDay() // 0=Sunday

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('vendor.schedules.title', 'Schedules & Availability')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('vendor.schedules.subtitle', "Set your working hours so customers know when you're available")}
          </p>
        </div>
        <button
          onClick={loadSchedules}
          className="btn-outline text-sm py-2 px-3 flex items-center gap-2"
        >
          <ArrowPathIcon className="w-4 h-4" />
          {t('vendor.schedules.refresh', 'Refresh')}
        </button>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-6">
        <button onClick={handleSetAllOpen} className="btn-outline text-sm py-2 px-4">
          <CheckCircleIcon className="w-4 h-4 mr-1" />
          {t('vendor.schedules.openAllDays', 'Open All Days')}
        </button>
        <button onClick={handleSetAllClosed} className="btn-outline text-sm py-2 px-4">
          <XCircleIcon className="w-4 h-4 mr-1" />
          {t('vendor.schedules.closeAllDays', 'Close All Days')}
        </button>
      </div>

      {/* Schedule Table */}
      <Card className="p-6">
        <div className="space-y-3">
          {schedules.map((schedule) => {
            const dayInfo = DAYS.find(d => d.id === schedule.day_of_week)
            const isToday = schedule.day_of_week === today

            return (
              <div
                key={schedule.day_of_week}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${
                  isToday
                    ? 'border-green-300 bg-green-50'
                    : schedule.is_open
                      ? 'border-gray-200 bg-gray-50'
                      : 'border-red-200 bg-red-50'
                }`}
              >
                {/* Day Name */}
                <div className="flex items-center gap-3 min-w-[160px]">
                  {isToday && (
                    <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-bold rounded-full">
                      {t('vendor.schedules.today', 'Today')}
                    </span>
                  )}
                  <span className={`font-semibold ${isToday ? 'text-green-800' : 'text-gray-900'}`}>
                    {dayInfo?.name}
                  </span>
                </div>

                {/* Toggle */}
                <button
                  onClick={() => handleToggleDay(schedule.day_of_week)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    schedule.is_open
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  {schedule.is_open ? (
                    <CheckCircleIcon className="w-4 h-4" />
                  ) : (
                    <XCircleIcon className="w-4 h-4" />
                  )}
                  {schedule.is_open ? t('vendor.schedules.open', 'Open') : t('vendor.schedules.closed', 'Closed')}
                </button>

                {/* Time Inputs */}
                {schedule.is_open ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={schedule.open_time}
                      onChange={(e) => handleTimeChange(schedule.day_of_week, 'open_time', e.target.value)}
                      className="input py-1.5 px-3 text-sm"
                    />
                    <span className="text-gray-400 text-sm">{t('vendor.schedules.to', 'to')}</span>
                    <input
                      type="time"
                      value={schedule.close_time}
                      onChange={(e) => handleTimeChange(schedule.day_of_week, 'close_time', e.target.value)}
                      className="input py-1.5 px-3 text-sm"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-red-500 font-medium min-w-[200px] text-center">
                    {t('vendor.schedules.closedAllDay', 'Closed all day')}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Save Button */}
        <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {hasChanges ? t('vendor.schedules.unsavedChanges', 'You have unsaved changes') : t('vendor.schedules.allSaved', 'All changes saved')}
          </p>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" /> {t('vendor.schedules.saving', 'Saving...')}
              </>
            ) : (
              t('vendor.schedules.saveSchedule', 'Save Schedule')
            )}
          </button>
        </div>
      </Card>

      <Card className="p-6 mt-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('vendor.schedules.deliverySlotsTitle', 'Delivery Slots')}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('vendor.schedules.deliverySlotsSubtitle', 'Define bookable delivery windows, daily cutoff times, and per-slot capacity.')}
            </p>
          </div>
          <button
            onClick={loadDeliverySlots}
            className="btn-outline text-sm py-2 px-3 flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            {t('vendor.schedules.refresh', 'Refresh')}
          </button>
        </div>

        <div className="space-y-4">
          {DAYS.map((day) => {
            const daySlots = deliverySlots.filter((slot) => Number(slot.day_of_week) === day.id)

            return (
              <div key={day.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{day.nameAr}</h3>
                    <p className="text-xs text-gray-500 mt-1">{daySlots.length} فترة مضافة</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddDeliverySlot(day.id)}
                    className="btn-outline text-sm py-2 px-3"
                  >
                    {t('vendor.schedules.addSlot', 'Add slot')}
                  </button>
                </div>

                {daySlots.length === 0 ? (
                  <div className="rounded-xl bg-gray-50 px-4 py-4 text-sm text-gray-500 text-center">
                    {t('vendor.schedules.noSlotsForDay', 'No delivery slots configured for this day.')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {daySlots.map((slot) => {
                      const slotKey = getSlotKey(slot)

                      return (
                        <div key={slotKey} className="grid grid-cols-1 lg:grid-cols-6 gap-3 rounded-xl bg-gray-50 p-4">
                          <input
                            type="text"
                            value={slot.slot_label}
                            onChange={(event) => handleDeliverySlotChange(slotKey, 'slot_label', event.target.value)}
                            className="input"
                            placeholder={t('vendor.schedules.slotLabel', 'Slot name')}
                          />
                          <input
                            type="time"
                            value={slot.start_time}
                            onChange={(event) => handleDeliverySlotChange(slotKey, 'start_time', event.target.value)}
                            className="input"
                          />
                          <input
                            type="time"
                            value={slot.end_time}
                            onChange={(event) => handleDeliverySlotChange(slotKey, 'end_time', event.target.value)}
                            className="input"
                          />
                          <input
                            type="number"
                            min="0"
                            value={slot.cutoff_hours}
                            onChange={(event) => handleDeliverySlotChange(slotKey, 'cutoff_hours', event.target.value)}
                            className="input"
                            placeholder={t('vendor.schedules.cutoffHours', 'Cutoff hours')}
                          />
                          <input
                            type="number"
                            min="1"
                            value={slot.max_orders ?? ''}
                            onChange={(event) => handleDeliverySlotChange(slotKey, 'max_orders', event.target.value)}
                            className="input"
                            placeholder={t('vendor.schedules.maxOrders', 'Max orders')}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDeliverySlotChange(slotKey, 'is_active', !slot.is_active)}
                              className={`px-3 py-2 rounded-lg text-sm font-medium ${
                                slot.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                              }`}
                            >
                              {slot.is_active ? t('vendor.schedules.open', 'Open') : t('vendor.schedules.closed', 'Closed')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveDeliverySlot(slotKey)}
                              className="px-3 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700"
                            >
                              {t('vendor.schedules.removeSlot', 'Remove')}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {hasSlotChanges
              ? t('vendor.schedules.unsavedSlotChanges', 'You have unsaved delivery slot changes')
              : t('vendor.schedules.allSlotsSaved', 'All delivery slots saved')}
          </p>
          <button
            onClick={handleSaveDeliverySlots}
            disabled={savingSlots || !hasSlotChanges}
            className="btn-primary px-8 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingSlots ? t('vendor.schedules.saving', 'Saving...') : t('vendor.schedules.saveDeliverySlots', 'Save delivery slots')}
          </button>
        </div>
      </Card>
    </div>
  )
}

export default VendorSchedules
