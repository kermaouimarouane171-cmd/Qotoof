import { useEffect } from 'react'

// Hide fixed mobile bottom navigation while the software keyboard is open.
export function useMobileKeyboardGuard() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return

    const root = document.documentElement
    const KEYBOARD_THRESHOLD = 120

    const updateKeyboardState = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight
      const heightDelta = window.innerHeight - viewportHeight

      if (heightDelta > KEYBOARD_THRESHOLD) {
        root.classList.add('keyboard-open')
      } else {
        root.classList.remove('keyboard-open')
      }
    }

    updateKeyboardState()
    window.visualViewport.addEventListener('resize', updateKeyboardState)
    window.visualViewport.addEventListener('scroll', updateKeyboardState)
    window.addEventListener('orientationchange', updateKeyboardState)

    return () => {
      root.classList.remove('keyboard-open')
      window.visualViewport?.removeEventListener('resize', updateKeyboardState)
      window.visualViewport?.removeEventListener('scroll', updateKeyboardState)
      window.removeEventListener('orientationchange', updateKeyboardState)
    }
  }, [])
}

export default useMobileKeyboardGuard
