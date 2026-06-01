import { Capacitor } from '@capacitor/core'

const canUseLocalStorage = () => {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

const readLocal = (key) => {
  if (!canUseLocalStorage()) return null
  return localStorage.getItem(key)
}

const writeLocal = (key, value) => {
  if (!canUseLocalStorage()) return
  localStorage.setItem(key, value)
}

const removeLocal = (key) => {
  if (!canUseLocalStorage()) return
  localStorage.removeItem(key)
}

let preferencesModulePromise = null

const getPreferences = async () => {
  if (!Capacitor.isNativePlatform()) return null

  if (!preferencesModulePromise) {
    preferencesModulePromise = import('@capacitor/preferences').catch(() => null)
  }

  const module = await preferencesModulePromise
  return module?.Preferences || null
}

export const persistStorage = {
  getItem: async (name) => {
    const Preferences = await getPreferences()
    if (Preferences) {
      const { value } = await Preferences.get({ key: name })
      if (value != null) return value
    }
    return readLocal(name)
  },
  setItem: async (name, value) => {
    writeLocal(name, value)
    const Preferences = await getPreferences()
    if (Preferences) {
      await Preferences.set({ key: name, value })
    }
  },
  removeItem: async (name) => {
    removeLocal(name)
    const Preferences = await getPreferences()
    if (Preferences) {
      await Preferences.remove({ key: name })
    }
  },
}
