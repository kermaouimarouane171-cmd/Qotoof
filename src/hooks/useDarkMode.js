import { useState, useEffect, useCallback } from 'react'

const DARK_MODE_KEY = 'qotoof-dark-mode'

export const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem(DARK_MODE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      localStorage.setItem(DARK_MODE_KEY, isDark)
    } catch {
      // Storage not available
    }
  }, [isDark])

  const toggle = useCallback(() => setIsDark(prev => !prev), [])
  const enable = useCallback(() => setIsDark(true), [])
  const disable = useCallback(() => setIsDark(false), [])

  return { isDark, toggle, enable, disable }
}

export default useDarkMode
