import { create } from 'zustand'
import i18n from '@/i18n'

export const useLanguageStore = create((set, get) => ({
  language: 'en',
  direction: 'ltr',
  
  setLanguage: async (lang) => {
    await i18n.changeLanguage(lang)
    set({ language: lang })
    get().setDirection(lang)
    document.documentElement.lang = lang
  },
  
  setDirection: (lang) => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr'
    set({ direction: dir })
    document.documentElement.dir = dir
  },
  
  toggleLanguage: async () => {
    const { language } = get()
    const nextLang = language === 'en' ? 'ar' : language === 'ar' ? 'fr' : 'en'
    await get().setLanguage(nextLang)
  }
}))
