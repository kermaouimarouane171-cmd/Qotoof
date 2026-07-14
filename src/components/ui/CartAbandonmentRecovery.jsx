import { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCartStore } from '@/modules/cart'
import { ShoppingCartIcon, XMarkIcon } from '@heroicons/react/24/outline'

const STORAGE_KEY = 'cart-abandonment-snapshot'
const MIN_ITEMS_FOR_RECOVERY = 1
const RECOVERY_PROMPT_DISMISS_KEY = 'cart-recovery-dismissed'

export function saveCartSnapshot(items) {
  if (!items || items.length < MIN_ITEMS_FOR_RECOVERY) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  const snapshot = {
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      price_per_unit: item.price_per_unit,
      quantity: item.quantity,
      unit_type: item.unit_type,
      vendor_id: item.vendor_id,
      vendor_name: item.vendor_name,
      image: item.image,
    })),
    savedAt: Date.now(),
    itemCount: items.length,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

export function getCartSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearCartSnapshot() {
  localStorage.removeItem(STORAGE_KEY)
}

export default function CartAbandonmentRecovery() {
  const { t } = useTranslation()
  const location = useLocation()
  const { items, addItem } = useCartStore()
  const [showPrompt, setShowPrompt] = useState(false)
  const [snapshot, setSnapshot] = useState(null)

  const isCartOrCheckout = location.pathname === '/cart' || location.pathname === '/checkout'

  useEffect(() => {
    if (items.length > 0) {
      saveCartSnapshot(items)
    }
  }, [items])

  useEffect(() => {
    if (isCartOrCheckout) {
      setShowPrompt(false)
      return
    }

    const saved = getCartSnapshot()
    if (!saved) return

    const dismissed = sessionStorage.getItem(RECOVERY_PROMPT_DISMISS_KEY)
    if (dismissed === 'true') return

    if (items.length > 0) return

    const ageHours = (Date.now() - saved.savedAt) / (1000 * 60 * 60)
    if (ageHours > 72) {
      clearCartSnapshot()
      return
    }

    setSnapshot(saved)
    const timer = setTimeout(() => setShowPrompt(true), 1500)
    return () => clearTimeout(timer)
  }, [location.pathname, items.length, isCartOrCheckout])

  const handleDismiss = useCallback(() => {
    setShowPrompt(false)
    sessionStorage.setItem(RECOVERY_PROMPT_DISMISS_KEY, 'true')
  }, [])

  const handleRestore = useCallback(() => {
    if (!snapshot) return
    snapshot.items.forEach((item) => {
      addItem(item, item.quantity)
    })
    setShowPrompt(false)
    clearCartSnapshot()
  }, [snapshot, addItem])

  const handleClear = useCallback(() => {
    setShowPrompt(false)
    clearCartSnapshot()
    sessionStorage.setItem(RECOVERY_PROMPT_DISMISS_KEY, 'true')
  }, [])

  if (!showPrompt || !snapshot) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-40 max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300"
      data-testid="cart-recovery-prompt"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <ShoppingCartIcon className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                {t('cart.recovery.title', 'Your cart is waiting')}
              </p>
              <p className="text-xs text-gray-500">
                {t('cart.recovery.itemCount', '{{count}} items were in your cart', { count: snapshot.itemCount })}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={t('cart.recovery.dismiss', 'Dismiss')}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRestore}
            className="flex-1 btn-primary text-sm py-2"
            data-testid="cart-recovery-restore"
          >
            {t('cart.recovery.restore', 'Restore Cart')}
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100"
            data-testid="cart-recovery-clear"
          >
            {t('cart.recovery.clear', 'Clear')}
          </button>
        </div>
      </div>
    </div>
  )
}
