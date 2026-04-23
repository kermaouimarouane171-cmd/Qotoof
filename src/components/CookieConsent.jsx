// CookieConsent component - handles user cookie consent preferences
// Note: If you see ERR_BLOCKED_BY_CLIENT, check your ad blocker extensions
import { useState, useEffect } from 'react'
import { XMarkIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { logger } from '../utils/logger.js'

// Safe localStorage wrapper
const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key)
    } catch (e) {
      logger.warn('localStorage not available:', e)
      return null
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      logger.warn('localStorage not available:', e)
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      logger.warn('localStorage not available:', e)
    }
  },
}

const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [preferences, setPreferences] = useState({
    necessary: true, // Always required
    analytics: false,
    marketing: false,
    functional: false,
  })

  useEffect(() => {
    const consent = safeLocalStorage.getItem('cookie_consent')
    if (!consent) {
      setShowBanner(true)
    } else {
      try {
        const parsed = JSON.parse(consent)
        setPreferences(parsed)
      } catch (e) {
        setShowBanner(true)
      }
    }
  }, [])

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    }
    safeLocalStorage.setItem('cookie_consent', JSON.stringify(allAccepted))
    setShowBanner(false)
  }

  const handleAcceptSelected = () => {
    safeLocalStorage.setItem('cookie_consent', JSON.stringify(preferences))
    setShowBanner(false)
  }

  const handleRejectAll = () => {
    const minimal = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    }
    safeLocalStorage.setItem('cookie_consent', JSON.stringify(minimal))
    setShowBanner(false)
  }

  const resetConsent = () => {
    safeLocalStorage.removeItem('cookie_consent')
    setShowBanner(true)
  }

  if (!showBanner && !showPreferences) {
    // Show small button to reopen preferences
    return (
      <button
        onClick={() => setShowPreferences(true)}
        className="fixed bottom-4 left-4 z-50 p-2 bg-gray-100 hover:bg-gray-200 rounded-full shadow-lg transition-colors"
        title="Cookie Preferences"
      >
        <Cog6ToothIcon className="w-5 h-5 text-gray-600" />
      </button>
    )
  }

  if (showPreferences) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Cookie Preferences</h2>
            <button onClick={() => setShowPreferences(false)} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Necessary</p>
                <p className="text-xs text-gray-500">Required for the website to function</p>
              </div>
              <input type="checkbox" checked disabled className="toggle" />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Analytics</p>
                <p className="text-xs text-gray-500">Help us understand how visitors use the site</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                className="toggle"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Marketing</p>
                <p className="text-xs text-gray-500">Used to deliver relevant advertisements</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.marketing}
                onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                className="toggle"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Functional</p>
                <p className="text-xs text-gray-500">Enable enhanced functionality and personalization</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.functional}
                onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                className="toggle"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowPreferences(false)} className="btn-outline flex-1">
              Cancel
            </button>
            <button
              onClick={() => {
                safeLocalStorage.setItem('cookie_consent', JSON.stringify(preferences))
                setShowPreferences(false)
              }}
              className="btn-primary flex-1"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-gray-700">
              🍪 We use cookies to enhance your experience. By continuing to visit this site you agree to our use of cookies.
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowPreferences(true)}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Manage Preferences
              </button>
              <a href="/privacy" className="text-sm text-gray-500 hover:text-gray-600">
                Privacy Policy
              </a>
              <a href="/terms" className="text-sm text-gray-500 hover:text-gray-600">
                Terms of Service
              </a>
            </div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={handleRejectAll}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Reject All
            </button>
            <button
              onClick={handleAcceptSelected}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Accept Selected
            </button>
            <button
              onClick={handleAcceptAll}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CookieConsent
