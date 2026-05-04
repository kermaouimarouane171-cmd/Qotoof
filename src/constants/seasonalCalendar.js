/**
 * seasonalCalendar.js
 * Morocco agricultural seasonal calendar — month-by-month availability data.
 *
 * Each entry: { id, nameAr, nameFr, category, icon, peakMonths, availableMonths,
 *               description, region, tips }
 * Months are 1-indexed (1 = January, 12 = December).
 */

export const MOROCCAN_SEASONS = [
  // ─── Vegetables ─────────────────────────────────────────────────────────────
  {
    id: 'tomato',
    nameAr: 'طماطم',
    nameFr: 'Tomates',
    category: 'vegetables',
    icon: '🍅',
    peakMonths:      [5, 6, 7, 8, 9],
    availableMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11],
    region: 'سوس ماسة، الغرب',
    tips: 'أفضل جودة في يونيو-أغسطس — تنتج سوس ماسة ما يفوق 60% من الإنتاج الوطني',
  },
  {
    id: 'pepper',
    nameAr: 'فلفل',
    nameFr: 'Poivrons',
    category: 'vegetables',
    icon: '🫑',
    peakMonths:      [6, 7, 8, 9],
    availableMonths: [5, 6, 7, 8, 9, 10],
    region: 'سوس ماسة، الحوز',
    tips: 'الأخضر يسبق الأحمر الذي يتطلب مزيداً من التعرض للشمس',
  },
  {
    id: 'potato',
    nameAr: 'بطاطس',
    nameFr: 'Pommes de terre',
    category: 'vegetables',
    icon: '🥔',
    peakMonths:      [3, 4, 10, 11],
    availableMonths: [1, 2, 3, 4, 9, 10, 11, 12],
    region: 'سايس، الغرب، تادلة',
    tips: 'دورتان زراعيتان في السنة — ربيعية (مارس-أبريل) وخريفية (أكتوبر-نوفمبر)',
  },
  {
    id: 'onion',
    nameAr: 'بصل',
    nameFr: 'Oignons',
    category: 'vegetables',
    icon: '🧅',
    peakMonths:      [5, 6, 7],
    availableMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    region: 'الغرب، تادلة، سوس',
    tips: 'متوفر طوال العام بفضل التخزين، لكن الطازج يكون في مايو-يوليو',
  },
  {
    id: 'carrot',
    nameAr: 'جزر',
    nameFr: 'Carottes',
    category: 'vegetables',
    icon: '🥕',
    peakMonths:      [11, 12, 1, 2, 3],
    availableMonths: [10, 11, 12, 1, 2, 3, 4],
    region: 'الغرب، تادلة',
    tips: 'محصول شتوي بامتياز — أفضل جودة من ديسمبر إلى فبراير',
  },
  {
    id: 'zucchini',
    nameAr: 'كوسة',
    nameFr: 'Courgettes',
    category: 'vegetables',
    icon: '🥒',
    peakMonths:      [5, 6, 7, 8],
    availableMonths: [4, 5, 6, 7, 8, 9, 10],
    region: 'الحوز، سوس ماسة',
    tips: 'تنمو بسرعة وتتطلب ري منتظم — الصنف البلدي الأكثر طلباً في الجملة',
  },
  {
    id: 'lettuce',
    nameAr: 'خس',
    nameFr: 'Laitue',
    category: 'vegetables',
    icon: '🥬',
    peakMonths:      [3, 4, 10, 11],
    availableMonths: [2, 3, 4, 5, 9, 10, 11, 12],
    region: 'منطقة الغرب، سوس',
    tips: 'يزهر في الطقس المعتدل — يتجنب الصيف الحار',
  },
  {
    id: 'broad_bean',
    nameAr: 'فول',
    nameFr: 'Fèves',
    category: 'vegetables',
    icon: '🫘',
    peakMonths:      [3, 4, 5],
    availableMonths: [2, 3, 4, 5, 6],
    region: 'الرباط، الدار البيضاء، مكناس',
    tips: 'من الخضروات الربيعية الكلاسيكية — الطازج أفضل بكثير من المجمّد',
  },
  {
    id: 'pea',
    nameAr: 'جلبانة',
    nameFr: 'Petits pois',
    category: 'vegetables',
    icon: '🟩',
    peakMonths:      [3, 4, 5],
    availableMonths: [2, 3, 4, 5],
    region: 'سايس، تادلة',
    tips: 'موسم قصير جداً — اشتر بالجملة وجمّد الفائض',
  },

  // ─── Fruits ──────────────────────────────────────────────────────────────────
  {
    id: 'orange',
    nameAr: 'برتقال',
    nameFr: 'Oranges',
    category: 'fruits',
    icon: '🍊',
    peakMonths:      [12, 1, 2, 3],
    availableMonths: [11, 12, 1, 2, 3, 4],
    region: 'سوس ماسة، الغرب، تافيلالت',
    tips: 'المغرب من أكبر مصدري البرتقال عالمياً — Navel الأفضل في يناير',
  },
  {
    id: 'mandarin',
    nameAr: 'كليمنتين',
    nameFr: 'Clémentines',
    category: 'fruits',
    icon: '🍊',
    peakMonths:      [11, 12, 1],
    availableMonths: [10, 11, 12, 1, 2],
    region: 'بركان، الناظور',
    tips: 'كليمنتين بركان لها حماية جغرافية — اطلب بمواصفة "بركان AOC"',
  },
  {
    id: 'strawberry',
    nameAr: 'فراولة',
    nameFr: 'Fraises',
    category: 'fruits',
    icon: '🍓',
    peakMonths:      [2, 3, 4, 5],
    availableMonths: [1, 2, 3, 4, 5, 6],
    region: 'الغرب (القنيطرة)، لوكوس',
    tips: 'المغرب من أكبر مصدري الفراولة لأوروبا — جودة عالية جداً في مارس-أبريل',
  },
  {
    id: 'watermelon',
    nameAr: 'دلاح',
    nameFr: 'Pastèque',
    category: 'fruits',
    icon: '🍉',
    peakMonths:      [6, 7, 8],
    availableMonths: [5, 6, 7, 8, 9],
    region: 'تادلة، سوس ماسة، الحوز',
    tips: 'موسم الذروة يوليو — الأسعار ترتفع في أواخر الموسم',
  },
  {
    id: 'melon',
    nameAr: 'بطيخ أصفر',
    nameFr: 'Melon',
    category: 'fruits',
    icon: '🍈',
    peakMonths:      [7, 8, 9],
    availableMonths: [6, 7, 8, 9, 10],
    region: 'تادلة، الراشيدية',
    tips: 'الصنف الفقوس متوفر في يونيو — المارسوبان في يوليو',
  },
  {
    id: 'grape',
    nameAr: 'عنب',
    nameFr: 'Raisin',
    category: 'fruits',
    icon: '🍇',
    peakMonths:      [8, 9, 10],
    availableMonths: [7, 8, 9, 10, 11],
    region: 'مكناس، زرهون، مراكش',
    tips: 'العنب المكناسي يتميز بالحلاوة — الأصناف التصديرية تبدأ يوليو',
  },
  {
    id: 'fig',
    nameAr: 'تين',
    nameFr: 'Figues',
    category: 'fruits',
    icon: '🫐',
    peakMonths:      [7, 8, 9],
    availableMonths: [6, 7, 8, 9, 10],
    region: 'الشاوية، زرهون، الريف',
    tips: 'الموسم قصير جداً — تجفيف التين رائج للاستفادة من الفائض',
  },
  {
    id: 'olive',
    nameAr: 'زيتون',
    nameFr: 'Olives',
    category: 'fruits',
    icon: '🫒',
    peakMonths:      [10, 11, 12],
    availableMonths: [9, 10, 11, 12, 1],
    region: 'مكناس، فاس، بني ملال',
    tips: 'الزيتون الأخضر يُقطف أكتوبر، الأسود في نوفمبر-ديسمبر',
  },
  {
    id: 'date',
    nameAr: 'تمر',
    nameFr: 'Dattes',
    category: 'fruits',
    icon: '🟫',
    peakMonths:      [10, 11],
    availableMonths: [9, 10, 11, 12, 1, 2, 3],
    region: 'تافيلالت، سجلماسة، ورزازات',
    tips: 'المجهول تافيلالت — من أجود أنواع التمر عالمياً، احجز مسبقاً في يونيو',
  },
  {
    id: 'pomegranate',
    nameAr: 'رمان',
    nameFr: 'Grenade',
    category: 'fruits',
    icon: '🔴',
    peakMonths:      [9, 10, 11],
    availableMonths: [8, 9, 10, 11, 12],
    region: 'مراكش، تافيلالت، الحوز',
    tips: 'الأسعار تنخفض في أكتوبر عند الذروة — مناسب للمطاعم والعصائر',
  },
  {
    id: 'apple',
    nameAr: 'تفاح',
    nameFr: 'Pommes',
    category: 'fruits',
    icon: '🍎',
    peakMonths:      [8, 9, 10],
    availableMonths: [7, 8, 9, 10, 11, 12, 1, 2, 3],
    region: 'إمليل، ميدلت، إفران',
    tips: 'تفاح جبال الأطلس يتميز بمذاقه الفريد — التخزين البارد يمتد للربيع',
  },

  // ─── Herbs ───────────────────────────────────────────────────────────────────
  {
    id: 'coriander',
    nameAr: 'قزبر',
    nameFr: 'Coriandre',
    category: 'herbs',
    icon: '🌿',
    peakMonths:      [3, 4, 5, 9, 10, 11],
    availableMonths: [1, 2, 3, 4, 5, 6, 9, 10, 11, 12],
    region: 'متوفر في جميع المناطق',
    tips: 'دورتان — ربيعية وخريفية. يجف بسرعة في الصيف.',
  },
  {
    id: 'parsley',
    nameAr: 'معدنوس',
    nameFr: 'Persil',
    category: 'herbs',
    icon: '🌱',
    peakMonths:      [3, 4, 5, 10, 11],
    availableMonths: [1, 2, 3, 4, 5, 9, 10, 11, 12],
    region: 'متوفر في جميع المناطق',
    tips: 'يحتاج طقساً بارداً رطباً — الطلب مستمر من المطاعم طوال العام',
  },
  {
    id: 'mint',
    nameAr: 'نعناع',
    nameFr: 'Menthe',
    category: 'herbs',
    icon: '🍃',
    peakMonths:      [4, 5, 6, 7, 8],
    availableMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    region: 'مراكش، فاس، الغرب',
    tips: 'الطلب الأعلى في رمضان — احتياطي مسبق ضروري للمطاعم والمقاهي',
  },
  {
    id: 'saffron',
    nameAr: 'زعفران',
    nameFr: 'Safran',
    category: 'herbs',
    icon: '🌸',
    peakMonths:      [11],
    availableMonths: [10, 11, 12],
    region: 'تالوين (سوس ماسة)',
    tips: 'زعفران تالوين له حماية جغرافية دولية — الموسم قصير جداً (15 يوماً)',
  },

  // ─── Plants ──────────────────────────────────────────────────────────────────
  {
    id: 'rose',
    nameAr: 'ورد',
    nameFr: 'Roses',
    category: 'plants',
    icon: '🌹',
    peakMonths:      [4, 5],
    availableMonths: [3, 4, 5, 6],
    region: 'قلعة مكونة، دادس',
    tips: 'ورد دادس للتقطير والعطور — أزهار مايو تُنتج أجود الماء الورد',
  },
  {
    id: 'argan',
    nameAr: 'أركان',
    nameFr: 'Arganier',
    category: 'plants',
    icon: '🌳',
    peakMonths:      [6, 7, 8],
    availableMonths: [6, 7, 8, 9],
    region: 'سوس ماسة، الحوز الغربي',
    tips: 'موسم جمع الأركان يونيو-أغسطس — الزيت الغذائي بالجملة ذو قيمة عالية',
  },
]

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Get all products available in a given month (1-12).
 * Returns items sorted so peak-season products come first.
 */
export function getProductsInMonth(month) {
  return MOROCCAN_SEASONS
    .filter((p) => p.availableMonths.includes(month))
    .sort((a, b) => {
      const aPeak = a.peakMonths.includes(month) ? 0 : 1
      const bPeak = b.peakMonths.includes(month) ? 0 : 1
      return aPeak - bPeak
    })
}

/**
 * Get peak products for a month, optionally filtered by category.
 */
export function getPeakProducts(month, category = '') {
  return MOROCCAN_SEASONS.filter(
    (p) => p.peakMonths.includes(month) && (!category || p.category === category)
  )
}

/**
 * Get products by category.
 */
export function getProductsByCategory(category) {
  return MOROCCAN_SEASONS.filter((p) => p.category === category)
}

/**
 * Get the availability status for a product in a given month.
 * @returns {'peak' | 'available' | 'unavailable'}
 */
export function getAvailabilityStatus(product, month) {
  if (product.peakMonths.includes(month)) return 'peak'
  if (product.availableMonths.includes(month)) return 'available'
  return 'unavailable'
}

/**
 * Arabic month names.
 */
export const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل',
  'مايو', 'يونيو', 'يوليو', 'أغسطس',
  'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]
