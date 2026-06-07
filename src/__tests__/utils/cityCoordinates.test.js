import {
  getCityCoordinates,
  getDefaultCityCenter,
} from '../../utils/cityCoordinates'

describe('cityCoordinates', () => {
  describe('getCityCoordinates', () => {
    it('returns coordinates for Casablanca (English)', () => {
      const result = getCityCoordinates('Casablanca')
      expect(result).toEqual({
        lat: 33.5731,
        lng: -7.5898,
        label: 'الدار البيضاء',
      })
    })

    it('returns coordinates for الدار البيضاء (Arabic)', () => {
      const result = getCityCoordinates('الدار البيضاء')
      expect(result).toEqual({
        lat: 33.5731,
        lng: -7.5898,
        label: 'الدار البيضاء',
      })
    })

    it('returns coordinates for Rabat (English)', () => {
      const result = getCityCoordinates('Rabat')
      expect(result).toEqual({
        lat: 34.0209,
        lng: -6.8417,
        label: 'الرباط',
      })
    })

    it('returns coordinates for مراكش (Arabic)', () => {
      const result = getCityCoordinates('مراكش')
      expect(result).toEqual({
        lat: 31.6295,
        lng: -7.9811,
        label: 'مراكش',
      })
    })

    it('returns coordinates for Marrakech with French spelling', () => {
      const result = getCityCoordinates('Marrakesh')
      expect(result).toEqual({
        lat: 31.6295,
        lng: -7.9811,
        label: 'مراكش',
      })
    })

    it('returns coordinates for Tanger (French)', () => {
      const result = getCityCoordinates('Tanger')
      expect(result).toEqual({
        lat: 35.7595,
        lng: -5.8340,
        label: 'طنجة',
      })
    })

    it('returns coordinates for Tangier (English)', () => {
      const result = getCityCoordinates('Tangier')
      expect(result).toEqual({
        lat: 35.7595,
        lng: -5.8340,
        label: 'طنجة',
      })
    })

    it('returns coordinates for Safi (corrected spelling)', () => {
      const result = getCityCoordinates('Safi')
      expect(result).toEqual({
        lat: 32.2994,
        lng: -9.2372,
        label: 'آسفي',
      })
    })

    it('returns coordinates for El Jadida', () => {
      const result = getCityCoordinates('El Jadida')
      expect(result).toEqual({
        lat: 33.2549,
        lng: -8.5060,
        label: 'الجديدة',
      })
    })

    it('returns coordinates for Laayoune', () => {
      const result = getCityCoordinates('Laayoune')
      expect(result).toEqual({
        lat: 27.1536,
        lng: -13.2033,
        label: 'العيون',
      })
    })

    it('returns coordinates for Dakhla', () => {
      const result = getCityCoordinates('Dakhla')
      expect(result).toEqual({
        lat: 23.6848,
        lng: -15.9570,
        label: 'الداخلة',
      })
    })

    it('returns coordinates for Errachidia', () => {
      const result = getCityCoordinates('Errachidia')
      expect(result).toEqual({
        lat: 31.9314,
        lng: -4.4247,
        label: 'الراشيدية',
      })
    })

    it('returns coordinates for Essaouira', () => {
      const result = getCityCoordinates('Essaouira')
      expect(result).toEqual({
        lat: 31.5085,
        lng: -9.7595,
        label: 'الصويرة',
      })
    })

    it('returns coordinates for Chefchaouen', () => {
      const result = getCityCoordinates('Chefchaouen')
      expect(result).toEqual({
        lat: 35.1716,
        lng: -5.2697,
        label: 'شفشاون',
      })
    })

    it('returns coordinates for Ifrane', () => {
      const result = getCityCoordinates('Ifrane')
      expect(result).toEqual({
        lat: 33.5326,
        lng: -5.1111,
        label: 'إفران',
      })
    })

    it('returns coordinates for Larache', () => {
      const result = getCityCoordinates('Larache')
      expect(result).toEqual({
        lat: 35.1833,
        lng: -6.1500,
        label: 'العرائش',
      })
    })

    it('returns coordinates for Khemisset', () => {
      const result = getCityCoordinates('Khemisset')
      expect(result).toEqual({
        lat: 33.8242,
        lng: -6.0663,
        label: 'الخميسات',
      })
    })

    it('returns null for unknown city', () => {
      const result = getCityCoordinates('UnknownCity')
      expect(result).toBeNull()
    })

    it('returns null for empty string', () => {
      const result = getCityCoordinates('')
      expect(result).toBeNull()
    })

    it('returns null for null input', () => {
      const result = getCityCoordinates(null)
      expect(result).toBeNull()
    })

    it('returns null for undefined input', () => {
      const result = getCityCoordinates(undefined)
      expect(result).toBeNull()
    })

    it('handles lowercase input', () => {
      const result = getCityCoordinates('casablanca')
      expect(result).toEqual({
        lat: 33.5731,
        lng: -7.5898,
        label: 'الدار البيضاء',
      })
    })

    it('handles input with extra spaces', () => {
      const result = getCityCoordinates('  Casablanca  ')
      expect(result).toEqual({
        lat: 33.5731,
        lng: -7.5898,
        label: 'الدار البيضاء',
      })
    })
  })

  describe('getDefaultCityCenter', () => {
    it('returns Casablanca coordinates', () => {
      const result = getDefaultCityCenter()
      expect(result).toEqual({
        lat: 33.5731,
        lng: -7.5898,
        label: 'الدار البيضاء',
      })
    })
  })
})
