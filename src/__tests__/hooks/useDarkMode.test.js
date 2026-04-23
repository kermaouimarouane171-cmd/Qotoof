import { useState, useEffect, useCallback } from 'react'
import { renderHook, act } from '@testing-library/react'

// Simulated useDarkMode hook (isolated, no real imports)
const DARK_MODE_KEY = 'qotoof-dark-mode'

const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem(DARK_MODE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
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

describe('useDarkMode Hook', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('should initialize with false when no localStorage value exists', () => {
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.isDark).toBe(false)
  })

  it('should initialize with true when localStorage has "true"', () => {
    localStorage.setItem('qotoof-dark-mode', 'true')
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.isDark).toBe(true)
  })

  it('should toggle dark mode state', () => {
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.isDark).toBe(false)

    act(() => {
      result.current.toggle()
    })
    expect(result.current.isDark).toBe(true)

    act(() => {
      result.current.toggle()
    })
    expect(result.current.isDark).toBe(false)
  })

  it('should provide enable and disable functions', () => {
    const { result } = renderHook(() => useDarkMode())
    expect(result.current.isDark).toBe(false)

    act(() => {
      result.current.enable()
    })
    expect(result.current.isDark).toBe(true)

    act(() => {
      result.current.disable()
    })
    expect(result.current.isDark).toBe(false)
  })
})
