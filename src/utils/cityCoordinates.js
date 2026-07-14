/**
 * City Coordinates Helper
 * Provides approximate lat/lng for major Moroccan cities.
 * Used for auto-centering maps when a city is selected.
 *
 * Supports Arabic and Latin (French/English) spellings.
 * Returns null for unknown cities (graceful degrade).
 */

const CITY_COORDINATES = {
  // Casablanca
  'casablanca': { lat: 33.5731, lng: -7.5898, label: 'الدار البيضاء' },
  'الدار البيضاء': { lat: 33.5731, lng: -7.5898, label: 'الدار البيضاء' },
  'dar el beida': { lat: 33.5731, lng: -7.5898, label: 'الدار البيضاء' },

  // Rabat
  'rabat': { lat: 34.0209, lng: -6.8417, label: 'الرباط' },
  'الرباط': { lat: 34.0209, lng: -6.8417, label: 'الرباط' },

  // Marrakech
  'marrakech': { lat: 31.6295, lng: -7.9811, label: 'مراكش' },
  'marrakesh': { lat: 31.6295, lng: -7.9811, label: 'مراكش' },
  'مراكش': { lat: 31.6295, lng: -7.9811, label: 'مراكش' },

  // Fes
  'fes': { lat: 34.0181, lng: -5.0078, label: 'فاس' },
  'fez': { lat: 34.0181, lng: -5.0078, label: 'فاس' },
  'فاس': { lat: 34.0181, lng: -5.0078, label: 'فاس' },

  // Tangier / Tanger
  'tangier': { lat: 35.7595, lng: -5.8340, label: 'طنجة' },
  'tanger': { lat: 35.7595, lng: -5.8340, label: 'طنجة' },
  'طنجة': { lat: 35.7595, lng: -5.8340, label: 'طنجة' },

  // Agadir
  'agadir': { lat: 30.4278, lng: -9.5981, label: 'أكادير' },
  'أكادير': { lat: 30.4278, lng: -9.5981, label: 'أكادير' },

  // Meknes
  'meknes': { lat: 33.8935, lng: -5.5473, label: 'مكناس' },
  'meknès': { lat: 33.8935, lng: -5.5473, label: 'مكناس' },
  'مكناس': { lat: 33.8935, lng: -5.5473, label: 'مكناس' },

  // Oujda
  'oujda': { lat: 34.6814, lng: -1.9086, label: 'وجدة' },
  'وجدة': { lat: 34.6814, lng: -1.9086, label: 'وجدة' },

  // Kenitra
  'kenitra': { lat: 34.2610, lng: -6.5802, label: 'القنيطرة' },
  'kénitra': { lat: 34.2610, lng: -6.5802, label: 'القنيطرة' },
  'القنيطرة': { lat: 34.2610, lng: -6.5802, label: 'القنيطرة' },

  // Tetouan
  'tetouan': { lat: 35.5889, lng: -5.3626, label: 'تطوان' },
  'tétouan': { lat: 35.5889, lng: -5.3626, label: 'تطوان' },
  'تطوان': { lat: 35.5889, lng: -5.3626, label: 'تطوان' },

  // Safi
  'safi': { lat: 32.2994, lng: -9.2372, label: 'آسفي' },
  'asfi': { lat: 32.2994, lng: -9.2372, label: 'آسفي' },
  'آسفي': { lat: 32.2994, lng: -9.2372, label: 'آسفي' },

  // El Jadida
  'el jadida': { lat: 33.2549, lng: -8.5060, label: 'الجديدة' },
  'mazagan': { lat: 33.2549, lng: -8.5060, label: 'الجديدة' },
  'الجديدة': { lat: 33.2549, lng: -8.5060, label: 'الجديدة' },

  // Nador
  'nador': { lat: 35.1747, lng: -2.9287, label: 'الناظور' },
  'الناظور': { lat: 35.1747, lng: -2.9287, label: 'الناظور' },

  // Beni Mellal
  'beni mellal': { lat: 32.3373, lng: -6.3498, label: 'بني ملال' },
  'béni mellal': { lat: 32.3373, lng: -6.3498, label: 'بني ملال' },
  'بني ملال': { lat: 32.3373, lng: -6.3498, label: 'بني ملال' },

  // Khouribga
  'khouribga': { lat: 32.8860, lng: -6.9203, label: 'خريبكة' },
  'خريبكة': { lat: 32.8860, lng: -6.9203, label: 'خريبكة' },

  // Settat
  'settat': { lat: 33.0011, lng: -7.6205, label: 'سطات' },
  'سطات': { lat: 33.0011, lng: -7.6205, label: 'سطات' },

  // Taza
  'taza': { lat: 34.2167, lng: -4.0167, label: 'تازة' },
  'تازة': { lat: 34.2167, lng: -4.0167, label: 'تازة' },

  // Laayoune
  'laayoune': { lat: 27.1536, lng: -13.2033, label: 'العيون' },
  'laâyoune': { lat: 27.1536, lng: -13.2033, label: 'العيون' },
  'el aaiun': { lat: 27.1536, lng: -13.2033, label: 'العيون' },
  'العيون': { lat: 27.1536, lng: -13.2033, label: 'العيون' },

  // Dakhla
  'dakhla': { lat: 23.6848, lng: -15.9570, label: 'الداخلة' },
  'ad dakhla': { lat: 23.6848, lng: -15.9570, label: 'الداخلة' },
  'الداخلة': { lat: 23.6848, lng: -15.9570, label: 'الداخلة' },

  // Errachidia
  'errachidia': { lat: 31.9314, lng: -4.4247, label: 'الراشيدية' },
  'الراشيدية': { lat: 31.9314, lng: -4.4247, label: 'الراشيدية' },

  // Essaouira
  'essaouira': { lat: 31.5085, lng: -9.7595, label: 'الصويرة' },
  'mogador': { lat: 31.5085, lng: -9.7595, label: 'الصويرة' },
  'الصويرة': { lat: 31.5085, lng: -9.7595, label: 'الصويرة' },

  // Chefchaouen
  'chefchaouen': { lat: 35.1716, lng: -5.2697, label: 'شفشاون' },
  'chaouen': { lat: 35.1716, lng: -5.2697, label: 'شفشاون' },
  'شفشاون': { lat: 35.1716, lng: -5.2697, label: 'شفشاون' },

  // Ifrane
  'ifrane': { lat: 33.5326, lng: -5.1111, label: 'إفران' },
  'إفران': { lat: 33.5326, lng: -5.1111, label: 'إفران' },

  // Larache
  'larache': { lat: 35.1833, lng: -6.1500, label: 'العرائش' },
  'العرائش': { lat: 35.1833, lng: -6.1500, label: 'العرائش' },

  // Khemisset
  'khemisset': { lat: 33.8242, lng: -6.0663, label: 'الخميسات' },
  'khemissett': { lat: 33.8242, lng: -6.0663, label: 'الخميسات' },
  'الخميسات': { lat: 33.8242, lng: -6.0663, label: 'الخميسات' },

  // Zaio
  'zaio': { lat: 34.9419, lng: -2.7342, label: 'زايو' },
  'zaïo': { lat: 34.9419, lng: -2.7342, label: 'زايو' },
  'زايو': { lat: 34.9419, lng: -2.7342, label: 'زايو' },

  // Berkane
  'berkane': { lat: 34.9228, lng: -2.3176, label: 'بركان' },
  'بركان': { lat: 34.9228, lng: -2.3176, label: 'بركان' },

  // Taourirt
  'taourirt': { lat: 34.4167, lng: -2.8833, label: 'تاوريرت' },
  'تاوريرت': { lat: 34.4167, lng: -2.8833, label: 'تاوريرت' },

  // Jerada
  'jerada': { lat: 34.3050, lng: -2.1667, label: 'جرسيف' },
  'جرسيف': { lat: 34.3050, lng: -2.1667, label: 'جرسيف' },

  // Figuig
  'figuig': { lat: 32.1076, lng: -1.2244, label: 'فكيك' },
  'فكيك': { lat: 32.1076, lng: -1.2244, label: 'فكيك' },

  // Guercif
  'guercif': { lat: 34.2242, lng: -3.3467, label: 'جرسيف' },
  'جرسيف': { lat: 34.2242, lng: -3.3467, label: 'جرسيف' },

  // Oued Zem
  'oued zem': { lat: 32.8628, lng: -6.5728, label: 'وادي زم' },
  'وادي زم': { lat: 32.8628, lng: -6.5728, label: 'وادي زم' },

  // Berrechid
  'berrechid': { lat: 33.2650, lng: -7.5867, label: 'برشيد' },
  'برشيد': { lat: 33.2650, lng: -7.5867, label: 'برشيد' },

  // Mohammedia
  'mohammedia': { lat: 33.6833, lng: -7.3833, label: 'المحمدية' },
  'المحمدية': { lat: 33.6833, lng: -7.3833, label: 'المحمدية' },

  // Tanger-Tetouan region
  'larache': { lat: 35.1833, lng: -6.1500, label: 'العرائش' },

  // Guelmim
  'guelmim': { lat: 28.9870, lng: -10.0570, label: 'كلميم' },
  'كلميم': { lat: 28.9870, lng: -10.0570, label: 'كلميم' },

  // Tarfaya
  'tarfaya': { lat: 27.9281, lng: -12.9333, label: 'طرفاية' },
  'طرفاية': { lat: 27.9281, lng: -12.9333, label: 'طرفاية' },

  // Tiznit
  'tiznit': { lat: 29.6936, lng: -9.7331, label: 'تيزنيت' },
  'تيزنيت': { lat: 29.6936, lng: -9.7331, label: 'تيزنيت' },

  // Inezgane
  'inezgane': { lat: 30.3833, lng: -9.5333, label: 'إنزكان' },
  'إنزكان': { lat: 30.3833, lng: -9.5333, label: 'إنزكان' },

  // Ouarzazate
  'ouarzazate': { lat: 30.9335, lng: -6.9370, label: 'ورزازات' },
  'ورزازات': { lat: 30.9335, lng: -6.9370, label: 'ورزازات' },

  // Zagora
  'zagora': { lat: 30.3289, lng: -5.8333, label: 'زاكورة' },
  'زاكورة': { lat: 30.3289, lng: -5.8333, label: 'زاكورة' },

  // Tinghir
  'tinghir': { lat: 31.5147, lng: -5.5328, label: 'تنغير' },
  'تنغير': { lat: 31.5147, lng: -5.5328, label: 'تنغير' },

  // Midelt
  'midelt': { lat: 32.6833, lng: -4.7500, label: 'ميدلت' },
  'ميدلت': { lat: 32.6833, lng: -4.7500, label: 'ميدلت' },

  // Azilal
  'azilal': { lat: 31.9631, lng: -6.5667, label: 'أزيلال' },
  'أزيلال': { lat: 31.9631, lng: -6.5667, label: 'أزيلال' },

  // Fquih Ben Salah
  'fquih ben salah': { lat: 32.5047, lng: -6.7231, label: 'فقيه بن صالح' },
  'فقيه بن صالح': { lat: 32.5047, lng: -6.7231, label: 'فقيه بن صالح' },

  // Sidi Kacem
  'sidi kacem': { lat: 34.2214, lng: -5.7078, label: 'سيدي قاسم' },
  'سيدي قاسم': { lat: 34.2214, lng: -5.7078, label: 'سيدي قاسم' },

  // Sidi Slimane
  'sidi slimane': { lat: 34.2653, lng: -5.9264, label: 'سيدي سليمان' },
  'سيدي سليمان': { lat: 34.2653, lng: -5.9264, label: 'سيدي سليمان' },

  // Boujdour
  'boujdour': { lat: 26.1250, lng: -14.4833, label: 'بوجدور' },
  'بوجدور': { lat: 26.1250, lng: -14.4833, label: 'بوجدور' },

  // Smara
  'smara': { lat: 26.7390, lng: -11.6700, label: 'السمارة' },
  'السمارة': { lat: 26.7390, lng: -11.6700, label: 'السمارة' },

  // Tan-Tan
  'tan-tan': { lat: 28.4380, lng: -11.1030, label: 'طانطان' },
  'tan tan': { lat: 28.4380, lng: -11.1030, label: 'طانطان' },
  'طانطان': { lat: 28.4380, lng: -11.1030, label: 'طانطان' },

  // Moulay Ali Cherif (Errachidia area)
  'rif': { lat: 35.0, lng: -3.0, label: 'الريف' },

  // Al Hoceima
  'al hoceima': { lat: 35.2439, lng: -3.9347, label: 'الحسيمة' },
  'hoceima': { lat: 35.2439, lng: -3.9347, label: 'الحسيمة' },
  'الحسيمة': { lat: 35.2439, lng: -3.9347, label: 'الحسيمة' },

  // Driouch
  'driouch': { lat: 35.1667, lng: -3.3333, label: 'دريوش' },
  'دريوش': { lat: 35.1667, lng: -3.3333, label: 'دريوش' },

  // Nador region villages
  'zeghanghane': { lat: 35.1167, lng: -2.8833, label: 'زغنغان' },
  'زغنغان': { lat: 35.1167, lng: -2.8833, label: 'زغنغان' },

  // Targuist
  'targuist': { lat: 35.0500, lng: -4.3167, label: 'تارجيست' },
  'تارجيست': { lat: 35.0500, lng: -4.3167, label: 'تارجيست' },

  // Imzouren
  'imzouren': { lat: 35.2000, lng: -3.8500, label: 'إمزورن' },
  'إمزورن': { lat: 35.2000, lng: -3.8500, label: 'إمزورن' },
}

/**
 * Get city center coordinates
 * @param {string} cityName - City name (Arabic or Latin)
 * @returns {{lat: number, lng: number, label: string} | null}
 */
export function getCityCoordinates(cityName) {
  if (!cityName || typeof cityName !== 'string') return null

  const normalized = cityName.toLowerCase().trim()
  const coords = CITY_COORDINATES[normalized]

  if (!coords) return null

  return { ...coords }
}

/**
 * Get default fallback coordinates (Casablanca city center)
 * @returns {{lat: number, lng: number, label: string}}
 */
export function getDefaultCityCenter() {
  return { lat: 33.5731, lng: -7.5898, label: 'الدار البيضاء' }
}
