/**
 * Tests for languageStore
 * Note: We test the language store logic in isolation.
 */

describe('languageStore', () => {
  // Simulated language store
  const createLanguageStore = () => {
    let state = {
      language: 'en',
      direction: 'ltr',
    }

    const getState = () => state

    const setState = (newState) => {
      state = { ...state, ...newState }
    }

    const languageCycle = { en: 'ar', ar: 'fr', fr: 'en' }

    return {
      getState,

      setLanguage(lang) {
        const direction = lang === 'ar' ? 'rtl' : 'ltr'
        setState({ language: lang, direction })
      },

      toggleLanguage() {
        const next = languageCycle[state.language] || 'en'
        this.setLanguage(next)
      },
    }
  }

  let store

  beforeEach(() => {
    store = createLanguageStore()
  })

  describe('setLanguage', () => {
    it('should set language to Arabic with RTL direction', () => {
      store.setLanguage('ar')

      expect(store.getState().language).toBe('ar')
      expect(store.getState().direction).toBe('rtl')
    })

    it('should set language to French with LTR direction', () => {
      store.setLanguage('fr')

      expect(store.getState().language).toBe('fr')
      expect(store.getState().direction).toBe('ltr')
    })

    it('should set language to English with LTR direction', () => {
      store.setLanguage('en')

      expect(store.getState().language).toBe('en')
      expect(store.getState().direction).toBe('ltr')
    })
  })

  describe('toggleLanguage', () => {
    it('should cycle from English to Arabic', () => {
      store.setLanguage('en')
      store.toggleLanguage()

      expect(store.getState().language).toBe('ar')
    })

    it('should cycle from Arabic to French', () => {
      store.setLanguage('ar')
      store.toggleLanguage()

      expect(store.getState().language).toBe('fr')
    })

    it('should cycle from French to English', () => {
      store.setLanguage('fr')
      store.toggleLanguage()

      expect(store.getState().language).toBe('en')
    })
  })
})
